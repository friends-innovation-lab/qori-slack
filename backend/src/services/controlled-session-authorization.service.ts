/**
 * Controlled Session Authorization Service — DISC-WEB-1D-2 M5c
 *
 * Provides narrowly scoped, reusable validation functions for controlled
 * Discovery execution authorization. These are PREFLIGHT checks only —
 * final creation and binding must be atomic in a later milestone.
 *
 * Key invariants:
 * 1. DISC_WEB1D_ENABLED gate must be explicitly 'true' (default-off)
 * 2. Actor ownership is mandatory for API-facing operations
 * 3. Session status and binding state are checked atomically in later milestones
 * 4. Authorization failures are distinguished from missing records
 * 5. Terminal sessions may be eligible for read-only replay but never execution
 *
 * This module is ISOLATED from:
 * - Discovery routes and poller
 * - Provider factory and routing
 * - Budget reservation SQL
 * - Database schema
 *
 * Final provider invocation must also enforce the active bound session
 * through atomic budget reservation (M3 budgetedInvoke).
 */

import type { ControlledTestSession, ControlledTestSessionStatus } from '../database/models/controlled_test_session';
import { getSessionById, getSessionByRunId } from './controlled-test-budget.service';

// ─── Capability Gate ──────────────────────────────────────────────────────────

/**
 * Environment variable name for controlled execution gate.
 * Independent of DISC_WEB1_ENABLED (Discovery web feature gate).
 */
export const CONTROLLED_EXECUTION_GATE = 'DISC_WEB1D_ENABLED';

/**
 * Check if controlled execution is enabled.
 *
 * Default: DISABLED (false).
 * Only the exact string value 'true' enables the gate.
 *
 * When disabled:
 * - All authorization checks fail closed
 * - No controlled runs can be created or executed
 * - Existing Discovery and Slack paths are unaffected
 *
 * @returns true if controlled execution is enabled, false otherwise
 */
export function isControlledExecutionEnabled(): boolean {
  return process.env[CONTROLLED_EXECUTION_GATE] === 'true';
}

// ─── Authorization Result Types ───────────────────────────────────────────────

/**
 * Base authorization result with common fields.
 */
interface BaseAuthorizationResult {
  /** Whether authorization was successful */
  authorized: boolean;
  /** Reason for rejection (if authorized=false) */
  reason?: AuthorizationFailureReason;
  /** Session found during check (if any) */
  session?: ControlledTestSession;
}

/**
 * Enumeration of authorization failure reasons.
 * These are intentionally generic to avoid exposing sensitive session details.
 */
export type AuthorizationFailureReason =
  | 'gate_disabled'           // DISC_WEB1D_ENABLED !== 'true'
  | 'missing_actor_id'        // Actor identity not provided
  | 'invalid_actor_id'        // Actor ID is not a valid positive integer
  | 'missing_session_id'      // Session ID not provided
  | 'invalid_session_id'      // Session ID is not a valid positive integer
  | 'missing_run_id'          // Run ID not provided
  | 'invalid_run_id'          // Run ID is not a valid positive integer
  | 'session_not_found'       // Session does not exist
  | 'actor_mismatch'          // Actor does not own the session
  | 'session_not_active'      // Session is in terminal state
  | 'session_already_bound'   // Session already bound to a run (for new run)
  | 'session_not_bound'       // Session not bound to any run (for execution)
  | 'run_mismatch';           // Session bound to different run

/**
 * Result of new controlled run eligibility check.
 */
export interface NewRunEligibilityResult extends BaseAuthorizationResult {
  /** Session ID if authorized */
  sessionId?: number;
}

/**
 * Result of execution eligibility check (for poller).
 */
export interface ExecutionEligibilityResult extends BaseAuthorizationResult {
  /** Session ID if authorized */
  sessionId?: number;
  /** Run ID that was checked */
  runId?: number;
}

/**
 * Result of idempotent replay eligibility check.
 */
