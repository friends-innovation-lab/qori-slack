/**
 * Budgeted AI Invocation — DISC-WEB-1D-2 M3
 *
 * Fail-closed invocation wrapper for controlled test sessions.
 * Every provider attempt requires a successful atomic budget reservation.
 *
 * Key invariants:
 * 1. Never dispatch if session is terminal (cancelled, exhausted, completed)
 * 2. Never dispatch if any budget would be exceeded
 * 3. Never dispatch if token measurement fails
 * 4. Never dispatch if reservation fails
 * 5. Never assume an unsuccessful request was free — retain conservative reservation
 * 6. No automatic SDK retries (M2 factory disables them)
 * 7. Explicit retry must repeat full reservation process
 * 8. Reconciliation is idempotent (database-backed reservation IDs)
 *
 * This wrapper is ISOLATED from production execution paths.
 * Do NOT use for normal Slack/REST AI execution.
 */

import type { AIMessage } from '@langchain/core/messages';
import type { UsageMetadata } from '@langchain/core/messages';
import {
  createControlledTestModel,
  CONTROLLED_TEST_MAX_TOKENS,
  type ControlledTestModelConfig,
} from './modelProvider';
import {
  reserveBudget,
  reconcileUsage,
  getSessionById,
  InvalidBudgetInputError,
  type ReserveBudgetResult,
  type ReserveBudgetInput,
  type ReconcileUsageInput,
  type ReconcileUsageResult,
} from '../services/controlled-test-budget.service';

// ─── Input/Output Types ───────────────────────────────────────────────────────

export interface BudgetedInvokeInput {
  /** Session ID (internal) for budget enforcement */
  sessionId: number;
  /** Prompt text to send to the model */
  prompt: string;
  /** Human-readable purpose for logging/provenance */
  purpose?: string;
  /** Optional model configuration (temperature override) */
  modelConfig?: Omit<ControlledTestModelConfig, 'purpose'>;
}

