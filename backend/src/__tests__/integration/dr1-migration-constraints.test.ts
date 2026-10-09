/**
 * DR-1 Migration Constraint Tests
 *
 * Tests PostgreSQL triggers and rules from migration 20261009000003.
 *
 * Verification Matrix:
 * - Same-construct validation triggers
 * - Immutability enforcement triggers
 * - Append-only rules
 * - Migration rollback verification
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { CreationAttributes } from 'sequelize';
import type { EvidenceSource } from '../../database/models/evidence_source';

describe('DR-1 Migration Constraints', () => {
  let sequelize: Sequelize;
  let projectId: number;
  let project2Id: number;
  let sourceId: number;

  beforeAll(async () => {
    sequelize = getTestDb();
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await truncateAll();

    const ProjectModel = sequelize.models.Project;
    const EvidenceSourceModel = sequelize.models.EvidenceSource;

    // Create projects
    const project = await ProjectModel.create({
      name: 'Test Project',
      slug: 'test-project',
      status: 'active',
      created_by: 'U_TEST',
      organization_id: TEST_ORG_ID,
    });
    projectId = (project as any).id;

    const project2 = await ProjectModel.create({
      name: 'Test Project 2',
      slug: 'test-project-2',
      status: 'active',
      created_by: 'U_TEST',
      organization_id: TEST_ORG_ID,
    });
    project2Id = (project2 as any).id;

    // Create source
    const source = await EvidenceSourceModel.create({
      project_id: projectId,
      source_type: 'uploaded_document',
      label: 'Test Document',
      created_by: 'U_TEST',
    } as CreationAttributes<EvidenceSource>);
    sourceId = (source as any).id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAME-CONSTRUCT VALIDATION TRIGGERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Same-Construct Validation Triggers', () => {
    describe('trg_check_latest_revision_construct', () => {
      it('rejects cross-construct latest_revision_id pointer', async () => {
        // Create construct 1
        const [construct1Results] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const construct1Id = (construct1Results as any[])[0].id;

        // Create construct 2
        const [construct2Results] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 2', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const construct2Id = (construct2Results as any[])[0].id;

        // Create revision for construct 2
        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${construct2Id}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // Try to set construct1's latest_revision_id to revision from construct2
        await expect(
          sequelize.query(`
            UPDATE evidence_constructs
            SET latest_revision_id = ${revisionId}
            WHERE id = ${construct1Id}
          `),
        ).rejects.toThrow('latest_revision_id must belong to this construct');
      });

      it('accepts same-construct latest_revision_id pointer', async () => {
        // Create construct
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        // Create revision for same construct
        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // This should succeed
        await expect(
          sequelize.query(`
            UPDATE evidence_constructs
            SET latest_revision_id = ${revisionId}
            WHERE id = ${constructId}
          `),
        ).resolves.toBeDefined();
      });
    });

    describe('trg_check_accepted_revision_construct', () => {
      it('rejects cross-construct accepted_revision_id pointer', async () => {
        // Create construct 1
        const [construct1Results] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const construct1Id = (construct1Results as any[])[0].id;

        // Create construct 2 with revision
        const [construct2Results] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 2', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const construct2Id = (construct2Results as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${construct2Id}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // Try to set construct1's accepted_revision_id to revision from construct2
        await expect(
          sequelize.query(`
            UPDATE evidence_constructs
            SET accepted_revision_id = ${revisionId}
            WHERE id = ${construct1Id}
          `),
        ).rejects.toThrow('accepted_revision_id must belong to this construct');
      });
    });

    describe('trg_check_review_revision_construct', () => {
      it('rejects cross-construct review revision', async () => {
        // Create construct 1
        const [construct1Results] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const construct1Id = (construct1Results as any[])[0].id;

        // Create construct 2 with revision
        const [construct2Results] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 2', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const construct2Id = (construct2Results as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${construct2Id}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // Try to create review for construct1 referencing revision from construct2
        await expect(
          sequelize.query(`
            INSERT INTO evidence_construct_reviews
              (public_id, construct_id, revision_id, action, reviewed_by, expected_version, reviewed_at)
            VALUES
              (gen_random_uuid(), ${construct1Id}, ${revisionId}, 'accept', 'U_TEST', 1, NOW())
          `),
        ).rejects.toThrow('revision_id must belong to the same construct as the review');
      });

      it('accepts same-construct review revision', async () => {
        // Create construct with revision
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // This should succeed
        await expect(
          sequelize.query(`
            INSERT INTO evidence_construct_reviews
              (public_id, construct_id, revision_id, action, reviewed_by, expected_version, reviewed_at)
            VALUES
              (gen_random_uuid(), ${constructId}, ${revisionId}, 'accept', 'U_TEST', 1, NOW())
          `),
        ).resolves.toBeDefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IMMUTABILITY ENFORCEMENT TRIGGERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Immutability Enforcement Triggers', () => {
    describe('trg_prevent_revision_content_update', () => {
      it('rejects mutation of revision content', async () => {
        // Create construct with revision
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "original"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // Try to update content
        await expect(
          sequelize.query(`
            UPDATE evidence_construct_revisions
            SET content = '{"wording": "modified"}'
            WHERE id = ${revisionId}
          `),
        ).rejects.toThrow('revision content is immutable');
      });

      it('rejects mutation of evidence_snapshot', async () => {
        // Create construct with revision
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "test"}', '[{"source": "A"}]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // Try to update evidence_snapshot
        await expect(
          sequelize.query(`
            UPDATE evidence_construct_revisions
            SET evidence_snapshot = '[{"source": "B"}]'
            WHERE id = ${revisionId}
          `),
        ).rejects.toThrow('revision evidence_snapshot is immutable');
      });

      it('allows update of non-immutable revision fields (same value passes)', async () => {
        // Create construct with revision
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);

        // The trigger only blocks content and evidence_snapshot changes
        // Updating with same values should succeed (IS DISTINCT returns false)
        await expect(
          sequelize.query(`
            UPDATE evidence_construct_revisions
            SET content = '{"wording": "test"}', evidence_snapshot = '[]'
            WHERE construct_id = ${constructId}
          `),
        ).resolves.toBeDefined();
      });
    });

    describe('trg_prevent_review_update', () => {
      it('rejects any review event update', async () => {
        // Create construct with revision and review
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        const [reviewResults] = await sequelize.query(`
          INSERT INTO evidence_construct_reviews
            (public_id, construct_id, revision_id, action, reviewed_by, expected_version, reviewed_at)
          VALUES
            (gen_random_uuid(), ${constructId}, ${revisionId}, 'accept', 'U_TEST', 1, NOW())
          RETURNING id
        `);
        const reviewId = (reviewResults as any[])[0].id;

        // Try to update review
        await expect(
          sequelize.query(`
            UPDATE evidence_construct_reviews
            SET comment = 'modified comment'
            WHERE id = ${reviewId}
          `),
        ).rejects.toThrow('review events are immutable - updates not allowed');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APPEND-ONLY RULES (DELETE PROTECTION)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Append-Only Rules', () => {
    describe('prevent_revision_delete', () => {
      it('silently ignores revision deletion (DO INSTEAD NOTHING)', async () => {
        // Create construct with revision
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        // Delete should "succeed" but do nothing
        await sequelize.query(`
          DELETE FROM evidence_construct_revisions WHERE id = ${revisionId}
        `);

        // Verify revision still exists
        const [checkResults] = await sequelize.query(`
          SELECT id FROM evidence_construct_revisions WHERE id = ${revisionId}
        `);
        expect((checkResults as any[]).length).toBe(1);
      });
    });

    describe('prevent_review_delete', () => {
      it('silently ignores review deletion (DO INSTEAD NOTHING)', async () => {
        // Create construct with revision and review
        const [constructResults] = await sequelize.query(`
          INSERT INTO evidence_constructs (public_id, project_id, construct_type, label, status, derivation_type, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), ${projectId}, 'desk_insight', 'Insight 1', 'candidate', 'human', 'U_TEST', NOW(), NOW())
          RETURNING id
        `);
        const constructId = (constructResults as any[])[0].id;

        const [revisionResults] = await sequelize.query(`
          INSERT INTO evidence_construct_revisions
            (public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at)
          VALUES
            (gen_random_uuid(), ${constructId}, 1, '{"wording": "test"}', '[]', 'researcher', 'U_TEST', NOW())
          RETURNING id
        `);
        const revisionId = (revisionResults as any[])[0].id;

        const [reviewResults] = await sequelize.query(`
          INSERT INTO evidence_construct_reviews
            (public_id, construct_id, revision_id, action, reviewed_by, expected_version, reviewed_at)
          VALUES
            (gen_random_uuid(), ${constructId}, ${revisionId}, 'accept', 'U_TEST', 1, NOW())
          RETURNING id
        `);
        const reviewId = (reviewResults as any[])[0].id;

        // Delete should "succeed" but do nothing
        await sequelize.query(`
          DELETE FROM evidence_construct_reviews WHERE id = ${reviewId}
        `);

        // Verify review still exists
        const [checkResults] = await sequelize.query(`
          SELECT id FROM evidence_construct_reviews WHERE id = ${reviewId}
        `);
        expect((checkResults as any[]).length).toBe(1);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MIGRATION ROLLBACK VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Migration Rollback Verification', () => {
    it('triggers exist after migration', async () => {
      const [results] = await sequelize.query(`
        SELECT trigger_name FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        AND trigger_name LIKE 'trg_%'
        ORDER BY trigger_name
      `);

      const triggerNames = (results as any[]).map(r => r.trigger_name);

      expect(triggerNames).toContain('trg_check_latest_revision_construct');
      expect(triggerNames).toContain('trg_check_accepted_revision_construct');
      expect(triggerNames).toContain('trg_check_review_revision_construct');
      expect(triggerNames).toContain('trg_prevent_revision_content_update');
      expect(triggerNames).toContain('trg_prevent_review_update');
    });

    it('rules exist after migration', async () => {
      const [results] = await sequelize.query(`
        SELECT rulename FROM pg_rules
        WHERE schemaname = 'public'
        AND rulename LIKE 'prevent_%'
        ORDER BY rulename
      `);

      const ruleNames = (results as any[]).map(r => r.rulename);

      expect(ruleNames).toContain('prevent_revision_delete');
      expect(ruleNames).toContain('prevent_review_delete');
    });

    it('functions exist after migration', async () => {
      const [results] = await sequelize.query(`
        SELECT proname FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace
        AND proname IN (
          'check_latest_revision_construct',
          'check_accepted_revision_construct',
          'check_review_revision_construct',
          'prevent_revision_content_update',
          'prevent_review_update'
        )
        ORDER BY proname
      `);

      const funcNames = (results as any[]).map(r => r.proname);

      expect(funcNames).toContain('check_latest_revision_construct');
      expect(funcNames).toContain('check_accepted_revision_construct');
      expect(funcNames).toContain('check_review_revision_construct');
      expect(funcNames).toContain('prevent_revision_content_update');
      expect(funcNames).toContain('prevent_review_update');
    });
  });
});
