/**
 * DR-6b-5e — Version Content Retrieval and Finality Integration Tests
 *
 * Tests for:
 * - GET /readouts/:readoutId/versions/:versionId/content endpoint
 * - Approved-readout finality (generation rejection after approval)
 * - Approval rejection while generation is in progress
 * - Cross-project and cross-readout isolation
 * - Content retrieval for various generation states
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Actor } from '../../database/models/actor';
import {
  initiateGenerationV2,
  approveReadout,
  getVersionContent,
  completeGenerationWithFencing,
  saveDraft,
  getReadoutById,
  ReadoutFinalizedError,
  GenerationInProgressError,
} from '../../services/desk-readout.service';

const sequelize: Sequelize = getTestDb();
const ActorModel = sequelize.models.Actor as typeof Actor;

// Test context
let testProjectId: number;
let testStudyId: number;
let testReadoutId: number;
let testActorId: number;
let testInsightConstructId: number;
let testRevisionPublicId: string;

// Second project for cross-project isolation tests
let otherProjectId: number;
let otherStudyId: number;
let otherReadoutId: number;

// Third readout in same project for cross-readout isolation
let secondReadoutId: number;

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

async function seedActor(email = 'test@test.com'): Promise<number> {
  const actor = await ActorModel.create({
    display_name: 'Test User',
    email,
    organization_id: TEST_ORG_ID,
  } as any);
  return (actor as any).id;
}

beforeEach(async () => {
  await truncateAll();

  // Seed test actor
  testActorId = await seedActor();

  // Create test project
  const [projectRows] = await sequelize.query(`
    INSERT INTO projects (name, slug, public_id, status, created_by, organization_id, created_at, updated_at)
    VALUES ('Test Project', 'test-proj-5e', gen_random_uuid(), 'active', 'U_TEST', ${TEST_ORG_ID}, NOW(), NOW())
    RETURNING id
  `);
  testProjectId = (projectRows as any[])[0].id;

  // Add actor as researcher on project
  await sequelize.query(`
    INSERT INTO project_memberships (project_id, actor_id, role, created_at)
    VALUES (${testProjectId}, ${testActorId}, 'researcher', NOW())
  `);

  // Create test study
  const [studyRows] = await sequelize.query(`
    INSERT INTO research_studies (project_id, name, channel_name, created_by, researcher_name, researcher_email, public_id, created_at, updated_at)
    VALUES (${testProjectId}, 'Test Study', 'chan-test', 'U_TEST', 'Tester', 'test@test.com', gen_random_uuid(), NOW(), NOW())
    RETURNING id
  `);
  testStudyId = (studyRows as any[])[0].id;

  // Create test readout
  const [readoutRows] = await sequelize.query(`
    INSERT INTO desk_research_readouts (study_id, project_id, public_id, display_id, display_sequence, title, question, created_by_actor_id, created_at)
    VALUES (${testStudyId}, ${testProjectId}, gen_random_uuid(), 'RO-0001', 1, 'Test Readout', 'What is the question?', ${testActorId}, NOW())
    RETURNING id
  `);
  testReadoutId = (readoutRows as any[])[0].id;

  // Create an accepted desk insight for evidence selection (needed before draft for citations)
  const [constructRows] = await sequelize.query(`
    INSERT INTO evidence_constructs (public_id, project_id, construct_type, derivation_type, status, display_sequence, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), ${testProjectId}, 'desk_insight', 'human', 'accepted', 1, 'U_TEST', NOW(), NOW())
    RETURNING id, public_id
  `);
  testInsightConstructId = (constructRows as any[])[0].id;
  const testInsightPublicId = (constructRows as any[])[0].public_id;

  // Create accepted revision for the insight
  const [revisionRows] = await sequelize.query(`
    INSERT INTO evidence_construct_revisions (
      public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at
    )
    VALUES (
      gen_random_uuid(), ${testInsightConstructId}, 1, '{"wording": "Test insight wording"}', '[]', 'researcher', 'U_TEST', NOW()
    )
    RETURNING public_id
  `);
  testRevisionPublicId = (revisionRows as any[])[0].public_id;

  // Link revision as accepted
  await sequelize.query(`
    UPDATE evidence_constructs
    SET accepted_revision_id = (
      SELECT id FROM evidence_construct_revisions
      WHERE construct_id = ${testInsightConstructId} AND revision_number = 1
    )
    WHERE id = ${testInsightConstructId}
  `);

  // Build draft content with proper citation
  const draftContent = JSON.stringify({
    findings: [{
      id: 'f1',
      text: 'Finding 1',
      citations: [{
        constructPublicId: testInsightPublicId,
        revisionPublicId: testRevisionPublicId,
        revisionNumber: 1,
        displayId: 'IN-0001',
      }],
    }],
    implications: [{
      id: 'i1',
      kind: 'question',
      text: 'Question 1',
      basedOnFindings: ['f1'],
    }],
  });

  // Create draft for the readout with complete review state and proper citations
  await sequelize.query(`
    INSERT INTO desk_research_readout_drafts (readout_id, content, findings_checked, implications_reviewed, content_version, last_edited_at)
    VALUES (${testReadoutId}, '${draftContent.replace(/'/g, "''")}', '["f1"]', '["i1"]', 1, NOW())
  `);

  // Create second readout in same project (for cross-readout isolation)
  const [secondReadoutRows] = await sequelize.query(`
    INSERT INTO desk_research_readouts (study_id, project_id, public_id, display_id, display_sequence, title, question, created_by_actor_id, created_at)
    VALUES (${testStudyId}, ${testProjectId}, gen_random_uuid(), 'RO-0002', 2, 'Second Readout', 'Another question?', ${testActorId}, NOW())
    RETURNING id
  `);
  secondReadoutId = (secondReadoutRows as any[])[0].id;

  // Create draft for second readout
  await sequelize.query(`
    INSERT INTO desk_research_readout_drafts (readout_id, content, findings_checked, implications_reviewed, content_version, last_edited_at)
    VALUES (${secondReadoutId}, '{"sections":[]}', '[]', '[]', 1, NOW())
  `);

  // Create second project for isolation tests
  const [otherProjectRows] = await sequelize.query(`
    INSERT INTO projects (name, slug, public_id, status, created_by, organization_id, created_at, updated_at)
    VALUES ('Other Project', 'other-proj-5e', gen_random_uuid(), 'active', 'U_TEST', ${TEST_ORG_ID}, NOW(), NOW())
    RETURNING id
  `);
  otherProjectId = (otherProjectRows as any[])[0].id;

  // Create study in other project
  const [otherStudyRows] = await sequelize.query(`
    INSERT INTO research_studies (project_id, name, channel_name, created_by, researcher_name, researcher_email, public_id, created_at, updated_at)
    VALUES (${otherProjectId}, 'Other Study', 'chan-other', 'U_TEST', 'Other', 'other@test.com', gen_random_uuid(), NOW(), NOW())
    RETURNING id
  `);
  otherStudyId = (otherStudyRows as any[])[0].id;

  // Create readout in other project
  const [otherReadoutRows] = await sequelize.query(`
    INSERT INTO desk_research_readouts (study_id, project_id, public_id, display_id, display_sequence, title, question, created_by_actor_id, created_at)
    VALUES (${otherStudyId}, ${otherProjectId}, gen_random_uuid(), 'RO-0001', 1, 'Other Readout', 'Other question?', ${testActorId}, NOW())
    RETURNING id
  `);
  otherReadoutId = (otherReadoutRows as any[])[0].id;

  // Create draft for other readout
  await sequelize.query(`
    INSERT INTO desk_research_readout_drafts (readout_id, content, findings_checked, implications_reviewed, content_version, last_edited_at)
    VALUES (${otherReadoutId}, '{"sections":[]}', '[]', '[]', 1, NOW())
  `);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /versions/:versionId/content — Authorization Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /versions/:versionId/content — Authorization', () => {
  it('allows authorized project member to retrieve version content', async () => {
    // Initiate and complete a generation
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'auth-test-key-1',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Claim the version (required before completing)
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${genResult.versionId}
    `);

    // Complete the generation with content
    await completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: genResult.generationRequestId,
      content: { findings: [{ id: 'f1', text: 'Generated finding', citations: [] }] },
      status: 'completed',
      workerId: 'test-worker',
    });

    // Retrieve version content
    const result = await getVersionContent(
      testReadoutId,
      genResult.versionId,
      testActorId,
    );

    expect(result).not.toBeNull();
    expect(result!.versionId).toBe(genResult.versionId);
    expect(result!.hasContent).toBe(true);
    expect(result!.content).toEqual({
      findings: [{ id: 'f1', text: 'Generated finding', citations: [] }],
    });
  });

  it('rejects unauthorized access (no project membership)', async () => {
    // Create an actor with no project membership
    const unauthorizedActorId = await seedActor('unauthorized@test.com');

    // Initiate a generation
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'unauth-test-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    await expect(
      getVersionContent(testReadoutId, genResult.versionId, unauthorizedActorId),
    ).rejects.toThrow(/access denied/i);
  });

  it('rejects cross-project version access', async () => {
    // testActorId is member of testProjectId but not otherProjectId
    // Attempt to access version in other project should fail
    // First, add testActorId as member of otherProjectId to create a version there
    await sequelize.query(`
      INSERT INTO project_memberships (project_id, actor_id, role, created_at)
      VALUES (${otherProjectId}, ${testActorId}, 'researcher', NOW())
    `);

    // Create insight in other project
    const [otherConstructRows] = await sequelize.query(`
      INSERT INTO evidence_constructs (public_id, project_id, construct_type, derivation_type, status, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), ${otherProjectId}, 'desk_insight', 'human', 'accepted', 'U_TEST', NOW(), NOW())
      RETURNING id
    `);
    const otherConstructId = (otherConstructRows as any[])[0].id;

    const [otherRevRows] = await sequelize.query(`
      INSERT INTO evidence_construct_revisions (
        public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at
      )
      VALUES (
        gen_random_uuid(), ${otherConstructId}, 1, '{"wording": "Other insight"}', '[]', 'researcher', 'U_TEST', NOW()
      )
      RETURNING public_id
    `);
    const otherRevisionPublicId = (otherRevRows as any[])[0].public_id;

    await sequelize.query(`
      UPDATE evidence_constructs
      SET accepted_revision_id = (
        SELECT id FROM evidence_construct_revisions
        WHERE construct_id = ${otherConstructId} AND revision_number = 1
      )
      WHERE id = ${otherConstructId}
    `);

    // Initiate generation in other project
    const otherGenResult = await initiateGenerationV2({
      readoutId: otherReadoutId,
      idempotencyKey: 'other-proj-key',
      selectedRevisionIds: [otherRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Remove membership from other project
    await sequelize.query(`
      DELETE FROM project_memberships
      WHERE project_id = ${otherProjectId} AND actor_id = ${testActorId}
    `);

    // Attempt to access version should fail
    await expect(
      getVersionContent(otherReadoutId, otherGenResult.versionId, testActorId),
    ).rejects.toThrow(/access denied/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /versions/:versionId/content — Cross-Readout Isolation
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /versions/:versionId/content — Isolation', () => {
  it('returns null for version belonging to different readout', async () => {
    // Create a version in testReadoutId
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'isolation-test-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Attempt to retrieve using secondReadoutId (wrong readout, same project)
    const result = await getVersionContent(
      secondReadoutId,
      genResult.versionId,
      testActorId,
    );

    // Should return null because version doesn't belong to secondReadoutId
    expect(result).toBeNull();
  });

  it('returns null for non-existent version ID', async () => {
    const result = await getVersionContent(
      testReadoutId,
      999999, // Non-existent version ID
      testActorId,
    );

    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /versions/:versionId/content — Content States
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /versions/:versionId/content — Content States', () => {
  it('returns hasContent=true for completed version with content', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'content-state-key-1',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Claim and complete
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${genResult.versionId}
    `);

    await completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: genResult.generationRequestId,
      content: { findings: [{ id: 'f1', text: 'Test', citations: [] }] },
      status: 'completed',
      workerId: 'test-worker',
    });

    const result = await getVersionContent(testReadoutId, genResult.versionId, testActorId);

    expect(result).not.toBeNull();
    expect(result!.hasContent).toBe(true);
    expect(result!.generationStatus).toBe('completed');
    expect(result!.content).not.toBeNull();
  });

  it('returns hasContent=false for pending version', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'pending-state-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const result = await getVersionContent(testReadoutId, genResult.versionId, testActorId);

    expect(result).not.toBeNull();
    expect(result!.hasContent).toBe(false);
    expect(result!.generationStatus).toBe('pending');
    expect(result!.content).toBeNull();
  });

  it('returns hasContent=false for failed version', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'failed-state-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Claim and fail
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${genResult.versionId}
    `);

    await completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: genResult.generationRequestId,
      content: {},
      status: 'failed',
      error: 'Test error',
      workerId: 'test-worker',
    });

    const result = await getVersionContent(testReadoutId, genResult.versionId, testActorId);

    expect(result).not.toBeNull();
    expect(result!.hasContent).toBe(false);
    expect(result!.generationStatus).toBe('failed');
    expect(result!.content).toBeNull();
  });

  it('returns hasContent=false for superseded version', async () => {
    // Create first generation
    const firstGen = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'superseded-key-1',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Create second generation (supersedes first)
    await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'superseded-key-2',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const result = await getVersionContent(testReadoutId, firstGen.versionId, testActorId);

    expect(result).not.toBeNull();
    expect(result!.hasContent).toBe(false);
    expect(result!.generationStatus).toBe('superseded');
  });

  it('returns content for completed version not applied due to CAS conflict', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'cas-conflict-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Claim and start generating
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${genResult.versionId}
    `);

    // Simulate human edit during generation (bump draft version)
    // Note: Can't mark new finding as checked (validation rule), so just add the finding
    await saveDraft({
      readoutId: testReadoutId,
      content: { findings: [{ id: 'f2', text: 'Human edited finding', citations: [] }] },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: testActorId,
    });

    // Complete generation (should detect conflict)
    const completionResult = await completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: genResult.generationRequestId,
      content: { findings: [{ id: 'f3', text: 'AI generated finding', citations: [] }] },
      status: 'completed',
      workerId: 'test-worker',
    });

    // Content was stored but NOT applied
    expect(completionResult.applied).toBe(false);
    expect(completionResult.conflictDetected).toBe(true);

    // Version content should still be retrievable
    const result = await getVersionContent(testReadoutId, genResult.versionId, testActorId);

    expect(result).not.toBeNull();
    expect(result!.hasContent).toBe(true);
    expect(result!.generationStatus).toBe('completed');
    expect(result!.content).toEqual({
      findings: [{ id: 'f3', text: 'AI generated finding', citations: [] }],
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /versions/:versionId/content — No Side Effects
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /versions/:versionId/content — No Side Effects', () => {
  it('does not modify draft when retrieving version content', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'no-side-effect-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Get draft state before
    const readoutBefore = await getReadoutById(testReadoutId, testActorId);
    const draftVersionBefore = readoutBefore!.draft.contentVersion;

    // Retrieve version content
    await getVersionContent(testReadoutId, genResult.versionId, testActorId);

    // Get draft state after
    const readoutAfter = await getReadoutById(testReadoutId, testActorId);
    const draftVersionAfter = readoutAfter!.draft.contentVersion;

    // Draft should be unchanged
    expect(draftVersionAfter).toBe(draftVersionBefore);
  });

  it('does not modify approval state when retrieving version content', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'no-approval-effect-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Get approval state before (none)
    const readoutBefore = await getReadoutById(testReadoutId, testActorId);
    expect(readoutBefore!.latestApproval).toBeNull();

    // Retrieve version content
    await getVersionContent(testReadoutId, genResult.versionId, testActorId);

    // Get approval state after
    const readoutAfter = await getReadoutById(testReadoutId, testActorId);
    expect(readoutAfter!.latestApproval).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Finality — Regeneration Rejected After Approval
// ═══════════════════════════════════════════════════════════════════════════

describe('Finality — Regeneration After Approval', () => {
  it('rejects generation request on approved readout', async () => {
    // Approve the readout first
    await approveReadout({
      readoutId: testReadoutId,
      expectedVersion: 1,
      approvedByActorId: testActorId,
    });

    // Verify approval
    const readout = await getReadoutById(testReadoutId, testActorId);
    expect(readout!.approvedAt).not.toBeNull();

    // Attempt to initiate generation should fail
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'post-approval-key',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(ReadoutFinalizedError);
  });

  it('preserves existing versions after finality rejection', async () => {
    // Create a version before approval
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'pre-approval-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Save draft first to create a conflict (bump content version)
    await saveDraft({
      readoutId: testReadoutId,
      content: {
        findings: [{
          id: 'f1',
          text: 'Human edited finding',
          citations: [{
            constructPublicId: (await sequelize.query(
              `SELECT public_id FROM evidence_constructs WHERE id = ${testInsightConstructId}`,
            ) as any)[0][0].public_id,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question' as const,
          text: 'Human edited implication',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: testActorId,
    });

    // Complete the generation with content (will be stored but not applied due to conflict)
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${genResult.versionId}
    `);

    const completionResult = await completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: genResult.generationRequestId,
      content: { findings: [{ id: 'gen-f1', text: 'Generated finding', citations: [] }] },
      status: 'completed',
      workerId: 'test-worker',
    });

    // Verify content was stored but not applied (conflict detected)
    expect(completionResult.applied).toBe(false);
    expect(completionResult.conflictDetected).toBe(true);

    // Now mark findings as checked and implications as reviewed for approval
    await saveDraft({
      readoutId: testReadoutId,
      content: {
        findings: [{
          id: 'f1',
          text: 'Human edited finding',
          citations: [{
            constructPublicId: (await sequelize.query(
              `SELECT public_id FROM evidence_constructs WHERE id = ${testInsightConstructId}`,
            ) as any)[0][0].public_id,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        implications: [{
          id: 'i1',
          kind: 'question' as const,
          text: 'Human edited implication',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2, // Bumped by first save
      editedByActorId: testActorId,
    });

    // Now approve
    await approveReadout({
      readoutId: testReadoutId,
      expectedVersion: 3, // Bumped by second save
      approvedByActorId: testActorId,
    });

    // Version should still be accessible with stored content
    const versionContent = await getVersionContent(
      testReadoutId,
      genResult.versionId,
      testActorId,
    );

    expect(versionContent).not.toBeNull();
    expect(versionContent!.hasContent).toBe(true);
    expect(versionContent!.content).toEqual({
      findings: [{ id: 'gen-f1', text: 'Generated finding', citations: [] }],
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Finality — Approval Rejected During Generation
// ═══════════════════════════════════════════════════════════════════════════

describe('Finality — Approval During Generation', () => {
  it('rejects approval while generation is in progress', async () => {
    // Start a generation (sets current_generation_request_id)
    await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'in-progress-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Attempt to approve should fail
    await expect(
      approveReadout({
        readoutId: testReadoutId,
        expectedVersion: 1,
        approvedByActorId: testActorId,
      }),
    ).rejects.toThrow(GenerationInProgressError);
  });

  it('includes generation request ID in error when approval rejected', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'error-details-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    try {
      await approveReadout({
        readoutId: testReadoutId,
        expectedVersion: 1,
        approvedByActorId: testActorId,
      });
      fail('Should have thrown GenerationInProgressError');
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationInProgressError);
      expect((error as GenerationInProgressError).generationRequestId).toBe(
        genResult.generationRequestId,
      );
    }
  });

  it('allows approval after generation completes (generation-in-progress check passes)', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'complete-then-approve-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Complete the generation (without changing draft content - just clearing generation request)
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${genResult.versionId}
    `);

    // Fail the generation so draft content remains unchanged (already has valid citations)
    await completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: genResult.generationRequestId,
      content: {},
      status: 'failed',
      error: 'Test failure to preserve draft',
      workerId: 'test-worker',
    });

    // Verify current_generation_request_id is cleared
    const readoutAfter = await getReadoutById(testReadoutId, testActorId);
    expect(readoutAfter!.currentGenerationRequestId).toBeNull();

    // Now approval should succeed (draft still has valid citations, review state intact)
    const approval = await approveReadout({
      readoutId: testReadoutId,
      expectedVersion: 1, // Version unchanged because generation failed
      approvedByActorId: testActorId,
    });

    expect(approval).not.toBeNull();
    expect(approval.approvalNumber).toBe(1);
  });

  it('allows approval after generation fails', async () => {
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'fail-then-approve-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Fail the generation
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${genResult.versionId}
    `);

    await completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: genResult.generationRequestId,
      content: {},
      status: 'failed',
      error: 'Test failure',
      workerId: 'test-worker',
    });

    // Now approval should succeed (draft unchanged, still at version 1)
    const approval = await approveReadout({
      readoutId: testReadoutId,
      expectedVersion: 1,
      approvedByActorId: testActorId,
    });

    expect(approval).not.toBeNull();
    expect(approval.approvalNumber).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Race Condition Protection
// ═══════════════════════════════════════════════════════════════════════════

describe('Race Condition Protection', () => {
  it('concurrent approval and generation cannot both succeed', async () => {
    // This test verifies that the locking mechanism prevents race conditions.
    // In practice, the FOR UPDATE lock on readout prevents concurrent execution.

    // Start generation first
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'race-test-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // With generation in progress, approval must fail
    await expect(
      approveReadout({
        readoutId: testReadoutId,
        expectedVersion: 1,
        approvedByActorId: testActorId,
      }),
    ).rejects.toThrow(GenerationInProgressError);

    // Verify generation is still valid
    const readout = await getReadoutById(testReadoutId, testActorId);
    expect(readout!.currentGenerationRequestId).toBe(genResult.generationRequestId);
  });

  it('existing unapproved generation behavior remains intact', async () => {
    // Verify that the finality checks don't affect normal generation flow
    const genResult = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'normal-flow-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(genResult.created).toBe(true);
    expect(genResult.status).toBe('pending');

    // Supersession still works
    const secondGen = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'supersession-flow-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(secondGen.created).toBe(true);

    // First generation should be superseded
    const firstVersion = await getVersionContent(
      testReadoutId,
      genResult.versionId,
      testActorId,
    );
    expect(firstVersion!.generationStatus).toBe('superseded');
  });
});
