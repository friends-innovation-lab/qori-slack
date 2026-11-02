/**
 * Controlled Execution Context — DISC-WEB-1D-2 M4/M5b
 *
 * AsyncLocalStorage-based context for controlled Discovery AI execution.
 * Allows controlled test sessions to propagate their identity through
 * asynchronous execution without process-global mutable state.
 *
 * Key invariants:
 * 1. Context is immutable for the duration of an execution
 * 2. Context is isolated across concurrent asynchronous tasks
 * 3. Context never leaks into normal Slack/REST execution
 * 4. Errors do not leave context active (finally cleanup)
 * 5. No implicit fallback when controlled context is active
 * 6. Detached async descendants fail lifecycle validation (M5b)
 *
 * Three execution states:
 * - No context (undefined): Normal execution, eligible for production routing
 * - Active context (lifecycleId in activeLifecycles): Eligible for controlled routing
 * - Expired context (lifecycleId NOT in activeLifecycles): Fail closed, never fallback
 *
 * Provider routing contract (M5+):
 * - No context → existing createModel() path
 * - Active context → route to budgetedInvoke()
 * - Expired context → throw, never fall back to production
 */

import { AsyncLocalStorage } from 'async_hooks';

// ─── Lifecycle Tracking ──────────────────────────────────────────────────────

/**
 * Monotonically increasing lifecycle counter.
 * Each controlled context gets a unique ID.
 */
let lifecycleCounter = 0;

/**
 * Set of currently active lifecycle IDs.
 * A lifecycle is active from context creation until the callback completes.
 * Detached async descendants retain the context but fail validation after
 * the parent lifecycle ends.
 */
const activeLifecycles = new Set<number>();

// ─── Context Types ────────────────────────────────────────────────────────────

/**
 * Immutable controlled execution context.
 * All fields are readonly to prevent mutation during execution.
 */
export interface ControlledExecutionContext {
  /**
   * Controlled test session ID (internal).
   * Used for budget reservation and reconciliation.
   */
  readonly sessionId: number;

  /**
   * Discovery run ID (required since M5b).
   * Must be bound at context creation.
   */
  readonly discoveryRunId: number;

  /**
   * Unique lifecycle identifier for this context execution.
   * Used to detect detached async descendants after parent completes.
   */
  readonly lifecycleId: number;

  /**
   * Explicit controlled execution marker.
   * Always true when context is present.
   * Distinguishes from other potential context values.
   */
  readonly isControlled: true;

  /**
   * Creation timestamp for debugging/logging.
   * ISO 8601 format.
   */
  readonly createdAt: string;

  /**
   * Human-readable purpose for logging/provenance.
   */
  readonly purpose?: string;
}

/**
 * Input for creating a new controlled execution context.
 */
export interface CreateControlledContextInput {
  /**
   * Controlled test session ID.
   * Must be a positive safe integer.
   */
  sessionId: number;

  /**
   * Discovery run ID (required since M5b).
   * Must be a positive safe integer.
   */
  discoveryRunId: number;

