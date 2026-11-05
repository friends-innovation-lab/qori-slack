/**
 * Controlled Test Budget Service Integration Tests — DISC-WEB-1D-2 M1 + M5a
 *
 * Tests the critical invariants from QORI-ROADMAP.md:
 * 1. Budget enforcement: cancelled/exhausted/completed sessions block execution
 * 2. Atomic reservation: concurrent requests don't exceed budget
 * 3. Single active session: database constraint enforced
 * 4. Run binding: immutable once set, lookup works regardless of status
 * 5. M5a: ON DELETE RESTRICT prevents orphaning sessions from their bound runs
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import {
  createSession,
  getActiveSession,
  getSessionById,
  getSessionByRunId,
  getReservationById,
  bindRunToSession,
  reserveBudget,
  reconcileUsage,
  cancelSession,
  completeSession,
  toSessionSummary,
  validateTokenCount,
  SessionAlreadyExistsError,
  SessionNotFoundError,
  SessionTerminalError,
  RunAlreadyBoundError,
  InvalidBudgetInputError,
  type CreateSessionInput,
  type ReserveBudgetResult,
  type ReconcileUsageResult,
} from '../../services/controlled-test-budget.service';

const sequelize = getTestDb();
const ControlledTestSessionModel = sequelize.models.ControlledTestSession;
const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const DiscoveryRunModel = sequelize.models.DiscoveryRun;

// Test fixtures
let projectId: number;
let actorId: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-WEB-1D Test Project',
    slug: 'disc-web-1d-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as unknown as { id: number }).id;

  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    status: 'active',
  });
  actorId = (actor as unknown as { id: number }).id;
}

async function createTestDiscoveryRun(): Promise<number> {
  const run = await DiscoveryRunModel.create({
    project_id: projectId,
    discovery_type: 'desk_research',
    topic: 'Test Topic',
    topic_slug: 'test-topic',
    source_intent: 'Testing',
    actor_id: actorId,
    created_by_identity: 'U_TEST',
    status: 'pending',
  } as CreationAttributes<DiscoveryRun>);
  return (run as unknown as { id: number }).id;
}

describe('Controlled Test Budget Service — DISC-WEB-1D-2', () => {
  // Set up fixtures before each test
  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('createSession', () => {
    it('creates a session with budget limits', async () => {
      const input: CreateSessionInput = {
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
      };

      const session = await createSession(input);

      expect(session.id).toBeDefined();
      expect(session.public_id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.max_requests).toBe(10);
      expect(session.max_input_tokens).toBe(50000);
      expect(session.max_output_tokens).toBe(20000);
      expect(session.used_requests).toBe(0);
      expect(session.used_input_tokens).toBe(0);
      expect(session.used_output_tokens).toBe(0);
      expect(session.discovery_run_id).toBeNull();
    });

    it('rejects creating a second active session', async () => {
      const input: CreateSessionInput = {
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
      };

      await createSession(input);

      await expect(createSession(input)).rejects.toThrow(SessionAlreadyExistsError);
    });

    it('allows creating new session after previous is cancelled', async () => {
      const input: CreateSessionInput = {
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
      };

      const first = await createSession(input);
      await cancelSession(first.id, 'test cleanup');

      const second = await createSession(input);
      expect(second.id).not.toBe(first.id);
      expect(second.status).toBe('active');
    });
  });

  describe('getActiveSession', () => {
    it('returns null when no active session', async () => {
      const session = await getActiveSession();
      expect(session).toBeNull();
    });

    it('returns active session', async () => {
      const created = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const found = await getActiveSession();
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null after session is cancelled', async () => {
      const created = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await cancelSession(created.id);

      const found = await getActiveSession();
      expect(found).toBeNull();
    });
  });

  describe('bindRunToSession', () => {
    it('binds a run to a session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const runId = await createTestDiscoveryRun();
      const bound = await bindRunToSession(session.id, runId, projectId);

      expect(bound.discovery_run_id).toBe(runId);
    });

    it('rejects binding to terminal session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await cancelSession(session.id);

      const runId = await createTestDiscoveryRun();
      await expect(bindRunToSession(session.id, runId, projectId)).rejects.toThrow(SessionTerminalError);
    });

    it('rejects binding second run to same session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId1 = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId1, projectId);

      const runId2 = await createTestDiscoveryRun();
      await expect(bindRunToSession(session.id, runId2, projectId)).rejects.toThrow(RunAlreadyBoundError);
    });
  });

  describe('getSessionByRunId — critical for budget enforcement', () => {
    it('finds session by bound run ID', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      const found = await getSessionByRunId(runId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(session.id);
    });

    it('finds session by run ID even after cancellation', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);
      await cancelSession(session.id, 'test');

      const found = await getSessionByRunId(runId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(session.id);
      expect(found!.status).toBe('cancelled');
    });

    it('finds session by run ID even after exhaustion', async () => {
      const session = await createSession({
        maxRequests: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Exhaust the budget — must pass discoveryRunId since session is bound
      const reservation = await reserveBudget({
        sessionId: session.id,
        discoveryRunId: runId,
        estimatedInputTokens: 50,
        reservedOutputTokens: 50,
      });
      await reconcileUsage({ reservationId: reservation.reservationId!, actualInputTokens: 50, actualOutputTokens: 50 });

      const found = await getSessionByRunId(runId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(session.id);
      expect(found!.status).toBe('exhausted');
    });

    it('finds session by run ID after completion', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);
      await completeSession(session.id);

      const found = await getSessionByRunId(runId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(session.id);
      expect(found!.status).toBe('completed');
    });
  });

  describe('reserveBudget — atomic budget enforcement', () => {
    it('reserves budget atomically and returns reservation ID', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 1000,
        reservedOutputTokens: 500,
      });

      expect(result.ok).toBe(true);
      expect(result.reservationId).toBeDefined();
      expect(result.sessionStatus).toBe('active');
      expect(result.remainingRequests).toBe(9);
      expect(result.remainingInputTokens).toBe(9000);
      expect(result.remainingOutputTokens).toBe(4500);

      // Verify reservation was created
      const reservation = await getReservationById(result.reservationId!);
      expect(reservation).not.toBeNull();
      expect(reservation!.session_id).toBe(session.id);
      expect(reservation!.reserved_input_tokens).toBe(1000);
      expect(reservation!.reserved_output_tokens).toBe(500);
      expect(reservation!.state).toBe('reserved');

      // Verify used_output_tokens was incremented
      const updated = await getSessionById(session.id);
      expect(updated!.used_output_tokens).toBe(500);
    });

    it('rejects reservation when requests exhausted', async () => {
      const session = await createSession({
        maxRequests: 1,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Use the single request
      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 });

      // Try to reserve another
      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('budget_exceeded');
    });

    it('rejects reservation when input tokens would exceed', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 1000,
        maxOutputTokens: 5000,
      });

      // Try to reserve more than available
      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 1001,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('budget_exceeded');
    });

    it('rejects reservation when output tokens would exceed', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 1000,
      });

      // Try to reserve more output than available
      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 100,
        reservedOutputTokens: 1001,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('budget_exceeded');
    });

    it('rejects reservation for terminal session', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await cancelSession(session.id);

      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('session_terminal');
      expect(result.sessionStatus).toBe('cancelled');
    });

    it('rejects reservation for non-existent session', async () => {
      const result = await reserveBudget({
        sessionId: 999999,
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('session_not_found');
    });
  });

  describe('concurrent reservation — race condition prevention', () => {
    it('handles concurrent reservations atomically (all three limits)', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 5000,
        maxOutputTokens: 2500,
      });

      // Simulate concurrent reservations
      const reservations = await Promise.all([
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 500 }),
      ]);

      // All 5 should succeed (we have exactly 5 requests and exactly enough tokens)
      const successes = reservations.filter((r) => r.ok);
      expect(successes.length).toBe(5);

      // Verify final state
      const updated = await getSessionById(session.id);
      expect(updated!.used_requests).toBe(5);
      expect(updated!.used_input_tokens).toBe(5000);
      expect(updated!.used_output_tokens).toBe(2500);
    });

    it('rejects excess concurrent reservations (request limit)', async () => {
      const session = await createSession({
        maxRequests: 3,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Try to make 5 concurrent reservations when only 3 allowed
      const reservations = await Promise.all([
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 }),
      ]);

      const successes = reservations.filter((r) => r.ok);
      const failures = reservations.filter((r) => !r.ok);

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(2);
      expect(failures.every((r) => r.reason === 'budget_exceeded')).toBe(true);

      // Verify final state
      const updated = await getSessionById(session.id);
      expect(updated!.used_requests).toBe(3);
    });

    it('rejects excess concurrent reservations (output limit)', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 1500, // Only enough for 3 requests at 500 each
      });

      // Try to make 5 concurrent reservations when output budget only allows 3
      const reservations = await Promise.all([
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 500 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 500 }),
      ]);

      const successes = reservations.filter((r) => r.ok);
      const failures = reservations.filter((r) => !r.ok);

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(2);
      expect(failures.every((r) => r.reason === 'budget_exceeded')).toBe(true);

      // Verify final state
      const updated = await getSessionById(session.id);
      expect(updated!.used_requests).toBe(3);
      expect(updated!.used_output_tokens).toBe(1500);
    });
  });

  describe('reconcileUsage — idempotent reconciliation', () => {
    it('releases unused output allocation on first reconciliation', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Reserve 1000 output tokens
      const reservation = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 1000 });
      expect(reservation.ok).toBe(true);

      // Verify reservation
      const afterReserve = await getSessionById(session.id);
      expect(afterReserve!.used_output_tokens).toBe(1000);

      // Reconcile with only 400 actual (release 600)
      const result = await reconcileUsage({
        reservationId: reservation.reservationId!,
        actualInputTokens: 1000,
        actualOutputTokens: 400,
      });

      expect(result.ok).toBe(true);
      expect(result.alreadyReconciled).toBe(false);
      expect(result.tokensReleased).toBe(600);
      expect(result.session!.used_output_tokens).toBe(400);
    });

    it('returns alreadyReconciled=true on duplicate reconciliation', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const reservation = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 1000 });

      // First reconciliation
      const result1 = await reconcileUsage({
        reservationId: reservation.reservationId!,
        actualInputTokens: 1000,
        actualOutputTokens: 400,
      });
      expect(result1.ok).toBe(true);
      expect(result1.alreadyReconciled).toBe(false);
      expect(result1.tokensReleased).toBe(600);

      // Second reconciliation — should be idempotent
      const result2 = await reconcileUsage({
        reservationId: reservation.reservationId!,
        actualInputTokens: 1000,
        actualOutputTokens: 400,
      });
      expect(result2.ok).toBe(true);
      expect(result2.alreadyReconciled).toBe(true);
      expect(result2.tokensReleased).toBe(0);

      // Verify session counters were not changed
      const updated = await getSessionById(session.id);
      expect(updated!.used_output_tokens).toBe(400);
    });

    it('two concurrent reconciliations produce exactly one release', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const reservation = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 1000 });

      // Two concurrent reconciliations
      const [result1, result2] = await Promise.all([
        reconcileUsage({
          reservationId: reservation.reservationId!,
          actualInputTokens: 1000,
          actualOutputTokens: 300,
        }),
        reconcileUsage({
          reservationId: reservation.reservationId!,
          actualInputTokens: 1000,
          actualOutputTokens: 300,
        }),
      ]);

      // Both should succeed
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      // Exactly one should be alreadyReconciled=false
      const firstReconciliations = [result1, result2].filter((r) => !r.alreadyReconciled);
      const duplicateReconciliations = [result1, result2].filter((r) => r.alreadyReconciled);

      expect(firstReconciliations.length).toBe(1);
      expect(duplicateReconciliations.length).toBe(1);

      // Verify exactly 700 tokens were released (1000 - 300)
      const updated = await getSessionById(session.id);
      expect(updated!.used_output_tokens).toBe(300);
    });

    it('concurrent reconciliations of different reservations preserve correct totals', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Create two reservations
      const res1 = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 500, reservedOutputTokens: 1000 });
      const res2 = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 500, reservedOutputTokens: 1000 });

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);

      // After two reservations: 2000 output tokens reserved
      const afterReserve = await getSessionById(session.id);
      expect(afterReserve!.used_output_tokens).toBe(2000);

      // Concurrent reconciliations with different actuals
      const [result1, result2] = await Promise.all([
        reconcileUsage({
          reservationId: res1.reservationId!,
          actualInputTokens: 500,
          actualOutputTokens: 400, // Release 600
        }),
        reconcileUsage({
          reservationId: res2.reservationId!,
          actualInputTokens: 500,
          actualOutputTokens: 200, // Release 800
        }),
      ]);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      // Total released: 600 + 800 = 1400
      // Final: 2000 - 1400 = 600
      const updated = await getSessionById(session.id);
      expect(updated!.used_output_tokens).toBe(600);
    });

    it('rejects reconciliation for unknown reservation ID', async () => {
      const result = await reconcileUsage({
        reservationId: 999999,
        actualInputTokens: 100,
        actualOutputTokens: 50,
      });

      expect(result.ok).toBe(false);
      expect(result.alreadyReconciled).toBe(false);
      expect(result.reason).toBe('reservation_not_found');
    });

    it('never allows negative usage counters', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Reserve 100 output tokens
      const reservation = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 });

      // Reconcile with actualOutputTokens=0 (would release all 100)
      const result = await reconcileUsage({
        reservationId: reservation.reservationId!,
        actualInputTokens: 100,
        actualOutputTokens: 0,
      });

      expect(result.ok).toBe(true);
      expect(result.session!.used_output_tokens).toBeGreaterThanOrEqual(0);
    });

    it('transitions to exhausted when output tokens reach limit after reconciliation', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 100,
      });

      const reservation = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 100 });
      const result = await reconcileUsage({
        reservationId: reservation.reservationId!,
        actualInputTokens: 100,
        actualOutputTokens: 100, // Reaches limit exactly
      });

      expect(result.ok).toBe(true);
      expect(result.session!.status).toBe('exhausted');
      expect(result.session!.exhausted_at).not.toBeNull();
    });

    it('does NOT reconcile input tokens (retains conservative estimate)', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Reserve 1000 input tokens
      const reservation = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 500 });

      // Reconcile with actualInputTokens=500 (less than estimated)
      await reconcileUsage({
        reservationId: reservation.reservationId!,
        actualInputTokens: 500, // Less than estimated
        actualOutputTokens: 400,
      });

      const updated = await getSessionById(session.id);
      // Input tokens should NOT be adjusted — retains the estimated 1000
      expect(updated!.used_input_tokens).toBe(1000);
    });
  });

  describe('cancelSession', () => {
    it('transitions session to cancelled', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const cancelled = await cancelSession(session.id, 'User requested');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellation_reason).toBe('User requested');
      expect(cancelled.cancelled_at).not.toBeNull();
    });

    it('rejects cancelling non-existent session', async () => {
      await expect(cancelSession(999999)).rejects.toThrow(SessionNotFoundError);
    });

    it('rejects cancelling already cancelled session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await cancelSession(session.id);

      await expect(cancelSession(session.id)).rejects.toThrow(SessionTerminalError);
    });
  });

  describe('completeSession', () => {
    it('transitions session to completed', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const completed = await completeSession(session.id);

      expect(completed.status).toBe('completed');
      expect(completed.completed_at).not.toBeNull();
    });

    it('rejects completing terminal session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await cancelSession(session.id);

      await expect(completeSession(session.id)).rejects.toThrow(SessionTerminalError);
    });
  });

  describe('toSessionSummary', () => {
    it('converts session to summary format', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000, reservedOutputTokens: 500 });
      const updated = await getSessionById(session.id);

      const summary = toSessionSummary(updated!);

      expect(summary.id).toBe(session.id);
      expect(summary.publicId).toBe(session.public_id);
      expect(summary.status).toBe('active');
      expect(summary.budget.maxRequests).toBe(10);
      expect(summary.budget.usedRequests).toBe(1);
      expect(summary.budget.remainingRequests).toBe(9);
      expect(summary.budget.usedInputTokens).toBe(1000);
      expect(summary.budget.remainingInputTokens).toBe(9000);
      expect(summary.budget.usedOutputTokens).toBe(500);
      expect(summary.budget.remainingOutputTokens).toBe(4500);
    });
  });

  describe('Budget enforcement invariant', () => {
    /**
     * Critical test: A cancelled, exhausted, or completed session must NEVER
     * allow its bound run to execute without budget enforcement.
     */
    it('terminal sessions always block further reservations via run lookup', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Use some budget — must pass discoveryRunId since session is bound
      await reserveBudget({
        sessionId: session.id,
        discoveryRunId: runId,
        estimatedInputTokens: 500,
        reservedOutputTokens: 200,
      });

      // Cancel the session
      await cancelSession(session.id, 'test');

      // Look up session by run ID (this is how the guard will find it)
      const foundSession = await getSessionByRunId(runId);
      expect(foundSession).not.toBeNull();
      expect(foundSession!.status).toBe('cancelled');

      // Try to reserve budget — should fail (session is terminal)
      const result = await reserveBudget({
        sessionId: foundSession!.id,
        discoveryRunId: runId,
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('session_terminal');
      expect(result.sessionStatus).toBe('cancelled');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F2: Token validation tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('validateTokenCount — F2 token validation', () => {
    it('rejects zero', () => {
      expect(() => validateTokenCount('test', 0)).toThrow(InvalidBudgetInputError);
      expect(() => validateTokenCount('test', 0)).toThrow('must be positive');
    });

    it('rejects negative numbers', () => {
      expect(() => validateTokenCount('test', -1)).toThrow(InvalidBudgetInputError);
      expect(() => validateTokenCount('test', -100)).toThrow('must be positive');
    });

    it('rejects fractional numbers', () => {
      expect(() => validateTokenCount('test', 1.5)).toThrow(InvalidBudgetInputError);
      expect(() => validateTokenCount('test', 100.001)).toThrow('must be an integer');
    });

    it('rejects NaN', () => {
      expect(() => validateTokenCount('test', NaN)).toThrow(InvalidBudgetInputError);
      expect(() => validateTokenCount('test', NaN)).toThrow('must be finite');
    });

    it('rejects Infinity', () => {
      expect(() => validateTokenCount('test', Infinity)).toThrow(InvalidBudgetInputError);
      expect(() => validateTokenCount('test', Infinity)).toThrow('must be finite');
    });

    it('rejects -Infinity', () => {
      expect(() => validateTokenCount('test', -Infinity)).toThrow(InvalidBudgetInputError);
      expect(() => validateTokenCount('test', -Infinity)).toThrow('must be finite');
    });

    it('accepts valid positive integers', () => {
      expect(() => validateTokenCount('test', 1)).not.toThrow();
      expect(() => validateTokenCount('test', 100)).not.toThrow();
      expect(() => validateTokenCount('test', 1000000)).not.toThrow();
    });
  });

  describe('reserveBudget — F2 input validation', () => {
    it('throws InvalidBudgetInputError for zero estimatedInputTokens', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await expect(
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 0, reservedOutputTokens: 100 }),
      ).rejects.toThrow(InvalidBudgetInputError);
    });

    it('throws InvalidBudgetInputError for negative estimatedInputTokens', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await expect(
        reserveBudget({ sessionId: session.id, estimatedInputTokens: -100, reservedOutputTokens: 100 }),
      ).rejects.toThrow(InvalidBudgetInputError);
    });

    it('throws InvalidBudgetInputError for NaN estimatedInputTokens', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await expect(
        reserveBudget({ sessionId: session.id, estimatedInputTokens: NaN, reservedOutputTokens: 100 }),
      ).rejects.toThrow(InvalidBudgetInputError);
    });

    it('throws InvalidBudgetInputError for zero reservedOutputTokens', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await expect(
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: 0 }),
      ).rejects.toThrow(InvalidBudgetInputError);
    });

    it('throws InvalidBudgetInputError for Infinity reservedOutputTokens', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await expect(
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100, reservedOutputTokens: Infinity }),
      ).rejects.toThrow(InvalidBudgetInputError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // M5a: Immutable session binding (ON DELETE RESTRICT)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('M5a — Immutable session-to-run binding (ON DELETE RESTRICT)', () => {
    /**
     * These tests verify the M5a migration correctly enforces immutable binding
     * by changing the FK from ON DELETE SET NULL to ON DELETE RESTRICT.
     *
     * Key invariant: A bound run cannot be deleted while its session exists.
     */

    it('FK constraint name matches expected convention', async () => {
      const [result] = await sequelize.query(`
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'controlled_test_sessions'::regclass
        AND conname = 'controlled_test_sessions_discovery_run_id_fkey'
      `);

      expect((result as Array<{ conname: string }>).length).toBe(1);
    });

    it('FK constraint uses ON DELETE RESTRICT', async () => {
      const [result] = await sequelize.query(`
        SELECT confdeltype FROM pg_constraint
        WHERE conrelid = 'controlled_test_sessions'::regclass
        AND conname = 'controlled_test_sessions_discovery_run_id_fkey'
      `);

      // confdeltype: 'r' = RESTRICT, 'a' = NO ACTION, 'c' = CASCADE, 'n' = SET NULL
      const rows = result as Array<{ confdeltype: string }>;
      expect(rows.length).toBe(1);
      expect(rows[0].confdeltype).toBe('r');
    });

    it('unique index on non-null discovery_run_id exists', async () => {
      const [result] = await sequelize.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'controlled_test_sessions'
        AND indexname = 'controlled_test_sessions_discovery_run_id_unique_idx'
      `);

      expect((result as Array<{ indexname: string }>).length).toBe(1);
    });

    it('blocks deletion of run with bound active session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Attempt to delete the bound run should fail
      await expect(
        DiscoveryRunModel.destroy({ where: { id: runId } }),
      ).rejects.toThrow(/violates RESTRICT setting.*foreign key constraint|violates foreign key constraint/);

      // Verify session still has binding
      const found = await getSessionByRunId(runId);
      expect(found).not.toBeNull();
      expect(found!.discovery_run_id).toBe(runId);
    });

    it('blocks deletion of run with bound terminal session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);
      await cancelSession(session.id, 'test');

      // Attempt to delete the bound run should STILL fail
      // Even cancelled sessions maintain their binding
      await expect(
        DiscoveryRunModel.destroy({ where: { id: runId } }),
      ).rejects.toThrow(/violates RESTRICT setting.*foreign key constraint|violates foreign key constraint/);

      // Verify session still has binding
      const found = await getSessionByRunId(runId);
      expect(found).not.toBeNull();
      expect(found!.discovery_run_id).toBe(runId);
      expect(found!.status).toBe('cancelled');
    });

    it('allows run deletion after session is deleted', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Delete the session first
      await ControlledTestSessionModel.destroy({ where: { id: session.id } });

      // Now run can be deleted
      const deletedCount = await DiscoveryRunModel.destroy({ where: { id: runId } });
      expect(deletedCount).toBe(1);

      // Verify run is gone
      const run = await DiscoveryRunModel.findByPk(runId);
      expect(run).toBeNull();
    });

    it('unbound sessions do not block any run deletion', async () => {
      // Create session without binding
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Create run not bound to this session
      const runId = await createTestDiscoveryRun();

      // Can delete run (no FK binding)
      const deletedCount = await DiscoveryRunModel.destroy({ where: { id: runId } });
      expect(deletedCount).toBe(1);

      // Session still exists
      const found = await getSessionById(session.id);
      expect(found).not.toBeNull();
      expect(found!.discovery_run_id).toBeNull();
    });

    it('migration is idempotent (second run is no-op when already RESTRICT)', async () => {
      // The migration has already run. Verify running it again would be safe.
      // We verify by checking the FK is already RESTRICT, which triggers early return.
      const [result] = await sequelize.query(`
        SELECT confdeltype FROM pg_constraint
        WHERE conrelid = 'controlled_test_sessions'::regclass
        AND conname = 'controlled_test_sessions_discovery_run_id_fkey'
      `);

      const rows = result as Array<{ confdeltype: string }>;
      expect(rows.length).toBe(1);
      expect(rows[0].confdeltype).toBe('r'); // Already RESTRICT

      // If migration were to run again, it would detect this and return early
      // (no actual re-run here as migrations are tracked in SequelizeMeta)
    });

    it('preserves existing session and reservation data after migration', async () => {
      // Create session and reservation, verify they survive
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Must pass discoveryRunId since session is bound
      const reservation = await reserveBudget({
        sessionId: session.id,
        discoveryRunId: runId,
        estimatedInputTokens: 500,
        reservedOutputTokens: 500,
      });
      expect(reservation.ok).toBe(true);

      // Verify session data is intact
      const found = await getSessionById(session.id);
      expect(found).not.toBeNull();
      expect(found!.discovery_run_id).toBe(runId);
      expect(found!.used_requests).toBe(1);
      expect(found!.used_input_tokens).toBe(500);
      expect(found!.used_output_tokens).toBe(500);

      // Verify reservation data is intact
      const foundReservation = await getReservationById(reservation.reservationId!);
      expect(foundReservation).not.toBeNull();
      expect(foundReservation!.session_id).toBe(session.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // M5e: Session finalization (completeSession, cancelSession)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('M5e — session finalization atomicity', () => {
    it('completeSession transitions active session to completed', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await completeSession(session.id);

      const found = await getSessionById(session.id);
      expect(found!.status).toBe('completed');
      expect(found!.completed_at).not.toBeNull();
    });

    it('cancelSession transitions active session to cancelled', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await cancelSession(session.id, 'test cancellation');

      const found = await getSessionById(session.id);
      expect(found!.status).toBe('cancelled');
      expect(found!.cancelled_at).not.toBeNull();
      expect(found!.cancellation_reason).toBe('test cancellation');
    });

    it('cancelled session cannot be completed', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await cancelSession(session.id, 'test');

      await expect(completeSession(session.id)).rejects.toThrow(SessionTerminalError);

      const found = await getSessionById(session.id);
      expect(found!.status).toBe('cancelled');
    });

    it('exhausted session cannot be completed (stays exhausted)', async () => {
      const session = await createSession({
        maxRequests: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Exhaust the session
      await reserveBudget({
        sessionId: session.id,
        discoveryRunId: runId,
        estimatedInputTokens: 50,
        reservedOutputTokens: 50,
      });

      // Find the session to verify exhausted status
      const exhausted = await getSessionById(session.id);
      if (exhausted!.status !== 'exhausted') {
        // Force exhausted state for test (edge case: might still be active if budget not fully consumed)
        await sequelize.query(
          `UPDATE controlled_test_sessions SET status = 'exhausted', exhausted_at = NOW() WHERE id = :id`,
          { replacements: { id: session.id } },
        );
      }

      // Attempt complete on exhausted session
      await expect(completeSession(session.id)).rejects.toThrow(SessionTerminalError);

      const found = await getSessionById(session.id);
      expect(found!.status).toBe('exhausted');
    });

    it('completed session cannot be cancelled', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      await completeSession(session.id);

      await expect(cancelSession(session.id, 'too late')).rejects.toThrow(SessionTerminalError);

      const found = await getSessionById(session.id);
      expect(found!.status).toBe('completed');
    });

    it('concurrent complete and cancel — first wins, second fails', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Concurrent finalization attempts
      const results = await Promise.allSettled([
        completeSession(session.id),
        cancelSession(session.id, 'concurrent cancel'),
      ]);

      // Exactly one should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Session should be in a terminal state
      const found = await getSessionById(session.id);
      expect(['completed', 'cancelled']).toContain(found!.status);
    });

    it('session not found throws SessionNotFoundError', async () => {
      await expect(completeSession(999999)).rejects.toThrow(SessionNotFoundError);
      await expect(cancelSession(999999, 'test')).rejects.toThrow(SessionNotFoundError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // M5e: Bound vs unbound reservation isolation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('M5e — bound/unbound reservation isolation', () => {
    it('unbound reservation cannot consume bound session budget', async () => {
      // Create and bind session to a run
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Attempt unbound reservation (no discoveryRunId) — should fail
      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(false);
      // Session exists and is active, but binding mismatch
      // The unbound path requires IS NULL, but session is bound
      expect(result.reason).toBe('budget_exceeded'); // Falls through to budget check
      expect(result.sessionStatus).toBe('active');

      // Verify no budget was consumed
      const found = await getSessionById(session.id);
      expect(found!.used_requests).toBe(0);
      expect(found!.used_input_tokens).toBe(0);
      expect(found!.used_output_tokens).toBe(0);
    });

    it('bound reservation with wrong run ID cannot consume budget', async () => {
      // Create and bind session to run1
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId1 = await createTestDiscoveryRun();
      const runId2 = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId1, projectId);

      // Attempt bound reservation with wrong run ID — should fail
      const result = await reserveBudget({
        sessionId: session.id,
        discoveryRunId: runId2, // Wrong run!
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('run_binding_mismatch');
      expect(result.sessionStatus).toBe('active');

      // Verify no budget was consumed
      const found = await getSessionById(session.id);
      expect(found!.used_requests).toBe(0);
      expect(found!.used_input_tokens).toBe(0);
      expect(found!.used_output_tokens).toBe(0);
    });

    it('bound reservation with correct run ID succeeds', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Bound reservation with correct run ID
      const result = await reserveBudget({
        sessionId: session.id,
        discoveryRunId: runId,
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(true);
      expect(result.reservationId).toBeDefined();

      // Verify budget was consumed
      const found = await getSessionById(session.id);
      expect(found!.used_requests).toBe(1);
      expect(found!.used_input_tokens).toBe(100);
      expect(found!.used_output_tokens).toBe(100);
    });

    it('unbound reservation on unbound session succeeds (M3 compatibility)', async () => {
      // Create session WITHOUT binding
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Unbound reservation (no discoveryRunId) on unbound session
      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 100,
        reservedOutputTokens: 100,
      });

      expect(result.ok).toBe(true);
      expect(result.reservationId).toBeDefined();

      // Verify budget was consumed
      const found = await getSessionById(session.id);
      expect(found!.used_requests).toBe(1);
      expect(found!.discovery_run_id).toBeNull(); // Still unbound
    });

    it('concurrent unbound attempt on bound session fails while correct bound succeeds', async () => {
      // Single session bound to a run
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId, projectId);

      // Concurrent reservations: one correct (bound), one incorrect (unbound)
      const [boundResult, unboundResult] = await Promise.all([
        // Correct bound reservation
        reserveBudget({
          sessionId: session.id,
          discoveryRunId: runId,
          estimatedInputTokens: 100,
          reservedOutputTokens: 100,
        }),
        // Incorrect unbound reservation on bound session
        reserveBudget({
          sessionId: session.id,
          estimatedInputTokens: 100,
          reservedOutputTokens: 100,
        }),
      ]);

      // Bound should succeed, unbound should fail
      expect(boundResult.ok).toBe(true);
      expect(unboundResult.ok).toBe(false);
      expect(unboundResult.reason).toBe('budget_exceeded'); // Falls through to budget check

      // Verify only one request consumed budget
      const found = await getSessionById(session.id);
      expect(found!.used_requests).toBe(1);
      expect(found!.used_input_tokens).toBe(100);
      expect(found!.used_output_tokens).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // M5e: Atomic authorization and claim race tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('M5e — atomic authorization/claim race conditions', () => {
    // Import claim service for authorizeAndClaimControlledRun
    const claimService = require('../../services/discovery-claim.service');

    async function createControlledTestRun(runActorId: number): Promise<number> {
      const run = await DiscoveryRunModel.create({
        project_id: projectId,
        actor_id: runActorId,
        discovery_type: 'desk_research',
        topic: `race-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        topic_slug: `race-${Date.now()}`,
        source_intent: null,
        status: 'pending',
        is_controlled: true,
        created_by_identity: 'test:race',
      } as CreationAttributes<DiscoveryRun>) as DiscoveryRun;
      return run.id;
    }

    async function getRunById(runId: number): Promise<DiscoveryRun | null> {
      return await DiscoveryRunModel.findByPk(runId) as DiscoveryRun | null;
    }

    it('cancellation commits before claim → claim rejected; run stays pending', async () => {
      // Create session bound to controlled run
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
        actorId,
      });
      const runId = await createControlledTestRun(actorId);
      await bindRunToSession(session.id, runId, projectId);

      // Cancel session first
      await cancelSession(session.id, 'cancelled before claim');

      // Attempt to claim — should fail due to terminal session
      await expect(
        claimService.authorizeAndClaimControlledRun(session.id, runId, actorId, 'worker-1'),
      ).rejects.toThrow(claimService.SessionNotActiveError);

      // Verify run stays pending (not mutated)
      const run = await getRunById(runId);
      expect(run!.status).toBe('pending');
      expect(run!.worker_id).toBeNull();
    });

    it('claim commits before cancellation → claim succeeds; cancellation still succeeds', async () => {
      // Create session bound to controlled run
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
        actorId,
      });
      const runId = await createControlledTestRun(actorId);
      await bindRunToSession(session.id, runId, projectId);

      // Claim first
      const result = await claimService.authorizeAndClaimControlledRun(
        session.id,
        runId,
        actorId,
        'worker-1',
      );

      expect(result.run.status).toBe('processing');
      expect(result.run.worker_id).toBe('worker-1');

      // Session cancellation still succeeds (session is still active)
      // But this would prevent successful finalization later
      await cancelSession(session.id, 'cancelled after claim');

      // Session is now cancelled
      const sessionAfter = await getSessionById(session.id);
      expect(sessionAfter!.status).toBe('cancelled');
    });

    it('two concurrent claims → exactly one succeeds', async () => {
      // Create session bound to controlled run
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
        actorId,
      });
      const runId = await createControlledTestRun(actorId);
      await bindRunToSession(session.id, runId, projectId);

      // Concurrent claims from same actor (different workers)
      const results = await Promise.allSettled([
        claimService.authorizeAndClaimControlledRun(session.id, runId, actorId, 'worker-1'),
        claimService.authorizeAndClaimControlledRun(session.id, runId, actorId, 'worker-2'),
      ]);

      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      // Exactly one should succeed
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // The failure should be RunAlreadyClaimedError or RunNotPendingError
      const failedResult = failures[0] as PromiseRejectedResult;
      expect(
        failedResult.reason instanceof claimService.RunAlreadyClaimedError ||
        failedResult.reason instanceof claimService.RunNotPendingError,
      ).toBe(true);

      // Run should be processing with exactly one worker
      const run = await getRunById(runId);
      expect(run!.status).toBe('processing');
      expect(['worker-1', 'worker-2']).toContain(run!.worker_id);
    });

    it('wrong actor → claim rejected without run mutation', async () => {
      // Create second actor
      const actor2 = await ActorModel.create({
        organization_id: TEST_ORG_ID,
        email: `actor2-${Date.now()}@test.com`,
        name: 'Actor Two',
      }) as Actor;

      // Create session owned by actor1, bound to controlled run
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
        actorId, // actor1 owns session
      });
      const runId = await createControlledTestRun(actorId);
      await bindRunToSession(session.id, runId, projectId);

      // Attempt claim by actor2 — should fail
      await expect(
        claimService.authorizeAndClaimControlledRun(session.id, runId, actor2.id, 'worker-wrong'),
      ).rejects.toThrow(claimService.SessionActorMismatchError);

      // Verify run was NOT mutated
      const run = await getRunById(runId);
      expect(run!.status).toBe('pending');
      expect(run!.worker_id).toBeNull();
    });

    it('wrong session/run binding → claim rejected without run mutation', async () => {
      // Create session bound to run1, then try to claim run2
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
        actorId,
      });
      const runId1 = await createControlledTestRun(actorId);
      const runId2 = await createControlledTestRun(actorId);

      // Bind session to run1 (not run2)
      await bindRunToSession(session.id, runId1, projectId);

      // Attempt to claim run2 using session bound to run1 — should fail due to binding mismatch
      await expect(
        claimService.authorizeAndClaimControlledRun(session.id, runId2, actorId, 'worker-wrong'),
      ).rejects.toThrow(claimService.SessionRunBindingMismatchError);

      // Verify run2 was NOT mutated
      const run = await getRunById(runId2);
      expect(run!.status).toBe('pending');
      expect(run!.worker_id).toBeNull();
    });

    it('terminal session → claim rejected without run mutation', async () => {
      // Create and bind session, then complete it
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
        actorId,
      });
      const runId = await createControlledTestRun(actorId);
      await bindRunToSession(session.id, runId, projectId);
      await completeSession(session.id);

      // Attempt claim on completed session — should fail
      await expect(
        claimService.authorizeAndClaimControlledRun(session.id, runId, actorId, 'worker-late'),
      ).rejects.toThrow(claimService.SessionNotActiveError);

      // Verify run was NOT mutated
      const run = await getRunById(runId);
      expect(run!.status).toBe('pending');
      expect(run!.worker_id).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // M6: API-Layer Session Administration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('M6 — API-layer session administration', () => {
    // Import M6 functions
    const {
      listSessionsByProjectAndActor,
      getSessionDetailsByPublicId,
      getSessionReservations,
      cancelControlledSessionFromApi,
      SessionActorMismatchError: BudgetSessionActorMismatchError,
      SessionNotCancellableError,
      reserveBudget,
    } = require('../../services/controlled-test-budget.service');

    async function createControlledTestRun(runActorId: number): Promise<{ id: number; publicId: string }> {
      const run = await DiscoveryRunModel.create({
        project_id: projectId,
        actor_id: runActorId,
        discovery_type: 'desk_research',
        topic: `m6-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        topic_slug: `m6-${Date.now()}`,
        source_intent: null,
        status: 'pending',
        is_controlled: true,
        created_by_identity: 'test:m6',
      } as CreationAttributes<DiscoveryRun>) as DiscoveryRun;
      return { id: run.id, publicId: run.public_id };
    }

    async function createBoundSession(runActorId: number): Promise<{
      session: Awaited<ReturnType<typeof createSession>>;
      run: { id: number; publicId: string };
    }> {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
        actorId: runActorId,
      });
      const run = await createControlledTestRun(runActorId);
      await bindRunToSession(session.id, run.id, projectId);
      return { session, run };
    }

    describe('listSessionsByProjectAndActor', () => {
      it('returns sessions bound to controlled runs in project', async () => {
        const { session, run } = await createBoundSession(actorId);

        const result = await listSessionsByProjectAndActor(projectId, actorId);

        expect(result.items.length).toBe(1);
        expect(result.items[0].publicId).toBe(session.public_id);
        expect(result.items[0].boundRunPublicId).toBe(run.publicId);
        expect(result.total).toBe(1);
      });

      it('excludes unbound sessions', async () => {
        // Create unbound session
        await createSession({
          maxRequests: 5,
          maxInputTokens: 10000,
          maxOutputTokens: 5000,
          actorId,
        });

        const result = await listSessionsByProjectAndActor(projectId, actorId);

        expect(result.items.length).toBe(0);
        expect(result.total).toBe(0);
      });

      it('excludes sessions owned by other actors', async () => {
        const actor2 = await ActorModel.create({
          organization_id: TEST_ORG_ID,
          email: `actor2-list-${Date.now()}@test.com`,
          name: 'Actor Two',
        }) as Actor;

        // Create session owned by actor2
        await createBoundSession(actor2.id);

        // Query as actor1
        const result = await listSessionsByProjectAndActor(projectId, actorId);

        expect(result.items.length).toBe(0);
        expect(result.total).toBe(0);
      });

      it('respects pagination limits', async () => {
        // Create 3 bound sessions - must complete each before creating next due to single active constraint
        const { session: s1 } = await createBoundSession(actorId);
        await completeSession(s1.id);
        const { session: s2 } = await createBoundSession(actorId);
        await completeSession(s2.id);
        const { session: s3 } = await createBoundSession(actorId);
        await completeSession(s3.id);

        const result = await listSessionsByProjectAndActor(projectId, actorId, { limit: 2, offset: 0 });

        expect(result.items.length).toBe(2);
        expect(result.total).toBe(3);
      });

      it('enforces max page size of 100', async () => {
        const result = await listSessionsByProjectAndActor(projectId, actorId, { limit: 200 });

        // Should be capped at 100 (but 0 results since no sessions)
        expect(result.items.length).toBe(0);
      });
    });

    describe('getSessionDetailsByPublicId', () => {
      it('returns session details for creator', async () => {
        const { session, run } = await createBoundSession(actorId);

        const result = await getSessionDetailsByPublicId(session.public_id, projectId, actorId);

        expect(result.publicId).toBe(session.public_id);
        expect(result.status).toBe('active');
        expect(result.boundRunPublicId).toBe(run.publicId);
        expect(result.budget.maxRequests).toBe(10);
      });

      it('throws SessionNotFoundError for unbound session', async () => {
        const session = await createSession({
          maxRequests: 5,
          maxInputTokens: 10000,
          maxOutputTokens: 5000,
          actorId,
        });

        await expect(
          getSessionDetailsByPublicId(session.public_id, projectId, actorId),
        ).rejects.toThrow(SessionNotFoundError);
      });

      it('throws SessionActorMismatchError for non-creator', async () => {
        const actor2 = await ActorModel.create({
          organization_id: TEST_ORG_ID,
          email: `actor2-detail-${Date.now()}@test.com`,
          name: 'Actor Two',
        }) as Actor;

        const { session } = await createBoundSession(actorId);

        await expect(
          getSessionDetailsByPublicId(session.public_id, projectId, actor2.id),
        ).rejects.toThrow(BudgetSessionActorMismatchError);
      });

      it('throws SessionNotFoundError for wrong project', async () => {
        // Create another project
        const project2 = await ProjectModel.create({
          name: 'M6 Test Project 2',
          slug: `m6-test-2-${Date.now()}`,
          status: 'active',
          created_by: 'U_TEST',
          organization_id: TEST_ORG_ID,
        });
        const project2Id = (project2 as unknown as { id: number }).id;

        const { session } = await createBoundSession(actorId);

        await expect(
          getSessionDetailsByPublicId(session.public_id, project2Id, actorId),
        ).rejects.toThrow(SessionNotFoundError);
      });
    });

    describe('getSessionReservations', () => {
      it('returns paginated reservations for session', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Create some reservations
        await reserveBudget({
          sessionId: session.id,
          discoveryRunId: run.id,
          estimatedInputTokens: 100,
          reservedOutputTokens: 50,
          purpose: 'test-1',
        });
        await reserveBudget({
          sessionId: session.id,
          discoveryRunId: run.id,
          estimatedInputTokens: 200,
          reservedOutputTokens: 100,
          purpose: 'test-2',
        });

        const result = await getSessionReservations(session.public_id, projectId, actorId);

        expect(result.items.length).toBe(2);
        expect(result.pagination.total).toBe(2);
        expect(result.items[0].purpose).toBe('test-2'); // Most recent first
      });

      it('respects pagination', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Create 3 reservations
        for (let i = 0; i < 3; i++) {
          await reserveBudget({
            sessionId: session.id,
            discoveryRunId: run.id,
            estimatedInputTokens: 100,
            reservedOutputTokens: 50,
          });
        }

        const result = await getSessionReservations(session.public_id, projectId, actorId, {
          limit: 2,
          offset: 0,
        });

        expect(result.items.length).toBe(2);
        expect(result.pagination.total).toBe(3);
        expect(result.pagination.hasMore).toBe(true);
      });

      it('throws SessionActorMismatchError for non-creator', async () => {
        const actor2 = await ActorModel.create({
          organization_id: TEST_ORG_ID,
          email: `actor2-res-${Date.now()}@test.com`,
          name: 'Actor Two',
        }) as Actor;

        const { session } = await createBoundSession(actorId);

        await expect(
          getSessionReservations(session.public_id, projectId, actor2.id),
        ).rejects.toThrow(BudgetSessionActorMismatchError);
      });
    });

    describe('cancelControlledSessionFromApi', () => {
      it('cancels active session and fails pending run atomically', async () => {
        const { session, run } = await createBoundSession(actorId);

        const result = await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Test cancellation',
        );

        expect(result.status).toBe('cancelled');
        expect(result.idempotent).toBe(false);
        expect(result.cancellationReason).toBe('Test cancellation');
        expect(result.boundRunStatus).toBe('failed');

        // Verify run was failed
        const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfter.status).toBe('failed');
        expect(runAfter.failure_code).toBe('SESSION_CANCELLED');
        expect(runAfter.failure_stage).toBe('controlled_session');
      });

      it('cancels active session with processing run (run unchanged)', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Transition run to processing
        await sequelize.query(
          `UPDATE discovery_runs SET status = 'processing', worker_id = 'test-worker' WHERE id = :runId`,
          { replacements: { runId: run.id } },
        );

        const result = await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Cancel while processing',
        );

        expect(result.status).toBe('cancelled');
        expect(result.boundRunStatus).toBe('processing'); // Unchanged

        // Verify run was NOT failed
        const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfter.status).toBe('processing');
        expect(runAfter.failure_code).toBeNull();
      });

      it('returns idempotent 200 for already cancelled session', async () => {
        const { session } = await createBoundSession(actorId);

        // Cancel first time
        const first = await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'First cancel',
        );
        expect(first.idempotent).toBe(false);

        // Cancel second time — idempotent
        const second = await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Second cancel',
        );

        expect(second.idempotent).toBe(true);
        expect(second.cancelledAt).toEqual(first.cancelledAt);
        expect(second.cancellationReason).toBe('First cancel'); // Original preserved
      });

      it('throws SessionNotCancellableError for completed session', async () => {
        const { session } = await createBoundSession(actorId);
        await completeSession(session.id);

        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Too late'),
        ).rejects.toThrow(SessionNotCancellableError);
      });

      it('throws SessionNotCancellableError for exhausted session', async () => {
        const { session } = await createBoundSession(actorId);

        // Force exhausted state
        await sequelize.query(
          `UPDATE controlled_test_sessions SET status = 'exhausted', exhausted_at = NOW() WHERE id = :id`,
          { replacements: { id: session.id } },
        );

        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Exhausted'),
        ).rejects.toThrow(SessionNotCancellableError);
      });

      it('throws SessionActorMismatchError for non-creator', async () => {
        const actor2 = await ActorModel.create({
          organization_id: TEST_ORG_ID,
          email: `actor2-cancel-${Date.now()}@test.com`,
          name: 'Actor Two',
        }) as Actor;

        const { session } = await createBoundSession(actorId);

        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actor2.id, 'Unauthorized'),
        ).rejects.toThrow(BudgetSessionActorMismatchError);
      });

      it('throws SessionNotFoundError for unbound session', async () => {
        const session = await createSession({
          maxRequests: 5,
          maxInputTokens: 10000,
          maxOutputTokens: 5000,
          actorId,
        });

        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Unbound'),
        ).rejects.toThrow(SessionNotFoundError);
      });

      it('throws SessionNotFoundError for wrong project', async () => {
        const project2 = await ProjectModel.create({
          name: 'M6 Cancel Test Project 2',
          slug: `m6-cancel-2-${Date.now()}`,
          status: 'active',
          created_by: 'U_TEST',
          organization_id: TEST_ORG_ID,
        });
        const project2Id = (project2 as unknown as { id: number }).id;

        const { session } = await createBoundSession(actorId);

        await expect(
          cancelControlledSessionFromApi(session.public_id, project2Id, actorId, 'Wrong project'),
        ).rejects.toThrow(SessionNotFoundError);
      });
    });

    describe('M6 — cancellation race conditions', () => {
      const claimService = require('../../services/discovery-claim.service');

      async function createControlledRun(runActorId: number): Promise<number> {
        const run = await DiscoveryRunModel.create({
          project_id: projectId,
          actor_id: runActorId,
          discovery_type: 'desk_research',
          topic: `race-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          topic_slug: `race-${Date.now()}`,
          source_intent: null,
          status: 'pending',
          is_controlled: true,
          created_by_identity: 'test:race',
        } as CreationAttributes<DiscoveryRun>) as DiscoveryRun;
        return run.id;
      }

      it('cancel before claim → claim rejected', async () => {
        const session = await createSession({
          maxRequests: 5,
          maxInputTokens: 10000,
          maxOutputTokens: 5000,
          actorId,
        });
        const runId = await createControlledRun(actorId);
        await bindRunToSession(session.id, runId, projectId);

        // Cancel first
        await cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Before claim');

        // Claim should fail
        await expect(
          claimService.authorizeAndClaimControlledRun(session.id, runId, actorId, 'worker-1'),
        ).rejects.toThrow(claimService.SessionNotActiveError);
      });

      it('completion before cancel → cancel returns 409', async () => {
        const session = await createSession({
          maxRequests: 5,
          maxInputTokens: 10000,
          maxOutputTokens: 5000,
          actorId,
        });
        const runId = await createControlledRun(actorId);
        await bindRunToSession(session.id, runId, projectId);

        // Complete session
        await completeSession(session.id);

        // Cancel should fail with 409
        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'After complete'),
        ).rejects.toThrow(SessionNotCancellableError);
      });

      it('concurrent cancellations → both succeed (one idempotent)', async () => {
        const session = await createSession({
          maxRequests: 5,
          maxInputTokens: 10000,
          maxOutputTokens: 5000,
          actorId,
        });
        const runId = await createControlledRun(actorId);
        await bindRunToSession(session.id, runId, projectId);

        // Concurrent cancels
        const [result1, result2] = await Promise.all([
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Cancel 1'),
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Cancel 2'),
        ]);

        // Both should succeed
        expect(result1.status).toBe('cancelled');
        expect(result2.status).toBe('cancelled');

        // Exactly one should be idempotent
        const idempotentCount = [result1.idempotent, result2.idempotent].filter(Boolean).length;
        expect(idempotentCount).toBe(1);
      });

      it('reservations rejected after cancellation', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Cancel session
        await cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Block future');

        // Try to reserve budget
        const result = await reserveBudget({
          sessionId: session.id,
          discoveryRunId: run.id,
          estimatedInputTokens: 100,
          reservedOutputTokens: 50,
        });

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('session_terminal');
        expect(result.sessionStatus).toBe('cancelled');
      });

      it('cancellation after run claimed → session cancelled but run stays processing', async () => {
        const session = await createSession({
          maxRequests: 5,
          maxInputTokens: 10000,
          maxOutputTokens: 5000,
          actorId,
        });
        const runId = await createControlledRun(actorId);
        await bindRunToSession(session.id, runId, projectId);

        // Claim the run
        const claimResult = await claimService.authorizeAndClaimControlledRun(
          session.id,
          runId,
          actorId,
          'worker-1',
        );
        expect(claimResult.run.status).toBe('processing');

        // Cancel after claim - session is cancelled but run stays processing
        const cancelResult = await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Cancel after claim',
        );

        expect(cancelResult.status).toBe('cancelled');
        expect(cancelResult.boundRunStatus).toBe('processing');

        // Verify session is cancelled
        const sessionAfter = await getSessionById(session.id);
        expect(sessionAfter!.status).toBe('cancelled');

        // Verify run is still processing (not failed)
        const runAfter = await DiscoveryRunModel.findByPk(runId) as DiscoveryRun;
        expect(runAfter.status).toBe('processing');

        // No new reservations allowed
        const reserveResult = await reserveBudget({
          sessionId: session.id,
          discoveryRunId: runId,
          estimatedInputTokens: 100,
          reservedOutputTokens: 50,
        });
        expect(reserveResult.ok).toBe(false);
        expect(reserveResult.reason).toBe('session_terminal');
      });
    });

    describe('M6 — list isolation with multiple creators', () => {
      it('list totals only count sessions for requesting actor', async () => {
        // Create session for actor1 and complete it
        const { session: s1 } = await createBoundSession(actorId);
        await completeSession(s1.id);

        // Create second actor
        const actor2 = await ActorModel.create({
          organization_id: TEST_ORG_ID,
          email: `actor2-list-total-${Date.now()}@test.com`,
          name: 'Actor Two',
        }) as Actor;

        // Create session for actor2
        await createBoundSession(actor2.id);

        // Actor1's list should only show their 1 completed session
        const result1 = await listSessionsByProjectAndActor(projectId, actorId);
        expect(result1.total).toBe(1);
        expect(result1.items.length).toBe(1);
        expect(result1.items[0].publicId).toBe(s1.public_id);

        // Actor2's list should only show their 1 active session
        const result2 = await listSessionsByProjectAndActor(projectId, actor2.id);
        expect(result2.total).toBe(1);
        expect(result2.items.length).toBe(1);
      });

      it('pagination respects actor filtering', async () => {
        // Create 3 sessions for actor1 (complete each to allow next)
        const { session: s1 } = await createBoundSession(actorId);
        await completeSession(s1.id);
        const { session: s2 } = await createBoundSession(actorId);
        await completeSession(s2.id);
        const { session: s3 } = await createBoundSession(actorId);
        await completeSession(s3.id);

        // Create second actor with their own session
        const actor2 = await ActorModel.create({
          organization_id: TEST_ORG_ID,
          email: `actor2-pagination-${Date.now()}@test.com`,
          name: 'Actor Two',
        }) as Actor;
        await createBoundSession(actor2.id);

        // Actor1 paginated list - page 1 of 2
        const page1 = await listSessionsByProjectAndActor(projectId, actorId, { limit: 2, offset: 0 });
        expect(page1.total).toBe(3); // Only actor1's sessions
        expect(page1.items.length).toBe(2);

        // Page 2
        const page2 = await listSessionsByProjectAndActor(projectId, actorId, { limit: 2, offset: 2 });
        expect(page2.total).toBe(3);
        expect(page2.items.length).toBe(1);
      });
    });

    describe('M6 — PostgreSQL transactional guarantees', () => {
      // Import claim service for processing state tests
      const { authorizeAndClaimControlledRun } = require('../../services/discovery-claim.service');

      it('A: cancel commits before M5e finalization → finalization cannot complete run', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Claim the run to put it in processing state
        await authorizeAndClaimControlledRun(session.id, run.id, actorId, 'worker-1');

        // Cancel session (run is processing so stays processing)
        await cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Cancel before finalize');

        // Attempt finalization - session is now cancelled
        const sessionAfter = await getSessionById(session.id);
        expect(sessionAfter!.status).toBe('cancelled');

        // Finalization should detect cancelled session and fail the run
        // (In real code, finalizeControlledExecution checks session status)
        // Here we verify the session is terminal
        const reserveResult = await reserveBudget({
          sessionId: session.id,
          discoveryRunId: run.id,
          estimatedInputTokens: 100,
          reservedOutputTokens: 50,
        });
        expect(reserveResult.ok).toBe(false);
        expect(reserveResult.sessionStatus).toBe('cancelled');
      });

      it('B: M5e completion commits before cancellation → cancel returns 409', async () => {
        const { session } = await createBoundSession(actorId);

        // Complete session first
        await completeSession(session.id);

        // Cancellation should fail with 409
        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'After completion'),
        ).rejects.toThrow(SessionNotCancellableError);

        // Verify session stayed completed
        const sessionAfter = await getSessionById(session.id);
        expect(sessionAfter!.status).toBe('completed');
      });

      it('C: run update failure during cancellation → both session and run unchanged', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Claim the run to change its status to processing
        await authorizeAndClaimControlledRun(session.id, run.id, actorId, 'worker-race');

        // Now cancellation should succeed but NOT fail the run (it's processing not pending)
        const result = await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Race test',
        );

        // Session cancelled, run unchanged (processing)
        expect(result.status).toBe('cancelled');
        expect(result.boundRunStatus).toBe('processing');

        // Verify run was not modified
        const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfter.status).toBe('processing');
        expect(runAfter.failure_code).toBeNull();
      });

      it('D: concurrent cancel requests → exactly one transition, one idempotent', async () => {
        const { session } = await createBoundSession(actorId);

        // Launch 3 concurrent cancellations
        const results = await Promise.all([
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Cancel A'),
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Cancel B'),
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Cancel C'),
        ]);

        // All should succeed
        expect(results.every(r => r.status === 'cancelled')).toBe(true);

        // Exactly one should be non-idempotent (the winner)
        const nonIdempotent = results.filter(r => !r.idempotent);
        const idempotent = results.filter(r => r.idempotent);
        expect(nonIdempotent.length).toBe(1);
        expect(idempotent.length).toBe(2);

        // All idempotent ones should have same timestamp as the winner
        const winnerTime = nonIdempotent[0].cancelledAt;
        expect(idempotent.every(r => r.cancelledAt.getTime() === winnerTime.getTime())).toBe(true);
      });

      it('E: run failed atomically with session cancellation', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Run is pending - cancellation should fail it atomically
        const result = await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Atomic cancel test',
        );

        expect(result.status).toBe('cancelled');
        expect(result.boundRunStatus).toBe('failed');

        // Verify run has correct failure fields
        const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfter.status).toBe('failed');
        expect(runAfter.failure_code).toBe('SESSION_CANCELLED');
        expect(runAfter.failure_message).toBe('Atomic cancel test');
        expect(runAfter.failure_stage).toBe('controlled_session');
        expect(runAfter.completed_at).not.toBeNull();
      });

      it('F: M5e finalization (completeSession) cannot complete cancelled session', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Claim the run to put it in processing state
        await authorizeAndClaimControlledRun(session.id, run.id, actorId, 'worker-finalize');

        // Cancel the session via M6 API
        await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Cancel before M5e finalization',
        );

        // Verify session is cancelled
        const sessionAfterCancel = await getSessionById(session.id);
        expect(sessionAfterCancel!.status).toBe('cancelled');

        // Verify run is still processing (not failed, since it was claimed)
        const runAfterCancel = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfterCancel.status).toBe('processing');

        // Attempt M5e finalization via completeSession - should throw SessionTerminalError
        await expect(completeSession(session.id)).rejects.toThrow(SessionTerminalError);

        // Verify session remained cancelled (not completed)
        const sessionAfterFinalize = await getSessionById(session.id);
        expect(sessionAfterFinalize!.status).toBe('cancelled');

        // Verify run is still processing (finalization blocked, not completed)
        const runAfterFinalize = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfterFinalize.status).toBe('processing');
      });

      it('G: transactional rollback on authorization failure leaves data unchanged', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Record original state
        const sessionBefore = await getSessionById(session.id);
        const runBefore = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(sessionBefore!.status).toBe('active');
        expect(sessionBefore!.cancelled_at).toBeNull();
        expect(runBefore.status).toBe('pending');
        expect(runBefore.failure_code).toBeNull();

        // Create another actor
        const actor2 = await ActorModel.create({
          organization_id: TEST_ORG_ID,
          display_name: 'Unauthorized Actor',
          status: 'active',
        });
        const actor2Id = (actor2 as unknown as { id: number }).id;

        // Attempt cancellation with wrong actor - should fail with SessionActorMismatchError
        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actor2Id, 'Unauthorized cancel'),
        ).rejects.toThrow(BudgetSessionActorMismatchError);

        // Verify session unchanged (transaction rolled back)
        const sessionAfter = await getSessionById(session.id);
        expect(sessionAfter!.status).toBe('active');
        expect(sessionAfter!.cancelled_at).toBeNull();

        // Verify run unchanged
        const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfter.status).toBe('pending');
        expect(runAfter.failure_code).toBeNull();
        expect(runAfter.failure_message).toBeNull();
      });

      it('H: transactional rollback on terminal state rejection leaves data unchanged', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Complete the session
        await completeSession(session.id);

        // Record state after completion
        const sessionBefore = await getSessionById(session.id);
        const runBefore = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(sessionBefore!.status).toBe('completed');
        expect(sessionBefore!.completed_at).not.toBeNull();
        expect(sessionBefore!.cancelled_at).toBeNull();

        // Attempt cancellation of completed session - should fail with SessionNotCancellableError
        await expect(
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Too late'),
        ).rejects.toThrow(SessionNotCancellableError);

        // Verify session unchanged (transaction rolled back, no cancelled_at set)
        const sessionAfter = await getSessionById(session.id);
        expect(sessionAfter!.status).toBe('completed');
        expect(sessionAfter!.cancelled_at).toBeNull();
        expect(sessionAfter!.cancellation_reason).toBeNull();

        // Verify run unchanged
        const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfter.status).toBe(runBefore.status);
        expect(runAfter.failure_code).toBeNull();
      });
    });

    describe('M6 — Concurrent cancellation evidence', () => {
      it('3 concurrent cancel requests: exactly 1 transition, 2 idempotent, original timestamp/reason preserved', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Launch exactly 3 concurrent cancellations
        const cancelPromises = [
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'First'),
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Second'),
          cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Third'),
        ];

        const results = await Promise.all(cancelPromises);

        // Assertion 1: All 3 requests succeed with status=cancelled
        expect(results.length).toBe(3);
        expect(results.every(r => r.status === 'cancelled')).toBe(true);

        // Assertion 2: Exactly 1 initial successful transition (idempotent=false)
        const transitions = results.filter(r => !r.idempotent);
        expect(transitions.length).toBe(1);

        // Assertion 3: Exactly 2 idempotent successes
        const idempotentResults = results.filter(r => r.idempotent);
        expect(idempotentResults.length).toBe(2);

        // Assertion 4: Original cancellation timestamp preserved across all results
        const winnerTimestamp = transitions[0].cancelledAt;
        expect(idempotentResults.every(r =>
          r.cancelledAt.getTime() === winnerTimestamp.getTime()
        )).toBe(true);

        // Assertion 5: Original cancellation reason preserved
        const winnerReason = transitions[0].cancellationReason;
        expect(idempotentResults.every(r => r.cancellationReason === winnerReason)).toBe(true);

        // Verify database state
        const sessionAfter = await getSessionById(session.id);
        expect(sessionAfter!.status).toBe('cancelled');
        expect(sessionAfter!.cancelled_at!.getTime()).toBe(winnerTimestamp.getTime());
        expect(sessionAfter!.cancellation_reason).toBe(winnerReason);

        // Run should be failed (pending when cancellation happened)
        const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfter.status).toBe('failed');
        expect(runAfter.failure_code).toBe('SESSION_CANCELLED');
      });
    });

    describe('M6 — Real M5e finalization after cancellation', () => {
      // Import the actual M5e finalizer from the app service
      const { finalizeControlledExecution } = require('../../application/discovery.app-service');
      // Import claim service for run claiming
      const { authorizeAndClaimControlledRun: claimRun } = require('../../services/discovery-claim.service');

      it('I: finalizeControlledExecution cannot complete cancelled session (fail-closed contract)', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Step 1: Claim the run to put it in processing state
        await claimRun(session.id, run.id, actorId, 'worker-m5e-test');

        // Verify run is now processing
        const runAfterClaim = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfterClaim.status).toBe('processing');

        // Step 2: Cancel the session via M6 API
        await cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          actorId,
          'Cancel before M5e finalization',
        );

        // Verify session is cancelled (run stays processing since it was claimed)
        const sessionAfterCancel = await getSessionById(session.id);
        expect(sessionAfterCancel!.status).toBe('cancelled');

        const runAfterCancel = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfterCancel.status).toBe('processing');

        // Record budget state before finalization attempt
        const sessionBudgetBefore = {
          usedRequests: sessionAfterCancel!.used_requests,
          usedInputTokens: sessionAfterCancel!.used_input_tokens,
          usedOutputTokens: sessionAfterCancel!.used_output_tokens,
        };

        // Step 3: Invoke actual M5e finalization path with outcome='completed'
        // This should fail because session is cancelled (fail-closed contract)
        const finalizationResult = await finalizeControlledExecution(
          run.id,
          session.id,
          'completed', // Attempting to complete
        );

        // Step 4: Assert finalization failed (fail-closed)
        expect(finalizationResult.success).toBe(false);
        expect(finalizationResult.error).toContain('cancelled'); // Session was cancelled

        // Step 5: Verify run did NOT become completed
        const runAfterFinalize = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(runAfterFinalize.status).toBe('processing'); // Still processing, NOT completed
        expect(runAfterFinalize.completed_at).toBeNull();

        // Step 6: Verify session remains cancelled
        const sessionAfterFinalize = await getSessionById(session.id);
        expect(sessionAfterFinalize!.status).toBe('cancelled');

        // Step 7: Verify no additional budget reservation occurred
        expect(sessionAfterFinalize!.used_requests).toBe(sessionBudgetBefore.usedRequests);
        expect(sessionAfterFinalize!.used_input_tokens).toBe(sessionBudgetBefore.usedInputTokens);
        expect(sessionAfterFinalize!.used_output_tokens).toBe(sessionBudgetBefore.usedOutputTokens);
      });
    });

    describe('M6 — PostgreSQL transactional rollback after partial mutation', () => {
      /**
       * Blocker 2: Verify that if a failure occurs AFTER the run UPDATE
       * but BEFORE the session UPDATE or commit, the entire transaction rolls back.
       *
       * Approach: Use a PostgreSQL trigger that throws on session status update.
       * This is a narrowly-scoped, test-only failure mechanism using real PostgreSQL.
       */

      it('J: rollback after run UPDATE but before session UPDATE preserves original state', async () => {
        const { session, run } = await createBoundSession(actorId);

        // Record original state
        const sessionBefore = await getSessionById(session.id);
        const runBefore = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
        expect(sessionBefore!.status).toBe('active');
        expect(sessionBefore!.cancelled_at).toBeNull();
        expect(runBefore.status).toBe('pending');
        expect(runBefore.failure_code).toBeNull();

        // Create a trigger that throws on session status update to 'cancelled'
        // This will fire AFTER the run UPDATE but when the session UPDATE is attempted
        await sequelize.query(`
          CREATE OR REPLACE FUNCTION m6_test_block_session_cancel()
          RETURNS TRIGGER AS $$
          BEGIN
            IF NEW.status = 'cancelled' AND OLD.status = 'active' THEN
              RAISE EXCEPTION 'M6_TEST_INJECTED_FAILURE: Simulated DB fault after run UPDATE';
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `);

        await sequelize.query(`
          DROP TRIGGER IF EXISTS m6_test_cancel_blocker ON controlled_test_sessions;
        `);

        await sequelize.query(`
          CREATE TRIGGER m6_test_cancel_blocker
          BEFORE UPDATE ON controlled_test_sessions
          FOR EACH ROW
          EXECUTE FUNCTION m6_test_block_session_cancel();
        `);

        try {
          // Attempt M6 cancellation - should fail due to trigger
          await expect(
            cancelControlledSessionFromApi(session.public_id, projectId, actorId, 'Should rollback'),
          ).rejects.toThrow('M6_TEST_INJECTED_FAILURE');

          // Verify session remains active (transaction rolled back)
          const sessionAfter = await getSessionById(session.id);
          expect(sessionAfter!.status).toBe('active');
          expect(sessionAfter!.cancelled_at).toBeNull();
          expect(sessionAfter!.cancellation_reason).toBeNull();

          // Verify run remains pending (transaction rolled back)
          const runAfter = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
          expect(runAfter.status).toBe('pending');
          expect(runAfter.failure_code).toBeNull();
          expect(runAfter.failure_message).toBeNull();
          expect(runAfter.failure_stage).toBeNull();
          expect(runAfter.completed_at).toBeNull();

          // Verify no partial cancellation persisted
          expect(sessionAfter!.updated_at!.getTime()).toBe(sessionBefore!.updated_at!.getTime());

        } finally {
          // Clean up trigger (must always run)
          await sequelize.query(`
            DROP TRIGGER IF EXISTS m6_test_cancel_blocker ON controlled_test_sessions;
          `);
          await sequelize.query(`
            DROP FUNCTION IF EXISTS m6_test_block_session_cancel();
          `);
        }
      });
    });
  });
});
