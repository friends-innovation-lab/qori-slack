'use strict';

/**
 * GOV-3B Repair — Composite FK and public_id Default Fixes
 *
 * This forward-only migration repairs schema gaps from partial GOV-3B execution:
 *
 * 1. Adds missing gen_random_uuid() defaults to public_id columns where the
 *    column exists but the default is absent (data_subjects, created_issues,
 *    evidence_relationships).
 *
 * 2. Adds missing composite FKs to artifact_evidence_refs:
 *    - (project_id, artifact_id) → research_artifacts(project_id, id)
 *    - (project_id, construct_id) → evidence_constructs(project_id, id)
 *
 * Safety guarantees:
 * - Preflight checks abort on cross-project violations or orphan rows
 * - Constraint definition verification prevents name collisions with wrong definitions
 * - Uses explicit transaction for atomicity
 * - Idempotent: safe to run on already-correct schemas
 */

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ──────────────────────────────────────────────────────────────────
      // STEP 1: Add missing gen_random_uuid() defaults to public_id columns
      // ──────────────────────────────────────────────────────────────────

      const columnsToFix = [
        { table: 'data_subjects', column: 'public_id' },
        { table: 'created_issues', column: 'public_id' },
        { table: 'evidence_relationships', column: 'public_id' },
      ];

      for (const { table, column } of columnsToFix) {
        // Check if column exists
        const [colExists] = await queryInterface.sequelize.query(
          `SELECT 1 FROM information_schema.columns
           WHERE table_name = :table AND column_name = :column`,
          { replacements: { table, column }, transaction }
        );

        if (colExists.length === 0) {
          console.log(`GOV-3B-REPAIR: Column ${table}.${column} does not exist, skipping`);
          continue;
        }

        // Check if default is already set
        const [defaultInfo] = await queryInterface.sequelize.query(
          `SELECT column_default FROM information_schema.columns
           WHERE table_name = :table AND column_name = :column`,
          { replacements: { table, column }, transaction }
        );

        const currentDefault = defaultInfo[0]?.column_default;
        if (currentDefault && currentDefault.includes('gen_random_uuid')) {
          console.log(`GOV-3B-REPAIR: ${table}.${column} already has gen_random_uuid() default`);
          continue;
        }

        // Add the default
        await queryInterface.sequelize.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT gen_random_uuid()`,
          { transaction }
        );
        console.log(`GOV-3B-REPAIR: Added gen_random_uuid() default to ${table}.${column}`);
      }

      // ──────────────────────────────────────────────────────────────────
      // STEP 2: Verify parent UNIQUE constraints exist (required for composite FK targets)
      // ──────────────────────────────────────────────────────────────────

      const parentConstraints = [
        { table: 'research_artifacts', constraint: 'uq_research_artifacts_project_id' },
        { table: 'evidence_constructs', constraint: 'uq_evidence_constructs_project_id' },
      ];

      for (const { table, constraint } of parentConstraints) {
        const [exists] = await queryInterface.sequelize.query(
          `SELECT 1 FROM pg_constraint WHERE conname = :constraint`,
          { replacements: { constraint }, transaction }
        );

        if (exists.length === 0) {
          throw new Error(
            `GOV-3B-REPAIR ABORTED: Required parent constraint ${constraint} does not exist on ${table}. ` +
            `Run the original GOV-3B migration first.`
          );
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // STEP 3: Preflight checks for artifact_evidence_refs
      // ──────────────────────────────────────────────────────────────────

      // Check for orphan artifact_id references (artifact doesn't exist)
      const [orphanArtifacts] = await queryInterface.sequelize.query(
        `SELECT aer.id, aer.artifact_id
         FROM artifact_evidence_refs aer
         LEFT JOIN research_artifacts ra ON ra.id = aer.artifact_id
         WHERE ra.id IS NULL`,
        { transaction }
      );

      if (orphanArtifacts.length > 0) {
        throw new Error(
          `GOV-3B-REPAIR ABORTED: ${orphanArtifacts.length} artifact_evidence_refs rows reference ` +
          `non-existent artifacts. IDs: ${orphanArtifacts.map(r => r.id).join(', ')}. ` +
          `Clean up orphan rows before running this migration.`
        );
      }

      // Check for orphan construct_id references (construct doesn't exist)
      const [orphanConstructs] = await queryInterface.sequelize.query(
        `SELECT aer.id, aer.construct_id
         FROM artifact_evidence_refs aer
         LEFT JOIN evidence_constructs ec ON ec.id = aer.construct_id
         WHERE ec.id IS NULL`,
        { transaction }
      );

      if (orphanConstructs.length > 0) {
        throw new Error(
          `GOV-3B-REPAIR ABORTED: ${orphanConstructs.length} artifact_evidence_refs rows reference ` +
          `non-existent constructs. IDs: ${orphanConstructs.map(r => r.id).join(', ')}. ` +
          `Clean up orphan rows before running this migration.`
        );
      }

      // Check for cross-project violations: artifact.project_id != aer.project_id
      const [artifactViolations] = await queryInterface.sequelize.query(
        `SELECT aer.id, aer.project_id AS ref_pid, ra.project_id AS artifact_pid
         FROM artifact_evidence_refs aer
         JOIN research_artifacts ra ON ra.id = aer.artifact_id
         WHERE aer.project_id != ra.project_id`,
        { transaction }
      );

      if (artifactViolations.length > 0) {
        throw new Error(
          `GOV-3B-REPAIR ABORTED: ${artifactViolations.length} artifact_evidence_refs rows have ` +
          `cross-project artifact references. IDs: ${artifactViolations.map(r => r.id).join(', ')}. ` +
          `Fix data integrity before running this migration.`
        );
      }

      // Check for cross-project violations: construct.project_id != aer.project_id
      const [constructViolations] = await queryInterface.sequelize.query(
        `SELECT aer.id, aer.project_id AS ref_pid, ec.project_id AS construct_pid
         FROM artifact_evidence_refs aer
         JOIN evidence_constructs ec ON ec.id = aer.construct_id
         WHERE aer.project_id != ec.project_id`,
        { transaction }
      );

      if (constructViolations.length > 0) {
        throw new Error(
          `GOV-3B-REPAIR ABORTED: ${constructViolations.length} artifact_evidence_refs rows have ` +
          `cross-project construct references. IDs: ${constructViolations.map(r => r.id).join(', ')}. ` +
          `Fix data integrity before running this migration.`
        );
      }

      console.log('GOV-3B-REPAIR: Preflight checks passed (no orphans, no cross-project violations)');

      // ──────────────────────────────────────────────────────────────────
      // STEP 4: Add composite FKs to artifact_evidence_refs
      // ──────────────────────────────────────────────────────────────────

      const compositeFKs = [
        {
          name: 'fk_aer_artifact_project',
          columns: ['project_id', 'artifact_id'],
          refTable: 'research_artifacts',
          refColumns: ['project_id', 'id'],
        },
        {
          name: 'fk_aer_construct_project',
          columns: ['project_id', 'construct_id'],
          refTable: 'evidence_constructs',
          refColumns: ['project_id', 'id'],
        },
      ];

      for (const fk of compositeFKs) {
        // Check if constraint already exists
        const [existingConstraint] = await queryInterface.sequelize.query(
          `SELECT conname, pg_get_constraintdef(oid) AS definition
           FROM pg_constraint
           WHERE conrelid = 'artifact_evidence_refs'::regclass
             AND conname = :name`,
          { replacements: { name: fk.name }, transaction }
        );

        if (existingConstraint.length > 0) {
          // Verify the definition matches what we expect
          const expectedPattern = new RegExp(
            `FOREIGN KEY \\(${fk.columns.join(', ')}\\).*REFERENCES ${fk.refTable}\\(${fk.refColumns.join(', ')}\\)`,
            'i'
          );

          if (expectedPattern.test(existingConstraint[0].definition)) {
            console.log(`GOV-3B-REPAIR: Constraint ${fk.name} already exists with correct definition`);
            continue;
          } else {
            throw new Error(
              `GOV-3B-REPAIR ABORTED: Constraint ${fk.name} exists but has wrong definition.\n` +
              `  Expected: FOREIGN KEY (${fk.columns.join(', ')}) REFERENCES ${fk.refTable}(${fk.refColumns.join(', ')})\n` +
              `  Actual: ${existingConstraint[0].definition}\n` +
              `Manual intervention required.`
            );
          }
        }

        // Add the constraint with NOT VALID first (fast, no full table scan)
        await queryInterface.sequelize.query(
          `ALTER TABLE artifact_evidence_refs
           ADD CONSTRAINT ${fk.name}
           FOREIGN KEY (${fk.columns.join(', ')})
           REFERENCES ${fk.refTable}(${fk.refColumns.join(', ')})
           ON DELETE CASCADE
           NOT VALID`,
          { transaction }
        );
        console.log(`GOV-3B-REPAIR: Added constraint ${fk.name} (NOT VALID)`);

        // Validate the constraint (scans existing rows)
        await queryInterface.sequelize.query(
          `ALTER TABLE artifact_evidence_refs VALIDATE CONSTRAINT ${fk.name}`,
          { transaction }
        );
        console.log(`GOV-3B-REPAIR: Validated constraint ${fk.name}`);
      }

      await transaction.commit();
      console.log('GOV-3B-REPAIR: Migration completed successfully');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    // Forward-only migration — down() removes repair changes for testing
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove composite FKs
      await queryInterface.sequelize.query(
        `ALTER TABLE artifact_evidence_refs DROP CONSTRAINT IF EXISTS fk_aer_artifact_project`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE artifact_evidence_refs DROP CONSTRAINT IF EXISTS fk_aer_construct_project`,
        { transaction }
      );

      // Note: We don't remove the public_id defaults — they're harmless and
      // removing them would break future inserts. This is intentional.

      await transaction.commit();
      console.log('GOV-3B-REPAIR: Down migration completed (constraints removed, defaults preserved)');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
