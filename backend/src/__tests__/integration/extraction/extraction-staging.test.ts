/**
 * Integration tests for extraction staging service — DISC-WEB-1
 *
 * Tests database operations, lifecycle transitions, and validation.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import type { Transaction } from 'sequelize';
import {
  validateRefsForConsumption,
  consumeValidatedRefs,
  type ValidatedStagingRefs,
  type ValidationResult,
} from '../../../services/extraction/extraction-staging.service';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testActorId: number;

beforeEach(async () => {
  await truncateAll();

  // Create test project
  const Project = sequelize.models.Project;
  const project = await Project.create({
    name: 'Test Project',
    slug: 'test-project',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  testProjectId = (project as unknown as { id: number }).id;

  // Create test actor
  const Actor = sequelize.models.Actor;
  const actor = await Actor.create({
    display_name: 'Test User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;
});

afterAll(() => sequelize.close());

describe('extraction staging lifecycle', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;

  it('creates staging row with correct fields', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'test.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 1024,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'This is the extracted content from the PDF document.',
      char_count: 52,
      status: 'ready',
    });

    expect(staging.get('id')).toBeGreaterThan(0);
    expect(staging.get('ref_token')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(staging.get('project_id')).toBe(testProjectId);
    expect(staging.get('actor_id')).toBe(testActorId);
    expect(staging.get('filename')).toBe('test.pdf');
    expect(staging.get('status')).toBe('ready');
    expect(staging.get('expires_at')).toBeInstanceOf(Date);
    expect((staging.get('expires_at') as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('generates unique ref_token per row', async () => {
    const staging1 = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'file1.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content for file 1 with enough characters to pass validation.',
      char_count: 61,
      status: 'ready',
    });

    const staging2 = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'file2.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'c'.repeat(64),
      content_hash: 'd'.repeat(64),
      extracted_text: 'Content for file 2 with enough characters to pass validation.',
      char_count: 61,
      status: 'ready',
    });

    expect(staging1.get('ref_token')).not.toBe(staging2.get('ref_token'));
  });

  it('enforces unique ref_token constraint', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'unique.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content with enough characters to pass minimum validation.',
      char_count: 57,
      status: 'ready',
    });

    const refToken = staging.get('ref_token');

    // Attempting to create with same ref_token should fail
    await expect(
      ExtractionStaging().create({
        ref_token: refToken,
        project_id: testProjectId,
        actor_id: testActorId,
        filename: 'duplicate.txt',
        mime_type: 'text/plain',
        file_size_bytes: 100,
        file_hash: 'c'.repeat(64),
        content_hash: 'd'.repeat(64),
        extracted_text: 'Different content but same ref token should fail uniqueness.',
        char_count: 60,
        status: 'ready',
      }),
    ).rejects.toThrow();
  });

  it('status defaults to ready', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'default-status.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content to verify default status value is set correctly.',
      char_count: 55,
    });

    expect(staging.get('status')).toBe('ready');
  });

  it('transitions status to consumed', async () => {
    // Create a discovery run first (for FK)
    const DiscoveryRun = sequelize.models.DiscoveryRun;
    const run = await DiscoveryRun.create({
      project_id: testProjectId,
      discovery_type: 'desk_research',
      topic: 'Test topic',
      topic_slug: 'test-topic',
      created_by_identity: 'test:user',
      status: 'pending',
    });
    const runId = (run as unknown as { id: number }).id;

    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'to-consume.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content that will be consumed by a discovery run process.',
      char_count: 57,
      status: 'ready',
    });

    await staging.update({
      status: 'consumed',
      consumed_by_run_id: runId,
      consumed_at: new Date(),
    });

    const refreshed = await ExtractionStaging().findByPk(staging.get('id') as number);
    expect(refreshed!.get('status')).toBe('consumed');
    expect(refreshed!.get('consumed_by_run_id')).toBe(runId);
    expect(refreshed!.get('consumed_at')).toBeInstanceOf(Date);
  });

  it('transitions status to expired', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'to-expire.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content that will expire before being consumed by any run.',
      char_count: 58,
      status: 'ready',
    });

    await staging.update({ status: 'expired' });

    const refreshed = await ExtractionStaging().findByPk(staging.get('id') as number);
    expect(refreshed!.get('status')).toBe('expired');
  });

  it('stores error information for failed extractions', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'failed.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: '',
      extracted_text: '',
      char_count: 0,
      status: 'failed',
      error_code: 'ENCRYPTED_PDF',
      error_message: 'PDF is password-protected',
    });

    const refreshed = await ExtractionStaging().findByPk(staging.get('id') as number);
    expect(refreshed!.get('status')).toBe('failed');
    expect(refreshed!.get('error_code')).toBe('ENCRYPTED_PDF');
    expect(refreshed!.get('error_message')).toBe('PDF is password-protected');
  });
});

describe('extraction staging queries', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;

  it('finds staging by ref_token', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'findable.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content that can be found by its unique reference token.',
      char_count: 56,
      status: 'ready',
    });

    const refToken = staging.get('ref_token') as string;
    const found = await ExtractionStaging().findOne({ where: { ref_token: refToken } });

    expect(found).not.toBeNull();
    expect(found!.get('filename')).toBe('findable.txt');
  });

  it('finds multiple staging rows by project', async () => {
    await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'proj-file-1.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'First file content for project staging query test file.',
      char_count: 55,
      status: 'ready',
    });

    await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'proj-file-2.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'c'.repeat(64),
      content_hash: 'd'.repeat(64),
      extracted_text: 'Second file content for project staging query test file.',
      char_count: 56,
      status: 'ready',
    });

    const all = await ExtractionStaging().findAll({
      where: { project_id: testProjectId },
    });

    expect(all).toHaveLength(2);
  });

  it('filters by status', async () => {
    await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'ready.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content for ready status file in status filter test case.',
      char_count: 57,
      status: 'ready',
    });

    await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'expired.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'c'.repeat(64),
      content_hash: 'd'.repeat(64),
      extracted_text: 'Content for expired status file in status filter test case.',
      char_count: 59,
      status: 'expired',
    });

    const ready = await ExtractionStaging().findAll({
      where: { project_id: testProjectId, status: 'ready' },
    });

    expect(ready).toHaveLength(1);
    expect(ready[0].get('filename')).toBe('ready.txt');
  });
});

/**
 * Evidence preservation tests — verify staging cleanup cannot affect permanent evidence.
 *
 * Architecture note:
 * - ExtractionStaging is TEMPORARY storage with consumed_by_run_id FK to DiscoveryRun
 * - EvidenceSource is PERMANENT storage linked via DiscoveryRunSource join table
 * - There is NO direct FK from ExtractionStaging to EvidenceSource
 * - When run creation consumes staging refs, it COPIES text to EvidenceSource
 * - Deleting staging rows cannot cascade to EvidenceSource (no FK relationship)
 *
 * This test suite verifies the data independence invariant.
 */
