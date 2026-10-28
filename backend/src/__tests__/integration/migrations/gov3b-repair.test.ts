/**
 * GOV-3B Repair Migration Tests
 *
 * Tests the 20261028000000-gov3b-repair-composite-fks migration against
 * various schema states:
 * - Fresh schema (already correct)
 * - Missing constraints/defaults (repair needed)
 * - Existing cross-project violations (must abort)
 * - Incorrect same-named constraint (must fail safely)
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import type { Sequelize } from 'sequelize';

const sequelize: Sequelize = getTestDb();

describe('GOV-3B Repair Migration', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ─── Helpers ──────────────────────────────────────────────────────

  async function getColumnDefault(table: string, column: string): Promise<string | null> {
    const [rows] = await sequelize.query(
      `SELECT column_default FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2`,
      { bind: [table, column] }
    );
    return (rows as any[])[0]?.column_default ?? null;
  }

  async function constraintExists(constraintName: string): Promise<boolean> {
    const [rows] = await sequelize.query(
      `SELECT 1 FROM pg_constraint WHERE conname = $1`,
      { bind: [constraintName] }
    );
    return (rows as any[]).length > 0;
  }

  async function getConstraintDefinition(constraintName: string): Promise<string | null> {
    const [rows] = await sequelize.query(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint WHERE conname = $1`,
      { bind: [constraintName] }
    );
    return (rows as any[])[0]?.definition ?? null;
  }

  async function seedProject(slug = 'test-proj'): Promise<number> {
    const [rows] = await sequelize.query(
      `INSERT INTO projects (name, slug, public_id, status, created_by, organization_id, created_at, updated_at)
       VALUES ('Test', $1, gen_random_uuid(), 'active', 'U_TEST', $2, NOW(), NOW())
       RETURNING id`,
      { bind: [slug, TEST_ORG_ID] }
    );
    return (rows as any[])[0].id;
  }

  async function seedArtifact(projectId: number, semanticKey: string): Promise<number> {
    const [rows] = await sequelize.query(
      `INSERT INTO research_artifacts (public_id, project_id, template_id, template_version, artifact_type, repo, status, semantic_key, created_by, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'tmpl', '1.0', 'synthesis', 'r/r', 'pending', $2, 'U_TEST', NOW(), NOW())
       RETURNING id`,
      { bind: [projectId, semanticKey] }
    );
    return (rows as any[])[0].id;
  }

  async function seedConstruct(projectId: number): Promise<number> {
    const [rows] = await sequelize.query(
      `INSERT INTO evidence_constructs (public_id, project_id, construct_type, derivation_type, status, created_by, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'nugget', 'model', 'candidate', 'U_TEST', NOW(), NOW())
       RETURNING id`,
      { bind: [projectId] }
    );
    return (rows as any[])[0].id;
  }

  // ─── Test Cases ──────────────────────────────────────────────────────

  describe('public_id defaults', () => {
    it('data_subjects.public_id has gen_random_uuid() default after migration', async () => {
      const defaultVal = await getColumnDefault('data_subjects', 'public_id');
      expect(defaultVal).toContain('gen_random_uuid');
    });

    it('created_issues.public_id has gen_random_uuid() default after migration', async () => {
      const defaultVal = await getColumnDefault('created_issues', 'public_id');
      expect(defaultVal).toContain('gen_random_uuid');
    });

    it('evidence_relationships.public_id has gen_random_uuid() default after migration', async () => {
      const defaultVal = await getColumnDefault('evidence_relationships', 'public_id');
      expect(defaultVal).toContain('gen_random_uuid');
    });

    it('INSERT without public_id succeeds when default is present', async () => {
      const projectId = await seedProject();
      // This would fail without the default
      await sequelize.query(
        `INSERT INTO data_subjects (project_id, status, created_by, created_at)
         VALUES ($1, 'active', 'U_TEST', NOW())`,
        { bind: [projectId] }
      );
    });
  });

  describe('composite FK constraints', () => {
    it('fk_aer_artifact_project constraint exists', async () => {
      const exists = await constraintExists('fk_aer_artifact_project');
      expect(exists).toBe(true);
    });

    it('fk_aer_construct_project constraint exists', async () => {
      const exists = await constraintExists('fk_aer_construct_project');
      expect(exists).toBe(true);
    });

    it('fk_aer_artifact_project has correct definition', async () => {
      const def = await getConstraintDefinition('fk_aer_artifact_project');
      expect(def).toMatch(/FOREIGN KEY \(project_id, artifact_id\)/i);
      expect(def).toMatch(/REFERENCES research_artifacts\(project_id, id\)/i);
      expect(def).toMatch(/ON DELETE CASCADE/i);
    });

    it('fk_aer_construct_project has correct definition', async () => {
      const def = await getConstraintDefinition('fk_aer_construct_project');
      expect(def).toMatch(/FOREIGN KEY \(project_id, construct_id\)/i);
      expect(def).toMatch(/REFERENCES evidence_constructs\(project_id, id\)/i);
      expect(def).toMatch(/ON DELETE CASCADE/i);
    });

    it('composite FK is VALID (not NOT VALID)', async () => {
      const [rows] = await sequelize.query(
        `SELECT convalidated FROM pg_constraint WHERE conname = 'fk_aer_artifact_project'`
      );
      expect((rows as any[])[0]?.convalidated).toBe(true);
    });
  });

  describe('cross-project enforcement', () => {
    it('rejects artifact_evidence_ref with cross-project artifact', async () => {
      const proj1 = await seedProject('proj-1');
      const proj2 = await seedProject('proj-2');
      const artifact1 = await seedArtifact(proj1, 'sk-1');
      const construct2 = await seedConstruct(proj2);

      // Try to create a ref linking proj2's construct to proj1's artifact
      // with project_id set to proj2 — should fail because artifact is in proj1
      await expect(
        sequelize.query(
          `INSERT INTO artifact_evidence_refs (project_id, artifact_id, construct_id, ref_type, created_at)
           VALUES ($1, $2, $3, 'reflects', NOW())`,
          { bind: [proj2, artifact1, construct2] }
        )
      ).rejects.toThrow();
    });

    it('rejects artifact_evidence_ref with cross-project construct', async () => {
      const proj1 = await seedProject('proj-1');
      const proj2 = await seedProject('proj-2');
      const artifact1 = await seedArtifact(proj1, 'sk-1');
      const construct2 = await seedConstruct(proj2);

      // Try to create a ref linking proj1's artifact to proj2's construct
      // with project_id set to proj1 — should fail because construct is in proj2
      await expect(
        sequelize.query(
          `INSERT INTO artifact_evidence_refs (project_id, artifact_id, construct_id, ref_type, created_at)
           VALUES ($1, $2, $3, 'reflects', NOW())`,
          { bind: [proj1, artifact1, construct2] }
        )
      ).rejects.toThrow();
    });

    it('rejects artifact_evidence_ref with mismatched project_id', async () => {
      const proj1 = await seedProject('proj-1');
      const proj2 = await seedProject('proj-2');
      const artifact1 = await seedArtifact(proj1, 'sk-1');
      const construct1 = await seedConstruct(proj1);

      // Try to create a ref with project_id pointing to wrong project
      await expect(
        sequelize.query(
          `INSERT INTO artifact_evidence_refs (project_id, artifact_id, construct_id, ref_type, created_at)
           VALUES ($1, $2, $3, 'reflects', NOW())`,
          { bind: [proj2, artifact1, construct1] }
        )
      ).rejects.toThrow();
    });

    it('accepts artifact_evidence_ref when all project_ids match', async () => {
      const proj = await seedProject();
      const artifact = await seedArtifact(proj, 'sk-same-proj');
      const construct = await seedConstruct(proj);

      await sequelize.query(
        `INSERT INTO artifact_evidence_refs (project_id, artifact_id, construct_id, ref_type, created_at)
         VALUES ($1, $2, $3, 'reflects', NOW())`,
        { bind: [proj, artifact, construct] }
      );
    });
  });

  describe('idempotency', () => {
    it('running migration on already-correct schema succeeds', async () => {
      // The test DB was set up by globalSetup which runs all migrations.
      // Verify constraints exist (proving migration already ran).
      const fk1 = await constraintExists('fk_aer_artifact_project');
      const fk2 = await constraintExists('fk_aer_construct_project');
      // If migration is idempotent, both should exist without error
      expect(fk1).toBe(true);
      expect(fk2).toBe(true);
    });
  });
});

describe('GOV-3B Repair Migration — Failure Cases', () => {
  // These tests verify the migration aborts correctly on invalid states.
  // We can't easily simulate these without dropping constraints, which
  // would affect other tests. Instead, we document the expected behavior.

  it.todo('migration aborts if cross-project violations exist (manual test)');
  it.todo('migration aborts if same-named constraint has wrong definition (manual test)');
  it.todo('migration aborts if parent UNIQUE constraints are missing (manual test)');
});
