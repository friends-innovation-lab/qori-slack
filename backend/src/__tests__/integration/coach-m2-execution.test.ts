/**
 * Coach M2: Execution Engine Integration Tests
 *
 * Tests for:
 * - Claiming: SKIP LOCKED, worker_id assignment, attempt_count
 * - Stale recovery: heartbeat timeout, claim reassignment
 * - Heartbeat/ownership: validation, concurrent workers
 * - Output validation: schema enforcement
 * - Exactly-once: ownership verification before persistence
 * - Canonical isolation: no artifact/comment mutations
 *
 * Note: These tests use raw SQL against the testDb to avoid sequelize instance
 * mismatches between the app-service layer and the test database.
 */

import { QueryTypes } from 'sequelize';
import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { ApplicationContext } from '../../types/application-context';
import * as coachingService from '../../application/coaching.app-service';
import { validateCoachOutput } from '../../coaching/output-validator';
import { getActiveContract } from '../../coaching/contracts/registry';
import {
  COACH_STALE_TIMEOUT_MS,
  COACH_MAX_ATTEMPTS,
  generateWorkerId,
} from '../../coaching/config';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testStudyId: number;
let testArtifactId: number;
let testActorId: number;

/**
 * Create a minimal ApplicationContext for testing.
 */
function createTestContext(actorId: number): ApplicationContext {
  return {
    actor: {
      id: actorId,
      publicId: `actor-${actorId}`,
      organizationId: TEST_ORG_ID,
      displayName: `Test Actor ${actorId}`,
    },
    organization: {
      id: TEST_ORG_ID,
      publicId: 'test-org',
      slug: 'test-org',
      name: 'Test Organization',
    },
    authenticationProvider: 'local_test',
    correlationId: `test-${Date.now()}`,
  };
}

/**
 * Create a pending coaching run for testing.
 */
async function createPendingRun(): Promise<{ id: string }> {
  const ctx = createTestContext(testActorId);
  return coachingService.createCoachRun(ctx, {
    artifact_id: testArtifactId,
    review_scope: 'artifact',
    selected_section_key: null,
    coaching_contract_version: '1.0.0',
    prompt_template_version: '1.0.0',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  });
}

/**
 * Claim the next pending run using raw SQL (mirrors claim-service logic).
 */
async function claimNextPendingRun(workerId: string): Promise<{ claimed: boolean; runId?: string }> {
  const result = await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      status = 'running',
      claimed_at = NOW(),
      heartbeat_at = NOW(),
      started_at = COALESCE(started_at, NOW()),
      worker_id = :workerId,
      attempt_count = attempt_count + 1,
      last_attempt_at = NOW()
    WHERE id = (
      SELECT id
      FROM coaching_runs
      WHERE status = 'pending'
        AND attempt_count < :maxAttempts
      ORDER BY requested_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
    `,
    {
      replacements: { workerId, maxAttempts: COACH_MAX_ATTEMPTS },
    }
  );

  // Result is [rows, metadata] for raw queries
  const rows = (result[0] || []) as Array<{ id: string }>;
  if (rows.length === 0) {
    return { claimed: false };
  }

  return { claimed: true, runId: rows[0].id };
}

/**
 * Recover a stale running run using raw SQL.
 */
async function recoverStaleRun(workerId: string): Promise<{ claimed: boolean; runId?: string }> {
  const staleTimeoutSeconds = COACH_STALE_TIMEOUT_MS / 1000;

  const result = await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      claimed_at = NOW(),
      heartbeat_at = NOW(),
      worker_id = :workerId,
      attempt_count = attempt_count + 1,
      last_attempt_at = NOW()
    WHERE id = (
      SELECT id
      FROM coaching_runs
      WHERE status = 'running'
        AND heartbeat_at < NOW() - INTERVAL '${staleTimeoutSeconds} seconds'
        AND attempt_count < :maxAttempts
      ORDER BY heartbeat_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
    `,
    {
      replacements: { workerId, maxAttempts: COACH_MAX_ATTEMPTS },
    }
  );

  // Result is [rows, metadata] for raw queries
  const rows = (result[0] || []) as Array<{ id: string }>;
  if (rows.length === 0) {
    return { claimed: false };
  }

  return { claimed: true, runId: rows[0].id };
}

