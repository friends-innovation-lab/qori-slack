/**
 * Coach Execution Diagnostics — Coach M2 Debug
 *
 * Structured diagnostic logging for Coach execution stages.
 * Designed to identify where execution blocks during provider calls.
 *
 * EXECUTION EVENTS:
 * - CONTEXT_BUILD_STARTED: Context resolution beginning
 * - CONTEXT_BUILD_COMPLETED: Context ready for provider
 * - PROVIDER_REQUEST_STARTED: About to call LLM
 * - PROVIDER_TIMEOUT_ARMED: setTimeout scheduled
 * - PROVIDER_RESPONSE_RECEIVED: LLM returned successfully
 * - PROVIDER_TIMEOUT_FIRED: Timeout promise rejected
 * - PROVIDER_REQUEST_FAILED: LLM call threw error
 * - VALIDATION_STARTED: Output validation beginning
 * - VALIDATION_COMPLETED: Output valid
 * - PERSISTENCE_STARTED: About to persist results
 * - PERSISTENCE_COMPLETED: Results saved
 *
 * PROCESS LIFECYCLE EVENTS:
 * - WORKER_STARTED: Poller started with worker_id
 * - WORKER_SHUTDOWN: Poller stopping (graceful or forced)
 *
 * These enable correlating:
 * - Did the SAME worker remain alive between PROVIDER_REQUEST_STARTED and stale recovery?
 * - Was there a process restart between events?
 *
 * NEVER LOGS:
 * - Artifact content, prompts, provider responses
 * - API keys, credentials, PII
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type ExecutionEvent =
  | 'CONTEXT_BUILD_STARTED'
  | 'CONTEXT_BUILD_COMPLETED'
  | 'PROVIDER_REQUEST_STARTED'
  | 'PROVIDER_TIMEOUT_ARMED'
  | 'PROVIDER_RESPONSE_RECEIVED'
  | 'PROVIDER_TIMEOUT_FIRED'
  | 'PROVIDER_REQUEST_FAILED'
  | 'VALIDATION_STARTED'
  | 'VALIDATION_COMPLETED'
  | 'PERSISTENCE_STARTED'
  | 'PERSISTENCE_COMPLETED'
  | 'WORKER_STARTED'
  | 'WORKER_SHUTDOWN';

/**
 * Diagnostic log entry.
 */
export interface ExecutionDiagnostic {
  event: ExecutionEvent;
  timestamp: string;
  run_id: string;
  worker_id: string;
  attempt_count?: number;
  provider?: string;
  model?: string;
  timeout_ms?: number;
  elapsed_ms?: number;
  message?: string;
}

/**
 * Process lifecycle diagnostic entry.
 * Separate from ExecutionDiagnostic because it's not run-scoped.
 */
export interface ProcessLifecycleDiagnostic {
  event: 'WORKER_STARTED' | 'WORKER_SHUTDOWN';
  timestamp: string;
  worker_id: string;
  process_pid: number;
  startup_timestamp: string;
  /** Optional deployment/container identifier from environment */
  deployment_id?: string;
  /** Optional Railway-specific metadata if available */
  railway_deployment_id?: string;
  current_run_id?: string | null;
  message?: string;
}

// ─── Diagnostic Logger ──────────────────────────────────────────────────

/**
 * Log a structured execution diagnostic event.
 *
 * Uses console.log with JSON for structured logging.
 * Prefix [Coach Execution] for easy filtering.
 */
export function logExecutionDiagnostic(diag: ExecutionDiagnostic): void {
  const entry = {
    ...diag,
    _tag: 'COACH_EXECUTION_DIAG',
  };
  console.log(`[Coach Execution] ${diag.event}`, JSON.stringify(entry));
}

// ─── Convenience Helpers ────────────────────────────────────────────────

/**
 * Log context build started.
 */
export function logContextBuildStarted(
  runId: string,
  workerId: string,
  attemptCount: number,
): void {
  logExecutionDiagnostic({
    event: 'CONTEXT_BUILD_STARTED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    attempt_count: attemptCount,
  });
}

/**
 * Log context build completed.
 */
export function logContextBuildCompleted(
  runId: string,
  workerId: string,
  elapsedMs: number,
): void {
  logExecutionDiagnostic({
    event: 'CONTEXT_BUILD_COMPLETED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    elapsed_ms: elapsedMs,
  });
}

/**
 * Log provider request started.
 */
export function logProviderRequestStarted(
  runId: string,
  workerId: string,
  provider: string,
  model: string,
  timeoutMs: number,
): void {
  logExecutionDiagnostic({
    event: 'PROVIDER_REQUEST_STARTED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    provider,
    model,
    timeout_ms: timeoutMs,
  });
}

/**
 * Log provider timeout armed.
 */
