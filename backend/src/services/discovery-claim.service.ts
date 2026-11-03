/**
 * Discovery Claim Service — DISC-2
 *
 * Atomic claim operations for Discovery run execution.
 * Pattern matches Coach claim service for consistency.
 *
 * Uses FOR UPDATE SKIP LOCKED for concurrent worker safety.
 */

import { Op } from 'sequelize';
import sequelize from '../database';
import type { DiscoveryRun } from '../database/models/discovery_run';
import { purgePreparedSourceContent } from './evidence-source.service';

const DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;

// ─── Configuration ─────────────────────────────────────────────────

const DISCOVERY_STALE_TIMEOUT_MS = parseInt(
  process.env.DISCOVERY_STALE_TIMEOUT_MS || '120000',
  10,
);

const DISCOVERY_MAX_ATTEMPTS = parseInt(
  process.env.DISCOVERY_MAX_ATTEMPTS || '3',
  10,
);

// ─── Error Types ───────────────────────────────────────────────────

export class ClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimError';
  }
}

export class NotOwnerError extends Error {
  constructor(runId: number, expectedWorkerId: string) {
    super(`Worker ${expectedWorkerId} is not the owner of run ${runId}`);
    this.name = 'NotOwnerError';
  }
}

export class PreparedContentMissingError extends Error {
  constructor(runId: number) {
    super(`Run ${runId} has no prepared source content - cannot be re-executed`);
    this.name = 'PreparedContentMissingError';
  }
}

// ─── Claim Operations ──────────────────────────────────────────────

/**
 * Atomically claim the next pending Discovery run.
 *
 * Uses FOR UPDATE SKIP LOCKED to prevent duplicate claims.
 * Only claims desk_research and stakeholder_synthesis (not survey).
 *
 * Returns null if no pending runs available.
 */
export async function claimNextPendingRun(
  workerId: string,
): Promise<DiscoveryRun | null> {
  const now = new Date();

  // Use raw query for FOR UPDATE SKIP LOCKED
  const [results] = await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'processing',
      worker_id = :workerId,
      claimed_at = :now,
      heartbeat_at = :now,
      started_at = COALESCE(started_at, :now),
      updated_at = :now
    WHERE id = (
      SELECT id FROM discovery_runs
      WHERE status = 'pending'
        AND discovery_type IN ('desk_research', 'stakeholder_synthesis')
        AND is_controlled = FALSE
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
    `,
    {
      replacements: { workerId, now },
    },
  );

  const rows = results as Array<{ id: number }>;
  if (!rows || rows.length === 0) {
    return null;
  }

  const runId = rows[0]?.id;
  if (!runId) {
    return null;
  }

  return DiscoveryRunModel.findByPk(runId);
}

/**
 * Recover a stale Discovery run (heartbeat too old).
 *
 * A run is stale if:
 * - status = 'processing'
 * - heartbeat_at < now - STALE_TIMEOUT
 * - attempt_count < MAX_ATTEMPTS
 *
 * Returns null if no stale runs available.
 */
export async function recoverStaleRun(
  workerId: string,
): Promise<DiscoveryRun | null> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - DISCOVERY_STALE_TIMEOUT_MS);

  // Use raw query for FOR UPDATE SKIP LOCKED
  const [results] = await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'processing',
      worker_id = :workerId,
      claimed_at = :now,
      heartbeat_at = :now,
      attempt_count = attempt_count + 1,
      updated_at = :now
    WHERE id = (
      SELECT id FROM discovery_runs
      WHERE status = 'processing'
        AND discovery_type IN ('desk_research', 'stakeholder_synthesis')
        AND heartbeat_at < :staleThreshold
        AND attempt_count < :maxAttempts
        AND is_controlled = FALSE
      ORDER BY heartbeat_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
    `,
    {
      replacements: {
        workerId,
        now,
        staleThreshold,
        maxAttempts: DISCOVERY_MAX_ATTEMPTS,
      },
    },
  );

  const rows = results as Array<{ id: number }>;
  if (!rows || rows.length === 0) {
    return null;
  }

  const runId = rows[0]?.id;
  if (!runId) {
    return null;
  }

  const run = await DiscoveryRunModel.findByPk(runId);

  if (run) {
    console.log(
      `[DISC-2] Recovered stale run ${run.id} (attempt ${run.attempt_count})`,
    );
  }

  return run;
}

