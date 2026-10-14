/**
 * DR-6b Desk Research Readout Foundation Integration Tests
 *
 * Tests against real Postgres per DR-6b canonical contract:
 * - Table creation, relationships, constraints, and indexes
 * - Study-scoped RO-0001 display ID allocation
 * - Concurrent display ID allocation
 * - Draft version conflicts (optimistic concurrency)
 * - Duplicate approval prevention
 * - Approval snapshot immutability
 * - Completed generation snapshot immutability
 * - Project/study consistency enforcement
 * - Owner-authorized study deletion and CASCADE
 * - Transaction rollback preserving records
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { ResearchStudy } from '../../database/models/research_study';
import type { Actor } from '../../database/models/actor';
import type { DeskResearchReadout } from '../../database/models/desk_research_readout';
import type { DeskResearchReadoutDraft } from '../../database/models/desk_research_readout_draft';
import type { DeskResearchReadoutVersion } from '../../database/models/desk_research_readout_version';
import type { DeskResearchReadoutApproval } from '../../database/models/desk_research_readout_approval';

const sequelize = getTestDb();

const ProjectModel = sequelize.models.Project;
const ResearchStudyModel = sequelize.models.ResearchStudy;
const ActorModel = sequelize.models.Actor;
const ReadoutModel = sequelize.models.DeskResearchReadout;
const DraftModel = sequelize.models.DeskResearchReadoutDraft;
const VersionModel = sequelize.models.DeskResearchReadoutVersion;
const ApprovalModel = sequelize.models.DeskResearchReadoutApproval;

let projectId: number;
let project2Id: number;
let studyId: number;
let study2Id: number;
let actorId: number;
let actor2Id: number;

async function setupFixtures() {
  // Project 1
  const project = await ProjectModel.create({
    name: 'DR-6b Test Project',
    slug: 'dr6b-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as any).id;

  // Project 2 (for cross-project tests)
  const project2 = await ProjectModel.create({
    name: 'DR-6b Test Project 2',
    slug: 'dr6b-test-2',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  project2Id = (project2 as any).id;

  // Study in project 1
  const study = await ResearchStudyModel.create({
    name: 'Test Study',
    channel_name: 'test-study',
    created_by: 'U_TEST',
    researcher_name: 'Test Researcher',
    researcher_email: 'test@example.com',
    project_id: projectId,
  } as CreationAttributes<ResearchStudy>);
  studyId = (study as any).id;

  // Study 2 in project 1 (for cross-study tests)
  const study2 = await ResearchStudyModel.create({
    name: 'Test Study 2',
    channel_name: 'test-study-2',
    created_by: 'U_TEST',
    researcher_name: 'Test Researcher 2',
    researcher_email: 'test2@example.com',
    project_id: projectId,
  } as CreationAttributes<ResearchStudy>);
  study2Id = (study2 as any).id;

  // Actor 1
  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    status: 'active',
  });
  actorId = (actor as any).id;

  // Actor 2
  const actor2 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher 2',
    status: 'active',
  });
  actor2Id = (actor2 as any).id;
}

async function createReadout(overrides: Partial<CreationAttributes<DeskResearchReadout>> = {}) {
  const defaults = {
    study_id: studyId,
    project_id: projectId,
    display_id: 'RO-0001',
    display_sequence: 1,
    title: 'Test Readout',
    created_by_actor_id: actorId,
  };
  return ReadoutModel.create({ ...defaults, ...overrides } as CreationAttributes<DeskResearchReadout>);
}

async function createDraft(readoutId: number, overrides: Partial<CreationAttributes<DeskResearchReadoutDraft>> = {}) {
  const defaults = {
    readout_id: readoutId,
    content: { summary: { text: 'Test summary' } },
    findings_checked: [],
    implications_reviewed: [],
  };
  return DraftModel.create({ ...defaults, ...overrides } as CreationAttributes<DeskResearchReadoutDraft>);
}

beforeAll(async () => {
  await sequelize.authenticate();
});

beforeEach(async () => {
  await truncateAll();
  await setupFixtures();
});

afterAll(async () => {
  await sequelize.close();
});

describe('DR-6b Desk Research Readout Foundation', () => {
  describe('Table Creation and Relationships', () => {
    it('creates readout with all required fields', async () => {
      const readout = await createReadout();
      expect((readout as any).id).toBeDefined();
      expect((readout as any).public_id).toBeDefined();
      expect((readout as any).display_id).toBe('RO-0001');
      expect((readout as any).study_id).toBe(studyId);
      expect((readout as any).project_id).toBe(projectId);
    });

    it('creates draft with one-to-one relationship', async () => {
      const readout = await createReadout();
      const draft = await createDraft((readout as any).id);

      expect((draft as any).readout_id).toBe((readout as any).id);
      expect((draft as any).content_version).toBe(1);
    });

    it('creates version with generation tracking', async () => {
      const readout = await createReadout();
      const version = await VersionModel.create({
        readout_id: (readout as any).id,
        version_number: 1,
        generation_request_id: '550e8400-e29b-41d4-a716-446655440000',
        generation_status: 'pending',
        draft_content_version_at_start: 1,
        evidence_set: [{ constructPublicId: 'test', revisionPublicId: 'test', revisionNumber: 1 }],
      } as CreationAttributes<DeskResearchReadoutVersion>);

      expect((version as any).generation_status).toBe('pending');
      expect((version as any).draft_content_version_at_start).toBe(1);
    });

    it('creates approval with immutable snapshots', async () => {
      const readout = await createReadout();
      const approval = await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: { summary: { text: 'Approved content' } },
        findings_checked_snapshot: ['F1'],
        implications_reviewed_snapshot: ['Q1'],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      expect((approval as any).approval_number).toBe(1);
      expect((approval as any).source_draft_content_version).toBe(1);
    });
  });

  describe('Study-scoped Display ID Allocation', () => {
    it('allocates unique display_sequence per study', async () => {
      const r1 = await createReadout({ display_sequence: 1, display_id: 'RO-0001' });
      const r2 = await createReadout({ display_sequence: 2, display_id: 'RO-0002' });

      expect((r1 as any).display_sequence).toBe(1);
      expect((r2 as any).display_sequence).toBe(2);
    });

    it('allows same display_sequence in different studies', async () => {
      await createReadout({ study_id: studyId, display_sequence: 1 });
      const r2 = await createReadout({ study_id: study2Id, display_sequence: 1 });

      expect((r2 as any).display_sequence).toBe(1);
    });

    it('rejects duplicate display_sequence within same study', async () => {
      await createReadout({ display_sequence: 1 });

      await expect(
        createReadout({ display_sequence: 1 })
      ).rejects.toThrow(/unique|duplicate|validation error/i);
    });
  });

  describe('Display Sequence Unique Constraint', () => {
    /**
     * This test verifies the UNIQUE constraint on (study_id, display_sequence).
     * The constraint prevents duplicate sequences but does NOT allocate them.
     *
     * Concurrency-safe allocation (e.g., retry-on-collision or serialized MAX+INSERT)
     * is service-layer logic pending DR-6b-2. The database only enforces uniqueness.
     */
    it('rejects duplicate display_sequence via unique constraint', async () => {
      const insertSQL = `
        INSERT INTO desk_research_readouts
        (study_id, project_id, display_id, display_sequence, title, created_by_actor_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      // First insert succeeds
      await sequelize.query(insertSQL, {
        bind: [studyId, projectId, 'RO-0001', 1, 'Readout 1', actorId],
      });

      // Second insert with same sequence fails on unique constraint
      await expect(
        sequelize.query(insertSQL, {
          bind: [studyId, projectId, 'RO-0001', 1, 'Readout 2', actorId],
        })
      ).rejects.toThrow(/unique|duplicate|validation error/i);
    });
  });

  describe('Draft Version Conflicts (Optimistic Concurrency)', () => {
    it('increments content_version on update', async () => {
      const readout = await createReadout();
      const draft = await createDraft((readout as any).id);

      expect((draft as any).content_version).toBe(1);

      await (draft as any).update({
        content: { summary: { text: 'Updated' } },
        content_version: 2,
      });
      await (draft as any).reload();

      expect((draft as any).content_version).toBe(2);
    });

    it('enforces positive content_version constraint', async () => {
      const readout = await createReadout();

      await expect(
        DraftModel.create({
          readout_id: (readout as any).id,
          content: {},
          findings_checked: [],
          implications_reviewed: [],
          content_version: 0,
        } as any)
      ).rejects.toThrow(/check.*content_version/i);
    });
  });

  describe('Duplicate Approval Prevention', () => {
    it('allows one approval per source_draft_content_version', async () => {
      const readout = await createReadout();

      await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: {},
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      await expect(
        ApprovalModel.create({
          readout_id: (readout as any).id,
          approval_number: 2,
          source_draft_content_version: 1, // Same draft version
          approved_by_actor_id: actorId,
          content_snapshot: {},
          findings_checked_snapshot: [],
          implications_reviewed_snapshot: [],
          evidence_snapshot: { cited_constructs: [] },
        } as CreationAttributes<DeskResearchReadoutApproval>)
      ).rejects.toThrow(/unique|duplicate|validation error/i);
    });

    it('allows different source_draft_content_version', async () => {
      const readout = await createReadout();

      await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: {},
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      const approval2 = await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 2,
        source_draft_content_version: 2, // Different draft version
        approved_by_actor_id: actorId,
        content_snapshot: {},
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      expect((approval2 as any).approval_number).toBe(2);
    });
  });

  describe('Approval Snapshot Immutability', () => {
    it('blocks UPDATE on approval records', async () => {
      const readout = await createReadout();
      const approval = await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: { original: true },
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      await expect(
        sequelize.query(
          'UPDATE desk_research_readout_approvals SET content_snapshot = $1 WHERE id = $2',
          { bind: [JSON.stringify({ modified: true }), (approval as any).id] }
        )
      ).rejects.toThrow(/immutable|cannot.*update/i);
    });

    it('blocks direct DELETE on approval records', async () => {
      const readout = await createReadout();
      const approval = await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: {},
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      await expect(
        sequelize.query(
          'DELETE FROM desk_research_readout_approvals WHERE id = $1',
          { bind: [(approval as any).id] }
        )
      ).rejects.toThrow(/cannot.*delete|immutable/i);
    });
  });

  describe('Completed Generation Snapshot Immutability', () => {
    it('allows transition from generating to completed', async () => {
      const readout = await createReadout();
      const version = await VersionModel.create({
        readout_id: (readout as any).id,
        version_number: 1,
        generation_request_id: '550e8400-e29b-41d4-a716-446655440000',
        generation_status: 'generating',
        draft_content_version_at_start: 1,
        evidence_set: [],
      } as CreationAttributes<DeskResearchReadoutVersion>);

      // Transition to completed with content
      await sequelize.query(
        `UPDATE desk_research_readout_versions
         SET generation_status = 'completed', content = $1
         WHERE id = $2`,
        { bind: [JSON.stringify({ generated: true }), (version as any).id] }
      );

      await (version as any).reload();
      expect((version as any).generation_status).toBe('completed');
      expect((version as any).content).toEqual({ generated: true });
    });

    it('blocks content modification after completed', async () => {
      const readout = await createReadout();

      // Create completed version directly
      const version = await VersionModel.create({
        readout_id: (readout as any).id,
        version_number: 1,
        generation_request_id: '550e8400-e29b-41d4-a716-446655440001',
        generation_status: 'generating',
        draft_content_version_at_start: 1,
        evidence_set: [],
      } as CreationAttributes<DeskResearchReadoutVersion>);

      // Complete it
      await sequelize.query(
        `UPDATE desk_research_readout_versions
         SET generation_status = 'completed', content = $1
         WHERE id = $2`,
        { bind: [JSON.stringify({ original: true }), (version as any).id] }
      );

      // Try to modify content - should fail
      await expect(
        sequelize.query(
          `UPDATE desk_research_readout_versions
           SET content = $1
           WHERE id = $2`,
          { bind: [JSON.stringify({ modified: true }), (version as any).id] }
        )
      ).rejects.toThrow(/cannot.*modify.*completed/i);
    });

    it('blocks status regression from completed', async () => {
      const readout = await createReadout();
      const version = await VersionModel.create({
        readout_id: (readout as any).id,
        version_number: 1,
        generation_request_id: '550e8400-e29b-41d4-a716-446655440002',
        generation_status: 'generating',
        draft_content_version_at_start: 1,
        evidence_set: [],
      } as CreationAttributes<DeskResearchReadoutVersion>);

      // Complete it
      await sequelize.query(
        `UPDATE desk_research_readout_versions
         SET generation_status = 'completed', content = $1
         WHERE id = $2`,
        { bind: [JSON.stringify({}), (version as any).id] }
      );

      // Try to change status back - should fail
      await expect(
        sequelize.query(
          `UPDATE desk_research_readout_versions
           SET generation_status = 'generating'
           WHERE id = $1`,
          { bind: [(version as any).id] }
        )
      ).rejects.toThrow(/cannot.*change.*status.*completed/i);
    });
  });

  describe('Project/Study Consistency Enforcement', () => {
    it('rejects readout with mismatched project_id', async () => {
      // Try to create readout with different project than study's project
      await expect(
        createReadout({
          study_id: studyId,
          project_id: project2Id, // Wrong project
        })
      ).rejects.toThrow(/project_id.*must match/i);
    });

    it('accepts readout with matching project_id', async () => {
      const readout = await createReadout({
        study_id: studyId,
        project_id: projectId,
      });

      expect((readout as any).project_id).toBe(projectId);
    });

    it('rejects UPDATE that changes project_id to mismatched project', async () => {
      // Create valid readout
      const readout = await createReadout({
        study_id: studyId,
        project_id: projectId,
      });

      // Try to UPDATE project_id to a different project (not study's project)
      await expect(
        sequelize.query(
          'UPDATE desk_research_readouts SET project_id = $1 WHERE id = $2',
          { bind: [project2Id, (readout as any).id] }
        )
      ).rejects.toThrow(/project_id.*must match/i);
    });
  });

  describe('Owner-Authorized Study Deletion and CASCADE', () => {
    it('cascades delete from study to all readout tables', async () => {
      const readout = await createReadout();
      const readoutId = (readout as any).id;

      // Create draft
      await createDraft(readoutId);

      // Create version
      await VersionModel.create({
        readout_id: readoutId,
        version_number: 1,
        generation_request_id: '550e8400-e29b-41d4-a716-446655440003',
        generation_status: 'completed',
        draft_content_version_at_start: 1,
        evidence_set: [],
        content: {},
      } as CreationAttributes<DeskResearchReadoutVersion>);

      // Create approval
      await ApprovalModel.create({
        readout_id: readoutId,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: {},
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      // Verify all exist
      expect(await ReadoutModel.count({ where: { id: readoutId } })).toBe(1);
      expect(await DraftModel.count({ where: { readout_id: readoutId } })).toBe(1);
      expect(await VersionModel.count({ where: { readout_id: readoutId } })).toBe(1);
      expect(await ApprovalModel.count({ where: { readout_id: readoutId } })).toBe(1);

      // Delete study (CASCADE should remove all)
      await ResearchStudyModel.destroy({ where: { id: studyId } });

      // Verify all deleted
      expect(await ReadoutModel.count({ where: { id: readoutId } })).toBe(0);
      expect(await DraftModel.count({ where: { readout_id: readoutId } })).toBe(0);
      expect(await VersionModel.count({ where: { readout_id: readoutId } })).toBe(0);
      expect(await ApprovalModel.count({ where: { readout_id: readoutId } })).toBe(0);
    });

    it('allows approval deletion via study cascade', async () => {
      const readout = await createReadout();

      await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: {},
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      // Delete study - should succeed (CASCADE)
      await expect(
        ResearchStudyModel.destroy({ where: { id: studyId } })
      ).resolves.toBeDefined();

      // Verify approval is gone
      expect(await ApprovalModel.count()).toBe(0);
    });
  });

  describe('Transaction Rollback Preserving Records', () => {
    it('rolls back readout creation on constraint failure', async () => {
      const transaction = await sequelize.transaction();

      try {
        // Create valid readout
        const readout = await ReadoutModel.create({
          study_id: studyId,
          project_id: projectId,
          display_id: 'RO-0001',
          display_sequence: 1,
          title: 'Valid Readout',
          created_by_actor_id: actorId,
        } as CreationAttributes<DeskResearchReadout>, { transaction });

        // Try to create invalid approval (will fail)
        await ApprovalModel.create({
          readout_id: (readout as any).id,
          approval_number: 0, // Invalid: must be >= 1
          source_draft_content_version: 1,
          approved_by_actor_id: actorId,
          content_snapshot: {},
          findings_checked_snapshot: [],
          implications_reviewed_snapshot: [],
          evidence_snapshot: { cited_constructs: [] },
        } as CreationAttributes<DeskResearchReadoutApproval>, { transaction });

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
      }

      // Verify readout was rolled back
      expect(await ReadoutModel.count()).toBe(0);
    });
  });

  describe('Out-of-Date Reason Consistency', () => {
    it('enforces staleness fields consistency', async () => {
      const readout = await createReadout();

      // Both NULL is valid (not stale)
      await (readout as any).update({
        out_of_date_since: null,
        out_of_date_reason: null,
      });

      // Both set is valid (stale)
      await (readout as any).update({
        out_of_date_since: new Date(),
        out_of_date_reason: 'cited_insight_withdrawn',
      });

      // One set, one null is invalid
      await expect(
        sequelize.query(
          `UPDATE desk_research_readouts
           SET out_of_date_since = NOW(), out_of_date_reason = NULL
           WHERE id = $1`,
          { bind: [(readout as any).id] }
        )
      ).rejects.toThrow(/staleness_consistency|check/i);
    });

    it('only allows valid out_of_date_reason values', async () => {
      const readout = await createReadout();

      await expect(
        sequelize.query(
          `UPDATE desk_research_readouts
           SET out_of_date_since = NOW(), out_of_date_reason = 'invalid_reason'
           WHERE id = $1`,
          { bind: [(readout as any).id] }
        )
      ).rejects.toThrow(/out_of_date_reason|check/i);
    });
  });

  describe('Generation Status Domain', () => {
    it('only allows valid generation_status values', async () => {
      const readout = await createReadout();

      await expect(
        VersionModel.create({
          readout_id: (readout as any).id,
          version_number: 1,
          generation_request_id: '550e8400-e29b-41d4-a716-446655440004',
          generation_status: 'invalid_status' as any,
          draft_content_version_at_start: 1,
          evidence_set: [],
        } as CreationAttributes<DeskResearchReadoutVersion>)
      ).rejects.toThrow();
    });

    it('requires content for completed status', async () => {
      const readout = await createReadout();
      const version = await VersionModel.create({
        readout_id: (readout as any).id,
        version_number: 1,
        generation_request_id: '550e8400-e29b-41d4-a716-446655440005',
        generation_status: 'generating',
        draft_content_version_at_start: 1,
        evidence_set: [],
      } as CreationAttributes<DeskResearchReadoutVersion>);

      // Try to mark completed without content
      await expect(
        sequelize.query(
          `UPDATE desk_research_readout_versions
           SET generation_status = 'completed'
           WHERE id = $1`,
          { bind: [(version as any).id] }
        )
      ).rejects.toThrow(/completed.*content|check/i);
    });

    it('requires error for failed status', async () => {
      const readout = await createReadout();
      const version = await VersionModel.create({
        readout_id: (readout as any).id,
        version_number: 1,
        generation_request_id: '550e8400-e29b-41d4-a716-446655440006',
        generation_status: 'generating',
        draft_content_version_at_start: 1,
        evidence_set: [],
      } as CreationAttributes<DeskResearchReadoutVersion>);

      // Try to mark failed without error
      await expect(
        sequelize.query(
          `UPDATE desk_research_readout_versions
           SET generation_status = 'failed'
           WHERE id = $1`,
          { bind: [(version as any).id] }
        )
      ).rejects.toThrow(/failed.*error|check/i);
    });
  });

  describe('One Draft Per Readout', () => {
    it('enforces unique constraint on readout_id', async () => {
      const readout = await createReadout();

      await createDraft((readout as any).id);

      // Second draft should fail
      await expect(
        createDraft((readout as any).id)
      ).rejects.toThrow(/unique|duplicate|validation error/i);
    });
  });

  describe('Approval Number Uniqueness', () => {
    it('enforces unique approval_number per readout', async () => {
      const readout = await createReadout();

      await ApprovalModel.create({
        readout_id: (readout as any).id,
        approval_number: 1,
        source_draft_content_version: 1,
        approved_by_actor_id: actorId,
        content_snapshot: {},
        findings_checked_snapshot: [],
        implications_reviewed_snapshot: [],
        evidence_snapshot: { cited_constructs: [] },
      } as CreationAttributes<DeskResearchReadoutApproval>);

      // Same approval_number should fail
      await expect(
        ApprovalModel.create({
          readout_id: (readout as any).id,
          approval_number: 1, // Duplicate
          source_draft_content_version: 2,
          approved_by_actor_id: actorId,
          content_snapshot: {},
          findings_checked_snapshot: [],
          implications_reviewed_snapshot: [],
          evidence_snapshot: { cited_constructs: [] },
        } as CreationAttributes<DeskResearchReadoutApproval>)
      ).rejects.toThrow(/unique|duplicate|validation error/i);
    });
  });

  describe('Version Request ID Uniqueness', () => {
    it('enforces unique generation_request_id', async () => {
      const readout = await createReadout();
      const requestId = '550e8400-e29b-41d4-a716-446655440007';

      await VersionModel.create({
        readout_id: (readout as any).id,
        version_number: 1,
        generation_request_id: requestId,
        generation_status: 'pending',
        draft_content_version_at_start: 1,
        evidence_set: [],
      } as CreationAttributes<DeskResearchReadoutVersion>);

      // Same request ID should fail
      await expect(
        VersionModel.create({
          readout_id: (readout as any).id,
          version_number: 2,
          generation_request_id: requestId, // Duplicate
          generation_status: 'pending',
          draft_content_version_at_start: 1,
          evidence_set: [],
        } as CreationAttributes<DeskResearchReadoutVersion>)
      ).rejects.toThrow(/unique|duplicate|validation error/i);
    });
  });
});
