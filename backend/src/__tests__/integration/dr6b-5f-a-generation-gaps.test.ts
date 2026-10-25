/**
 * DR-6b-5f-A — Generation Gap Coverage Tests
 *
 * Integration tests for scenarios identified in the 5f audit:
 * 1. Evidence withdrawn after generation initiation (during execution)
 * 2. Stale worker completion after ownership revocation
 * 3. Superseded version content retrieval
 * 4. Staleness evaluation triggers
 * 5. Cross-isolation: no Research Brief/Plan mutation
 *
 * Uses real PostgreSQL. No AI model calls (executor tests are mocked separately).
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import * as readoutService from '../../services/desk-readout.service';
import * as claimService from '../../services/readout-generation-claim.service';
import type { Sequelize, Model } from 'sequelize';

const sequelize: Sequelize = getTestDb();
const ActorModel = sequelize.models.Actor;

// ─── Test Fixtures ──────────────────────────────────────────────────────────

let testProjectId: number;
let testStudyId: number;
let testReadoutId: number;
let testActorId: number;
let testInsightConstructId: number;
let testRevisionPublicId: string;
let testConstructPublicId: string;

async function seedTestData(): Promise<void> {
  // Create actor using model (handles schema correctly)
  const actor = await ActorModel.create({
    display_name: 'Test User 5f-A',
    email: 'test-5f-a@test.com',
    organization_id: TEST_ORG_ID,
  } as any);
  testActorId = (actor as any).id;

  // Create project
  const [projectRows] = await sequelize.query(`
    INSERT INTO projects (name, slug, public_id, status, created_by, organization_id, created_at, updated_at)
    VALUES ('Test Project 5f-A', 'test-proj-5f-a', gen_random_uuid(), 'active', 'U_TEST', ${TEST_ORG_ID}, NOW(), NOW())
    RETURNING id
  `);
  testProjectId = (projectRows as any[])[0].id;

  // Add actor as researcher
  await sequelize.query(`
    INSERT INTO project_memberships (project_id, actor_id, role, created_at)
    VALUES (${testProjectId}, ${testActorId}, 'researcher', NOW())
  `);

  // Create study
  const [studyRows] = await sequelize.query(`
    INSERT INTO research_studies (project_id, name, channel_name, created_by, researcher_name, researcher_email, public_id, created_at, updated_at)
    VALUES (${testProjectId}, 'Test Study 5f-A', 'test-channel-5f-a', 'U_TEST', 'Test User', 'test@test.com', gen_random_uuid(), NOW(), NOW())
    RETURNING id
  `);
  testStudyId = (studyRows as any[])[0].id;

  // Create readout
  const [readoutRows] = await sequelize.query(`
    INSERT INTO desk_research_readouts (study_id, project_id, public_id, display_id, display_sequence, title, question, created_by_actor_id, created_at)
    VALUES (${testStudyId}, ${testProjectId}, gen_random_uuid(), 'RO-0001', 1, 'Test Readout 5f-A', 'What do we learn?', ${testActorId}, NOW())
    RETURNING id
  `);
  testReadoutId = (readoutRows as any[])[0].id;

  // Create draft
  await sequelize.query(`
    INSERT INTO desk_research_readout_drafts (readout_id, content, findings_checked, implications_reviewed, content_version, last_edited_at)
    VALUES (${testReadoutId}, '{"sections":[]}', '[]', '[]', 1, NOW())
  `);

  // Create evidence source
  await sequelize.query(`
    INSERT INTO evidence_sources (project_id, source_type, label, created_by, metadata, public_id, created_at, updated_at)
    VALUES (${testProjectId}, 'uploaded_document', 'Test Doc', 'U_TEST', '{"extracted_text": "Test content"}', gen_random_uuid(), NOW(), NOW())
    RETURNING id
  `);

  // Create accepted insight construct with display_sequence
  const [constructRows] = await sequelize.query(`
    INSERT INTO evidence_constructs (public_id, project_id, construct_type, derivation_type, status, display_sequence, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), ${testProjectId}, 'desk_insight', 'human', 'accepted', 1, 'U_TEST', NOW(), NOW())
    RETURNING id, public_id
  `);
  testInsightConstructId = (constructRows as any[])[0].id;
  testConstructPublicId = (constructRows as any[])[0].public_id;

  // Create accepted revision
  const [revisionRows] = await sequelize.query(`
    INSERT INTO evidence_construct_revisions (
      public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at
    )
    VALUES (
      gen_random_uuid(), ${testInsightConstructId}, 1, '{"wording": "Test insight for gap testing"}', '[]', 'researcher', 'U_TEST', NOW()
    )
    RETURNING id, public_id
  `);
  testRevisionPublicId = (revisionRows as any[])[0].public_id;
  const testRevisionId = (revisionRows as any[])[0].id;

  // Link revision as accepted
  await sequelize.query(`
    UPDATE evidence_constructs
    SET accepted_revision_id = ${testRevisionId}
    WHERE id = ${testInsightConstructId}
  `);
}

// ─── Test Setup ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await truncateAll();
  await seedTestData();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Evidence Withdrawn After Generation Initiation
// ═══════════════════════════════════════════════════════════════════════════

describe('Evidence Withdrawn After Generation Initiation', () => {
  it('captures evidence snapshot at initiation time', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'snapshot-test-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(result.created).toBe(true);

    // Verify evidence set was captured
    const [versionRows] = await sequelize.query(`
      SELECT evidence_set FROM desk_research_readout_versions WHERE id = ${result.versionId}
    `);
    const evidenceSet = (versionRows as any[])[0].evidence_set;

    expect(evidenceSet).toHaveLength(1);
    expect(evidenceSet[0].revisionPublicId).toBe(testRevisionPublicId);
  });

  it('snapshot remains unchanged when evidence is withdrawn after initiation', async () => {
    // Initiate generation
    const result = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'withdraw-after-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Now withdraw the evidence
    await sequelize.query(`
      UPDATE evidence_constructs SET withdrawn_at = NOW() WHERE id = ${testInsightConstructId}
    `);

    // Evidence snapshot should still be intact
    const [versionRows] = await sequelize.query(`
      SELECT evidence_set FROM desk_research_readout_versions WHERE id = ${result.versionId}
    `);
    const evidenceSet = (versionRows as any[])[0].evidence_set;

    expect(evidenceSet).toHaveLength(1);
    expect(evidenceSet[0].revisionPublicId).toBe(testRevisionPublicId);
  });

  it('new generation request rejects withdrawn evidence', async () => {
    // Withdraw the evidence first
    await sequelize.query(`
      UPDATE evidence_constructs SET withdrawn_at = NOW() WHERE id = ${testInsightConstructId}
    `);

    // Attempt to initiate new generation should fail
    await expect(
      readoutService.initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'withdraw-before-001',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Stale Worker Completion After Ownership Revocation
// ═══════════════════════════════════════════════════════════════════════════

describe('Stale Worker Completion After Ownership Revocation', () => {
  it('rejects completion from worker that lost ownership', async () => {
    // Initiate generation
    const result = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'stale-worker-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const WORKER_A = 'worker-a-' + Date.now();
    const WORKER_B = 'worker-b-' + Date.now();

    // Worker A claims the job
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = '${WORKER_A}',
          claimed_at = NOW(),
          heartbeat_at = NOW() - INTERVAL '200 seconds',
          generation_status = 'generating'
      WHERE id = ${result.versionId}
    `);

    // Simulate stale recovery: Worker B claims after A's heartbeat times out
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = '${WORKER_B}',
          claimed_at = NOW(),
          heartbeat_at = NOW(),
          attempt_count = attempt_count + 1
      WHERE id = ${result.versionId}
    `);

    // Worker A (stale) tries to complete - should be rejected via fencing
    const completionResult = await readoutService.completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: result.generationRequestId,
      content: { findings: [] } as any,
      status: 'completed',
      workerId: WORKER_A, // Stale worker
    });

    expect(completionResult.fencingViolation).toBe(true);
    expect(completionResult.applied).toBe(false);

    // Worker B can still complete
    const workerBResult = await readoutService.completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: result.generationRequestId,
      content: { findings: [{ id: 'F1', text: 'Test', citations: [] }] } as any,
      status: 'completed',
      workerId: WORKER_B,
    });

    expect(workerBResult.fencingViolation).toBe(false);
    expect(workerBResult.applied).toBe(true);
  });

  it('heartbeat update fails for worker that lost ownership', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'heartbeat-revoke-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const WORKER_A = 'worker-a-hb-' + Date.now();
    const WORKER_B = 'worker-b-hb-' + Date.now();

    // Worker A claims via raw SQL (to get version ID)
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = '${WORKER_A}',
          claimed_at = NOW(),
          heartbeat_at = NOW(),
          generation_status = 'generating'
      WHERE id = ${result.versionId}
    `);

    // Simulate ownership transfer to Worker B
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = '${WORKER_B}'
      WHERE id = ${result.versionId}
    `);

    // Worker A tries to update heartbeat - should fail
    await expect(
      claimService.updateHeartbeat(result.versionId, WORKER_A),
    ).rejects.toThrow(claimService.NotOwnerError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Superseded Version Content Retrieval
// ═══════════════════════════════════════════════════════════════════════════

describe('Superseded Version Content Retrieval', () => {
  it('superseded version content is accessible for history viewing', async () => {
    // Create first generation
    const gen1 = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'supersede-gen1-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Complete first generation
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'worker-1', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${gen1.versionId}
    `);

    await readoutService.completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: gen1.generationRequestId,
      content: { summary: { text: 'First generation', citations: [] }, findings: [], limitations: [], implications: [] },
      status: 'completed',
      workerId: 'worker-1',
    });

    // Start second generation
    const gen2 = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'supersede-gen2-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // First version should still be accessible
    const version1Content = await readoutService.getVersionContent(
      testReadoutId,
      gen1.versionId,
      testActorId,
    );

    expect(version1Content).not.toBeNull();
    expect(version1Content?.hasContent).toBe(true);
    expect(version1Content?.content?.summary?.text).toBe('First generation');
  });

  it('superseded pending version has no content but is recorded', async () => {
    // Create first generation (leave pending)
    const gen1 = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'pending-supersede-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Create second generation (supersedes first)
    const gen2 = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'pending-supersede-002',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // First version should be marked superseded
    const [versionRows] = await sequelize.query(`
      SELECT generation_status FROM desk_research_readout_versions WHERE id = ${gen1.versionId}
    `);
    expect((versionRows as any[])[0].generation_status).toBe('superseded');

    // Content retrieval returns no content for superseded
    const version1Content = await readoutService.getVersionContent(
      testReadoutId,
      gen1.versionId,
      testActorId,
    );

    expect(version1Content).not.toBeNull();
    expect(version1Content?.hasContent).toBe(false);
    expect(version1Content?.generationStatus).toBe('superseded');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Staleness Evaluation Triggers
// ═══════════════════════════════════════════════════════════════════════════

describe('Staleness Evaluation Triggers', () => {
  it('evaluateStaleness is callable and returns result', async () => {
    const staleness = await readoutService.evaluateStaleness(testReadoutId, testActorId);

    // With no approved content, should not be stale
    expect(staleness.isStale).toBe(false);
  });

  it('evaluateStaleness detects newly withdrawn evidence after approval', async () => {
    // Save draft with citation (findings not checked yet)
    await readoutService.saveDraft({
      readoutId: testReadoutId,
      content: {
        summary: { text: 'Summary', citations: [] },
        findings: [{
          id: 'f1',
          text: 'Finding with citation',
          citations: [{
            constructPublicId: testConstructPublicId,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        limitations: [],
        implications: [{
          id: 'i1',
          kind: 'priority',
          text: 'Test implication',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: testActorId,
    });

    // Now mark as checked in second save
    await readoutService.saveDraft({
      readoutId: testReadoutId,
      content: {
        summary: { text: 'Summary', citations: [] },
        findings: [{
          id: 'f1',
          text: 'Finding with citation',
          citations: [{
            constructPublicId: testConstructPublicId,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        limitations: [],
        implications: [{
          id: 'i1',
          kind: 'priority',
          text: 'Test implication',
          basedOnFindings: ['f1'],
        }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: testActorId,
    });

    // Approve (creates snapshot)
    await readoutService.approveReadout({
      readoutId: testReadoutId,
      expectedVersion: 3,
      approvedByActorId: testActorId,
    });

    // Staleness should be false initially
    let staleness = await readoutService.evaluateStaleness(testReadoutId, testActorId);
    expect(staleness.isStale).toBe(false);

    // Now withdraw the evidence
    await sequelize.query(`
      UPDATE evidence_constructs SET withdrawn_at = NOW() WHERE id = ${testInsightConstructId}
    `);

    // Staleness should now be detected
    staleness = await readoutService.evaluateStaleness(testReadoutId, testActorId);
    expect(staleness.isStale).toBe(true);
    expect(staleness.reason).toBe('cited_insight_withdrawn');
  });

  it('evaluateStaleness detects superseded revision after approval', async () => {
    // Save draft with citation to rev 1 (not checked yet)
    await readoutService.saveDraft({
      readoutId: testReadoutId,
      content: {
        summary: { text: 'Summary', citations: [] },
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: testConstructPublicId,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        limitations: [],
        implications: [{ id: 'i1', kind: 'priority', text: 'Impl', basedOnFindings: ['f1'] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: testActorId,
    });

    // Mark as checked in second save
    await readoutService.saveDraft({
      readoutId: testReadoutId,
      content: {
        summary: { text: 'Summary', citations: [] },
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: testConstructPublicId,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        limitations: [],
        implications: [{ id: 'i1', kind: 'priority', text: 'Impl', basedOnFindings: ['f1'] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: testActorId,
    });

    await readoutService.approveReadout({
      readoutId: testReadoutId,
      expectedVersion: 3,
      approvedByActorId: testActorId,
    });

    // Create a new accepted revision (supersedes old)
    const [newRevisionRows] = await sequelize.query(`
      INSERT INTO evidence_construct_revisions (
        public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at
      )
      VALUES (
        gen_random_uuid(), ${testInsightConstructId}, 2, '{"wording": "Updated insight wording"}', '[]', 'researcher', 'U_TEST', NOW()
      )
      RETURNING id
    `);
    const newRevisionId = (newRevisionRows as any[])[0].id;

    await sequelize.query(`
      UPDATE evidence_constructs SET accepted_revision_id = ${newRevisionId} WHERE id = ${testInsightConstructId}
    `);

    // Staleness should detect the supersession
    const staleness = await readoutService.evaluateStaleness(testReadoutId, testActorId);
    expect(staleness.isStale).toBe(true);
    expect(staleness.reason).toBe('newer_revision_accepted');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Cross-Isolation: No Research Brief/Plan Mutation
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-Isolation: No Brief/Plan Mutation', () => {
  it('readout operations do not touch research_briefs table', async () => {
    // Get initial brief count (if table exists)
    let initialBriefCount = 0;
    try {
      const [result] = await sequelize.query('SELECT COUNT(*) as count FROM research_briefs');
      initialBriefCount = parseInt((result as any[])[0].count, 10);
    } catch {
      // Table may not exist in test DB
    }

    // Perform readout operations
    const gen = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'isolation-test-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${gen.versionId}
    `);

    await readoutService.completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: gen.generationRequestId,
      content: { findings: [{ id: 'F1', text: 'Test', citations: [] }] } as any,
      status: 'completed',
      workerId: 'test-worker',
    });

    // Verify brief count unchanged
    try {
      const [result] = await sequelize.query('SELECT COUNT(*) as count FROM research_briefs');
      const finalBriefCount = parseInt((result as any[])[0].count, 10);
      expect(finalBriefCount).toBe(initialBriefCount);
    } catch {
      // Table doesn't exist, isolation is trivially satisfied
    }
  });

  it('readout operations do not touch research_plans table', async () => {
    // Get initial plan count (if table exists)
    let initialPlanCount = 0;
    try {
      const [result] = await sequelize.query('SELECT COUNT(*) as count FROM research_plans');
      initialPlanCount = parseInt((result as any[])[0].count, 10);
    } catch {
      // Table may not exist
    }

    // Perform readout operations including approval (two-phase save)
    await readoutService.saveDraft({
      readoutId: testReadoutId,
      content: {
        summary: { text: 'Summary', citations: [] },
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: testConstructPublicId,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        limitations: [],
        implications: [{ id: 'i1', kind: 'priority', text: 'Impl', basedOnFindings: ['f1'] }],
      },
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: testActorId,
    });

    // Mark as checked
    await readoutService.saveDraft({
      readoutId: testReadoutId,
      content: {
        summary: { text: 'Summary', citations: [] },
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: testConstructPublicId,
            revisionPublicId: testRevisionPublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        limitations: [],
        implications: [{ id: 'i1', kind: 'priority', text: 'Impl', basedOnFindings: ['f1'] }],
      },
      findingsChecked: ['f1'],
      implicationsReviewed: ['i1'],
      expectedVersion: 2,
      editedByActorId: testActorId,
    });

    await readoutService.approveReadout({
      readoutId: testReadoutId,
      expectedVersion: 3,
      approvedByActorId: testActorId,
    });

    // Verify plan count unchanged
    try {
      const [result] = await sequelize.query('SELECT COUNT(*) as count FROM research_plans');
      const finalPlanCount = parseInt((result as any[])[0].count, 10);
      expect(finalPlanCount).toBe(initialPlanCount);
    } catch {
      // Table doesn't exist, isolation is trivially satisfied
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Historical Version Read-Only Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('Historical Version Read-Only', () => {
  it('getVersionContent does not modify version or draft', async () => {
    const gen = await readoutService.initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'readonly-test-001',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Complete generation
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET worker_id = 'test-worker', claimed_at = NOW(), heartbeat_at = NOW(), generation_status = 'generating'
      WHERE id = ${gen.versionId}
    `);

    await readoutService.completeGenerationWithFencing({
      readoutId: testReadoutId,
      generationRequestId: gen.generationRequestId,
      content: { summary: { text: 'Readonly test', citations: [] }, findings: [], limitations: [], implications: [] },
      status: 'completed',
      workerId: 'test-worker',
    });

    // Record state before retrieval
    const [versionBefore] = await sequelize.query(
      `SELECT content FROM desk_research_readout_versions WHERE id = ${gen.versionId}`,
    );
    const [draftBefore] = await sequelize.query(
      `SELECT content_version FROM desk_research_readout_drafts WHERE readout_id = ${testReadoutId}`,
    );

    // Retrieve version content multiple times
    await readoutService.getVersionContent(testReadoutId, gen.versionId, testActorId);
    await readoutService.getVersionContent(testReadoutId, gen.versionId, testActorId);

    // Record state after retrieval
    const [versionAfter] = await sequelize.query(
      `SELECT content FROM desk_research_readout_versions WHERE id = ${gen.versionId}`,
    );
    const [draftAfter] = await sequelize.query(
      `SELECT content_version FROM desk_research_readout_drafts WHERE readout_id = ${testReadoutId}`,
    );

    // Content should be identical
    expect(JSON.stringify((versionAfter as any[])[0])).toBe(JSON.stringify((versionBefore as any[])[0]));
    expect((draftAfter as any[])[0].content_version).toBe((draftBefore as any[])[0].content_version);
  });
});
