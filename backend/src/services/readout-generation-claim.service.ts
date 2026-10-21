/**
 * Readout Generation Claim Service — DR-6b-5a
 *
 * Atomic claim operations for Desk Research Readout AI generation.
 * Pattern follows Discovery claim service (DISC-2) for consistency.
 *
 * Uses FOR UPDATE SKIP LOCKED for concurrent worker safety.
 *
 * Claim lifecycle:
 *   1. Version created with status 'pending', no worker
 *   2. Worker claims: sets worker_id, claimed_at, heartbeat_at, status → 'generating'
 *   3. Worker heartbeats to extend lease
 *   4. Worker completes/fails: content stored, status terminal
 *   5. Stale claims (heartbeat too old) can be recovered by another worker
 *
 * Idempotency:
 *   - Client provides idempotency_key with generation request
 *   - Unique constraint on (readout_id, requested_by_actor_id, idempotency_key)
 *   - Same key + payload returns existing request (no supersession)
 *   - Same key + different payload returns conflict error
 */

import sequelize from '../database';
import type { DeskResearchReadoutVersion } from '../database/models/desk_research_readout_version';

const DeskResearchReadoutVersionModel = sequelize.models.DeskResearchReadoutVersion as typeof DeskResearchReadoutVersion;

// ─── Configuration ─────────────────────────────────────────────────

export const READOUT_GEN_STALE_TIMEOUT_MS = parseInt(
  process.env.READOUT_GEN_STALE_TIMEOUT_MS || '120000',
  10,
);

export const READOUT_GEN_MAX_ATTEMPTS = parseInt(
  process.env.READOUT_GEN_MAX_ATTEMPTS || '3',
  10,
);

/**
 * Retry delay backoff schedule (milliseconds).
 * Index corresponds to attempt number (1-based).
 * Attempt 1 has no delay (first try).
 * Attempt 2 waits 5s, Attempt 3 waits 15s.
 * After attempt 3, terminal failure.
 */
export const READOUT_GEN_RETRY_DELAYS_MS: readonly number[] = [
  0,      // Attempt 1: immediate (first try)
  5000,   // Attempt 2: 5 second delay
  15000,  // Attempt 3: 15 second delay
];

// ─── Error Types ───────────────────────────────────────────────────

export class ClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimError';
  }
}

export class NotOwnerError extends Error {
  public readonly versionId: number;
  public readonly expectedWorkerId: string;

  constructor(versionId: number, expectedWorkerId: string) {
    super(`Worker ${expectedWorkerId} is not the owner of version ${versionId}`);
    this.name = 'NotOwnerError';
    this.versionId = versionId;
    this.expectedWorkerId = expectedWorkerId;
  }
}

export class IdempotencyConflictError extends Error {
  public readonly existingRequestId: string;

  constructor(idempotencyKey: string, existingRequestId: string) {
    super(`Idempotency key '${idempotencyKey}' already used with different payload`);
    this.name = 'IdempotencyConflictError';
    this.existingRequestId = existingRequestId;
  }
}

export class VersionNotFoundError extends Error {
  constructor(versionId: number) {
    super(`Version ${versionId} not found`);
    this.name = 'VersionNotFoundError';
  }
}

export class VersionTerminalError extends Error {
  public readonly status: string;

  constructor(versionId: number, status: string) {
    super(`Version ${versionId} is already in terminal state: ${status}`);
    this.name = 'VersionTerminalError';
    this.status = status;
  }
}

// ─── Claim Operations ──────────────────────────────────────────────

/**
 * Atomically claim the next pending readout generation job.
 *
 * Uses FOR UPDATE SKIP LOCKED to prevent duplicate claims.
 *
 * Respects retry timing: pending jobs with retry_after > NOW() are deferred
 * (used for bounded backoff on transient failures).
 *
 * On successful claim:
 * - Sets status to 'generating'
 * - Sets worker_id and timestamps
 * - Clears retry_after (no longer pending)
 * - Increments attempt_count exactly once
 *
 * Returns null if no pending jobs available.
 */
