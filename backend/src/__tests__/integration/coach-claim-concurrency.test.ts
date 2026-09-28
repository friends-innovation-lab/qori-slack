/**
 * Coach Claim Concurrency Tests — Ownership Diagnostics
 *
 * Regression tests proving:
 * 1. Fresh claim is protected from Worker B stale recovery
 * 2. Stale claim is recoverable by Worker B after threshold
 * 3. Owner heartbeat succeeds while owning
 * 4. Old owner heartbeat rejected after transfer
 *
 * Uses the SAME DB query paths as production.
 * Does NOT call Anthropic provider.
 */

import { QueryTypes } from 'sequelize';
import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import { COACH_STALE_TIMEOUT_MS, COACH_MAX_ATTEMPTS } from '../../coaching/config';
import type { ApplicationContext } from '../../types/application-context';
import * as coachingService from '../../application/coaching.app-service';

const sequelize = getTestDb();

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

// Test fixtures
let testProjectId: number;
let testStudyId: number;
let testArtifactId: number;
let testActorId: number;

// ─── Test Setup ─────────────────────────────────────────────────────────

beforeEach(async () => {
  await truncateAll();

  const Project = sequelize.models.Project;
  const ResearchStudy = sequelize.models.ResearchStudy;
  const ResearchArtifact = sequelize.models.ResearchArtifact;
  const Actor = sequelize.models.Actor;
  const ProjectMembership = sequelize.models.ProjectMembership;

  // Create test actor
  const actor = await Actor.create({
    display_name: 'Concurrency Test User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;

  // Create project
  const project = await Project.create({
    name: 'Claim Concurrency Test Project',
    slug: 'concurrency-test-project',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  testProjectId = (project as unknown as { id: number }).id;

  // Create project membership (required for authorization)
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
    name: 'Claim Concurrency Test Study',
    slug: 'concurrency-test-study',
    channel_name: '',
    created_by: 'U_TEST',
    researcher_name: 'Test Researcher',
    researcher_email: 'test@example.com',
    path: 'test-project/concurrency-test-study',
  });
  testStudyId = (study as unknown as { id: number }).id;

  // Create artifact (match M2 test pattern)
  const artifact = await ResearchArtifact.create({
    project_id: testProjectId,
    study_id: testStudyId,
    template_id: 'research_plan',
    template_version: 'v1.0',
    artifact_type: 'plan',
    repo: 'test-repo',
    semantic_key: `research_plan:${testStudyId}:study:plan:${Date.now()}`,
    created_by: 'U_TEST',
    content_version: 1,
  });
  testArtifactId = (artifact as unknown as { id: number }).id;
});

afterAll(() => sequelize.close());

/**
 * Create a pending coaching run for testing via app-service.
 */
async function createPendingRun(): Promise<string> {
  const ctx = createTestContext(testActorId);
  const result = await coachingService.createCoachRun(ctx, {
    artifact_id: testArtifactId,
    review_scope: 'artifact',
    selected_section_key: null,
    coaching_contract_version: '1.0.0',
    prompt_template_version: '1.0.0',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  });
  return result.id;
}

// Mirrors claimNextPendingRun from claim-service.ts
async function claimNextPendingRun(workerId: string): Promise<{ claimed: boolean; runId?: string; attemptCount?: number }> {
  const result = await sequelize.query<{ id: string; attempt_count: number }>(
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
      ORDER BY requested_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, attempt_count
    `,
    {
      replacements: { workerId },
      type: QueryTypes.SELECT,
    },
  );

  if (result.length === 0) {
    return { claimed: false };
  }

  return { claimed: true, runId: result[0].id, attemptCount: result[0].attempt_count };
}

// Mirrors recoverStaleRun from claim-service.ts
async function recoverStaleRun(workerId: string): Promise<{ claimed: boolean; runId?: string; attemptCount?: number }> {
  const staleTimeoutSeconds = COACH_STALE_TIMEOUT_MS / 1000;

  // First, fail runs that exceeded max attempts
  await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      status = 'failed',
      failed_at = NOW(),
      failure_code = 'MAX_ATTEMPTS_EXCEEDED',
      failure_diagnostic = 'Run exceeded maximum operational retry attempts'
    WHERE id IN (
      SELECT id
      FROM coaching_runs
      WHERE status = 'running'
        AND heartbeat_at < NOW() - INTERVAL '${staleTimeoutSeconds} seconds'
        AND attempt_count >= :maxAttempts
      FOR UPDATE SKIP LOCKED
    )
    `,
    {
      replacements: { maxAttempts: COACH_MAX_ATTEMPTS },
      type: QueryTypes.UPDATE,
    },
  );

  // Now recover runs that have attempts remaining
  const result = await sequelize.query<{ id: string; attempt_count: number }>(
    `
    UPDATE coaching_runs
    SET
      status = 'running',
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
    RETURNING id, attempt_count
    `,
    {
      replacements: { workerId, maxAttempts: COACH_MAX_ATTEMPTS },
      type: QueryTypes.SELECT,
    },
  );

  if (result.length === 0) {
    return { claimed: false };
  }

  return { claimed: true, runId: result[0].id, attemptCount: result[0].attempt_count };
}

// Mirrors updateHeartbeat from claim-service.ts
async function updateHeartbeat(runId: string, workerId: string): Promise<boolean> {
  const [, affectedCount] = await sequelize.query(
    `
    UPDATE coaching_runs
    SET heartbeat_at = NOW()
    WHERE id = :runId
      AND status = 'running'
      AND worker_id = :workerId
    `,
    {
      replacements: { runId, workerId },
      type: QueryTypes.UPDATE,
    },
  ) as [unknown, number];

  return affectedCount > 0;
}

// Mirrors validateClaimOwnership from claim-service.ts
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
    },
  );

  return parseInt(result[0]?.count ?? '0', 10) > 0;
}

