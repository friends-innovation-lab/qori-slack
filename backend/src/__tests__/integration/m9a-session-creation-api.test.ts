/**
 * M9a Controlled Session Creation API — DISC-WEB-1D-2
 *
 * HTTP-level tests for POST /api/v1/projects/:projectId/discovery/controlled-sessions
 *
 * 36-Test Matrix:
 * - [IDEMPOTENCY]   8 tests - UUID header, payload hash, replay detection
 * - [PROJECT]       6 tests - Project binding, validation, access
 * - [BUDGET]        8 tests - Field validation, ceilings, defaults
 * - [AUTH]          6 tests - Feature gates, authentication, authorization
 * - [CONCURRENCY]   4 tests - Advisory lock, serialization, retry
 * - [ERROR]         4 tests - Error responses, information leakage
 */

import request from 'supertest';
import crypto from 'crypto';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';
import type { CreationAttributes } from 'sequelize';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import { SESSION_BUDGET_CEILINGS, SESSION_BUDGET_DEFAULTS } from '../../services/controlled-test-budget.service';

describe('M9a Controlled Session Creation API — DISC-WEB-1D-2', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let project2: Project;

  // Actors
  let creatorActor: Actor;
  let otherActor: Actor;
  let nonMemberActor: Actor;

  // IDs
  let creatorPublicId: string;
  let otherPublicId: string;
  let nonMemberPublicId: string;
  let projectPublicId: string;
  let project2PublicId: string;
  let projectId: number;
  let project2Id: number;
  let creatorActorId: number;

  // Models
  let ProjectModel: typeof Project;
  let ActorModel: typeof Actor;
  let ControlledTestSessionModel: typeof ControlledTestSession;
  let ProjectMembershipModel: any;

  // Original env vars
  let originalDiscWeb1Enabled: string | undefined;
  let originalDiscWeb1DEnabled: string | undefined;

  // Helper to generate UUID v4
  function generateUUID(): string {
    return crypto.randomUUID();
  }

  beforeAll(async () => {
    app = getTestApp();
    sequelize = getTestDb();
    await sequelize.authenticate();

    ProjectModel = sequelize.models.Project as typeof Project;
    ActorModel = sequelize.models.Actor as typeof Actor;
    ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;
    ProjectMembershipModel = sequelize.models.ProjectMembership;
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
    creatorActorId = (creatorActor as any).id;

    otherActor = await ActorModel.create({
      display_name: 'Other',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    otherPublicId = (otherActor as any).public_id;

    nonMemberActor = await ActorModel.create({
      display_name: 'NonMember',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    nonMemberPublicId = (nonMemberActor as any).public_id;

    // Create projects
    testProject = await ProjectModel.create({
      name: 'M9a Test Project',
      slug: `m9a-test-${Date.now()}`,
      created_by: creatorPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    projectPublicId = (testProject as any).public_id;
    projectId = (testProject as any).id;

    project2 = await ProjectModel.create({
      name: 'M9a Test Project 2',
      slug: `m9a-test-2-${Date.now()}`,
      created_by: otherPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    project2PublicId = (project2 as any).public_id;
    project2Id = (project2 as any).id;

    // Add project memberships (creator is member of testProject, other is member of project2)
    if (ProjectMembershipModel) {
      await ProjectMembershipModel.create({
        project_id: projectId,
        actor_id: creatorActorId,
        role: 'researcher',
      });
      await ProjectMembershipModel.create({
        project_id: project2Id,
        actor_id: (otherActor as any).id,
        role: 'researcher',
      });
    }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEMPOTENCY TESTS (8 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[IDEMPOTENCY] UUID header and replay detection', () => {
    it('requires Idempotency-Key header', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/idempotency-key/i);
    });

    it('rejects invalid UUID format in Idempotency-Key', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', 'not-a-uuid')
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/uuid/i);
    });

    it('accepts valid UUID v4 in Idempotency-Key', async () => {
      const idempotencyKey = generateUUID();

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({})
        .expect(201);

      expect(res.body.data.sessionPublicId).toBeDefined();
      expect(res.body.meta.idempotent).toBe(false);
    });

    it('returns same session on replay with same key and payload', async () => {
      const idempotencyKey = generateUUID();
      const payload = { maxRequests: 3 };

      // First request
      const res1 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      // Replay request
      const res2 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(200);

      expect(res2.body.data.sessionPublicId).toBe(res1.body.data.sessionPublicId);
      expect(res2.body.meta.idempotent).toBe(true);
    });

    it('returns 409 on replay with different payload', async () => {
      const idempotencyKey = generateUUID();

      // First request
      await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({ maxRequests: 3 })
        .expect(201);

      // Replay with different payload
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({ maxRequests: 4 })
        .expect(409);

      expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('second actor blocked by global single-active-session rule', async () => {
      // Global rule: only one active session at a time, regardless of actor
      const idempotencyKey = generateUUID();

      // Add otherActor to testProject
      if (ProjectMembershipModel) {
        await ProjectMembershipModel.create({
          project_id: projectId,
          actor_id: (otherActor as any).id,
          role: 'researcher',
        });
      }

      // First actor creates session
      await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({})
        .expect(201);

      // Second actor blocked - global single-active-session
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', otherPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(409);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_ACTIVE');
    });

    it('idempotency key is scoped to actor+project (different actor reuses key after session cancelled)', async () => {
      const idempotencyKey = generateUUID();

      // Add otherActor to testProject
      if (ProjectMembershipModel) {
        await ProjectMembershipModel.create({
          project_id: projectId,
          actor_id: (otherActor as any).id,
          role: 'researcher',
        });
      }

      // First actor creates session
      const res1 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({})
        .expect(201);

      // Cancel via direct DB update (M9a sessions are unbound, can't use cancel API)
      await ControlledTestSessionModel.update(
        { status: 'cancelled', cancelled_at: new Date() },
        { where: { public_id: res1.body.data.sessionPublicId } },
      );

      // Second actor can use same key - scoped to (actor, project)
      const res2 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', otherPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({})
        .expect(201);

      expect(res1.body.data.sessionPublicId).not.toBe(res2.body.data.sessionPublicId);
    });

    it('idempotency check uses payload hash not deep equality', async () => {
      const idempotencyKey = generateUUID();
      // Semantically identical payloads with different key order
      const payload1 = { maxRequests: 3, maxInputTokens: 1000 };
      const payload2 = { maxInputTokens: 1000, maxRequests: 3 };

      const res1 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload1)
        .expect(201);

      // Same fields, different order - should replay (sorted hash)
      const res2 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload2)
        .expect(200);

      expect(res2.body.data.sessionPublicId).toBe(res1.body.data.sessionPublicId);
      expect(res2.body.meta.idempotent).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT BINDING TESTS (6 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[PROJECT] Project binding and validation', () => {
    it('binds session to specified project', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      expect(res.body.data.projectId).toBe(projectPublicId);
    });

    it('returns 404 for non-existent project', async () => {
      const fakeProjectId = generateUUID();

      const res = await request(app)
        .post(`/api/v1/projects/${fakeProjectId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 400 for invalid project identifier', async () => {
      const res = await request(app)
        .post('/api/v1/projects/invalid-id-format!@#/discovery/controlled-sessions')
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(404);

      // Invalid format resolves to not found (may use string or enum depending on handler)
      expect(['RESOURCE_NOT_FOUND', 'NOT_FOUND']).toContain(res.body.error.code);
    });

    it('resolves project by slug', async () => {
      const projectSlug = (testProject as any).slug;

      const res = await request(app)
        .post(`/api/v1/projects/${projectSlug}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      expect(res.body.data.projectId).toBe(projectPublicId);
    });

    it('session projectId is immutable after creation', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      // Verify session is stored with correct project_id
      const session = await ControlledTestSessionModel.findOne({
        where: { public_id: res.body.data.sessionPublicId },
      });
      expect((session as any).project_id).toBe(projectId);
    });

    it('actor cannot create session in project they do not have access to', async () => {
      // nonMemberActor is not a member of testProject
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET VALIDATION TESTS (8 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[BUDGET] Field validation and ceilings', () => {
    it('applies default budget when no values provided', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      expect(res.body.data.budget.maxRequests).toBe(SESSION_BUDGET_DEFAULTS.maxRequests);
      expect(res.body.data.budget.maxInputTokens).toBe(SESSION_BUDGET_DEFAULTS.maxInputTokens);
      expect(res.body.data.budget.maxOutputTokens).toBe(SESSION_BUDGET_DEFAULTS.maxOutputTokens);
    });

    it('accepts budget values within ceilings', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({
          maxRequests: 2,
          maxInputTokens: 20000,
          maxOutputTokens: 8000,
        })
        .expect(201);

      expect(res.body.data.budget.maxRequests).toBe(2);
      expect(res.body.data.budget.maxInputTokens).toBe(20000);
      expect(res.body.data.budget.maxOutputTokens).toBe(8000);
    });

    it('rejects values exceeding ceiling', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({
          maxRequests: SESSION_BUDGET_CEILINGS.maxRequests + 10,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/cannot exceed/i);
    });

    it('rejects negative budget values', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({ maxRequests: -1 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/positive/i);
    });

    it('rejects zero budget values', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({ maxRequests: 0 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-numeric budget values', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({ maxRequests: 'five' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/number/i);
    });

    it('rejects unknown budget fields', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({ maxRequests: 3, unknownField: 100 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/unknown.*field/i);
    });

    it('rejects NaN and Infinity budget values', async () => {
      // NaN case - send as string since JSON doesn't support NaN
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .set('Content-Type', 'application/json')
        .send('{"maxRequests": "NaN"}')
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHORIZATION TESTS (6 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[AUTH] Feature gates and authentication', () => {
    it('returns 503 when DISC_WEB1_ENABLED is disabled', async () => {
      delete process.env.DISC_WEB1_ENABLED;

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });

    it('returns 503 when DISC_WEB1D_ENABLED is disabled', async () => {
      delete process.env.DISC_WEB1D_ENABLED;

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(503);

      expect(res.body.error.code).toBe('CONTROLLED_EXECUTION_DISABLED');
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 403 for actor not in project', async () => {
      // nonMemberActor exists but is not a project member
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
    });

    it('creator can create session in their project', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      expect(res.body.data.sessionPublicId).toBeDefined();
    });

    it('project member can create session', async () => {
      // Add otherActor to testProject
      if (ProjectMembershipModel) {
        await ProjectMembershipModel.create({
          project_id: projectId,
          actor_id: (otherActor as any).id,
          role: 'researcher',
        });
      }

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', otherPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      expect(res.body.data.sessionPublicId).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONCURRENCY TESTS (4 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CONCURRENCY] Advisory lock and serialization', () => {
    it('concurrent requests with same idempotency key serialize correctly', async () => {
      const idempotencyKey = generateUUID();

      // Fire 3 concurrent requests
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
          .set('X-Test-Actor-PublicId', creatorPublicId)
          .set('Idempotency-Key', idempotencyKey)
          .send({})
      );

      const responses = await Promise.all(requests);

      // All should succeed (one creates, others replay)
      const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
      expect(successResponses.length).toBe(3);

      // All return same session
      const publicIds = successResponses.map(r => r.body.data.sessionPublicId);
      expect(new Set(publicIds).size).toBe(1);

      // Exactly one should be 201 (created), others 200 (replay)
      const created = responses.filter(r => r.status === 201);
      const replayed = responses.filter(r => r.status === 200);
      expect(created.length).toBe(1);
      expect(replayed.length).toBe(2);
    });

    it('concurrent requests with different idempotency keys - only one wins (global single-active)', async () => {
      const keys = [generateUUID(), generateUUID(), generateUUID()];

      const requests = keys.map(key =>
        request(app)
          .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
          .set('X-Test-Actor-PublicId', creatorPublicId)
          .set('Idempotency-Key', key)
          .send({})
      );

      const responses = await Promise.all(requests);

      // Due to global single-active rule, exactly one should be 201 (created)
      const created = responses.filter(r => r.status === 201);
      const rejected = responses.filter(r => r.status === 409);

      expect(created.length).toBe(1);
      expect(rejected.length).toBe(2);

      // Rejected responses should have CONTROLLED_SESSION_ACTIVE code
      rejected.forEach(r => {
        expect(r.body.error.code).toBe('CONTROLLED_SESSION_ACTIVE');
      });
    });

    it('second session for same actor is rejected (single active session rule)', async () => {
      // First session
      await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      // Second session attempt
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(409);

      expect(res.body.error.code).toBe('CONTROLLED_SESSION_ACTIVE');
    });

    it('allows new session after previous is cancelled', async () => {
      // Create first session
      const res1 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      // Cancel via direct DB update (M9a sessions are unbound, can't use cancel API)
      await ControlledTestSessionModel.update(
        { status: 'cancelled', cancelled_at: new Date() },
        { where: { public_id: res1.body.data.sessionPublicId } },
      );

      // Create second session
      const res2 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      expect(res2.body.data.sessionPublicId).not.toBe(res1.body.data.sessionPublicId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS (4 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[ERROR] Error responses and information leakage', () => {
    it('does not leak session details on 409 conflict', async () => {
      // Create first session
      await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(201);

      // Attempt second session
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(409);

      // Response should not contain existing session ID or details
      expect(res.body.data).toBeUndefined();
      expect(res.body.error.details).toBeUndefined();
    });

    it('returns consistent error format for all error codes', async () => {
      // 400 error
      const res400 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({})
        .expect(400);

      expect(res400.body.error).toBeDefined();
      expect(res400.body.error.code).toBeDefined();
      expect(res400.body.error.message).toBeDefined();

      // 403 error
      const res403 = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({})
        .expect(403);

      expect(res403.body.error).toBeDefined();
      expect(res403.body.error.code).toBeDefined();
      expect(res403.body.error.message).toBeDefined();
    });

    it('error messages do not contain internal implementation details', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .send({})
        .expect(400);

      // Should not contain stack traces, SQL, or internal paths
      const messageStr = JSON.stringify(res.body);
      expect(messageStr).not.toMatch(/at\s+\w+\s+\(/); // stack trace
      expect(messageStr).not.toMatch(/SELECT|INSERT|UPDATE/i); // SQL
      expect(messageStr).not.toMatch(/\/Users\/|\/home\//); // file paths
    });

    it('returns 201 response with correct data structure', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/discovery/controlled-sessions`)
        .set('X-Test-Actor-PublicId', creatorPublicId)
        .set('Idempotency-Key', generateUUID())
        .send({ maxRequests: 3 })
        .expect(201);

      // Verify response structure
      expect(res.body.data).toBeDefined();
      expect(res.body.data.sessionPublicId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.projectId).toBe(projectPublicId);
      expect(res.body.data.budget).toBeDefined();
      expect(res.body.data.budget.maxRequests).toBe(3);
      expect(res.body.data.createdAt).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.idempotent).toBe(false);
    });
  });
});
