/**
 * Discovery Claim Service Integration Tests — DISC-2
 *
 * Tests atomic claiming, stale recovery, heartbeat, and completion.
 * Covers worker concurrency scenarios.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { EvidenceSource } from '../../database/models/evidence_source';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import * as runService from '../../services/discovery-run.service';
import * as claimService from '../../services/discovery-claim.service';

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

let projectId: number;
let sourceId: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-2 Claim Test',
    slug: 'disc2-claim-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as any).id;

  const source = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document',
    created_by: 'U_TEST',
    metadata: { extracted_text: 'Test content for worker access' },
  } as CreationAttributes<EvidenceSource>);
  sourceId = (source as any).id;
}

async function createPendingRun(topic: string = 'Test'): Promise<DiscoveryRun> {
  const run = await runService.createDiscoveryRun({
    projectId,
    discoveryType: 'desk_research',
    topic,
    topicSlug: topic.toLowerCase().replace(/\s+/g, '-'),
    sourceIntent: null,
    actorId: null,
    createdByIdentity: 'test:worker',
  });
  return run;
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

// ═══════════════════════════════════════════════════════════════════════════
// 1. CLAIM NEXT PENDING RUN
// ═══════════════════════════════════════════════════════════════════════════

describe('claimNextPendingRun', () => {
  it('claims a pending run and sets worker fields', async () => {
    const run = await createPendingRun('Claim Test');

    const claimed = await claimService.claimNextPendingRun('worker-1');

    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(run.id);
    expect(claimed!.status).toBe('processing');
    expect(claimed!.worker_id).toBe('worker-1');
    expect(claimed!.claimed_at).not.toBeNull();
    expect(claimed!.heartbeat_at).not.toBeNull();
    expect(claimed!.started_at).not.toBeNull();
  });

  it('returns null when no pending runs exist', async () => {
    const claimed = await claimService.claimNextPendingRun('worker-1');
    expect(claimed).toBeNull();
  });

  it('claims oldest pending run first (FIFO)', async () => {
    const run1 = await createPendingRun('First');
    await new Promise(r => setTimeout(r, 10));
    const run2 = await createPendingRun('Second');

    const claimed = await claimService.claimNextPendingRun('worker-1');

    expect(claimed!.id).toBe(run1.id);
    expect(claimed!.topic).toBe('First');
  });

  it('only claims desk_research and stakeholder_synthesis', async () => {
    // Create a survey run (should NOT be claimed by poller)
    await DiscoveryRunModel.create({
      project_id: projectId,
      discovery_type: 'survey_synthesis',
      topic: 'Survey',
      topic_slug: 'survey',
      status: 'pending',
      attempt_count: 1,
      created_by_identity: 'test:worker',
    } as CreationAttributes<DiscoveryRun>);

    const claimed = await claimService.claimNextPendingRun('worker-1');
    expect(claimed).toBeNull(); // Survey should not be claimed
  });

  it('does not claim already-processing runs', async () => {
    const run = await createPendingRun('Test');
    await runService.startDiscoveryRun(run.id);

    const claimed = await claimService.claimNextPendingRun('worker-1');
    expect(claimed).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CONCURRENT CLAIMS (SKIP LOCKED)
// ═══════════════════════════════════════════════════════════════════════════

describe('concurrent claims', () => {
  it('different workers claim different runs', async () => {
    const run1 = await createPendingRun('Run One');
    const run2 = await createPendingRun('Run Two');

    // Simulate concurrent claims
    const [claim1, claim2] = await Promise.all([
      claimService.claimNextPendingRun('worker-1'),
      claimService.claimNextPendingRun('worker-2'),
    ]);

    // Both should succeed with different runs
    expect(claim1).not.toBeNull();
    expect(claim2).not.toBeNull();
    expect(claim1!.id).not.toBe(claim2!.id);

    // Each run is owned by different worker
    const ids = [claim1!.id, claim2!.id].sort();
    const expectedIds = [run1.id, run2.id].sort();
    expect(ids).toEqual(expectedIds);
  });

  it('second worker gets null when only one run exists', async () => {
    await createPendingRun('Only One');

    const [claim1, claim2] = await Promise.all([
      claimService.claimNextPendingRun('worker-1'),
      claimService.claimNextPendingRun('worker-2'),
    ]);

    // One should succeed, one should be null
    const claims = [claim1, claim2].filter(c => c !== null);
    expect(claims).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. HEARTBEAT
// ═══════════════════════════════════════════════════════════════════════════

describe('updateHeartbeat', () => {
  it('updates heartbeat for owned run', async () => {
    const run = await createPendingRun('Heartbeat Test');
    const claimed = await claimService.claimNextPendingRun('worker-1');
    const initialHeartbeat = claimed!.heartbeat_at;

    await new Promise(r => setTimeout(r, 10));
    await claimService.updateHeartbeat(run.id, 'worker-1');

    const updated = await runService.getDiscoveryRunById(run.id);
    expect(updated!.heartbeat_at!.getTime()).toBeGreaterThan(initialHeartbeat!.getTime());
  });

  it('throws NotOwnerError for unowned run', async () => {
    const run = await createPendingRun('Test');
    await claimService.claimNextPendingRun('worker-1');

    await expect(
      claimService.updateHeartbeat(run.id, 'worker-2'),
    ).rejects.toThrow(claimService.NotOwnerError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. STALE RECOVERY
// ═══════════════════════════════════════════════════════════════════════════

describe('recoverStaleRun', () => {
  it('recovers run with expired heartbeat', async () => {
    const run = await createPendingRun('Stale Test');
    await claimService.claimNextPendingRun('worker-1');

    // Manually expire heartbeat
    await sequelize.query(
      `UPDATE discovery_runs SET heartbeat_at = NOW() - INTERVAL '5 minutes' WHERE id = :runId`,
      { replacements: { runId: run.id } },
    );

    const recovered = await claimService.recoverStaleRun('worker-2');

    expect(recovered).not.toBeNull();
    expect(recovered!.id).toBe(run.id);
    expect(recovered!.worker_id).toBe('worker-2');
    expect(recovered!.attempt_count).toBe(2); // Incremented
  });

  it('does not recover run with fresh heartbeat', async () => {
    const run = await createPendingRun('Fresh Test');
    await claimService.claimNextPendingRun('worker-1');

    // Heartbeat is fresh
    const recovered = await claimService.recoverStaleRun('worker-2');
    expect(recovered).toBeNull();
  });

  it('does not recover run that exceeded max attempts', async () => {
    const run = await createPendingRun('Max Attempts');
    await claimService.claimNextPendingRun('worker-1');

    // Set attempt count to max and expire heartbeat
    await sequelize.query(
      `UPDATE discovery_runs
       SET heartbeat_at = NOW() - INTERVAL '5 minutes', attempt_count = 3
       WHERE id = :runId`,
      { replacements: { runId: run.id } },
    );

    const recovered = await claimService.recoverStaleRun('worker-2');
    expect(recovered).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. FAIL EXCEEDED ATTEMPTS
// ═══════════════════════════════════════════════════════════════════════════

describe('failExceededAttemptRuns', () => {
  it('fails stale runs that exceeded max attempts', async () => {
    const run = await createPendingRun('Exceeded');
    await claimService.claimNextPendingRun('worker-1');

    // Set to max attempts and expire
    await sequelize.query(
      `UPDATE discovery_runs
       SET heartbeat_at = NOW() - INTERVAL '5 minutes', attempt_count = 3
       WHERE id = :runId`,
      { replacements: { runId: run.id } },
    );

    const count = await claimService.failExceededAttemptRuns('recovery-worker');
    expect(count).toBe(1);

    const failed = await runService.getDiscoveryRunById(run.id);
    expect(failed!.status).toBe('failed');
    expect(failed!.failure_code).toBe('MAX_ATTEMPTS_EXCEEDED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. COMPLETE RUN
// ═══════════════════════════════════════════════════════════════════════════

describe('completeRun', () => {
  it('completes a run owned by the worker', async () => {
    const run = await createPendingRun('Complete Test');
    await claimService.claimNextPendingRun('worker-1');

    const completed = await claimService.completeRun(run.id, 'worker-1');

    expect(completed.status).toBe('completed');
    expect(completed.completed_at).not.toBeNull();
  });

  it('throws NotOwnerError when wrong worker tries to complete', async () => {
    const run = await createPendingRun('Test');
    await claimService.claimNextPendingRun('worker-1');

    await expect(
      claimService.completeRun(run.id, 'worker-2'),
    ).rejects.toThrow(claimService.NotOwnerError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. FAIL RUN
// ═══════════════════════════════════════════════════════════════════════════

describe('failRun', () => {
  it('fails a run with error details', async () => {
    const run = await createPendingRun('Fail Test');
    await claimService.claimNextPendingRun('worker-1');

    const failed = await claimService.failRun(
      run.id,
      'worker-1',
      'GENERATION_ERROR',
      'Template processing failed',
      'yaml_processing',
    );

    expect(failed.status).toBe('failed');
    expect(failed.failure_code).toBe('GENERATION_ERROR');
    expect(failed.failure_message).toBe('Template processing failed');
    expect(failed.failure_stage).toBe('yaml_processing');
    expect(failed.completed_at).not.toBeNull();
  });

  it('sanitizes PII from failure message', async () => {
    const run = await createPendingRun('PII Test');
    await claimService.claimNextPendingRun('worker-1');

    const failed = await claimService.failRun(
      run.id,
      'worker-1',
      'ERROR',
      'Error for user test@example.com with phone 555-123-4567',
    );

    expect(failed.failure_message).toContain('[EMAIL]');
    expect(failed.failure_message).toContain('[PHONE]');
    expect(failed.failure_message).not.toContain('test@example.com');
    expect(failed.failure_message).not.toContain('555-123-4567');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. RELEASE CLAIM
// ═══════════════════════════════════════════════════════════════════════════

describe('releaseClaim', () => {
  it('releases claim and resets to pending', async () => {
    const run = await createPendingRun('Release Test');
    await claimService.claimNextPendingRun('worker-1');

    const released = await claimService.releaseClaim(run.id, 'worker-1');
    expect(released).toBe(true);

    const reset = await runService.getDiscoveryRunById(run.id);
    expect(reset!.status).toBe('pending');
    expect(reset!.worker_id).toBeNull();
    expect(reset!.claimed_at).toBeNull();
    expect(reset!.heartbeat_at).toBeNull();
  });

  it('returns false when releasing unowned run', async () => {
    const run = await createPendingRun('Test');
    await claimService.claimNextPendingRun('worker-1');

    const released = await claimService.releaseClaim(run.id, 'worker-2');
    expect(released).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. CLAIM OWNERSHIP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('validateClaimOwnership', () => {
  it('returns true for valid owner', async () => {
    const run = await createPendingRun('Test');
    await claimService.claimNextPendingRun('worker-1');

    const valid = await claimService.validateClaimOwnership(run.id, 'worker-1');
    expect(valid).toBe(true);
  });

  it('returns false for wrong worker', async () => {
    const run = await createPendingRun('Test');
    await claimService.claimNextPendingRun('worker-1');

    const valid = await claimService.validateClaimOwnership(run.id, 'worker-2');
    expect(valid).toBe(false);
  });

  it('returns false for completed run', async () => {
    const run = await createPendingRun('Test');
    await claimService.claimNextPendingRun('worker-1');
    await claimService.completeRun(run.id, 'worker-1');

    const valid = await claimService.validateClaimOwnership(run.id, 'worker-1');
    expect(valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

describe('query helpers', () => {
  it('countPendingRuns returns correct count', async () => {
    expect(await claimService.countPendingRuns()).toBe(0);

    await createPendingRun('One');
    await createPendingRun('Two');

    expect(await claimService.countPendingRuns()).toBe(2);
  });

  it('countProcessingRuns returns correct count', async () => {
    expect(await claimService.countProcessingRuns()).toBe(0);

    await createPendingRun('One');
    await createPendingRun('Two');
    await claimService.claimNextPendingRun('worker-1');

    expect(await claimService.countProcessingRuns()).toBe(1);
  });
});