// Helper to set heartbeat to a specific time (for simulating staleness)
async function setHeartbeatTime(runId: string, secondsAgo: number): Promise<void> {
  await sequelize.query(
    `UPDATE coaching_runs SET heartbeat_at = NOW() - INTERVAL '${secondsAgo} seconds' WHERE id = :runId`,
    { replacements: { runId } },
  );
}

// Helper to get run state
async function getRunState(runId: string): Promise<{
  status: string;
  worker_id: string | null;
  attempt_count: number;
  heartbeat_at: Date | null;
}> {
  const [result] = await sequelize.query<{
    status: string;
    worker_id: string | null;
    attempt_count: number;
    heartbeat_at: Date | null;
  }>(
    'SELECT status, worker_id, attempt_count, heartbeat_at FROM coaching_runs WHERE id = :runId',
    { type: QueryTypes.SELECT, replacements: { runId } },
  );
  return result;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('Coach Claim Concurrency', () => {
  const WORKER_A = 'test-worker-A';
  const WORKER_B = 'test-worker-B';
  const staleThresholdSeconds = COACH_STALE_TIMEOUT_MS / 1000;

  describe('Fresh claim protection', () => {
    it('Worker A claims pending run successfully', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      const result = await claimNextPendingRun(WORKER_A);

      expect(result.claimed).toBe(true);
      expect(result.runId).toBe(runId);

      const state = await getRunState(runId);
      expect(state.status).toBe('running');
      expect(state.worker_id).toBe(WORKER_A);
      // createCoachRun sets attempt_count=1, claimNextPendingRun increments to 2
      expect(state.attempt_count).toBe(2);
    });

    it('Worker B stale recovery does NOT recover fresh claim', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      // Verify run is claimed by A with fresh heartbeat
      const stateAfterClaim = await getRunState(runId);
      expect(stateAfterClaim.worker_id).toBe(WORKER_A);
      expect(stateAfterClaim.status).toBe('running');

      // Worker B tries stale recovery immediately (run is fresh)
      const recoveryResult = await recoverStaleRun(WORKER_B);

      // Worker B should NOT recover because heartbeat is fresh
      // Either no run is recovered, or if one is recovered it's not this one
      if (recoveryResult.claimed && recoveryResult.runId) {
        expect(recoveryResult.runId).not.toBe(runId);
      }

      // Verify run is still owned by Worker A
      const stateAfterRecovery = await getRunState(runId);
      expect(stateAfterRecovery.worker_id).toBe(WORKER_A);
      expect(stateAfterRecovery.status).toBe('running');
    });

    it('validateClaimOwnership succeeds for fresh owner', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      // Worker A validates ownership
      const isValid = await validateClaimOwnership(runId, WORKER_A);
      expect(isValid).toBe(true);
    });

    it('validateClaimOwnership fails for non-owner', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      // Worker B tries to validate (should fail)
      const isValid = await validateClaimOwnership(runId, WORKER_B);
      expect(isValid).toBe(false);
    });
  });

  describe('Heartbeat ownership', () => {
    it('owner heartbeat succeeds while owning', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      // Worker A sends heartbeat
      const updated = await updateHeartbeat(runId, WORKER_A);
      expect(updated).toBe(true);
    });

    it('non-owner heartbeat fails', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      // Worker B tries to send heartbeat (should fail)
      const updated = await updateHeartbeat(runId, WORKER_B);
      expect(updated).toBe(false);
    });
  });

  describe('Stale recovery', () => {
    it('Worker B recovers stale claim after threshold', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      const stateBeforeStale = await getRunState(runId);
      expect(stateBeforeStale.worker_id).toBe(WORKER_A);
      // createCoachRun sets attempt_count=1, claimNextPendingRun increments to 2
      expect(stateBeforeStale.attempt_count).toBe(2);

      // Simulate staleness by setting heartbeat to past threshold
      await setHeartbeatTime(runId, staleThresholdSeconds + 10);

      // Worker B recovers stale run
      const recoveryResult = await recoverStaleRun(WORKER_B);

      expect(recoveryResult.claimed).toBe(true);
      expect(recoveryResult.runId).toBe(runId);

      const stateAfterRecovery = await getRunState(runId);
      expect(stateAfterRecovery.worker_id).toBe(WORKER_B);
      // Was 2 after claim, recovery adds 1 → 3
      expect(stateAfterRecovery.attempt_count).toBe(3);
      expect(stateAfterRecovery.status).toBe('running');
    });

    it('old owner heartbeat rejected after ownership transfer', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      // Simulate staleness
      await setHeartbeatTime(runId, staleThresholdSeconds + 10);

      // Worker B recovers
      await recoverStaleRun(WORKER_B);

      // Worker A tries to send heartbeat (should fail - ownership transferred)
      const updated = await updateHeartbeat(runId, WORKER_A);
      expect(updated).toBe(false);

      // Verify ownership is still with Worker B
      const state = await getRunState(runId);
      expect(state.worker_id).toBe(WORKER_B);
    });

    it('old owner validateClaimOwnership fails after transfer', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      // Simulate staleness
      await setHeartbeatTime(runId, staleThresholdSeconds + 10);

      // Worker B recovers
      await recoverStaleRun(WORKER_B);

      // Worker A validates ownership (should fail)
      const isValidA = await validateClaimOwnership(runId, WORKER_A);
      expect(isValidA).toBe(false);

      // Worker B validates ownership (should succeed)
      const isValidB = await validateClaimOwnership(runId, WORKER_B);
      expect(isValidB).toBe(true);
    });
  });

  describe('Max attempts enforcement', () => {
    it('run marked as MAX_ATTEMPTS_EXCEEDED when stale and at limit', async () => {
      const runId = await createPendingRun();

      // Worker A claims (attempt 1)
      await claimNextPendingRun(WORKER_A);

      // Manually set attempt_count to max
      await sequelize.query(
        `UPDATE coaching_runs SET attempt_count = :maxAttempts WHERE id = :runId`,
        { replacements: { runId, maxAttempts: COACH_MAX_ATTEMPTS } },
      );

      // Simulate staleness
      await setHeartbeatTime(runId, staleThresholdSeconds + 10);

      // Worker B tries stale recovery
      const recoveryResult = await recoverStaleRun(WORKER_B);

      // Recovery should either:
      // 1. Not return this run (it was failed, not recovered)
      // 2. Return a different run
      if (recoveryResult.claimed && recoveryResult.runId) {
        expect(recoveryResult.runId).not.toBe(runId);
      }

      // Verify run was failed, not recovered
      const state = await getRunState(runId);
      expect(state.status).toBe('failed');
    });
  });

  describe('Ownership validation query analysis', () => {
    it('validateClaimOwnership does NOT check attempt_count (architectural gap)', async () => {
      const runId = await createPendingRun();

      // Worker A claims
      await claimNextPendingRun(WORKER_A);

      const stateBefore = await getRunState(runId);
      // createCoachRun sets attempt_count=1, claimNextPendingRun increments to 2
      expect(stateBefore.attempt_count).toBe(2);

      // Manually change attempt_count (simulating a recovery that incremented it)
      await sequelize.query(
        `UPDATE coaching_runs SET attempt_count = 5 WHERE id = :runId`,
        { replacements: { runId } },
      );

      // Validate ownership - STILL succeeds because we only check worker_id + status
      // NOTE: This documents current behavior as a potential architectural gap
      // The worker could have stale attempt_count from the model object
      const isValid = await validateClaimOwnership(runId, WORKER_A);
      expect(isValid).toBe(true);

      // Document this as expected current behavior
      // The validation query is: id + status='running' + worker_id
      // It does NOT include attempt_count
    });
  });
});

