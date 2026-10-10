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
import {
  hasProjectRoleByActor,
  assertProjectResearcherByActor,
  AuthorizationError,
} from '../../services/authorization.service';

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
  // Do NOT call sync() - it removes database DEFAULTs set by migrations
  // (e.g., gen_random_uuid() becomes null, breaking raw SQL INSERTs)
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

    // DR-4a: sourceId filter
    it('filters insights by evidence source ID', async () => {
      // Create insight citing source 1
      await deskInsightService.createInsight({
        projectId,
        wording: 'Insight citing source 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Create insight citing source 2
      await deskInsightService.createInsight({
        projectId,
        wording: 'Insight citing source 2',
        evidenceReferences: [makeEvidenceRef(source2Id)],
        createdBy: actorId,
      });

      // Create insight citing both sources
      await deskInsightService.createInsight({
        projectId,
        wording: 'Insight citing both sources',
        evidenceReferences: [
          makeEvidenceRef(sourceId),
          makeEvidenceRef(source2Id),
        ],
        createdBy: actorId,
      });

      // Filter by source 1 - should find 2 insights
      const { insights: source1Insights } = await deskInsightService.listInsights(
        projectId,
        { sourceId },
      );
      expect(source1Insights).toHaveLength(2);
      expect(source1Insights.map(i => i.wording).sort()).toEqual([
        'Insight citing both sources',
        'Insight citing source 1',
      ]);

      // Filter by source 2 - should find 2 insights
      const { insights: source2Insights } = await deskInsightService.listInsights(
        projectId,
        { sourceId: source2Id },
      );
      expect(source2Insights).toHaveLength(2);
      expect(source2Insights.map(i => i.wording).sort()).toEqual([
        'Insight citing both sources',
        'Insight citing source 2',
      ]);
    });

    it('returns empty list when no insights cite the source', async () => {
      // Create insight citing source 1
      await deskInsightService.createInsight({
        projectId,
        wording: 'Insight citing source 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Filter by source 2 (unused) - should find 0 insights
      const { insights, total } = await deskInsightService.listInsights(
        projectId,
        { sourceId: source2Id },
      );
      expect(insights).toHaveLength(0);
      expect(total).toBe(0);
    });

    it('combines sourceId filter with status filter', async () => {
      // Create proposed insight citing source 1
      await deskInsightService.createInsight({
        projectId,
        wording: 'Proposed citing source 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Create accepted insight citing source 1
      const toAccept = await deskInsightService.createInsight({
        projectId,
        wording: 'Accepted citing source 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });
      await deskInsightService.acceptRevision({
        constructId: toAccept.id,
        revisionId: toAccept.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: toAccept.version,
      });

      // Create proposed insight citing source 2
      await deskInsightService.createInsight({
        projectId,
        wording: 'Proposed citing source 2',
        evidenceReferences: [makeEvidenceRef(source2Id)],
        createdBy: actorId,
      });

      // Filter by source 1 + proposed - should find 1
      const { insights: proposed1 } = await deskInsightService.listInsights(
        projectId,
        { sourceId, status: 'proposed' },
      );
      expect(proposed1).toHaveLength(1);
      expect(proposed1[0].wording).toBe('Proposed citing source 1');

      // Filter by source 1 + accepted - should find 1
      const { insights: accepted1 } = await deskInsightService.listInsights(
        projectId,
        { sourceId, status: 'accepted' },
      );
      expect(accepted1).toHaveLength(1);
      expect(accepted1[0].wording).toBe('Accepted citing source 1');
    });

    it('filters by latest revision when accepted insight has pending revision with different source', async () => {
      // Create and accept insight citing source 1
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'Originally citing source 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });
      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });

      // Create pending revision citing source 2 (different from accepted)
      await deskInsightService.createRevision({
        constructId: insight.id,
        wording: 'Pending citing source 2',
        evidenceReferences: [makeEvidenceRef(source2Id)],
        createdBy: actorId,
        expectedVersion: accepted.version,
      });

      // Filter by source 1 - should NOT match (latest revision cites source 2)
      const { insights: source1Insights } = await deskInsightService.listInsights(
        projectId,
        { sourceId },
      );
      expect(source1Insights).toHaveLength(0);

      // Filter by source 2 - SHOULD match (latest revision cites source 2)
      const { insights: source2Insights } = await deskInsightService.listInsights(
        projectId,
        { sourceId: source2Id },
      );
      expect(source2Insights).toHaveLength(1);
      expect(source2Insights[0].wording).toBe('Pending citing source 2');
    });

    it('excludes withdrawn insights from non-withdrawn status filters', async () => {
      // Create, accept, and withdraw insight citing source 1
      const insight = await deskInsightService.createInsight({
        projectId,
        wording: 'To be withdrawn',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });
      const accepted = await deskInsightService.acceptRevision({
        constructId: insight.id,
        revisionId: insight.latestRevision.id,
        reviewedBy: actorId,
        expectedVersion: insight.version,
      });
      await deskInsightService.withdrawInsight({
        constructId: insight.id,
        reviewedBy: actorId,
        comment: 'No longer relevant',
        expectedVersion: accepted.version,
      });

      // Filter by source 1 with status='all' - includes withdrawn
      const { insights: all } = await deskInsightService.listInsights(
        projectId,
        { sourceId, status: 'all' },
      );
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe('withdrawn');

      // Filter by source 1 with status='accepted' - excludes withdrawn
      const { insights: acceptedOnly } = await deskInsightService.listInsights(
        projectId,
        { sourceId, status: 'accepted' },
      );
      expect(acceptedOnly).toHaveLength(0);

      // Filter by source 1 with status='withdrawn' - should find it
      const { insights: withdrawn } = await deskInsightService.listInsights(
        projectId,
        { sourceId, status: 'withdrawn' },
      );
      expect(withdrawn).toHaveLength(1);
    });

    it('ignores cross-project source IDs', async () => {
      // Create insight citing source in this project
      await deskInsightService.createInsight({
        projectId,
        wording: 'Valid insight',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      // Filter by cross-project source - should return empty
      const { insights } = await deskInsightService.listInsights(
        projectId,
        { sourceId: crossProjectSourceId },
      );
      expect(insights).toHaveLength(0);
    });

    it('does not return duplicates when multiple insights cite same source', async () => {
      // Create two insights both citing source 1
      await deskInsightService.createInsight({
        projectId,
        wording: 'First insight citing source 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });
      await deskInsightService.createInsight({
        projectId,
        wording: 'Second insight citing source 1',
        evidenceReferences: [makeEvidenceRef(sourceId)],
        createdBy: actorId,
      });

      const { insights, total } = await deskInsightService.listInsights(
        projectId,
        { sourceId },
      );
      // Should return exactly 2 insights, no duplicates
      expect(insights).toHaveLength(2);
      expect(total).toBe(2);
      expect(insights.map(i => i.wording).sort()).toEqual([
        'First insight citing source 1',
        'Second insight citing source 1',
      ]);
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

  describe('D2 Role Authorization', () => {
    const ProjectMembership = sequelize.models.ProjectMembership;

    let researcherActorId: number;
    let adminActorId: number;
    let ownerActorId: number;
    let nonMemberActorId: number;

    beforeEach(async () => {
      // Create actors with different roles
      const researcher = await ActorModel.create({
        organization_id: TEST_ORG_ID,
        display_name: 'Researcher Actor',
        status: 'active',
      });
      researcherActorId = (researcher as any).id;

      const admin = await ActorModel.create({
        organization_id: TEST_ORG_ID,
        display_name: 'Admin Actor',
        status: 'active',
      });
      adminActorId = (admin as any).id;

      const owner = await ActorModel.create({
        organization_id: TEST_ORG_ID,
        display_name: 'Owner Actor',
        status: 'active',
      });
      ownerActorId = (owner as any).id;

      const nonMember = await ActorModel.create({
        organization_id: TEST_ORG_ID,
        display_name: 'Non-Member Actor',
        status: 'active',
      });
      nonMemberActorId = (nonMember as any).id;

      // Create memberships
      await ProjectMembership.create({
        project_id: projectId,
        actor_id: researcherActorId,
        role: 'researcher',
      });

      await ProjectMembership.create({
        project_id: projectId,
        actor_id: adminActorId,
        role: 'admin',
      });

      await ProjectMembership.create({
        project_id: projectId,
        actor_id: ownerActorId,
        role: 'owner',
      });
      // nonMemberActorId intentionally NOT added to project
    });

    it('researcher has researcher role', async () => {
      const hasRole = await hasProjectRoleByActor(researcherActorId, projectId, 'researcher');
      expect(hasRole).toBe(true);
    });

    it('admin has researcher role (hierarchy)', async () => {
      const hasRole = await hasProjectRoleByActor(adminActorId, projectId, 'researcher');
      expect(hasRole).toBe(true);
    });

    it('owner has researcher role (hierarchy)', async () => {
      const hasRole = await hasProjectRoleByActor(ownerActorId, projectId, 'researcher');
      expect(hasRole).toBe(true);
    });

    it('non-member denied researcher role', async () => {
      const hasRole = await hasProjectRoleByActor(nonMemberActorId, projectId, 'researcher');
      expect(hasRole).toBe(false);
    });

    it('assertProjectResearcherByActor allows researcher', async () => {
      await expect(
        assertProjectResearcherByActor(researcherActorId, projectId, TEST_ORG_ID),
      ).resolves.toBeUndefined();
    });

    it('assertProjectResearcherByActor allows admin', async () => {
      await expect(
        assertProjectResearcherByActor(adminActorId, projectId, TEST_ORG_ID),
      ).resolves.toBeUndefined();
    });

    it('assertProjectResearcherByActor allows owner', async () => {
      await expect(
        assertProjectResearcherByActor(ownerActorId, projectId, TEST_ORG_ID),
      ).resolves.toBeUndefined();
    });

    it('assertProjectResearcherByActor denies non-member', async () => {
      await expect(
        assertProjectResearcherByActor(nonMemberActorId, projectId, TEST_ORG_ID),
      ).rejects.toThrow(AuthorizationError);
    });

    it('assertProjectResearcherByActor denies cross-project', async () => {
      // Researcher is member of project1, not project2
      await expect(
        assertProjectResearcherByActor(researcherActorId, project2Id, TEST_ORG_ID),
      ).rejects.toThrow(AuthorizationError);
    });

    it('assertProjectResearcherByActor denies wrong organization', async () => {
      const wrongOrgId = TEST_ORG_ID + 999;
      await expect(
        assertProjectResearcherByActor(researcherActorId, projectId, wrongOrgId),
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
