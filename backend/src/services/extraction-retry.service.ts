/**
 * Extraction Retry Service — DR-2
 *
 * Manages bounded retry of failed/partial insight extractions.
 *
 * Retry Algorithm:
 * - Base delay: 5 minutes
 * - Exponential backoff: delay * 2^(attempt - 1)
 * - Maximum delay: 24 hours
 * - Maximum attempts: 5
 *
 * Permanent vs Retryable Errors:
 * - PERMANENT: Attribution failures (source not found, ambiguous names)
 * - PERMANENT: Validation failures (missing required fields)
 * - RETRYABLE: Database errors, connection timeouts, unknown errors
 *
 * State Transitions:
 * - failed/partial → claimed → success/partial/failed
 * - Exhausted attempts → permanent_failure=true
 */

import sequelize from '../database';
import { Op, QueryTypes } from 'sequelize';
import * as extractionService from './insight-extraction.service';
import type { ExtractionResult } from './insight-extraction.service';

const { DiscoveryArtifact, DiscoveryRun } = sequelize.models;

// ─── Configuration ────────────────────────────────────────────────────────────

/** Base retry delay in milliseconds (5 minutes) */
const BASE_RETRY_DELAY_MS = 5 * 60 * 1000;

/** Maximum retry delay in milliseconds (24 hours) */
const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;

/** Maximum number of extraction attempts */
const MAX_EXTRACTION_ATTEMPTS = 5;

/** Claim expiry timeout in milliseconds (5 minutes) */
const CLAIM_EXPIRY_MS = 5 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetryableArtifact {
  id: number;
  publicId: string;
  projectId: number;
  runId: number;
  status: string;
  attemptCount: number;
  failureReason: string | null;
}

export interface RetryResult {
  success: boolean;
  artifactId: number;
  status: 'success' | 'partial' | 'failed' | 'exhausted' | 'permanent';
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  error?: string;
}

// ─── Permanent Error Detection ────────────────────────────────────────────────

/**
 * Patterns that indicate permanent (non-retryable) errors
 */
const PERMANENT_ERROR_PATTERNS = [
  /no exact match in run sources/i,
  /source attribution unresolved/i,
  /evidence reference is required/i,
  /insight wording is required/i,
  /project_id.*not.*found/i,
];

/**
 * Check if an error is permanent (should not be retried)
 */
export function isPermanentError(errorMessage: string | undefined): boolean {
  if (!errorMessage) return false;

  return PERMANENT_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
}

// ─── Backoff Calculation ──────────────────────────────────────────────────────

/**
 * Calculate next retry delay using exponential backoff
 */
export function calculateRetryDelay(attemptCount: number): number {
  // delay = base * 2^(attempt - 1)
  // attempt 1: 5min, attempt 2: 10min, attempt 3: 20min, etc.
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attemptCount - 1));
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Calculate next retry time
 */
export function calculateNextRetryTime(attemptCount: number): Date {
  const delay = calculateRetryDelay(attemptCount);
  return new Date(Date.now() + delay);
}

// ─── Claim Management ─────────────────────────────────────────────────────────

/**
 * Claim the next artifact eligible for extraction retry.
 *
 * Uses FOR UPDATE SKIP LOCKED for atomic claims.
 * Returns null if no eligible artifacts.
 */
export async function claimNextRetryableArtifact(
  workerId: string,
): Promise<RetryableArtifact | null> {
  const now = new Date();

  // Use raw query for atomic claim with FOR UPDATE SKIP LOCKED
  // Note: For UPDATE...RETURNING with QueryTypes.SELECT, Sequelize returns rows directly
  const result = await sequelize.query<{
    id: number;
    public_id: string;
    project_id: number;
    discovery_run_id: number;
    extraction_status: string;
    extraction_attempt_count: number;
    extraction_failure_reason: string | null;
  }>(`
    UPDATE discovery_artifacts
    SET
      extraction_claimed_by = :workerId,
      extraction_claimed_at = :now
    WHERE id = (
      SELECT da.id
      FROM discovery_artifacts da
      INNER JOIN discovery_runs dr ON dr.id = da.discovery_run_id
      WHERE da.extraction_status IN ('failed', 'partial')
        AND da.extraction_permanent_failure = false
        AND da.extraction_attempt_count < :maxAttempts
        AND (da.extraction_next_retry_at IS NULL OR da.extraction_next_retry_at <= :now)
        AND (da.extraction_claimed_by IS NULL OR da.extraction_claimed_at < :claimExpiry)
        AND dr.discovery_type = 'desk_research'
        AND dr.status = 'completed'
        AND da.status = 'current'
      ORDER BY da.extraction_next_retry_at ASC NULLS FIRST
      FOR UPDATE OF da SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, public_id, project_id, discovery_run_id,
              extraction_status, extraction_attempt_count, extraction_failure_reason
  `, {
    replacements: {
      workerId,
      now,
      maxAttempts: MAX_EXTRACTION_ATTEMPTS,
      claimExpiry: new Date(Date.now() - CLAIM_EXPIRY_MS),
    },
    type: QueryTypes.SELECT,
  });

  // Result is [rows, metadata] - extract rows array
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0] as {
    id: number;
    public_id: string;
    project_id: number;
    discovery_run_id: number;
    extraction_status: string;
    extraction_attempt_count: number;
    extraction_failure_reason: string | null;
  };
  return {
    id: row.id,
    publicId: row.public_id,
    projectId: row.project_id,
    runId: row.discovery_run_id,
    status: row.extraction_status,
    attemptCount: row.extraction_attempt_count,
    failureReason: row.extraction_failure_reason,
  };
}