export interface BudgetedInvokeResult {
  /** Whether invocation succeeded */
  ok: boolean;
  /** Generated content (if ok=true) */
  content?: string;
  /** Error reason (if ok=false) */
  error?:
    | 'session_not_found'
    | 'session_terminal'
    | 'budget_exceeded'
    | 'token_measurement_failed'
    | 'invalid_token_estimate'
    | 'reservation_failed'
    | 'provider_error'
    | 'timeout';
  /** Error message for debugging */
  errorMessage?: string;
  /** Reservation result (always present after reservation attempt) */
  reservationResult?: ReserveBudgetResult;
  /** Token usage information */
  usage?: {
    /** Reservation ID for idempotent reconciliation */
    reservationId?: number;
    /** Estimated input tokens (before dispatch) */
    estimatedInputTokens: number;
    /** Reserved output tokens (full max allocation) */
    reservedOutputTokens: number;
    /** Actual input tokens (from provider, if available) */
    actualInputTokens?: number;
    /** Actual output tokens (from provider, if available) */
    actualOutputTokens?: number;
    /** Whether reconciliation updated the session */
    reconciled: boolean;
  };
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class TokenMeasurementError extends Error {
  constructor(message: string) {
    super(`Token measurement failed: ${message}`);
    this.name = 'TokenMeasurementError';
  }
}

export class BudgetReservationError extends Error {
  constructor(
    public readonly result: ReserveBudgetResult,
  ) {
    super(`Budget reservation failed: ${result.reason}`);
    this.name = 'BudgetReservationError';
  }
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Invoke AI with fail-closed budget enforcement for controlled test sessions.
 *
 * Before every provider attempt:
 * 1. Measures input tokens using the model's tokenizer
 * 2. Reserves budget atomically (request count + estimated input + max output)
 * 3. Creates a persistent reservation record for idempotent reconciliation
 * 4. Only dispatches if reservation succeeds
 *
 * After successful response:
 * - Reconciles actual token usage from provider metadata using reservation ID
 * - Reconciliation is idempotent: duplicate calls do not release budget twice
 *
 * On failure (timeout, error, missing metadata):
 * - Retains conservative reservation (does not adjust)
 *
 * @param input - Session ID, prompt, and optional configuration
 * @returns Result with content or error information
 *
 * @example
 * ```typescript
 * const result = await budgetedInvoke({
 *   sessionId: session.id,
 *   prompt: 'Summarize this text...',
 *   purpose: 'desk-research-summary',
 * });
 *
 * if (result.ok) {
 *   console.log(result.content);
 * } else {
 *   console.error(result.error, result.errorMessage);
 * }
 * ```
 */
export async function budgetedInvoke(
  input: BudgetedInvokeInput,
): Promise<BudgetedInvokeResult> {
  const { sessionId, prompt, purpose, modelConfig } = input;

  // ─── Step 1: Validate session exists and is active ──────────────────────────
  // Pre-check before expensive token measurement
  const session = await getSessionById(sessionId);
  if (!session) {
    return {
      ok: false,
      error: 'session_not_found',
      errorMessage: `Session ${sessionId} not found`,
    };
  }

  if (session.status !== 'active') {
    return {
      ok: false,
      error: 'session_terminal',
      errorMessage: `Session ${sessionId} is ${session.status}`,
      reservationResult: {
        ok: false,
        reason: 'session_terminal',
        sessionStatus: session.status,
      },
    };
  }

  // ─── Step 2: Create controlled model ────────────────────────────────────────
  // Uses M2 factory with SDK retries disabled
  let model;
  try {
    model = createControlledTestModel({
      purpose,
      ...modelConfig,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: 'provider_error',
      errorMessage: `Failed to create model: ${message}`,
    };
  }

  // ─── Step 3: Measure input tokens ───────────────────────────────────────────
  // NOTE: This is an ESTIMATE. The actual token count billed by the provider
  // may differ slightly due to tokenizer differences or special token handling.
  // We use this for budget enforcement, not for exact billing reconciliation.
  let estimatedInputTokens: number;
  try {
    estimatedInputTokens = await model.getNumTokens(prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: 'token_measurement_failed',
      errorMessage: `Token measurement failed: ${message}`,
    };
  }

  // F2: Validate token estimate before reservation
  // Must be finite, positive, integer
  if (
    !Number.isFinite(estimatedInputTokens) ||
    !Number.isInteger(estimatedInputTokens) ||
    estimatedInputTokens <= 0
  ) {
    return {
      ok: false,
      error: 'invalid_token_estimate',
      errorMessage: `Invalid token estimate: ${estimatedInputTokens} (must be finite positive integer)`,
    };
  }

  // ─── Step 4: Reserve budget atomically ──────────────────────────────────────
  // F1: Reserves ALL THREE limits in single atomic operation:
  // - 1 request
  // - Estimated input tokens
  // - Full max output allocation (CONTROLLED_TEST_MAX_TOKENS)
  // Also creates a persistent reservation record for idempotent reconciliation
  const reservedOutputTokens = CONTROLLED_TEST_MAX_TOKENS;
  const reservationInput: ReserveBudgetInput = {
    sessionId,
    estimatedInputTokens,
    reservedOutputTokens,
    purpose,
  };

  let reservationResult: ReserveBudgetResult;
  try {
    reservationResult = await reserveBudget(reservationInput);
  } catch (err) {
    // F2: Service-level validation may throw InvalidBudgetInputError
    if (err instanceof InvalidBudgetInputError) {
      return {
        ok: false,
        error: 'invalid_token_estimate',
        errorMessage: err.message,
        usage: {
          estimatedInputTokens,
          reservedOutputTokens,
          reconciled: false,
        },
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: 'reservation_failed',
      errorMessage: `Reservation error: ${message}`,
      usage: {
        estimatedInputTokens,
        reservedOutputTokens,
        reconciled: false,
      },
    };
  }

  if (!reservationResult.ok) {
    return {
      ok: false,
      error: reservationResult.reason,
      errorMessage: `Budget reservation failed: ${reservationResult.reason}`,
      reservationResult,
      usage: {
        estimatedInputTokens,
        reservedOutputTokens,
        reconciled: false,
      },
    };
  }

  // Extract reservation ID for reconciliation
  const reservationId = reservationResult.reservationId!;

  // ─── Step 5: Dispatch to provider ───────────────────────────────────────────
  // At this point:
  // - Session is active
  // - Budget is reserved (1 request, estimatedInputTokens, reservedOutputTokens)
  // - Reservation record created with reservationId
  // - SDK retries are disabled (single attempt)
  let response: AIMessage;
  try {
    response = await model.invoke(prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.toLowerCase().includes('timeout') ||
                      message.toLowerCase().includes('timed out') ||
                      message.toLowerCase().includes('econnreset') ||
                      message.toLowerCase().includes('socket hang up');

    // F3: IMPORTANT: Do NOT reconcile on failure.
    // Retain full conservative reservation — we cannot know if the provider
    // consumed resources before failing.
    return {
      ok: false,
      error: isTimeout ? 'timeout' : 'provider_error',
      errorMessage: message,
      reservationResult,
      usage: {
        reservationId,
        estimatedInputTokens,
        reservedOutputTokens,
        reconciled: false,
      },
    };
  }

  // ─── Step 6: Extract response content ───────────────────────────────────────
  const content = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  // ─── Step 7: Extract usage metadata ─────────────────────────────────────────
  // LangChain/Anthropic provides usage_metadata on AIMessage
  const usageMetadata = response.usage_metadata as UsageMetadata | undefined;
  const actualInputTokens = usageMetadata?.input_tokens;
  const actualOutputTokens = usageMetadata?.output_tokens;

  // ─── Step 8: Reconcile usage ────────────────────────────────────────────────
  // F3: Update session with actual output tokens if available
  // - Uses reservation ID for idempotent reconciliation
  // - Releases unused output allocation (reserved - actual)
  // - If metadata is missing, retain full conservative reservation
  // - If reconciliation fails, retain reservation and log warning
  let reconciled = false;
  if (actualOutputTokens !== undefined) {
    try {
      const reconcileInput: ReconcileUsageInput = {
        reservationId,
        // Note: actualInputTokens is NOT used to adjust budget (see ReconcileUsageInput docs)
        // It's retained for logging/provenance only
        actualInputTokens: actualInputTokens ?? estimatedInputTokens,
        actualOutputTokens,
      };
      const reconcileResult = await reconcileUsage(reconcileInput);
      // Both ok=true (first reconciliation) and alreadyReconciled=true count as success
      reconciled = reconcileResult.ok || reconcileResult.alreadyReconciled;
    } catch (err) {
      // F3: Reconciliation failure retains full reservation
      // Log but don't fail — the invocation succeeded
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[budgetedInvoke] Reconciliation warning (reservation retained): ${message}`);
    }
  }

  return {
    ok: true,
    content,
    reservationResult,
    usage: {
      reservationId,
      estimatedInputTokens,
      reservedOutputTokens,
      actualInputTokens,
      actualOutputTokens,
      reconciled,
    },
  };
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

/**
 * Retry a budgeted invocation with a fresh reservation.
 *
 * IMPORTANT: Each retry is a full budget reservation cycle.
 * This is intentional — we never assume a failed request was free.
 *
 * @param input - Same input as budgetedInvoke
 * @param maxAttempts - Maximum number of attempts (default: 1, meaning no retry)
 * @returns Result from the last attempt
 */
export async function budgetedInvokeWithRetry(
  input: BudgetedInvokeInput,
  maxAttempts: number = 1,
): Promise<BudgetedInvokeResult> {
  if (maxAttempts < 1) {
    throw new Error('maxAttempts must be at least 1');
  }

  let lastResult: BudgetedInvokeResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await budgetedInvoke(input);

    // Success — return immediately
    if (lastResult.ok) {
      return lastResult;
    }

    // Non-retryable errors — return immediately
    if (
      lastResult.error === 'session_not_found' ||
      lastResult.error === 'session_terminal' ||
      lastResult.error === 'budget_exceeded' ||
      lastResult.error === 'token_measurement_failed' ||
      lastResult.error === 'invalid_token_estimate'
    ) {
      return lastResult;
    }

    // Retryable errors (provider_error, timeout) — continue if attempts remain
    if (attempt < maxAttempts) {
      console.log(
        `[budgetedInvoke] Attempt ${attempt}/${maxAttempts} failed: ${lastResult.error}. ` +
        `Retrying with fresh reservation...`,
      );
    }
  }

  return lastResult!;
}