export function logProviderTimeoutArmed(
  runId: string,
  workerId: string,
  timeoutMs: number,
): void {
  logExecutionDiagnostic({
    event: 'PROVIDER_TIMEOUT_ARMED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    timeout_ms: timeoutMs,
  });
}

/**
 * Log provider response received.
 */
export function logProviderResponseReceived(
  runId: string,
  workerId: string,
  elapsedMs: number,
): void {
  logExecutionDiagnostic({
    event: 'PROVIDER_RESPONSE_RECEIVED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    elapsed_ms: elapsedMs,
  });
}

/**
 * Log provider timeout fired.
 */
export function logProviderTimeoutFired(
  runId: string,
  workerId: string,
  timeoutMs: number,
  elapsedMs: number,
): void {
  logExecutionDiagnostic({
    event: 'PROVIDER_TIMEOUT_FIRED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    timeout_ms: timeoutMs,
    elapsed_ms: elapsedMs,
    message: `Timeout fired after ${elapsedMs}ms (configured: ${timeoutMs}ms)`,
  });
}

/**
 * Log provider request failed.
 */
export function logProviderRequestFailed(
  runId: string,
  workerId: string,
  failureCode: string,
  elapsedMs: number,
): void {
  logExecutionDiagnostic({
    event: 'PROVIDER_REQUEST_FAILED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    elapsed_ms: elapsedMs,
    message: `Failed with code: ${failureCode}`,
  });
}

/**
 * Log validation started.
 */
export function logValidationStarted(
  runId: string,
  workerId: string,
): void {
  logExecutionDiagnostic({
    event: 'VALIDATION_STARTED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
  });
}

/**
 * Log validation completed.
 */
export function logValidationCompleted(
  runId: string,
  workerId: string,
  elapsedMs: number,
): void {
  logExecutionDiagnostic({
    event: 'VALIDATION_COMPLETED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    elapsed_ms: elapsedMs,
  });
}

/**
 * Log persistence started.
 */
export function logPersistenceStarted(
  runId: string,
  workerId: string,
): void {
  logExecutionDiagnostic({
    event: 'PERSISTENCE_STARTED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
  });
}

/**
 * Log persistence completed.
 */
export function logPersistenceCompleted(
  runId: string,
  workerId: string,
  elapsedMs: number,
): void {
  logExecutionDiagnostic({
    event: 'PERSISTENCE_COMPLETED',
    timestamp: new Date().toISOString(),
    run_id: runId,
    worker_id: workerId,
    elapsed_ms: elapsedMs,
  });
}

// ─── Process Lifecycle Helpers ──────────────────────────────────────────

/** Captured at module load for startup correlation */
const PROCESS_STARTUP_TIMESTAMP = new Date().toISOString();

/**
 * Log process lifecycle diagnostic.
 */
function logProcessLifecycle(diag: ProcessLifecycleDiagnostic): void {
  const entry = {
    ...diag,
    _tag: 'COACH_PROCESS_LIFECYCLE',
  };
  console.log(`[Coach Lifecycle] ${diag.event}`, JSON.stringify(entry));
}

/**
 * Get optional environment metadata for deployment correlation.
 * Uses environment variables if already exposed, does not introduce
 * Railway-specific architecture into Coach.
 */
function getDeploymentMetadata(): { deployment_id?: string; railway_deployment_id?: string } {
  return {
    // Generic deployment identifier (Heroku, Render, etc.)
    deployment_id: process.env.DEPLOYMENT_ID || process.env.RENDER_SERVICE_ID || undefined,
    // Railway-specific if available
    railway_deployment_id: process.env.RAILWAY_DEPLOYMENT_ID || undefined,
  };
}

/**
 * Log worker started.
 * Called when poller starts with a new worker_id.
 */
export function logWorkerStarted(workerId: string): void {
  const metadata = getDeploymentMetadata();
  logProcessLifecycle({
    event: 'WORKER_STARTED',
    timestamp: new Date().toISOString(),
    worker_id: workerId,
    process_pid: process.pid,
    startup_timestamp: PROCESS_STARTUP_TIMESTAMP,
    ...metadata,
  });
}

/**
 * Log worker shutdown.
 * Called when poller stops (graceful shutdown or forced).
 */
export function logWorkerShutdownEvent(
  workerId: string,
  currentRunId: string | null,
  reason?: string,
): void {
  const metadata = getDeploymentMetadata();
  logProcessLifecycle({
    event: 'WORKER_SHUTDOWN',
    timestamp: new Date().toISOString(),
    worker_id: workerId,
    process_pid: process.pid,
    startup_timestamp: PROCESS_STARTUP_TIMESTAMP,
    current_run_id: currentRunId,
    message: reason,
    ...metadata,
  });
}
