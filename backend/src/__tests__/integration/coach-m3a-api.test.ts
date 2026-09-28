/**
 * Coach M3A Workspace Coaching Rail API Integration Tests
 *
 * HTTP-level integration tests for the Coaching REST API.
 * Tests all 3 endpoints with real database state.
 *
 * M3A Verification Matrix:
 * - [AUTH]        401 without auth headers
 * - [AUTHZ]       403 for non-collaborators
 * - [LIST]        GET /api/v1/artifacts/:artifactPublicId/coaching
 * - [CREATE]      POST /api/v1/artifacts/:artifactPublicId/coaching
 * - [DETAIL]      GET /api/v1/coaching/runs/:runId
 * - [PUBLIC_ID]   No internal IDs in any response JSON
 * - [ISOLATION]   Coaching operations don't alter artifacts/approval/GitHub
 * - [SECURITY]    No worker metadata, usage/cost, or raw diagnostics exposed
 */

import request from 'supertest';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';

// Models
import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { ResearchStudy } from '../../database/models/research_study';
import type { ResearchArtifact } from '../../database/models/research_artifact';
import type { Actor } from '../../database/models/actor';
import type { ArtifactSection } from '../../database/models/artifact_section';
import type { CoachingRun } from '../../database/models/coaching_run';

