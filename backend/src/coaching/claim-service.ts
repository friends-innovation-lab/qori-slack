/**
 * Coach Claim Service — Coach M2
 *
 * Handles atomic run claiming using PostgreSQL FOR UPDATE SKIP LOCKED.
 * Ensures concurrent workers cannot claim the same run.
 *
 * Key operations:
 * - Claim pending run atomically
 * - Recover stale running runs
 * - Update heartbeat
 * - Validate claim ownership before completion
 */

import { QueryTypes } from 'sequelize';
import sequelize from '../database';
import type { CoachingRun, CoachingFailureCode } from '../database/models/coaching_run';
import {
  COACH_STALE_TIMEOUT_MS,
  COACH_MAX_ATTEMPTS,
  COACH_MAX_ACTIVE_PER_USER,
  COACH_MAX_ACTIVE_PER_STUDY,
} from './config';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Result of a claim attempt.
 */
export interface ClaimResult {
  claimed: boolean;
  run?: CoachingRun;
  reason?: string;
}

/**
 * Rate limit check result.
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  activeCount?: number;
  limit?: number;
}

// ─── Model Reference ────────────────────────────────────────────────────

const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

// ─── Claim Operations ───────────────────────────────────────────────────

/**
 * Claim the next pending run atomically using SKIP LOCKED.
 *
 * This prevents multiple workers from claiming the same run.
 * Only pending runs ordered by requested_at are considered.
 *
 * @param workerId - Unique identifier for this worker
 * @returns Claim result with run if successful
 */
export async function claimNextPendingRun(workerId: string): Promise<ClaimResult> {
  // Use raw query for SKIP LOCKED support
  const result = await sequelize.query<CoachingRun>(
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
    RETURNING *
    `,
    {
      replacements: { workerId },
      type: QueryTypes.SELECT,
      mapToModel: true,
      model: CoachingRunModel,
    }
  );

  if (result.length === 0) {
    return { claimed: false, reason: 'No pending runs available' };
  }

  return { claimed: true, run: result[0] };
}

/**
 * Recover stale running runs.
 *
 * A run is stale when:
 * - status = 'running'
 * - heartbeat_at < NOW() - stale_timeout
 *
 * Stale runs are reclaimed by incrementing attempt_count.
 * If attempt_count would exceed max, the run is failed instead.
 *
 * @param workerId - Unique identifier for this worker
 * @returns Claim result with recovered run if successful
 */
export async function recoverStaleRun(workerId: string): Promise<ClaimResult> {
  const staleTimeoutSeconds = COACH_STALE_TIMEOUT_MS / 1000;

  // First, check for runs that would exceed max attempts
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
    }
  );

  // Now recover runs that have attempts remaining
  const result = await sequelize.query<CoachingRun>(
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
    RETURNING *
    `,
    {
      replacements: { workerId, maxAttempts: COACH_MAX_ATTEMPTS },
      type: QueryTypes.SELECT,
      mapToModel: true,
      model: CoachingRunModel,
    }
  );

  if (result.length === 0) {
    return { claimed: false, reason: 'No stale runs to recover' };
  }

  return { claimed: true, run: result[0] };
}

/**
 * Update heartbeat for a running job.
 *
 * Only updates if the worker still owns the claim.
 *
 * @param runId - Run ID
 * @param workerId - Expected worker ID
 * @returns True if heartbeat updated, false if claim lost
 */
export async function updateHeartbeat(runId: string, workerId: string): Promise<boolean> {
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
    }
  ) as [unknown, number];

  return affectedCount > 0;
}

/**
 * Validate that current worker still owns the claim.
 *
 * Used before persisting completion to ensure no race condition.
 *
 * @param runId - Run ID
 * @param workerId - Expected worker ID
 * @returns True if claim is still valid
 */
export async function validateClaimOwnership(runId: string, workerId: string): Promise<boolean> {
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

  return parseInt(result[0]?.count ?? '0', 10) > 0;
}

/**
 * Mark run as completed with atomic ownership check.
 *
 * @param runId - Run ID
 * @param workerId - Expected worker ID
 * @returns True if marked completed, false if claim lost
 */
export async function markCompleted(runId: string, workerId: string): Promise<boolean> {
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
      type: QueryTypes.UPDATE,
    }
  ) as [unknown, number];

  return affectedCount > 0;
}

