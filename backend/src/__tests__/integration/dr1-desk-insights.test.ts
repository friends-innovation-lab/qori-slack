/**
 * DR-1 Desk Research Insights Integration Tests
 *
 * Tests against real Postgres per SPEC-2 design authority:
 * - Manual sourced insight creation
 * - Project isolation and cross-project evidence denial
 * - Researcher self-acceptance (D2)
 * - Save separate from acceptance (D3)
 * - Immutable revisions and review history
 * - Edit accepted insight while accepted stays eligible
 * - Reject proposed revision while accepted stays eligible
 * - Accept newer revision advances accepted pointer
 * - Concurrent edits/reviews produce deterministic 409
 * - Withdrawal reason required (D6)
 * - Withdrawal removes future eligibility
 * - Source fallback limitation validation
 * - Unsupported precise citations rejected
 * - Source removal blocked when actively cited (D9)
 * - Concurrent display-ID allocation
 * - Existing non-Desk EvidenceConstruct behavior
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { EvidenceSource } from '../../database/models/evidence_source';
import * as deskInsightService from '../../services/desk-insight.service';

const sequelize = getTestDb();

const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const EvidenceSourceModel = sequelize.models.EvidenceSource;
const EvidenceConstructModel = sequelize.models.EvidenceConstruct;

let projectId: number;
let project2Id: number;
let actorId: string;
let sourceId: number;
let source2Id: number;
let crossProjectSourceId: number;

async function setupFixtures() {
  // Project 1
  const project = await ProjectModel.create({
    name: 'DR-1 Test Project',
    slug: 'dr1-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as any).id;

  // Project 2 (for cross-project tests)
  const project2 = await ProjectModel.create({
    name: 'DR-1 Test Project 2',
    slug: 'dr1-test-2',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  project2Id = (project2 as any).id;

  // Actor
  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    status: 'active',
  });
  actorId = `actor:${(actor as any).public_id}`;

  // Evidence sources for project 1
  const source = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document 1',
    created_by: 'U_TEST',
  } as CreationAttributes<EvidenceSource>);
  sourceId = (source as any).id;

  const source2 = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document 2',
    created_by: 'U_TEST',
  } as CreationAttributes<EvidenceSource>);
  source2Id = (source2 as any).id;

  // Evidence source for project 2 (cross-project test)
  const crossProjectSource = await EvidenceSourceModel.create({
    project_id: project2Id,
    source_type: 'uploaded_document',
    label: 'Cross Project Document',
    created_by: 'U_TEST',
  } as CreationAttributes<EvidenceSource>);
  crossProjectSourceId = (crossProjectSource as any).id;
}

function makeEvidenceRef(sourceId: number, sourcePublicId = 'test-uuid', options: Partial<{
  page: string;
  section: string;
  excerpt: string;
  sourceLevel: boolean;
  validation: 'verified' | 'source_attributed_unverified';
  capturedContentHash: string;
}> = {}) {
  return {
    evidenceSourceId: sourceId,
    evidenceSourcePublicId: sourcePublicId,
    locator: {
      page: options.page,
      section: options.section,
      excerpt: options.excerpt,
      sourceLevel: options.sourceLevel,
    },
    validation: options.validation || 'source_attributed_unverified',
    capturedContentHash: options.capturedContentHash,
    sourceLabel: 'Test Document',
  };
}

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync();
});

beforeEach(async () => {
  await truncateAll();
  await setupFixtures();
});

afterAll(async () => {
  await sequelize.close();
});

describe('DR-1 Desk Research Insights', () => {
  describe('Manual Insight Creation', () => {
    it('creates insight with evidence reference', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight wording',
        evidenceReferences: [makeEvidenceRef(sourceId, 'uuid-1', { page: '12' })],
        createdBy: actorId,
      });

      expect(insight.id).toBeDefined();
      expect(insight.publicId).toBeDefined();
      expect(insight.displayId).toBe('IN-0001');
      expect(insight.wording).toBe('Test insight wording');
      expect(insight.status).toBe('proposed');
      expect(insight.latestRevisionNumber).toBe(1);
      expect(insight.acceptedRevisionNumber).toBeNull();
      expect(insight.needsReview).toBe(true);
    });

    it('allocates sequential display IDs', async () => {
      const insight1 = await deskInsightService.createInsight({
        projectId,
        wording: 'First insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const insight2 = await deskInsightService.createInsight({
        projectId,
        wording: 'Second insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      expect(insight1.displayId).toBe('IN-0001');
      expect(insight2.displayId).toBe('IN-0002');
    });

    it('requires wording', async () => {
      await expect(
        deskInsightService.createInsight({
          projectId,
          wording: '',
          evidenceReferences: [makeEvidenceRef(sourceId)],
          createdBy: actorId,
        }),
      ).rejects.toThrow(deskInsightService.ValidationError);
    });

    it('requires at least one evidence reference', async () => {
      await expect(
        deskInsightService.createInsight({
          projectId,
          wording: 'Test insight',
          evidenceReferences: [],
          createdBy: actorId,
        }),
      ).rejects.toThrow(deskInsightService.ValidationError);
    });
  });

  describe('Project Isolation', () => {
    it('rejects cross-project evidence reference', async () => {
      await expect(
        deskInsightService.createInsight({
          projectId,
          wording: 'Test insight',
          evidenceReferences: [makeEvidenceRef(crossProjectSourceId)],
          createdBy: actorId,
        }),
      ).rejects.toThrow(deskInsightService.ProjectAccessError);
    });

    it('isolates display ID sequences per project', async () => {
      // Create insight in project 1
      const insight1 = await deskInsightService.createInsight({
        projectId,
        wording: 'Project 1 insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Create source for project 2
      const source = await EvidenceSourceModel.create({
        project_id: project2Id,
        source_type: 'uploaded_document',
        label: 'Project 2 Document',
        created_by: 'U_TEST',
      } as CreationAttributes<EvidenceSource>);

      // Create insight in project 2
      const insight2 = await deskInsightService.createInsight({
        projectId: project2Id,
        wording: 'Project 2 insight',
        evidenceReferences: [makeEvidenceRef((source as any).id)],
        createdBy: actorId,
      });

      // Both should start at IN-0001
      expect(insight1.displayId).toBe('IN-0001');
      expect(insight2.displayId).toBe('IN-0001');
    });
  });

  describe('Revision Lifecycle (D3: Save separate from Accept)', () => {
    it('creates new revision without accepting', async () => {
      // Create initial insight
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Original wording',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Edit creates new revision
      const edited = await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'Edited wording',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
        expectedVersion: insight.version,
      });

      expect(edited.latestRevisionNumber).toBe(2);
      expect(edited.acceptedRevisionNumber).toBeNull(); // Not accepted
      expect(edited.status).toBe('proposed');
      expect(edited.wording).toBe('Edited wording');
    });

    it('preserves revision history', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Original',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'Revision 2',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
        expectedVersion: 1,
      });

      const history = await deskInsightService.getRevisionHistory(insight.id);
      expect(history).toHaveLength(2);
      expect(history[0].revisionNumber).toBe(2); // Newest first
      expect(history[1].revisionNumber).toBe(1);
    });
  });

  describe('Review Actions (D2: Self-accept)', () => {
    it('accepts revision with evidence', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId, 'uuid-1', { page: '5' })],
        createdBy: actorId,
      });

      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId, // Same actor (self-accept per D2)
        expectedVersion: insight.version,
      });

      expect(accepted.status).toBe('accepted');
      expect(accepted.acceptedRevisionNumber).toBe(1);
      expect(accepted.needsReview).toBe(false);
    });

    it('rejects revision without deleting it', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const rejected = await deskInsightService.rejectRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        comment: 'Not accurate',
        expectedVersion: insight.version,
      });

      expect(rejected.status).toBe('rejected');

      // Revision still exists in history
      const history = await deskInsightService.getRevisionHistory(insight.id);
      expect(history).toHaveLength(1);
    });

    it('preserves accepted revision when newer is rejected', async () => {
      // Create and accept
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Original',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Create new revision
      const edited = await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'New wording',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
        expectedVersion: accepted.version,
      });

      // Reject the new revision
      const afterReject = await deskInsightService.rejectRevision({
        constructId: insight.id,
        revisionId: edited.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: edited.version,
      });

      // Accepted revision is still r1
      expect(afterReject.acceptedRevisionNumber).toBe(1);
      expect(afterReject.status).toBe('accepted'); // Still accepted overall
    });

    it('advances accepted pointer when accepting newer revision', async () => {
      // Create and accept r1
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Original',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const r1Accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Create r2
      const r2 = await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'Better wording',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
        expectedVersion: r1Accepted.version,
      });

      // Accept r2
      const r2Accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: r2.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: r2.version,
      });

      expect(r2Accepted.acceptedRevisionNumber).toBe(2);
      expect(r2Accepted.status).toBe('accepted');
    });
  });

  describe('Withdrawal (D6: Reason required)', () => {
    it('requires reason for withdrawal', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Accept first
      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Try to withdraw without reason
      await expect(
        deskInsightService.withdrawInsight({
          constructId: insight.id,
                    reviewedBy: actorId,
          comment: '', // Empty reason
          expectedVersion: accepted.version,
        }),
      ).rejects.toThrow('Withdrawal reason is required');
    });

    it('withdraws with valid reason', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      const withdrawn = await deskInsightService.withdrawInsight({
        constructId: insight.id,
                reviewedBy: actorId,
        comment: 'No longer valid based on new findings',
        expectedVersion: accepted.version,
      });

      expect(withdrawn.status).toBe('withdrawn');
      expect(withdrawn.withdrawnAt).not.toBeNull();
    });

    it('cannot withdraw never-accepted insight', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      await expect(
        deskInsightService.withdrawInsight({
          constructId: insight.id,
                    reviewedBy: actorId,
          comment: 'Reason',
          expectedVersion: insight.version,
        }),
      ).rejects.toThrow('Cannot withdraw insight that was never accepted');
    });

    it('excludes withdrawn insight from synthesis eligibility', async () => {
      // Create and accept insight
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Verify it's synthesis-eligible
      let eligible = await deskInsightService.getSynthesisEligibleInsights(projectId);
      expect(eligible).toHaveLength(1);

      // Withdraw
      await deskInsightService.withdrawInsight({
        constructId: insight.id,
                reviewedBy: actorId,
        comment: 'Superseded by newer findings',
        expectedVersion: accepted.version,
      });

      // Verify no longer synthesis-eligible
      eligible = await deskInsightService.getSynthesisEligibleInsights(projectId);
      expect(eligible).toHaveLength(0);
    });
  });

  describe('Concurrency Control', () => {
    it('rejects stale version on revision create', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Original',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // First edit succeeds
      await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'Edit 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
        expectedVersion: 1,
      });

      // Second edit with stale version fails
      await expect(
        deskInsightService.createRevision({
          constructId: insight.id,
          wording: 'Edit 2 (stale)',
          evidenceReferences: [makeEvidenceRef(sourceId)],
          createdBy: actorId,
          expectedVersion: 1, // Stale!
        }),
      ).rejects.toThrow(deskInsightService.ConcurrencyError);
    });

    it('rejects stale version on accept', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Original',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Edit changes version
      const edited = await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'Edited',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
        expectedVersion: 1,
      });

      // Accept with stale version fails
      await expect(
        deskInsightService.acceptRevision({
          constructId: insight.id,
          revisionId: insight.latestRevision.id,
          reviewedBy: actorId,
          expectedVersion: 1, // Stale!
        }),
      ).rejects.toThrow(deskInsightService.ConcurrencyError);
    });
  });

  describe('Evidence Locator Validation', () => {
    it('rejects source-level with specific locators', async () => {
      await expect(
        deskInsightService.createInsight({
          projectId,
          wording: 'Test insight',
          evidenceReferences: [
            makeEvidenceRef(sourceId, 'uuid', {
              sourceLevel: true,
              page: '5', // Invalid: can't have both
            }),
          ],
          createdBy: actorId,
        }),
      ).rejects.toThrow('Source-level reference cannot have page, section, or excerpt');
    });

    it('rejects verified excerpt without hash', async () => {
      await expect(
        deskInsightService.createInsight({
          projectId,
          wording: 'Test insight',
          evidenceReferences: [
            makeEvidenceRef(sourceId, 'uuid', {
              excerpt: 'Some quoted text',
              validation: 'verified',
              // Missing capturedContentHash
            }),
          ],
          createdBy: actorId,
        }),
      ).rejects.toThrow('Verified excerpt must include capturedContentHash');
    });

    it('accepts source-level fallback', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [
          makeEvidenceRef(sourceId, 'uuid', {
            sourceLevel: true,
          }),
        ],
        createdBy: actorId,
      });

      expect(insight.latestRevision.evidenceSnapshot[0].locator.sourceLevel).toBe(true);
    });
  });

  describe('Source Protection (D9)', () => {
    it('reports source as cited by accepted revision', async () => {
      // Create and accept insight citing source
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Check source protection
      const isCited = await deskInsightService.isSourceCitedByAcceptedRevision(sourceId);
      expect(isCited).toBe(true);

      // Uncited source
      const isCited2 = await deskInsightService.isSourceCitedByAcceptedRevision(source2Id);
      expect(isCited2).toBe(false);
    });

    it('does not protect source after withdrawal', async () => {
      // Create and accept insight
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Verify protected
      expect(await deskInsightService.isSourceCitedByAcceptedRevision(sourceId)).toBe(true);

      // Withdraw
      await deskInsightService.withdrawInsight({
        constructId: insight.id,
                reviewedBy: actorId,
        comment: 'No longer valid',
        expectedVersion: accepted.version,
      });

      // No longer protected
      expect(await deskInsightService.isSourceCitedByAcceptedRevision(sourceId)).toBe(false);
    });
  });

  describe('Listing and Counts', () => {
    it('counts insights needing review', async () => {
      // Create proposed insight
      await deskInsightService.createInsight({
        projectId,
        wording: 'Proposed 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Create and accept another
      const insight2 = await deskInsightService.createInsight({
        projectId,
        wording: 'Will be accepted',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      await deskInsightService.acceptRevision({
        constructId: insight2.id,
        revisionId: insight2.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight2.version,
      });

      const count = await deskInsightService.countInsightsNeedingReview(projectId);
      expect(count).toBe(1); // Only the proposed one
    });

    it('lists insights by status filter', async () => {
      // Create proposed
      await deskInsightService.createInsight({
        projectId,
        wording: 'Proposed',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Create and accept
      const toAccept = await deskInsightService.createInsight({
        projectId,
        wording: 'Accepted',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      await deskInsightService.acceptRevision({
        constructId: toAccept.id,
        revisionId: toAccept.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: toAccept.version,
      });

      const { insights: proposed } = await deskInsightService.listInsights(projectId, { status: 'proposed' });
      expect(proposed).toHaveLength(1);
      expect(proposed[0].wording).toBe('Proposed');

      const { insights: accepted } = await deskInsightService.listInsights(projectId, { status: 'accepted' });
      expect(accepted).toHaveLength(1);
      expect(accepted[0].wording).toBe('Accepted');
    });
  });

  describe('Backward Compatibility', () => {
    it('does not affect non-desk_insight constructs', async () => {
      // Create a regular construct (not desk_insight)
      const construct = await EvidenceConstructModel.create({
        project_id: projectId,
        construct_type: 'knowledge_gap',
        label: 'Regular knowledge gap',
        derivation_type: 'model',
        status: 'candidate',
        created_by: 'U_TEST',
      });

      // Regular construct should not have revision tracking fields populated
      expect((construct as any).display_sequence).toBeNull();
      expect((construct as any).latest_revision_id).toBeNull();
      expect((construct as any).accepted_revision_id).toBeNull();

      // Desk insight service should not find it
      const insight = await deskInsightService.getInsightById((construct as any).id);
      expect(insight).toBeNull();
    });
  });

  describe('Review History', () => {
    it('records immutable review history', async () => {
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Test insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Accept
      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Create and reject new revision
      const edited = await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'Bad edit',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
        expectedVersion: accepted.version,
      });

      await deskInsightService.rejectRevision({
        constructId: insight.id,
        revisionId: edited.latestRevision.id,
        reviewedBy: actorId,
        comment: 'Not accurate',
        expectedVersion: edited.version,
      });

      // Check review history
      const history = await deskInsightService.getReviewHistory(insight.id);
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('reject'); // Most recent first
      expect(history[1].action).toBe('accept');
    });
  });
});
