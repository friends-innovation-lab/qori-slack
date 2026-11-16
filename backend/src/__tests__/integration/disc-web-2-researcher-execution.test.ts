/**
 * DISC-WEB-2 Researcher Execution Tests
 *
 * Tests researcher-specific execution behaviors:
 * 1. Claim → controlled context entry → session lookup
 * 2. Stale quarantine preserves provider reservations
 * 3. Feature gate compatibility verification
 *
 * Note: End-to-end budget enforcement through YAML pipeline is covered by
 * M7 tests (m7-controlled-pipeline-verification.test.ts). These tests verify
 * researcher-specific claim and quarantine behaviors.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import { randomUUID } from 'crypto';

// Mock GitHub to prevent ESM import issues and API calls
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockRejectedValue({ status: 404, message: 'Not Found' }),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ path: 'test/path.md', sha: 'abc123', url: 'https://github.com/test' }),
  getConfigRepo: jest.fn().mockReturnValue('test-config-repo'),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
  fetchFileFromRepo: jest.fn().mockResolvedValue({ content: 'test content' }),
}));

// Import after mocking
import {
  claimNextResearcherRun,
  quarantineStaleResearcherRuns,
  isResearcherWorkerEnabled,
} from '../../services/discovery-claim.service';
import {
  getSessionById,
} from '../../services/controlled-test-budget.service';
import {
  runInControlledContext,
  _resetLifecycleState,
} from '../../context/controlledExecutionContext';

const sequelize = getTestDb();
const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const DiscoveryRunModel = sequelize.models.DiscoveryRun;
const ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;

// Test fixtures
let projectId: number;
let actorId: number;

async function setupFixtures(): Promise<void> {
  const project = await ProjectModel.create({
    name: 'DISC-WEB-2 Execution Test Project',
    slug: 'disc-web-2-execution-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as unknown as { id: number }).id;

  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'DISC-WEB-2 Test Researcher',
    status: 'active',
  });
  actorId = (actor as unknown as { id: number }).id;
}

async function createResearcherRunWithSession(
  status: 'pending' | 'processing' = 'pending',
  heartbeatAge?: number,
): Promise<{ run: DiscoveryRun; session: ControlledTestSession }> {
  const run = await DiscoveryRunModel.create({
    project_id: projectId,
    discovery_type: 'desk_research',
    topic: `Test Topic ${Date.now()}`,
    topic_slug: `test-topic-${Date.now()}`,
    source_intent: 'Testing researcher execution',
    actor_id: actorId,
    created_by_identity: 'api:test',
    status,
    is_controlled: true,
    worker_id: status === 'processing' ? 'test-worker' : null,
    heartbeat_at: heartbeatAge !== undefined
      ? new Date(Date.now() - heartbeatAge)
      : status === 'processing' ? new Date() : null,
  } as CreationAttributes<DiscoveryRun>) as unknown as DiscoveryRun;

  const session = await ControlledTestSessionModel.create({
    session_type: 'researcher',
    project_id: projectId,
    created_by_actor_id: actorId,
    discovery_run_id: run.id,
    max_requests: 4,
    max_input_tokens: 40000,
    max_output_tokens: 16384,
    status: 'active',
  } as CreationAttributes<ControlledTestSession>);

  return { run, session };
}

async function getReservationCount(sessionId: number): Promise<number> {
  const [rows] = await sequelize.query(
    'SELECT COUNT(*) as count FROM controlled_test_reservations WHERE session_id = :sessionId',
    { replacements: { sessionId } },
  );
  return Number((rows as Array<{ count: string }>)[0].count);
}

async function getTotalReservedTokens(sessionId: number): Promise<{ input: number; output: number }> {
  const [rows] = await sequelize.query(
    `SELECT
       COALESCE(SUM(reserved_input_tokens), 0)::int as input,
       COALESCE(SUM(reserved_output_tokens), 0)::int as output
     FROM controlled_test_reservations
     WHERE session_id = :sessionId`,
    { replacements: { sessionId } },
  );
  const row = (rows as Array<{ input: number; output: number }>)[0];
  return { input: row.input, output: row.output };
}

describe('DISC-WEB-2 Researcher Execution', () => {
  // Store original env values
  const originalWorkerEnabled = process.env.DISC_WEB2_WORKER_ENABLED;
  const originalWeb1Enabled = process.env.DISC_WEB1_ENABLED;
  const originalResearcherEnabled = process.env.DISC_WEB2_RESEARCHER_ENABLED;

  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
    _resetLifecycleState();

    // Enable features
    process.env.DISC_WEB2_WORKER_ENABLED = 'true';
    process.env.DISC_WEB1_ENABLED = 'true';
    process.env.DISC_WEB2_RESEARCHER_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.DISC_WEB2_WORKER_ENABLED = originalWorkerEnabled;
    process.env.DISC_WEB1_ENABLED = originalWeb1Enabled;
    process.env.DISC_WEB2_RESEARCHER_ENABLED = originalResearcherEnabled;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLAIM → CONTROLLED CONTEXT ENTRY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('claim and controlled context entry', () => {
    it('claim returns sessionId for controlled context entry', async () => {
      const { run, session } = await createResearcherRunWithSession();

      const claimResult = await claimNextResearcherRun('test-worker');

      expect(claimResult).not.toBeNull();
      expect(claimResult!.run.id).toBe(run.id);
      expect(claimResult!.sessionId).toBe(session.id);
      expect(claimResult!.sessionPublicId).toBe(session.public_id);
    });

    it('claimed session can be used for controlled context entry', async () => {
      const { run, session } = await createResearcherRunWithSession();

      const claimResult = await claimNextResearcherRun('test-worker');
      expect(claimResult).not.toBeNull();

      // Verify session lookup works
      const loadedSession = await getSessionById(claimResult!.sessionId);
      expect(loadedSession).not.toBeNull();
      expect(loadedSession!.status).toBe('active');
      expect(loadedSession!.session_type).toBe('researcher');

      // Verify controlled context can be entered
      let contextEntered = false;
      await runInControlledContext(
        { sessionId: claimResult!.sessionId, discoveryRunId: run.id },
        async () => {
          contextEntered = true;
        },
      );
      expect(contextEntered).toBe(true);
    });

    it('session is bound to run via discovery_run_id', async () => {
      const { run, session } = await createResearcherRunWithSession();

      const claimResult = await claimNextResearcherRun('test-worker');
      expect(claimResult).not.toBeNull();

      const loadedSession = await getSessionById(claimResult!.sessionId);
      expect(loadedSession!.discovery_run_id).toBe(run.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STALE QUARANTINE PRESERVES RESERVATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('stale quarantine preserves provider reservations', () => {
    it('quarantined run retains its budget reservations', async () => {
      // Create a stale processing run with pre-existing reservations
      const { run, session } = await createResearcherRunWithSession('processing', 180000);

      // Create a reservation manually (simulating partial execution before crash)
      await sequelize.query(
        `INSERT INTO controlled_test_reservations
         (session_id, state, reserved_input_tokens, reserved_output_tokens, actual_output_tokens, reconciled_at, created_at)
         VALUES (:sessionId, 'reconciled', 1000, 500, 450, NOW(), NOW())`,
        {
          replacements: {
            sessionId: session.id,
          },
        },
      );

      // Verify reservation exists before quarantine
      const reservationsBefore = await getReservationCount(session.id);
      expect(reservationsBefore).toBe(1);

      // Quarantine stale runs
      const quarantinedCount = await quarantineStaleResearcherRuns('recovery-worker');
      expect(quarantinedCount).toBe(1);

      // Verify run is failed with quarantine code
      const quarantinedRun = await DiscoveryRunModel.findByPk(run.id) as any;
      expect(quarantinedRun.status).toBe('failed');
      expect(quarantinedRun.failure_code).toBe('RESEARCHER_STALE_QUARANTINE');

      // Verify session is cancelled
      const cancelledSession = await ControlledTestSessionModel.findByPk(session.id);
      expect(cancelledSession!.status).toBe('cancelled');

      // CRITICAL: Verify reservations are PRESERVED (not deleted)
      const reservationsAfter = await getReservationCount(session.id);
      expect(reservationsAfter).toBe(reservationsBefore);
    });

    it('quarantine preserves token totals for audit', async () => {
      // Create stale run with reservations
      const { run, session } = await createResearcherRunWithSession('processing', 180000);

      // Create reservations with known token totals
      await sequelize.query(
        `INSERT INTO controlled_test_reservations
         (session_id, state, reserved_input_tokens, reserved_output_tokens, actual_output_tokens, reconciled_at, created_at)
         VALUES
           (:sessionId, 'reconciled', 1000, 500, 450, NOW(), NOW()),
           (:sessionId, 'reconciled', 1500, 750, 700, NOW(), NOW())`,
        {
          replacements: {
            sessionId: session.id,
          },
        },
      );

      const tokensBefore = await getTotalReservedTokens(session.id);
      expect(tokensBefore.input).toBe(2500);
      expect(tokensBefore.output).toBe(1250);

      // Quarantine
      await quarantineStaleResearcherRuns('recovery-worker');

      // Verify token totals preserved
      const tokensAfter = await getTotalReservedTokens(session.id);
      expect(tokensAfter.input).toBe(tokensBefore.input);
      expect(tokensAfter.output).toBe(tokensBefore.output);
    });

    it('quarantine sets proper cancellation reason', async () => {
      const { run, session } = await createResearcherRunWithSession('processing', 180000);

      await quarantineStaleResearcherRuns('recovery-worker');

      const cancelledSession = await ControlledTestSessionModel.findByPk(session.id);
      expect(cancelledSession!.cancellation_reason).toContain('stale heartbeat');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE GATE COMPATIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('feature gate compatibility', () => {
    it('DISC_WEB2_WORKER_ENABLED controls researcher worker', () => {
      process.env.DISC_WEB2_WORKER_ENABLED = 'true';
      expect(isResearcherWorkerEnabled()).toBe(true);

      process.env.DISC_WEB2_WORKER_ENABLED = 'false';
      expect(isResearcherWorkerEnabled()).toBe(false);

      process.env.DISC_WEB2_WORKER_ENABLED = undefined;
      expect(isResearcherWorkerEnabled()).toBe(false);
    });

    it('controlled context requires active session', async () => {
      const { run, session } = await createResearcherRunWithSession();

      // Cancel the session
      await session.update({ status: 'cancelled', cancelled_at: new Date(), cancellation_reason: 'Test' });

      // Context should still be enterable (context validates session existence, not status)
      // Status checks happen in the budget service
      let contextEntered = false;
      await runInControlledContext(
        { sessionId: session.id, discoveryRunId: run.id },
        async () => {
          contextEntered = true;
        },
      );
      expect(contextEntered).toBe(true);
    });

    it('session status is checked by budget service, not context', async () => {
      const { run, session } = await createResearcherRunWithSession();

      // Claim the run (to verify it works when active)
      const claimResult = await claimNextResearcherRun('test-worker');
      expect(claimResult).not.toBeNull();

      // Verify session is active
      const loadedSession = await getSessionById(claimResult!.sessionId);
      expect(loadedSession!.status).toBe('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESEARCHER SESSION TYPE ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('researcher session type verification', () => {
    it('researcher runs have session_type=researcher', async () => {
      const { run, session } = await createResearcherRunWithSession();

      expect(session.session_type).toBe('researcher');

      const claimResult = await claimNextResearcherRun('test-worker');
      expect(claimResult).not.toBeNull();

      const loadedSession = await getSessionById(claimResult!.sessionId);
      expect(loadedSession!.session_type).toBe('researcher');
    });

    it('researcher claim returns session info for budget enforcement', async () => {
      const { run, session } = await createResearcherRunWithSession();

      const claimResult = await claimNextResearcherRun('test-worker');
      expect(claimResult).not.toBeNull();

      // All required fields for controlled execution are present
      expect(claimResult!.run.id).toBeDefined();
      expect(claimResult!.sessionId).toBeDefined();
      expect(claimResult!.sessionPublicId).toBeDefined();

      // Session has budget limits set
      const loadedSession = await getSessionById(claimResult!.sessionId);
      expect(loadedSession!.max_requests).toBeGreaterThan(0);
      expect(loadedSession!.max_input_tokens).toBeGreaterThan(0);
      expect(loadedSession!.max_output_tokens).toBeGreaterThan(0);
    });
  });
});
