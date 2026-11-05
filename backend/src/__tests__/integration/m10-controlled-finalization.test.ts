/**
 * M10 Controlled Finalization Integration Tests
 *
 * Tests the exhausted-at-finish-line finalization fix from DISC-WEB-1D-2 M10.
 *
 * Covers:
 * 1. Successful exhaustion at final call — run completes, session stays exhausted
 * 2. Exhaustion before remaining work — run fails
 * 3. Cancellation race — cancellation takes precedence over completion
 * 4. Concurrent/double finalization — idempotent
 * 5. Mismatched run binding — rejected
 * 6. Normal completion — both session and run complete
 * 7. Failed execution — run fails, session cancelled
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import { finalizeControlledExecution } from '../../application/discovery.app-service';
import {
  createSession,
  bindRunToSession,
  reserveBudget,
  reconcileUsage,
  cancelSession,
  completeSession,
  getSessionById,
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
    name: 'M10 Test Project',
    slug: 'm10-test-project',
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

async function createControlledRun(status: string = 'processing'): Promise<number> {
  const run = await DiscoveryRunModel.create({
    project_id: projectId,
    discovery_type: 'stakeholder_synthesis',
    topic: 'M10 Test Run',
    topic_slug: 'm10-test-run',
    source_intent: 'Testing finalization',
    actor_id: actorId,
    created_by_identity: 'U_TEST',
    status,
    is_controlled: true,
    worker_id: 'test-worker-123',
    claimed_at: new Date(),
    started_at: new Date(),
  } as CreationAttributes<DiscoveryRun>);
  return (run as unknown as { id: number }).id;
}

async function createAndBindSession(
  runId: number,
  budget: Partial<CreateSessionInput> = {},
): Promise<number> {
  const sessionInput: CreateSessionInput = {
    maxRequests: budget.maxRequests ?? 4,
    maxInputTokens: budget.maxInputTokens ?? 40000,
    maxOutputTokens: budget.maxOutputTokens ?? 16384,
    actorId,
  };
  const session = await createSession(sessionInput);
  await bindRunToSession(session.id, runId, projectId);
  return session.id;
}

async function exhaustSessionViaReservations(
  sessionId: number,
  runId: number,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const reservation = await reserveBudget({
      sessionId,
      discoveryRunId: runId,
      estimatedInputTokens: 1000,
      reservedOutputTokens: 4096,
      purpose: `test-reservation-${i + 1}`,
    });
    if (!reservation.ok) {
      throw new Error(`Reservation ${i + 1} failed: ${reservation.reason}`);
    }
    await reconcileUsage({
      reservationId: reservation.reservationId!,
      actualInputTokens: 900,
      actualOutputTokens: 500,
    });
  }
}

async function getRunStatus(runId: number): Promise<string> {
  const [rows] = await sequelize.query(
    'SELECT status FROM discovery_runs WHERE id = :runId',
    { replacements: { runId }, raw: true },
  ) as [Array<{ status: string }>, unknown];
  return rows[0]?.status ?? 'not_found';
}

async function getSessionStatus(sessionId: number): Promise<string> {
  const session = await getSessionById(sessionId);
  return session?.status ?? 'not_found';
}

describe('M10 Controlled Finalization', () => {
  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('exhausted-at-finish-line', () => {
    it('completes run when session exhausts on final reservation', async () => {
      // Create session with exactly 4 requests allowed
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId, { maxRequests: 4 });

      // Use all 4 reservations (simulating successful AI calls)
      await exhaustSessionViaReservations(sessionId, runId, 4);

      // Verify session is exhausted
      const sessionStatusBefore = await getSessionStatus(sessionId);
      expect(sessionStatusBefore).toBe('exhausted');

      // Finalize with completed outcome
      const result = await finalizeControlledExecution(runId, sessionId, 'completed');

      expect(result.success).toBe(true);
      expect(result.outcome).toBe('completed');
      expect(result.sessionStatus).toBe('exhausted'); // Session stays exhausted
      expect(result.runStatus).toBe('completed'); // Run transitions to completed

      // Verify persisted state
      const finalRunStatus = await getRunStatus(runId);
      const finalSessionStatus = await getSessionStatus(sessionId);
      expect(finalRunStatus).toBe('completed');
      expect(finalSessionStatus).toBe('exhausted');
    });
  });

  describe('exhaustion before remaining work', () => {
    it('fails run when session exhausts before all work completes', async () => {
      // Create session with only 2 requests allowed
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId, { maxRequests: 2 });

      // Use all 2 reservations
      await exhaustSessionViaReservations(sessionId, runId, 2);

      // Session is exhausted
      expect(await getSessionStatus(sessionId)).toBe('exhausted');

      // Finalize with failed outcome (execution detected budget exhaustion mid-work)
      const result = await finalizeControlledExecution(
        runId,
        sessionId,
        'failed',
        'Budget exhausted before completion',
      );

      expect(result.success).toBe(true);
      expect(result.outcome).toBe('failed');
      expect(result.runStatus).toBe('failed');
      expect(result.sessionStatus).toBe('exhausted'); // Session stays exhausted
    });
  });

  describe('cancellation precedence', () => {
    it('rejects completion when session is cancelled', async () => {
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId);

      // Cancel the session
      await cancelSession(sessionId, 'User requested cancellation');

      // Attempt to finalize as completed
      const result = await finalizeControlledExecution(runId, sessionId, 'completed');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
      expect(result.sessionStatus).toBe('cancelled');

      // Run should still be processing (unchanged)
      expect(await getRunStatus(runId)).toBe('processing');
    });

    it('allows failure finalization when session is cancelled', async () => {
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId);

      // Cancel the session
      await cancelSession(sessionId, 'User requested cancellation');

      // Finalize as failed
      const result = await finalizeControlledExecution(
        runId,
        sessionId,
        'failed',
        'Cancelled by user',
      );

      expect(result.success).toBe(true);
      expect(result.outcome).toBe('failed');
      expect(result.runStatus).toBe('failed');
      expect(result.sessionStatus).toBe('cancelled');
    });
  });

  describe('idempotent finalization', () => {
    it('is idempotent for completed runs', async () => {
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId);

      // First finalization
      const result1 = await finalizeControlledExecution(runId, sessionId, 'completed');
      expect(result1.success).toBe(true);
      expect(result1.runStatus).toBe('completed');

      // Second finalization (same outcome)
      const result2 = await finalizeControlledExecution(runId, sessionId, 'completed');
      expect(result2.success).toBe(true);
      expect(result2.runStatus).toBe('completed');
    });

    it('is idempotent for failed runs', async () => {
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId);

      // First finalization
      const result1 = await finalizeControlledExecution(
        runId,
        sessionId,
        'failed',
        'Test failure',
      );
      expect(result1.success).toBe(true);
      expect(result1.runStatus).toBe('failed');

      // Second finalization (same outcome)
      const result2 = await finalizeControlledExecution(
        runId,
        sessionId,
        'failed',
        'Test failure',
      );
      expect(result2.success).toBe(true);
      expect(result2.runStatus).toBe('failed');
    });
  });

  describe('binding verification', () => {
    it('rejects finalization for mismatched run binding', async () => {
      const runId1 = await createControlledRun('processing');
      const runId2 = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId1);

      // Attempt to finalize with wrong run
      const result = await finalizeControlledExecution(runId2, sessionId, 'completed');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not bound to run');
    });

    it('rejects finalization for non-controlled run', async () => {
      // Create a non-controlled run
      const run = await DiscoveryRunModel.create({
        project_id: projectId,
        discovery_type: 'stakeholder_synthesis',
        topic: 'Non-controlled Run',
        topic_slug: 'non-controlled-run',
        source_intent: 'Testing',
        actor_id: actorId,
        created_by_identity: 'U_TEST',
        status: 'processing',
        is_controlled: false,
        worker_id: 'test-worker-456',
      } as CreationAttributes<DiscoveryRun>);
      const runId = (run as unknown as { id: number }).id;

      // Create session (not bound to this run)
      const sessionInput: CreateSessionInput = {
        maxRequests: 4,
        maxInputTokens: 40000,
        maxOutputTokens: 16384,
        actorId,
      };
      const session = await createSession(sessionInput);

      // Attempt finalization
      const result = await finalizeControlledExecution(runId, session.id, 'completed');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not bound');
    });
  });

  describe('normal completion', () => {
    it('completes both session and run when session is active', async () => {
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId);

      // Verify session is active
      expect(await getSessionStatus(sessionId)).toBe('active');

      // Finalize as completed
      const result = await finalizeControlledExecution(runId, sessionId, 'completed');

      expect(result.success).toBe(true);
      expect(result.outcome).toBe('completed');
      expect(result.sessionStatus).toBe('completed');
      expect(result.runStatus).toBe('completed');

      // Verify persisted state
      expect(await getRunStatus(runId)).toBe('completed');
      expect(await getSessionStatus(sessionId)).toBe('completed');
    });
  });

  describe('failed execution', () => {
    it('fails run and cancels session on failure', async () => {
      const runId = await createControlledRun('processing');
      const sessionId = await createAndBindSession(runId);

      // Finalize as failed
      const result = await finalizeControlledExecution(
        runId,
        sessionId,
        'failed',
        'AI generation failed',
      );

      expect(result.success).toBe(true);
      expect(result.outcome).toBe('failed');
      expect(result.sessionStatus).toBe('cancelled');
      expect(result.runStatus).toBe('failed');

      // Verify persisted state
      expect(await getRunStatus(runId)).toBe('failed');
      expect(await getSessionStatus(sessionId)).toBe('cancelled');
    });
  });

  describe('run status verification', () => {
    it('rejects finalization when run is not processing', async () => {
      // Create a pending run (not yet claimed)
      const run = await DiscoveryRunModel.create({
        project_id: projectId,
        discovery_type: 'stakeholder_synthesis',
        topic: 'Pending Run',
        topic_slug: 'pending-run',
        source_intent: 'Testing',
        actor_id: actorId,
        created_by_identity: 'U_TEST',
        status: 'pending',
        is_controlled: true,
      } as CreationAttributes<DiscoveryRun>);
      const runId = (run as unknown as { id: number }).id;
      const sessionId = await createAndBindSession(runId);

      // Attempt finalization
      const result = await finalizeControlledExecution(runId, sessionId, 'completed');

      expect(result.success).toBe(false);
      expect(result.error).toContain("status 'pending'");
    });
  });
});
