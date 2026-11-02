/**
 * Controlled Test Budget Service Integration Tests — DISC-WEB-1D-2 M1
 *
 * Tests the critical invariants from QORI-ROADMAP.md:
 * 1. Budget enforcement: cancelled/exhausted/completed sessions block execution
 * 2. Atomic reservation: concurrent requests don't exceed budget
 * 3. Single active session: database constraint enforced
 * 4. Run binding: immutable once set, lookup works regardless of status
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
  bindRunToSession,
  reserveBudget,
  reconcileUsage,
  cancelSession,
  completeSession,
  toSessionSummary,
  SessionAlreadyExistsError,
  SessionNotFoundError,
  SessionTerminalError,
  RunAlreadyBoundError,
  type CreateSessionInput,
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
      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 50 });
      await reconcileUsage({ sessionId: session.id, actualInputTokens: 50, actualOutputTokens: 50 });

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
    it('reserves budget atomically', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 1000,
      });

      expect(result.ok).toBe(true);
      expect(result.sessionStatus).toBe('active');
      expect(result.remainingRequests).toBe(9);
      expect(result.remainingInputTokens).toBe(9000);
    });

    it('rejects reservation when requests exhausted', async () => {
      const session = await createSession({
        maxRequests: 1,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Use the single request
      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 100 });

      // Try to reserve another
      const result = await reserveBudget({
        sessionId: session.id,
        estimatedInputTokens: 100,
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
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('session_terminal');
      expect(result.sessionStatus).toBe('cancelled');
    });

    it('rejects reservation for non-existent session', async () => {
      const result = await reserveBudget({
        sessionId: 999999,
        estimatedInputTokens: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('session_not_found');
    });
  });

  describe('concurrent reservation — race condition prevention', () => {
    it('handles concurrent reservations atomically', async () => {
      const session = await createSession({
        maxRequests: 5,
        maxInputTokens: 5000,
        maxOutputTokens: 2000,
      });

      // Simulate concurrent reservations
      const reservations = await Promise.all([
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000 }),
      ]);

      // All 5 should succeed (we have exactly 5 requests)
      const successes = reservations.filter((r) => r.ok);
      expect(successes.length).toBe(5);

      // Verify final state
      const updated = await getSessionById(session.id);
      expect(updated!.used_requests).toBe(5);
      expect(updated!.used_input_tokens).toBe(5000);
    });

    it('rejects excess concurrent reservations', async () => {
      const session = await createSession({
        maxRequests: 3,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      // Try to make 5 concurrent reservations when only 3 allowed
      const reservations = await Promise.all([
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100 }),
        reserveBudget({ sessionId: session.id, estimatedInputTokens: 100 }),
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
  });

  describe('reconcileUsage', () => {
    it('updates output tokens', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 5000,
      });

      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000 });
      const reconciled = await reconcileUsage({
        sessionId: session.id,
        actualInputTokens: 1000,
        actualOutputTokens: 500,
      });

      expect(reconciled.used_output_tokens).toBe(500);
    });

    it('transitions to exhausted when output tokens reach limit', async () => {
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 10000,
        maxOutputTokens: 100,
      });

      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 100 });
      const reconciled = await reconcileUsage({
        sessionId: session.id,
        actualInputTokens: 100,
        actualOutputTokens: 100, // Reaches limit exactly
      });

      expect(reconciled.status).toBe('exhausted');
      expect(reconciled.exhausted_at).not.toBeNull();
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
      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 1000 });
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
      await reserveBudget({ sessionId: session.id, estimatedInputTokens: 500 });

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
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('session_terminal');
      expect(result.sessionStatus).toBe('cancelled');
    });
  });
});
