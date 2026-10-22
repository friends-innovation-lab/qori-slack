/**
 * DR-6b-5c — Generate API Integration Tests
 *
 * HTTP-level tests for POST /generate and GET /generate/:id endpoints.
 * Verifies authorization, validation, idempotency, supersession, and status polling.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Actor } from '../../database/models/actor';
import {
  initiateGenerationV2,
  getGenerationStatus,
  getGenerationHistory,
  getReadoutById,
  ValidationError,
  EvidenceSelectionError,
  IdempotencyConflictError,
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
    VALUES ('Test Project', 'test-proj-5c', gen_random_uuid(), 'active', 'U_TEST', ${TEST_ORG_ID}, NOW(), NOW())
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

  // Create draft for the readout
  await sequelize.query(`
    INSERT INTO desk_research_readout_drafts (readout_id, content, findings_checked, implications_reviewed, content_version, last_edited_at)
    VALUES (${testReadoutId}, '{"sections":[]}', '[]', '[]', 1, NOW())
  `);

  // Create an accepted desk insight for evidence selection
  const [constructRows] = await sequelize.query(`
    INSERT INTO evidence_constructs (public_id, project_id, construct_type, derivation_type, status, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), ${testProjectId}, 'desk_insight', 'human', 'accepted', 'U_TEST', NOW(), NOW())
    RETURNING id, public_id
  `);
  testInsightConstructId = (constructRows as any[])[0].id;

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

  // Create second project for isolation tests
  const [otherProjectRows] = await sequelize.query(`
    INSERT INTO projects (name, slug, public_id, status, created_by, organization_id, created_at, updated_at)
    VALUES ('Other Project', 'other-proj-5c', gen_random_uuid(), 'active', 'U_TEST', ${TEST_ORG_ID}, NOW(), NOW())
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
// POST /generate — Authorization Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /generate — Authorization', () => {
  it('rejects unauthenticated requests', async () => {
    // Direct service call without actor should fail authorization
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'test-key-12345',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: 999999, // Non-existent actor
      }),
    ).rejects.toThrow();
  });

  it('rejects viewer role (requires researcher+)', async () => {
    // Create viewer actor
    const viewerActorId = await seedActor('viewer@test.com');

    // Actor has no project membership - should be denied access
    // (project_memberships only has owner/admin/researcher roles)

    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'viewer-key-123',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: viewerActorId,
      }),
    ).rejects.toThrow(/access denied/i);
  });

  it('rejects cross-project access', async () => {
    // testActorId is researcher on testProjectId but not otherProjectId
    await expect(
      initiateGenerationV2({
        readoutId: otherReadoutId,
        idempotencyKey: 'cross-proj-key',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(/access denied/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /generate — Validation Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /generate — Validation', () => {
  it('rejects missing idempotency key', async () => {
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: '',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects short idempotency key (< 8 chars)', async () => {
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'short',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty selectedRevisionIds', async () => {
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'valid-key-123',
        selectedRevisionIds: [],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(EvidenceSelectionError);
  });

  it('rejects non-existent revision IDs', async () => {
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'valid-key-456',
        selectedRevisionIds: ['00000000-0000-0000-0000-000000000000'],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(EvidenceSelectionError);
  });

  it('rejects withdrawn insight revisions', async () => {
    // Mark the insight as withdrawn
    await sequelize.query(`
      UPDATE evidence_constructs SET withdrawn_at = NOW() WHERE id = ${testInsightConstructId}
    `);

    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'withdrawn-key1',
        selectedRevisionIds: [testRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(EvidenceSelectionError);
  });

  it('rejects cross-project evidence selection', async () => {
    // Create insight in other project
    const [otherConstructRows] = await sequelize.query(`
      INSERT INTO evidence_constructs (public_id, project_id, construct_type, derivation_type, status, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), ${otherProjectId}, 'desk_insight', 'human', 'accepted', 'U_TEST', NOW(), NOW())
      RETURNING id
    `);
    const otherConstructId = (otherConstructRows as any[])[0].id;

    const [otherRevisionRows] = await sequelize.query(`
      INSERT INTO evidence_construct_revisions (
        public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at
      )
      VALUES (
        gen_random_uuid(), ${otherConstructId}, 1, '{"wording": "Other insight"}', '[]', 'researcher', 'U_TEST', NOW()
      )
      RETURNING public_id
    `);
    const otherRevisionPublicId = (otherRevisionRows as any[])[0].public_id;

    await sequelize.query(`
      UPDATE evidence_constructs
      SET accepted_revision_id = (
        SELECT id FROM evidence_construct_revisions
        WHERE construct_id = ${otherConstructId} AND revision_number = 1
      )
      WHERE id = ${otherConstructId}
    `);

    // Try to use other project's evidence in test project's readout
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey: 'cross-evid-key',
        selectedRevisionIds: [otherRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(EvidenceSelectionError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /generate — Idempotency Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /generate — Idempotency', () => {
  it('creates new generation request with valid input', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'new-request-key',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(result.created).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.generationRequestId).toBeDefined();
    expect(result.versionId).toBeDefined();
  });

  it('returns existing request for same key + same payload (idempotent)', async () => {
    const idempotencyKey = 'idempotent-key-1';

    // First request
    const first = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey,
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(first.created).toBe(true);

    // Second request with same key + same payload
    const second = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey,
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(second.created).toBe(false);
    expect(second.generationRequestId).toBe(first.generationRequestId);
    expect(second.versionId).toBe(first.versionId);
  });

  it('rejects same key + different payload (conflict)', async () => {
    const idempotencyKey = 'conflict-key-1';

    // Create second accepted insight
    const [secondConstructRows] = await sequelize.query(`
      INSERT INTO evidence_constructs (public_id, project_id, construct_type, derivation_type, status, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), ${testProjectId}, 'desk_insight', 'human', 'accepted', 'U_TEST', NOW(), NOW())
      RETURNING id
    `);
    const secondConstructId = (secondConstructRows as any[])[0].id;

    const [secondRevisionRows] = await sequelize.query(`
      INSERT INTO evidence_construct_revisions (
        public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at
      )
      VALUES (
        gen_random_uuid(), ${secondConstructId}, 1, '{"wording": "Second insight"}', '[]', 'researcher', 'U_TEST', NOW()
      )
      RETURNING public_id
    `);
    const secondRevisionPublicId = (secondRevisionRows as any[])[0].public_id;

    await sequelize.query(`
      UPDATE evidence_constructs
      SET accepted_revision_id = (
        SELECT id FROM evidence_construct_revisions
        WHERE construct_id = ${secondConstructId} AND revision_number = 1
      )
      WHERE id = ${secondConstructId}
    `);

    // First request with one revision
    await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey,
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Second request with same key but different revisions
    await expect(
      initiateGenerationV2({
        readoutId: testReadoutId,
        idempotencyKey,
        selectedRevisionIds: [secondRevisionPublicId],
        initiatedByActorId: testActorId,
      }),
    ).rejects.toThrow(IdempotencyConflictError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /generate — Supersession Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /generate — Supersession', () => {
  it('supersedes existing pending request', async () => {
    // First request
    const first = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'first-request-123',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(first.status).toBe('pending');

    // Second request with different key
    const second = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'second-request-45',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(second.created).toBe(true);
    expect(second.status).toBe('pending');
    expect(second.generationRequestId).not.toBe(first.generationRequestId);

    // First request should be superseded
    const [rows] = await sequelize.query(`
      SELECT generation_status FROM desk_research_readout_versions
      WHERE generation_request_id = '${first.generationRequestId}'
    `);
    expect((rows as any[])[0].generation_status).toBe('superseded');
  });

  it('supersedes existing generating request', async () => {
    // Create first request
    const first = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'gen-first-1234',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Simulate worker claiming it
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET generation_status = 'generating', worker_id = 'worker-1', claimed_at = NOW()
      WHERE generation_request_id = '${first.generationRequestId}'
    `);

    // Second request should supersede
    const second = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'gen-second-1234',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    expect(second.created).toBe(true);

    // First should be superseded
    const [rows] = await sequelize.query(`
      SELECT generation_status FROM desk_research_readout_versions
      WHERE generation_request_id = '${first.generationRequestId}'
    `);
    expect((rows as any[])[0].generation_status).toBe('superseded');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /generate/:id — Status Polling Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /generate/:id — Status Polling', () => {
  it('returns pending status for new request', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'status-test-123',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const status = await getGenerationStatus(
      testReadoutId,
      result.generationRequestId,
      testActorId,
    );

    expect(status).not.toBeNull();
    expect(status!.status).toBe('pending');
    expect(status!.generationRequestId).toBe(result.generationRequestId);
    expect(status!.attemptCount).toBe(0);
    expect(status!.hasContent).toBe(false);
  });

  it('returns generating status with worker claim info', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'generating-test1',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Simulate worker claiming
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET generation_status = 'generating',
          worker_id = 'worker-abc',
          claimed_at = NOW(),
          generation_started_at = NOW(),
          attempt_count = 1
      WHERE generation_request_id = '${result.generationRequestId}'
    `);

    const status = await getGenerationStatus(
      testReadoutId,
      result.generationRequestId,
      testActorId,
    );

    expect(status!.status).toBe('generating');
    expect(status!.attemptCount).toBe(1);
    expect(status!.generationStartedAt).not.toBeNull();
  });

  it('returns completed status with content flag', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'completed-test1',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Simulate completion
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET generation_status = 'completed',
          generation_completed_at = NOW(),
          content = '{"sections":[]}'::jsonb,
          attempt_count = 1
      WHERE generation_request_id = '${result.generationRequestId}'
    `);

    const status = await getGenerationStatus(
      testReadoutId,
      result.generationRequestId,
      testActorId,
    );

    expect(status!.status).toBe('completed');
    expect(status!.hasContent).toBe(true);
    expect(status!.generationCompletedAt).not.toBeNull();
  });

  it('returns failed status with error code', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'failed-test-123',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Simulate failure
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET generation_status = 'failed',
          generation_error = 'PROVIDER_ERROR',
          generation_completed_at = NOW(),
          attempt_count = 3
      WHERE generation_request_id = '${result.generationRequestId}'
    `);

    const status = await getGenerationStatus(
      testReadoutId,
      result.generationRequestId,
      testActorId,
    );

    expect(status!.status).toBe('failed');
    expect(status!.generationError).toBe('PROVIDER_ERROR');
    expect(status!.attemptCount).toBe(3);
  });

  it('returns retry timing for pending retry', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'retry-test-1234',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Simulate retry with backoff
    const retryTime = new Date(Date.now() + 5000);
    await sequelize.query(`
      UPDATE desk_research_readout_versions
      SET attempt_count = 1,
          retry_after = '${retryTime.toISOString()}'
      WHERE generation_request_id = '${result.generationRequestId}'
    `);

    const status = await getGenerationStatus(
      testReadoutId,
      result.generationRequestId,
      testActorId,
    );

    expect(status!.attemptCount).toBe(1);
    expect(status!.retryAfter).not.toBeNull();
  });

  it('returns null for non-existent request ID', async () => {
    const status = await getGenerationStatus(
      testReadoutId,
      '00000000-0000-0000-0000-000000000000',
      testActorId,
    );

    expect(status).toBeNull();
  });

  it('returns null for request in different readout', async () => {
    // Add actor as researcher on other project for this test
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

    const [otherRevisionRows] = await sequelize.query(`
      INSERT INTO evidence_construct_revisions (
        public_id, construct_id, revision_number, content, evidence_snapshot, origin, created_by, created_at
      )
      VALUES (
        gen_random_uuid(), ${otherConstructId}, 1, '{"wording": "Other insight"}', '[]', 'researcher', 'U_TEST', NOW()
      )
      RETURNING public_id
    `);
    const otherRevisionPublicId = (otherRevisionRows as any[])[0].public_id;

    await sequelize.query(`
      UPDATE evidence_constructs
      SET accepted_revision_id = (
        SELECT id FROM evidence_construct_revisions
        WHERE construct_id = ${otherConstructId} AND revision_number = 1
      )
      WHERE id = ${otherConstructId}
    `);

    // Create request in other readout
    const result = await initiateGenerationV2({
      readoutId: otherReadoutId,
      idempotencyKey: 'other-readout-12',
      selectedRevisionIds: [otherRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    // Try to fetch it from test readout — should return null (scope isolation)
    const status = await getGenerationStatus(
      testReadoutId,
      result.generationRequestId,
      testActorId,
    );

    expect(status).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// No Model Invocation Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('No synchronous model invocation', () => {
  it('POST /generate creates pending job without AI call', async () => {
    const startTime = Date.now();
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'speed-test-1234',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });
    const elapsed = Date.now() - startTime;

    // Should complete in < 1 second (no AI call)
    expect(elapsed).toBeLessThan(1000);
    expect(result.status).toBe('pending');
    expect(result.created).toBe(true);
  });

  it('GET /generate/:id returns persisted state without AI call', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'get-speed-test1',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const startTime = Date.now();
    const status = await getGenerationStatus(
      testReadoutId,
      result.generationRequestId,
      testActorId,
    );
    const elapsed = Date.now() - startTime;

    // Should complete in < 100ms (simple DB lookup)
    expect(elapsed).toBeLessThan(100);
    expect(status).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Existing Endpoints Compatibility
// ═══════════════════════════════════════════════════════════════════════════

describe('Existing endpoints remain compatible', () => {
  it('GET /versions includes generation initiated via POST /generate', async () => {
    await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'compat-test-123',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const history = await getGenerationHistory(testReadoutId, testActorId);

    expect(history.length).toBe(1);
    expect(history[0].generationStatus).toBe('pending');
  });

  it('readout detail includes currentGenerationRequestId after initiation', async () => {
    const result = await initiateGenerationV2({
      readoutId: testReadoutId,
      idempotencyKey: 'detail-compat-12',
      selectedRevisionIds: [testRevisionPublicId],
      initiatedByActorId: testActorId,
    });

    const detail = await getReadoutById(testReadoutId, testActorId);

    expect(detail!.currentGenerationRequestId).toBe(result.generationRequestId);
  });
});
