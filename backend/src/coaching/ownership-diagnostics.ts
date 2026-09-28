/**
 * Coach Ownership Diagnostics — Coach M2 Debug
 *
 * Structured diagnostic logging for Coach claim ownership lifecycle.
 * Designed to capture evidence for why validateClaimOwnership() fails
 * shortly after a successful claim.
 *
 * DIAGNOSTIC EVENTS:
 * - CLAIM_ACQUIRED: Worker successfully claimed a pending run
 * - EXECUTION_STARTED: Worker began executing a claimed run
 * - HEARTBEAT_UPDATED: Heartbeat successfully updated
 * - HEARTBEAT_REJECTED: Heartbeat update returned false (0 rows affected)
 * - CLAIM_VALIDATION_SUCCEEDED: validateClaimOwnership returned true
 * - CLAIM_VALIDATION_FAILED: validateClaimOwnership returned false
 * - STALE_RECOVERY_CANDIDATE: Run identified as stale
 * - STALE_RECOVERY_ACQUIRED: Worker reclaimed a stale run
 * - STALE_RECOVERY_REJECTED: Stale recovery did not find any runs
 * - EXECUTION_COMPLETED: Run completed successfully
 * - EXECUTION_FAILED: Run failed with error
 * - WORKER_SHUTDOWN: Poller shutdown initiated
 *
 * NEVER LOGS:
 * - Artifact content, prompts, provider responses
 * - API keys, credentials, PII
 * - Comment content
 */

import { QueryTypes } from 'sequelize';
import sequelize from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export type OwnershipEvent =
  | 'CLAIM_ACQUIRED'
  | 'EXECUTION_STARTED'
  | 'HEARTBEAT_UPDATED'
  | 'HEARTBEAT_REJECTED'
  | 'CLAIM_VALIDATION_SUCCEEDED'
  | 'CLAIM_VALIDATION_FAILED'
  | 'STALE_RECOVERY_CANDIDATE'
  | 'STALE_RECOVERY_ACQUIRED'
  | 'STALE_RECOVERY_REJECTED'
  | 'STALE_FAILURE_RECORDED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_FAILED'
  | 'WORKER_SHUTDOWN';

/**
 * Ownership state snapshot from database.
 */
export interface OwnershipState {
  status: string | null;
  worker_id: string | null;
  attempt_count: number | null;
  claimed_at: string | null;
  heartbeat_at: string | null;
}

/**
 * Diagnostic log entry.
 */
export interface OwnershipDiagnostic {
  event: OwnershipEvent;
  timestamp: string;
  run_id?: string;
  worker_id?: string;
  attempt_count?: number;
  expected?: {
    status?: string;
    worker_id?: string;
    attempt_count?: number;
  };
  actual?: OwnershipState;
  stale_age_seconds?: number;
  stale_threshold_seconds?: number;
  db_now?: string;
  message?: string;
}

// ─── Diagnostic Logger ──────────────────────────────────────────────────

/**
 * Log a structured ownership diagnostic event.
 *
 * Uses console.log with JSON for structured logging.
 * Prefix [Coach Ownership] for easy filtering.
 */
export function logOwnershipDiagnostic(diag: OwnershipDiagnostic): void {
  const entry = {
    ...diag,
    _tag: 'COACH_OWNERSHIP_DIAG',
  };
  console.log(`[Coach Ownership] ${diag.event}`, JSON.stringify(entry));
}

// ─── Database State Query ───────────────────────────────────────────────

/**
 * Query current ownership state of a run from the database.
 *
 * Used when ownership fails to capture actual DB state for diagnosis.
 */
export async function queryOwnershipState(runId: string): Promise<OwnershipState | null> {
  const result = await sequelize.query<{
    status: string;
    worker_id: string | null;
    attempt_count: number;
    claimed_at: Date | null;
    heartbeat_at: Date | null;
  }>(
    `
    SELECT status, worker_id, attempt_count, claimed_at, heartbeat_at
    FROM coaching_runs
    WHERE id = :runId
    `,
    {
      replacements: { runId },
      type: QueryTypes.SELECT,
    },
  );

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    status: row.status,
    worker_id: row.worker_id,
    attempt_count: row.attempt_count,
    claimed_at: row.claimed_at?.toISOString() ?? null,
    heartbeat_at: row.heartbeat_at?.toISOString() ?? null,
  };
}

/**
 * Query current database time.
 *
 * Used to compare with heartbeat_at for stale age calculation.
 */
export async function queryDbNow(): Promise<string> {
  const result = await sequelize.query<{ now: Date }>(
    'SELECT NOW() as now',
    { type: QueryTypes.SELECT },
  );
  return result[0].now.toISOString();
}

/**
 * Query stale candidate info for diagnostics.
 *
 * Returns runs that WOULD be considered stale by the current query.
 */
export async function queryStaleCandidate(
  staleTimeoutSeconds: number,
  maxAttempts: number,
): Promise<Array<{
  id: string;
  status: string;
  worker_id: string | null;
  attempt_count: number;
  heartbeat_at: Date | null;
  age_seconds: number;
}>> {
  const result = await sequelize.query<{
    id: string;
    status: string;
    worker_id: string | null;
    attempt_count: number;
    heartbeat_at: Date | null;
    age_seconds: string;
  }>(
    `
    SELECT
      id,
      status,
      worker_id,
      attempt_count,
      heartbeat_at,
      EXTRACT(EPOCH FROM (NOW() - heartbeat_at)) as age_seconds
    FROM coaching_runs
    WHERE status = 'running'
      AND heartbeat_at < NOW() - INTERVAL '${staleTimeoutSeconds} seconds'
      AND attempt_count < :maxAttempts
    ORDER BY heartbeat_at ASC
    LIMIT 5
    `,
    {
      replacements: { maxAttempts },
      type: QueryTypes.SELECT,
    },
  );

  return result.map(row => ({
    ...row,
    age_seconds: parseFloat(row.age_seconds),
  }));
}

