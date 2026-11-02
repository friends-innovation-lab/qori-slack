/**
 * Controlled Execution Context — DISC-WEB-1D-2 M4
 *
 * AsyncLocalStorage-based context for controlled Discovery AI execution.
 * Allows controlled test sessions to propagate their identity through
 * asynchronous execution without process-global mutable state.
 *
 * Key invariants:
 * 1. Context is immutable for the duration of an execution
 * 2. Context is isolated across concurrent asynchronous tasks
 * 3. Context never leaks into normal Slack/REST execution
 * 4. Errors do not leave context active (AsyncLocalStorage handles this)
 * 5. No implicit fallback when controlled context is active
 *
 * Future provider routing contract (M5+):
 * - Controlled context active → route to M3 budgetedInvoke()
 * - Normal context (undefined) → existing provider behavior
 * - Invalid/terminal controlled context → fail closed
 */

import { AsyncLocalStorage } from 'async_hooks';

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
   * Discovery run ID when available.
   * Null before run binding (during session setup).
   * Immutable once set.
   */
  readonly discoveryRunId: number | null;

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
   * Must be a positive integer.
   */
  sessionId: number;

  /**
   * Discovery run ID (optional).
   * Set to null if run binding hasn't occurred yet.
   */
  discoveryRunId?: number | null;

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
 * Validate session ID is a positive integer.
 */
function validateSessionId(sessionId: unknown): void {
  if (typeof sessionId !== 'number') {
    throw new InvalidContextParameterError('sessionId', sessionId, 'must be a number');
  }
  if (!Number.isFinite(sessionId)) {
    throw new InvalidContextParameterError('sessionId', sessionId, 'must be finite');
  }
  if (!Number.isInteger(sessionId)) {
    throw new InvalidContextParameterError('sessionId', sessionId, 'must be an integer');
  }
  if (sessionId <= 0) {
    throw new InvalidContextParameterError('sessionId', sessionId, 'must be positive');
  }
}

/**
 * Validate discovery run ID if provided.
 */
function validateDiscoveryRunId(runId: unknown): void {
  if (runId === null || runId === undefined) return;
  if (typeof runId !== 'number') {
    throw new InvalidContextParameterError('discoveryRunId', runId, 'must be a number or null');
  }
  if (!Number.isFinite(runId)) {
    throw new InvalidContextParameterError('discoveryRunId', runId, 'must be finite');
  }
  if (!Number.isInteger(runId)) {
    throw new InvalidContextParameterError('discoveryRunId', runId, 'must be an integer');
  }
  if (runId <= 0) {
    throw new InvalidContextParameterError('discoveryRunId', runId, 'must be positive');
  }
}

// ─── Context Access ───────────────────────────────────────────────────────────

/**
 * Get the current controlled execution context.
 * Returns undefined if not in a controlled execution.
 *
 * @returns The current context or undefined
 */
export function getControlledContext(): ControlledExecutionContext | undefined {
  return controlledContextStorage.getStore();
}

/**
 * Check if currently executing in a controlled context.
 * Use this for fast path checks before calling getControlledContext().
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
 * Convenience function for budget reservation calls.
 */
export function getControlledSessionId(): number | undefined {
  return controlledContextStorage.getStore()?.sessionId;
}

/**
 * Get the current discovery run ID.
 * Returns undefined if not in a controlled execution or run not yet bound.
 */
export function getControlledRunId(): number | undefined {
  return controlledContextStorage.getStore()?.discoveryRunId ?? undefined;
}

// ─── Context Execution ────────────────────────────────────────────────────────

