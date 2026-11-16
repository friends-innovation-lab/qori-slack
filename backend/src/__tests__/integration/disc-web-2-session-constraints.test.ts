/**
 * DISC-WEB-2 Session Constraint Tests
 *
 * Tests the partial unique indexes that enforce session type invariants:
 * 1. Supervised: at most ONE active session globally
 * 2. Researcher: at most ONE active session per actor
 *
 * These database-level constraints prevent data corruption even under
 * concurrent requests or application bugs.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';

// Mock GitHub to prevent ESM import issues and API calls
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockRejectedValue({ status: 404, message: 'Not Found' }),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ path: 'test/path.md', sha: 'abc123', url: 'https://github.com/test' }),
  getConfigRepo: jest.fn().mockReturnValue('test-config-repo'),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
  fetchFileFromRepo: jest.fn().mockResolvedValue({ content: 'test content' }),
}));

const sequelize = getTestDb();
const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;

// Test fixtures
let projectId: number;
let actor1Id: number;
let actor2Id: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-WEB-2 Constraint Test Project',
    slug: 'disc-web-2-constraint-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as unknown as { id: number }).id;

  const actor1 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Constraint Test Actor 1',
    status: 'active',
  });
  actor1Id = (actor1 as unknown as { id: number }).id;

  const actor2 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Constraint Test Actor 2',
    status: 'active',
  });
  actor2Id = (actor2 as unknown as { id: number }).id;
}

describe('DISC-WEB-2 Session Type Constraint Verification', () => {
  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTIAL UNIQUE INDEX EXISTENCE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('partial unique index existence', () => {
    it('supervised singleton index exists', async () => {
      const [result] = await sequelize.query(`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'controlled_test_sessions'
        AND indexname = 'controlled_test_sessions_single_active_supervised_idx'
      `);
      const rows = result as Array<{ indexname: string; indexdef: string }>;

      expect(rows.length).toBe(1);
      expect(rows[0].indexdef).toContain('WHERE');
      expect(rows[0].indexdef).toContain('supervised');
    });

    it('researcher per-actor index exists', async () => {
      const [result] = await sequelize.query(`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'controlled_test_sessions'
        AND indexname = 'controlled_test_sessions_single_active_researcher_idx'
      `);
      const rows = result as Array<{ indexname: string; indexdef: string }>;

      expect(rows.length).toBe(1);
      expect(rows[0].indexdef).toContain('WHERE');
      expect(rows[0].indexdef).toContain('researcher');
      expect(rows[0].indexdef).toContain('created_by_actor_id');
    });

    it('session_type CHECK constraint exists', async () => {
      const [result] = await sequelize.query(`
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'controlled_test_sessions'::regclass
        AND conname = 'controlled_test_sessions_session_type_check'
      `);
      const rows = result as Array<{ conname: string }>;

      expect(rows.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPERVISED SINGLETON CONSTRAINT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('supervised singleton constraint', () => {
    it('allows one active supervised session', async () => {
      const session = await ControlledTestSessionModel.create({
        session_type: 'supervised',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      expect(session.id).toBeDefined();
      expect(session.session_type).toBe('supervised');
      expect(session.status).toBe('active');
    });

    it('rejects second active supervised session (same actor)', async () => {
      // First supervised session
      await ControlledTestSessionModel.create({
        session_type: 'supervised',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Second supervised session (same actor) should fail
      // Sequelize wraps unique constraint violations as "Validation error"
      await expect(
        ControlledTestSessionModel.create({
          session_type: 'supervised',
          project_id: projectId,
          created_by_actor_id: actor1Id,
          max_requests: 4,
          max_input_tokens: 40000,
          max_output_tokens: 16384,
          status: 'active',
        } as CreationAttributes<ControlledTestSession>),
      ).rejects.toThrow(/Validation error|duplicate key|unique constraint|violates unique/i);
    });

    it('rejects second active supervised session (different actor)', async () => {
      // First supervised session
      await ControlledTestSessionModel.create({
        session_type: 'supervised',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Second supervised session (different actor) should also fail
      // because supervised is a GLOBAL singleton
      // Sequelize wraps unique constraint violations as "Validation error"
      await expect(
        ControlledTestSessionModel.create({
          session_type: 'supervised',
          project_id: projectId,
          created_by_actor_id: actor2Id,
          max_requests: 4,
          max_input_tokens: 40000,
          max_output_tokens: 16384,
          status: 'active',
        } as CreationAttributes<ControlledTestSession>),
      ).rejects.toThrow(/Validation error|duplicate key|unique constraint|violates unique/i);
    });

    it('allows new supervised session after previous is completed', async () => {
      // First supervised session
      const first = await ControlledTestSessionModel.create({
        session_type: 'supervised',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Complete the first session
      await first.update({ status: 'completed', completed_at: new Date() });

      // Second supervised session should succeed
      const second = await ControlledTestSessionModel.create({
        session_type: 'supervised',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      expect(second.id).toBeDefined();
      expect(second.id).not.toBe(first.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESEARCHER PER-ACTOR CONSTRAINT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('researcher per-actor constraint', () => {
    it('allows one active researcher session per actor', async () => {
      const session = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      expect(session.id).toBeDefined();
      expect(session.session_type).toBe('researcher');
      expect(session.status).toBe('active');
    });

    it('rejects second active researcher session for same actor', async () => {
      // First researcher session for actor1
      await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Second researcher session for same actor should fail
      // Sequelize wraps unique constraint violations as "Validation error"
      await expect(
        ControlledTestSessionModel.create({
          session_type: 'researcher',
          project_id: projectId,
          created_by_actor_id: actor1Id,
          max_requests: 4,
          max_input_tokens: 40000,
          max_output_tokens: 16384,
          status: 'active',
        } as CreationAttributes<ControlledTestSession>),
      ).rejects.toThrow(/Validation error|duplicate key|unique constraint|violates unique/i);
    });

    it('allows different actors to have concurrent researcher sessions', async () => {
      // Researcher session for actor1
      const session1 = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Researcher session for actor2 should succeed (different actor)
      const session2 = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor2Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      expect(session1.id).toBeDefined();
      expect(session2.id).toBeDefined();
      expect(session1.id).not.toBe(session2.id);
    });

    it('allows new researcher session after previous is cancelled', async () => {
      // First researcher session
      const first = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Cancel the first session
      await first.update({ status: 'cancelled', cancelled_at: new Date(), cancellation_reason: 'Test' });

      // Second researcher session should succeed
      const second = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      expect(second.id).toBeDefined();
      expect(second.id).not.toBe(first.id);
    });

    it('allows new researcher session after previous is exhausted', async () => {
      // First researcher session
      const first = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
        used_requests: 4,
      } as CreationAttributes<ControlledTestSession>);

      // Exhaust the first session
      await first.update({ status: 'exhausted', exhausted_at: new Date() });

      // Second researcher session should succeed
      const second = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      expect(second.id).toBeDefined();
      expect(second.id).not.toBe(first.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSS-TYPE ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cross-type session isolation', () => {
    it('researcher and supervised sessions can coexist for same actor', async () => {
      // Supervised session for actor1
      const supervised = await ControlledTestSessionModel.create({
        session_type: 'supervised',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Researcher session for same actor should succeed
      const researcher = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      expect(supervised.id).toBeDefined();
      expect(researcher.id).toBeDefined();
      expect(supervised.session_type).toBe('supervised');
      expect(researcher.session_type).toBe('researcher');
    });

    it('multiple actors can have researcher sessions while supervised exists', async () => {
      // Supervised session (global singleton)
      const supervised = await ControlledTestSessionModel.create({
        session_type: 'supervised',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // Researcher sessions for different actors
      const researcher1 = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor1Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      const researcher2 = await ControlledTestSessionModel.create({
        session_type: 'researcher',
        project_id: projectId,
        created_by_actor_id: actor2Id,
        max_requests: 4,
        max_input_tokens: 40000,
        max_output_tokens: 16384,
        status: 'active',
      } as CreationAttributes<ControlledTestSession>);

      // All three should coexist
      expect(supervised.id).toBeDefined();
      expect(researcher1.id).toBeDefined();
      expect(researcher2.id).toBeDefined();

      // Verify all are still active
      const activeCount = await ControlledTestSessionModel.count({ where: { status: 'active' } });
      expect(activeCount).toBe(3);
    });
  });
});
