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

// ─── M6: API-Layer Error Types ───────────────────────────────────────────────

/**
 * Error thrown when actor does not own the session (API authorization).
 */
export class SessionActorMismatchError extends Error {
  constructor(sessionPublicId: string, actorId: number) {
    super(`Actor ${actorId} does not own session ${sessionPublicId}`);
    this.name = 'SessionActorMismatchError';
  }
}

/**
 * Error thrown when session is in a non-cancellable terminal state (completed/exhausted).
 */
export class SessionNotCancellableError extends Error {
  constructor(sessionPublicId: string, status: ControlledTestSessionStatus) {
    super(`Session ${sessionPublicId} cannot be cancelled (status: ${status})`);
    this.name = 'SessionNotCancellableError';
    this.status = status;
  }
  public readonly status: ControlledTestSessionStatus;
}

/**
 * Error thrown when session/run binding validation fails.
 */
export class SessionBindingValidationError extends Error {
  constructor(sessionPublicId: string, reason: string) {
    super(`Session ${sessionPublicId} binding validation failed: ${reason}`);
    this.name = 'SessionBindingValidationError';
  }
}

// ─── M9a: Idempotency Error Types ─────────────────────────────────────────────

/**
 * Error thrown when idempotency key is reused with different payload.
 */
export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency-Key already used with different payload');
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Error thrown when a concurrent operation should be retried.
 */
export class ConcurrencyRetryableError extends Error {
  constructor() {
    super('Concurrent modification detected, please retry');
    this.name = 'ConcurrencyRetryableError';
  }
}

/**
 * Error thrown when session project_id does not match run project.
 */
export class SessionProjectMismatchError extends Error {
  constructor(sessionPublicId: string, sessionProjectId: number, runProjectId: number) {
    super(
      `Session ${sessionPublicId} project (${sessionProjectId}) does not match run project (${runProjectId})`,
    );
    this.name = 'SessionProjectMismatchError';
  }
}

// ─── M6: API Result Types ────────────────────────────────────────────────────

export interface CancelSessionFromApiResult {
  /** Session public ID */
  sessionPublicId: string;
  /** Final session status */
  status: ControlledTestSessionStatus;
  /** Timestamp of cancellation */
  cancelledAt: Date;
  /** Cancellation reason */
  cancellationReason: string | null;
  /** Whether this was an idempotent return (already cancelled) */
  idempotent: boolean;
  /** Bound run public ID (if any) */
  boundRunPublicId: string | null;
  /** Bound run final status (if any) */
  boundRunStatus: string | null;
}

export interface SessionListItem {
  publicId: string;
  status: ControlledTestSessionStatus;
  boundRunPublicId: string | null;
  boundRunStatus: string | null;
  budget: {
    maxRequests: number;
    usedRequests: number;
    remainingRequests: number;
    maxInputTokens: number;
    usedInputTokens: number;
    remainingInputTokens: number;
    maxOutputTokens: number;
    usedOutputTokens: number;
    remainingOutputTokens: number;
  };
  createdAt: Date;
  cancelledAt: Date | null;
  exhaustedAt: Date | null;
  completedAt: Date | null;
}

export interface SessionDetailResult {
  publicId: string;
  status: ControlledTestSessionStatus;
  boundRunPublicId: string | null;
  boundRunStatus: string | null;
  budget: {
    maxRequests: number;
    usedRequests: number;
    remainingRequests: number;
    maxInputTokens: number;
    usedInputTokens: number;
    remainingInputTokens: number;
    maxOutputTokens: number;
    usedOutputTokens: number;
    remainingOutputTokens: number;
  };
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    cancelledAt: Date | null;
    exhaustedAt: Date | null;
    completedAt: Date | null;
  };
  cancellationReason: string | null;
}

export interface ReservationListItem {
  publicId: string;
  state: ControlledTestReservationState;
  reservedInputTokens: number;
  reservedOutputTokens: number;
  actualInputTokens: number | null;
  actualOutputTokens: number | null;
  purpose: string | null;
  createdAt: Date;
  reconciledAt: Date | null;
}

