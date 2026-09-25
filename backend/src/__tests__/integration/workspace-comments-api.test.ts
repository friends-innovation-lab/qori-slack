/**
 * Workspace Comments API Integration Tests — CMT-4 Final API Gate
 *
 * HTTP-level integration tests for the Comments REST API.
 * Tests all 7 endpoints with real database state.
 *
 * CMT-4 Final Verification Matrix:
 * - [AUTH]        401 without auth headers
 * - [AUTHZ]       403 for non-collaborators, non-authors, cross-project
 * - [LIST]        GET /api/v1/artifacts/:artifactPublicId/comments
 * - [CREATE]      POST /api/v1/artifacts/:artifactPublicId/comments
 * - [DETAIL]      GET /api/v1/comments/threads/:threadId
 * - [REPLY]       POST /api/v1/comments/threads/:threadId/messages
 * - [EDIT]        PATCH /api/v1/comments/messages/:messageId
 * - [RESOLVE]     POST /api/v1/comments/threads/:threadId/resolve
 * - [REOPEN]      POST /api/v1/comments/threads/:threadId/reopen
 * - [PUBLIC_ID]   No internal IDs in any response JSON
 * - [PERMISSIONS] can_reply, can_resolve, can_reopen, can_edit present
 * - [ISOLATION]   Comments don't alter artifacts/approval/GitHub
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

describe('Workspace Comments API (CMT-4)', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let testStudy: ResearchStudy;
  let testArtifact: ResearchArtifact;
  let testActor: Actor;
  let otherActor: Actor; // Collaborator but not thread author
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
    const ProjectMembershipModel = sequelize.models.ProjectMembership;

    // Create test organization (already created by truncateAll, but get reference)
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    // Create test actor (will be thread author)
    testActor = await ActorModel.create({
      display_name: 'Test Researcher',
      organization_id: testOrg.id,
    });
    actorPublicId = testActor.public_id;

    // Create another collaborator (project member but not thread author)
    otherActor = await ActorModel.create({
      display_name: 'Other Collaborator',
      organization_id: testOrg.id,
    });
    otherActorPublicId = otherActor.public_id;

    // Create outsider (authenticated but NOT a project member)
    outsiderActor = await ActorModel.create({
      display_name: 'Outsider',
      organization_id: testOrg.id,
    });
    outsiderActorPublicId = outsiderActor.public_id;

    // Create owner actor
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
    // NOTE: outsiderActor is NOT added as a project member

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

    // Create test artifact (Brief type for section key validation)
    testArtifact = await ArtifactModel.create({
      study_id: testStudy.id,
      project_id: testProject.id,
      artifact_type: 'brief',
      template_id: 'research_brief',
      template_version: '1.0.0',
      repo: 'test-repo',
      semantic_key: 'test-study:brief:v1',
      created_by: actorPublicId,
    });
    artifactPublicId = testArtifact.public_id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Authentication', () => {
    it('[AUTH] returns 401 without auth headers', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('[AUTH] accepts X-Test-Actor-PublicId header in test env', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP AUTHORIZATION MATRIX
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Authorization Matrix', () => {
    // ─── LIST Authorization ─────────────────────────────────────────────────

    describe('LIST authorization', () => {
      it('collaborator can list comments', async () => {
        await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);
      });

      it('authenticated non-collaborator gets 403', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId)
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });
    });

    // ─── CREATE Authorization ───────────────────────────────────────────────

    describe('CREATE authorization', () => {
      it('collaborator can create thread', async () => {
        await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Test comment' })
          .expect(201);
      });

      it('authenticated non-collaborator gets 403', async () => {
        const res = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId)
          .send({ section_key: 'summary', body: 'Test comment' })
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });
    });

    // ─── DETAIL Authorization ───────────────────────────────────────────────

    describe('DETAIL authorization', () => {
      let threadId: string;

      beforeEach(async () => {
        const createRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Test comment' });
        threadId = createRes.body.data.thread.id;
      });

      it('collaborator can view thread detail', async () => {
        await request(app)
          .get(`/api/v1/comments/threads/${threadId}`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);
      });

      it('actor outside project gets 403/404 (anti-enumeration)', async () => {
        const res = await request(app)
          .get(`/api/v1/comments/threads/${threadId}`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId);

        // Either 403 or 404 acceptable for anti-enumeration
        expect([403, 404]).toContain(res.status);
      });
    });

    // ─── REPLY Authorization ────────────────────────────────────────────────

    describe('REPLY authorization', () => {
      let threadId: string;

      beforeEach(async () => {
        const createRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Test comment' });
        threadId = createRes.body.data.thread.id;
      });

      it('collaborator can reply to thread', async () => {
        await request(app)
          .post(`/api/v1/comments/threads/${threadId}/messages`)
          .set('X-Test-Actor-PublicId', otherActorPublicId)
          .send({ body: 'Reply from collaborator' })
          .expect(201);
      });

      it('authenticated non-collaborator gets 403', async () => {
        const res = await request(app)
          .post(`/api/v1/comments/threads/${threadId}/messages`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId)
          .send({ body: 'Reply from outsider' });

        // Either 403 or 404 acceptable for anti-enumeration
        expect([403, 404]).toContain(res.status);
      });
    });

    // ─── EDIT Authorization ─────────────────────────────────────────────────

    describe('EDIT authorization', () => {
      let threadId: string;
      let messageId: string;
      let messageUpdatedAt: string;

      beforeEach(async () => {
        const createRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Original text' });
        threadId = createRes.body.data.thread.id;
        messageId = createRes.body.data.thread.messages[0].id;
        messageUpdatedAt = createRes.body.data.thread.messages[0].updated_at;
      });

      it('message author can edit own message', async () => {
        await request(app)
          .patch(`/api/v1/comments/messages/${messageId}`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ body: 'Updated text', expected_updated_at: messageUpdatedAt })
          .expect(200);
      });

      it('another collaborator cannot edit someone else\'s message', async () => {
        const res = await request(app)
          .patch(`/api/v1/comments/messages/${messageId}`)
          .set('X-Test-Actor-PublicId', otherActorPublicId)
          .send({ body: 'Trying to edit', expected_updated_at: messageUpdatedAt })
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });

      it('actor outside project gets 403/404', async () => {
        const res = await request(app)
          .patch(`/api/v1/comments/messages/${messageId}`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId)
          .send({ body: 'Trying to edit', expected_updated_at: messageUpdatedAt });

        // Either 403 or 404 acceptable for anti-enumeration
        expect([403, 404]).toContain(res.status);
      });

      it('stale author edit returns 409 COMMENT_EDIT_CONFLICT', async () => {
        // First edit
        await request(app)
          .patch(`/api/v1/comments/messages/${messageId}`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ body: 'First update', expected_updated_at: messageUpdatedAt })
          .expect(200);

        // Second edit with stale timestamp
        const res = await request(app)
          .patch(`/api/v1/comments/messages/${messageId}`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ body: 'Stale update', expected_updated_at: messageUpdatedAt })
          .expect(409);

        expect(res.body.error.code).toBe('COMMENT_EDIT_CONFLICT');
      });
    });

    // ─── RESOLVE Authorization ──────────────────────────────────────────────

    describe('RESOLVE authorization', () => {
      let threadId: string;

      beforeEach(async () => {
        const createRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Test comment' });
        threadId = createRes.body.data.thread.id;
      });

      it('thread author can resolve', async () => {
        await request(app)
          .post(`/api/v1/comments/threads/${threadId}/resolve`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);
      });

      it('project owner can resolve', async () => {
        await request(app)
          .post(`/api/v1/comments/threads/${threadId}/resolve`)
          .set('X-Test-Actor-PublicId', ownerActorPublicId)
          .expect(200);
      });

      it('ordinary collaborator (not author) cannot resolve', async () => {
        const res = await request(app)
          .post(`/api/v1/comments/threads/${threadId}/resolve`)
          .set('X-Test-Actor-PublicId', otherActorPublicId)
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });

      it('actor outside project gets 403/404', async () => {
        const res = await request(app)
          .post(`/api/v1/comments/threads/${threadId}/resolve`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId);

        // Either 403 or 404 acceptable for anti-enumeration
        expect([403, 404]).toContain(res.status);
      });
    });

    // ─── REOPEN Authorization ───────────────────────────────────────────────

    describe('REOPEN authorization', () => {
      let threadId: string;

      beforeEach(async () => {
        // Create and resolve a thread
        const createRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Test comment' });
        threadId = createRes.body.data.thread.id;

        await request(app)
          .post(`/api/v1/comments/threads/${threadId}/resolve`)
          .set('X-Test-Actor-PublicId', actorPublicId);
      });

      it('thread author can reopen', async () => {
        await request(app)
          .post(`/api/v1/comments/threads/${threadId}/reopen`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);
      });

      it('project owner can reopen', async () => {
        await request(app)
          .post(`/api/v1/comments/threads/${threadId}/reopen`)
          .set('X-Test-Actor-PublicId', ownerActorPublicId)
          .expect(200);
      });

      it('ordinary collaborator (not author) cannot reopen', async () => {
        const res = await request(app)
          .post(`/api/v1/comments/threads/${threadId}/reopen`)
          .set('X-Test-Actor-PublicId', otherActorPublicId)
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });

      it('actor outside project gets 403/404', async () => {
        const res = await request(app)
          .post(`/api/v1/comments/threads/${threadId}/reopen`)
          .set('X-Test-Actor-PublicId', outsiderActorPublicId);

        // Either 403 or 404 acceptable for anti-enumeration
        expect([403, 404]).toContain(res.status);
      });
    });

    // ─── Cross-Project Access ───────────────────────────────────────────────

    describe('Cross-project access blocked', () => {
      let otherProject: Project;
      let otherProjectArtifact: ResearchArtifact;
      let otherProjectArtifactPublicId: string;

      beforeEach(async () => {
        const ProjectModel = sequelize.models.Project as typeof Project;
        const StudyModel = sequelize.models.ResearchStudy as typeof ResearchStudy;
        const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
        const ProjectMembershipModel = sequelize.models.ProjectMembership;

        // Create another project that testActor is NOT a member of
        otherProject = await ProjectModel.create({
          name: 'Other Project',
          slug: 'other-project',
          created_by: outsiderActorPublicId,
          organization_id: testOrg.id,
        });

        // Only outsider is member of other project
        await ProjectMembershipModel.create({
          project_id: otherProject.id,
          actor_id: outsiderActor.id,
          role: 'owner',
        });

        // Create study in other project
        const otherStudy = await StudyModel.create({
          name: 'Other Study',
          slug: 'other-study',
          channel_name: 'other-channel',
          created_by: outsiderActorPublicId,
          researcher_name: 'Outsider',
          researcher_email: 'outsider@example.com',
          path: 'other-study',
          project_id: otherProject.id,
        });

        // Create artifact in other project
        otherProjectArtifact = await ArtifactModel.create({
          study_id: otherStudy.id,
          project_id: otherProject.id,
          artifact_type: 'brief',
          template_id: 'research_brief',
          template_version: '1.0.0',
          repo: 'other-repo',
          semantic_key: 'other-study:brief:v1',
          created_by: outsiderActorPublicId,
        });
        otherProjectArtifactPublicId = otherProjectArtifact.public_id;
      });

      it('possessing another project\'s artifact UUID cannot bypass authorization', async () => {
        // testActor tries to access artifact from other project
        const res = await request(app)
          .get(`/api/v1/artifacts/${otherProjectArtifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });

      it('cannot create comment on artifact from another project', async () => {
        const res = await request(app)
          .post(`/api/v1/artifacts/${otherProjectArtifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Trying to comment on other project' })
          .expect(403);

        expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/artifacts/:artifactPublicId/comments', () => {
    it('returns empty thread list for artifact without comments', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.artifact_public_id).toBe(artifactPublicId);
      expect(res.body.data.threads).toEqual([]);
      expect(res.body.data.total_count).toBe(0);
    });

    it('returns 404 for non-existent artifact', async () => {
      const res = await request(app)
        .get('/api/v1/artifacts/00000000-0000-0000-0000-000000000000/comments')
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns threads with correct structure', async () => {
      // Create two threads
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'First comment' });

      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'problem_narrative', body: 'Second comment' });

      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.threads).toHaveLength(2);
      expect(res.body.data.total_count).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERING TESTS (CMT-4 Filtering Matrix)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/artifacts/:artifactPublicId/comments — Filtering', () => {
    // ─── Status Filtering ──────────────────────────────────────────────────

    describe('Status filtering', () => {
      let openThreadId: string;
      let resolvedThreadId: string;

      beforeEach(async () => {
        // Create open thread
        const openRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Open thread' });
        openThreadId = openRes.body.data.thread.id;

        // Create resolved thread
        const resolvedRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'problem_narrative', body: 'Will be resolved' });
        resolvedThreadId = resolvedRes.body.data.thread.id;

        await request(app)
          .post(`/api/v1/comments/threads/${resolvedThreadId}/resolve`)
          .set('X-Test-Actor-PublicId', actorPublicId);
      });

      it('defaults to status=open when status is omitted', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        expect(res.body.data.threads).toHaveLength(1);
        expect(res.body.data.threads[0].id).toBe(openThreadId);
        expect(res.body.data.threads[0].status).toBe('open');
        // Resolved thread should NOT be present
        const resolvedFound = res.body.data.threads.find(
          (t: { id: string }) => t.id === resolvedThreadId
        );
        expect(resolvedFound).toBeUndefined();
      });

      it('?status=open returns only open threads', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments?status=open`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        expect(res.body.data.threads).toHaveLength(1);
        expect(res.body.data.threads[0].id).toBe(openThreadId);
        expect(res.body.data.threads[0].status).toBe('open');
      });

      it('?status=resolved returns only resolved threads', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments?status=resolved`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        expect(res.body.data.threads).toHaveLength(1);
        expect(res.body.data.threads[0].id).toBe(resolvedThreadId);
        expect(res.body.data.threads[0].status).toBe('resolved');
      });

      it('?status=invalid returns validation error', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments?status=banana`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('Invalid status value');
      });
    });

    // ─── Section Key Filtering ─────────────────────────────────────────────

    describe('Section key filtering', () => {
      let summaryThreadId: string;
      let problemThreadId: string;

      beforeEach(async () => {
        // Create thread in 'summary' section
        const summaryRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Comment on summary' });
        summaryThreadId = summaryRes.body.data.thread.id;

        // Create thread in 'problem_narrative' section
        const problemRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'problem_narrative', body: 'Comment on problem' });
        problemThreadId = problemRes.body.data.thread.id;
      });

      it('?section_key=<valid> returns only threads in that section', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments?section_key=summary`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        expect(res.body.data.threads).toHaveLength(1);
        expect(res.body.data.threads[0].id).toBe(summaryThreadId);
        expect(res.body.data.threads[0].section_key).toBe('summary');
      });

      it('?section_key=<invalid> returns validation error', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments?section_key=not_a_real_section`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('Invalid section key');
      });
    });

    // ─── Combined Filtering ────────────────────────────────────────────────

    describe('Combined status + section_key filtering', () => {
      beforeEach(async () => {
        // Create open thread in summary
        await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Open in summary' });

        // Create resolved thread in summary
        const resolvedSummaryRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'summary', body: 'Resolved in summary' });
        await request(app)
          .post(`/api/v1/comments/threads/${resolvedSummaryRes.body.data.thread.id}/resolve`)
          .set('X-Test-Actor-PublicId', actorPublicId);

        // Create open thread in problem_narrative
        await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'problem_narrative', body: 'Open in problem' });

        // Create resolved thread in problem_narrative
        const resolvedProblemRes = await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'problem_narrative', body: 'Resolved in problem' });
        await request(app)
          .post(`/api/v1/comments/threads/${resolvedProblemRes.body.data.thread.id}/resolve`)
          .set('X-Test-Actor-PublicId', actorPublicId);
      });

      it('?status=open&section_key=summary returns only open threads in summary', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments?status=open&section_key=summary`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        expect(res.body.data.threads).toHaveLength(1);
        expect(res.body.data.threads[0].status).toBe('open');
        expect(res.body.data.threads[0].section_key).toBe('summary');
      });

      it('?status=resolved&section_key=problem_narrative returns only resolved threads in that section', async () => {
        const res = await request(app)
          .get(`/api/v1/artifacts/${artifactPublicId}/comments?status=resolved&section_key=problem_narrative`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        expect(res.body.data.threads).toHaveLength(1);
        expect(res.body.data.threads[0].status).toBe('resolved');
        expect(res.body.data.threads[0].section_key).toBe('problem_narrative');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRIEF / PLAN SECTION KEY VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Brief / Plan section key validation via filtering', () => {
    // Brief artifact is already set up in beforeEach

    it('Brief: valid section key accepted', async () => {
      // Create a thread first so we have something to filter
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test' });

      // Filter by valid Brief section key
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments?section_key=summary`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.threads).toHaveLength(1);
    });

    it('Brief: Plan-only section key rejected', async () => {
      // Try to filter by a Plan-only section key on a Brief artifact
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments?section_key=plan_summary`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid section key');
      expect(res.body.error.message).toContain('brief');
    });

    describe('Plan artifact', () => {
      let planArtifactPublicId: string;

      beforeEach(async () => {
        const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

        // Create a Plan artifact
        const planArtifact = await ArtifactModel.create({
          study_id: testStudy.id,
          project_id: testProject.id,
          artifact_type: 'plan',
          template_id: 'research_plan',
          template_version: '1.0.0',
          repo: 'test-repo',
          semantic_key: 'test-study:plan:v1',
          created_by: actorPublicId,
        });
        planArtifactPublicId = planArtifact.public_id;
      });

      it('Plan: valid section key accepted', async () => {
        // Create a thread first
        await request(app)
          .post(`/api/v1/artifacts/${planArtifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: 'plan_summary', body: 'Test' });

        // Filter by valid Plan section key
        const res = await request(app)
          .get(`/api/v1/artifacts/${planArtifactPublicId}/comments?section_key=plan_summary`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        expect(res.body.data.threads).toHaveLength(1);
      });

      it('Plan: Brief-only section key rejected', async () => {
        // Try to filter by a Brief-only section key on a Plan artifact
        const res = await request(app)
          .get(`/api/v1/artifacts/${planArtifactPublicId}/comments?section_key=summary`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('Invalid section key');
        expect(res.body.error.message).toContain('plan');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/artifacts/:artifactPublicId/comments', () => {
    it('creates thread with initial message', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({
          section_key: 'summary',
          body: 'This is a test comment',
        })
        .expect(201);

      const { thread } = res.body.data;

      expect(thread.id).toBeDefined();
      expect(thread.artifact_public_id).toBe(artifactPublicId);
      expect(thread.section_key).toBe('summary');
      expect(thread.status).toBe('open');
      expect(thread.message_count).toBe(1);
      expect(thread.creator.public_id).toBe(actorPublicId);
      expect(thread.messages).toHaveLength(1);
      expect(thread.messages[0].body).toBe('This is a test comment');
    });

    it('validates required fields', async () => {
      // Missing section_key
      const res1 = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Test' })
        .expect(400);

      expect(res1.body.error.code).toBe('VALIDATION_ERROR');
      expect(res1.body.error.message).toContain('section_key');

      // Missing body
      const res2 = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary' })
        .expect(400);

      expect(res2.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates section_key against artifact type (Brief)', async () => {
      // Invalid section key for Brief artifact
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'invalid_section', body: 'Test' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('section key');
    });

    it('accepts valid Brief section keys', async () => {
      // Valid Brief section keys
      const validBriefKeys = ['summary', 'problem_narrative', 'method_prose'];

      for (const sectionKey of validBriefKeys) {
        await request(app)
          .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({ section_key: sectionKey, body: `Comment on ${sectionKey}` })
          .expect(201);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAIL ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/comments/threads/:threadId', () => {
    let threadId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      threadId = createRes.body.data.thread.id;
    });

    it('returns thread with messages and events', async () => {
      const res = await request(app)
        .get(`/api/v1/comments/threads/${threadId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const { thread } = res.body.data;

      expect(thread.id).toBe(threadId);
      expect(thread.messages).toHaveLength(1);
      expect(thread.events).toBeDefined();
    });

    it('returns 404 for non-existent thread', async () => {
      const res = await request(app)
        .get('/api/v1/comments/threads/00000000-0000-0000-0000-000000000000')
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLY ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/comments/threads/:threadId/messages', () => {
    let threadId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Initial comment' });

      threadId = createRes.body.data.thread.id;
    });

    it('adds message to thread', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/messages`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'This is a reply' })
        .expect(201);

      const { message } = res.body.data;

      expect(message.thread_id).toBe(threadId);
      expect(message.body).toBe('This is a reply');
      expect(message.author.public_id).toBe(actorPublicId);
    });

    it('validates body is required', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/messages`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('PATCH /api/v1/comments/messages/:messageId', () => {
    let messageId: string;
    let messageUpdatedAt: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Original text' });

      messageId = createRes.body.data.thread.messages[0].id;
      messageUpdatedAt = createRes.body.data.thread.messages[0].updated_at;
    });

    it('updates message body with optimistic concurrency', async () => {
      const res = await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({
          body: 'Updated text',
          expected_updated_at: messageUpdatedAt,
        })
        .expect(200);

      const { message } = res.body.data;

      expect(message.id).toBe(messageId);
      expect(message.body).toBe('Updated text');
      expect(message.updated_at).not.toBe(messageUpdatedAt);
    });

    it('requires expected_updated_at for optimistic locking', async () => {
      const res = await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'New text' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('expected_updated_at');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESOLVE/REOPEN ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/comments/threads/:threadId/resolve', () => {
    let threadId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      threadId = createRes.body.data.thread.id;
    });

    it('marks thread as resolved', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const { thread, event } = res.body.data;

      expect(thread.status).toBe('resolved');
      expect(thread.resolved_by.public_id).toBe(actorPublicId);
      expect(thread.resolved_at).toBeDefined();
      expect(event.event_type).toBe('resolved');
    });

    it('rejects resolving already resolved thread (409)', async () => {
      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(409);

      expect(res.body.error.code).toBe('INVALID_STATE');
    });
  });

  describe('POST /api/v1/comments/threads/:threadId/reopen', () => {
    let threadId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      threadId = createRes.body.data.thread.id;

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId);
    });

    it('marks resolved thread as open', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const { thread, event } = res.body.data;

      expect(thread.status).toBe('open');
      expect(thread.resolved_by).toBeNull();
      expect(thread.resolved_at).toBeNull();
      expect(event.event_type).toBe('reopened');
    });

    it('rejects reopening already open thread (409)', async () => {
      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(409);

      expect(res.body.error.code).toBe('INVALID_STATE');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC ID VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Public ID Boundary', () => {
    it('thread response contains no internal integer IDs', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const { thread } = createRes.body.data;

      // Thread ID is UUID
      expect(typeof thread.id).toBe('string');
      expect(thread.id).toMatch(/^[0-9a-f-]{36}$/);

      // Uses artifact_public_id and study_public_id
      expect(thread.artifact_public_id).toBe(artifactPublicId);
      expect(thread.study_public_id).toBeDefined();
      expect(typeof thread.study_public_id).toBe('string');

      // Creator has only public_id, no internal id
      expect(thread.creator.public_id).toBeDefined();
      expect(thread.creator).not.toHaveProperty('id');

      // Messages use UUIDs, author has only public_id
      expect(thread.messages[0].id).toMatch(/^[0-9a-f-]{36}$/);
      expect(thread.messages[0].author).not.toHaveProperty('id');

      // No numeric internal IDs leaked
      const jsonStr = JSON.stringify(thread);
      expect(jsonStr).not.toMatch(/"(artifact_id|study_id|creator_id|author_id|actor_id)":\s*\d+/);
    });

    it('list response contains no internal IDs', async () => {
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const listRes = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const jsonStr = JSON.stringify(listRes.body.data);
      expect(jsonStr).not.toMatch(/"(artifact_id|study_id|creator_id|author_id|actor_id)":\s*\d+/);
    });

    it('event response contains no internal IDs', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;

      const resolveRes = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const { event } = resolveRes.body.data;

      // Event ID is UUID
      expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
      // Actor has only public_id
      expect(event.actor.public_id).toBeDefined();
      expect(event.actor).not.toHaveProperty('id');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSIONS CONTRACT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Permissions Contract', () => {
    it('thread includes can_reply, can_resolve, can_reopen', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const { thread } = createRes.body.data;

      expect(thread.permissions).toBeDefined();
      expect(typeof thread.permissions.can_reply).toBe('boolean');
      expect(typeof thread.permissions.can_resolve).toBe('boolean');
      expect(typeof thread.permissions.can_reopen).toBe('boolean');
    });

    it('message includes can_edit', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const message = createRes.body.data.thread.messages[0];

      expect(message.permissions).toBeDefined();
      expect(typeof message.permissions.can_edit).toBe('boolean');
    });

    it('author can_edit is true for own messages', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const message = createRes.body.data.thread.messages[0];
      expect(message.permissions.can_edit).toBe(true);
    });

    it('non-author can_edit is false for others\' messages', async () => {
      // Create thread as testActor
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;

      // Get thread detail as otherActor
      const detailRes = await request(app)
        .get(`/api/v1/comments/threads/${threadId}`)
        .set('X-Test-Actor-PublicId', otherActorPublicId)
        .expect(200);

      const message = detailRes.body.data.thread.messages[0];
      expect(message.permissions.can_edit).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CANONICAL ISOLATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Canonical Isolation', () => {
    it('CREATE does not change artifact status', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id);
      const beforeStatus = beforeArtifact?.status;
      const beforePubStatus = beforeArtifact?.publication_status;
      const beforeContentVersion = beforeArtifact?.content_version;

      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' })
        .expect(201);

      const afterArtifact = await ArtifactModel.findByPk(testArtifact.id);
      expect(afterArtifact?.status).toBe(beforeStatus);
      expect(afterArtifact?.publication_status).toBe(beforePubStatus);
      expect(afterArtifact?.content_version).toBe(beforeContentVersion);
    });

    it('REPLY does not change artifact status', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;

      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id);
      const beforeStatus = beforeArtifact?.status;

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/messages`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Reply' })
        .expect(201);

      const afterArtifact = await ArtifactModel.findByPk(testArtifact.id);
      expect(afterArtifact?.status).toBe(beforeStatus);
    });

    it('EDIT does not change artifact status', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Original' });

      const messageId = createRes.body.data.thread.messages[0].id;
      const updatedAt = createRes.body.data.thread.messages[0].updated_at;

      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id);
      const beforeStatus = beforeArtifact?.status;

      await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Edited', expected_updated_at: updatedAt })
        .expect(200);

      const afterArtifact = await ArtifactModel.findByPk(testArtifact.id);
      expect(afterArtifact?.status).toBe(beforeStatus);
    });

    it('RESOLVE does not change artifact status', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;

      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id);
      const beforeStatus = beforeArtifact?.status;
      const beforeUpdatedAt = beforeArtifact?.updated_at;

      await new Promise((r) => setTimeout(r, 10));

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const afterArtifact = await ArtifactModel.findByPk(testArtifact.id);
      expect(afterArtifact?.status).toBe(beforeStatus);
      expect(afterArtifact?.updated_at?.getTime()).toBe(beforeUpdatedAt?.getTime());
    });

    it('REOPEN does not change artifact status', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId);

      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id);
      const beforeStatus = beforeArtifact?.status;

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const afterArtifact = await ArtifactModel.findByPk(testArtifact.id);
      expect(afterArtifact?.status).toBe(beforeStatus);
    });

    it('comment operations do not create artifact_sections', async () => {
      const ArtifactSectionModel = sequelize.models.ArtifactSection;

      const beforeCount = await ArtifactSectionModel.count({
        where: { artifact_id: testArtifact.id },
      });

      // Create, reply, edit, resolve, reopen
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;
      const messageId = createRes.body.data.thread.messages[0].id;
      const updatedAt = createRes.body.data.thread.messages[0].updated_at;

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/messages`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Reply' });

      await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Edited', expected_updated_at: updatedAt });

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId);

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId);

      const afterCount = await ArtifactSectionModel.count({
        where: { artifact_id: testArtifact.id },
      });

      expect(afterCount).toBe(beforeCount);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTE CONVENTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Route Conventions', () => {
    it('artifact route resolves artifact → study/project', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.artifact_public_id).toBe(artifactPublicId);
    });

    it('membership is checked against resolved project', async () => {
      // outsiderActor is not a member - should get 403
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', outsiderActorPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
    });

    it('artifact-scoped routes follow /api/v1/artifacts/:id pattern', async () => {
      const listRes = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(listRes.body.data.artifact_public_id).toBe(artifactPublicId);

      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test' })
        .expect(201);

      expect(createRes.body.data.thread.artifact_public_id).toBe(artifactPublicId);
    });

    it('thread-scoped routes follow /api/v1/comments/threads/:id pattern', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test' })
        .expect(201);

      const threadId = createRes.body.data.thread.id;

      await request(app)
        .get(`/api/v1/comments/threads/${threadId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/messages`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Reply' })
        .expect(201);

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);
    });

    it('message-scoped routes follow /api/v1/comments/messages/:id pattern', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Original' })
        .expect(201);

      const messageId = createRes.body.data.thread.messages[0].id;
      const updatedAt = createRes.body.data.thread.messages[0].updated_at;

      const editRes = await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Edited', expected_updated_at: updatedAt })
        .expect(200);

      expect(editRes.body.data.message.body).toBe('Edited');
    });
  });
});