/**
 * Mark run as completed with ownership check.
 */
async function markCompleted(runId: string, workerId: string): Promise<boolean> {
  const [, metadata] = await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE id = :runId
      AND status = 'running'
      AND worker_id = :workerId
    `,
    {
      replacements: { runId, workerId },
    }
  );

  // For PostgreSQL UPDATE queries, metadata.rowCount contains affected rows
  const rowCount = (metadata as { rowCount?: number })?.rowCount ?? 0;
  return rowCount > 0;
}

/**
 * Mark run as failed with ownership check.
 */
async function markFailed(
  runId: string,
  workerId: string,
  failureCode: string,
  diagnostic: string
): Promise<boolean> {
  const [, metadata] = await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      status = 'failed',
      failed_at = NOW(),
      failure_code = :failureCode,
      failure_diagnostic = :diagnostic
    WHERE id = :runId
      AND status = 'running'
      AND worker_id = :workerId
    `,
    {
      replacements: { runId, workerId, failureCode, diagnostic },
    }
  );

  const rowCount = (metadata as { rowCount?: number })?.rowCount ?? 0;
  return rowCount > 0;
}

/**
 * Update heartbeat for a running run.
 */
async function updateHeartbeat(runId: string, workerId: string): Promise<boolean> {
  const [, metadata] = await sequelize.query(
    `
    UPDATE coaching_runs
    SET heartbeat_at = NOW()
    WHERE id = :runId
      AND status = 'running'
      AND worker_id = :workerId
    `,
    {
      replacements: { runId, workerId },
    }
  );

  const rowCount = (metadata as { rowCount?: number })?.rowCount ?? 0;
  return rowCount > 0;
}

/**
 * Validate claim ownership.
 */
async function validateClaimOwnership(runId: string, workerId: string): Promise<boolean> {
  const result = await sequelize.query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM coaching_runs
    WHERE id = :runId
      AND status = 'running'
      AND worker_id = :workerId
    `,
    {
      replacements: { runId, workerId },
      type: QueryTypes.SELECT,
    }
  );

  const rows = result as Array<{ count: string }>;
  return parseInt(rows[0]?.count ?? '0', 10) > 0;
}

/**
 * Record usage metadata.
 */
async function recordUsage(
  runId: string,
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    estimatedCost?: number;
  }
): Promise<void> {
  await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      input_tokens = COALESCE(:inputTokens, input_tokens),
      output_tokens = COALESCE(:outputTokens, output_tokens),
      total_tokens = COALESCE(:totalTokens, total_tokens),
      latency_ms = COALESCE(:latencyMs, latency_ms),
      estimated_cost = COALESCE(:estimatedCost, estimated_cost)
    WHERE id = :runId
    `,
    {
      replacements: {
        runId,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        totalTokens: usage.totalTokens ?? null,
        latencyMs: usage.latencyMs ?? null,
        estimatedCost: usage.estimatedCost ?? null,
      },
    }
  );
}

