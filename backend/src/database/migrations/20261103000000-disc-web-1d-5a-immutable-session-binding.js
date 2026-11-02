'use strict';

/**
 * DISC-WEB-1D-2 M5a: Immutable session-to-run binding via ON DELETE RESTRICT.
 *
 * This migration changes the `discovery_run_id` foreign key behavior from
 * `ON DELETE SET NULL` to `ON DELETE RESTRICT`, preventing run deletion
 * while a controlled session references it.
 *
 * Key invariants:
 * - A controlled session's bound run CANNOT be deleted while the session exists
 * - Sessions must be deleted before their bound run can be deleted
 * - This closes the fail-open gap where SET NULL could orphan budget enforcement
 *
 * Prerequisites verified before modification:
 * - FK constraint exists with ON DELETE SET NULL (confdeltype = 'n')
 * - Unique non-null run-binding index exists
 *
 * Atomicity: All DDL wrapped in transaction. Failure at any step rolls back entirely.
 *
 * Forward-only: No down() migration. Once binding is immutable, reverting
 * would require careful consideration of orphaned sessions.
 */

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ─── Prerequisite 1: Verify unique index exists ────────────────────────────
      const [indexResult] = await queryInterface.sequelize.query(
        `
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'controlled_test_sessions'
        AND indexname = 'controlled_test_sessions_discovery_run_id_unique_idx'
        `,
        { transaction },
      );

      if (indexResult.length === 0) {
        throw new Error(
          'M5a prerequisite failed: controlled_test_sessions_discovery_run_id_unique_idx not found. ' +
            'Run M1 migration first.',
        );
      }

      // ─── Prerequisite 2: Verify FK exists with ON DELETE SET NULL ──────────────
      // confdeltype: 'n' = SET NULL, 'r' = RESTRICT, 'c' = CASCADE, 'a' = NO ACTION
      const [fkResult] = await queryInterface.sequelize.query(
        `
        SELECT conname, confdeltype FROM pg_constraint
        WHERE conrelid = 'controlled_test_sessions'::regclass
        AND conname = 'controlled_test_sessions_discovery_run_id_fkey'
        `,
        { transaction },
      );

      if (fkResult.length === 0) {
        throw new Error(
          'M5a prerequisite failed: controlled_test_sessions_discovery_run_id_fkey not found. ' +
            'Run M1 migration first.',
        );
      }

      const currentDeleteAction = fkResult[0].confdeltype;
      if (currentDeleteAction === 'r') {
        // Already RESTRICT — migration is idempotent, nothing to do
        await transaction.commit();
        return;
      }

      if (currentDeleteAction !== 'n') {
        // Neither SET NULL nor RESTRICT — unexpected state
        throw new Error(
          `M5a prerequisite failed: FK confdeltype is '${currentDeleteAction}', expected 'n' (SET NULL). ` +
            'Schema is in unexpected state.',
        );
      }

      // ─── Step 1: Drop existing FK constraint (ON DELETE SET NULL) ──────────────
      await queryInterface.sequelize.query(
        `
        ALTER TABLE controlled_test_sessions
        DROP CONSTRAINT controlled_test_sessions_discovery_run_id_fkey
        `,
        { transaction },
      );

      // ─── Step 2: Re-create FK with ON DELETE RESTRICT ──────────────────────────
      await queryInterface.sequelize.query(
        `
        ALTER TABLE controlled_test_sessions
        ADD CONSTRAINT controlled_test_sessions_discovery_run_id_fkey
        FOREIGN KEY (discovery_run_id)
        REFERENCES discovery_runs(id)
        ON DELETE RESTRICT
        `,
        { transaction },
      );

      // ─── Step 3: Verify FK was created with RESTRICT ───────────────────────────
      const [verifyResult] = await queryInterface.sequelize.query(
        `
        SELECT confdeltype FROM pg_constraint
        WHERE conrelid = 'controlled_test_sessions'::regclass
        AND conname = 'controlled_test_sessions_discovery_run_id_fkey'
        `,
        { transaction },
      );

      if (verifyResult.length === 0 || verifyResult[0].confdeltype !== 'r') {
        throw new Error(
          'M5a verification failed: FK was not created with ON DELETE RESTRICT. Rolling back.',
        );
      }

      // ─── Step 4: Update column comment ─────────────────────────────────────────
      await queryInterface.sequelize.query(
        `
        COMMENT ON COLUMN controlled_test_sessions.discovery_run_id IS
        'Bound discovery run (null until run starts, immutable once set, deletion blocked)'
        `,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down() {
    // Forward-only migration.
    // Reverting to SET NULL would reopen the fail-open gap.
    throw new Error(
      'M5a migration is forward-only. Reverting would reopen the fail-open gap ' +
        'where run deletion could orphan budget enforcement.',
    );
  },
};
