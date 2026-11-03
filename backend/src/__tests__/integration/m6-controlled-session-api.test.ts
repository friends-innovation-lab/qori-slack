/**
 * M6 Controlled Session API HTTP Integration Tests — DISC-WEB-1D-2
 *
 * HTTP-level tests for controlled session admin endpoints.
 * Tests real Express routes with supertest, not just service layer.
 *
 * Verification Matrix:
 * - [FEATURE_GATE] 503 when DISC_WEB1_ENABLED or DISC_WEB1D_ENABLED disabled
 * - [AUTH]         401 without auth headers
 * - [CREATOR]      403 for non-creator actors
 * - [PROJECT]      404 for wrong project or unbound sessions
 * - [UUID]         400 for invalid UUID format
 * - [PAGINATION]   400 for invalid limit/offset
 * - [CANCEL]       200/409/idempotent for cancellation state machine
 */

import request from 'supertest';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';
import type { CreationAttributes } from 'sequelize';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';

describe('M6 Controlled Session API — DISC-WEB-1D-2', () => {
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
      name: 'M6 Test Project',
      slug: `m6-test-${Date.now()}`,
      created_by: creatorPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    projectPublicId = (testProject as any).public_id;

    project2 = await ProjectModel.create({
      name: 'M6 Test Project 2',
      slug: `m6-test-2-${Date.now()}`,
      created_by: otherPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    project2PublicId = (project2 as any).public_id;
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

  // Helper to create controlled run and bound session
  async function createBoundSession(actorId: number, projectId: number): Promise<{
    session: ControlledTestSession;
    run: DiscoveryRun;
  }> {
    const run = await DiscoveryRunModel.create({
      project_id: projectId,
      actor_id: actorId,
      discovery_type: 'desk_research',
      topic: `m6-http-${Date.now()}`,
      topic_slug: `m6-http-${Date.now()}`,
      source_intent: null,
      status: 'pending',
      is_controlled: true,
      created_by_identity: 'test:m6-http',
    } as CreationAttributes<DiscoveryRun>) as DiscoveryRun;

    const session = await ControlledTestSessionModel.create({
      max_requests: 10,
      max_input_tokens: 50000,
      max_output_tokens: 20000,
      created_by_actor_id: actorId,
      discovery_run_id: run.id,
      status: 'active',
    } as CreationAttributes<ControlledTestSession>) as ControlledTestSession;

    return { session, run };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE GATE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[FEATURE_GATE] Feature gates return 503', () => {
    it('returns 503 when DISC_WEB1_ENABLED is not set', async () => {
      delete process.env.DISC_WEB1_ENABLED;

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });

    it('returns 503 when DISC_WEB1_ENABLED is false', async () => {
      process.env.DISC_WEB1_ENABLED = 'false';

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });

    it('returns 503 when DISC_WEB1D_ENABLED is not set', async () => {
      delete process.env.DISC_WEB1D_ENABLED;

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });

    it('returns 503 when DISC_WEB1D_ENABLED is false', async () => {
      process.env.DISC_WEB1D_ENABLED = 'false';

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });

    it('returns 503 on cancel endpoint when gates disabled', async () => {
      delete process.env.DISC_WEB1_ENABLED;

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/00000000-0000-0000-0000-000000000000/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[AUTH] Authentication Required', () => {
    it('returns 401 without auth headers on GET /controlled-sessions', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on GET /controlled-sessions/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/00000000-0000-0000-0000-000000000000`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on GET /reservations', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/00000000-0000-0000-0000-000000000000/reservations`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on POST /cancel', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/00000000-0000-0000-0000-000000000000/cancel`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UUID VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[UUID] Session UUID Validation', () => {
    it('returns 400 for invalid UUID on GET /controlled-sessions/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/not-a-uuid`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid session identifier');
    });

    it('returns 400 for invalid UUID on POST /cancel', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/invalid/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGINATION VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[PAGINATION] Pagination validation', () => {
    it('returns 400 for negative offset on list', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions?offset=-1`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid offset');
    });

    it('returns 400 for negative offset on reservations', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/reservations?offset=-5`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('caps limit at 100', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions?limit=500`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(200);

      // Should succeed but cap at 100 (no sessions to return anyway)
      expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATOR AUTHORIZATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CREATOR] Creator-only authorization', () => {
    it('returns 403 when non-creator accesses session details', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}`)
        .set('X-Test-Actor-PublicId', otherPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_ACTOR_MISMATCH');
    });

    it('returns 403 when non-creator accesses reservations', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/reservations`)
        .set('X-Test-Actor-PublicId', otherPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_ACTOR_MISMATCH');
    });

    it('returns 403 when non-creator attempts cancellation', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', otherPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_ACTOR_MISMATCH');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT ISOLATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[PROJECT] Project isolation and unbound exclusion', () => {
    it('returns 404 for session bound to different project', async () => {
      // Create session in project2
      const { session } = await createBoundSession(creatorActor.id, project2.id);

      // Try to access via testProject
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_NOT_FOUND');
    });

    it('returns 404 for unbound session', async () => {
      // Create unbound session
      const session = await ControlledTestSessionModel.create({
        max_requests: 10,
        max_input_tokens: 50000,
        max_output_tokens: 20000,
        created_by_actor_id: creatorActor.id,
        discovery_run_id: null, // Unbound
        status: 'active',
      } as CreationAttributes<ControlledTestSession>) as ControlledTestSession;

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_NOT_FOUND');
    });

    it('excludes other creators sessions from list', async () => {
      // Create session for creator
      await createBoundSession(creatorActor.id, testProject.id);

      // Create session for other actor (need to complete creator's first due to single-active constraint)
      await sequelize.query(
        `UPDATE controlled_test_sessions SET status = 'completed', completed_at = NOW() WHERE created_by_actor_id = :actorId`,
        { replacements: { actorId: creatorActor.id } },
      );
      await createBoundSession(otherActor.id, testProject.id);

      // List as creator - should only see their session
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(200);

      // Creator should see their completed session, not other's active session
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('list excludes sessions from other projects', async () => {
      // Create session in project2
      await createBoundSession(creatorActor.id, project2.id);

      // List as creator in testProject - should be empty
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(200);

      expect(res.body.data.length).toBe(0);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESSFUL RESPONSE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[SUCCESS] Successful responses', () => {
    it('GET /controlled-sessions returns session list with pagination', async () => {
      const { session, run } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].publicId).toBe(session.public_id);
      expect(res.body.data[0].boundRunPublicId).toBe(run.public_id);
      expect(res.body.data[0].status).toBe('active');
      expect(res.body.data[0].budget).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(1);
    });

    it('GET /controlled-sessions/:id returns session details', async () => {
      const { session, run } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(200);

      expect(res.body.data.publicId).toBe(session.public_id);
      expect(res.body.data.boundRunPublicId).toBe(run.public_id);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.budget.maxRequests).toBe(10);
      expect(res.body.data.timestamps).toBeDefined();
    });

    it('GET /reservations returns empty list for new session', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/reservations`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCELLATION STATE MACHINE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CANCEL] Cancellation state machine', () => {
    it('cancels active session with pending run - returns 200', async () => {
      const { session, run } = await createBoundSession(creatorActor.id, testProject.id);

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({ reason: 'Test cancellation' })
        .expect(200);

      expect(res.body.data.status).toBe('cancelled');
      expect(res.body.data.idempotent).toBe(false);
      expect(res.body.data.cancellationReason).toBe('Test cancellation');
      expect(res.body.data.boundRunStatus).toBe('failed');

      // Verify run was failed in database
      const updatedRun = await DiscoveryRunModel.findByPk(run.id) as DiscoveryRun;
      expect(updatedRun.status).toBe('failed');
      expect(updatedRun.failure_code).toBe('SESSION_CANCELLED');
    });

    it('returns idempotent 200 for already cancelled session', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

      // First cancellation
      const first = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({ reason: 'First cancel' })
        .expect(200);

      expect(first.body.data.idempotent).toBe(false);

      // Second cancellation - idempotent
      const second = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({ reason: 'Second cancel' })
        .expect(200);

      expect(second.body.data.idempotent).toBe(true);
      expect(second.body.data.cancellationReason).toBe('First cancel'); // Original preserved
    });

    it('returns 409 for completed session', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

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
      expect(res.body.error.message).toContain('completed');
    });

    it('returns 409 for exhausted session', async () => {
      const { session } = await createBoundSession(creatorActor.id, testProject.id);

      // Exhaust the session
      await sequelize.query(
        `UPDATE controlled_test_sessions SET status = 'exhausted', exhausted_at = NOW() WHERE id = :id`,
        { replacements: { id: session.id } },
      );

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/${session.public_id}/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(409);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_NOT_ACTIVE');
      expect(res.body.error.message).toContain('exhausted');
    });

    it('returns 404 for non-existent session UUID', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions/00000000-0000-0000-0000-000000000000/cancel`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_NOT_FOUND');
    });
  });
});