beforeEach(async () => {
  await truncateAll();

  const Project = sequelize.models.Project;
  const ResearchStudy = sequelize.models.ResearchStudy;
  const ResearchArtifact = sequelize.models.ResearchArtifact;
  const Actor = sequelize.models.Actor;
  const ProjectMembership = sequelize.models.ProjectMembership;

  // Create test actor
  const actor = await Actor.create({
    display_name: 'Test User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;

  // Create project
  const project = await Project.create({
    name: 'Test Project',
    slug: 'test-project',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  testProjectId = (project as unknown as { id: number }).id;

  // Create project membership
  if (ProjectMembership) {
    await ProjectMembership.create({
      project_id: testProjectId,
      actor_id: testActorId,
      role: 'researcher',
    });
  }

  // Create study
  const study = await ResearchStudy.create({
    project_id: testProjectId,
    name: 'Test Study',
    slug: 'test-study',
    channel_name: '',
    created_by: 'U_TEST',
    researcher_name: 'Test Researcher',
    researcher_email: 'test@example.com',
    path: 'test-project/test-study',
  });
  testStudyId = (study as unknown as { id: number }).id;

  // Create artifact
  const artifact = await ResearchArtifact.create({
    project_id: testProjectId,
    study_id: testStudyId,
    template_id: 'research_brief',
    template_version: 'v7.1',
    artifact_type: 'brief',
    repo: 'test-repo',
    semantic_key: `research_brief:${testStudyId}:study:brief:${Date.now()}`,
    created_by: 'U_TEST',
    content_version: 1,
  });
  testArtifactId = (artifact as unknown as { id: number }).id;
});

afterAll(() => sequelize.close());

// ─── Claiming Tests ─────────────────────────────────────────────────────

describe('claimNextPendingRun', () => {
  it('claims pending run and sets worker_id', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();

    const result = await claimNextPendingRun(workerId);

    expect(result.claimed).toBe(true);
    expect(result.runId).toBe(run.id);

    // Verify worker_id is set
    const [rows] = await sequelize.query(
      `SELECT worker_id, status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ worker_id: string; status: string }>, unknown];

    expect(rows[0].worker_id).toBe(workerId);
    expect(rows[0].status).toBe('running');
  });

  it('sets heartbeat_at on claim', async () => {
    await createPendingRun();
    const workerId = generateWorkerId();

    const before = new Date();
    await claimNextPendingRun(workerId);
    const after = new Date();

    const [rows] = await sequelize.query(
      `SELECT heartbeat_at FROM coaching_runs WHERE worker_id = '${workerId}'`
    ) as [Array<{ heartbeat_at: Date }>, unknown];

    const heartbeatAt = new Date(rows[0].heartbeat_at);
    expect(heartbeatAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(heartbeatAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('returns not claimed when no pending runs', async () => {
    const workerId = generateWorkerId();
    const result = await claimNextPendingRun(workerId);

    expect(result.claimed).toBe(false);
    expect(result.runId).toBeUndefined();
  });

  it('two workers cannot claim the same run', async () => {
    await createPendingRun();

    const worker1 = generateWorkerId();
    const worker2 = generateWorkerId();

    // Both try to claim concurrently
    const [result1, result2] = await Promise.all([
      claimNextPendingRun(worker1),
      claimNextPendingRun(worker2),
    ]);

    // One succeeds, one fails
    const claimed = [result1.claimed, result2.claimed];
    expect(claimed.filter(Boolean).length).toBe(1);
    expect(claimed.filter(c => !c).length).toBe(1);
  });

  it('increments attempt_count on claim', async () => {
    const run = await createPendingRun();

    // Initial attempt_count is 1
    let [rows] = await sequelize.query(
      `SELECT attempt_count FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ attempt_count: number }>, unknown];
    expect(rows[0].attempt_count).toBe(1);

    // Claim increments to 2
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    [rows] = await sequelize.query(
      `SELECT attempt_count FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ attempt_count: number }>, unknown];
    expect(rows[0].attempt_count).toBe(2);
  });

  it('respects max attempts limit', async () => {
    const run = await createPendingRun();

    // Set attempt_count to max (simulating previous failures)
    await sequelize.query(
      `UPDATE coaching_runs SET attempt_count = ${COACH_MAX_ATTEMPTS} WHERE id = '${run.id}'`
    );

    const workerId = generateWorkerId();
    const result = await claimNextPendingRun(workerId);

    // Should not claim run that's at max attempts
    expect(result.claimed).toBe(false);
  });
});

// ─── Stale Recovery Tests ───────────────────────────────────────────────

describe('recoverStaleRun', () => {
  it('recovers stale running run', async () => {
    const run = await createPendingRun();
    const oldWorker = generateWorkerId();
    const newWorker = generateWorkerId();

    // Claim the run with old worker
    await claimNextPendingRun(oldWorker);

    // Set heartbeat_at to past the timeout
    const staleTime = new Date(Date.now() - COACH_STALE_TIMEOUT_MS - 1000);
    await sequelize.query(
      `UPDATE coaching_runs SET heartbeat_at = '${staleTime.toISOString()}' WHERE id = '${run.id}'`
    );

    // New worker recovers stale run
    const result = await recoverStaleRun(newWorker);

    expect(result.claimed).toBe(true);
    expect(result.runId).toBe(run.id);

    // Verify new worker owns it
    const [rows] = await sequelize.query(
      `SELECT worker_id FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ worker_id: string }>, unknown];
    expect(rows[0].worker_id).toBe(newWorker);
  });

  it('does not recover fresh running run', async () => {
    const run = await createPendingRun();
    const worker1 = generateWorkerId();
    const worker2 = generateWorkerId();

    // Claim with worker1 (fresh heartbeat)
    await claimNextPendingRun(worker1);

    // Worker2 tries to recover
    const result = await recoverStaleRun(worker2);

    expect(result.claimed).toBe(false);

    // Worker1 still owns it
    const [rows] = await sequelize.query(
      `SELECT worker_id FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ worker_id: string }>, unknown];
    expect(rows[0].worker_id).toBe(worker1);
  });

  it('increments attempt_count on recovery', async () => {
    const run = await createPendingRun();
    const oldWorker = generateWorkerId();
    const newWorker = generateWorkerId();

    // Claim and let it go stale
    await claimNextPendingRun(oldWorker);

    // Get attempt count after first claim
    let [rows] = await sequelize.query(
      `SELECT attempt_count FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ attempt_count: number }>, unknown];
    const countAfterClaim = rows[0].attempt_count;

    // Make it stale
    const staleTime = new Date(Date.now() - COACH_STALE_TIMEOUT_MS - 1000);
    await sequelize.query(
      `UPDATE coaching_runs SET heartbeat_at = '${staleTime.toISOString()}' WHERE id = '${run.id}'`
    );

    // Recovery
    await recoverStaleRun(newWorker);

    [rows] = await sequelize.query(
      `SELECT attempt_count FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ attempt_count: number }>, unknown];
    expect(rows[0].attempt_count).toBe(countAfterClaim + 1);
  });
});

// ─── Heartbeat and Ownership Tests ──────────────────────────────────────

describe('heartbeat and ownership', () => {
  it('updateHeartbeat refreshes heartbeat_at', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    // Set old heartbeat
    const oldTime = new Date(Date.now() - 60000);
    await sequelize.query(
      `UPDATE coaching_runs SET heartbeat_at = '${oldTime.toISOString()}' WHERE id = '${run.id}'`
    );

    // Update heartbeat
    const before = new Date();
    const updated = await updateHeartbeat(run.id, workerId);
    const after = new Date();

    expect(updated).toBe(true);

    const [rows] = await sequelize.query(
      `SELECT heartbeat_at FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ heartbeat_at: Date }>, unknown];

    const heartbeatAt = new Date(rows[0].heartbeat_at);
    expect(heartbeatAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(heartbeatAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('updateHeartbeat returns false for wrong worker', async () => {
    const run = await createPendingRun();
    const worker1 = generateWorkerId();
    const worker2 = generateWorkerId();

    await claimNextPendingRun(worker1);

    // Wrong worker tries to update - returns false
    const updated = await updateHeartbeat(run.id, worker2);
    expect(updated).toBe(false);
  });

  it('validateClaimOwnership returns true for correct worker', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const owns = await validateClaimOwnership(run.id, workerId);
    expect(owns).toBe(true);
  });

  it('validateClaimOwnership returns false for wrong worker', async () => {
    const run = await createPendingRun();
    const worker1 = generateWorkerId();
    const worker2 = generateWorkerId();

    await claimNextPendingRun(worker1);

    const owns = await validateClaimOwnership(run.id, worker2);
    expect(owns).toBe(false);
  });

  it('validateClaimOwnership returns false for completed run', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);
    await markCompleted(run.id, workerId);

    const owns = await validateClaimOwnership(run.id, workerId);
    expect(owns).toBe(false);
  });
});