describe('Coach M3A Workspace Coaching Rail API', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let testStudy: ResearchStudy;
  let testArtifact: ResearchArtifact;
  let testActor: Actor;
  let otherActor: Actor; // Collaborator
  let outsiderActor: Actor; // Not a project member
  let ownerActor: Actor; // Project owner

  // Public IDs for API calls
  let artifactPublicId: string;
  let actorPublicId: string;
  let otherActorPublicId: string;
  let outsiderActorPublicId: string;
  let ownerActorPublicId: string;

  beforeAll(() => {
    app = getTestApp();
    sequelize = getTestDb();
  });

  beforeEach(async () => {
    await truncateAll();

    const OrganizationModel = sequelize.models.Organization as typeof Organization;
    const ProjectModel = sequelize.models.Project as typeof Project;
    const StudyModel = sequelize.models.ResearchStudy as typeof ResearchStudy;
    const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
    const ActorModel = sequelize.models.Actor as typeof Actor;
    const ArtifactSectionModel = sequelize.models.ArtifactSection as typeof ArtifactSection;
    const ProjectMembershipModel = sequelize.models.ProjectMembership;

    // Get test organization (created by truncateAll)
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    // Create test actors
    testActor = await ActorModel.create({
      display_name: 'Test Researcher',
      organization_id: testOrg.id,
    });
    actorPublicId = testActor.public_id;

    otherActor = await ActorModel.create({
      display_name: 'Other Collaborator',
      organization_id: testOrg.id,
    });
    otherActorPublicId = otherActor.public_id;

    outsiderActor = await ActorModel.create({
      display_name: 'Outsider',
      organization_id: testOrg.id,
    });
    outsiderActorPublicId = outsiderActor.public_id;

    ownerActor = await ActorModel.create({
      display_name: 'Project Owner',
      organization_id: testOrg.id,
    });
    ownerActorPublicId = ownerActor.public_id;

    // Create test project
    testProject = await ProjectModel.create({
      name: 'Test Project',
      slug: 'test-project',
      created_by: ownerActorPublicId,
      organization_id: testOrg.id,
    });

    // Add actors as project members (NOT outsider)
    await ProjectMembershipModel.create({
      project_id: testProject.id,
      actor_id: testActor.id,
      role: 'researcher',
    });
    await ProjectMembershipModel.create({
      project_id: testProject.id,
      actor_id: otherActor.id,
      role: 'researcher',
    });
    await ProjectMembershipModel.create({
      project_id: testProject.id,
      actor_id: ownerActor.id,
      role: 'owner',
    });

    // Create test study
    testStudy = await StudyModel.create({
      name: 'Test Study',
      slug: 'test-study',
      channel_name: 'test-channel',
      created_by: actorPublicId,
      researcher_name: 'Test Researcher',
      researcher_email: 'test@example.com',
      path: 'test-study',
      project_id: testProject.id,
    });

    // Create test artifact (Brief type)
    testArtifact = await ArtifactModel.create({
      study_id: testStudy.id,
      project_id: testProject.id,
      artifact_type: 'brief',
      template_id: 'research_brief',
      template_version: '1.0.0',
      repo: 'test-repo',
      semantic_key: 'test-study:brief:v1',
      created_by: actorPublicId,
      content_version: 1,
    });
    artifactPublicId = testArtifact.public_id;

    // Create artifact sections (required for coaching run snapshot)
    await ArtifactSectionModel.create({
      artifact_id: testArtifact.id,
      section_key: 'summary',
      content_type: 'prose',
      content: 'Test summary content',
    });
    await ArtifactSectionModel.create({
      artifact_id: testArtifact.id,
      section_key: 'problem_statement',
      content_type: 'prose',
      content: 'Test problem statement',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Authentication', () => {
    it('[AUTH] returns 401 for list without auth headers', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('[AUTH] returns 401 for create without auth headers', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .send({ review_scope: 'artifact' })
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('[AUTH] accepts X-Test-Actor-PublicId header in test env', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHORIZATION MATRIX
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Authorization Matrix', () => {
    describe('LIST authorization', () => {
      it('collaborator can list coaching history', async () => {
        await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);
      });

      it('authenticated non-collaborator gets 403', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId)
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });
    });

    describe('CREATE authorization', () => {
      it('collaborator can create coaching run', async () => {
        const res = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ review_scope: 'artifact' })
          .expect(201);

        expect(res.body.data.run).toBeDefined();
        expect(res.body.data.run.status).toBe('pending');
      });

      it('authenticated non-collaborator gets 403 on create', async () => {
        const res = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId)
          .send({ review_scope: 'artifact' })
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });
    });

    describe('DETAIL authorization', () => {
      let runId: string;

      beforeEach(async () => {
        // Create a run first
        const res = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ review_scope: 'artifact' })
          .expect(201);

        runId = res.body.data.run.id;
      });

      it('collaborator can access run detail', async () => {
        await request(app)
          .get(`/api/v1/coaching/runs/${runId}`)
          .set('X-Test-Actor-PublicId', otherActorPublicId)
          .expect(200);
      });

      it('authenticated non-collaborator gets 403 on detail', async () => {
        const res = await request(app)
          .get(`/api/v1/coaching/runs/${runId}`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId)
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST COACHING HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/artifacts/:artifactPublicId/coaching', () => {
    it('returns empty history when no runs exist', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.runs).toEqual([]);
      expect(res.body.data.artifact_public_id).toBe(artifactPublicId);
      expect(res.body.data.has_more).toBe(false);
    });

    it('returns runs in newest-first order', async () => {
      // Create multiple runs
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'completed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        requested_at: new Date('2024-01-01T10:00:00Z'),
        completed_at: new Date('2024-01-01T10:01:00Z'),
      });

      await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'completed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        requested_at: new Date('2024-01-02T10:00:00Z'),
        completed_at: new Date('2024-01-02T10:01:00Z'),
      });

      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.runs.length).toBe(2);
      // Newest first
      const firstDate = new Date(res.body.data.runs[0].requested_at);
      const secondDate = new Date(res.body.data.runs[1].requested_at);
      expect(firstDate.getTime()).toBeGreaterThan(secondDate.getTime());
    });

    it('respects limit parameter', async () => {
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      // Create 5 runs
      for (let i = 0; i < 5; i++) {
        await CoachingRunModel.create({
          study_id: testStudy.id,
          artifact_id: testArtifact.id,
          artifact_type: 'brief',
          content_version: 1,
          review_scope: 'artifact',
          status: 'completed',
          requested_by: testActor.id,
          coaching_contract_version: '1.0.0',
          prompt_template_version: '1.0.0',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          requested_at: new Date(`2024-01-0${i + 1}T10:00:00Z`),
          completed_at: new Date(`2024-01-0${i + 1}T10:01:00Z`),
        });
      }

      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching?limit=3`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.runs.length).toBe(3);
      expect(res.body.data.has_more).toBe(true);
    });

    it('validates limit parameter range', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching?limit=200`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('filters by status', async () => {
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'completed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      });

      await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'failed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        failure_code: 'PROVIDER_TIMEOUT',
      });

      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching?status=completed`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.runs.length).toBe(1);
      expect(res.body.data.runs[0].status).toBe('completed');
    });

    it('validates status parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching?status=invalid`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('includes is_current_version indicator', async () => {
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      // Create run for current version (1)
      await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1, // Matches artifact content_version
        review_scope: 'artifact',
        status: 'completed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      });

      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.runs[0].is_current_version).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE COACHING RUN
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/artifacts/:artifactPublicId/coaching', () => {
    it('creates pending run and returns immediately', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      expect(res.body.data.run).toBeDefined();
      expect(res.body.data.run.id).toBeDefined();
      expect(res.body.data.run.status).toBe('pending');
      expect(res.body.data.run.artifact_public_id).toBe(artifactPublicId);
      expect(res.body.data.run.review_scope).toBe('artifact');
    });

    it('captures current content_version', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      expect(res.body.data.run.content_version).toBe(1);
      expect(res.body.data.run.is_current_version).toBe(true);
    });

    it('returns 409 when user already has active run for same version', async () => {
      // Create first run
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      // Try to create second run
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(409);

      expect(res.body.error.code).toBe('COACH_RUN_ALREADY_ACTIVE');
    });

    it('allows different collaborators to create runs for same version', async () => {
      // First collaborator creates a run
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      // Second collaborator can also create a run
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', otherActorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);
    });

    it('rejects section-scope in M3A (not implemented)', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'section' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('artifact-level');
    });

    it('returns 404 for non-existent artifact', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/v1/artifacts/${fakeId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET RUN DETAIL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/coaching/runs/:runId', () => {
    let runId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      runId = res.body.data.run.id;
    });

    it('returns run detail with items and context', async () => {
      const res = await request(app)
        .get(`/api/v1/coaching/runs/${runId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.run.id).toBe(runId);
      expect(res.body.data.run.items).toBeDefined();
      expect(res.body.data.run.context).toBeDefined();
      expect(Array.isArray(res.body.data.run.items)).toBe(true);
      expect(Array.isArray(res.body.data.run.context)).toBe(true);
    });

    it('returns 404 for non-existent run', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/coaching/runs/${fakeId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('sanitizes failure message for failed runs', async () => {
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      const failedRun = await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'failed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        failure_code: 'PROVIDER_TIMEOUT',
        failure_diagnostic: 'Internal stack trace that should not be exposed',
      });

      const res = await request(app)
        .get(`/api/v1/coaching/runs/${failedRun.id}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.run.failure).toBeDefined();
      expect(res.body.data.run.failure.code).toBe('PROVIDER_TIMEOUT');
      expect(res.body.data.run.failure.message).toContain('took too long');
      // Should NOT contain raw diagnostic
      expect(res.body.data.run.failure.message).not.toContain('stack trace');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC ID BOUNDARY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Public ID Boundary', () => {
    it('[PUBLIC_ID] list response contains no internal numeric IDs', async () => {
      // Create a run first
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const json = JSON.stringify(res.body);

      // Check no internal IDs leaked
      expect(json).not.toContain(`"artifact_id":${testArtifact.id}`);
      expect(json).not.toContain(`"study_id":${testStudy.id}`);
      expect(json).not.toContain(`"requested_by":${testActor.id}`);

      // Verify public IDs are used
      const run = res.body.data.runs[0];
      expect(run.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(run.artifact_public_id).toBe(artifactPublicId);
      expect(run.requested_by.public_id).toBe(actorPublicId);
    });

    it('[PUBLIC_ID] detail response contains no internal numeric IDs', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      const runId = createRes.body.data.run.id;

      const res = await request(app)
        .get(`/api/v1/coaching/runs/${runId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const json = JSON.stringify(res.body);

      // Check no internal IDs leaked
      expect(json).not.toContain(`"artifact_id":${testArtifact.id}`);
      expect(json).not.toContain(`"study_id":${testStudy.id}`);
    });

    it('[SECURITY] does not expose worker metadata', async () => {
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      const run = await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'running',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        worker_id: 'worker-123',
        heartbeat_at: new Date(),
        claimed_at: new Date(),
      });

      const res = await request(app)
        .get(`/api/v1/coaching/runs/${run.id}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const json = JSON.stringify(res.body);

      // Should NOT expose worker metadata
      expect(json).not.toContain('worker_id');
      expect(json).not.toContain('worker-123');
      expect(json).not.toContain('heartbeat_at');
      expect(json).not.toContain('claimed_at');
    });

    it('[SECURITY] does not expose usage/cost metadata', async () => {
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      const run = await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'completed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        input_tokens: 1000,
        output_tokens: 500,
        total_tokens: 1500,
        estimated_cost: 0.05,
        actual_provider_cost: 0.045,
        latency_ms: 1500,
      });

      const res = await request(app)
        .get(`/api/v1/coaching/runs/${run.id}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const json = JSON.stringify(res.body);

      // Should NOT expose usage/cost metadata
      expect(json).not.toContain('input_tokens');
      expect(json).not.toContain('output_tokens');
      expect(json).not.toContain('total_tokens');
      expect(json).not.toContain('estimated_cost');
      expect(json).not.toContain('actual_provider_cost');
      expect(json).not.toContain('latency_ms');
    });

    it('[SECURITY] does not expose raw failure diagnostic', async () => {
      const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

      const run = await CoachingRunModel.create({
        study_id: testStudy.id,
        artifact_id: testArtifact.id,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'failed',
        requested_by: testActor.id,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        failure_code: 'GENERATION_FAILED',
        failure_diagnostic: 'Error at line 42: internal API error trace with secrets',
      });

      const res = await request(app)
        .get(`/api/v1/coaching/runs/${run.id}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const json = JSON.stringify(res.body);

      // Should NOT expose raw diagnostic
      expect(json).not.toContain('failure_diagnostic');
      expect(json).not.toContain('line 42');
      expect(json).not.toContain('secrets');

      // Should have sanitized failure info
      expect(res.body.data.run.failure.code).toBe('GENERATION_FAILED');
      expect(res.body.data.run.failure.message).toContain('could not be completed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CANONICAL ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Canonical Isolation', () => {
    it('[ISOLATION] creating coaching run does not modify artifact content_version', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
      const originalArtifact = await ArtifactModel.findByPk(testArtifact.id) as ResearchArtifact;
      const originalVersion = originalArtifact.content_version;

      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      await originalArtifact.reload();
      expect(originalArtifact.content_version).toBe(originalVersion);
    });

    it('[ISOLATION] creating coaching run does not modify artifact sections', async () => {
      const ArtifactSectionModel = sequelize.models.ArtifactSection as typeof ArtifactSection;
      const originalSections = await ArtifactSectionModel.findAll({
        where: { artifact_id: testArtifact.id },
        order: [['section_key', 'ASC']],
      }) as ArtifactSection[];
      const originalContents = originalSections.map(s => ({
        key: s.section_key,
        content: s.content,
        updated_at: s.updated_at,
      }));

      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      const afterSections = await ArtifactSectionModel.findAll({
        where: { artifact_id: testArtifact.id },
        order: [['section_key', 'ASC']],
      }) as ArtifactSection[];

      afterSections.forEach((s, i) => {
        expect(s.content).toBe(originalContents[i].content);
        expect(s.updated_at.getTime()).toBe(originalContents[i].updated_at.getTime());
      });
    });

    it('[ISOLATION] reading coaching history does not modify artifact', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id) as ResearchArtifact;
      const beforeUpdatedAt = beforeArtifact.updated_at;

      await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      await beforeArtifact.reload();
      expect(beforeArtifact.updated_at.getTime()).toBe(beforeUpdatedAt.getTime());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAN ARTIFACT SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Plan artifact coaching', () => {
    let planArtifact: ResearchArtifact;
    let planArtifactPublicId: string;

    beforeEach(async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
      const ArtifactSectionModel = sequelize.models.ArtifactSection as typeof ArtifactSection;

      planArtifact = await ArtifactModel.create({
        study_id: testStudy.id,
        project_id: testProject.id,
        artifact_type: 'plan',
        template_id: 'research_plan',
        template_version: '1.0.0',
        repo: 'test-repo',
        semantic_key: 'test-study:plan:v1',
        created_by: actorPublicId,
        content_version: 1,
      });
      planArtifactPublicId = planArtifact.public_id;

      // Create plan sections
      await ArtifactSectionModel.create({
        artifact_id: planArtifact.id,
        section_key: 'research_summary',
        content_type: 'prose',
        content: 'Test research summary',
      });
    });

    it('can create coaching run for Plan artifact', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      expect(res.body.data.run.artifact_type).toBe('plan');
    });

    it('can list coaching history for Plan artifact', async () => {
      await request(app)
        .post(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.runs.length).toBe(1);
      expect(res.body.data.runs[0].artifact_type).toBe('plan');
    });
  });
});
