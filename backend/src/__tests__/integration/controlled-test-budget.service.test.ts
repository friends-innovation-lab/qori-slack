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
      const bound = await bindRunToSession(session.id, runId);

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
      await expect(bindRunToSession(session.id, runId)).rejects.toThrow(SessionTerminalError);
    });

    it('rejects binding second run to same session', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });
      const runId1 = await createTestDiscoveryRun();
      await bindRunToSession(session.id, runId1);

      const runId2 = await createTestDiscoveryRun();
      await expect(bindRunToSession(session.id, runId2)).rejects.toThrow(RunAlreadyBoundError);
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
      await bindRunToSession(session.id, runId);

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
      await bindRunToSession(session.id, runId);
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
      await bindRunToSession(session.id, runId);

      // Exhaust the budget
      const reservation = await reserveBudget({ sessionId: session.id, estimatedInputTokens: 50, reservedOutputTokens: 50 });
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
      await bindRunToSession(session.id, runId);
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
      await bindRunToSession(session.id, runId);

      // Use some budget
      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 500, reservedOutputTokens: 200 });

      // Cancel the session
      await cancelSession(session.id, 'test');

      // Look up session by run ID (this is how the guard will find it)
      const foundSession = await getSessionByRunId(runId);
      expect(foundSession).not.toBeNull();
      expect(foundSession!.status).toBe('cancelled');

      // Try to reserve budget — should fail
      const result = await reserveBudget({
        sessionId: foundSession!.id,
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
      await bindRunToSession(session.id, runId);

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
      await bindRunToSession(session.id, runId);
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
      await bindRunToSession(session.id, runId);

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
      await bindRunToSession(session.id, runId);

      const reservation = await reserveBudget({
        sessionId: session.id,
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
});