describe('evidence preservation (staging deletion safety)', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;
  const EvidenceSource = () => sequelize.models.EvidenceSource;
  const DiscoveryRun = () => sequelize.models.DiscoveryRun;
  const DiscoveryRunSource = () => sequelize.models.DiscoveryRunSource;

  it('deleting staging row does not affect EvidenceSource', async () => {
    // Create a discovery run
    const run = await DiscoveryRun().create({
      project_id: testProjectId,
      discovery_type: 'desk_research',
      topic: 'Evidence preservation test',
      topic_slug: 'evidence-preservation-test',
      created_by_identity: 'test:user',
      status: 'completed',
    });
    const runId = (run as unknown as { id: number }).id;

    // Create an EvidenceSource (simulating what run creation would do)
    const evidenceSource = await EvidenceSource().create({
      project_id: testProjectId,
      source_type: 'uploaded_document',
      label: 'Test Document',
      artifact_ref: { extracted_text: 'Permanent copy of extracted content' },
      metadata: { original_filename: 'test.pdf' },
      created_by: 'test:user',
    });
    const evidenceSourceId = (evidenceSource as unknown as { id: number }).id;

    // Link evidence to run via join table
    await DiscoveryRunSource().create({
      discovery_run_id: runId,
      evidence_source_id: evidenceSourceId,
    });

    // Create staging row marked as consumed by this run
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'test.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 1024,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Temporary copy that will be deleted.',
      char_count: 36,
      status: 'consumed',
      consumed_by_run_id: runId,
      consumed_at: new Date(),
    });
    const stagingId = staging.get('id') as number;

    // Delete the staging row (simulating cleanup job)
    await ExtractionStaging().destroy({ where: { id: stagingId } });

    // Verify EvidenceSource still exists and is intact
    const permanentEvidence = await EvidenceSource().findByPk(evidenceSourceId);
    expect(permanentEvidence).not.toBeNull();
    expect(permanentEvidence!.get('label')).toBe('Test Document');
    expect((permanentEvidence!.get('artifact_ref') as Record<string, unknown>).extracted_text)
      .toBe('Permanent copy of extracted content');

    // Verify run-evidence link still exists
    const link = await DiscoveryRunSource().findOne({
      where: { discovery_run_id: runId, evidence_source_id: evidenceSourceId },
    });
    expect(link).not.toBeNull();
  });

  it('cleanup of consumed staging preserves all linked evidence', async () => {
    // Create run with multiple evidence sources
    const run = await DiscoveryRun().create({
      project_id: testProjectId,
      discovery_type: 'desk_research',
      topic: 'Multi-source test',
      topic_slug: 'multi-source-test',
      created_by_identity: 'test:user',
      status: 'completed',
    });
    const runId = (run as unknown as { id: number }).id;

    // Create 3 evidence sources
    const evidenceIds: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const source = await EvidenceSource().create({
        project_id: testProjectId,
        source_type: 'uploaded_document',
        label: `Document ${i}`,
        artifact_ref: { extracted_text: `Content of document ${i}` },
        created_by: 'test:user',
      });
      evidenceIds.push((source as unknown as { id: number }).id);

      await DiscoveryRunSource().create({
        discovery_run_id: runId,
        evidence_source_id: evidenceIds[i - 1],
      });
    }

    // Create 3 consumed staging rows
    const stagingIds: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const staging = await ExtractionStaging().create({
        project_id: testProjectId,
        actor_id: testActorId,
        filename: `doc${i}.pdf`,
        mime_type: 'application/pdf',
        file_size_bytes: 1024,
        file_hash: String(i).repeat(64),
        content_hash: String(i + 3).repeat(64),
        extracted_text: `Staging content ${i}`,
        char_count: 17,
        status: 'consumed',
        consumed_by_run_id: runId,
        consumed_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });
      stagingIds.push(staging.get('id') as number);
    }

    // Delete all consumed staging rows (simulating cleanup)
    await ExtractionStaging().destroy({ where: { id: stagingIds } });

    // Verify all evidence sources still exist
    const remainingEvidence = await EvidenceSource().findAll({
      where: { id: evidenceIds },
    });
    expect(remainingEvidence).toHaveLength(3);

    // Verify all run-evidence links still exist
    const remainingLinks = await DiscoveryRunSource().findAll({
      where: { discovery_run_id: runId },
    });
    expect(remainingLinks).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1B: SPLIT VALIDATION AND CONSUMPTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('DISC-WEB-1B: validateRefsForConsumption', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;
  const DiscoveryRun = () => sequelize.models.DiscoveryRun;

  async function createTestRun(): Promise<{ id: number; public_id: string }> {
    const run = await DiscoveryRun().create({
      project_id: testProjectId,
      discovery_type: 'desk_research',
      topic: 'Test topic',
      topic_slug: 'test-topic',
      created_by_identity: 'test:user',
      status: 'pending',
    });
    return {
      id: (run as unknown as { id: number }).id,
      public_id: (run as unknown as { public_id: string }).public_id,
    };
  }

  it('validates ready refs successfully', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'valid.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content for validation test with sufficient characters.',
      char_count: 55,
      status: 'ready',
    });
    const refToken = staging.get('ref_token') as string;

    const t = await sequelize.transaction();
    try {
      const result = await validateRefsForConsumption(
        [refToken],
        testProjectId,
        testActorId,
        t,
      );

      expect(result.success).toBe(true);
      expect(result.validated).toBeDefined();
      expect(result.validated!.validatedIds).toHaveLength(1);
      expect(result.validated!.stagingRows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    } finally {
      await t.rollback();
    }
  });

  it('rejects consumed refs (no token replay)', async () => {
    const run = await createTestRun();

    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'consumed.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content that was already consumed by another run.',
      char_count: 49,
      status: 'consumed',
      consumed_by_run_id: run.id,
      consumed_at: new Date(),
    });
    const refToken = staging.get('ref_token') as string;

    const t = await sequelize.transaction();
    try {
      const result = await validateRefsForConsumption(
        [refToken],
        testProjectId,
        testActorId,
        t,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ refToken, reason: 'consumed' });
    } finally {
      await t.rollback();
    }
  });

  it('rejects wrong project refs', async () => {
    // Create a second project
    const Project = sequelize.models.Project;
    const otherProject = await Project.create({
      name: 'Other Project',
      slug: 'other-project',
      status: 'active',
      created_by: 'U_TEST',
      organization_id: TEST_ORG_ID,
    });
    const otherProjectId = (otherProject as unknown as { id: number }).id;

    const staging = await ExtractionStaging().create({
      project_id: otherProjectId,
      actor_id: testActorId,
      filename: 'other-project.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content belonging to a different project entirely.',
      char_count: 50,
      status: 'ready',
    });
    const refToken = staging.get('ref_token') as string;

    const t = await sequelize.transaction();
    try {
      const result = await validateRefsForConsumption(
        [refToken],
        testProjectId, // Different from staging's project
        testActorId,
        t,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ refToken, reason: 'wrong_project' });
    } finally {
      await t.rollback();
    }
  });

  it('rejects wrong actor refs', async () => {
    // Create a second actor
    const Actor = sequelize.models.Actor;
    const otherActor = await Actor.create({
      display_name: 'Other User',
      status: 'active',
      organization_id: TEST_ORG_ID,
    });
    const otherActorId = (otherActor as unknown as { id: number }).id;

    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'other-actor.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content uploaded by a different actor entirely.',
      char_count: 47,
      status: 'ready',
    });
    const refToken = staging.get('ref_token') as string;

    const t = await sequelize.transaction();
    try {
      const result = await validateRefsForConsumption(
        [refToken],
        testProjectId,
        otherActorId, // Different from staging's actor
        t,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ refToken, reason: 'wrong_actor' });
    } finally {
      await t.rollback();
    }
  });

  it('fails all-or-nothing when any ref is invalid', async () => {
    const validStaging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'valid.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Valid content that should pass validation check.',
      char_count: 48,
      status: 'ready',
    });
    const validToken = validStaging.get('ref_token') as string;

    const invalidStaging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'expired.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'c'.repeat(64),
      content_hash: 'd'.repeat(64),
      extracted_text: 'Expired content that should fail validation check.',
      char_count: 50,
      status: 'expired',
    });
    const expiredToken = invalidStaging.get('ref_token') as string;

    const t = await sequelize.transaction();
    try {
      const result = await validateRefsForConsumption(
        [validToken, expiredToken],
        testProjectId,
        testActorId,
        t,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ refToken: expiredToken, reason: 'expired' });
      // validated should be undefined on failure
      expect(result.validated).toBeUndefined();
    } finally {
      await t.rollback();
    }
  });

  it('rejects expired refs (TTL check)', async () => {
    // Create with both created_at and expires_at in the past
    // expires_at > created_at satisfies CHECK constraint, but both are past
    const pastCreated = new Date(Date.now() - 60000); // 1 minute ago
    const pastExpired = new Date(Date.now() - 30000); // 30 seconds ago (still > created)

    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'ttl-expired.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content with expired TTL should fail validation.',
      char_count: 48,
      status: 'ready',
      created_at: pastCreated,
      expires_at: pastExpired,
    });
    const refToken = staging.get('ref_token') as string;

    const t = await sequelize.transaction();
    try {
      const result = await validateRefsForConsumption(
        [refToken],
        testProjectId,
        testActorId,
        t,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ refToken, reason: 'expired' });
    } finally {
      await t.rollback();
    }
  });

  it('rejects not found refs', async () => {
    const fakeToken = '00000000-0000-0000-0000-000000000000';

    const t = await sequelize.transaction();
    try {
      const result = await validateRefsForConsumption(
        [fakeToken],
        testProjectId,
        testActorId,
        t,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ refToken: fakeToken, reason: 'not_found' });
    } finally {
      await t.rollback();
    }
  });

  it('rejects duplicate ref tokens', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'duplicate-test.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content for duplicate token rejection test case.',
      char_count: 49,
      status: 'ready',
    });
    const refToken = staging.get('ref_token') as string;

    const t = await sequelize.transaction();
    try {
      // Same token twice should fail
      const result = await validateRefsForConsumption(
        [refToken, refToken],
        testProjectId,
        testActorId,
        t,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ refToken, reason: 'duplicate' });
    } finally {
      await t.rollback();
    }
  });
});