// ─── Mark Completed/Failed Tests ────────────────────────────────────────

describe('markCompleted', () => {
  it('marks run as completed with ownership check', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const completed = await markCompleted(run.id, workerId);
    expect(completed).toBe(true);

    const [rows] = await sequelize.query(
      `SELECT status, completed_at FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string; completed_at: Date }>, unknown];

    expect(rows[0].status).toBe('completed');
    expect(rows[0].completed_at).not.toBeNull();
  });

  it('markCompleted fails for wrong worker', async () => {
    const run = await createPendingRun();
    const worker1 = generateWorkerId();
    const worker2 = generateWorkerId();

    await claimNextPendingRun(worker1);

    const completed = await markCompleted(run.id, worker2);
    expect(completed).toBe(false);

    // Run is still running
    const [rows] = await sequelize.query(
      `SELECT status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string }>, unknown];
    expect(rows[0].status).toBe('running');
  });
});

describe('markFailed', () => {
  it('marks run as failed with failure code and diagnostic', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const failed = await markFailed(
      run.id,
      workerId,
      'PROVIDER_TIMEOUT',
      'Request timed out after 30000ms'
    );
    expect(failed).toBe(true);

    const [rows] = await sequelize.query(
      `SELECT status, failure_code, failure_diagnostic, failed_at
       FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{
      status: string;
      failure_code: string;
      failure_diagnostic: string;
      failed_at: Date;
    }>, unknown];

    expect(rows[0].status).toBe('failed');
    expect(rows[0].failure_code).toBe('PROVIDER_TIMEOUT');
    expect(rows[0].failure_diagnostic).toBe('Request timed out after 30000ms');
    expect(rows[0].failed_at).not.toBeNull();
  });

  it('markFailed fails for wrong worker', async () => {
    const run = await createPendingRun();
    const worker1 = generateWorkerId();
    const worker2 = generateWorkerId();

    await claimNextPendingRun(worker1);

    const failed = await markFailed(run.id, worker2, 'GENERATION_FAILED', 'Test failure');
    expect(failed).toBe(false);
  });
});

// ─── Contract Registry Tests ────────────────────────────────────────────

describe('contract registry', () => {
  it('returns Brief v1 contract', () => {
    const contract = getActiveContract('brief');
    expect(contract).toBeDefined();
    expect(contract!.contractVersion).toBe('1.0.0');
    expect(contract!.artifactType).toBe('brief');
    expect(contract!.rubric.length).toBeGreaterThan(0);
  });

  it('returns Plan v1 contract', () => {
    const contract = getActiveContract('plan');
    expect(contract).toBeDefined();
    expect(contract!.contractVersion).toBe('1.0.0');
    expect(contract!.artifactType).toBe('plan');
    expect(contract!.rubric.length).toBeGreaterThan(0);
  });

  it('returns null for unsupported artifact type', () => {
    const contract = getActiveContract('unknown-type' as any);
    expect(contract).toBeNull();
  });
});

// ─── Output Validation Tests ────────────────────────────────────────────

describe('output validation', () => {
  const contract = getActiveContract('brief')!;

  it('validates valid output', () => {
    const validOutput = {
      strengths: [
        { text: 'Clear problem statement', references: ['REF-001'] },
      ],
      issues: [
        { text: 'Missing timeline details', references: [] },
      ],
      suggestions: [
        { text: 'Add participant recruitment criteria', references: ['REF-002'] },
      ],
      questions: [],
    };

    const citationHandles = new Map([
      ['REF-001', { handle: 'REF-001', objectType: 'artifact', objectId: 'art-123', objectVersion: 1, sectionKey: 'summary', label: 'Brief Summary' }],
      ['REF-002', { handle: 'REF-002', objectType: 'artifact', objectId: 'art-123', objectVersion: 1, sectionKey: 'methodology', label: 'Brief Methodology' }],
    ]);

    const result = validateCoachOutput(
      JSON.stringify(validOutput),
      contract.outputSchema,
      citationHandles,
      'artifact',
      null
    );

    expect(result.valid).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output!.strengths.length).toBe(1);
    expect(result.output!.issues.length).toBe(1);
    expect(result.output!.suggestions.length).toBe(1);
  });

  it('rejects invalid JSON', () => {
    const result = validateCoachOutput(
      'not valid json',
      contract.outputSchema,
      new Map(),
      'artifact',
      null
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('JSON');
  });

  it('allows empty categories (categories can be missing or empty)', () => {
    // The validator allows categories to be missing or empty - Coach doesn't
    // require filling quotas. This tests the minimum valid output.
    const minimalOutput = {
      strengths: [],
      issues: [],
      suggestions: [],
      questions: [],
    };

    const result = validateCoachOutput(
      JSON.stringify(minimalOutput),
      contract.outputSchema,
      new Map(),
      'artifact',
      null
    );

    expect(result.valid).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('rejects unknown citation handles', () => {
    const outputWithBadRef = {
      strengths: [
        { text: 'Good', references: ['REF-999'] }, // Unknown handle
      ],
      issues: [],
      suggestions: [],
      questions: [],
    };

    const citationHandles = new Map([
      ['REF-001', { handle: 'REF-001', objectType: 'artifact', objectId: 'art-123', objectVersion: 1, sectionKey: null, label: 'Brief' }],
    ]);

    const result = validateCoachOutput(
      JSON.stringify(outputWithBadRef),
      contract.outputSchema,
      citationHandles,
      'artifact',
      null
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('REF-999'))).toBe(true);
  });

  it('rejects items exceeding text length limit', () => {
    const longText = 'x'.repeat(contract.outputSchema.maxItemTextLength + 1);
    const outputWithLongText = {
      strengths: [
        { text: longText, references: [] },
      ],
      issues: [],
      suggestions: [],
      questions: [],
    };

    const result = validateCoachOutput(
      JSON.stringify(outputWithLongText),
      contract.outputSchema,
      new Map(),
      'artifact',
      null
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('text') || e.toLowerCase().includes('length') || e.toLowerCase().includes('character'))).toBe(true);
  });

  it('rejects too many items in a category', () => {
    const tooManyStrengths = Array(contract.outputSchema.maxItemsPerCategory + 1)
      .fill(null)
      .map((_, i) => ({ text: `Strength ${i}`, references: [] }));

    const outputWithTooMany = {
      strengths: tooManyStrengths,
      issues: [],
      suggestions: [],
      questions: [],
    };

    const result = validateCoachOutput(
      JSON.stringify(outputWithTooMany),
      contract.outputSchema,
      new Map(),
      'artifact',
      null
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('exceed') || e.toLowerCase().includes('maximum') || e.toLowerCase().includes('items'))).toBe(true);
  });
});

// ─── Usage Recording Tests ──────────────────────────────────────────────

describe('recordUsage', () => {
  it('records usage metadata on run', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    await recordUsage(run.id, {
      inputTokens: 1500,
      outputTokens: 800,
      totalTokens: 2300,
      latencyMs: 3200,
      estimatedCost: 0.0023,
    });

    const [rows] = await sequelize.query(
      `SELECT input_tokens, output_tokens, total_tokens, latency_ms, estimated_cost
       FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      latency_ms: number;
      estimated_cost: string;
    }>, unknown];

    expect(rows[0].input_tokens).toBe(1500);
    expect(rows[0].output_tokens).toBe(800);
    expect(rows[0].total_tokens).toBe(2300);
    expect(rows[0].latency_ms).toBe(3200);
    expect(parseFloat(rows[0].estimated_cost)).toBeCloseTo(0.0023);
  });
});

