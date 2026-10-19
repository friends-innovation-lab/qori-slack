/**
 * DR-6b-2 Desk Research Readout Service Integration Tests
 *
 * Tests against real Postgres for:
 * - Readout creation with safe identifier allocation
 * - Concurrent display sequence allocation
 * - Cross-project citation rejection
 * - Insight-to-revision ownership validation
 * - Accepted vs pending/rejected/withdrawn revision handling
 * - Concurrent draft save conflicts
 * - Review state invalidation (finding → implication cascade)
 * - Pre-checked/pre-reviewed new content rejection
 * - Approval eligibility validation
 * - Duplicate approval prevention
 * - Immutable approval snapshots
 * - Generation completion after concurrent human edit
 * - Study deletion cascade
 * - Transaction rollback
 *
 * LIMITATION (documented):
 * Approval DELETE immutability is NOT enforced at the database level.
 * The service does not expose approval deletion operations.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import * as readoutService from '../../services/desk-readout.service';
import { AuthorizationError } from '../../services/authorization.service';
import type { DraftContent } from '../../database/models/desk_research_readout_draft';

const sequelize = getTestDb();

const ProjectModel = sequelize.models.Project;
const ResearchStudyModel = sequelize.models.ResearchStudy;
const ActorModel = sequelize.models.Actor;
const ProjectMembershipModel = sequelize.models.ProjectMembership;
const EvidenceSourceModel = sequelize.models.EvidenceSource;
const EvidenceConstructModel = sequelize.models.EvidenceConstruct;
const EvidenceConstructRevisionModel = sequelize.models.EvidenceConstructRevision;
const DeskResearchReadoutModel = sequelize.models.DeskResearchReadout;
const DeskResearchReadoutDraftModel = sequelize.models.DeskResearchReadoutDraft;
const DeskResearchReadoutApprovalModel = sequelize.models.DeskResearchReadoutApproval;

// Test fixtures
let projectId: number;
let project2Id: number;
let studyId: number;
let study2Id: number;
let actorId: number;
let actor2Id: number;

// Evidence fixtures
let insightId: number;
let insightPublicId: string;
let insightDisplayId: string;
let revisionId: number;
let revisionPublicId: string;
let insight2Id: number;
let insight2PublicId: string;
let revision2Id: number;
let revision2PublicId: string;

// Cross-project insight
let otherProjectInsightPublicId: string;
let otherProjectRevisionPublicId: string;

beforeAll(async () => {
  await sequelize.authenticate();
  // Do NOT call sequelize.sync() — rely on migrations only.
  // sync() modifies schema based on model definitions, removing database-level
  // defaults (e.g., gen_random_uuid()) and replacing them with JavaScript-only
  // defaults that raw SQL queries cannot use.
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await truncateAll();

  // Create test projects
  const project = await ProjectModel.create({
    organization_id: TEST_ORG_ID,
    name: 'Test Project',
    slug: 'test-project',
    created_by: 'test-user',
    status: 'active',
  } as any);
  projectId = (project as any).id;

  const project2 = await ProjectModel.create({
    organization_id: TEST_ORG_ID,
    name: 'Other Project',
    slug: 'other-project',
    created_by: 'test-user',
    status: 'active',
  } as any);
  project2Id = (project2 as any).id;

  // Create test studies
  const study = await ResearchStudyModel.create({
    project_id: projectId,
    name: 'Test Study',
    methodology: 'desk_research',
    created_by: 'test-user',
    channel_name: 'test-study',
    researcher_name: 'Test Researcher',
    researcher_email: 'test@example.com',
  } as any);
  studyId = (study as any).id;

  const study2 = await ResearchStudyModel.create({
    project_id: projectId,
    name: 'Second Study',
    methodology: 'desk_research',
    created_by: 'test-user',
    channel_name: 'second-study',
    researcher_name: 'Test Researcher 2',
    researcher_email: 'test2@example.com',
  } as any);
  study2Id = (study2 as any).id;

  // Create test actors
  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    actor_type: 'human',
  } as any);
  actorId = (actor as any).id;

  const actor2 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Other Researcher',
    actor_type: 'human',
  } as any);
  actor2Id = (actor2 as any).id;

  // Create project memberships (required for authorization)
  await ProjectMembershipModel.create({
    project_id: projectId,
    actor_id: actorId,
    role: 'researcher',
  } as any);

  await ProjectMembershipModel.create({
    project_id: projectId,
    actor_id: actor2Id,
    role: 'researcher',
  } as any);

  // Create evidence source
  const source = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document',
    created_by: 'test-user',
  } as any);

  // Create accepted insight (construct + revision)
  const insight = await EvidenceConstructModel.create({
    project_id: projectId,
    construct_type: 'desk_insight',
    display_sequence: 1,
    status: 'accepted',
    created_by: 'test-user',
  } as any);
  insightId = (insight as any).id;
  insightPublicId = (insight as any).public_id;
  // display_id is computed from display_sequence: IN-0001
  insightDisplayId = `IN-${((insight as any).display_sequence as number).toString().padStart(4, '0')}`;

  const revision = await EvidenceConstructRevisionModel.create({
    construct_id: insightId,
    revision_number: 1,
    content: { wording: 'Test insight wording' },
    evidence_snapshot: [{ evidenceSourceId: (source as any).id, locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  } as any);
  revisionId = (revision as any).id;
  revisionPublicId = (revision as any).public_id;

  // Mark revision as accepted
  await (insight as any).update({
    accepted_revision_id: revisionId,
    latest_revision_id: revisionId,
  });

  // Create second accepted insight
  const insight2 = await EvidenceConstructModel.create({
    project_id: projectId,
    construct_type: 'desk_insight',
    display_sequence: 2,
    status: 'accepted',
    created_by: 'test-user',
  } as any);
  insight2Id = (insight2 as any).id;
  insight2PublicId = (insight2 as any).public_id;

  const revision2 = await EvidenceConstructRevisionModel.create({
    construct_id: insight2Id,
    revision_number: 1,
    content: { wording: 'Second insight wording' },
    evidence_snapshot: [{ evidenceSourceId: (source as any).id, locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  } as any);
  revision2Id = (revision2 as any).id;
  revision2PublicId = (revision2 as any).public_id;

  await (insight2 as any).update({
    accepted_revision_id: revision2Id,
    latest_revision_id: revision2Id,
  });

  // Create cross-project insight for rejection tests
  const otherSource = await EvidenceSourceModel.create({
    project_id: project2Id,
    source_type: 'uploaded_document',
    label: 'Other Project Document',
    created_by: 'test-user',
  } as any);

  const otherInsight = await EvidenceConstructModel.create({
    project_id: project2Id,
    construct_type: 'desk_insight',
    display_sequence: 1,
    status: 'accepted',
    created_by: 'test-user',
  } as any);
  otherProjectInsightPublicId = (otherInsight as any).public_id;

  const otherRevision = await EvidenceConstructRevisionModel.create({
    construct_id: (otherInsight as any).id,
    revision_number: 1,
    content: { wording: 'Other project insight' },
    evidence_snapshot: [{ evidenceSourceId: (otherSource as any).id, locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  } as any);
  otherProjectRevisionPublicId = (otherRevision as any).public_id;

  await (otherInsight as any).update({
    accepted_revision_id: (otherRevision as any).id,
    latest_revision_id: (otherRevision as any).id,
  });
});

// ─── Readout Creation ─────────────────────────────────────────────────────────

describe('Readout Creation', () => {
  it('creates readout with study-scoped display ID', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'First Readout',
      createdByActorId: actorId,
    });

    expect(readout.displayId).toBe('RO-0001');
    expect(readout.studyId).toBe(studyId);
    expect(readout.projectId).toBe(projectId);
    expect(readout.draft.contentVersion).toBe(1);
    expect(readout.draft.content).toEqual({});
  });

  it('allocates sequential display IDs within study', async () => {
    const r1 = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'First',
      createdByActorId: actorId,
    });

    const r2 = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Second',
      createdByActorId: actorId,
    });

    expect(r1.displayId).toBe('RO-0001');
    expect(r2.displayId).toBe('RO-0002');
  });

  it('allows same display sequence in different studies', async () => {
    const r1 = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Study 1 Readout',
      createdByActorId: actorId,
    });

    const r2 = await readoutService.createReadout({
      studyId: study2Id,
      projectId,
      title: 'Study 2 Readout',
      createdByActorId: actorId,
    });

    expect(r1.displayId).toBe('RO-0001');
    expect(r2.displayId).toBe('RO-0001');
  });

  it('rejects readout with mismatched project (authorization)', async () => {
    // Authorization now correctly rejects access before business logic check
    // actorId has membership in projectId, not project2Id
    await expect(
      readoutService.createReadout({
        studyId,
        projectId: project2Id, // Wrong project - actor doesn't have access
        title: 'Invalid',
        createdByActorId: actorId,
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it('rejects readout with empty title', async () => {
    await expect(
      readoutService.createReadout({
        studyId,
        projectId,
        title: '   ',
        createdByActorId: actorId,
      })
    ).rejects.toThrow(/title is required/i);
  });

  it('rejects readout with non-existent study', async () => {
    await expect(
      readoutService.createReadout({
        studyId: 99999,
        projectId,
        title: 'Invalid',
        createdByActorId: actorId,
      })
    ).rejects.toThrow(/study not found/i);
  });
});

describe('Concurrent Display ID Allocation', () => {
  it('prevents duplicate allocation under concurrent requests', async () => {
    // Simulate concurrent allocation by using Promise.all
    const promises = Array.from({ length: 5 }, (_, i) =>
      readoutService.createReadout({
        studyId,
        projectId,
        title: `Concurrent Readout ${i + 1}`,
        createdByActorId: actorId,
      })
    );

    const results = await Promise.all(promises);
    const displayIds = results.map((r) => r.displayId);

    // All should be unique
    const unique = new Set(displayIds);
    expect(unique.size).toBe(5);

    // Should be sequential
    expect(displayIds.sort()).toEqual([
      'RO-0001',
      'RO-0002',
      'RO-0003',
      'RO-0004',
      'RO-0005',
    ]);
  });
});

// ─── Draft Saving ─────────────────────────────────────────────────────────────

describe('Draft Saving with Optimistic Concurrency', () => {
  it('saves draft with version increment', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const content: DraftContent = {
      findings: [
        {
          id: 'f1',
          text: 'Finding 1',
          citations: [
            {
              constructPublicId: insightPublicId,
              revisionPublicId,
              revisionNumber: 1,
              displayId: insightDisplayId,
            },
          ],
        },
      ],
    };

    const result = await readoutService.saveDraft({
      readoutId: readout.id,
      content,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    expect(result.success).toBe(true);
    expect(result.draft?.contentVersion).toBe(2);
    expect(result.draft?.content.findings).toHaveLength(1);
  });

  it('returns conflict on version mismatch', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Save first update
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: { summary: { text: 'First save' } },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Try to save with stale version
    const result = await readoutService.saveDraft({
      readoutId: readout.id,
      content: { summary: { text: 'Stale save' } },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1, // Stale
      editedByActorId: actor2Id,
    });

    expect(result.success).toBe(false);
    expect(result.conflict?.currentVersion).toBe(2);
    expect(result.conflict?.submittedContent.summary?.text).toBe('Stale save');
  });

  it('preserves submitted content on conflict for resolution', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    await readoutService.saveDraft({
      readoutId: readout.id,
      content: { summary: { text: 'Winner' } },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    const submittedContent: DraftContent = {
      summary: { text: 'Loser content that should be preserved' },
      findings: [{ id: 'f1', text: 'Lost finding', citations: [] }],
    };

    const result = await readoutService.saveDraft({
      readoutId: readout.id,
      content: submittedContent,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actor2Id,
    });

    expect(result.success).toBe(false);
    expect(result.conflict?.submittedContent).toEqual(submittedContent);
  });
});

describe('Review State Invalidation', () => {
  it('invalidates finding Checked state when text changes', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Step 1: Save with finding (NOT checked yet)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Original text', citations: [] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Step 2: Mark finding as checked (no content change)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Original text', citations: [] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: [],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Step 3: Modify finding text - should invalidate checked state
    const result = await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Changed text', citations: [] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: [],
      expectedVersion: 3,
      editedByActorId: actorId,
    });

    expect(result.invalidatedFindings).toContain('f1');
    expect(result.draft?.findingsChecked).not.toContain('f1');
  });

  it('invalidates finding Checked state when citations change', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Step 1: Save with finding (NOT checked yet)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Same text',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Step 2: Mark finding as checked
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Same text',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: [],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Step 3: Add another citation - should invalidate checked state
    const result = await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Same text',
          citations: [
            { constructPublicId: insightPublicId, revisionPublicId, revisionNumber: 1, displayId: insightDisplayId },
            { constructPublicId: insight2PublicId, revisionPublicId: revision2PublicId, revisionNumber: 1, displayId: 'IN-0002' },
          ],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: [],
      expectedVersion: 3,
      editedByActorId: actorId,
    });

    expect(result.invalidatedFindings).toContain('f1');
  });

  it('cascades invalidation from finding to linked implication', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Step 1: Save content (NOT checked/reviewed yet)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Finding', citations: [] }],
        implications: [{ id: 'i1', kind: 'question', text: 'Question', basedOnFindings: ['f1'] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Step 2: Mark finding and implication as reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Finding', citations: [] }],
        implications: [{ id: 'i1', kind: 'question', text: 'Question', basedOnFindings: ['f1'] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Step 3: Change finding text - should cascade to implication
    const result = await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Changed finding', citations: [] }],
        implications: [{ id: 'i1', kind: 'question', text: 'Question', basedOnFindings: ['f1'] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 3,
      editedByActorId: actorId,
    });

    expect(result.invalidatedFindings).toContain('f1');
    expect(result.invalidatedImplications).toContain('i1');
    expect(result.draft?.findingsChecked).not.toContain('f1');
    expect(result.draft?.implicationsReviewed).not.toContain('i1');
  });

  it('rejects new finding arriving pre-checked', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    await expect(
      readoutService.saveDraft({
        readoutId: readout.id,
        content: {
          findings: [{ id: 'new-finding', text: 'New', citations: [] }],
        },
        findingsChecked: ['new-finding'], // Pre-checked!
        implicationsReviewed: [],
        expectedVersion: 1,
        editedByActorId: actorId,
      })
    ).rejects.toThrow(/cannot arrive already marked as Checked/i);
  });

  it('rejects new implication arriving pre-reviewed', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // First save findings
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Finding', citations: [] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Try to add pre-reviewed implication
    await expect(
      readoutService.saveDraft({
        readoutId: readout.id,
        content: {
          findings: [{ id: 'f1', text: 'Finding', citations: [] }],
          implications: [{ id: 'new-impl', kind: 'gap', text: 'New gap', basedOnFindings: ['f1'] }],
        },
        findingsChecked: [],
        implicationsReviewed: ['new-impl'], // Pre-reviewed!
        expectedVersion: 2,
        editedByActorId: actorId,
      })
    ).rejects.toThrow(/cannot arrive already marked as Reviewed/i);
  });

  it('rejects dangling finding reference in implication', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    await expect(
      readoutService.saveDraft({
        readoutId: readout.id,
        content: {
          findings: [{ id: 'f1', text: 'Finding', citations: [] }],
          implications: [{
            id: 'i1',
            kind: 'question',
            text: 'Question',
            basedOnFindings: ['f1', 'nonexistent'], // Dangling reference
          }],
        },
        findingsChecked: [],
        implicationsReviewed: [],
        expectedVersion: 1,
        editedByActorId: actorId,
      })
    ).rejects.toThrow(/references non-existent finding/i);
  });
});

// ─── Citation Validation ──────────────────────────────────────────────────────

describe('Citation Validation', () => {
  it('validates accepted revision citations', async () => {
    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(true);
    expect(result.validCitations).toHaveLength(1);
    expect(result.validCitations[0].isSuperseded).toBe(false);
  });

  it('rejects cross-project citations', async () => {
    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: otherProjectInsightPublicId,
          revisionPublicId: otherProjectRevisionPublicId,
          revisionNumber: 1,
          displayId: 'IN-0001',
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toMatch(/different project/i);
  });

  it('rejects non-existent insight citations', async () => {
    // Use valid UUIDs that don't exist in the database
    const fakeInsightUuid = '00000000-0000-0000-0000-000000000001';
    const fakeRevisionUuid = '00000000-0000-0000-0000-000000000002';

    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: fakeInsightUuid,
          revisionPublicId: fakeRevisionUuid,
          revisionNumber: 1,
          displayId: 'IN-9999',
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toMatch(/not found/i);
  });

  it('rejects withdrawn insight citations', async () => {
    // Withdraw the insight
    await EvidenceConstructModel.update(
      { withdrawn_at: new Date() },
      { where: { id: insightId } }
    );

    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toMatch(/withdrawn/i);
  });

  it('rejects pending (non-accepted) revision citations', async () => {
    // Create a pending revision
    const pendingRevision = await EvidenceConstructRevisionModel.create({
      construct_id: insightId,
      revision_number: 2,
      content: { wording: 'Pending revision' },
      evidence_snapshot: [],
      origin: 'researcher',
      created_by: 'test-user',
    } as any);

    // Update construct to have latest != accepted
    await EvidenceConstructModel.update(
      { latest_revision_id: (pendingRevision as any).id },
      { where: { id: insightId } }
    );

    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId: (pendingRevision as any).public_id,
          revisionNumber: 2,
          displayId: insightDisplayId,
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toMatch(/not accepted/i);
  });

  it('flags superseded revision citations', async () => {
    // Create a new accepted revision (supersedes old)
    const newRevision = await EvidenceConstructRevisionModel.create({
      construct_id: insightId,
      revision_number: 2,
      content: { wording: 'New accepted revision' },
      evidence_snapshot: [],
      origin: 'researcher',
      created_by: 'test-user',
    } as any);

    // Update construct to new accepted revision
    await EvidenceConstructModel.update(
      {
        accepted_revision_id: (newRevision as any).id,
        latest_revision_id: (newRevision as any).id,
      },
      { where: { id: insightId } }
    );

    // Cite the OLD revision
    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId, // Old revision
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(true); // Superseded is valid but flagged
    expect(result.validCitations[0].isSuperseded).toBe(true);
  });

  it('rejects mismatched revision number', async () => {
    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 999, // Wrong number
          displayId: insightDisplayId,
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toMatch(/number mismatch/i);
  });

  it('rejects revision that belongs to different construct', async () => {
    const content: DraftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId: revision2PublicId, // Belongs to insight2!
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
    };

    const result = await readoutService.validateCitations(projectId, content);

    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toMatch(/does not belong to this insight/i);
  });
});

// ─── Approval ─────────────────────────────────────────────────────────────────

describe('Approval Eligibility', () => {
  it('requires at least one finding', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const eligibility = await readoutService.checkApprovalEligibility(readout.id, actorId);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.errors).toContain('At least one finding is required');
  });

  it('requires each finding to have citations', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Step 1: Save finding without citations (not checked)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Finding without citation', citations: [] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Step 2: Mark finding as checked
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{ id: 'f1', text: 'Finding without citation', citations: [] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: [],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    const eligibility = await readoutService.checkApprovalEligibility(readout.id, actorId);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.errors.some((e) => e.includes('must have at least one citation'))).toBe(true);
  });

  it('requires all findings to be checked', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
      },
      findingsChecked: [], // Not checked!
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    const eligibility = await readoutService.checkApprovalEligibility(readout.id, actorId);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.errors.some((e) => e.includes('Findings not checked'))).toBe(true);
  });

  it('requires all implications to be reviewed', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Step 1: Save content (not checked/reviewed)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{ id: 'i1', kind: 'question', text: 'Question', basedOnFindings: ['f1'] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Step 2: Mark finding as checked but NOT implication as reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{ id: 'i1', kind: 'question', text: 'Question', basedOnFindings: ['f1'] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: [], // Not reviewed!
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    const eligibility = await readoutService.checkApprovalEligibility(readout.id, actorId);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.errors.some((e) => e.includes('Implications not reviewed'))).toBe(true);
  });

  it('requires implications to link to existing findings', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Manually insert invalid state (bypassing service validation)
    await DeskResearchReadoutDraftModel.update(
      {
        content: {
          findings: [{ id: 'f1', text: 'Finding', citations: [{ constructPublicId: insightPublicId, revisionPublicId, revisionNumber: 1, displayId: insightDisplayId }] }],
          implications: [{ id: 'i1', kind: 'question', text: 'Q', basedOnFindings: [] }], // No linked findings!
        },
        findings_checked: ['f1'],
        implications_reviewed: ['i1'],
        content_version: 2,
      },
      { where: { readout_id: readout.id } }
    );

    const eligibility = await readoutService.checkApprovalEligibility(readout.id, actorId);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.errors.some((e) => e.includes('must link to at least one finding'))).toBe(true);
  });

  it('returns empty supersededCitations when no revisions are superseded', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const draftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
      implications: [{ id: 'i1', kind: 'question' as const, text: 'Q', basedOnFindings: ['f1'] }],
    };

    // First save: create content
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Second save: mark as checked/reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    const eligibility = await readoutService.checkApprovalEligibility(readout.id, actorId);

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.supersededCitations).toEqual([]);
  });

  it('returns revision-specific supersession metadata when citations are superseded', async () => {
    // Create a new accepted revision (supersedes old)
    const newRevision = await EvidenceConstructRevisionModel.create({
      construct_id: insightId,
      revision_number: 2,
      content: { wording: 'New accepted revision' },
      evidence_snapshot: [],
      origin: 'researcher',
      created_by: 'test-user',
    } as any);

    await EvidenceConstructModel.update(
      {
        accepted_revision_id: (newRevision as any).id,
        latest_revision_id: (newRevision as any).id,
      },
      { where: { id: insightId } }
    );

    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const draftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding citing superseded revision',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId, // Old revision
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
      implications: [{ id: 'i1', kind: 'question' as const, text: 'Q', basedOnFindings: ['f1'] }],
    };

    // Cite the OLD (superseded) revision - first save: create content
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Second save: mark as checked/reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    const eligibility = await readoutService.checkApprovalEligibility(readout.id, actorId);

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.supersededCitations).toHaveLength(1);
    expect(eligibility.supersededCitations[0]).toEqual({
      constructPublicId: insightPublicId,
      revisionPublicId,
      revisionNumber: 1,
      displayId: insightDisplayId,
    });

    // Clean up: restore original accepted revision for other tests
    await EvidenceConstructModel.update(
      {
        accepted_revision_id: revisionId,
        latest_revision_id: revisionId,
      },
      { where: { id: insightId } }
    );
    // Attempt to destroy newRevision, but ignore errors (may be referenced by approvals)
    try {
      await newRevision.destroy();
    } catch {
      // Ignore - revision may be referenced by approvals
    }
  });
});

describe('Supersession Note Enforcement', () => {
  let supersededRevisionPublicId: string;
  let newRevision: any;

  beforeEach(async () => {
    // Create a new accepted revision (supersedes original)
    newRevision = await EvidenceConstructRevisionModel.create({
      construct_id: insightId,
      revision_number: 2,
      content: { wording: 'New accepted revision' },
      evidence_snapshot: [],
      origin: 'researcher',
      created_by: 'test-user',
    } as any);

    await EvidenceConstructModel.update(
      {
        accepted_revision_id: (newRevision as any).id,
        latest_revision_id: (newRevision as any).id,
      },
      { where: { id: insightId } }
    );

    supersededRevisionPublicId = revisionPublicId; // Old revision is now superseded
  });

  afterEach(async () => {
    // Restore original accepted revision
    await EvidenceConstructModel.update(
      {
        accepted_revision_id: revisionId,
        latest_revision_id: revisionId,
      },
      { where: { id: insightId } }
    );
    // Attempt to destroy newRevision, but ignore errors (may be referenced by approvals)
    if (newRevision) {
      try {
        await newRevision.destroy();
      } catch {
        // Ignore - revision may be referenced by approvals created during test
      }
    }
  });

  async function createSupersededReadout() {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Superseded Citation Test',
      createdByActorId: actorId,
    });

    const draftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding citing superseded revision',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId: supersededRevisionPublicId,
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
      implications: [{ id: 'i1', kind: 'question' as const, text: 'Q', basedOnFindings: ['f1'] }],
    };

    // First save: create content
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Second save: mark as checked/reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    return readout;
  }

  it('rejects approval when supersession note is missing', async () => {
    const readout = await createSupersededReadout();

    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 3,
        approvedByActorId: actorId,
        // No supersessionNotes provided
      })
    ).rejects.toThrow(/supersession notes required/i);
  });

  it('rejects approval when supersession note is whitespace-only', async () => {
    const readout = await createSupersededReadout();

    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 3,
        approvedByActorId: actorId,
        supersessionNotes: {
          [supersededRevisionPublicId]: '   \t\n  ', // Whitespace only
        },
      })
    ).rejects.toThrow(/supersession notes required/i);
  });

  it('rejects approval when note is keyed to wrong revision', async () => {
    const readout = await createSupersededReadout();

    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 3,
        approvedByActorId: actorId,
        supersessionNotes: {
          'wrong-revision-id': 'This note is for a different revision',
        },
      })
    ).rejects.toThrow(/supersession notes required/i);
  });

  it('accepts approval with valid supersession note and persists in snapshot', async () => {
    const readout = await createSupersededReadout();

    const approval = await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
      supersessionNotes: {
        [supersededRevisionPublicId]: 'Using older revision intentionally because it addresses our specific scope',
      },
    });

    expect(approval.approvalNumber).toBe(1);
    expect(approval.supersessionNotes).toEqual({
      [supersededRevisionPublicId]: 'Using older revision intentionally because it addresses our specific scope',
    });
  });

  it('trims supersession notes before persisting', async () => {
    const readout = await createSupersededReadout();

    const approval = await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
      supersessionNotes: {
        [supersededRevisionPublicId]: '  Padded note with spaces  ',
      },
    });

    expect(approval.supersessionNotes).toEqual({
      [supersededRevisionPublicId]: 'Padded note with spaces',
    });
  });

  it('requires separate notes for multiple superseded revisions', async () => {
    // Create second insight with superseded revision (use high sequence to avoid conflicts)
    const insight2 = await EvidenceConstructModel.create({
      project_id: projectId,
      construct_type: 'desk_insight',
      display_sequence: 1000,
      created_by: 'test-user',
    } as any);
    const insight2PublicId = (insight2 as any).public_id;

    const revision2 = await EvidenceConstructRevisionModel.create({
      construct_id: (insight2 as any).id,
      revision_number: 1,
      content: { wording: 'Second insight' },
      evidence_snapshot: [],
      origin: 'researcher',
      created_by: 'test-user',
    } as any);
    const revision2PublicId = (revision2 as any).public_id;

    // Accept revision 2
    await EvidenceConstructModel.update(
      {
        accepted_revision_id: (revision2 as any).id,
        latest_revision_id: (revision2 as any).id,
      },
      { where: { id: (insight2 as any).id } }
    );

    // Create revision 3 and make it accepted (supersedes revision 2)
    const revision3 = await EvidenceConstructRevisionModel.create({
      construct_id: (insight2 as any).id,
      revision_number: 2,
      content: { wording: 'Second insight - updated' },
      evidence_snapshot: [],
      origin: 'researcher',
      created_by: 'test-user',
    } as any);

    await EvidenceConstructModel.update(
      {
        accepted_revision_id: (revision3 as any).id,
        latest_revision_id: (revision3 as any).id,
      },
      { where: { id: (insight2 as any).id } }
    );

    // Create readout citing both superseded revisions
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Multiple Superseded Test',
      createdByActorId: actorId,
    });

    const draftContent = {
      findings: [
        {
          id: 'f1',
          text: 'Finding 1',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId: supersededRevisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        },
        {
          id: 'f2',
          text: 'Finding 2',
          citations: [{
            constructPublicId: insight2PublicId,
            revisionPublicId: revision2PublicId,
            revisionNumber: 1,
            displayId: 'IN-0002',
          }],
        },
      ],
      implications: [{ id: 'i1', kind: 'question' as const, text: 'Q', basedOnFindings: ['f1', 'f2'] }],
    };

    // First save: create content
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Second save: mark as checked/reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: ['f1', 'f2'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Should fail with only one note
    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 3,
        approvedByActorId: actorId,
        supersessionNotes: {
          [supersededRevisionPublicId]: 'Note for first',
          // Missing note for revision2PublicId
        },
      })
    ).rejects.toThrow(/supersession notes required/i);

    // Should succeed with both notes
    const approval = await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
      supersessionNotes: {
        [supersededRevisionPublicId]: 'Note for first',
        [revision2PublicId]: 'Note for second',
      },
    });

    expect(approval.supersessionNotes).toEqual({
      [supersededRevisionPublicId]: 'Note for first',
      [revision2PublicId]: 'Note for second',
    });

    // Cleanup
    await insight2.destroy();
  });

  it('still returns 409 on version mismatch even with valid supersession notes', async () => {
    const readout = await createSupersededReadout();

    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 999, // Wrong version
        approvedByActorId: actorId,
        supersessionNotes: {
          [supersededRevisionPublicId]: 'Valid note',
        },
      })
    ).rejects.toThrow(/modified since approval was initiated/i);

    // Verify no approval was created
    const history = await readoutService.getApprovalHistory(readout.id, actorId);
    expect(history).toHaveLength(0);
  });

  it('withdrawn evidence remains ineligible regardless of supersession notes', async () => {
    // First restore the original revision as accepted (undo supersession from beforeEach)
    await EvidenceConstructModel.update(
      {
        accepted_revision_id: revisionId,
        latest_revision_id: revisionId,
      },
      { where: { id: insightId } }
    );

    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Withdrawn Evidence Test',
      createdByActorId: actorId,
    });

    const draftContent = {
      findings: [{
        id: 'f1',
        text: 'Finding citing withdrawn insight',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 1,
          displayId: insightDisplayId,
        }],
      }],
      implications: [{ id: 'i1', kind: 'question' as const, text: 'Q', basedOnFindings: ['f1'] }],
    };

    // First save: create content
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Second save: mark as checked/reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: draftContent,
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Withdraw the insight
    await EvidenceConstructModel.update(
      { withdrawn_at: new Date() },
      { where: { id: insightId } }
    );

    // Try to approve - should fail because insight is withdrawn, not because of supersession
    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 3,
        approvedByActorId: actorId,
        supersessionNotes: {
          [revisionPublicId]: 'This note should not matter',
        },
      })
    ).rejects.toThrow(/not eligible for approval|withdrawn/i);

    // Verify no approval was created
    const history = await readoutService.getApprovalHistory(readout.id, actorId);
    expect(history).toHaveLength(0);

    // Cleanup: un-withdraw the insight
    await EvidenceConstructModel.update(
      { withdrawn_at: null },
      { where: { id: insightId } }
    );
  });
});

describe('Approval Creation', () => {
  async function createApprovalReadyReadout() {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Approval Ready',
      createdByActorId: actorId,
    });

    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Valid finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question',
          text: 'Research question',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Mark as reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Valid finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question',
          text: 'Research question',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    return readout;
  }

  it('creates immutable approval snapshot', async () => {
    const readout = await createApprovalReadyReadout();

    const approval = await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
      approvalNote: 'Looks good',
    });

    expect(approval.approvalNumber).toBe(1);
    expect(approval.sourceDraftContentVersion).toBe(3);
    expect(approval.contentSnapshot.findings).toHaveLength(1);
    expect(approval.findingsCheckedSnapshot).toContain('f1');
    expect(approval.implicationsReviewedSnapshot).toContain('i1');
    expect(approval.evidenceSnapshot.cited_constructs).toHaveLength(1);
  });

  it('prevents duplicate approval of same draft version', async () => {
    const readout = await createApprovalReadyReadout();

    await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
    });

    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 3,
        approvedByActorId: actorId,
      })
    ).rejects.toThrow(/already been approved/i);
  });

  it('allows new approval after draft changes', async () => {
    const readout = await createApprovalReadyReadout();

    const approval1 = await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
    });

    // Step 1: Make changes (this invalidates checked state)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Updated finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question',
          text: 'Research question',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: ['f1'],  // Will be invalidated due to text change
      implicationsReviewed: ['i1'],
      expectedVersion: 3,
      editedByActorId: actorId,
    });

    // Step 2: Re-review after content change
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Updated finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question',
          text: 'Research question',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 4,
      editedByActorId: actorId,
    });

    // Step 3: Approve at new version
    const approval2 = await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 5,
      approvedByActorId: actorId,
    });

    expect(approval2.approvalNumber).toBe(2);
    expect(approval2.sourceDraftContentVersion).toBe(5);
  });

  it('rejects approval with stale version', async () => {
    const readout = await createApprovalReadyReadout();

    // Modify draft
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Changed',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question',
          text: 'Research question',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 3,
      editedByActorId: actorId,
    });

    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 3, // Stale
        approvedByActorId: actorId,
      })
    ).rejects.toThrow(/modified since approval was initiated/i);
  });

  it('blocks UPDATE on approval records (database-enforced)', async () => {
    const readout = await createApprovalReadyReadout();

    const approval = await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
    });

    await expect(
      sequelize.query(
        'UPDATE desk_research_readout_approvals SET content_snapshot = $1 WHERE id = $2',
        { bind: [JSON.stringify({ modified: true }), approval.id] }
      )
    ).rejects.toThrow(/immutable/i);
  });
});

// ─── Generation ───────────────────────────────────────────────────────────────

describe('Generation Workflow', () => {
  it('initiates generation with evidence set', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const result = await readoutService.initiateGeneration({
      readoutId: readout.id,
      evidenceSet: [{
        constructPublicId: insightPublicId,
        revisionPublicId,
        revisionNumber: 1,
        displayId: insightDisplayId,
      }],
      initiatedByActorId: actorId,
    });

    expect(result.generationRequestId).toBeDefined();
    expect(result.status).toBe('pending');
  });

  it('supersedes existing pending generation', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const gen1 = await readoutService.initiateGeneration({
      readoutId: readout.id,
      evidenceSet: [],
      initiatedByActorId: actorId,
    });

    const gen2 = await readoutService.initiateGeneration({
      readoutId: readout.id,
      evidenceSet: [],
      initiatedByActorId: actorId,
    });

    expect(gen1.generationRequestId).not.toBe(gen2.generationRequestId);

    // Check first is superseded
    const history = await readoutService.getGenerationHistory(readout.id, actorId);
    const gen1Record = history.find((h) => h.generationRequestId === gen1.generationRequestId);
    expect(gen1Record?.generationStatus).toBe('superseded');
  });

  it('preserves human edits when completing generation', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const gen = await readoutService.initiateGeneration({
      readoutId: readout.id,
      evidenceSet: [],
      initiatedByActorId: actorId,
    });

    // Human edits draft while generation is running
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: { summary: { text: 'Human edit' } },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Generation completes
    const result = await readoutService.completeGeneration({
      readoutId: readout.id,
      generationRequestId: gen.generationRequestId,
      content: { summary: { text: 'AI generated content' } },
      status: 'completed',
    });

    // Should detect conflict, not apply
    expect(result.applied).toBe(false);
    expect(result.conflictDetected).toBe(true);

    // Draft should retain human edit
    const updated = await readoutService.getReadoutById(readout.id, actorId);
    expect(updated?.draft.content.summary?.text).toBe('Human edit');

    // Generated content should be preserved in history
    const history = await readoutService.getGenerationHistory(readout.id, actorId);
    expect(history[0].hasContent).toBe(true);
  });

  it('applies generation when no human edits occurred', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const gen = await readoutService.initiateGeneration({
      readoutId: readout.id,
      evidenceSet: [],
      initiatedByActorId: actorId,
    });

    // No human edits - complete generation
    const result = await readoutService.completeGeneration({
      readoutId: readout.id,
      generationRequestId: gen.generationRequestId,
      content: {
        summary: { text: 'AI summary' },
        findings: [{ id: 'f1', text: 'AI finding', citations: [] }],
      },
      status: 'completed',
    });

    expect(result.applied).toBe(true);
    expect(result.conflictDetected).toBe(false);

    // Draft should have AI content
    const updated = await readoutService.getReadoutById(readout.id, actorId);
    expect(updated?.draft.content.summary?.text).toBe('AI summary');
    expect(updated?.draft.findingsChecked).toEqual([]); // Reset
    expect(updated?.draft.implicationsReviewed).toEqual([]); // Reset
  });

  it('handles generation failure gracefully', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const gen = await readoutService.initiateGeneration({
      readoutId: readout.id,
      evidenceSet: [],
      initiatedByActorId: actorId,
    });

    const result = await readoutService.completeGeneration({
      readoutId: readout.id,
      generationRequestId: gen.generationRequestId,
      content: {},
      status: 'failed',
      error: 'API timeout',
    });

    expect(result.applied).toBe(false);

    // Draft should be unchanged
    const updated = await readoutService.getReadoutById(readout.id, actorId);
    expect(updated?.draft.content).toEqual({});

    // Version should show failure
    const history = await readoutService.getGenerationHistory(readout.id, actorId);
    expect(history[0].generationStatus).toBe('failed');
    expect(history[0].generationError).toBe('API timeout');
  });
});

// ─── Staleness ────────────────────────────────────────────────────────────────

describe('Staleness Evaluation', () => {
  async function createApprovedReadout() {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Step 1: Save content (NOT checked yet)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question',
          text: 'Q',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Step 2: Mark as checked/reviewed
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question',
          text: 'Q',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Step 3: Approve
    await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
    });

    return readout;
  }

  it('detects staleness when cited insight is withdrawn', async () => {
    const readout = await createApprovedReadout();

    // Withdraw the cited insight
    await EvidenceConstructModel.update(
      { withdrawn_at: new Date() },
      { where: { id: insightId } }
    );

    const staleness = await readoutService.evaluateStaleness(readout.id, actorId);

    expect(staleness.isStale).toBe(true);
    expect(staleness.reason).toBe('cited_insight_withdrawn');
    expect(staleness.staleInsights).toContain(insightPublicId);
  });

  it('detects staleness when cited revision is superseded', async () => {
    const readout = await createApprovedReadout();

    // Create a new accepted revision
    const newRevision = await EvidenceConstructRevisionModel.create({
      construct_id: insightId,
      revision_number: 2,
      content: { wording: 'New version' },
      evidence_snapshot: [],
      origin: 'researcher',
      created_by: 'test-user',
    } as any);

    await EvidenceConstructModel.update(
      {
        accepted_revision_id: (newRevision as any).id,
        latest_revision_id: (newRevision as any).id,
      },
      { where: { id: insightId } }
    );

    const staleness = await readoutService.evaluateStaleness(readout.id, actorId);

    expect(staleness.isStale).toBe(true);
    expect(staleness.reason).toBe('newer_revision_accepted');
    expect(staleness.staleInsights).toContain(insightPublicId);
  });

  it('reports not stale when evidence unchanged', async () => {
    const readout = await createApprovedReadout();

    const staleness = await readoutService.evaluateStaleness(readout.id, actorId);

    expect(staleness.isStale).toBe(false);
    expect(staleness.reason).toBeNull();
    expect(staleness.staleInsights).toHaveLength(0);
  });
});

// ─── Cascade Deletion ─────────────────────────────────────────────────────────

describe('Study Deletion Cascade', () => {
  it('cascades delete from study to readouts', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    // Step 1: Save content (not checked)
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{ id: 'i1', kind: 'question', text: 'Q', basedOnFindings: ['f1'] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Step 2: Mark as checked
    await readoutService.saveDraft({
      readoutId: readout.id,
      content: {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId,
            revisionNumber: 1,
            displayId: insightDisplayId,
          }],
        }],
        implications: [{ id: 'i1', kind: 'question', text: 'Q', basedOnFindings: ['f1'] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Step 3: Approve
    await readoutService.approveReadout({
      readoutId: readout.id,
      expectedVersion: 3,
      approvedByActorId: actorId,
    });

    // Delete study
    await ResearchStudyModel.destroy({ where: { id: studyId } });

    // Verify cascade
    expect(await DeskResearchReadoutModel.count({ where: { id: readout.id } })).toBe(0);
    expect(await DeskResearchReadoutDraftModel.count({ where: { readout_id: readout.id } })).toBe(0);
    expect(await DeskResearchReadoutApprovalModel.count({ where: { readout_id: readout.id } })).toBe(0);
  });
});

// ─── Transaction Rollback ─────────────────────────────────────────────────────

describe('Transaction Rollback', () => {
  it('rolls back readout creation on failure', async () => {
    const countBefore = await DeskResearchReadoutModel.count();

    try {
      await sequelize.transaction(async (transaction) => {
        await DeskResearchReadoutModel.create(
          {
            study_id: studyId,
            project_id: projectId,
            display_id: 'RO-0001',
            display_sequence: 1,
            title: 'Will rollback',
            created_by_actor_id: actorId,
          } as any,
          { transaction }
        );

        throw new Error('Simulated failure');
      });
    } catch {
      // Expected
    }

    const countAfter = await DeskResearchReadoutModel.count();
    expect(countAfter).toBe(countBefore);
  });

  it('rolls back approval on eligibility failure', async () => {
    const readout = await readoutService.createReadout({
      studyId,
      projectId,
      title: 'Test',
      createdByActorId: actorId,
    });

    const approvalCountBefore = await DeskResearchReadoutApprovalModel.count();

    await expect(
      readoutService.approveReadout({
        readoutId: readout.id,
        expectedVersion: 1,
        approvedByActorId: actorId,
      })
    ).rejects.toThrow();

    const approvalCountAfter = await DeskResearchReadoutApprovalModel.count();
    expect(approvalCountAfter).toBe(approvalCountBefore);
  });
});

// ─── Authorization ────────────────────────────────────────────────────────────

describe('Authorization', () => {
  let unauthorizedActorId: number;
  let otherProjectActorId: number;

  beforeEach(async () => {
    // Create an actor with NO project membership
    const unauthorizedActor = await ActorModel.create({
      organization_id: TEST_ORG_ID,
      display_name: 'Unauthorized Actor',
      actor_type: 'human',
    } as any);
    unauthorizedActorId = (unauthorizedActor as any).id;

    // Create an actor with membership in project2 only (not the main project)
    const otherProjectActor = await ActorModel.create({
      organization_id: TEST_ORG_ID,
      display_name: 'Other Project Actor',
      actor_type: 'human',
    } as any);
    otherProjectActorId = (otherProjectActor as any).id;

    await ProjectMembershipModel.create({
      project_id: project2Id,
      actor_id: otherProjectActorId,
      role: 'researcher',
    } as any);
  });

  describe('createReadout', () => {
    it('allows authorized researcher to create readout', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Authorized creation',
        createdByActorId: actorId,
      });

      expect(readout.id).toBeDefined();
      expect(readout.title).toBe('Authorized creation');
    });

    it('rejects actor without project membership', async () => {
      await expect(
        readoutService.createReadout({
          studyId,
          projectId,
          title: 'Unauthorized',
          createdByActorId: unauthorizedActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects actor from different project', async () => {
      await expect(
        readoutService.createReadout({
          studyId,
          projectId,
          title: 'Cross-project',
          createdByActorId: otherProjectActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getReadoutById', () => {
    it('allows authorized member to read readout', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      const fetched = await readoutService.getReadoutById(readout.id, actorId);
      expect(fetched?.id).toBe(readout.id);
    });

    it('rejects actor without project membership', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.getReadoutById(readout.id, unauthorizedActorId)
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects actor from different project', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.getReadoutById(readout.id, otherProjectActorId)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('saveDraft', () => {
    it('allows authorized researcher to save draft', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      const result = await readoutService.saveDraft({
        readoutId: readout.id,
        content: { summary: { text: 'Test' } },
        findingsChecked: [],
        implicationsReviewed: [],
        expectedVersion: 1,
        editedByActorId: actorId,
      });

      expect(result.success).toBe(true);
    });

    it('rejects actor without project membership', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.saveDraft({
          readoutId: readout.id,
          content: { summary: { text: 'Unauthorized' } },
          findingsChecked: [],
          implicationsReviewed: [],
          expectedVersion: 1,
          editedByActorId: unauthorizedActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects actor from different project', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.saveDraft({
          readoutId: readout.id,
          content: { summary: { text: 'Cross-project' } },
          findingsChecked: [],
          implicationsReviewed: [],
          expectedVersion: 1,
          editedByActorId: otherProjectActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('approveReadout', () => {
    it('rejects approval from actor without project membership', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.approveReadout({
          readoutId: readout.id,
          expectedVersion: 1,
          approvedByActorId: unauthorizedActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects approval from actor in different project', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.approveReadout({
          readoutId: readout.id,
          expectedVersion: 1,
          approvedByActorId: otherProjectActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('initiateGeneration', () => {
    it('rejects generation from actor without project membership', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.initiateGeneration({
          readoutId: readout.id,
          evidenceSet: [],
          initiatedByActorId: unauthorizedActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects generation from actor in different project', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.initiateGeneration({
          readoutId: readout.id,
          evidenceSet: [],
          initiatedByActorId: otherProjectActorId,
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('listReadoutsByStudy', () => {
    it('rejects listing from actor without project membership', async () => {
      await expect(
        readoutService.listReadoutsByStudy(studyId, unauthorizedActorId)
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects listing from actor in different project', async () => {
      await expect(
        readoutService.listReadoutsByStudy(studyId, otherProjectActorId)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('evaluateStaleness', () => {
    it('rejects staleness check from actor without project membership', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.evaluateStaleness(readout.id, unauthorizedActorId)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getGenerationHistory', () => {
    it('rejects history access from actor without project membership', async () => {
      const readout = await readoutService.createReadout({
        studyId,
        projectId,
        title: 'Test',
        createdByActorId: actorId,
      });

      await expect(
        readoutService.getGenerationHistory(readout.id, unauthorizedActorId)
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
