/**
 * Coach Persistence Transaction Tests — Coach M3B Blocker Fix
 *
 * Deterministic integration tests for persistence transaction behavior.
 * Verifies the fix for the false "Claim lost" bug caused by missing
 * QueryTypes.UPDATE in markCompletedInTransaction.
 *
 * Tests:
 * - Persistence alone completes successfully
 * - Concurrent heartbeat during persistence completes successfully
 * - Concurrent Worker B during persistence cannot steal claim
 * - markCompletedInTransaction returns true on success
 *
 * REPRODUCTION OF PRODUCTION FAILURE:
 * Run e99d6bb6-1eee-4436-a86e-67d960fa890e failed with "Claim lost" even though:
 * - Provider succeeded (18.2s)
 * - Validation succeeded (0ms)
 * - PERSISTENCE_STARTED logged
 * - CLAIM_VALIDATION_SUCCEEDED logged
 * - But markCompletedInTransaction returned false
 *
 * ROOT CAUSE: Missing `type: QueryTypes.UPDATE` caused Sequelize to return
 * `[undefined, { rowCount: 1 }]` instead of `[undefined, 1]`. The comparison
 * `{ rowCount: 1 } > 0` evaluated to false, triggering "Claim lost".
 */

import { QueryTypes, Transaction } from 'sequelize';
import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { ApplicationContext } from '../../types/application-context';
import * as coachingService from '../../application/coaching.app-service';
import { generateWorkerId, COACH_STALE_TIMEOUT_MS } from '../../coaching/config';

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
 * Claim the next pending run.
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
      ORDER BY requested_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
    `,
    {
      replacements: { workerId },
    }
  );

  const rows = (result[0] || []) as Array<{ id: string }>;
  if (rows.length === 0) {
    return { claimed: false };
  }

  return { claimed: true, runId: rows[0].id };
}

/**
 * BUGGY VERSION: markCompletedInTransaction WITHOUT QueryTypes.UPDATE
 * This reproduces the exact bug that caused production failure.
 */
async function markCompletedInTransactionBuggy(
  runId: string,
  workerId: string,
  transaction: Transaction,
): Promise<boolean> {
  const [, affectedCount] = await sequelize.query(
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
      transaction,
      // BUG: Missing type: QueryTypes.UPDATE
    }
  ) as [unknown, number];

  return affectedCount > 0;
}

/**
 * FIXED VERSION: markCompletedInTransaction WITH QueryTypes.UPDATE
 * This is the correct implementation after the fix.
 */
async function markCompletedInTransactionFixed(
  runId: string,
  workerId: string,
  transaction: Transaction,
): Promise<boolean> {
  const [, affectedCount] = await sequelize.query(
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
      transaction,
      type: QueryTypes.UPDATE, // FIX: Added QueryTypes.UPDATE
    }
  ) as [unknown, number];

  return affectedCount > 0;
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
 * Simulate persistence writes (context, items, references, usage).
 */
async function simulatePersistenceWrites(
  runId: string,
  transaction: Transaction,
): Promise<void> {
  // Simulate recordCoachRunContext
  await sequelize.query(
    `
    INSERT INTO coaching_run_context (run_id, object_type, object_id, object_version, section_key, context_role, position)
    VALUES (:runId, 'artifact', :runId, 1, NULL, 'primary', 1)
    `,
    {
      replacements: { runId },
      transaction,
    }
  );

  // Simulate recordCoachRunItems
  const [itemRows] = await sequelize.query(
    `
    INSERT INTO coaching_run_items (run_id, category, position, text)
    VALUES (:runId, 'strength', 1, 'Test strength item')
    RETURNING id
    `,
    {
      replacements: { runId },
      transaction,
    }
  ) as [Array<{ id: string }>, unknown];

  const itemId = itemRows[0]?.id;
  if (itemId) {
    // Simulate recordCoachRunReferences
    await sequelize.query(
      `
      INSERT INTO coaching_run_references (item_id, object_type, object_id, section_key, label)
      VALUES (:itemId, 'artifact', :runId, NULL, 'Test reference')
      `,
      {
        replacements: { itemId, runId },
        transaction,
      }
    );
  }

  // Simulate usage UPDATE
  await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      input_tokens = 1000,
      output_tokens = 500,
      total_tokens = 1500,
      latency_ms = 5000,
      estimated_cost = 0.005
    WHERE id = :runId
    `,
    {
      replacements: { runId },
      transaction,
    }
  );
}