export async function claimNextPendingJob(
  workerId: string,
): Promise<DeskResearchReadoutVersion | null> {
  const now = new Date();

  // Use raw query for FOR UPDATE SKIP LOCKED with atomic status transition
  // Respects retry_after timing for pending jobs (DR-6b-5b bounded backoff)
  const [results] = await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET
      generation_status = 'generating',
      worker_id = :workerId,
      claimed_at = :now,
      heartbeat_at = :now,
      generation_started_at = COALESCE(generation_started_at, :now),
      attempt_count = attempt_count + 1,
      retry_after = NULL
    WHERE id = (
      SELECT id FROM desk_research_readout_versions
      WHERE generation_status = 'pending'
        AND (retry_after IS NULL OR retry_after <= :now)
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

  const versionId = rows[0]?.id;
  if (!versionId) {
    return null;
  }

  return DeskResearchReadoutVersionModel.findByPk(versionId);
}

/**
 * Recover a stale generation job (heartbeat too old).
 *
 * A job is stale if:
 * - generation_status = 'generating'
 * - heartbeat_at < now - STALE_TIMEOUT
 * - attempt_count < MAX_ATTEMPTS
 *
 * Returns null if no stale jobs available.
 */
export async function recoverStaleJob(
  workerId: string,
): Promise<DeskResearchReadoutVersion | null> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - READOUT_GEN_STALE_TIMEOUT_MS);

  // Use raw query for FOR UPDATE SKIP LOCKED
  const [results] = await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET
      worker_id = :workerId,
      claimed_at = :now,
      heartbeat_at = :now,
      attempt_count = attempt_count + 1,
      last_error_code = 'STALE_RECOVERY'
    WHERE id = (
      SELECT id FROM desk_research_readout_versions
      WHERE generation_status = 'generating'
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
        maxAttempts: READOUT_GEN_MAX_ATTEMPTS,
      },
    },
  );

  const rows = results as Array<{ id: number }>;
  if (!rows || rows.length === 0) {
    return null;
  }

  const versionId = rows[0]?.id;
  if (!versionId) {
    return null;
  }

  const version = await DeskResearchReadoutVersionModel.findByPk(versionId);

  if (version) {
    console.log(
      `[DR-6b-5a] Recovered stale generation job ${version.id} (attempt ${version.attempt_count})`,
    );
  }

  return version;
}

/**
 * Fail generation jobs that have exceeded max attempts.
 *
 * Called during recovery check to clean up stuck jobs.
 */
export async function failExceededAttemptJobs(workerId: string): Promise<number> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - READOUT_GEN_STALE_TIMEOUT_MS);

  // Get the IDs of jobs that will be failed
  const [jobResults] = await sequelize.query(
    `
    SELECT id, readout_id FROM desk_research_readout_versions
    WHERE generation_status = 'generating'
      AND heartbeat_at < :staleThreshold
      AND attempt_count >= :maxAttempts
    FOR UPDATE SKIP LOCKED
    `,
    {
      replacements: {
        staleThreshold,
        maxAttempts: READOUT_GEN_MAX_ATTEMPTS,
      },
    },
  ) as [Array<{ id: number; readout_id: number }>, unknown];

  if (!jobResults || jobResults.length === 0) {
    return 0;
  }

  const jobIds = jobResults.map(r => r.id);
  const readoutIds = jobResults.map(r => r.readout_id);

  // Update jobs to failed status
  await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET
      generation_status = 'failed',
      generation_error = 'Max retry attempts exceeded',
      generation_completed_at = :now,
      last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
    WHERE id IN (:jobIds)
    `,
    {
      replacements: {
        now,
        jobIds,
      },
    },
  );

  // Clear current_generation_request_id on parent readouts
  await sequelize.query(
    `
    UPDATE desk_research_readouts
    SET current_generation_request_id = NULL
    WHERE id IN (:readoutIds)
      AND current_generation_request_id IN (
        SELECT generation_request_id FROM desk_research_readout_versions WHERE id IN (:jobIds)
      )
    `,
    {
      replacements: {
        readoutIds,
        jobIds,
      },
    },
  );

  console.log(`[DR-6b-5a] Failed ${jobIds.length} generation jobs that exceeded max attempts`);

  return jobIds.length;
}

/**
 * Update heartbeat for a job we own.
 *
 * Throws NotOwnerError if we don't own the job.
 */
export async function updateHeartbeat(
  versionId: number,
  workerId: string,
): Promise<void> {
  const now = new Date();

  const [, metadata] = await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET heartbeat_at = :now
    WHERE id = :versionId
      AND worker_id = :workerId
      AND generation_status = 'generating'
    `,
    {
      replacements: { versionId, workerId, now },
    },
  );

  if ((metadata as { rowCount?: number })?.rowCount === 0) {
    throw new NotOwnerError(versionId, workerId);
  }
}