/**
 * Release an extraction claim without completing retry.
 */
export async function releaseClaim(
  artifactId: number,
  workerId: string,
): Promise<boolean> {
  const [affectedCount] = await DiscoveryArtifact.update(
    {
      extraction_claimed_by: null,
      extraction_claimed_at: null,
    },
    {
      where: {
        id: artifactId,
        extraction_claimed_by: workerId,
      },
    },
  );

  return affectedCount > 0;
}

/**
 * Recover expired claims by clearing them.
 */
export async function recoverExpiredClaims(): Promise<number> {
  const expiryTime = new Date(Date.now() - CLAIM_EXPIRY_MS);

  const [affectedCount] = await DiscoveryArtifact.update(
    {
      extraction_claimed_by: null,
      extraction_claimed_at: null,
    },
    {
      where: {
        extraction_claimed_at: { [Op.lt]: expiryTime },
        extraction_claimed_by: { [Op.ne]: null },
      },
    },
  );

  return affectedCount;
}

// ─── Retry Execution ──────────────────────────────────────────────────────────

/**
 * Execute extraction retry for a claimed artifact.
 *
 * Updates extraction state based on result:
 * - Success: clears eligibility, sets status=success
 * - Partial: schedules next retry, preserves failed candidates
 * - Failed: schedules next retry or marks exhausted
 */