/**
 * Mark run as failed with atomic ownership check.
 *
 * @param runId - Run ID
 * @param workerId - Expected worker ID
 * @param failureCode - Normalized failure code
 * @param diagnostic - Sanitized diagnostic message
 * @returns True if marked failed, false if claim lost
 */
export async function markFailed(
  runId: string,
  workerId: string,
  failureCode: CoachingFailureCode,
  diagnostic: string,
): Promise<boolean> {
  const [, affectedCount] = await sequelize.query(
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
      type: QueryTypes.UPDATE,
    }
  ) as [unknown, number];

  return affectedCount > 0;
}

/**
 * Record usage metadata for a run.
 *
 * @param runId - Run ID
 * @param usage - Usage metadata
 */
export async function recordUsage(
  runId: string,
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCost?: number;
    actualProviderCost?: number;
    latencyMs?: number;
  },
): Promise<void> {
  const updates: string[] = [];
  const replacements: Record<string, unknown> = { runId };

  if (usage.inputTokens !== undefined) {
    updates.push('input_tokens = :inputTokens');
    replacements.inputTokens = usage.inputTokens;
  }
  if (usage.outputTokens !== undefined) {
    updates.push('output_tokens = :outputTokens');
    replacements.outputTokens = usage.outputTokens;
  }
  if (usage.totalTokens !== undefined) {
    updates.push('total_tokens = :totalTokens');
    replacements.totalTokens = usage.totalTokens;
  }
  if (usage.estimatedCost !== undefined) {
    updates.push('estimated_cost = :estimatedCost');
    replacements.estimatedCost = usage.estimatedCost;
  }
  if (usage.actualProviderCost !== undefined) {
    updates.push('actual_provider_cost = :actualProviderCost');
    replacements.actualProviderCost = usage.actualProviderCost;
  }
  if (usage.latencyMs !== undefined) {
    updates.push('latency_ms = :latencyMs');
    replacements.latencyMs = usage.latencyMs;
  }

  if (updates.length === 0) return;

  await sequelize.query(
    `UPDATE coaching_runs SET ${updates.join(', ')} WHERE id = :runId`,
    { replacements, type: QueryTypes.UPDATE }
  );
}

// ─── Rate Limiting ──────────────────────────────────────────────────────

/**
 * Check if user is within rate limits for new runs.
 *
 * @param actorId - Actor internal ID
 * @returns Rate limit check result
 */
export async function checkUserRateLimit(actorId: number): Promise<RateLimitResult> {
  const result = await sequelize.query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM coaching_runs
    WHERE requested_by = :actorId
      AND status IN ('pending', 'running')
    `,
    {
      replacements: { actorId },
      type: QueryTypes.SELECT,
    }
  );

  const activeCount = parseInt(result[0]?.count ?? '0', 10);

  if (activeCount >= COACH_MAX_ACTIVE_PER_USER) {
    return {
      allowed: false,
      reason: `User has ${activeCount} active runs, limit is ${COACH_MAX_ACTIVE_PER_USER}`,
      activeCount,
      limit: COACH_MAX_ACTIVE_PER_USER,
    };
  }

  return { allowed: true, activeCount, limit: COACH_MAX_ACTIVE_PER_USER };
}

/**
 * Check if study is within rate limits for new runs.
 *
 * @param studyId - Study internal ID
 * @returns Rate limit check result
 */
export async function checkStudyRateLimit(studyId: number): Promise<RateLimitResult> {
  const result = await sequelize.query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM coaching_runs
    WHERE study_id = :studyId
      AND status IN ('pending', 'running')
    `,
    {
      replacements: { studyId },
      type: QueryTypes.SELECT,
    }
  );

  const activeCount = parseInt(result[0]?.count ?? '0', 10);

  if (activeCount >= COACH_MAX_ACTIVE_PER_STUDY) {
    return {
      allowed: false,
      reason: `Study has ${activeCount} active runs, limit is ${COACH_MAX_ACTIVE_PER_STUDY}`,
      activeCount,
      limit: COACH_MAX_ACTIVE_PER_STUDY,
    };
  }

  return { allowed: true, activeCount, limit: COACH_MAX_ACTIVE_PER_STUDY };
}