// ─── Canonical Isolation Tests ──────────────────────────────────────────

describe('canonical isolation during execution', () => {
  it('claiming does not modify artifact', async () => {
    const ResearchArtifact = sequelize.models.ResearchArtifact;

    // Get initial artifact state
    const initialArtifact = await ResearchArtifact.findByPk(testArtifactId) as unknown as {
      content_version: number;
    };

    await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    // Artifact unchanged
    const finalArtifact = await ResearchArtifact.findByPk(testArtifactId) as unknown as {
      content_version: number;
    };

    expect(finalArtifact.content_version).toBe(initialArtifact.content_version);
  });

  it('completion does not modify artifact', async () => {
    const ResearchArtifact = sequelize.models.ResearchArtifact;

    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    // Get artifact state after claim
    const beforeComplete = await ResearchArtifact.findByPk(testArtifactId) as unknown as {
      content_version: number;
    };

    await markCompleted(run.id, workerId);

    // Artifact unchanged after completion
    const afterComplete = await ResearchArtifact.findByPk(testArtifactId) as unknown as {
      content_version: number;
    };

    expect(afterComplete.content_version).toBe(beforeComplete.content_version);
  });

  it('failure does not modify artifact', async () => {
    const ResearchArtifact = sequelize.models.ResearchArtifact;

    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const beforeFail = await ResearchArtifact.findByPk(testArtifactId) as unknown as {
      content_version: number;
    };

    await markFailed(run.id, workerId, 'GENERATION_FAILED', 'Test failure');

    const afterFail = await ResearchArtifact.findByPk(testArtifactId) as unknown as {
      content_version: number;
    };

    expect(afterFail.content_version).toBe(beforeFail.content_version);
  });

  it('execution does not create comment threads', async () => {
    const CommentThread = sequelize.models.CommentThread;

    const run = await createPendingRun();
    const workerId = generateWorkerId();

    const beforeCount = await CommentThread.count({ where: { artifact_id: testArtifactId } });

    await claimNextPendingRun(workerId);
    await markCompleted(run.id, workerId);

    const afterCount = await CommentThread.count({ where: { artifact_id: testArtifactId } });

    expect(afterCount).toBe(beforeCount);
  });
});