/**
 * Full persistence simulation mirroring persistResults() in execution-orchestrator.ts
 */
async function simulateFullPersistence(
  runId: string,
  workerId: string,
  useFixedImplementation: boolean,
): Promise<{ success: boolean }> {
  const transaction = await sequelize.transaction();

  try {
    // Step 1: Validate claim ownership (note: outside transaction in production code too)
    const stillOwns = await validateClaimOwnership(runId, workerId);
    if (!stillOwns) {
      await transaction.rollback();
      return { success: false };
    }

    // Step 2: Persistence writes
    await simulatePersistenceWrites(runId, transaction);

    // Step 3: Mark completed with or without fix
    const completed = useFixedImplementation
      ? await markCompletedInTransactionFixed(runId, workerId, transaction)
      : await markCompletedInTransactionBuggy(runId, workerId, transaction);

    if (!completed) {
      await transaction.rollback();
      return { success: false };
    }

    await transaction.commit();
    return { success: true };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
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

// ─── ROOT CAUSE REPRODUCTION ─────────────────────────────────────────────

describe('ROOT CAUSE: Missing QueryTypes.UPDATE in markCompletedInTransaction', () => {
  it('BUGGY: returns false even when UPDATE succeeds', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const transaction = await sequelize.transaction();

    try {
      // Buggy version should return false even though UPDATE affects 1 row
      const completed = await markCompletedInTransactionBuggy(run.id, workerId, transaction);

      // THIS IS THE BUG: returns false when it should return true
      expect(completed).toBe(false);

      // Verify the UPDATE actually happened (row was affected in transaction)
      const [rows] = await sequelize.query(
        `SELECT status FROM coaching_runs WHERE id = '${run.id}'`,
        { transaction }
      ) as [Array<{ status: string }>, unknown];

      // Row was updated within transaction
      expect(rows[0].status).toBe('completed');

      await transaction.rollback(); // Don't persist this
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  it('FIXED: returns true when UPDATE succeeds', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const transaction = await sequelize.transaction();

    try {
      // Fixed version should return true
      const completed = await markCompletedInTransactionFixed(run.id, workerId, transaction);

      // THIS IS THE FIX: returns true correctly
      expect(completed).toBe(true);

      await transaction.commit();

      // Verify status is completed after commit
      const [rows] = await sequelize.query(
        `SELECT status FROM coaching_runs WHERE id = '${run.id}'`
      ) as [Array<{ status: string }>, unknown];

      expect(rows[0].status).toBe('completed');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });
});

// ─── PERSISTENCE ALONE ───────────────────────────────────────────────────

describe('persistence alone (no concurrent operations)', () => {
  it('BUGGY version fails persistence even with valid claim', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const result = await simulateFullPersistence(run.id, workerId, false);

    // Buggy version fails
    expect(result.success).toBe(false);

    // Run is NOT completed (transaction rolled back)
    const [rows] = await sequelize.query(
      `SELECT status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string }>, unknown];

    expect(rows[0].status).toBe('running');
  });

  it('FIXED version completes persistence successfully', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const result = await simulateFullPersistence(run.id, workerId, true);

    // Fixed version succeeds
    expect(result.success).toBe(true);

    // Run IS completed
    const [rows] = await sequelize.query(
      `SELECT status, completed_at FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string; completed_at: Date }>, unknown];

    expect(rows[0].status).toBe('completed');
    expect(rows[0].completed_at).not.toBeNull();
  });

  it('persistence writes are persisted atomically with completion', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    const result = await simulateFullPersistence(run.id, workerId, true);
    expect(result.success).toBe(true);

    // Verify context was persisted
    const [contextRows] = await sequelize.query(
      `SELECT * FROM coaching_run_context WHERE run_id = '${run.id}'`
    ) as [Array<unknown>, unknown];
    expect(contextRows.length).toBe(1);

    // Verify items were persisted
    const [itemRows] = await sequelize.query(
      `SELECT * FROM coaching_run_items WHERE run_id = '${run.id}'`
    ) as [Array<{ id: string }>, unknown];
    expect(itemRows.length).toBe(1);

    // Verify references were persisted
    const [refRows] = await sequelize.query(
      `SELECT * FROM coaching_run_references WHERE item_id = '${itemRows[0].id}'`
    ) as [Array<unknown>, unknown];
    expect(refRows.length).toBe(1);

    // Verify usage was persisted
    const [usageRows] = await sequelize.query(
      `SELECT input_tokens, output_tokens, total_tokens FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ input_tokens: number; output_tokens: number; total_tokens: number }>, unknown];
    expect(usageRows[0].input_tokens).toBe(1000);
    expect(usageRows[0].output_tokens).toBe(500);
    expect(usageRows[0].total_tokens).toBe(1500);
  });
});

// ─── CONCURRENT HEARTBEAT ────────────────────────────────────────────────

describe('concurrent heartbeat during persistence', () => {
  it('heartbeat and fixed persistence both succeed', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    // Set heartbeat to past so we can verify update
    await sequelize.query(
      `UPDATE coaching_runs SET heartbeat_at = NOW() - INTERVAL '10 seconds' WHERE id = '${run.id}'`
    );

    // Run heartbeat and persistence concurrently
    const [heartbeatResult, persistenceResult] = await Promise.all([
      (async () => {
        // Small delay to simulate timing
        await new Promise(resolve => setTimeout(resolve, 10));
        return updateHeartbeat(run.id, workerId);
      })(),
      simulateFullPersistence(run.id, workerId, true),
    ]);

    // Heartbeat may fail if status changed to completed first, but persistence should succeed
    expect(persistenceResult.success).toBe(true);

    // Run is completed
    const [rows] = await sequelize.query(
      `SELECT status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string }>, unknown];
    expect(rows[0].status).toBe('completed');
  });

  it('heartbeat does not corrupt ownership during persistence', async () => {
    const run = await createPendingRun();
    const workerId = generateWorkerId();
    await claimNextPendingRun(workerId);

    // Multiple concurrent heartbeats during persistence
    const heartbeatPromises = Array(5).fill(null).map(async (_, i) => {
      await new Promise(resolve => setTimeout(resolve, i * 5));
      return updateHeartbeat(run.id, workerId);
    });

    const [persistenceResult] = await Promise.all([
      simulateFullPersistence(run.id, workerId, true),
      ...heartbeatPromises,
    ]);

    expect(persistenceResult.success).toBe(true);

    // Verify worker_id unchanged
    const [rows] = await sequelize.query(
      `SELECT worker_id, status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ worker_id: string; status: string }>, unknown];

    expect(rows[0].worker_id).toBe(workerId);
    expect(rows[0].status).toBe('completed');
  });
});

// ─── CONCURRENT SECOND WORKER ────────────────────────────────────────────

describe('concurrent Worker B during Worker A persistence', () => {
  it('Worker B cannot recover run with fresh heartbeat', async () => {
    const run = await createPendingRun();
    const workerA = generateWorkerId();
    const workerB = generateWorkerId();

    await claimNextPendingRun(workerA);

    // Worker A starts persistence, Worker B tries to recover
    const staleTimeoutSeconds = COACH_STALE_TIMEOUT_MS / 1000;

    const [persistenceResult, recoveryResult] = await Promise.all([
      simulateFullPersistence(run.id, workerA, true),
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        // Worker B attempts stale recovery
        const result = await sequelize.query(
          `
          UPDATE coaching_runs
          SET
            worker_id = :workerId,
            heartbeat_at = NOW(),
            attempt_count = attempt_count + 1
          WHERE id = (
            SELECT id
            FROM coaching_runs
            WHERE id = :runId
              AND status = 'running'
              AND heartbeat_at < NOW() - INTERVAL '${staleTimeoutSeconds} seconds'
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          RETURNING id
          `,
          { replacements: { workerId: workerB, runId: run.id } }
        );
        const rows = (result[0] || []) as Array<{ id: string }>;
        return { recovered: rows.length > 0 };
      })(),
    ]);

    // Worker A succeeds
    expect(persistenceResult.success).toBe(true);

    // Worker B cannot recover (heartbeat is fresh)
    expect(recoveryResult.recovered).toBe(false);

    // Run completed by Worker A
    const [rows] = await sequelize.query(
      `SELECT status, worker_id FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string; worker_id: string }>, unknown];

    expect(rows[0].status).toBe('completed');
    expect(rows[0].worker_id).toBe(workerA);
  });

  it('Worker B poll does not interfere with Worker A persistence', async () => {
    const run = await createPendingRun();
    const workerA = generateWorkerId();
    const workerB = generateWorkerId();

    await claimNextPendingRun(workerA);

    // Multiple Worker B poll attempts during Worker A persistence
    const pollPromises = Array(3).fill(null).map(async (_, i) => {
      await new Promise(resolve => setTimeout(resolve, i * 10));
      // Worker B tries to claim pending (should find none)
      const result = await sequelize.query(
        `
        SELECT id FROM coaching_runs
        WHERE status = 'pending'
        FOR UPDATE SKIP LOCKED
        LIMIT 1
        `
      );
      return { foundPending: (result[0] as Array<unknown>).length > 0 };
    });

    const [persistenceResult, ...pollResults] = await Promise.all([
      simulateFullPersistence(run.id, workerA, true),
      ...pollPromises,
    ]);

    // Worker A succeeds
    expect(persistenceResult.success).toBe(true);

    // Worker B found no pending runs (our run was already running)
    pollResults.forEach(result => {
      expect(result.foundPending).toBe(false);
    });
  });
});

