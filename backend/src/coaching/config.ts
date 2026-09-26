/**
 * Coach Execution Configuration — Coach M2
 *
 * Configurable operational defaults for Coach execution. All values can be
 * overridden via environment variables. No hard-coded domain literals.
 *
 * Configuration categories:
 * - Polling: run claim timing
 * - Heartbeat: worker liveness signaling
 * - Stale recovery: abandoned run detection
 * - Operational retry: bounded retry policy
 * - Provider: timeout and retry defaults
 * - Rate limits: concurrency guards
 */

// ─── Polling Configuration ──────────────────────────────────────────────

/** Interval between poll cycles (ms). Default: 1000ms (1 second). */
export const COACH_POLL_INTERVAL_MS = parseInt(
  process.env.COACH_POLL_INTERVAL_MS || '1000',
  10
);

// ─── Heartbeat Configuration ────────────────────────────────────────────

/** Interval between heartbeat updates (ms). Default: 15000ms (15 seconds). */
export const COACH_HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.COACH_HEARTBEAT_INTERVAL_MS || '15000',
  10
);

// ─── Stale Recovery Configuration ───────────────────────────────────────

/**
 * Time since last heartbeat before a running job is considered stale (ms).
 * Default: 120000ms (2 minutes).
 *
 * Must be significantly longer than heartbeat interval to avoid false positives.
 */
export const COACH_STALE_TIMEOUT_MS = parseInt(
  process.env.COACH_STALE_TIMEOUT_MS || '120000',
  10
);

// ─── Operational Retry Configuration ────────────────────────────────────

/**
 * Maximum operational attempts per run. Default: 3.
 *
 * After this many attempts, run transitions to failed with MAX_ATTEMPTS_EXCEEDED.
 * Researcher retry creates a new run; this is for same-run operational retry.
 */
export const COACH_MAX_ATTEMPTS = parseInt(
  process.env.COACH_MAX_ATTEMPTS || '3',
  10
);

// ─── Provider Configuration ─────────────────────────────────────────────

/**
 * Default provider timeout (ms). Default: 60000ms (60 seconds).
 * Individual contracts can override this.
 */
export const COACH_PROVIDER_TIMEOUT_MS = parseInt(
  process.env.COACH_PROVIDER_TIMEOUT_MS || '60000',
  10
);

/**
 * Default repair attempts for invalid structured output. Default: 1.
 * Individual contracts can override this.
 */
export const COACH_DEFAULT_REPAIR_ATTEMPTS = parseInt(
  process.env.COACH_DEFAULT_REPAIR_ATTEMPTS || '1',
  10
);

// ─── Rate / Concurrency Limits ──────────────────────────────────────────

/**
 * Maximum concurrent active runs per user. Default: 3.
 * Prevents a single user from monopolizing Coach resources.
 */
export const COACH_MAX_ACTIVE_PER_USER = parseInt(
  process.env.COACH_MAX_ACTIVE_PER_USER || '3',
  10
);

/**
 * Maximum concurrent active runs per study. Default: 5.
 * Prevents runaway automation from overwhelming a single study.
 */
export const COACH_MAX_ACTIVE_PER_STUDY = parseInt(
  process.env.COACH_MAX_ACTIVE_PER_STUDY || '5',
  10
);

// ─── Worker Identity ────────────────────────────────────────────────────

/**
 * Worker ID prefix. Combined with process/instance ID for unique worker identity.
 */
export const COACH_WORKER_PREFIX = process.env.COACH_WORKER_PREFIX || 'coach-worker';

/**
 * Generate a unique worker ID for this instance.
 */
export function generateWorkerId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${COACH_WORKER_PREFIX}-${timestamp}-${random}`;
}

// ─── Contract Configuration ─────────────────────────────────────────────

/** Current active Brief coaching contract version. */
export const COACH_BRIEF_CONTRACT_VERSION = process.env.COACH_BRIEF_CONTRACT_VERSION || '1.0.0';

/** Current active Plan coaching contract version. */
export const COACH_PLAN_CONTRACT_VERSION = process.env.COACH_PLAN_CONTRACT_VERSION || '1.0.0';

// ─── Poller Control ─────────────────────────────────────────────────────

/**
 * Whether to enable the Coach poller on startup.
 * Disable in test environments unless intentionally testing the poller.
 * Default: enabled in production/development, disabled in test.
 */
export const COACH_POLLER_ENABLED =
  process.env.COACH_POLLER_ENABLED !== undefined
    ? process.env.COACH_POLLER_ENABLED === 'true'
    : process.env.NODE_ENV !== 'test';

// ─── Output Limits ──────────────────────────────────────────────────────

/** Maximum items per category (strength, issue, suggestion, question). */
export const COACH_MAX_ITEMS_PER_CATEGORY = parseInt(
  process.env.COACH_MAX_ITEMS_PER_CATEGORY || '5',
  10
);

/** Minimum items per category (do not fill quotas). */
export const COACH_MIN_ITEMS_PER_CATEGORY = 0;

// ─── Context Budget ─────────────────────────────────────────────────────

/**
 * Default maximum context tokens. Default: 50000.
 * Individual contracts can override this.
 */
export const COACH_DEFAULT_CONTEXT_BUDGET_TOKENS = parseInt(
  process.env.COACH_DEFAULT_CONTEXT_BUDGET_TOKENS || '50000',
  10
);