/**
 * Run an asynchronous callback inside a controlled execution context.
 *
 * The context is:
 * - Immutable for the duration of the callback
 * - Isolated from other concurrent executions
 * - Automatically cleaned up when the callback completes (success or error)
 *
 * Nested calls are explicitly rejected to prevent confusion.
 * If you need to modify context (e.g., add run ID), exit and re-enter.
 *
 * @param input - Context creation parameters
 * @param callback - Async function to execute in context
 * @returns The callback's return value
 *
 * @throws InvalidContextParameterError if parameters are invalid
 * @throws NestedControlledContextError if already in controlled context
 *
 * @example
 * ```typescript
 * const result = await runInControlledContext(
 *   { sessionId: 42, purpose: 'desk-research-test' },
 *   async () => {
 *     // All async operations here see the controlled context
 *     const ctx = getControlledContext();
 *     console.log(ctx?.sessionId); // 42
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

  // Validate parameters
  validateSessionId(input.sessionId);
  validateDiscoveryRunId(input.discoveryRunId);

  // Create immutable context
  const context: ControlledExecutionContext = Object.freeze({
    sessionId: input.sessionId,
    discoveryRunId: input.discoveryRunId ?? null,
    isControlled: true,
    createdAt: new Date().toISOString(),
    purpose: input.purpose,
  });

  // Run callback in context
  // AsyncLocalStorage.run() ensures cleanup on both success and error
  return controlledContextStorage.run(context, callback);
}

/**
 * Synchronous version of runInControlledContext.
 * Use for callbacks that don't need to be async.
 *
 * @throws InvalidContextParameterError if parameters are invalid
 * @throws NestedControlledContextError if already in controlled context
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

  // Validate parameters
  validateSessionId(input.sessionId);
  validateDiscoveryRunId(input.discoveryRunId);

  // Create immutable context
  const context: ControlledExecutionContext = Object.freeze({
    sessionId: input.sessionId,
    discoveryRunId: input.discoveryRunId ?? null,
    isControlled: true,
    createdAt: new Date().toISOString(),
    purpose: input.purpose,
  });

  // Run callback in context
  return controlledContextStorage.run(context, callback);
}

// ─── Context Update (for run binding) ─────────────────────────────────────────

/**
 * Run a callback with an updated context that includes the discovery run ID.
 *
 * Use this when binding a run to a session during controlled execution.
 * The original context is replaced with a new one containing the run ID.
 *
 * @param runId - The discovery run ID to add to context
 * @param callback - Async function to execute with updated context
 * @returns The callback's return value
 *
 * @throws InvalidContextParameterError if runId is invalid
 * @throws Error if not currently in controlled context
 */
export async function runWithBoundRun<T>(
  runId: number,
  callback: () => Promise<T>,
): Promise<T> {
  const existing = controlledContextStorage.getStore();
  if (!existing) {
    throw new Error('runWithBoundRun called outside of controlled context');
  }

  // Validate run ID
  validateDiscoveryRunId(runId);

  // Create new context with run ID
  const updatedContext: ControlledExecutionContext = Object.freeze({
    ...existing,
    discoveryRunId: runId,
  });

  // Run callback in updated context
  return controlledContextStorage.run(updatedContext, callback);
}

// ─── Provider Routing Contract (Documentation for M5) ────────────────────────

/**
 * FUTURE PROVIDER ROUTING CONTRACT (M5+)
 *
 * When this context system is wired into provider invocation paths:
 *
 * 1. CHECK CONTEXT:
 *    ```typescript
 *    const ctx = getControlledContext();
 *    ```
 *
 * 2. ROUTE BASED ON CONTEXT:
 *    - If `ctx === undefined`: Use existing `createModel()` path
 *    - If `ctx !== undefined`: Route to `budgetedInvoke()`
 *
 * 3. FAIL CLOSED ON INVALID STATE:
 *    - Session terminal → throw, do not fall back to production
 *    - Budget exceeded → throw, do not fall back to production
 *    - Missing session → throw, do not fall back to production
 *
 * 4. INTEGRATION POINTS:
 *    - `langchain.ts:executeAiGenerationTasks()` — YAML task generation
 *    - `variableExtractor.ts:extractVariables()` — Variable extraction
 *    - Direct `createModel().invoke()` calls in utilities
 *
 * This contract ensures:
 * - Controlled execution NEVER bypasses budget enforcement
 * - Normal execution NEVER accidentally enters controlled mode
 * - Failures are explicit, not silent fallbacks
 */