// ─── OWNERSHIP VALIDATION ────────────────────────────────────────────────

describe('ownership validation before persistence', () => {
  it('persistence fails if ownership lost before start', async () => {
    const run = await createPendingRun();
    const workerA = generateWorkerId();
    const workerB = generateWorkerId();

    // Worker A claims
    await claimNextPendingRun(workerA);

    // Simulate Worker B stealing claim (should not happen with fresh heartbeat, but test anyway)
    await sequelize.query(
      `UPDATE coaching_runs SET worker_id = '${workerB}' WHERE id = '${run.id}'`
    );

    // Worker A attempts persistence with stale claim
    const result = await simulateFullPersistence(run.id, workerA, true);

    // Should fail at ownership validation (before any writes)
    expect(result.success).toBe(false);

    // Status still running (no completion by Worker A)
    const [rows] = await sequelize.query(
      `SELECT status, worker_id FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string; worker_id: string }>, unknown];

    expect(rows[0].status).toBe('running');
    expect(rows[0].worker_id).toBe(workerB);
  });
});

// ─── PRODUCTION FAILURE SIMULATION ───────────────────────────────────────

describe('production failure reproduction', () => {
  it('reproduces exact production failure scenario', async () => {
    /**
     * This test reproduces the exact failure from run e99d6bb6-1eee-4436-a86e-67d960fa890e:
     *
     * 1. Worker claims run (attempt 3)
     * 2. Context build succeeds
     * 3. Provider call succeeds (18.2s)
     * 4. Validation succeeds
     * 5. PERSISTENCE_STARTED logged
     * 6. validateClaimOwnership succeeds (CLAIM_VALIDATION_SUCCEEDED)
     * 7. All persistence writes succeed
     * 8. markCompletedInTransaction returns false (BUG)
     * 9. Transaction rolled back
     * 10. "Claim lost" returned
     *
     * The bug was that markCompletedInTransaction used incorrect return type handling.
     */

    const run = await createPendingRun();
    const workerId = generateWorkerId();

    // Simulate 3 attempts (increment to 3)
    await claimNextPendingRun(workerId);
    await sequelize.query(
      `UPDATE coaching_runs SET attempt_count = 3 WHERE id = '${run.id}'`
    );

    // Simulate the buggy persistence path
    const buggyResult = await simulateFullPersistence(run.id, workerId, false);

    // PRODUCTION BUG: Returns false ("Claim lost") even though UPDATE succeeded
    expect(buggyResult.success).toBe(false);

    // Status is still running (transaction rolled back)
    let [rows] = await sequelize.query(
      `SELECT status, attempt_count FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string; attempt_count: number }>, unknown];

    expect(rows[0].status).toBe('running');
    expect(rows[0].attempt_count).toBe(3);

    // NOW TEST THE FIX: Same scenario with fixed implementation
    const fixedResult = await simulateFullPersistence(run.id, workerId, true);

    // FIXED: Returns true correctly
    expect(fixedResult.success).toBe(true);

    // Status is completed
    const [completedRows] = await sequelize.query(
      `SELECT status FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ status: string }>, unknown];

    expect(completedRows[0].status).toBe('completed');
  });
});