// ─── Convenience Diagnostic Helpers ─────────────────────────────────────

/**
 * Log claim acquired event.
 */
export function logClaimAcquired(
  runId: string,
  workerId: string,
  attemptCount: number,
): void {
  logOwnershipDiagnostic({
    event: 'CLAIM_ACQUIRED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    attempt_count: attemptCount,
  });
}

/**
 * Log execution started event.
 */
export function logExecutionStarted(
  runId: string,
  workerId: string,
  attemptCount: number,
): void {
  logOwnershipDiagnostic({
    event: 'EXECUTION_STARTED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    attempt_count: attemptCount,
  });
}

/**
 * Log heartbeat updated event.
 */
export function logHeartbeatUpdated(runId: string, workerId: string): void {
  logOwnershipDiagnostic({
    event: 'HEARTBEAT_UPDATED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
  });
}

/**
 * Log heartbeat rejected event with actual DB state.
 */
export async function logHeartbeatRejected(
  runId: string,
  expectedWorkerId: string,
): Promise<void> {
  const actual = await queryOwnershipState(runId);
  const dbNow = await queryDbNow();

  logOwnershipDiagnostic({
    event: 'HEARTBEAT_REJECTED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    expected: {
      status: 'running',
      worker_id: expectedWorkerId,
    },
    actual: actual ?? undefined,
    db_now: dbNow,
  });
}

/**
 * Log claim validation succeeded.
 */
export function logClaimValidationSucceeded(
  runId: string,
  workerId: string,
): void {
  logOwnershipDiagnostic({
    event: 'CLAIM_VALIDATION_SUCCEEDED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
  });
}

/**
 * Log claim validation failed with actual DB state.
 */
export async function logClaimValidationFailed(
  runId: string,
  expectedWorkerId: string,
  expectedAttemptCount?: number,
): Promise<void> {
  const actual = await queryOwnershipState(runId);
  const dbNow = await queryDbNow();

  logOwnershipDiagnostic({
    event: 'CLAIM_VALIDATION_FAILED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    expected: {
      status: 'running',
      worker_id: expectedWorkerId,
      attempt_count: expectedAttemptCount,
    },
    actual: actual ?? undefined,
    db_now: dbNow,
    message: actual
      ? `Expected worker_id=${expectedWorkerId}, status=running. Got worker_id=${actual.worker_id}, status=${actual.status}`
      : 'Run not found in database',
  });
}

/**
 * Log stale recovery candidate found.
 */
export function logStaleRecoveryCandidate(
  runId: string,
  previousWorkerId: string | null,
  attemptCount: number,
  heartbeatAt: string | null,
  ageSeconds: number,
  thresholdSeconds: number,
): void {
  logOwnershipDiagnostic({
    event: 'STALE_RECOVERY_CANDIDATE',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: previousWorkerId ?? undefined,
    attempt_count: attemptCount,
    stale_age_seconds: ageSeconds,
    stale_threshold_seconds: thresholdSeconds,
    message: `Heartbeat at ${heartbeatAt}, age ${ageSeconds.toFixed(1)}s > threshold ${thresholdSeconds}s`,
  });
}

/**
 * Log stale recovery acquired.
 */
export function logStaleRecoveryAcquired(
  runId: string,
  previousWorkerId: string | null,
  newWorkerId: string,
  newAttemptCount: number,
): void {
  logOwnershipDiagnostic({
    event: 'STALE_RECOVERY_ACQUIRED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: newWorkerId,
    attempt_count: newAttemptCount,
    expected: {
      worker_id: previousWorkerId ?? undefined,
    },
    message: `Recovered from worker ${previousWorkerId ?? 'null'} to ${newWorkerId}`,
  });
}

/**
 * Log stale failure recorded (max attempts exceeded).
 */
export function logStaleFailureRecorded(
  runId: string,
  attemptCount: number,
  maxAttempts: number,
): void {
  logOwnershipDiagnostic({
    event: 'STALE_FAILURE_RECORDED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    attempt_count: attemptCount,
    message: `Attempt count ${attemptCount} >= max ${maxAttempts}, marked as MAX_ATTEMPTS_EXCEEDED`,
  });
}

/**
 * Log stale recovery rejected (no stale runs found).
 */
export function logStaleRecoveryRejected(workerId: string): void {
  logOwnershipDiagnostic({
    event: 'STALE_RECOVERY_REJECTED',
    timestamp: new Date().toISOString(),
    worker_id: workerId,
    message: 'No stale runs found to recover',
  });
}

/**
 * Log execution completed.
 */
export function logExecutionCompleted(runId: string, workerId: string): void {
  logOwnershipDiagnostic({
    event: 'EXECUTION_COMPLETED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
  });
}

/**
 * Log execution failed.
 */
export function logExecutionFailed(
  runId: string,
  workerId: string,
  failureCode: string,
): void {
  logOwnershipDiagnostic({
    event: 'EXECUTION_FAILED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    message: `Failure code: ${failureCode}`,
  });
}

/**
 * Log worker shutdown.
 */
export function logWorkerShutdown(
  workerId: string,
  currentRunId: string | null,
): void {
  logOwnershipDiagnostic({
    event: 'WORKER_SHUTDOWN',
    timestamp: new Date().toISOString(),
    worker_id: workerId,
    run_id: currentRunId ?? undefined,
    message: currentRunId
      ? `Shutting down while processing run ${currentRunId}`
      : 'Shutting down with no active run',
  });
}