describe('DISC-WEB-1B: consumeValidatedRefs', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;
  const DiscoveryRun = () => sequelize.models.DiscoveryRun;

  async function createTestRun(): Promise<{ id: number; public_id: string }> {
    const run = await DiscoveryRun().create({
      project_id: testProjectId,
      discovery_type: 'desk_research',
      topic: 'Test topic',
      topic_slug: 'test-topic',
      created_by_identity: 'test:user',
      status: 'pending',
    });
    return {
      id: (run as unknown as { id: number }).id,
      public_id: (run as unknown as { public_id: string }).public_id,
    };
  }

  it('consumes validated refs atomically', async () => {
    const run = await createTestRun();

    const staging1 = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'file1.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'First file content for atomic consumption test.',
      char_count: 47,
      status: 'ready',
    });

    const staging2 = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'file2.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'c'.repeat(64),
      content_hash: 'd'.repeat(64),
      extracted_text: 'Second file content for atomic consumption test.',
      char_count: 48,
      status: 'ready',
    });

    const refTokens = [
      staging1.get('ref_token') as string,
      staging2.get('ref_token') as string,
    ];

    const t = await sequelize.transaction();
    try {
      const validation = await validateRefsForConsumption(
        refTokens,
        testProjectId,
        testActorId,
        t,
      );

      expect(validation.success).toBe(true);

      const consumed = await consumeValidatedRefs(
        validation.validated!,
        run.id,
        t,
      );

      expect(consumed).toBe(2);
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }

    // Verify status changed to consumed
    const s1 = await ExtractionStaging().findByPk(staging1.get('id') as number);
    const s2 = await ExtractionStaging().findByPk(staging2.get('id') as number);

    expect(s1!.get('status')).toBe('consumed');
    expect(s1!.get('consumed_by_run_id')).toBe(run.id);
    expect(s2!.get('status')).toBe('consumed');
    expect(s2!.get('consumed_by_run_id')).toBe(run.id);
  });

  it('handles empty validated array', async () => {
    const run = await createTestRun();

    const t = await sequelize.transaction();
    try {
      const consumed = await consumeValidatedRefs(
        { validatedIds: [], stagingRows: [] },
        run.id,
        t,
      );

      expect(consumed).toBe(0);
    } finally {
      await t.rollback();
    }
  });

  it('throws on consumption race condition', async () => {
    const run = await createTestRun();

    // Create a staging row that's already expired (simulating a race where
    // another process changed the status between validation and consumption)
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'race.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content for race condition detection test case.',
      char_count: 47,
      status: 'expired', // Already not 'ready'
    });
    const stagingId = staging.get('id') as number;

    // Fabricate a validated object that claims this row is valid
    // This simulates TOCTOU: validation passed but status changed before consumption
    const fakeValidated: ValidatedStagingRefs = {
      validatedIds: [stagingId],
      stagingRows: [], // Empty - we only need IDs for consumption
    };

    const t = await sequelize.transaction();
    try {
      // Attempt consumption should fail because WHERE status='ready' won't match
      await expect(
        consumeValidatedRefs(fakeValidated, run.id, t),
      ).rejects.toThrow(/consumption race/i);
    } finally {
      await t.rollback();
    }
  });
});