// ─── Exactly-Once Semantics Tests ───────────────────────────────────────

describe('exactly-once semantics', () => {
  it('cannot complete already-completed run', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    // Complete once
    const first = await markCompleted(run.id, workerId);
    expect(first).toBe(true);

    // Second complete fails
    const second = await markCompleted(run.id, workerId);
    expect(second).toBe(false);
  });

  it('late worker cannot overwrite result', async () => {
    const run = await createPendingRun();
    const worker1 = generateWorkerId();
    const worker2 = generateWorkerId();

    // Worker1 claims
    await claimNextPendingRun(worker1);

    // Simulate worker1 losing claim to worker2 (via stale recovery)
    const staleTime = new Date(Date.now() - COACH_STALE_TIMEOUT_MS - 1000);
    await sequelize.query(
      `UPDATE coaching_runs SET heartbeat_at = '${staleTime.toISOString()}' WHERE id = '${run.id}'`
    );
    await recoverStaleRun(worker2);

    // Worker2 completes
    const completed = await markCompleted(run.id, worker2);
    expect(completed).toBe(true);

    // Late worker1 tries to complete — should fail
    const lateComplete = await markCompleted(run.id, worker1);
    expect(lateComplete).toBe(false);

    // Run is still completed (by worker2)
    const [rows] = await sequelize.query(
      `SELECT status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string }>, unknown];
    expect(rows[0].status).toBe('completed');
  });

  it('failed run cannot be marked completed', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    // Fail first
    await markFailed(run.id, workerId, 'GENERATION_FAILED', 'Test failure');

    // Cannot complete
    const completed = await markCompleted(run.id, workerId);
    expect(completed).toBe(false);

    const [rows] = await sequelize.query(
      `SELECT status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string }>, unknown];
    expect(rows[0].status).toBe('failed');
  });
});

// ─── Worker ID Generation Tests ─────────────────────────────────────────

describe('worker ID generation', () => {
  it('generates unique worker IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateWorkerId());
    }
    expect(ids.size).toBe(100);
  });

  it('worker ID has expected format', () => {
    const id = generateWorkerId();
    // Format: coach-worker-{base36 timestamp}-{6 char random}
    expect(id).toMatch(/^coach-worker-[a-z0-9]+-[a-z0-9]{6}$/);
  });
});