export interface PaginatedReservationsResult {
  items: ReservationListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ─── M9a: API Session Creation Types ──────────────────────────────────────────

/**
 * Server-side budget ceilings for controlled sessions.
 * These are hard limits that cannot be exceeded via API.
 */
export const SESSION_BUDGET_CEILINGS = {
  maxRequests: 4,
  maxInputTokens: 40_000,
  maxOutputTokens: 16_384,
} as const;

/**
 * Default budget values when omitted from API request.
 */
export const SESSION_BUDGET_DEFAULTS = {
  maxRequests: 4,
  maxInputTokens: 40_000,
  maxOutputTokens: 16_384,
} as const;

export interface CreateSessionForApiInput {
  /** Actor ID (internal) */
  actorId: number;
  /** Project ID (internal) */
  projectId: number;
  /** Client-provided idempotency key (UUID v4) */
  idempotencyKey: string;
  /** Maximum AI requests allowed */
  maxRequests: number;
  /** Maximum input tokens allowed */
  maxInputTokens: number;
  /** Maximum output tokens allowed */
  maxOutputTokens: number;
}

export interface CreateSessionForApiResult {
  /** Created or replayed session */
  session: ControlledTestSession;
  /** Whether this was an idempotent replay */
  isReplay: boolean;
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

// ─── M9a: Session Creation with Idempotency ───────────────────────────────────

/**
 * Compute SHA-256 hash of canonical budget payload for idempotency comparison.
 */
function computeSessionPayloadHash(input: {
  maxRequests: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}): string {
  const crypto = require('crypto');
  // Canonical form: sorted keys, consistent serialization
  const canonical = JSON.stringify({
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    maxRequests: input.maxRequests,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute advisory lock ID for session creation.
 * All API session-creation requests share this lock.
 */
function computeSessionCreationLockId(): number {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update('controlled_session_creation_m9a').digest();
  return hash.readInt32LE(0);
}

const SESSION_CREATION_LOCK_ID = computeSessionCreationLockId();

/**
 * Check if error is a PostgreSQL unique constraint violation.
 */
function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const original = (error as { original?: { code?: string } }).original;
  // PostgreSQL error code 23505 = unique_violation
  return original?.code === '23505' || error.name === 'SequelizeUniqueConstraintError';
}

/**
 * Get constraint name from PostgreSQL error.
 */
function getConstraintName(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const original = (error as { original?: { constraint?: string } }).original;
  return original?.constraint;
}

/**
 * Check if error is a PostgreSQL serialization failure.
 */
function isSerializationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const original = (error as { original?: { code?: string } }).original;
  // PostgreSQL error code 40001 = serialization_failure
  // PostgreSQL error code 40P01 = deadlock_detected
  return original?.code === '40001' || original?.code === '40P01';
}

/**
 * Create a controlled test session via API with idempotency support.
 *
 * M9a: Transaction-scoped advisory lock serializes all session creation.
 * Idempotency is scoped to (actor_id, project_id, idempotency_key).
 *
 * @throws SessionAlreadyExistsError if another active session exists
 * @throws IdempotencyConflictError if key reused with different payload
 * @throws ConcurrencyRetryableError if serialization failure
 */
export async function createSessionForApi(
  input: CreateSessionForApiInput,
): Promise<CreateSessionForApiResult> {
  const { QueryTypes } = require('sequelize');

  const payloadHash = computeSessionPayloadHash({
    maxRequests: input.maxRequests,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
  });

  const transaction = await sequelize.transaction();

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // Step 1: Acquire transaction-scoped advisory lock
    // ═══════════════════════════════════════════════════════════════════════
    // This serializes ALL session creation attempts across the system.
    // Lock is automatically released on commit or rollback.
    await sequelize.query('SELECT pg_advisory_xact_lock($1)', {
      bind: [SESSION_CREATION_LOCK_ID],
      type: QueryTypes.SELECT,
      transaction,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Step 2: Exact idempotency lookup
    // ═══════════════════════════════════════════════════════════════════════
    const existing = await ControlledTestSessionModel.findOne({
      where: {
        created_by_actor_id: input.actorId,
        project_id: input.projectId,
        idempotency_key: input.idempotencyKey,
      },
      transaction,
    });

    if (existing) {
      // ═══════════════════════════════════════════════════════════════════════
      // Step 3a: Payload-hash comparison for replay vs conflict
      // ═══════════════════════════════════════════════════════════════════════
      if (existing.idempotency_payload_hash !== payloadHash) {
        await transaction.commit(); // Release lock cleanly
        throw new IdempotencyConflictError();
      }

      // Replay: return existing session (no state change)
      await transaction.commit();
      return { session: existing, isReplay: true };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 4: Global active-session check
    // ═══════════════════════════════════════════════════════════════════════
    const activeSession = await ControlledTestSessionModel.findOne({
      where: { status: 'active' },
      transaction,
    });

    if (activeSession) {
      await transaction.commit(); // Release lock cleanly
      throw new SessionAlreadyExistsError();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 5: Create new session
    // ═══════════════════════════════════════════════════════════════════════
    const session = await ControlledTestSessionModel.create(
      {
        project_id: input.projectId,
        created_by_actor_id: input.actorId,
        idempotency_key: input.idempotencyKey,
        idempotency_payload_hash: payloadHash,
        max_requests: input.maxRequests,
        max_input_tokens: input.maxInputTokens,
        max_output_tokens: input.maxOutputTokens,
        status: 'active',
      },
      { transaction },
    );

    // ═══════════════════════════════════════════════════════════════════════
    // Step 6: Commit
    // ═══════════════════════════════════════════════════════════════════════
    await transaction.commit();
    return { session, isReplay: false };
  } catch (error) {
    // Single rollback point — transaction may already be committed above
    if (!(transaction as { finished?: string }).finished) {
      await transaction.rollback();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 7: Handle PostgreSQL constraint violations by error code
    // ═══════════════════════════════════════════════════════════════════════
    if (isUniqueConstraintError(error)) {
      const constraintName = getConstraintName(error);

      // Global single-active-session constraint (database backstop)
      if (constraintName === 'controlled_test_sessions_single_active_idx') {
        throw new SessionAlreadyExistsError();
      }

      // Idempotency constraint — concurrent duplicate
      if (constraintName === 'controlled_test_sessions_actor_project_idempotency_key_idx') {
        // Race condition: concurrent request with same key won
        // Fetch the winner's session to determine replay vs conflict
        const concurrentSession = await ControlledTestSessionModel.findOne({
          where: {
            created_by_actor_id: input.actorId,
            project_id: input.projectId,
            idempotency_key: input.idempotencyKey,
          },
        });

        if (concurrentSession?.idempotency_payload_hash === payloadHash) {
          return { session: concurrentSession, isReplay: true };
        }
        throw new IdempotencyConflictError();
      }
    }

    // Serialization failure (rare with advisory lock, but possible)
    if (isSerializationError(error)) {
      throw new ConcurrencyRetryableError();
    }

    throw error;
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
 * M9a: If session has project_id, it must match the run's project.
 * Legacy sessions with null project_id retain previous behavior.
 *
 * @throws SessionNotFoundError if session doesn't exist
 * @throws SessionTerminalError if session is not active
 * @throws RunAlreadyBoundError if session already has a run
 * @throws RunBoundToOtherSessionError if run is bound to another session
 * @throws SessionProjectMismatchError if session.project_id !== run.project_id
 */
export async function bindRunToSession(
  sessionId: number,
  runId: number,
  runProjectId: number,
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

    // M9a: Validate project binding if session has project_id
    // Legacy sessions with null project_id skip this check
    if (session.project_id !== null && session.project_id !== runProjectId) {
      throw new SessionProjectMismatchError(session.public_id, session.project_id, runProjectId);
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

// ═══════════════════════════════════════════════════════════════════════════
// M6: API-Layer Session Administration
// ═══════════════════════════════════════════════════════════════════════════

// Model reference for DiscoveryRun
import type { DiscoveryRun } from '../database/models/discovery_run';
const DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;

/**
 * List controlled sessions for a project, filtered by creator actor.
 * Only returns sessions bound to runs in the specified project.
 *
 * M6: Unbound sessions are excluded from project-scoped queries.
 */
export async function listSessionsByProjectAndActor(
  projectId: number,
  actorId: number,
  options: { limit?: number; offset?: number } = {},
): Promise<{ items: SessionListItem[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  // Query sessions with bound runs in the project, owned by actor
  const [countResult] = await sequelize.query(
    `
    SELECT COUNT(*) as count
    FROM controlled_test_sessions s
    INNER JOIN discovery_runs r ON s.discovery_run_id = r.id
    WHERE r.project_id = :projectId
      AND s.created_by_actor_id = :actorId
      AND r.is_controlled = TRUE
    `,
    {
      replacements: { projectId, actorId },
    },
  );
  const total = parseInt((countResult as Array<{ count: string }>)[0]?.count ?? '0', 10);

  const [rows] = await sequelize.query(
    `
    SELECT
      s.public_id as session_public_id,
      s.status,
      s.max_requests,
      s.max_input_tokens,
      s.max_output_tokens,
      s.used_requests,
      s.used_input_tokens,
      s.used_output_tokens,
      s.created_at,
      s.cancelled_at,
      s.exhausted_at,
      s.completed_at,
      r.public_id as run_public_id,
      r.status as run_status
    FROM controlled_test_sessions s
    INNER JOIN discovery_runs r ON s.discovery_run_id = r.id
    WHERE r.project_id = :projectId
      AND s.created_by_actor_id = :actorId
      AND r.is_controlled = TRUE
    ORDER BY s.created_at DESC
    LIMIT :limit
    OFFSET :offset
    `,
    {
      replacements: { projectId, actorId, limit, offset },
    },
  );

  const items: SessionListItem[] = (rows as Array<{
    session_public_id: string;
    status: ControlledTestSessionStatus;
    max_requests: number;
    max_input_tokens: number;
    max_output_tokens: number;
    used_requests: number;
    used_input_tokens: number;
    used_output_tokens: number;
    created_at: Date;
    cancelled_at: Date | null;
    exhausted_at: Date | null;
    completed_at: Date | null;
    run_public_id: string;
    run_status: string;
  }>).map(row => ({
    publicId: row.session_public_id,
    status: row.status,
    boundRunPublicId: row.run_public_id,
    boundRunStatus: row.run_status,
    budget: {
      maxRequests: row.max_requests,
      usedRequests: row.used_requests,
      remainingRequests: row.max_requests - row.used_requests,
      maxInputTokens: row.max_input_tokens,
      usedInputTokens: row.used_input_tokens,
      remainingInputTokens: row.max_input_tokens - row.used_input_tokens,
      maxOutputTokens: row.max_output_tokens,
      usedOutputTokens: row.used_output_tokens,
      remainingOutputTokens: row.max_output_tokens - row.used_output_tokens,
    },
    createdAt: new Date(row.created_at),
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    exhaustedAt: row.exhausted_at ? new Date(row.exhausted_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  }));

  return { items, total };
}

/**
 * Get session details by public ID, verifying project and actor ownership.
 *
 * @throws SessionNotFoundError if session not found, unbound, or wrong project
 * @throws SessionActorMismatchError if actor doesn't own the session
 */
export async function getSessionDetailsByPublicId(
  sessionPublicId: string,
  projectId: number,
  actorId: number,
): Promise<SessionDetailResult> {
  const [rows] = await sequelize.query(
    `
    SELECT
      s.id,
      s.public_id as session_public_id,
      s.status,
      s.created_by_actor_id,
      s.max_requests,
      s.max_input_tokens,
      s.max_output_tokens,
      s.used_requests,
      s.used_input_tokens,
      s.used_output_tokens,
      s.created_at,
      s.updated_at,
      s.cancelled_at,
      s.exhausted_at,
      s.completed_at,
      s.cancellation_reason,
      r.public_id as run_public_id,
      r.status as run_status,
      r.project_id,
      r.is_controlled
    FROM controlled_test_sessions s
    INNER JOIN discovery_runs r ON s.discovery_run_id = r.id
    WHERE s.public_id = :sessionPublicId
    `,
    {
      replacements: { sessionPublicId },
    },
  );

  const row = (rows as Array<{
    id: number;
    session_public_id: string;
    status: ControlledTestSessionStatus;
    created_by_actor_id: number | null;
    max_requests: number;
    max_input_tokens: number;
    max_output_tokens: number;
    used_requests: number;
    used_input_tokens: number;
    used_output_tokens: number;
    created_at: Date;
    updated_at: Date;
    cancelled_at: Date | null;
    exhausted_at: Date | null;
    completed_at: Date | null;
    cancellation_reason: string | null;
    run_public_id: string;
    run_status: string;
    project_id: number;
    is_controlled: boolean;
  }>)[0];

  // Not found OR unbound (no join match)
  if (!row) {
    throw new SessionNotFoundError(sessionPublicId);
  }

  // Project mismatch
  if (row.project_id !== projectId) {
    throw new SessionNotFoundError(sessionPublicId);
  }

  // Not a controlled run
  if (!row.is_controlled) {
    throw new SessionNotFoundError(sessionPublicId);
  }

  // Actor mismatch
  if (row.created_by_actor_id !== actorId) {
    throw new SessionActorMismatchError(sessionPublicId, actorId);
  }

  return {
    publicId: row.session_public_id,
    status: row.status,
    boundRunPublicId: row.run_public_id,
    boundRunStatus: row.run_status,
    budget: {
      maxRequests: row.max_requests,
      usedRequests: row.used_requests,
      remainingRequests: row.max_requests - row.used_requests,
      maxInputTokens: row.max_input_tokens,
      usedInputTokens: row.used_input_tokens,
      remainingInputTokens: row.max_input_tokens - row.used_input_tokens,
      maxOutputTokens: row.max_output_tokens,
      usedOutputTokens: row.used_output_tokens,
      remainingOutputTokens: row.max_output_tokens - row.used_output_tokens,
    },
    timestamps: {
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
      exhaustedAt: row.exhausted_at ? new Date(row.exhausted_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    },
    cancellationReason: row.cancellation_reason,
  };
}

/**
 * Get paginated reservations for a session.
 *
 * @throws SessionNotFoundError if session not found, unbound, or wrong project
 * @throws SessionActorMismatchError if actor doesn't own the session
 */
export async function getSessionReservations(
  sessionPublicId: string,
  projectId: number,
  actorId: number,
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedReservationsResult> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  // First verify session access (will throw if invalid)
  const [sessionRows] = await sequelize.query(
    `
    SELECT s.id, s.created_by_actor_id, r.project_id, r.is_controlled
    FROM controlled_test_sessions s
    INNER JOIN discovery_runs r ON s.discovery_run_id = r.id
    WHERE s.public_id = :sessionPublicId
    `,
    {
      replacements: { sessionPublicId },
    },
  );

  const sessionRow = (sessionRows as Array<{
    id: number;
    created_by_actor_id: number | null;
    project_id: number;
    is_controlled: boolean;
  }>)[0];

  if (!sessionRow) {
    throw new SessionNotFoundError(sessionPublicId);
  }

  if (sessionRow.project_id !== projectId || !sessionRow.is_controlled) {
    throw new SessionNotFoundError(sessionPublicId);
  }

  if (sessionRow.created_by_actor_id !== actorId) {
    throw new SessionActorMismatchError(sessionPublicId, actorId);
  }

  const sessionId = sessionRow.id;

  // Count total reservations
  const [countResult] = await sequelize.query(
    `SELECT COUNT(*) as count FROM controlled_test_reservations WHERE session_id = :sessionId`,
    { replacements: { sessionId } },
  );
  const total = parseInt((countResult as Array<{ count: string }>)[0]?.count ?? '0', 10);

  // Get paginated reservations
  const [rows] = await sequelize.query(
    `
    SELECT
      public_id,
      state,
      reserved_input_tokens,
      reserved_output_tokens,
      actual_input_tokens,
      actual_output_tokens,
      purpose,
      created_at,
      reconciled_at
    FROM controlled_test_reservations
    WHERE session_id = :sessionId
    ORDER BY created_at DESC
    LIMIT :limit
    OFFSET :offset
    `,
    {
      replacements: { sessionId, limit, offset },
    },
  );

  const items: ReservationListItem[] = (rows as Array<{
    public_id: string;
    state: ControlledTestReservationState;
    reserved_input_tokens: number;
    reserved_output_tokens: number;
    actual_input_tokens: number | null;
    actual_output_tokens: number | null;
    purpose: string | null;
    created_at: Date;
    reconciled_at: Date | null;
  }>).map(row => ({
    publicId: row.public_id,
    state: row.state,
    reservedInputTokens: row.reserved_input_tokens,
    reservedOutputTokens: row.reserved_output_tokens,
    actualInputTokens: row.actual_input_tokens,
    actualOutputTokens: row.actual_output_tokens,
    purpose: row.purpose,
    createdAt: new Date(row.created_at),
    reconciledAt: row.reconciled_at ? new Date(row.reconciled_at) : null,
  }));

  return {
    items,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    },
  };
}

/**
 * Cancel a controlled session from API.
 *
 * Atomic transaction that:
 * 1. Locks session FOR UPDATE
 * 2. Verifies actor ownership and project binding
 * 3. Handles idempotent cancellation (already cancelled → 200)
 * 4. Rejects non-cancellable states (completed/exhausted → 409)
 * 5. For bound sessions: fails pending run atomically
 * 6. Transitions session to cancelled
 *
 * M10 extension: Unbound sessions (discovery_run_id IS NULL) can be cancelled
 * if the session's project_id matches the requested project. This allows recovery
 * when run creation fails after session creation.
 *
 * Lock order: session first, then run if bound (matches authorizeAndClaimControlledRun).
 *
 * @throws SessionNotFoundError if session not found or wrong project
 * @throws SessionActorMismatchError if actor doesn't own the session
 * @throws SessionNotCancellableError if session is completed or exhausted
 */
export async function cancelControlledSessionFromApi(
  sessionPublicId: string,
  projectId: number,
  actorId: number,
  reason?: string,
): Promise<CancelSessionFromApiResult> {
  const t = await sequelize.transaction();

  try {
    // Step 1: Lock session FOR UPDATE
    const [sessionRows] = await sequelize.query(
      `
      SELECT
        s.id,
        s.public_id,
        s.status,
        s.created_by_actor_id,
        s.discovery_run_id,
        s.project_id,
        s.cancelled_at,
        s.cancellation_reason
      FROM controlled_test_sessions s
      WHERE s.public_id = :sessionPublicId
      FOR UPDATE
      `,
      {
        replacements: { sessionPublicId },
        transaction: t,
      },
    );

    const session = (sessionRows as Array<{
      id: number;
      public_id: string;
      status: ControlledTestSessionStatus;
      created_by_actor_id: number | null;
      discovery_run_id: number | null;
      project_id: number | null;
      cancelled_at: Date | null;
      cancellation_reason: string | null;
    }>)[0];

    if (!session) {
      await t.rollback();
      throw new SessionNotFoundError(sessionPublicId);
    }

    // Step 2: Actor authorization (applies to both bound and unbound)
    if (session.created_by_actor_id !== actorId) {
      await t.rollback();
      throw new SessionActorMismatchError(sessionPublicId, actorId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Path A: Unbound session (M10 extension)
    // ═══════════════════════════════════════════════════════════════════════════
    if (session.discovery_run_id === null) {
      // Verify project authorization via session's project_id
      if (session.project_id !== projectId) {
        await t.rollback();
        throw new SessionNotFoundError(sessionPublicId); // Project mismatch
      }

      // Terminal state handling
      if (session.status === 'cancelled') {
        await t.rollback();
        return {
          sessionPublicId: session.public_id,
          status: 'cancelled',
          cancelledAt: session.cancelled_at!,
          cancellationReason: session.cancellation_reason,
          idempotent: true,
          boundRunPublicId: null,
          boundRunStatus: null,
        };
      }

      if (session.status === 'completed' || session.status === 'exhausted') {
        await t.rollback();
        throw new SessionNotCancellableError(sessionPublicId, session.status);
      }

      // Transition unbound session to cancelled (no run to fail)
      const now = new Date();
      const [, sessionMetadata] = await sequelize.query(
        `
        UPDATE controlled_test_sessions
        SET
          status = 'cancelled',
          cancelled_at = :now,
          cancellation_reason = :reason,
          updated_at = :now
        WHERE id = :sessionId
          AND status = 'active'
        `,
        {
          replacements: {
            sessionId: session.id,
            now,
            reason: reason ?? null,
          },
          transaction: t,
        },
      );

      const sessionRowCount = (sessionMetadata as { rowCount?: number })?.rowCount ?? 0;
      if (sessionRowCount !== 1) {
        await t.rollback();
        throw new SessionBindingValidationError(
          sessionPublicId,
          'Session status changed during cancellation',
        );
      }

      await t.commit();

      return {
        sessionPublicId: session.public_id,
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: reason ?? null,
        idempotent: false,
        boundRunPublicId: null,
        boundRunStatus: null,
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Path B: Bound session (existing M6 behavior)
    // ═══════════════════════════════════════════════════════════════════════════

    // Step 3: Lock bound run FOR UPDATE (lock order: run second)
    const [runRows] = await sequelize.query(
      `
      SELECT id, public_id, status, project_id, is_controlled
      FROM discovery_runs
      WHERE id = :runId
      FOR UPDATE
      `,
      {
        replacements: { runId: session.discovery_run_id },
        transaction: t,
      },
    );

    const run = (runRows as Array<{
      id: number;
      public_id: string;
      status: string;
      project_id: number;
      is_controlled: boolean;
    }>)[0];

    if (!run || run.project_id !== projectId) {
      await t.rollback();
      throw new SessionNotFoundError(sessionPublicId); // Project mismatch
    }

    if (!run.is_controlled) {
      await t.rollback();
      throw new SessionNotFoundError(sessionPublicId); // Not a controlled run
    }

    // Step 4: Terminal state handling
    if (session.status === 'cancelled') {
      // Idempotent success: return original timestamp
      await t.rollback(); // No changes needed
      return {
        sessionPublicId: session.public_id,
        status: 'cancelled',
        cancelledAt: session.cancelled_at!,
        cancellationReason: session.cancellation_reason,
        idempotent: true,
        boundRunPublicId: run.public_id,
        boundRunStatus: run.status,
      };
    }

    if (session.status === 'completed' || session.status === 'exhausted') {
      await t.rollback();
      throw new SessionNotCancellableError(sessionPublicId, session.status);
    }

    // Step 5: Fail bound pending run (single cancellation invariant)
    let finalRunStatus = run.status;
    if (run.status === 'pending') {
      const now = new Date();
      const cancellationMessage = reason || 'Controlled session cancelled by creator';

      const [, metadata] = await sequelize.query(
        `
        UPDATE discovery_runs
        SET
          status = 'failed',
          failure_code = 'SESSION_CANCELLED',
          failure_message = :failureMessage,
          failure_stage = 'controlled_session',
          completed_at = :now,
          updated_at = :now
        WHERE id = :runId
          AND status = 'pending'
        `,
        {
          replacements: {
            runId: run.id,
            failureMessage: cancellationMessage,
            now,
          },
          transaction: t,
        },
      );

      // Verify row was updated
      const rowCount = (metadata as { rowCount?: number })?.rowCount ?? 0;
      if (rowCount !== 1) {
        // Race condition: run status changed between SELECT and UPDATE
        await t.rollback();
        throw new SessionBindingValidationError(
          sessionPublicId,
          'Run status changed during cancellation',
        );
      }

      finalRunStatus = 'failed';
    }

    // Step 6: Transition session to cancelled
    const now = new Date();
    const [, sessionMetadata] = await sequelize.query(
      `
      UPDATE controlled_test_sessions
      SET
        status = 'cancelled',
        cancelled_at = :now,
        cancellation_reason = :reason,
        updated_at = :now
      WHERE id = :sessionId
        AND status = 'active'
      `,
      {
        replacements: {
          sessionId: session.id,
          now,
          reason: reason ?? null,
        },
        transaction: t,
      },
    );

    // Verify row was updated
    const sessionRowCount = (sessionMetadata as { rowCount?: number })?.rowCount ?? 0;
    if (sessionRowCount !== 1) {
      // Race condition: session status changed
      await t.rollback();
      throw new SessionBindingValidationError(
        sessionPublicId,
        'Session status changed during cancellation',
      );
    }

    await t.commit();

    return {
      sessionPublicId: session.public_id,
      status: 'cancelled',
      cancelledAt: now,
      cancellationReason: reason ?? null,
      idempotent: false,
      boundRunPublicId: run.public_id,
      boundRunStatus: finalRunStatus,
    };
  } catch (error) {
    // Rollback if not already done
    try {
      await t.rollback();
    } catch {
      // Already rolled back
    }
    throw error;
  }
}
