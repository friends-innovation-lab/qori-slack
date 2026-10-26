/**
 * Integration tests for extraction staging service — DISC-WEB-1
 *
 * Tests database operations, lifecycle transitions, and validation.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import type { Transaction } from 'sequelize';

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