/**
 * Fail runs that have exceeded max attempts.
 *
 * Called during recovery check to clean up stuck runs.
 * Purges temporary prepared content for failed runs.
 */
export async function failExceededAttemptRuns(workerId: string): Promise<number> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - DISCOVERY_STALE_TIMEOUT_MS);

  // First, get the IDs of runs that will be failed
  const [runResults] = await sequelize.query(
    `
    SELECT id FROM discovery_runs
    WHERE status = 'processing'
      AND discovery_type IN ('desk_research', 'stakeholder_synthesis')
      AND heartbeat_at < :staleThreshold
      AND attempt_count >= :maxAttempts
      AND is_controlled = FALSE
    FOR UPDATE SKIP LOCKED
    `,
    {
      replacements: {
        staleThreshold,
        maxAttempts: DISCOVERY_MAX_ATTEMPTS,
      },
    },
  ) as [Array<{ id: number }>, unknown];

  if (!runResults || runResults.length === 0) {
    return 0;
  }

  const runIds = runResults.map(r => r.id);

  // Update runs to failed status
  await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'failed',
      failure_code = 'MAX_ATTEMPTS_EXCEEDED',
      failure_message = 'Run exceeded maximum retry attempts',
      failure_stage = 'claim_recovery',
      worker_id = :workerId,
      completed_at = :now,
      updated_at = :now
    WHERE id IN (:runIds)
    `,
    {
      replacements: {
        workerId,
        now,
        runIds,
      },
    },
  );

  // DISC-2: Purge temporary prepared content for each failed run
  for (const runId of runIds) {
    try {
      await purgePreparedSourceContent(runId);
    } catch (purgeError) {
      const msg = purgeError instanceof Error ? purgeError.message : String(purgeError);
      console.warn(`[DISC-2] Failed to purge prepared content for max-attempts-exceeded run ${runId}: ${msg}`);
    }
  }

  console.log(`[DISC-2] Failed ${runIds.length} runs that exceeded max attempts`);

  return runIds.length;
}

// ─── M5e: Controlled Run Claim ──────────────────────────────────────

/**
 * Error thrown when attempting to claim a run that is not pending.
 */
export class RunNotPendingError extends Error {
  constructor(runId: number, currentStatus: string) {
    super(`Run ${runId} is not pending (current status: ${currentStatus})`);
    this.name = 'RunNotPendingError';
  }
}

/**
 * Error thrown when attempting to claim a run that is not controlled.
 */
export class RunNotControlledError extends Error {
  constructor(runId: number) {
    super(`Run ${runId} is not a controlled run`);
    this.name = 'RunNotControlledError';
  }
}

/**
 * Error thrown when attempting to claim a run that is already claimed by another worker.
 */
export class RunAlreadyClaimedError extends Error {
  constructor(runId: number, existingWorkerId: string) {
    super(`Run ${runId} is already claimed by worker ${existingWorkerId}`);
    this.name = 'RunAlreadyClaimedError';
  }
}

/**
 * Error thrown when actor does not own the session.
 */
export class SessionActorMismatchError extends Error {
  constructor(sessionId: number, expectedActorId: number) {
    super(`Actor ${expectedActorId} does not own session ${sessionId}`);
    this.name = 'SessionActorMismatchError';
  }
}

/**
 * Error thrown when session is not active (terminal state).
 */
export class SessionNotActiveError extends Error {
  constructor(sessionId: number, currentStatus: string) {
    super(`Session ${sessionId} is not active (status: ${currentStatus})`);
    this.name = 'SessionNotActiveError';
  }
}

/**
 * Error thrown when session is not bound to the expected run.
 */
export class SessionRunBindingMismatchError extends Error {
  constructor(sessionId: number, expectedRunId: number, actualRunId: number | null) {
    super(`Session ${sessionId} is bound to run ${actualRunId}, not ${expectedRunId}`);
    this.name = 'SessionRunBindingMismatchError';
  }
}

/**
 * Error thrown when session is not found.
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: number) {
    super(`Session ${sessionId} not found`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Result of atomic authorization and claim.
 */
export interface AuthorizeAndClaimResult {
  run: DiscoveryRun;
  sessionId: number;
  sessionStatus: string;
}

/**
 * Atomically authorize and claim a controlled Discovery run.
 *
 * DISC-WEB-1D-2 M5e: Single-transaction authorization + claim.
 *
 * Lock order: session first, run second (consistent with finalization/cancellation).
 *
 * Transaction steps:
 * 1. Lock controlled_test_sessions row FOR UPDATE
 * 2. Verify created_by_actor_id === actorId
 * 3. Verify status === 'active'
 * 4. Verify discovery_run_id === runId
 * 5. Lock discovery_runs row FOR UPDATE
 * 6. Verify is_controlled === true
 * 7. Verify status === 'pending'
 * 8. Transition run to 'processing' with worker_id
 * 9. Commit
 *
 * @param sessionId - Session ID (internal)
 * @param runId - Run ID (internal)
 * @param actorId - Actor ID for ownership verification
 * @param workerId - Worker ID to assign on claim
 * @returns Claimed run and session info
 * @throws SessionNotFoundError if session doesn't exist
 * @throws SessionActorMismatchError if actor doesn't own session
 * @throws SessionNotActiveError if session is terminal
 * @throws SessionRunBindingMismatchError if session not bound to run
 * @throws RunNotControlledError if run is not controlled
 * @throws RunNotPendingError if run is not pending
 * @throws RunAlreadyClaimedError if run was claimed by another worker
 */
export async function authorizeAndClaimControlledRun(
  sessionId: number,
  runId: number,
  actorId: number,
  workerId: string,
): Promise<AuthorizeAndClaimResult> {
  const now = new Date();
  const t = await sequelize.transaction();

  try {
    // Step 1-4: Lock session and verify authorization
    const [sessionRows] = await sequelize.query(
      `
      SELECT id, status, created_by_actor_id, discovery_run_id
      FROM controlled_test_sessions
      WHERE id = :sessionId
      FOR UPDATE
      `,
      {
        replacements: { sessionId },
        transaction: t,
      },
    ) as [Array<{
      id: number;
      status: string;
      created_by_actor_id: number | null;
      discovery_run_id: number | null;
    }>, unknown];

    if (!sessionRows || sessionRows.length === 0) {
      await t.rollback();
      throw new SessionNotFoundError(sessionId);
    }

    const session = sessionRows[0];

    // Step 2: Verify actor ownership
    if (session.created_by_actor_id !== actorId) {
      await t.rollback();
      throw new SessionActorMismatchError(sessionId, actorId);
    }

    // Step 3: Verify session is active
    if (session.status !== 'active') {
      await t.rollback();
      throw new SessionNotActiveError(sessionId, session.status);
    }

    // Step 4: Verify session is bound to this run
    if (session.discovery_run_id !== runId) {
      await t.rollback();
      throw new SessionRunBindingMismatchError(sessionId, runId, session.discovery_run_id);
    }

    // Step 5-7: Lock run and verify preconditions
    const [runRows] = await sequelize.query(
      `
      SELECT id, status, is_controlled, worker_id
      FROM discovery_runs
      WHERE id = :runId
      FOR UPDATE
      `,
      {
        replacements: { runId },
        transaction: t,
      },
    ) as [Array<{
      id: number;
      status: string;
      is_controlled: boolean;
      worker_id: string | null;
    }>, unknown];

    if (!runRows || runRows.length === 0) {
      await t.rollback();
      throw new Error(`Run ${runId} not found`);
    }

    const run = runRows[0];

    // Step 6: Verify run is controlled
    if (!run.is_controlled) {
      await t.rollback();
      throw new RunNotControlledError(runId);
    }

    // Step 7: Verify run is pending
    if (run.status === 'processing') {
      await t.rollback();
      throw new RunAlreadyClaimedError(runId, run.worker_id || 'unknown');
    }

    if (run.status !== 'pending') {
      await t.rollback();
      throw new RunNotPendingError(runId, run.status);
    }

    // Step 8: Transition run to processing
    await sequelize.query(
      `
      UPDATE discovery_runs
      SET
        status = 'processing',
        worker_id = :workerId,
        claimed_at = :now,
        heartbeat_at = :now,
        started_at = COALESCE(started_at, :now),
        updated_at = :now
      WHERE id = :runId
      `,
      {
        replacements: { runId, workerId, now },
        transaction: t,
      },
    );

    // Step 9: Commit
    await t.commit();

    console.log(
      `[M5e] Atomically authorized and claimed run ${runId} (session=${sessionId}, actor=${actorId}, worker=${workerId})`,
    );

    // Return the claimed run
    const claimedRun = await DiscoveryRunModel.findByPk(runId);
    if (!claimedRun) {
      throw new Error(`Run ${runId} not found after claim`);
    }

    return {
      run: claimedRun,
      sessionId,
      sessionStatus: session.status,
    };

  } catch (error) {
    // Ensure rollback on any error (idempotent if already rolled back)
    try {
      await t.rollback();
    } catch {
      // Already rolled back or committed
    }
    throw error;
  }
}

/**
 * Atomically claim a specific controlled Discovery run.
 *
 * DISC-WEB-1D-2 M5e: Used for API-driven controlled execution.
 *
 * NOTE: This function does NOT verify actor authorization.
 * For full atomic authorization+claim, use authorizeAndClaimControlledRun().
 *
 * Requirements:
 * - Run must exist
 * - Run must be controlled (is_controlled = TRUE)
 * - Run must be pending
 * - Uses atomic UPDATE to prevent duplicate concurrent claims
 *
 * @param runId - The numeric ID of the run to claim
 * @param workerId - The unique worker ID claiming the run
 * @returns The claimed run
 * @throws RunNotPendingError if run is not pending
 * @throws RunNotControlledError if run is not controlled
 * @throws RunAlreadyClaimedError if run is already claimed (processing)
 */
export async function claimControlledRun(
  runId: number,
  workerId: string,
): Promise<DiscoveryRun> {
  const now = new Date();

  // First, check the run exists and get its current state
  const existingRun = await DiscoveryRunModel.findByPk(runId);
  if (!existingRun) {
    throw new Error(`Run ${runId} not found`);
  }

  if (!existingRun.is_controlled) {
    throw new RunNotControlledError(runId);
  }

  if (existingRun.status === 'processing') {
    throw new RunAlreadyClaimedError(runId, existingRun.worker_id || 'unknown');
  }

  if (existingRun.status !== 'pending') {
    throw new RunNotPendingError(runId, existingRun.status);
  }

  // Atomic UPDATE with preconditions
  // This prevents race conditions between concurrent claim attempts
  const [results] = await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'processing',
      worker_id = :workerId,
      claimed_at = :now,
      heartbeat_at = :now,
      started_at = COALESCE(started_at, :now),
      updated_at = :now
    WHERE id = :runId
      AND status = 'pending'
      AND is_controlled = TRUE
    RETURNING id
    `,
    {
      replacements: { runId, workerId, now },
    },
  );

  const rows = results as Array<{ id: number }>;
  if (!rows || rows.length === 0) {
    // Failed to claim — another worker beat us to it
    // Re-check the state to provide accurate error
    const recheckRun = await DiscoveryRunModel.findByPk(runId);
    if (recheckRun?.status === 'processing') {
      throw new RunAlreadyClaimedError(runId, recheckRun.worker_id || 'unknown');
    }
    if (recheckRun?.status !== 'pending') {
      throw new RunNotPendingError(runId, recheckRun?.status || 'unknown');
    }
    // If we get here, something unexpected happened
    throw new Error(`Failed to claim run ${runId} for unknown reason`);
  }

  console.log(`[M5e] Claimed controlled run ${runId} with worker ${workerId}`);

  return DiscoveryRunModel.findByPk(runId) as Promise<DiscoveryRun>;
}