describe('Timestamp semantics verification', () => {
  it('stale cutoff computed entirely in PostgreSQL using NOW()', async () => {
    // This test verifies that the stale cutoff uses database time, not application time
    const runId = await createPendingRun();

    // Claim the run
    await sequelize.query(
      `UPDATE coaching_runs
       SET status = 'running', worker_id = 'timestamp-test', heartbeat_at = NOW(), claimed_at = NOW()
       WHERE id = :runId`,
      { replacements: { runId } },
    );

    // Get the heartbeat time from DB
    const [heartbeatResult] = await sequelize.query<{ heartbeat_at: Date; db_now: Date }>(
      `SELECT heartbeat_at, NOW() as db_now FROM coaching_runs WHERE id = :runId`,
      { type: QueryTypes.SELECT, replacements: { runId } },
    );

    // Both timestamps should be close (within seconds) since heartbeat_at is set via NOW()
    const heartbeatMs = heartbeatResult.heartbeat_at.getTime();
    const dbNowMs = heartbeatResult.db_now.getTime();
    const diffMs = Math.abs(dbNowMs - heartbeatMs);

    // They should be within 5 seconds of each other
    expect(diffMs).toBeLessThan(5000);

    // Verify column type is TIMESTAMPTZ
    const [columnInfo] = await sequelize.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'coaching_runs' AND column_name = 'heartbeat_at'`,
      { type: QueryTypes.SELECT },
    );
    expect(columnInfo.data_type).toBe('timestamp with time zone');
  });

  it('stale recovery SQL uses database interval arithmetic', async () => {
    const runId = await createPendingRun();
    const staleThresholdSeconds = COACH_STALE_TIMEOUT_MS / 1000;

    // Claim and make stale
    await sequelize.query(
      `UPDATE coaching_runs
       SET status = 'running', worker_id = 'interval-test', heartbeat_at = NOW(), claimed_at = NOW()
       WHERE id = :runId`,
      { replacements: { runId } },
    );

    await sequelize.query(
      `UPDATE coaching_runs SET heartbeat_at = NOW() - INTERVAL '${staleThresholdSeconds + 10} seconds' WHERE id = :runId`,
      { replacements: { runId } },
    );

    // Query using the same logic as recoverStaleRun
    const [candidate] = await sequelize.query<{
      id: string;
      age_seconds: string;
      is_stale: boolean;
    }>(
      `SELECT
        id,
        EXTRACT(EPOCH FROM (NOW() - heartbeat_at)) as age_seconds,
        heartbeat_at < NOW() - INTERVAL '${staleThresholdSeconds} seconds' as is_stale
       FROM coaching_runs
       WHERE id = :runId`,
      { type: QueryTypes.SELECT, replacements: { runId } },
    );

    // Run should be marked as stale
    expect(candidate.is_stale).toBe(true);
    expect(parseFloat(candidate.age_seconds)).toBeGreaterThan(staleThresholdSeconds);
  });
});

// Helper to create a pending run with a specific ID for cross-test isolation
async function createPendingRunForTest(): Promise<string> {
  return createPendingRun();
}