describe('DISC-WEB-1B: concurrent consumption with PostgreSQL locking', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;
  const DiscoveryRun = () => sequelize.models.DiscoveryRun;

  async function createTestRun(): Promise<{ id: number; public_id: string }> {
    const run = await DiscoveryRun().create({
      project_id: testProjectId,
      discovery_type: 'desk_research',
      topic: 'Concurrent test',
      topic_slug: 'concurrent-test',
      created_by_identity: 'test:user',
      status: 'pending',
    });
    return {
      id: (run as unknown as { id: number }).id,
      public_id: (run as unknown as { public_id: string }).public_id,
    };
  }

  it('prevents double consumption via sequential transaction commits', async () => {
    // This test verifies that once a ref is consumed by one transaction,
    // a second attempt will see it as 'consumed' and fail validation.
    const run1 = await createTestRun();
    const run2 = await createTestRun();

    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'lock-test.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content for PostgreSQL FOR UPDATE lock testing.',
      char_count: 47,
      status: 'ready',
    });
    const refToken = staging.get('ref_token') as string;

    // First transaction: validate and consume
    const t1 = await sequelize.transaction();
    try {
      const validation1 = await validateRefsForConsumption(
        [refToken],
        testProjectId,
        testActorId,
        t1,
      );
      expect(validation1.success).toBe(true);

      const consumed = await consumeValidatedRefs(validation1.validated!, run1.id, t1);
      expect(consumed).toBe(1);

      await t1.commit();
    } catch (e) {
      await t1.rollback();
      throw e;
    }

    // Verify staging was consumed
    const s = await ExtractionStaging().findByPk(staging.get('id') as number);
    expect(s!.get('status')).toBe('consumed');
    expect(s!.get('consumed_by_run_id')).toBe(run1.id);

    // Second transaction: attempt to validate same ref - should fail
    const t2 = await sequelize.transaction();
    try {
      const validation2 = await validateRefsForConsumption(
        [refToken],
        testProjectId,
        testActorId,
        t2,
      );

      expect(validation2.success).toBe(false);
      expect(validation2.errors).toHaveLength(1);
      expect(validation2.errors[0].reason).toBe('consumed');
    } finally {
      await t2.rollback();
    }
  });
});

