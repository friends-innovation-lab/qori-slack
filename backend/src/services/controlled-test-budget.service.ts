/**
 * Controlled Test Budget Service — DISC-WEB-1D-2
 *
 * Manages controlled test sessions with hard AI execution limits.
 * Provides atomic budget reservation and reconciliation for Discovery runs.
 *
 * Key invariants per QORI-ROADMAP.md:
 * 1. Budget enforcement invariant: A cancelled, exhausted, or completed session
 *    must NEVER cause its bound run to execute without budget enforcement.
 *    The run queries its bound session by run ID, not by environment variable.
 *    Session status is checked atomically in every budget reservation.
 *
 * 2. Transaction rollback ownership: Uses Sequelize managed transactions
 *    (`sequelize.transaction()`) as the single rollback owner. No double rollback.
 *
 * 3. Idempotent reconciliation (M3 safety fix): Each budget reservation creates
 *    a persistent reservation record. Reconciliation uses the reservation ID,
 *    ensuring that duplicate reconciliation cannot release budget twice.
 *
 * M1 scope: Database and service layer only. No AI invocation paths.
 */

import sequelize from '../database';
import { Op, type Transaction } from 'sequelize';
import type {
  ControlledTestSession,
  ControlledTestSessionStatus,
} from '../database/models/controlled_test_session';
import type {
  ControlledTestReservation,
  ControlledTestReservationState,
} from '../database/models/controlled_test_reservation';

const ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;
const ControlledTestReservationModel = sequelize.models.ControlledTestReservation as typeof ControlledTestReservation;

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  /** Maximum AI requests allowed */
  maxRequests: number;
  /** Maximum input tokens allowed */
  maxInputTokens: number;
  /** Maximum output tokens allowed */
  maxOutputTokens: number;
  /** Actor creating the session (optional) */
  actorId?: number | null;
}

export interface ReserveBudgetInput {
  /** Session ID (internal) */
  sessionId: number;
  /**
   * Discovery run ID for binding verification (optional).
   * - If provided: atomic UPDATE includes `discovery_run_id = :discoveryRunId` precondition
   * - If undefined: uses unbound-session path (`discovery_run_id IS NULL`)
   *
   * M5e: Controlled execution MUST provide this. Unbound path is for M3 compatibility only.
   */
  discoveryRunId?: number;
  /** Estimated input tokens for this request (must be finite positive integer) */
  estimatedInputTokens: number;
  /** Reserved output tokens for this request (must be finite positive integer) */
  reservedOutputTokens: number;
  /** Human-readable purpose for logging/provenance (optional) */
  purpose?: string;
}