export async function executeExtractionRetry(
  artifact: RetryableArtifact,
  workerId: string,
): Promise<RetryResult> {
  const newAttemptCount = artifact.attemptCount + 1;

  try {
    // Execute extraction using persisted variable data
    const result = await extractionService.extractInsightsFromDiscoveryRun(
      artifact.runId,
      artifact.id,
      { verbose: true },
    );

    // Determine outcome
    if (result.failedCount === 0 && result.success) {
      // Complete success
      await completeRetrySuccess(artifact.id, workerId, result);
      return {
        success: true,
        artifactId: artifact.id,
        status: 'success',
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        failedCount: 0,
      };
    }

    if (result.createdCount > 0 || result.skippedCount > 0) {
      // Partial success - some insights created/skipped, some failed
      const isPermanent = isPermanentError(result.error);
      await completeRetryPartial(artifact.id, workerId, result, newAttemptCount, isPermanent);
      return {
        success: true,
        artifactId: artifact.id,
        status: isPermanent ? 'permanent' : 'partial',
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
        error: result.error,
      };
    }

    // Complete failure
    const isPermanent = isPermanentError(result.error);
    const isExhausted = newAttemptCount >= MAX_EXTRACTION_ATTEMPTS;

    if (isPermanent || isExhausted) {
      await completeRetryPermanent(artifact.id, workerId, result, newAttemptCount);
      return {
        success: false,
        artifactId: artifact.id,
        status: isExhausted ? 'exhausted' : 'permanent',
        createdCount: 0,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
        error: result.error,
      };
    }

    // Retryable failure - schedule next retry
    await completeRetryFailed(artifact.id, workerId, result, newAttemptCount);
    return {
      success: false,
      artifactId: artifact.id,
      status: 'failed',
      createdCount: 0,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      error: result.error,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPermanent = isPermanentError(errorMessage);
    const isExhausted = newAttemptCount >= MAX_EXTRACTION_ATTEMPTS;

    if (isPermanent || isExhausted) {
      await completeRetryPermanent(artifact.id, workerId, {
        success: false,
        createdCount: 0,
        skippedCount: 0,
        failedCount: 0,
        breakdown: {},
        error: errorMessage,
      }, newAttemptCount);

      return {
        success: false,
        artifactId: artifact.id,
        status: isExhausted ? 'exhausted' : 'permanent',
        createdCount: 0,
        skippedCount: 0,
        failedCount: 0,
        error: errorMessage,
      };
    }

    await completeRetryFailed(artifact.id, workerId, {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      breakdown: {},
      error: errorMessage,
    }, newAttemptCount);

    return {
      success: false,
      artifactId: artifact.id,
      status: 'failed',
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      error: errorMessage,
    };
  }
}

// ─── State Update Helpers ─────────────────────────────────────────────────────

async function completeRetrySuccess(
  artifactId: number,
  workerId: string,
  result: ExtractionResult,
): Promise<void> {
  await DiscoveryArtifact.update(
    {
      extraction_status: 'success',
      extraction_attempted_at: new Date(),
      extraction_failure_reason: null,
      extraction_insight_count: result.createdCount + result.skippedCount,
      extraction_next_retry_at: null,
      extraction_permanent_failure: false,
      extraction_claimed_by: null,
      extraction_claimed_at: null,
    },
    { where: { id: artifactId, extraction_claimed_by: workerId } },
  );
}

async function completeRetryPartial(
  artifactId: number,
  workerId: string,
  result: ExtractionResult,
  attemptCount: number,
  isPermanent: boolean,
): Promise<void> {
  await DiscoveryArtifact.update(
    {
      extraction_status: 'partial',
      extraction_attempted_at: new Date(),
      extraction_failure_reason: `${result.failedCount} candidates failed: ${result.error || 'unknown'}`,
      extraction_insight_count: result.createdCount + result.skippedCount,
      extraction_attempt_count: attemptCount,
      extraction_next_retry_at: isPermanent ? null : calculateNextRetryTime(attemptCount),
      extraction_permanent_failure: isPermanent,
      extraction_claimed_by: null,
      extraction_claimed_at: null,
    },
    { where: { id: artifactId, extraction_claimed_by: workerId } },
  );
}

async function completeRetryFailed(
  artifactId: number,
  workerId: string,
  result: ExtractionResult,
  attemptCount: number,
): Promise<void> {
  await DiscoveryArtifact.update(
    {
      extraction_status: 'failed',
      extraction_attempted_at: new Date(),
      extraction_failure_reason: result.error || 'Unknown error',
      extraction_insight_count: result.skippedCount,
      extraction_attempt_count: attemptCount,
      extraction_next_retry_at: calculateNextRetryTime(attemptCount),
      extraction_permanent_failure: false,
      extraction_claimed_by: null,
      extraction_claimed_at: null,
    },
    { where: { id: artifactId, extraction_claimed_by: workerId } },
  );
}

async function completeRetryPermanent(
  artifactId: number,
  workerId: string,
  result: ExtractionResult,
  attemptCount: number,
): Promise<void> {
  await DiscoveryArtifact.update(
    {
      extraction_status: 'failed',
      extraction_attempted_at: new Date(),
      extraction_failure_reason: result.error || 'Unknown permanent error',
      extraction_insight_count: result.skippedCount,
      extraction_attempt_count: attemptCount,
      extraction_next_retry_at: null,
      extraction_permanent_failure: true,
      extraction_claimed_by: null,
      extraction_claimed_at: null,
    },
    { where: { id: artifactId, extraction_claimed_by: workerId } },
  );
}

// ─── Status Queries ───────────────────────────────────────────────────────────

/**
 * Get count of artifacts pending extraction retry.
 */
export async function getRetryQueueDepth(): Promise<number> {
  const now = new Date();

  const count = await DiscoveryArtifact.count({
    where: {
      extraction_status: { [Op.in]: ['failed', 'partial'] },
      extraction_permanent_failure: false,
      extraction_attempt_count: { [Op.lt]: MAX_EXTRACTION_ATTEMPTS },
      [Op.or]: [
        { extraction_next_retry_at: null },
        { extraction_next_retry_at: { [Op.lte]: now } },
      ],
    },
    include: [{
      model: DiscoveryRun,
      as: 'discoveryRun',
      required: true,
      where: {
        discovery_type: 'desk_research',
        status: 'completed',
      },
    }],
  });

  return count;
}

/**
 * Get artifacts with exhausted retries.
 */
export async function getExhaustedArtifacts(
  projectId?: number,
  limit = 100,
): Promise<Array<{
  artifactId: number;
  publicId: string;
  attemptCount: number;
  failureReason: string | null;
  lastAttempt: Date | null;
}>> {
  const where: any = {
    [Op.or]: [
      { extraction_permanent_failure: true },
      { extraction_attempt_count: { [Op.gte]: MAX_EXTRACTION_ATTEMPTS } },
    ],
  };

  if (projectId) {
    where.project_id = projectId;
  }

  const artifacts = await DiscoveryArtifact.findAll({
    where,
    attributes: ['id', 'public_id', 'extraction_attempt_count', 'extraction_failure_reason', 'extraction_attempted_at'],
    order: [['extraction_attempted_at', 'DESC']],
    limit,
  });

  return artifacts.map((a: any) => ({
    artifactId: a.id,
    publicId: a.public_id,
    attemptCount: a.extraction_attempt_count,
    failureReason: a.extraction_failure_reason,
    lastAttempt: a.extraction_attempted_at,
  }));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  MAX_EXTRACTION_ATTEMPTS,
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  CLAIM_EXPIRY_MS,
};
