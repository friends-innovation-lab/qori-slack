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
    },
  });
  return count;
}