describe('extraction staging FK constraints', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;

  it('cascades delete when project is deleted', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'cascade-test.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content that should cascade delete when project deleted.',
      char_count: 56,
      status: 'ready',
    });

    const stagingId = staging.get('id') as number;

    // Delete project
    await sequelize.models.Project.destroy({ where: { id: testProjectId } });

    // Staging should be gone
    const found = await ExtractionStaging().findByPk(stagingId);
    expect(found).toBeNull();
  });

  it('cascades delete when actor is deleted', async () => {
    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'actor-cascade.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content that should cascade delete when actor is deleted.',
      char_count: 57,
      status: 'ready',
    });

    const stagingId = staging.get('id') as number;

    // Delete actor
    await sequelize.models.Actor.destroy({ where: { id: testActorId } });

    // Staging should be gone
    const found = await ExtractionStaging().findByPk(stagingId);
    expect(found).toBeNull();
  });

  it('sets consumed_by_run_id to NULL when run is deleted', async () => {
    // Create a discovery run
    const DiscoveryRun = sequelize.models.DiscoveryRun;
    const run = await DiscoveryRun.create({
      project_id: testProjectId,
      discovery_type: 'desk_research',
      topic: 'Test topic',
      topic_slug: 'test-topic',
      created_by_identity: 'test:user',
      status: 'pending',
    });
    const runId = (run as unknown as { id: number }).id;

    const staging = await ExtractionStaging().create({
      project_id: testProjectId,
      actor_id: testActorId,
      filename: 'run-delete.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      file_hash: 'a'.repeat(64),
      content_hash: 'b'.repeat(64),
      extracted_text: 'Content consumed by run that will be deleted from system.',
      char_count: 57,
      status: 'consumed',
      consumed_by_run_id: runId,
      consumed_at: new Date(),
    });

    const stagingId = staging.get('id') as number;

    // Delete run
    await DiscoveryRun.destroy({ where: { id: runId } });

    // Staging should still exist but with null run ID
    const found = await ExtractionStaging().findByPk(stagingId);
    expect(found).not.toBeNull();
    expect(found!.get('consumed_by_run_id')).toBeNull();
  });
});
