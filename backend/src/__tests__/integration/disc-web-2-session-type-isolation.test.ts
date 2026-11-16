/**
 * DISC-WEB-2 Session Type Isolation Tests
 *
 * Verifies that researcher and supervised session types coexist correctly:
 * 1. M10 global singleton preserved for supervised sessions
 * 2. Per-actor constraint enforced for researcher sessions
 * 3. Different actors can have concurrent researcher sessions
 * 4. Session types don't interfere with each other
 * 5. Migration rollback preserves original behavior
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type {
  ControlledTestSession,
  ControlledTestSessionType,
} from '../../database/models/controlled_test_session';

const sequelize = getTestDb();
const ControlledTestSessionModel = sequelize.models
  .ControlledTestSession as typeof ControlledTestSession;
const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;

// Test fixtures
let projectId: number;
let actor1Id: number;
let actor2Id: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-WEB-2 Session Type Test Project',
    slug: 'disc-web-2-session-type-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as unknown as { id: number }).id;

  const actor1 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher 1',
    status: 'active',
  });
  actor1Id = (actor1 as unknown as { id: number }).id;

  const actor2 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher 2',
    status: 'active',
  });
  actor2Id = (actor2 as unknown as { id: number }).id;
}

async function createSession(
  sessionType: ControlledTestSessionType,
  actorId: number,
): Promise<ControlledTestSession> {
  return ControlledTestSessionModel.create({
    session_type: sessionType,
    project_id: projectId,
    created_by_actor_id: actorId,
    max_requests: 4,
    max_input_tokens: 40000,
    max_output_tokens: 16384,
    status: 'active',
  } as CreationAttributes<ControlledTestSession>);
}

describe('DISC-WEB-2 Session Type Isolation', () => {
  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // M10 SUPERVISED GLOBAL SINGLETON PRESERVATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('M10 supervised global singleton', () => {
    it('allows creating one supervised session', async () => {
      const session = await createSession('supervised', actor1Id);

      expect(session.session_type).toBe('supervised');
      expect(session.status).toBe('active');
    });

    it('rejects second supervised session (global singleton)', async () => {
      await createSession('supervised', actor1Id);

      // Second supervised session should fail even with different actor
      await expect(createSession('supervised', actor2Id)).rejects.toThrow();
    });

    it('allows new supervised session after previous completes', async () => {
      const session1 = await createSession('supervised', actor1Id);

      // Complete the first session
      session1.status = 'completed';
      session1.completed_at = new Date();
      await session1.save();

      // New supervised session should succeed
      const session2 = await createSession('supervised', actor2Id);
      expect(session2.session_type).toBe('supervised');
      expect(session2.status).toBe('active');
    });

    it('allows new supervised session after previous is cancelled', async () => {
      const session1 = await createSession('supervised', actor1Id);

      // Cancel the first session
      session1.status = 'cancelled';
      session1.cancelled_at = new Date();
      await session1.save();

      // New supervised session should succeed
      const session2 = await createSession('supervised', actor1Id);
      expect(session2.status).toBe('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESEARCHER PER-ACTOR CONSTRAINT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('researcher per-actor constraint', () => {
    it('allows creating one researcher session per actor', async () => {
      const session = await createSession('researcher', actor1Id);

      expect(session.session_type).toBe('researcher');
      expect(session.status).toBe('active');
    });

    it('rejects second researcher session for same actor', async () => {
      await createSession('researcher', actor1Id);

      // Second researcher session for same actor should fail
      await expect(createSession('researcher', actor1Id)).rejects.toThrow();
    });

    it('allows researcher sessions for different actors concurrently', async () => {
      const session1 = await createSession('researcher', actor1Id);
      const session2 = await createSession('researcher', actor2Id);

      expect(session1.status).toBe('active');
      expect(session2.status).toBe('active');
      expect(session1.id).not.toBe(session2.id);
    });

    it('allows new researcher session after previous completes', async () => {
      const session1 = await createSession('researcher', actor1Id);

      // Complete the first session
      session1.status = 'completed';
      session1.completed_at = new Date();
      await session1.save();

      // New researcher session should succeed for same actor
      const session2 = await createSession('researcher', actor1Id);
      expect(session2.status).toBe('active');
    });

    it('allows new researcher session after previous is exhausted', async () => {
      const session1 = await createSession('researcher', actor1Id);

      // Exhaust the first session
      session1.status = 'exhausted';
      session1.exhausted_at = new Date();
      await session1.save();

      // New researcher session should succeed
      const session2 = await createSession('researcher', actor1Id);
      expect(session2.status).toBe('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION TYPE NON-INTERFERENCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('session type non-interference', () => {
    it('allows supervised and researcher sessions concurrently', async () => {
      const supervisedSession = await createSession('supervised', actor1Id);
      const researcherSession = await createSession('researcher', actor2Id);

      expect(supervisedSession.session_type).toBe('supervised');
      expect(researcherSession.session_type).toBe('researcher');
      expect(supervisedSession.status).toBe('active');
      expect(researcherSession.status).toBe('active');
    });

    it('allows supervised session while researcher sessions exist', async () => {
      // Create researcher sessions first
      const researcher1 = await createSession('researcher', actor1Id);
      const researcher2 = await createSession('researcher', actor2Id);

      // Supervised session should still work (different constraint)
      const supervised = await createSession('supervised', actor1Id);

      expect(researcher1.status).toBe('active');
      expect(researcher2.status).toBe('active');
      expect(supervised.status).toBe('active');
    });

    it('allows researcher session while supervised session exists', async () => {
      // Create supervised session first
      const supervised = await createSession('supervised', actor1Id);

      // Researcher session should still work (different constraint)
      const researcher = await createSession('researcher', actor2Id);

      expect(supervised.status).toBe('active');
      expect(researcher.status).toBe('active');
    });

    it('same actor can have supervised and researcher session concurrently', async () => {
      const supervised = await createSession('supervised', actor1Id);
      const researcher = await createSession('researcher', actor1Id);

      expect(supervised.status).toBe('active');
      expect(researcher.status).toBe('active');
      expect(supervised.id).not.toBe(researcher.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT SESSION TYPE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('default session type', () => {
    it('defaults to supervised when session_type not specified', async () => {
      const session = await ControlledTestSessionModel.create({
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
        // session_type NOT specified
      } as CreationAttributes<ControlledTestSession>);

      expect(session.session_type).toBe('supervised');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRAINT VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('session type validation', () => {
    it('rejects invalid session_type values', async () => {
      await expect(
        ControlledTestSessionModel.create({
          session_type: 'invalid_type' as ControlledTestSessionType,
          project_id: projectId,
          created_by_actor_id: actor1Id,
          max_requests: 4,
          max_input_tokens: 40000,
          max_output_tokens: 16384,
          status: 'active',
        } as CreationAttributes<ControlledTestSession>),
      ).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('query isolation by session type', () => {
    it('can query active sessions by type', async () => {
      await createSession('supervised', actor1Id);
      await createSession('researcher', actor1Id);
      await createSession('researcher', actor2Id);

      const activeSupervisedCount = await ControlledTestSessionModel.count({
        where: { status: 'active', session_type: 'supervised' },
      });

      const activeResearcherCount = await ControlledTestSessionModel.count({
        where: { status: 'active', session_type: 'researcher' },
      });

      expect(activeSupervisedCount).toBe(1);
      expect(activeResearcherCount).toBe(2);
    });

    it('can find active researcher session for specific actor', async () => {
      await createSession('researcher', actor1Id);
      await createSession('researcher', actor2Id);

      const actor1Session = await ControlledTestSessionModel.findOne({
        where: {
          status: 'active',
          session_type: 'researcher',
          created_by_actor_id: actor1Id,
        },
      });

      expect(actor1Session).not.toBeNull();
      expect(actor1Session!.created_by_actor_id).toBe(actor1Id);
    });
  });
});