export interface ReplayEligibilityResult extends BaseAuthorizationResult {
  /** Whether this is a read-only replay (terminal session) */
  readOnly: boolean;
  /** Session ID if authorized */
  sessionId?: number;
  /** Run ID that was checked */
  runId?: number;
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validate that a value is a positive safe integer.
 */
function isValidPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

// ─── New Run Eligibility ──────────────────────────────────────────────────────

/**
 * Input for new controlled run eligibility check.
 */
export interface NewRunEligibilityInput {
  /** Actor ID making the request (from authenticated session) */
  actorId: number | null | undefined;
  /** Session ID to check */
  sessionId: number | null | undefined;
}

/**
 * Check if a new controlled run can be created with the given session.
 *
 * Requirements:
 * - Capability gate is enabled
 * - Actor ID is valid
 * - Session ID is valid
 * - Session exists
 * - Actor owns the session
 * - Session is active
 * - Session is unbound (discovery_run_id IS NULL)
 *
 * This is a PREFLIGHT check. Final creation and binding must be atomic.
 *
 * @param input - Actor and session identifiers
 * @returns Authorization result
 */
export async function checkNewRunEligibility(
  input: NewRunEligibilityInput,
): Promise<NewRunEligibilityResult> {
  // Gate check first (fail closed)
  if (!isControlledExecutionEnabled()) {
    return { authorized: false, reason: 'gate_disabled' };
  }

  // Validate actor ID
  if (input.actorId === null || input.actorId === undefined) {
    return { authorized: false, reason: 'missing_actor_id' };
  }
  if (!isValidPositiveInteger(input.actorId)) {
    return { authorized: false, reason: 'invalid_actor_id' };
  }

  // Validate session ID
  if (input.sessionId === null || input.sessionId === undefined) {
    return { authorized: false, reason: 'missing_session_id' };
  }
  if (!isValidPositiveInteger(input.sessionId)) {
    return { authorized: false, reason: 'invalid_session_id' };
  }

  // Fetch session
  const session = await getSessionById(input.sessionId);
  if (!session) {
    return { authorized: false, reason: 'session_not_found' };
  }

  // Check actor ownership
  if (session.created_by_actor_id !== input.actorId) {
    return { authorized: false, reason: 'actor_mismatch', session };
  }

  // Check session is active
  if (session.status !== 'active') {
    return { authorized: false, reason: 'session_not_active', session };
  }

  // Check session is unbound
  if (session.discovery_run_id !== null) {
    return { authorized: false, reason: 'session_already_bound', session };
  }

  return {
    authorized: true,
    session,
    sessionId: session.id,
  };
}

// ─── Execution Eligibility ────────────────────────────────────────────────────

/**
 * Input for execution eligibility check (poller).
 */
export interface ExecutionEligibilityInput {
  /** Discovery run ID being executed */
  runId: number | null | undefined;
}

/**
 * Check if a controlled run can be executed.
 *
 * This is for INTERNAL poller execution — no actor identity required.
 * The poller operates on behalf of the system.
 *
 * Requirements:
 * - Capability gate is enabled
 * - Run ID is valid
 * - Session exists that is bound to this run
 * - Session is active (not cancelled, exhausted, or completed)
 *
 * This is a PREFLIGHT check. Final execution uses atomic budget reservation.
 *
 * @param input - Run identifier
 * @returns Authorization result
 */
export async function checkExecutionEligibility(
  input: ExecutionEligibilityInput,
): Promise<ExecutionEligibilityResult> {
  // Gate check first (fail closed)
  if (!isControlledExecutionEnabled()) {
    return { authorized: false, reason: 'gate_disabled' };
  }

  // Validate run ID
  if (input.runId === null || input.runId === undefined) {
    return { authorized: false, reason: 'missing_run_id' };
  }
  if (!isValidPositiveInteger(input.runId)) {
    return { authorized: false, reason: 'invalid_run_id' };
  }

  // Fetch session by run binding
  const session = await getSessionByRunId(input.runId);
  if (!session) {
    // No session bound to this run — not a controlled run
    return { authorized: false, reason: 'session_not_found', runId: input.runId };
  }

  // Check session is active (not terminal)
  if (session.status !== 'active') {
    return {
      authorized: false,
      reason: 'session_not_active',
      session,
      sessionId: session.id,
      runId: input.runId,
    };
  }

  return {
    authorized: true,
    session,
    sessionId: session.id,
    runId: input.runId,
  };
}

// ─── Replay Eligibility ───────────────────────────────────────────────────────

/**
 * Input for idempotent replay eligibility check.
 */
export interface ReplayEligibilityInput {
  /** Actor ID making the request (from authenticated session) */
  actorId: number | null | undefined;
  /** Session ID to check */
  sessionId: number | null | undefined;
  /** Run ID returned by the replay */
  runId: number | null | undefined;
}

/**
 * Check if an idempotent replay is authorized.
 *
 * Requirements:
 * - Capability gate is enabled
 * - Actor ID is valid
 * - Session ID is valid
 * - Run ID is valid
 * - Session exists
 * - Actor owns the session
 * - Session is bound to the specified run (immutable binding match)
 *
 * Terminal session handling:
 * - Active sessions: eligible for execution replay
 * - Terminal sessions (cancelled/exhausted/completed): eligible for READ-ONLY replay
 *   (returning existing data without new execution)
 *
 * This is a PREFLIGHT check. The idempotency endpoint is NOT implemented in M5c.
 *
 * @param input - Actor, session, and run identifiers
 * @returns Authorization result with readOnly flag
 */
export async function checkReplayEligibility(
  input: ReplayEligibilityInput,
): Promise<ReplayEligibilityResult> {
  // Gate check first (fail closed)
  if (!isControlledExecutionEnabled()) {
    return { authorized: false, readOnly: false, reason: 'gate_disabled' };
  }

  // Validate actor ID
  if (input.actorId === null || input.actorId === undefined) {
    return { authorized: false, readOnly: false, reason: 'missing_actor_id' };
  }
  if (!isValidPositiveInteger(input.actorId)) {
    return { authorized: false, readOnly: false, reason: 'invalid_actor_id' };
  }

  // Validate session ID
  if (input.sessionId === null || input.sessionId === undefined) {
    return { authorized: false, readOnly: false, reason: 'missing_session_id' };
  }
  if (!isValidPositiveInteger(input.sessionId)) {
    return { authorized: false, readOnly: false, reason: 'invalid_session_id' };
  }

  // Validate run ID
  if (input.runId === null || input.runId === undefined) {
    return { authorized: false, readOnly: false, reason: 'missing_run_id' };
  }
  if (!isValidPositiveInteger(input.runId)) {
    return { authorized: false, readOnly: false, reason: 'invalid_run_id' };
  }

  // Fetch session
  const session = await getSessionById(input.sessionId);
  if (!session) {
    return { authorized: false, readOnly: false, reason: 'session_not_found' };
  }

  // Check actor ownership
  if (session.created_by_actor_id !== input.actorId) {
    return { authorized: false, readOnly: false, reason: 'actor_mismatch', session };
  }

  // Check session is bound
  if (session.discovery_run_id === null) {
    return {
      authorized: false,
      readOnly: false,
      reason: 'session_not_bound',
      session,
      sessionId: session.id,
    };
  }

  // Check binding matches the requested run
  if (session.discovery_run_id !== input.runId) {
    return {
      authorized: false,
      readOnly: false,
      reason: 'run_mismatch',
      session,
      sessionId: session.id,
      runId: input.runId,
    };
  }

  // Determine if read-only based on session status
  const readOnly = session.status !== 'active';

  return {
    authorized: true,
    readOnly,
    session,
    sessionId: session.id,
    runId: input.runId,
  };
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Check if a failure reason indicates a missing or invalid identifier
 * (safe to expose to API callers).
 */
export function isIdentifierError(reason: AuthorizationFailureReason): boolean {
  return [
    'missing_actor_id',
    'invalid_actor_id',
    'missing_session_id',
    'invalid_session_id',
    'missing_run_id',
    'invalid_run_id',
  ].includes(reason);
}

/**
 * Check if a failure reason is related to the capability gate.
 */
export function isGateError(reason: AuthorizationFailureReason): boolean {
  return reason === 'gate_disabled';
}

/**
 * Check if a failure reason is an authorization error
 * (ownership, binding, or status mismatch).
 */
export function isAuthorizationError(reason: AuthorizationFailureReason): boolean {
  return [
    'actor_mismatch',
    'session_not_active',
    'session_already_bound',
    'session_not_bound',
    'run_mismatch',
  ].includes(reason);
}

/**
 * Get a safe error message for API responses.
 * Does not expose internal session details.
 */
export function getSafeErrorMessage(reason: AuthorizationFailureReason): string {
  switch (reason) {
    case 'gate_disabled':
      return 'Controlled execution is not enabled';
    case 'missing_actor_id':
      return 'Actor identity is required';
    case 'invalid_actor_id':
      return 'Invalid actor identity';
    case 'missing_session_id':
      return 'Session identifier is required';
    case 'invalid_session_id':
      return 'Invalid session identifier';
    case 'missing_run_id':
      return 'Run identifier is required';
    case 'invalid_run_id':
      return 'Invalid run identifier';
    case 'session_not_found':
      return 'Session not found';
    case 'actor_mismatch':
      return 'Not authorized for this session';
    case 'session_not_active':
      return 'Session is not active';
    case 'session_already_bound':
      return 'Session is already bound to a run';
    case 'session_not_bound':
      return 'Session is not bound to a run';
    case 'run_mismatch':
      return 'Session is bound to a different run';
  }
}