  /**
   * Human-readable purpose for logging.
   */
  purpose?: string;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

/**
 * Thrown when attempting to create context with invalid parameters.
 */
export class InvalidContextParameterError extends Error {
  constructor(field: string, value: unknown, reason: string) {
    super(`Invalid controlled context parameter: ${field}=${value} (${reason})`);
    this.name = 'InvalidContextParameterError';
  }
}

/**
 * Thrown when attempting nested controlled context entry.
 */
export class NestedControlledContextError extends Error {
  constructor(existingSessionId: number, attemptedSessionId: number) {
    super(
      `Cannot nest controlled contexts: already in session ${existingSessionId}, ` +
        `attempted to enter session ${attemptedSessionId}`,
    );
    this.name = 'NestedControlledContextError';
  }
}

/**
 * Thrown when requireValidControlledContext() is called with an expired context.
 * This indicates a detached async descendant attempted to use controlled execution
 * after the parent lifecycle completed.
 */
export class ExpiredControlledContextError extends Error {
  constructor(lifecycleId: number, sessionId: number, discoveryRunId: number) {
    super(
      `Controlled context lifecycle ${lifecycleId} has expired ` +
        `(session=${sessionId}, run=${discoveryRunId}). ` +
        `Detached async descendants cannot perform controlled execution.`,
    );
    this.name = 'ExpiredControlledContextError';
  }
}

/**
 * Thrown when requireValidControlledContext() is called outside of any context.
 * This is a programming error — the caller expected controlled execution.
 */
export class NoControlledContextError extends Error {
  constructor() {
    super('No controlled execution context active. This call requires controlled context.');
    this.name = 'NoControlledContextError';
  }
}

/**
 * Thrown when runInControlledContextSync() receives a callback that returns
 * a Promise or thenable. Use runInControlledContext() for async callbacks.
 */
export class AsyncCallbackInSyncContextError extends Error {
  constructor() {
    super(
      'runInControlledContextSync() callback returned a Promise or thenable. ' +
        'Use runInControlledContext() for async callbacks.',
    );
    this.name = 'AsyncCallbackInSyncContextError';
  }
}

// ─── AsyncLocalStorage Instance ───────────────────────────────────────────────

/**
 * AsyncLocalStorage instance for controlled execution context.
 * Module-scoped singleton — one instance per process.
 *
 * When undefined: normal execution (Slack, REST, etc.)
 * When defined: controlled test execution with budget enforcement
 */
const controlledContextStorage = new AsyncLocalStorage<ControlledExecutionContext>();

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a positive safe integer.
 * Used for sessionId and discoveryRunId.
 */
function validatePositiveSafeInteger(field: string, value: unknown): void {
  if (typeof value !== 'number') {
    throw new InvalidContextParameterError(field, value, 'must be a number');
  }
  if (!Number.isFinite(value)) {
    throw new InvalidContextParameterError(field, value, 'must be finite');
  }
  if (!Number.isInteger(value)) {
    throw new InvalidContextParameterError(field, value, 'must be an integer');
  }
  if (value <= 0) {
    throw new InvalidContextParameterError(field, value, 'must be positive');
  }
  if (!Number.isSafeInteger(value)) {
    throw new InvalidContextParameterError(field, value, 'must be a safe integer');
  }
}

/**
 * Check if a value is a Promise or thenable.
 * Used to detect async callbacks passed to the sync wrapper.
 */
function isPromiseLike(value: unknown): boolean {
  if (value instanceof Promise) {
    return true;
  }
  // Check for thenable (duck typing)
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

// ─── Context Access ───────────────────────────────────────────────────────────

/**
 * Get the current controlled execution context.
 * Returns undefined if not in a controlled execution.
 *
 * NOTE: This does NOT validate lifecycle. Use requireValidControlledContext()
 * before performing controlled operations.
 *
 * @returns The current context or undefined
 */
export function getControlledContext(): ControlledExecutionContext | undefined {
  return controlledContextStorage.getStore();
}

/**
 * Check if currently executing in a controlled context.
 * Use this for fast path checks.
 *
 * NOTE: This does NOT validate lifecycle. A detached async descendant
 * may still see context even after the lifecycle has ended.
 *
 * @returns true if in controlled context, false otherwise
 */
export function isInControlledContext(): boolean {
  return controlledContextStorage.getStore() !== undefined;
}

/**
 * Get the current controlled session ID.
 * Returns undefined if not in a controlled execution.
 *
 * NOTE: This does NOT validate lifecycle.
 */
export function getControlledSessionId(): number | undefined {
  return controlledContextStorage.getStore()?.sessionId;
}

/**
 * Get the current discovery run ID.
 * Returns undefined if not in a controlled execution.
 *
 * NOTE: This does NOT validate lifecycle.
 */
export function getControlledRunId(): number | undefined {
  return controlledContextStorage.getStore()?.discoveryRunId;
}

/**
 * Check if a specific lifecycle is currently active.
 * Used for debugging and testing.
 */
export function isLifecycleActive(lifecycleId: number): boolean {
  return activeLifecycles.has(lifecycleId);
}

/**
 * Get the count of currently active lifecycles.
 * Used for debugging and testing leak detection.
 */
export function getActiveLifecycleCount(): number {
  return activeLifecycles.size;
}

// ─── Lifecycle Validation ─────────────────────────────────────────────────────

/**
 * Require a valid controlled execution context.
 *
 * This is the FAIL-CLOSED helper for controlled execution routing.
 * Use this before any operation that should only occur in controlled mode.
 *
 * @returns The validated context
 *
 * @throws NoControlledContextError if no context is present
 * @throws ExpiredControlledContextError if lifecycle has ended (detached descendant)
 *
 * @example
 * ```typescript
 * // In provider routing code:
 * try {
 *   const ctx = requireValidControlledContext();
 *   // Route to budgetedInvoke with ctx.sessionId
 * } catch (e) {
 *   if (e instanceof NoControlledContextError) {
 *     // Normal execution path
 *   } else {
 *     // ExpiredControlledContextError — fail closed, do not fall back
 *     throw e;
 *   }
 * }
 * ```
 */
export function requireValidControlledContext(): ControlledExecutionContext {
  const ctx = controlledContextStorage.getStore();

  if (!ctx) {
    throw new NoControlledContextError();
  }

  if (!activeLifecycles.has(ctx.lifecycleId)) {
    throw new ExpiredControlledContextError(ctx.lifecycleId, ctx.sessionId, ctx.discoveryRunId);
  }

  return ctx;
}

/**
 * Check if the current context is valid (active lifecycle).
 * Returns false if no context or if lifecycle has expired.
 *
 * Use this for conditional routing without throwing.
 */
export function hasValidControlledContext(): boolean {
  const ctx = controlledContextStorage.getStore();
  if (!ctx) return false;
  return activeLifecycles.has(ctx.lifecycleId);
}

// ─── Context Execution ────────────────────────────────────────────────────────

/**
 * Run an asynchronous callback inside a controlled execution context.
 *
 * The context is:
 * - Immutable for the duration of the callback
 * - Isolated from other concurrent executions
 * - Tracked via lifecycle ID in process memory
 * - Automatically cleaned up when the callback completes (success or error)
 *
 * Lifecycle tracking:
 * - On entry: assigns unique lifecycleId, adds to activeLifecycles
 * - On exit (finally): removes from activeLifecycles
 * - Detached async descendants retain context but fail requireValidControlledContext()
 *
 * Nested calls are explicitly rejected to prevent confusion.
 *
 * @param input - Context creation parameters (sessionId and discoveryRunId required)
 * @param callback - Async function to execute in context
 * @returns The callback's return value
 *
 * @throws InvalidContextParameterError if parameters are invalid
 * @throws NestedControlledContextError if already in controlled context
 *
 * @example
 * ```typescript
 * const result = await runInControlledContext(
 *   { sessionId: 42, discoveryRunId: 100, purpose: 'desk-research-test' },
 *   async () => {
 *     const ctx = requireValidControlledContext();
 *     console.log(ctx.sessionId); // 42
 *     console.log(ctx.discoveryRunId); // 100
 *     return await someAsyncOperation();
 *   },
 * );
 * ```
 */
export async function runInControlledContext<T>(
  input: CreateControlledContextInput,
  callback: () => Promise<T>,
): Promise<T> {
  // Reject nested context entry
  const existing = controlledContextStorage.getStore();
  if (existing) {
    throw new NestedControlledContextError(existing.sessionId, input.sessionId);
  }

  // Validate parameters (both required)
  validatePositiveSafeInteger('sessionId', input.sessionId);
  validatePositiveSafeInteger('discoveryRunId', input.discoveryRunId);

  // Assign unique lifecycle ID
  const lifecycleId = ++lifecycleCounter;

  // Create immutable context
  const context: ControlledExecutionContext = Object.freeze({
    sessionId: input.sessionId,
    discoveryRunId: input.discoveryRunId,
    lifecycleId,
    isControlled: true,
    createdAt: new Date().toISOString(),
    purpose: input.purpose,
  });

  // Track lifecycle
  activeLifecycles.add(lifecycleId);

  try {
    // Run callback in context
    return await controlledContextStorage.run(context, callback);
  } finally {
    // Always deactivate lifecycle on exit
    activeLifecycles.delete(lifecycleId);
  }
}

/**
 * Synchronous version of runInControlledContext.
 * Use for callbacks that don't need to be async.
 *
 * IMPORTANT: This function rejects callbacks that return Promises or thenables.
 * If your callback is async, use runInControlledContext() instead.
 *
 * @throws InvalidContextParameterError if parameters are invalid
 * @throws NestedControlledContextError if already in controlled context
 * @throws AsyncCallbackInSyncContextError if callback returns a Promise or thenable
 */
export function runInControlledContextSync<T>(
  input: CreateControlledContextInput,
  callback: () => T,
): T {
  // Reject nested context entry
  const existing = controlledContextStorage.getStore();
  if (existing) {
    throw new NestedControlledContextError(existing.sessionId, input.sessionId);
  }

  // Validate parameters (both required)
  validatePositiveSafeInteger('sessionId', input.sessionId);
  validatePositiveSafeInteger('discoveryRunId', input.discoveryRunId);

  // Assign unique lifecycle ID
  const lifecycleId = ++lifecycleCounter;

  // Create immutable context
  const context: ControlledExecutionContext = Object.freeze({
    sessionId: input.sessionId,
    discoveryRunId: input.discoveryRunId,
    lifecycleId,
    isControlled: true,
    createdAt: new Date().toISOString(),
    purpose: input.purpose,
  });

  // Track lifecycle
  activeLifecycles.add(lifecycleId);

  try {
    // Run callback in context
    const result = controlledContextStorage.run(context, callback);

    // Reject Promise or thenable return values
    // This prevents accidental misuse with async callbacks
    if (isPromiseLike(result)) {
      throw new AsyncCallbackInSyncContextError();
    }

    return result;
  } finally {
    // Always deactivate lifecycle on exit
    activeLifecycles.delete(lifecycleId);
  }
}

// ─── Testing Utilities ────────────────────────────────────────────────────────

/**
 * Reset lifecycle tracking state.
 * ONLY for testing — do not use in production code.
 *
 * @internal
 */
export function _resetLifecycleState(): void {
  activeLifecycles.clear();
  lifecycleCounter = 0;
}