/**
 * Validate we still own a job before completing.
 *
 * Returns true if we own it, false otherwise.
 */
export async function validateClaimOwnership(
  versionId: number,
  workerId: string,
): Promise<boolean> {
  const version = await DeskResearchReadoutVersionModel.findOne({
    where: {
      id: versionId,
      worker_id: workerId,
      generation_status: 'generating',
    },
  });

  return version !== null;
}

/**
 * Complete a generation job we own.
 *
 * Throws NotOwnerError if we don't own the job.
 * Throws VersionTerminalError if already completed/failed/superseded.
 */
export async function completeJob(
  versionId: number,
  workerId: string,
  content: any,
): Promise<DeskResearchReadoutVersion> {
  const now = new Date();

  const [, metadata] = await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET
      generation_status = 'completed',
      generation_completed_at = :now,
      content = :content
    WHERE id = :versionId
      AND worker_id = :workerId
      AND generation_status = 'generating'
    `,
    {
      replacements: {
        versionId,
        workerId,
        now,
        content: JSON.stringify(content),
      },
    },
  );

  if ((metadata as { rowCount?: number })?.rowCount === 0) {
    // Check why update failed
    const version = await DeskResearchReadoutVersionModel.findByPk(versionId);
    if (!version) {
      throw new VersionNotFoundError(versionId);
    }
    if (['completed', 'failed', 'superseded'].includes(version.generation_status)) {
      throw new VersionTerminalError(versionId, version.generation_status);
    }
    throw new NotOwnerError(versionId, workerId);
  }

  return DeskResearchReadoutVersionModel.findByPk(versionId) as Promise<DeskResearchReadoutVersion>;
}

/**
 * Fail a generation job we own.
 *
 * Throws NotOwnerError if we don't own the job.
 */
export async function failJob(
  versionId: number,
  workerId: string,
  errorCode: string,
  errorMessage: string,
): Promise<DeskResearchReadoutVersion> {
  const now = new Date();

  // Sanitize PII from failure message
  const sanitizedMessage = sanitizeErrorMessage(errorMessage);

  const [, metadata] = await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET
      generation_status = 'failed',
      generation_completed_at = :now,
      generation_error = :errorMessage,
      last_error_code = :errorCode
    WHERE id = :versionId
      AND worker_id = :workerId
      AND generation_status = 'generating'
    `,
    {
      replacements: {
        versionId,
        workerId,
        now,
        errorMessage: sanitizedMessage.substring(0, 500),
        errorCode: errorCode.substring(0, 50),
      },
    },
  );

  if ((metadata as { rowCount?: number })?.rowCount === 0) {
    throw new NotOwnerError(versionId, workerId);
  }

  return DeskResearchReadoutVersionModel.findByPk(versionId) as Promise<DeskResearchReadoutVersion>;
}

/**
 * Release a claim without completing/failing.
 *
 * Resets the job to pending for immediate reclaim by another worker.
 * Used for graceful shutdown.
 *
 * Clears retry_after so the job is immediately claimable
 * (graceful shutdown is not a transient error).
 */
