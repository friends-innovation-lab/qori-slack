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
 * M1 scope: Database and service layer only. No AI invocation paths.
 */

import sequelize from '../database';
import { Op, type Transaction } from 'sequelize';
import type {
  ControlledTestSession,
  ControlledTestSessionStatus,
} from '../database/models/controlled_test_session';

const ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;

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
  /** Estimated input tokens for this request */
  estimatedInputTokens: number;
}

export interface ReconcileUsageInput {
  /** Session ID (internal) */
  sessionId: number;
  /** Actual input tokens consumed */
  actualInputTokens: number;
  /** Actual output tokens consumed */
  actualOutputTokens: number;
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface ReserveBudgetResult {
  /** Whether reservation was successful */
  ok: boolean;
  /** Reason for failure (if ok=false) */
  reason?: 'session_not_found' | 'session_terminal' | 'budget_exceeded';
  /** Session status at time of check */
  sessionStatus: ControlledTestSessionStatus;
  /** Remaining requests after reservation (if ok=true) */
  remainingRequests?: number;
  /** Remaining input tokens after reservation (if ok=true) */
  remainingInputTokens?: number;
  /** Remaining output tokens after reservation (if ok=true) */
  remainingOutputTokens?: number;
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
 * Uses atomic UPDATE with preconditions to prevent race conditions.
 * Session status is checked atomically with the budget update.
 *
 * Returns immediately if:
 * - Session not found
 * - Session is in terminal state (cancelled, exhausted, completed)
 * - Budget would be exceeded
 */
export async function reserveBudget(
  input: ReserveBudgetInput,
  transaction?: Transaction,
): Promise<ReserveBudgetResult> {
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    // Atomic UPDATE with preconditions
    // This is the definitive algorithm per QORI-ROADMAP.md
    // Note: Sequelize query() returns [results, metadata] for raw queries
    const [results] = (await sequelize.query(
      `
      UPDATE controlled_test_sessions
      SET
        used_requests = used_requests + 1,
        used_input_tokens = used_input_tokens + :estimatedInputTokens,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = :sessionId
        AND status = 'active'
        AND used_requests < max_requests
        AND used_input_tokens + :estimatedInputTokens <= max_input_tokens
      RETURNING id
      `,
      {
        replacements: {
          sessionId: input.sessionId,
          estimatedInputTokens: input.estimatedInputTokens,
        },
        raw: true,
        transaction: t,
      },
    )) as [Array<{ id: number }>, unknown];

    // results is an array of returned rows; empty means no rows matched
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

      // Session is active but budget would be exceeded
      return {
        ok: false,
        reason: 'budget_exceeded',
        sessionStatus: session.status,
      };
    }

    // Reservation succeeded — fetch updated session for remaining budgets
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
 * Updates input/output token counts and checks for budget exhaustion.
 *
 * If any budget limit is reached, transitions session to 'exhausted'.
 */
export async function reconcileUsage(
  input: ReconcileUsageInput,
  transaction?: Transaction,
): Promise<ControlledTestSession> {
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    const session = await ControlledTestSessionModel.findByPk(input.sessionId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!session) {
      throw new SessionNotFoundError(input.sessionId);
    }

    // Update output tokens (input tokens were already reserved)
    // Note: We allow going slightly over on output tokens since we can't predict exact output
    session.used_output_tokens = session.used_output_tokens + input.actualOutputTokens;
    session.updated_at = new Date();

    // Check for budget exhaustion
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
