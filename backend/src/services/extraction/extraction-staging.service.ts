/**
 * Extraction Staging Service — DISC-WEB-1
 *
 * Manages server-bound extraction references for Workspace document upload.
 *
 * Lifecycle: ready → consumed | expired | failed
 *
 * Security guarantees:
 * - Refs are project-scoped (cannot cross projects)
 * - Refs are actor-owned (only creator can consume)
 * - Refs are single-use (marked consumed on run creation)
 * - Refs have 30-minute TTL
 * - All validation happens server-side (client cannot forge refs)
 */

import { Op, QueryTypes, type Transaction } from 'sequelize';
import sequelize from '../../database';
import type { ExtractionStaging, ExtractionStagingStatus } from '../../database/models/extraction_staging';
import type { ExtractionOutcome } from './extraction.service';

// Type-safe model reference
const ExtractionStagingModel = sequelize.models.ExtractionStaging as typeof ExtractionStaging;

/**
 * Validation result for a single ref token.
 */
export interface RefValidationResult {
  valid: boolean;
  reason?: 'not_found' | 'wrong_project' | 'wrong_actor' | 'consumed' | 'expired' | 'failed';
  staging?: ExtractionStaging;
}

/**
 * Result of consuming multiple refs.
 */
export interface ConsumeRefsResult {
  success: boolean;
  consumedRefs: ExtractionStaging[];
  errors: Array<{ refToken: string; reason: string }>;
  /** If all refs were already consumed by the same run, return that run ID */
  existingRunId?: number;
}

/**
 * Create a staging row for a successful extraction.
 */
export async function createStagingRow(params: {
  projectId: number;
  actorId: number;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;
  contentHash: string;
  extractedText: string;
  charCount: number;
  transaction?: Transaction;
}): Promise<ExtractionStaging> {
  const row = await ExtractionStagingModel.create(
    {
      project_id: params.projectId,
      actor_id: params.actorId,
      filename: params.filename,
      mime_type: params.mimeType,
      file_size_bytes: params.fileSizeBytes,
      file_hash: params.fileHash,
      content_hash: params.contentHash,
      extracted_text: params.extractedText,
      char_count: params.charCount,
      status: 'ready',
    },
    { transaction: params.transaction },
  );

  return row;
}

/**
 * Create a staging row for a failed extraction (for debugging/audit).
 */
export async function createFailedStagingRow(params: {
  projectId: number;
  actorId: number;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;
  errorCode: string;
  errorMessage: string;
  transaction?: Transaction;
}): Promise<ExtractionStaging> {
  const row = await ExtractionStagingModel.create(
    {
      project_id: params.projectId,
      actor_id: params.actorId,
      filename: params.filename,
      mime_type: params.mimeType,
      file_size_bytes: params.fileSizeBytes,
      file_hash: params.fileHash,
      content_hash: '', // Empty for failed extractions
      extracted_text: '', // Empty for failed extractions
      char_count: 0,
      status: 'failed',
      error_code: params.errorCode,
      error_message: params.errorMessage,
    },
    { transaction: params.transaction },
  );

  return row;
}

/**
 * Validate a single ref token.
 */
export async function validateRefToken(
  refToken: string,
  projectId: number,
  actorId: number,
  transaction?: Transaction,
): Promise<RefValidationResult> {
  const staging = await ExtractionStagingModel.findOne({
    where: { ref_token: refToken },
    transaction,
  });

  if (!staging) {
    return { valid: false, reason: 'not_found' };
  }

  if (staging.project_id !== projectId) {
    return { valid: false, reason: 'wrong_project' };
  }

  if (staging.actor_id !== actorId) {
    return { valid: false, reason: 'wrong_actor' };
  }

  if (staging.status === 'consumed') {
    return { valid: false, reason: 'consumed', staging };
  }

  if (staging.status === 'expired') {
    return { valid: false, reason: 'expired' };
  }

  if (staging.status === 'failed') {
    return { valid: false, reason: 'failed' };
  }

  // Check TTL
  if (new Date() > staging.expires_at) {
    // Mark as expired for future queries
    await staging.update({ status: 'expired' }, { transaction });
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, staging };
}

