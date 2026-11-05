/**
 * M10 Unbound Session Cancellation Tests — DISC-WEB-1D-2
 *
 * Tests the M10 extension that allows cancellation of unbound controlled sessions.
 * This enables recovery when run creation fails after session creation.
 *
 * Verification Matrix:
 * - Creator can cancel unbound session
 * - Non-creator cannot cancel unbound session
 * - Wrong project cannot cancel unbound session
 * - Feature gates enforced for unbound cancellation
 * - Idempotent cancellation for unbound sessions
 * - Race between cancellation and run binding
 * - New session creation after unbound cancellation
 * - Bound session behavior unchanged (regression)
 */

import request from 'supertest';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';
import type { CreationAttributes } from 'sequelize';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import {
  createSessionForApi,
  cancelControlledSessionFromApi,
  bindRunToSession,
  SessionNotFoundError,
  SessionActorMismatchError,
} from '../../services/controlled-test-budget.service';
import { randomUUID } from 'crypto';

describe('M10 Unbound Session Cancellation — DISC-WEB-1D-2', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let project2: Project;

  // Actors
  let creatorActor: Actor;
  let otherActor: Actor;

  // Public IDs
  let creatorPublicId: string;
  let otherPublicId: string;
  let projectPublicId: string;
  let project2PublicId: string;

  // Internal IDs
  let projectId: number;
  let project2Id: number;

  // Models
  let ProjectModel: typeof Project;
  let ActorModel: typeof Actor;
  let DiscoveryRunModel: typeof DiscoveryRun;
  let ControlledTestSessionModel: typeof ControlledTestSession;

  // Original env vars
  let originalDiscWeb1Enabled: string | undefined;
  let originalDiscWeb1DEnabled: string | undefined;

  beforeAll(async () => {
    app = getTestApp();
    sequelize = getTestDb();
    await sequelize.authenticate();

    ProjectModel = sequelize.models.Project as typeof Project;
    ActorModel = sequelize.models.Actor as typeof Actor;
    DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;
    ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;
  });

  beforeEach(async () => {
    // Save original env vars
    originalDiscWeb1Enabled = process.env.DISC_WEB1_ENABLED;
    originalDiscWeb1DEnabled = process.env.DISC_WEB1D_ENABLED;

    // Enable both feature gates for most tests
    process.env.DISC_WEB1_ENABLED = 'true';
    process.env.DISC_WEB1D_ENABLED = 'true';

    await truncateAll();

    const OrganizationModel = sequelize.models.Organization as typeof Organization;

    // Get test org
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    // Create actors
    creatorActor = await ActorModel.create({
      display_name: 'Creator',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    creatorPublicId = (creatorActor as any).public_id;

    otherActor = await ActorModel.create({
      display_name: 'Other',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    otherPublicId = (otherActor as any).public_id;

    // Create projects
    testProject = await ProjectModel.create({
      name: 'M10 Test Project',
      slug: `m10-test-${Date.now()}`,
      created_by: creatorPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    projectPublicId = (testProject as any).public_id;
    projectId = testProject.id;

    project2 = await ProjectModel.create({
      name: 'M10 Test Project 2',
      slug: `m10-test-2-${Date.now()}`,
      created_by: otherPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    project2PublicId = (project2 as any).public_id;
    project2Id = project2.id;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalDiscWeb1Enabled === undefined) {
      delete process.env.DISC_WEB1_ENABLED;
    } else {
      process.env.DISC_WEB1_ENABLED = originalDiscWeb1Enabled;
    }
    if (originalDiscWeb1DEnabled === undefined) {
      delete process.env.DISC_WEB1D_ENABLED;
    } else {
      process.env.DISC_WEB1D_ENABLED = originalDiscWeb1DEnabled;
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // Helper to create unbound session via API service
  async function createUnboundSession(actorId: number, projId: number): Promise<ControlledTestSession> {
    const result = await createSessionForApi({
      actorId,
      projectId: projId,
      idempotencyKey: randomUUID(),
      maxRequests: 4,
      maxInputTokens: 40000,
      maxOutputTokens: 16384,
    });
    return result.session;
  }

  // Helper to create bound session
  async function createBoundSession(actorId: number, projId: number): Promise<{
    session: ControlledTestSession;
    run: DiscoveryRun;
  }> {
    const run = await DiscoveryRunModel.create({
      project_id: projId,
      actor_id: actorId,
      discovery_type: 'desk_research',
      topic: `m10-test-${Date.now()}`,
      topic_slug: `m10-test-${Date.now()}`,
      source_intent: null,
      status: 'pending',
      is_controlled: true,
      created_by_identity: 'test:m10',
    } as CreationAttributes<DiscoveryRun>) as DiscoveryRun;

    const session = await ControlledTestSessionModel.create({
      max_requests: 10,
      max_input_tokens: 50000,
      max_output_tokens: 20000,
      created_by_actor_id: actorId,
      project_id: projId,
      discovery_run_id: run.id,
      status: 'active',
    } as CreationAttributes<ControlledTestSession>) as ControlledTestSession;

    return { session, run };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNBOUND SESSION CANCELLATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[UNBOUND] Unbound session cancellation', () => {
    it('creator successfully cancels unbound session', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);

      const result = await cancelControlledSessionFromApi(
        session.public_id,
        projectId,
        creatorActor.id,
        'Test cancellation',
      );

      expect(result.status).toBe('cancelled');
      expect(result.idempotent).toBe(false);
      expect(result.cancellationReason).toBe('Test cancellation');
      expect(result.boundRunPublicId).toBeNull();
      expect(result.boundRunStatus).toBeNull();

      // Verify session state in database
      const updated = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(updated.status).toBe('cancelled');
      expect(updated.cancelled_at).not.toBeNull();
      expect(updated.cancellation_reason).toBe('Test cancellation');
    });

    it('non-creator cannot cancel unbound session', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);

      await expect(
        cancelControlledSessionFromApi(
          session.public_id,
          projectId,
          otherActor.id,
          'Unauthorized cancellation',
        ),
      ).rejects.toThrow(SessionActorMismatchError);

      // Verify session still active
      const updated = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(updated.status).toBe('active');
    });

    it('wrong project cannot cancel unbound session', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);

      await expect(
        cancelControlledSessionFromApi(
          session.public_id,
          project2Id,  // Wrong project
          creatorActor.id,
          'Wrong project cancellation',
        ),
      ).rejects.toThrow(SessionNotFoundError);

      // Verify session still active
      const updated = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(updated.status).toBe('active');
    });

    it('repeated cancellation is idempotent for unbound session', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);

      // First cancellation
      const first = await cancelControlledSessionFromApi(
        session.public_id,
        projectId,
        creatorActor.id,
        'First cancel',
      );
      expect(first.idempotent).toBe(false);

      // Second cancellation - idempotent
      const second = await cancelControlledSessionFromApi(
        session.public_id,
        projectId,
        creatorActor.id,
        'Second cancel',
      );
      expect(second.idempotent).toBe(true);
      expect(second.cancellationReason).toBe('First cancel'); // Original preserved
    });

    it('new session creation succeeds after unbound cancellation', async () => {
      // Create and cancel first session
      const session1 = await createUnboundSession(creatorActor.id, projectId);
      await cancelControlledSessionFromApi(
        session1.public_id,
        projectId,
        creatorActor.id,
        'Cleanup',
      );

      // Create new session - should succeed
      const session2 = await createUnboundSession(creatorActor.id, projectId);
      expect(session2.status).toBe('active');
      expect(session2.id).not.toBe(session1.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE GATE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[FEATURE_GATE] Feature gates for unbound cancellation', () => {
    it('returns 503 when DISC_WEB1_ENABLED is not set', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);
      delete process.env.DISC_WEB1_ENABLED;

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({ reason: 'Test' })
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });

    it('returns 503 when DISC_WEB1D_ENABLED is not set', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);
      delete process.env.DISC_WEB1D_ENABLED;

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({ reason: 'Test' })
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[HTTP] HTTP endpoint for unbound cancellation', () => {
    it('POST /cancel succeeds for unbound session via HTTP', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({ reason: 'HTTP cancellation' })
        .expect(200);

      expect(res.body.data.status).toBe('cancelled');
      expect(res.body.data.idempotent).toBe(false);
      expect(res.body.data.boundRunPublicId).toBeNull();
      expect(res.body.data.boundRunStatus).toBeNull();
    });

    it('POST /cancel returns 403 for non-creator via HTTP', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', otherPublicId)
        .send({ reason: 'Unauthorized' })
        .expect(403);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_ACTOR_MISMATCH');
    });

    it('POST /cancel returns 404 for wrong project via HTTP', async () => {
      const session = await createUnboundSession(creatorActor.id, projectId);

      const res = await request(app)
        .post(`/api/v1/projects/${project2PublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({ reason: 'Wrong project' })
        .expect(404);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RACE CONDITION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[RACE] Cancellation racing with run binding', () => {
    it('cancellation after binding succeeds via bound path', async () => {
      // Create unbound session
      const session = await createUnboundSession(creatorActor.id, projectId);

      // Create run and bind
      const run = await DiscoveryRunModel.create({
        project_id: projectId,
        actor_id: creatorActor.id,
        discovery_type: 'desk_research',
        topic: `m10-race-${Date.now()}`,
        topic_slug: `m10-race-${Date.now()}`,
        source_intent: null,
        status: 'pending',
        is_controlled: true,
        created_by_identity: 'test:m10-race',
      } as CreationAttributes<DiscoveryRun>) as DiscoveryRun;

      await bindRunToSession(session.id, run.id, projectId);

      // Cancel - should now go through bound path
      const result = await cancelControlledSessionFromApi(
        session.public_id,
        projectId,
        creatorActor.id,
        'Cancel after binding',
      );

      expect(result.status).toBe('cancelled');
      expect(result.boundRunPublicId).toBe(run.public_id);
      expect(result.boundRunStatus).toBe('failed');

      // Verify run was failed
      const updatedRun = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
      expect(updatedRun.status).toBe('failed');
      expect(updatedRun.failure_code).toBe('SESSION_CANCELLED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REGRESSION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[REGRESSION] Bound session behavior unchanged', () => {
    it('bound session cancellation still fails pending run', async () => {
      const { session, run } = await createBoundSession(creatorActor.id, projectId);

      const result = await cancelControlledSessionFromApi(
        session.public_id,
        projectId,
        creatorActor.id,
        'Bound cancellation',
      );

      expect(result.status).toBe('cancelled');
      expect(result.boundRunPublicId).toBe(run.public_id);
      expect(result.boundRunStatus).toBe('failed');

      // Verify run was failed
      const updatedRun = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
      expect(updatedRun.status).toBe('failed');
      expect(updatedRun.failure_code).toBe('SESSION_CANCELLED');
    });

    it('bound session in wrong project still returns 404', async () => {
      const { session } = await createBoundSession(creatorActor.id, projectId);

      await expect(
        cancelControlledSessionFromApi(
          session.public_id,
          project2Id,  // Wrong project
          creatorActor.id,
          'Wrong project',
        ),
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('bound session with completed status returns 409', async () => {
      const { session } = await createBoundSession(creatorActor.id, projectId);

      // Complete the session
      await sequelize.query(
        `UPDATE controlled_test_sessions SET status = 'completed', completed_at = NOW() WHERE id = :id`,
        { replacements: { id: session.id } },
      );

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(409);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_NOT_ACTIVE');
    });
  });
});