export interface ReconcileUsageInput {
  /** Reservation ID (internal) returned from reserveBudget */
  reservationId: number;
  /**
   * Actual input tokens consumed (from provider metadata).
   *
   * DECISION (M3 F3): We do NOT reconcile input tokens for the following reasons:
   * 1. Input tokens were estimated before dispatch and reserved atomically
   * 2. Provider-reported input may differ from estimate due to tokenizer differences
   * 3. Releasing input budget based on provider metadata could allow budget undercount
   * 4. For controlled tests, conservative input reservation is acceptable
   *
   * This field is retained for logging/provenance but NOT used to adjust used_input_tokens.
   */
  actualInputTokens: number;
  /** Actual output tokens consumed (from provider metadata) */
  actualOutputTokens: number;
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface ReserveBudgetResult {
  /** Whether reservation was successful */
  ok: boolean;
  /** Reservation ID (if ok=true) — required for reconciliation */
  reservationId?: number;
  /** Reason for failure (if ok=false) */
  reason?: 'session_not_found' | 'session_terminal' | 'budget_exceeded' | 'run_binding_mismatch';
  /** Session status at time of check */
  sessionStatus: ControlledTestSessionStatus;
  /** Remaining requests after reservation (if ok=true) */
  remainingRequests?: number;
  /** Remaining input tokens after reservation (if ok=true) */
  remainingInputTokens?: number;
  /** Remaining output tokens after reservation (if ok=true) */
  remainingOutputTokens?: number;
}

export interface ReconcileUsageResult {
  /** Whether reconciliation was performed */
  ok: boolean;
  /** Whether this was a duplicate reconciliation (already_reconciled) */
  alreadyReconciled: boolean;
  /** Reason for failure (if ok=false and not alreadyReconciled) */
  reason?: 'reservation_not_found' | 'session_mismatch';
  /** Session after reconciliation (if ok=true or alreadyReconciled) */
  session?: ControlledTestSession;
  /** Reserved output tokens from the reservation */
  reservedOutputTokens?: number;
  /** Output tokens released (0 if alreadyReconciled) */
  tokensReleased?: number;
}

export interface SessionSummary {
  id: number;
  publicId: string;
  status: ControlledTestSessionStatus;
  discoveryRunId: number | null;
  budget: {
    maxRequests: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    usedRequests: number;
    usedInputTokens: number;
    usedOutputTokens: number;
    remainingRequests: number;
    remainingInputTokens: number;
    remainingOutputTokens: number;
  };
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    cancelledAt: Date | null;
    exhaustedAt: Date | null;
    completedAt: Date | null;
  };
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export class SessionNotFoundError extends Error {
  constructor(identifier: number | string) {
    super(`Controlled test session not found: ${identifier}`);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionAlreadyExistsError extends Error {
  constructor() {
    super('An active controlled test session already exists');
    this.name = 'SessionAlreadyExistsError';
  }
}

export class SessionTerminalError extends Error {
  constructor(status: ControlledTestSessionStatus) {
    super(`Session is in terminal state: ${status}`);
    this.name = 'SessionTerminalError';
  }
}

export class RunAlreadyBoundError extends Error {
  constructor(sessionId: number, existingRunId: number) {
    super(`Session ${sessionId} already bound to run ${existingRunId}`);
    this.name = 'RunAlreadyBoundError';
  }
}

export class RunBoundToOtherSessionError extends Error {
  constructor(runId: number, existingSessionId: number) {
    super(`Run ${runId} already bound to session ${existingSessionId}`);
    this.name = 'RunBoundToOtherSessionError';
  }
}

export class InvalidBudgetInputError extends Error {
  constructor(field: string, value: unknown, reason: string) {
    super(`Invalid budget input: ${field}=${value} (${reason})`);
    this.name = 'InvalidBudgetInputError';
  }
}

export class ReservationNotFoundError extends Error {
  constructor(reservationId: number) {
    super(`Reservation not found: ${reservationId}`);
    this.name = 'ReservationNotFoundError';
  }
}

export class ReservationSessionMismatchError extends Error {
  constructor(reservationId: number, expectedSessionId: number, actualSessionId: number) {
    super(`Reservation ${reservationId} belongs to session ${actualSessionId}, not ${expectedSessionId}`);
    this.name = 'ReservationSessionMismatchError';
  }
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validate that a token count is a finite positive integer.
 * Rejects: zero, negative, fractional, NaN, Infinity, -Infinity.
 *
 * @throws InvalidBudgetInputError if validation fails
 */
export function validateTokenCount(field: string, value: number): void {
  if (typeof value !== 'number') {
    throw new InvalidBudgetInputError(field, value, 'must be a number');
  }
  if (!Number.isFinite(value)) {
    throw new InvalidBudgetInputError(field, value, 'must be finite (not NaN or Infinity)');
  }
  if (!Number.isInteger(value)) {
    throw new InvalidBudgetInputError(field, value, 'must be an integer (no fractions)');
  }
  if (value <= 0) {
    throw new InvalidBudgetInputError(field, value, 'must be positive (greater than zero)');
  }
}

// ─── Create Session ──────────────────────────────────────────────────────────

/**
 * Create a new controlled test session.
 * Only one active session can exist at a time (enforced by database constraint).
 *
 * @throws SessionAlreadyExistsError if an active session already exists
 */
export async function createSession(
  input: CreateSessionInput,
  transaction?: Transaction,
): Promise<ControlledTestSession> {
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    // Check for existing active session (belt-and-suspenders; DB constraint is authoritative)
    const existing = await ControlledTestSessionModel.findOne({
      where: { status: 'active' },
      transaction: t,
    });

    if (existing) {
      throw new SessionAlreadyExistsError();
    }

    const session = await ControlledTestSessionModel.create(
      {
        max_requests: input.maxRequests,
        max_input_tokens: input.maxInputTokens,
        max_output_tokens: input.maxOutputTokens,
        created_by_actor_id: input.actorId ?? null,
        status: 'active',
      },
      { transaction: t },
    );

    if (shouldCommit) {
      await t.commit();
    }

    return session;
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    // Re-throw unique constraint violation as SessionAlreadyExistsError
    if (
      error instanceof Error &&
      error.name === 'SequelizeUniqueConstraintError' &&
      error.message.includes('controlled_test_sessions_single_active_idx')
    ) {
      throw new SessionAlreadyExistsError();
    }
    throw error;
  }
}

// ─── Read Operations ─────────────────────────────────────────────────────────

/**
 * Get the current active session, if any.
 */
export async function getActiveSession(
  transaction?: Transaction,
): Promise<ControlledTestSession | null> {
  return ControlledTestSessionModel.findOne({
    where: { status: 'active' },
    transaction,
  });
}

/**
 * Get session by internal ID.
 */
export async function getSessionById(
  id: number,
  transaction?: Transaction,
): Promise<ControlledTestSession | null> {
  return ControlledTestSessionModel.findByPk(id, { transaction });
}

/**
 * Get session by public UUID.
 */
export async function getSessionByPublicId(
  publicId: string,
  transaction?: Transaction,
): Promise<ControlledTestSession | null> {
  return ControlledTestSessionModel.findOne({
    where: { public_id: publicId },
    transaction,
  });
}

/**
 * Get session bound to a specific discovery run.
 * Critical for budget enforcement: a run MUST always be able to find its session.
 */
export async function getSessionByRunId(
  runId: number,
  transaction?: Transaction,
): Promise<ControlledTestSession | null> {
  return ControlledTestSessionModel.findOne({
    where: { discovery_run_id: runId },
    transaction,
  });
}

/**
 * Get reservation by internal ID.
 */
export async function getReservationById(
  id: number,
  transaction?: Transaction,
): Promise<ControlledTestReservation | null> {
  return ControlledTestReservationModel.findByPk(id, { transaction });
}

/**
 * Convert session to summary format.
 */
export function toSessionSummary(session: ControlledTestSession): SessionSummary {
  return {
    id: session.id,
    publicId: session.public_id,
    status: session.status,
    discoveryRunId: session.discovery_run_id,
    budget: {
      maxRequests: session.max_requests,
      maxInputTokens: session.max_input_tokens,
      maxOutputTokens: session.max_output_tokens,
      usedRequests: session.used_requests,
      usedInputTokens: session.used_input_tokens,
      usedOutputTokens: session.used_output_tokens,
      remainingRequests: session.max_requests - session.used_requests,
      remainingInputTokens: session.max_input_tokens - session.used_input_tokens,
      remainingOutputTokens: session.max_output_tokens - session.used_output_tokens,
    },
    timestamps: {
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      cancelledAt: session.cancelled_at,
      exhaustedAt: session.exhausted_at,
      completedAt: session.completed_at,
    },
  };
}

// ─── Run Binding ─────────────────────────────────────────────────────────────

/**
 * Bind a discovery run to a session.
 * Once bound, the binding is immutable.
 *
 * @throws SessionNotFoundError if session doesn't exist
 * @throws SessionTerminalError if session is not active
 * @throws RunAlreadyBoundError if session already has a run
 * @throws RunBoundToOtherSessionError if run is bound to another session
 */
export async function bindRunToSession(
  sessionId: number,
  runId: number,
  transaction?: Transaction,
): Promise<ControlledTestSession> {
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    // Lock session row for update
    const session = await ControlledTestSessionModel.findByPk(sessionId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (session.status !== 'active') {
      throw new SessionTerminalError(session.status);
    }

    if (session.discovery_run_id !== null) {
      throw new RunAlreadyBoundError(sessionId, session.discovery_run_id);
    }

    // Check if run is already bound to another session
    const existingBinding = await ControlledTestSessionModel.findOne({
      where: {
        discovery_run_id: runId,
        id: { [Op.ne]: sessionId },
      },
      transaction: t,
    });

    if (existingBinding) {
      throw new RunBoundToOtherSessionError(runId, existingBinding.id);
    }

    // Bind the run
    session.discovery_run_id = runId;
    session.updated_at = new Date();
    await session.save({ transaction: t });

    if (shouldCommit) {
      await t.commit();
    }

    return session;
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    throw error;
  }
}

// ─── Budget Reservation ──────────────────────────────────────────────────────

/**
 * Atomically reserve budget for one AI request.
 * This is the critical path for budget enforcement.
 *
 * Creates a persistent reservation record AND increments session counters
 * in a single database transaction. If either fails, both are rolled back.
 *
 * Reserves ALL THREE limits atomically:
 * - 1 request
 * - Estimated input tokens
 * - Reserved output tokens (typically the full max output allocation)
 *
 * Returns a reservation ID that MUST be used for reconciliation.
 *
 * Returns immediately if:
 * - Input validation fails (non-positive, non-finite, non-integer)
 * - Session not found
 * - Session is in terminal state (cancelled, exhausted, completed)
 * - ANY budget would be exceeded (request, input, OR output)
 *
 * @throws InvalidBudgetInputError if token counts are invalid
 */
export async function reserveBudget(
  input: ReserveBudgetInput,
  transaction?: Transaction,
): Promise<ReserveBudgetResult> {
  // F2: Validate token counts at service boundary
  validateTokenCount('estimatedInputTokens', input.estimatedInputTokens);
  validateTokenCount('reservedOutputTokens', input.reservedOutputTokens);

  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    // Step 1: Atomic UPDATE with preconditions for ALL THREE limits + run binding
    // This is the definitive algorithm per QORI-ROADMAP.md
    //
    // M5e: Strict isolation between bound and unbound reservations:
    // - Bound reservation (discoveryRunId provided): enforce exact binding `discovery_run_id = :discoveryRunId`
    // - Unbound reservation (M3 compatibility): enforce `discovery_run_id IS NULL`
    //
    // This prevents an unbound reservation from consuming a bound session's budget.
    const bindingClause = input.discoveryRunId !== undefined
      ? 'AND discovery_run_id = :discoveryRunId'
      : 'AND discovery_run_id IS NULL';

    const [results] = (await sequelize.query(
      `
      UPDATE controlled_test_sessions
      SET
        used_requests = used_requests + 1,
        used_input_tokens = used_input_tokens + :estimatedInputTokens,
        used_output_tokens = used_output_tokens + :reservedOutputTokens,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = :sessionId
        AND status = 'active'
        ${bindingClause}
        AND used_requests < max_requests
        AND used_input_tokens + :estimatedInputTokens <= max_input_tokens
        AND used_output_tokens + :reservedOutputTokens <= max_output_tokens
      RETURNING id
      `,
      {
        replacements: {
          sessionId: input.sessionId,
          discoveryRunId: input.discoveryRunId ?? null,
          estimatedInputTokens: input.estimatedInputTokens,
          reservedOutputTokens: input.reservedOutputTokens,
        },
        raw: true,
        transaction: t,
      },
    )) as [Array<{ id: number }>, unknown];

    const affectedCount = results.length;

    if (affectedCount === 0) {
      // Reservation failed — determine why
      const session = await ControlledTestSessionModel.findByPk(input.sessionId, {
        transaction: t,
      });

      if (shouldCommit) {
        await t.rollback();
      }

      if (!session) {
        return {
          ok: false,
          reason: 'session_not_found',
          sessionStatus: 'cancelled', // Default for missing session
        };
      }

      if (session.status !== 'active') {
        return {
          ok: false,
          reason: 'session_terminal',
          sessionStatus: session.status,
        };
      }

      // M5e: Check run binding mismatch
      if (input.discoveryRunId !== undefined && session.discovery_run_id !== input.discoveryRunId) {
        return {
          ok: false,
          reason: 'run_binding_mismatch',
          sessionStatus: session.status,
        };
      }

      // Session is active but budget would be exceeded
      return {
        ok: false,
        reason: 'budget_exceeded',
        sessionStatus: session.status,
      };
    }

    // Step 2: Create reservation record (same transaction)
    const reservation = await ControlledTestReservationModel.create(
      {
        session_id: input.sessionId,
        reserved_input_tokens: input.estimatedInputTokens,
        reserved_output_tokens: input.reservedOutputTokens,
        purpose: input.purpose ?? null,
        state: 'reserved',
      },
      { transaction: t },
    );

    // Step 3: Fetch updated session for remaining budgets
    const updatedSession = await ControlledTestSessionModel.findByPk(input.sessionId, {
      transaction: t,
    });

    if (shouldCommit) {
      await t.commit();
    }

    if (!updatedSession) {
      // Should not happen, but handle defensively
      return {
        ok: false,
        reason: 'session_not_found',
        sessionStatus: 'cancelled',
      };
    }

    return {
      ok: true,
      reservationId: reservation.id,
      sessionStatus: updatedSession.status,
      remainingRequests: updatedSession.max_requests - updatedSession.used_requests,
      remainingInputTokens: updatedSession.max_input_tokens - updatedSession.used_input_tokens,
      remainingOutputTokens: updatedSession.max_output_tokens - updatedSession.used_output_tokens,
    };
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    throw error;
  }
}

// ─── Usage Reconciliation ────────────────────────────────────────────────────

/**
 * Reconcile actual token usage after AI request completes.
 *
 * IDEMPOTENT: If the reservation has already been reconciled, returns
 * `{ ok: true, alreadyReconciled: true }` without modifying any counters.
 *
 * Uses the reservation ID to:
 * 1. Verify the reservation exists and belongs to the expected session
 * 2. Lock the reservation row to prevent concurrent reconciliation
 * 3. Check if already reconciled (return idempotent result)
 * 4. Calculate and release unused output allocation
 * 5. Atomically update reservation state and session counters
 *
 * Conservative reconciliation:
 * - Releases unused output allocation (reserved - actual)
 * - Never releases more than was reserved
 * - Never allows negative usage counters
 * - Does NOT reconcile input tokens (conservative estimate retained)
 *
 * If any budget limit is reached after reconciliation, transitions session to 'exhausted'.
 *
 * @throws InvalidBudgetInputError if actualOutputTokens is invalid
 */
export async function reconcileUsage(
  input: ReconcileUsageInput,
  transaction?: Transaction,
): Promise<ReconcileUsageResult> {
  // Validate output token values
  // actualOutputTokens can be 0 if the model returned empty response
  if (typeof input.actualOutputTokens !== 'number' || !Number.isFinite(input.actualOutputTokens)) {
    throw new InvalidBudgetInputError('actualOutputTokens', input.actualOutputTokens, 'must be a finite number');
  }
  if (input.actualOutputTokens < 0) {
    throw new InvalidBudgetInputError('actualOutputTokens', input.actualOutputTokens, 'cannot be negative');
  }

  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    // Step 1: Lock and fetch the reservation
    const reservation = await ControlledTestReservationModel.findByPk(input.reservationId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!reservation) {
      if (shouldCommit) {
        await t.rollback();
      }
      return {
        ok: false,
        alreadyReconciled: false,
        reason: 'reservation_not_found',
      };
    }

    // Step 2: Check if already reconciled (IDEMPOTENT)
    if (reservation.state === 'reconciled') {
      // Fetch session for return value
      const session = await ControlledTestSessionModel.findByPk(reservation.session_id, {
        transaction: t,
      });

      if (shouldCommit) {
        await t.commit(); // No changes, but commit the read
      }

      return {
        ok: true,
        alreadyReconciled: true,
        session: session ?? undefined,
        reservedOutputTokens: reservation.reserved_output_tokens,
        tokensReleased: 0,
      };
    }

    // Step 3: Lock and fetch the session
    const session = await ControlledTestSessionModel.findByPk(reservation.session_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!session) {
      if (shouldCommit) {
        await t.rollback();
      }
      return {
        ok: false,
        alreadyReconciled: false,
        reason: 'reservation_not_found', // Session deleted, treat as not found
      };
    }

    // Step 4: Calculate tokens to release
    const actualOutput = Math.floor(input.actualOutputTokens);
    const reservedOutput = reservation.reserved_output_tokens;

    // Calculate how much to release: reserved - actual, but capped
    const toRelease = Math.max(0, reservedOutput - actualOutput);

    // Ensure we never go negative
    const newUsedOutputTokens = Math.max(0, session.used_output_tokens - toRelease);

    // Step 5: Update session counters
    session.used_output_tokens = newUsedOutputTokens;
    session.updated_at = new Date();

    // Check for budget exhaustion (after reconciliation)
    const requestsExhausted = session.used_requests >= session.max_requests;
    const inputTokensExhausted = session.used_input_tokens >= session.max_input_tokens;
    const outputTokensExhausted = session.used_output_tokens >= session.max_output_tokens;

    if (
      session.status === 'active' &&
      (requestsExhausted || inputTokensExhausted || outputTokensExhausted)
    ) {
      session.status = 'exhausted';
      session.exhausted_at = new Date();
    }

    await session.save({ transaction: t });

    // Step 6: Update reservation state
    reservation.state = 'reconciled';
    reservation.actual_input_tokens = input.actualInputTokens;
    reservation.actual_output_tokens = actualOutput;
    reservation.reconciled_at = new Date();

    await reservation.save({ transaction: t });

    if (shouldCommit) {
      await t.commit();
    }

    return {
      ok: true,
      alreadyReconciled: false,
      session,
      reservedOutputTokens: reservedOutput,
      tokensReleased: toRelease,
    };
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    throw error;
  }
}

// ─── Terminal State Transitions ──────────────────────────────────────────────

/**
 * Cancel a session manually.
 * A cancelled session's bound run is still identifiable for budget enforcement.
 *
 * @throws SessionNotFoundError if session doesn't exist
 * @throws SessionTerminalError if session is already terminal
 */
export async function cancelSession(
  sessionId: number,
  reason?: string,
  transaction?: Transaction,
): Promise<ControlledTestSession> {
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    const session = await ControlledTestSessionModel.findByPk(sessionId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (session.status !== 'active') {
      throw new SessionTerminalError(session.status);
    }

    session.status = 'cancelled';
    session.cancelled_at = new Date();
    session.cancellation_reason = reason ?? null;
    session.updated_at = new Date();

    await session.save({ transaction: t });

    if (shouldCommit) {
      await t.commit();
    }

    return session;
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    throw error;
  }
}

/**
 * Mark session as completed after successful run completion.
 *
 * @throws SessionNotFoundError if session doesn't exist
 * @throws SessionTerminalError if session is already terminal
 */
export async function completeSession(
  sessionId: number,
  transaction?: Transaction,
): Promise<ControlledTestSession> {
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    const session = await ControlledTestSessionModel.findByPk(sessionId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (session.status !== 'active') {
      throw new SessionTerminalError(session.status);
    }

    session.status = 'completed';
    session.completed_at = new Date();
    session.updated_at = new Date();

    await session.save({ transaction: t });

    if (shouldCommit) {
      await t.commit();
    }

    return session;
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    throw error;
  }
}