/**
 * Validate and consume multiple refs atomically.
 * All-or-nothing: if any ref is invalid, none are consumed.
 *
 * Special case: If ALL refs are already consumed by the SAME run,
 * returns that run ID for idempotent retry handling.
 */
export async function validateAndConsumeRefs(
  refTokens: string[],
  projectId: number,
  actorId: number,
  runId: number,
  transaction: Transaction,
): Promise<ConsumeRefsResult> {
  // Lock rows for update to prevent race conditions
  const stagingRows = await ExtractionStagingModel.findAll({
    where: { ref_token: { [Op.in]: refTokens } },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  const errors: Array<{ refToken: string; reason: string }> = [];
  const validRefs: ExtractionStaging[] = [];
  const consumedRefs: ExtractionStaging[] = [];

  for (const refToken of refTokens) {
    const staging = stagingRows.find((r) => r.ref_token === refToken);

    if (!staging) {
      errors.push({ refToken, reason: 'not_found' });
      continue;
    }

    if (staging.project_id !== projectId) {
      errors.push({ refToken, reason: 'wrong_project' });
      continue;
    }

    if (staging.actor_id !== actorId) {
      errors.push({ refToken, reason: 'wrong_actor' });
      continue;
    }

    if (staging.status === 'consumed') {
      consumedRefs.push(staging);
      continue;
    }

    if (staging.status === 'expired' || staging.status === 'failed') {
      errors.push({ refToken, reason: staging.status });
      continue;
    }

    // Check TTL
    if (new Date() > staging.expires_at) {
      await staging.update({ status: 'expired' }, { transaction });
      errors.push({ refToken, reason: 'expired' });
      continue;
    }

    validRefs.push(staging);
  }

  // Check for idempotent retry: all refs consumed by same run
  if (consumedRefs.length === refTokens.length && errors.length === 0) {
    const runIds = new Set(consumedRefs.map((r) => r.consumed_by_run_id));
    if (runIds.size === 1) {
      const existingRunId = [...runIds][0];
      if (existingRunId !== null) {
        return {
          success: true,
          consumedRefs,
          errors: [],
          existingRunId,
        };
      }
    }
  }

  // If any errors or some consumed but not all by same run, fail
  if (errors.length > 0 || consumedRefs.length > 0) {
    // Add consumed refs to errors for reporting
    for (const ref of consumedRefs) {
      errors.push({ refToken: ref.ref_token, reason: 'consumed' });
    }
    return {
      success: false,
      consumedRefs: [],
      errors,
    };
  }

  // All valid — consume atomically
  const now = new Date();
  for (const staging of validRefs) {
    await staging.update(
      {
        status: 'consumed',
        consumed_by_run_id: runId,
        consumed_at: now,
      },
      { transaction },
    );
  }

  return {
    success: true,
    consumedRefs: validRefs,
    errors: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1B: SPLIT VALIDATION AND CONSUMPTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validated staging refs ready for consumption.
 * Passed from validateRefsForConsumption to consumeValidatedRefs.
 */
export interface ValidatedStagingRefs {
  /** IDs of staging rows that passed validation (in ready status) */
  validatedIds: number[];
  /** Full staging rows for creating EvidenceSources */
  stagingRows: ExtractionStaging[];
}

/**
 * Result of validation-only check.
 */
export interface ValidationResult {
  success: boolean;
  validated?: ValidatedStagingRefs;
  errors: Array<{ refToken: string; reason: string }>;
}

/**
 * DISC-WEB-1B: Validate refs for consumption WITHOUT marking them consumed.
 *
 * This is the first half of the split validation/consumption pattern.
 * Rows are locked FOR UPDATE to prevent concurrent consumption.
 *
 * Caller MUST:
 * 1. Call this within a transaction
 * 2. Call consumeValidatedRefs with the result in the SAME transaction
 * 3. Commit or rollback the transaction
 *
 * @param refTokens - Array of ref tokens to validate
 * @param projectId - Project scope for validation
 * @param actorId - Actor scope for validation
 * @param transaction - REQUIRED transaction for row locking
 * @returns ValidationResult with validated IDs or errors
 */
export async function validateRefsForConsumption(
  refTokens: string[],
  projectId: number,
  actorId: number,
  transaction: Transaction,
): Promise<ValidationResult> {
  // Lock rows for update to prevent race conditions
  const stagingRows = await ExtractionStagingModel.findAll({
    where: { ref_token: { [Op.in]: refTokens } },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  const errors: Array<{ refToken: string; reason: string }> = [];
  const validRefs: ExtractionStaging[] = [];

  for (const refToken of refTokens) {
    const staging = stagingRows.find((r) => r.ref_token === refToken);

    if (!staging) {
      errors.push({ refToken, reason: 'not_found' });
      continue;
    }

    if (staging.project_id !== projectId) {
      errors.push({ refToken, reason: 'wrong_project' });
      continue;
    }

    if (staging.actor_id !== actorId) {
      errors.push({ refToken, reason: 'wrong_actor' });
      continue;
    }

    // DISC-WEB-1B: Consumed refs are NOT replayable via ref tokens
    // Replay must use idempotency key at the run level
    if (staging.status === 'consumed') {
      errors.push({ refToken, reason: 'consumed' });
      continue;
    }

    if (staging.status === 'expired') {
      errors.push({ refToken, reason: 'expired' });
      continue;
    }

    if (staging.status === 'failed') {
      errors.push({ refToken, reason: 'failed' });
      continue;
    }

    // Check TTL
    if (new Date() > staging.expires_at) {
      await staging.update({ status: 'expired' }, { transaction });
      errors.push({ refToken, reason: 'expired' });
      continue;
    }

    validRefs.push(staging);
  }

  // All-or-nothing: any error fails the entire validation
  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    validated: {
      validatedIds: validRefs.map((r) => r.id),
      stagingRows: validRefs,
    },
    errors: [],
  };
}

/**
 * DISC-WEB-1B: Consume previously validated refs.
 *
 * Uses conditional UPDATE with affected-row verification to ensure
 * rows are still in 'ready' status. This prevents TOCTOU races
 * even within the same transaction if isolation allows anomalies.
 *
 * @param validated - Result from validateRefsForConsumption
 * @param runId - Discovery run ID to associate with consumption
 * @param transaction - SAME transaction used in validation
 * @returns Number of rows consumed (must equal validatedIds.length)
 * @throws Error if affected rows don't match expected (race condition)
 */
export async function consumeValidatedRefs(
  validated: ValidatedStagingRefs,
  runId: number,
  transaction: Transaction,
): Promise<number> {
  if (validated.validatedIds.length === 0) {
    return 0;
  }

  const now = new Date();

  // Conditional UPDATE: only update rows still in 'ready' status
  // This catches any TOCTOU race (however unlikely within transaction)
  // Use bind array ($1, $2, etc.) for PostgreSQL array handling
  const [result] = await sequelize.query(
    `
    UPDATE extraction_staging
    SET status = 'consumed',
        consumed_by_run_id = $1,
        consumed_at = $2,
        updated_at = $2
    WHERE id = ANY($3::int[])
      AND status = 'ready'
    RETURNING id
    `,
    {
      bind: [runId, now, validated.validatedIds],
      transaction,
    },
  );

  // Verify affected row count matches expected
  const affectedCount = Array.isArray(result) ? result.length : 0;

  if (affectedCount !== validated.validatedIds.length) {
    throw new Error(
      `Staging consumption race: expected ${validated.validatedIds.length} rows, ` +
      `updated ${affectedCount}. Some refs were consumed or expired concurrently.`,
    );
  }

  return affectedCount;
}

/**
 * Get staging row by ref token.
 */
export async function getStagingByRefToken(
  refToken: string,
  transaction?: Transaction,
): Promise<ExtractionStaging | null> {
  return ExtractionStagingModel.findOne({
    where: { ref_token: refToken },
    transaction,
  });
}

/**
 * Mark expired refs as expired.
 * Called by cleanup job.
 */
export async function markExpiredRefs(transaction?: Transaction): Promise<number> {
  const [affectedCount] = await ExtractionStagingModel.update(
    { status: 'expired' },
    {
      where: {
        status: 'ready',
        expires_at: { [Op.lt]: new Date() },
      },
      transaction,
    },
  );

  return affectedCount ?? 0;
}

/**
 * Delete old terminal refs (expired, failed, consumed).
 * Called by cleanup job.
 *
 * EVIDENCE PRESERVATION INVARIANT:
 * Deleting consumed staging rows is SAFE because:
 * - EvidenceSource (permanent) is linked via DiscoveryRunSource (join table)
 * - There is NO direct FK from ExtractionStaging to EvidenceSource
 * - Run creation COPIES extracted text to EvidenceSource.artifact_ref
 * - Staging is temporary holding area; evidence is permanent record
 *
 * @param olderThanHours - Delete refs older than this many hours
 */
export async function deleteOldTerminalRefs(
  olderThanHours: number = 24,
  transaction?: Transaction,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const deletedCount = await ExtractionStagingModel.destroy({
    where: {
      status: { [Op.in]: ['expired', 'failed'] },
      created_at: { [Op.lt]: cutoff },
    },
    transaction,
  });

  // Also delete consumed refs where consumed_at is old
  const deletedConsumed = await ExtractionStagingModel.destroy({
    where: {
      status: 'consumed',
      consumed_at: { [Op.lt]: cutoff },
    },
    transaction,
  });

  return deletedCount + deletedConsumed;
}

/**
 * Get staging stats for monitoring.
 */
export async function getStagingStats(): Promise<{
  ready: number;
  consumed: number;
  expired: number;
  failed: number;
  total: number;
}> {
  const results = await sequelize.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM extraction_staging GROUP BY status`,
    { type: QueryTypes.SELECT },
  );

  const stats: Record<string, number> = {
    ready: 0,
    consumed: 0,
    expired: 0,
    failed: 0,
    total: 0,
  };

  for (const row of results) {
    const count = parseInt(row.count, 10);
    if (row.status in stats) {
      stats[row.status] = count;
    }
    stats.total += count;
  }

  return {
    ready: stats.ready,
    consumed: stats.consumed,
    expired: stats.expired,
    failed: stats.failed,
    total: stats.total,
  };
}

/**
 * Run cleanup job with advisory lock.
 * Safe for concurrent execution — only one will run at a time.
 */
export async function runCleanupJob(): Promise<{
  markedExpired: number;
  deleted: number;
}> {
  const lockId = hashToInt32('extraction_staging_cleanup');

  const transaction = await sequelize.transaction();

  try {
    // Try to acquire transaction-scoped advisory lock
    const results = await sequelize.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1) as acquired',
      {
        bind: [lockId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const result = results[0];
    if (!result || !result.acquired) {
      await transaction.rollback();
      console.log('[CLEANUP] Another cleanup job is running, skipping');
      return { markedExpired: 0, deleted: 0 };
    }

    // Run cleanup within transaction (lock auto-released on commit/rollback)
    const markedExpired = await markExpiredRefs(transaction);
    const deleted = await deleteOldTerminalRefs(24, transaction);

    await transaction.commit();

    console.log(`[CLEANUP] Marked ${markedExpired} expired, deleted ${deleted} old refs`);
    return { markedExpired, deleted };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Hash string to 32-bit signed integer for pg_advisory_lock.
 */
function hashToInt32(str: string): number {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(str).digest();
  return hash.readInt32LE(0);
}
