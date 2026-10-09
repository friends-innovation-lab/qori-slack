/**
 * Discovery Prepared Content Cleanup Tests — DISC-2
 *
 * Tests that temporary extracted_text is properly purged after terminal run outcomes
 * while preserving durable EvidenceSource metadata.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { EvidenceSource } from '../../database/models/evidence_source';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import * as runService from '../../services/discovery-run.service';
import * as claimService from '../../services/discovery-claim.service';
import * as evidenceService from '../../services/evidence-source.service';

const sequelize = getTestDb();

// Mock GitHub to prevent API calls
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockResolvedValue(null),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ success: true }),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
}));

const ProjectModel = sequelize.models.Project;
const EvidenceSourceModel = sequelize.models.EvidenceSource;
const DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;
const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;

let projectId: number;

const SECRET_TEXT = 'SECRET PREPARED CONTENT THAT SHOULD BE PURGED';

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-2 Cleanup Test',
    slug: 'disc2-cleanup-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as any).id;
}

async function createRunWithSource(
  topic: string = 'Test',
  extractedText: string = SECRET_TEXT,
): Promise<{ run: DiscoveryRun; sourceId: number }> {
  const run = await runService.createDiscoveryRun({
    projectId,
    discoveryType: 'desk_research',
    topic,
    topicSlug: topic.toLowerCase().replace(/\s+/g, '-'),
    sourceIntent: null,
    actorId: null,
    createdByIdentity: 'test:cleanup',
  });

  const source = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document',
    artifact_ref: {
      filename: 'test.pdf',
      content_hash: 'abc123',
      mime_type: 'application/pdf',
      size_bytes: 1000,
    },
    metadata: {
      extracted_text: extractedText,
      content_length: extractedText.length,
      upload_source: 'rest',
      other_durable_field: 'should_remain',
    },
    created_by: 'test:cleanup',
  } as CreationAttributes<EvidenceSource>);

  await runService.associateSources({
    runId: run.id,
    sourceIds: [(source as any).id],
  });

  return { run, sourceId: (source as any).id };
}

async function getSourceMetadata(sourceId: number): Promise<Record<string, unknown> | null> {
  const source = await EvidenceSourceModel.findByPk(sourceId) as EvidenceSource | null;
  return source?.metadata as Record<string, unknown> | null;
}

async function hasExtractedText(sourceId: number): Promise<boolean> {
  const metadata = await getSourceMetadata(sourceId);
  return metadata?.extracted_text !== undefined;
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

// ═══════════════════════════════════════════════════════════════════════════
// A. SUCCESSFUL COMPLETION
// ═══════════════════════════════════════════════════════════════════════════

describe('successful run cleanup', () => {
  it('purges extracted_text after completion', async () => {
    const { run, sourceId } = await createRunWithSource('Success Test');

    // Claim and process
    const claimed = await claimService.claimNextPendingRun('worker-1');
    expect(claimed).not.toBeNull();

    // Verify extracted_text exists while processing
    expect(await hasExtractedText(sourceId)).toBe(true);

    // Complete the run
    await claimService.completeRun(run.id, 'worker-1');

    // Verify extracted_text is purged
    expect(await hasExtractedText(sourceId)).toBe(false);
  });

  it('preserves durable EvidenceSource metadata after completion', async () => {
    const { run, sourceId } = await createRunWithSource('Durable Test');

    await claimService.claimNextPendingRun('worker-1');
    await claimService.completeRun(run.id, 'worker-1');

    const metadata = await getSourceMetadata(sourceId);

    // extracted_text should be gone
    expect(metadata?.extracted_text).toBeUndefined();

    // Other metadata should remain
    expect(metadata?.content_length).toBeDefined();
    expect(metadata?.upload_source).toBe('rest');
    expect(metadata?.other_durable_field).toBe('should_remain');
  });

  it('preserves EvidenceSource row after completion', async () => {
    const { run, sourceId } = await createRunWithSource('Row Preservation');

    await claimService.claimNextPendingRun('worker-1');
    await claimService.completeRun(run.id, 'worker-1');

    const source = await EvidenceSourceModel.findByPk(sourceId);
    expect(source).not.toBeNull();
    expect((source as any).label).toBe('Test Document');
    expect((source as any).artifact_ref).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. PRIVACY VIOLATION FAILURE
// ═══════════════════════════════════════════════════════════════════════════

describe('privacy violation cleanup', () => {
  it('purges extracted_text after privacy failure', async () => {
    const { run, sourceId } = await createRunWithSource('Privacy Test');

    await claimService.claimNextPendingRun('worker-1');

    // Fail with privacy violation
    await claimService.failRun(
      run.id,
      'worker-1',
      'PRIVACY_VIOLATION',
      'PII detected in documents',
      'privacy_scan',
    );

    // Verify extracted_text is purged
    expect(await hasExtractedText(sourceId)).toBe(false);
  });

  it('preserves EvidenceSource for provenance after privacy failure', async () => {
    const { run, sourceId } = await createRunWithSource('Privacy Provenance');

    await claimService.claimNextPendingRun('worker-1');
    await claimService.failRun(run.id, 'worker-1', 'PRIVACY_VIOLATION', 'PII detected');

    const source = await EvidenceSourceModel.findByPk(sourceId);
    expect(source).not.toBeNull();
    expect((source as any).label).toBe('Test Document');
    expect((source as any).artifact_ref?.content_hash).toBe('abc123');
  });

  it('does not copy raw text to failure_message', async () => {
    const secretContent = 'john.doe@example.com is the secret content';
    const { run } = await createRunWithSource('Secret Failure', secretContent);

    await claimService.claimNextPendingRun('worker-1');
    await claimService.failRun(
      run.id,
      'worker-1',
      'PRIVACY_VIOLATION',
      'PII found in uploaded files',
    );

    const failedRun = await runService.getDiscoveryRunById(run.id);
    expect(failedRun!.failure_message).not.toContain('john.doe@example.com');
    expect(failedRun!.failure_message).not.toContain(secretContent);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. GENERATION FAILURE
// ═══════════════════════════════════════════════════════════════════════════

describe('generation failure cleanup', () => {
  it('purges extracted_text after generation failure', async () => {
    const { run, sourceId } = await createRunWithSource('Generation Failure');

    await claimService.claimNextPendingRun('worker-1');

    // Fail with generation error
    await claimService.failRun(
      run.id,
      'worker-1',
      'GENERATION_ERROR',
      'Template processing failed',
      'yaml_processing',
    );

    // Verify extracted_text is purged
    expect(await hasExtractedText(sourceId)).toBe(false);
  });

  it('preserves EvidenceSource after generation failure', async () => {
    const { run, sourceId } = await createRunWithSource('Gen Fail Preserve');

    await claimService.claimNextPendingRun('worker-1');
    await claimService.failRun(run.id, 'worker-1', 'GENERATION_ERROR', 'LLM call failed');

    const source = await EvidenceSourceModel.findByPk(sourceId);
    expect(source).not.toBeNull();
  });

  it('records proper failure state', async () => {
    const { run } = await createRunWithSource('Failure State');

    await claimService.claimNextPendingRun('worker-1');
    await claimService.failRun(run.id, 'worker-1', 'GENERATION_ERROR', 'Test failure');

    const failedRun = await runService.getDiscoveryRunById(run.id);
    expect(failedRun!.status).toBe('failed');
    expect(failedRun!.failure_code).toBe('GENERATION_ERROR');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D. CLEANUP IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════

describe('cleanup idempotency', () => {
  it('purging twice does not error', async () => {
    const { run, sourceId } = await createRunWithSource('Idempotent Test');

    await claimService.claimNextPendingRun('worker-1');
    await claimService.completeRun(run.id, 'worker-1');

    // First purge happened in completeRun
    expect(await hasExtractedText(sourceId)).toBe(false);

    // Second purge should not error
    await expect(
      evidenceService.purgePreparedSourceContent(run.id),
    ).resolves.not.toThrow();

    // Metadata should still be intact
    const metadata = await getSourceMetadata(sourceId);
    expect(metadata?.other_durable_field).toBe('should_remain');
  });

  it('purging run with no sources does not error', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'No Sources',
      topicSlug: 'no-sources',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'test:cleanup',
    });

    await expect(
      evidenceService.purgePreparedSourceContent(run.id),
    ).resolves.toEqual({ purgedCount: 0, skippedCount: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E. STALE RECOVERY — NO PURGE
// ═══════════════════════════════════════════════════════════════════════════

describe('stale recovery does not purge', () => {
  it('prepared content remains available after stale recovery', async () => {
    const { run, sourceId } = await createRunWithSource('Stale Recovery');

    // Claim initially
    await claimService.claimNextPendingRun('worker-1');

    // Simulate stale by expiring heartbeat
    await sequelize.query(
      `UPDATE discovery_runs SET heartbeat_at = NOW() - INTERVAL '5 minutes' WHERE id = :runId`,
      { replacements: { runId: run.id } },
    );

    // Verify content still exists
    expect(await hasExtractedText(sourceId)).toBe(true);

    // Recover by another worker
    const recovered = await claimService.recoverStaleRun('worker-2');
    expect(recovered).not.toBeNull();

    // Content should STILL exist for the recovering worker
    expect(await hasExtractedText(sourceId)).toBe(true);
    expect(await evidenceService.hasPreparedSourceContent(run.id)).toBe(true);
  });

  it('releaseClaim does not purge content', async () => {
    const { run, sourceId } = await createRunWithSource('Release Test');

    await claimService.claimNextPendingRun('worker-1');

    // Release claim (graceful shutdown scenario)
    await claimService.releaseClaim(run.id, 'worker-1');

    // Content should still exist
    expect(await hasExtractedText(sourceId)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F. RETRY AFTER TERMINAL PURGE
// ═══════════════════════════════════════════════════════════════════════════

describe('retry after terminal purge', () => {
  it('hasPreparedSourceContent returns false after purge', async () => {
    const { run } = await createRunWithSource('Retry Check');

    await claimService.claimNextPendingRun('worker-1');
    await claimService.completeRun(run.id, 'worker-1');

    // Content should be gone
    expect(await evidenceService.hasPreparedSourceContent(run.id)).toBe(false);
  });

  it('hasPreparedSourceContent returns true before terminal', async () => {
    const { run } = await createRunWithSource('Pre-Terminal');

    await claimService.claimNextPendingRun('worker-1');

    // Still processing
    expect(await evidenceService.hasPreparedSourceContent(run.id)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G. MULTIPLE SOURCE RUN
// ═══════════════════════════════════════════════════════════════════════════

describe('multiple source cleanup', () => {
  it('purges all associated sources on completion', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Multi Source',
      topicSlug: 'multi-source',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'test:cleanup',
    });

    // Create multiple sources
    const sourceIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const source = await EvidenceSourceModel.create({
        project_id: projectId,
        source_type: 'uploaded_document',
        label: `Document ${i}`,
        metadata: {
          extracted_text: `Content for doc ${i}`,
          doc_number: i,
        },
        created_by: 'test:cleanup',
      } as CreationAttributes<EvidenceSource>);
      sourceIds.push((source as any).id);
    }

    await runService.associateSources({
      runId: run.id,
      sourceIds,
    });

    await claimService.claimNextPendingRun('worker-1');
    await claimService.completeRun(run.id, 'worker-1');

    // All sources should have extracted_text purged
    for (const sourceId of sourceIds) {
      expect(await hasExtractedText(sourceId)).toBe(false);

      // But durable metadata should remain
      const metadata = await getSourceMetadata(sourceId);
      expect(metadata?.doc_number).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H. SHARED SOURCE SAFETY
// ═══════════════════════════════════════════════════════════════════════════

describe('shared source safety', () => {
  it('does not purge source used by active run', async () => {
    // Create a source
    const source = await EvidenceSourceModel.create({
      project_id: projectId,
      source_type: 'uploaded_document',
      label: 'Shared Document',
      metadata: {
        extracted_text: 'Shared content',
        shared: true,
      },
      created_by: 'test:cleanup',
    } as CreationAttributes<EvidenceSource>);
    const sourceId = (source as any).id;

    // Create two runs sharing this source
    const run1 = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Run One',
      topicSlug: 'run-one',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'test:cleanup',
    });

    const run2 = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Run Two',
      topicSlug: 'run-two',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'test:cleanup',
    });

    await runService.associateSources({ runId: run1.id, sourceIds: [sourceId] });
    await runService.associateSources({ runId: run2.id, sourceIds: [sourceId] });

    // Claim both runs
    await sequelize.query(
      `UPDATE discovery_runs SET status = 'processing', worker_id = 'w1' WHERE id = :id`,
      { replacements: { id: run1.id } },
    );
    await sequelize.query(
      `UPDATE discovery_runs SET status = 'processing', worker_id = 'w2' WHERE id = :id`,
      { replacements: { id: run2.id } },
    );

    // Complete run1
    await claimService.completeRun(run1.id, 'w1');

    // Source should NOT be purged because run2 is still processing
    expect(await hasExtractedText(sourceId)).toBe(true);

    // Complete run2
    await claimService.completeRun(run2.id, 'w2');

    // NOW source should be purged
    expect(await hasExtractedText(sourceId)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I. MAX ATTEMPTS EXCEEDED CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

describe('max attempts exceeded cleanup', () => {
  it('purges content when run exceeds max attempts', async () => {
    const { run, sourceId } = await createRunWithSource('Max Attempts');

    await claimService.claimNextPendingRun('worker-1');

    // Set to max attempts and expire heartbeat
    await sequelize.query(
      `UPDATE discovery_runs
       SET heartbeat_at = NOW() - INTERVAL '5 minutes', attempt_count = 3
       WHERE id = :runId`,
      { replacements: { runId: run.id } },
    );

    // Verify content still exists
    expect(await hasExtractedText(sourceId)).toBe(true);

    // Fail exceeded attempts
    await claimService.failExceededAttemptRuns('recovery-worker');

    // Content should now be purged
    expect(await hasExtractedText(sourceId)).toBe(false);

    // Run should be failed
    const failedRun = await runService.getDiscoveryRunById(run.id);
    expect(failedRun!.status).toBe('failed');
    expect(failedRun!.failure_code).toBe('MAX_ATTEMPTS_EXCEEDED');
  });
});