export async function releaseClaim(
  versionId: number,
  workerId: string,
): Promise<boolean> {
  const [, metadata] = await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET
      generation_status = 'pending',
      worker_id = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      retry_after = NULL,
      generation_started_at = NULL
    WHERE id = :versionId
      AND worker_id = :workerId
      AND generation_status = 'generating'
    `,
    {
      replacements: { versionId, workerId },
    },
  );

  return ((metadata as { rowCount?: number })?.rowCount || 0) > 0;
}

/**
 * Release a claim for retry with bounded backoff (DR-6b-5b).
 *
 * Atomically transitions a job from 'generating' to 'pending' with:
 * - `worker_id = NULL` (unclaimed)
 * - `claimed_at = NULL`
 * - `heartbeat_at = NULL` (satisfies chk_version_claimed_has_worker)
 * - `retry_after = now + backoff_delay` (bounded retry timing)
 * - `last_error_code = sanitized error`
 *
 * Backoff schedule based on attempt_count:
 * - Attempt 2: 5 second delay
 * - Attempt 3: 15 second delay
 *
 * Does NOT increment attempt_count (already incremented on claim).
 * Does NOT change attempt_count (preserved for retry tracking).
 *
 * Transition requires:
 * - Worker owns the claim (worker_id = workerId)
 * - Job is in 'generating' status
 *
 * A stale worker cannot requeue a job it no longer owns.
 *
 * Returns true if released, false if worker doesn't own the claim.
 */
export async function releaseForRetry(
  versionId: number,
  workerId: string,
  errorCode: string,
  attemptCount: number,
): Promise<boolean> {
  const now = new Date();

  // Calculate retry delay based on attempt count
  const delayMs = attemptCount < READOUT_GEN_RETRY_DELAYS_MS.length
    ? READOUT_GEN_RETRY_DELAYS_MS[attemptCount]
    : READOUT_GEN_RETRY_DELAYS_MS[READOUT_GEN_RETRY_DELAYS_MS.length - 1];

  const retryAfter = new Date(now.getTime() + delayMs);

  const [, metadata] = await sequelize.query(
    `
    UPDATE desk_research_readout_versions
    SET
      generation_status = 'pending',
      worker_id = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      retry_after = :retryAfter,
      last_error_code = :errorCode
    WHERE id = :versionId
      AND worker_id = :workerId
      AND generation_status = 'generating'
    `,
    {
      replacements: {
        versionId,
        workerId,
        retryAfter,
        errorCode: errorCode.substring(0, 50),
      },
    },
  );

  const released = ((metadata as { rowCount?: number })?.rowCount || 0) > 0;

  if (released) {
    console.log(
      `[DR-6b-5b] Released version ${versionId} for retry in ${delayMs}ms (attempt ${attemptCount}, code: ${errorCode})`,
    );
  }

  return released;
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Sanitize PII from error messages.
 * Pattern matches Discovery claim service.
 */
function sanitizeErrorMessage(message: string): string {
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
 * Count pending generation jobs.
 */
export async function countPendingJobs(): Promise<number> {
  const count = await DeskResearchReadoutVersionModel.count({
    where: {
      generation_status: 'pending',
    },
  });
  return count;
}

/**
 * Count generating (in-progress) jobs.
 */
export async function countGeneratingJobs(): Promise<number> {
  const count = await DeskResearchReadoutVersionModel.count({
    where: {
      generation_status: 'generating',
    },
  });
  return count;
}

/**
 * Get version by generation request ID.
 */
export async function getVersionByRequestId(
  generationRequestId: string,
): Promise<DeskResearchReadoutVersion | null> {
  return DeskResearchReadoutVersionModel.findOne({
    where: { generation_request_id: generationRequestId },
  });
}

/**
 * Get the attempt count for a version.
 */
export async function getAttemptCount(versionId: number): Promise<number> {
  const version = await DeskResearchReadoutVersionModel.findByPk(versionId, {
    attributes: ['attempt_count'],
  });
  return version?.attempt_count ?? 0;
}