/**
 * Update heartbeat for a run we own.
 *
 * Throws NotOwnerError if we don't own the run.
 */
export async function updateHeartbeat(
  runId: number,
  workerId: string,
): Promise<void> {
  const now = new Date();

  const [, metadata] = await sequelize.query(
    `
    UPDATE discovery_runs
    SET heartbeat_at = :now, updated_at = :now
    WHERE id = :runId
      AND worker_id = :workerId
      AND status = 'processing'
    `,
    {
      replacements: { runId, workerId, now },
    },
  );

  if ((metadata as { rowCount?: number })?.rowCount === 0) {
    throw new NotOwnerError(runId, workerId);
  }
}

/**
 * Validate we still own a run before completing.
 *
 * Returns true if we own it, false otherwise.
 */
export async function validateClaimOwnership(
  runId: number,
  workerId: string,
): Promise<boolean> {
  const run = await DiscoveryRunModel.findOne({
    where: {
      id: runId,
      worker_id: workerId,
      status: 'processing',
    },
  });

  return run !== null;
}

/**
 * Complete a run we own.
 *
 * Purges temporary prepared source content after completion.
 * Throws NotOwnerError if we don't own the run.
 */
export async function completeRun(
  runId: number,
  workerId: string,
): Promise<DiscoveryRun> {
  const now = new Date();

  const [, metadata] = await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'completed',
      completed_at = :now,
      updated_at = :now
    WHERE id = :runId
      AND worker_id = :workerId
      AND status = 'processing'
    `,
    {
      replacements: { runId, workerId, now },
    },
  );

  if ((metadata as { rowCount?: number })?.rowCount === 0) {
    throw new NotOwnerError(runId, workerId);
  }

  // DISC-2: Purge temporary prepared content after terminal completion
  try {
    await purgePreparedSourceContent(runId);
  } catch (purgeError) {
    // Log but don't fail - completion is more important than cleanup
    const msg = purgeError instanceof Error ? purgeError.message : String(purgeError);
    console.warn(`[DISC-2] Failed to purge prepared content for completed run ${runId}: ${msg}`);
  }

  return DiscoveryRunModel.findByPk(runId) as Promise<DiscoveryRun>;
}

/**
 * Fail a run we own.
 *
 * Purges temporary prepared source content after failure.
 * Throws NotOwnerError if we don't own the run.
 */
export async function failRun(
  runId: number,
  workerId: string,
  failureCode: string,
  failureMessage: string,
  failureStage?: string,
): Promise<DiscoveryRun> {
  const now = new Date();

  // Sanitize PII from failure message
  const sanitizedMessage = sanitizeFailureMessage(failureMessage);

  const [, metadata] = await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'failed',
      failure_code = :failureCode,
      failure_message = :failureMessage,
      failure_stage = :failureStage,
      completed_at = :now,
      updated_at = :now
    WHERE id = :runId
      AND worker_id = :workerId
      AND status = 'processing'
    `,
    {
      replacements: {
        runId,
        workerId,
        failureCode,
        failureMessage: sanitizedMessage.substring(0, 500),
        failureStage: failureStage || null,
        now,
      },
    },
  );

  if ((metadata as { rowCount?: number })?.rowCount === 0) {
    throw new NotOwnerError(runId, workerId);
  }

  // DISC-2: Purge temporary prepared content after terminal failure
  try {
    await purgePreparedSourceContent(runId);
  } catch (purgeError) {
    // Log but don't fail - failure recording is more important than cleanup
    const msg = purgeError instanceof Error ? purgeError.message : String(purgeError);
    console.warn(`[DISC-2] Failed to purge prepared content for failed run ${runId}: ${msg}`);
  }

  return DiscoveryRunModel.findByPk(runId) as Promise<DiscoveryRun>;
}

/**
 * Release a claim without completing/failing.
 *
 * Resets the run to pending for another worker to claim.
 * Used for graceful shutdown.
 */
export async function releaseClaim(
  runId: number,
  workerId: string,
): Promise<boolean> {
  const now = new Date();

  const [, metadata] = await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'pending',
      worker_id = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      updated_at = :now
    WHERE id = :runId
      AND worker_id = :workerId
      AND status = 'processing'
    `,
    {
      replacements: { runId, workerId, now },
    },
  );

  return ((metadata as { rowCount?: number })?.rowCount || 0) > 0;
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Sanitize PII from failure messages.
 * Pattern matches Coach claim service.
 */
function sanitizeFailureMessage(message: string): string {
  return message
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Phone numbers (various formats)
    .replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]')
    // SSN
    .replace(/\d{3}[-\s]?\d{2}[-\s]?\d{4}/g, '[SSN]')
    // Credit card numbers
    .replace(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, '[CARD]');
}

// ─── Query Helpers ─────────────────────────────────────────────────

/**
 * Count pending Discovery runs (desk/stakeholder only).
 */
export async function countPendingRuns(): Promise<number> {
  const count = await DiscoveryRunModel.count({
    where: {
      status: 'pending',
      discovery_type: { [Op.in]: ['desk_research', 'stakeholder_synthesis'] },
      is_controlled: false,
    },
  });
  return count;
}

/**
 * Count processing Discovery runs (desk/stakeholder only).
 */
export async function countProcessingRuns(): Promise<number> {
  const count = await DiscoveryRunModel.count({
    where: {
      status: 'processing',
      discovery_type: { [Op.in]: ['desk_research', 'stakeholder_synthesis'] },
      is_controlled: false,
    },
  });
  return count;
}
