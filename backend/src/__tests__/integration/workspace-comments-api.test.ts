/**
 * Workspace Comments API Integration Tests — CMT-4
 *
 * HTTP-level integration tests for the Comments REST API.
 * Tests all 7 endpoints with real database state.
 *
 * CMT-4 Verification Matrix:
 * - [AUTH]     401 without auth headers
 * - [LIST]     GET /api/v1/artifacts/:artifactPublicId/comments
 * - [CREATE]   POST /api/v1/artifacts/:artifactPublicId/comments
 * - [DETAIL]   GET /api/v1/comments/threads/:threadId
 * - [REPLY]    POST /api/v1/comments/threads/:threadId/messages
 * - [EDIT]     PATCH /api/v1/comments/messages/:messageId
 * - [RESOLVE]  POST /api/v1/comments/threads/:threadId/resolve
 * - [REOPEN]   POST /api/v1/comments/threads/:threadId/reopen
 * - [PUBLIC_ID] No internal IDs in any response JSON
 * - [PERMISSIONS] can_reply, can_resolve, can_reopen, can_edit present
 * - [ISOLATION] Comments don't alter artifacts/approval/GitHub
 */

import request from 'supertest';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
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

  // Public IDs for API calls
  let artifactPublicId: string;
  let actorPublicId: string;

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

    // Create test organization (already created by truncateAll, but get reference)
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    // Create test actor - let public_id be auto-generated as UUID
    testActor = await ActorModel.create({
      display_name: 'Test Researcher',
      organization_id: testOrg.id,
    });
    actorPublicId = testActor.public_id;

    // Create test project
    testProject = await ProjectModel.create({
      name: 'Test Project',
      slug: 'test-project',
      created_by: actorPublicId,
      organization_id: testOrg.id,
    });

    // Add actor as project member
    const ProjectMembershipModel = sequelize.models.ProjectMembership;
    await ProjectMembershipModel.create({
      project_id: testProject.id,
      actor_id: testActor.id,
      role: 'researcher',
    });

    // Create test study - let public_id be auto-generated
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

    // Create test artifact - let public_id be auto-generated
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

  // ─── AUTH Tests ───────────────────────────────────────────────────────────

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

  // ─── LIST Tests ───────────────────────────────────────────────────────────

  describe('GET /api/v1/artifacts/:artifactPublicId/comments', () => {
    it('[LIST] returns empty thread list for artifact without comments', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      expect(res.body.data.artifact_public_id).toBe(artifactPublicId);
      expect(res.body.data.threads).toEqual([]);
      expect(res.body.data.total_count).toBe(0);
    });

    it('[LIST] returns 404 for non-existent artifact', async () => {
      // Use a valid UUID format that doesn't exist in the database
      const res = await request(app)
        .get('/api/v1/artifacts/00000000-0000-0000-0000-000000000000/comments')
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // ─── CREATE Tests ─────────────────────────────────────────────────────────

  describe('POST /api/v1/artifacts/:artifactPublicId/comments', () => {
    it('[CREATE] creates thread with initial message', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({
          section_key: 'summary',
          body: 'This is a test comment',
        })
        .expect(201);

      const { thread } = res.body.data;

      // Verify thread structure
      expect(thread.id).toBeDefined();
      expect(thread.artifact_public_id).toBe(artifactPublicId);
      expect(thread.section_key).toBe('summary');
      expect(thread.status).toBe('open');
      expect(thread.message_count).toBe(1);

      // Verify creator
      expect(thread.creator.public_id).toBe(actorPublicId);
      expect(thread.creator.display_name).toBe('Test Researcher');

      // Verify initial message
      expect(thread.messages).toHaveLength(1);
      expect(thread.messages[0].body).toBe('This is a test comment');
      expect(thread.messages[0].author.public_id).toBe(actorPublicId);
    });

    it('[CREATE] validates required fields', async () => {
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
  });

  // ─── DETAIL Tests ─────────────────────────────────────────────────────────

  describe('GET /api/v1/comments/threads/:threadId', () => {
    let threadId: string;

    beforeEach(async () => {
      // Create a thread first
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      threadId = createRes.body.data.thread.id;
    });

    it('[DETAIL] returns thread with messages and events', async () => {
      const res = await request(app)
        .get(`/api/v1/comments/threads/${threadId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const { thread } = res.body.data;

      expect(thread.id).toBe(threadId);
      expect(thread.messages).toHaveLength(1);
      expect(thread.events).toBeDefined();
    });

    it('[DETAIL] returns 404 for non-existent thread', async () => {
      // Use a valid UUID format that doesn't exist in the database
      const res = await request(app)
        .get('/api/v1/comments/threads/00000000-0000-0000-0000-000000000000')
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // ─── REPLY Tests ──────────────────────────────────────────────────────────

  describe('POST /api/v1/comments/threads/:threadId/messages', () => {
    let threadId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Initial comment' });

      threadId = createRes.body.data.thread.id;
    });

    it('[REPLY] adds message to thread', async () => {
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

    it('[REPLY] validates body is required', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/messages`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── EDIT Tests ───────────────────────────────────────────────────────────

  describe('PATCH /api/v1/comments/messages/:messageId', () => {
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

    it('[EDIT] updates message body with optimistic concurrency', async () => {
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

    it('[EDIT] requires expected_updated_at for optimistic locking', async () => {
      const res = await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'New text' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('expected_updated_at');
    });

    it('[EDIT] rejects stale expected_updated_at (edit conflict)', async () => {
      // First edit
      await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({
          body: 'First update',
          expected_updated_at: messageUpdatedAt,
        })
        .expect(200);

      // Second edit with stale timestamp
      const res = await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({
          body: 'Conflicting update',
          expected_updated_at: messageUpdatedAt, // stale!
        })
        .expect(409);

      expect(res.body.error.code).toBe('COMMENT_EDIT_CONFLICT');
    });
  });

  // ─── RESOLVE/REOPEN Tests ─────────────────────────────────────────────────

  describe('POST /api/v1/comments/threads/:threadId/resolve', () => {
    let threadId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      threadId = createRes.body.data.thread.id;
    });

    it('[RESOLVE] marks thread as resolved', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const { thread, event } = res.body.data;

      expect(thread.status).toBe('resolved');
      expect(thread.resolved_by).toBeDefined();
      expect(thread.resolved_by.public_id).toBe(actorPublicId);
      expect(thread.resolved_at).toBeDefined();

      expect(event.event_type).toBe('resolved');
      expect(event.actor.public_id).toBe(actorPublicId);
    });

    it('[RESOLVE] rejects resolving already resolved thread', async () => {
      // First resolve
      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      // Second resolve should fail
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

    it('[REOPEN] marks resolved thread as open', async () => {
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

    it('[REOPEN] rejects reopening already open thread', async () => {
      // Reopen first
      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      // Second reopen should fail
      const res = await request(app)
        .post(`/api/v1/comments/threads/${threadId}/reopen`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(409);

      expect(res.body.error.code).toBe('INVALID_STATE');
    });
  });

  // ─── PUBLIC ID Verification ───────────────────────────────────────────────

  describe('Public ID Boundary', () => {
    it('[PUBLIC_ID] thread response contains no internal integer IDs', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const { thread } = createRes.body.data;

      // Verify thread uses public IDs, not integers
      expect(typeof thread.id).toBe('string');
      expect(thread.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format

      // Verify artifact reference uses public ID
      expect(thread.artifact_public_id).toBe(artifactPublicId);
      expect(thread.study_public_id).toBeDefined();
      expect(typeof thread.study_public_id).toBe('string');

      // Verify creator uses public_id
      expect(thread.creator.public_id).toBeDefined();
      expect(thread.creator).not.toHaveProperty('id');

      // Verify messages use UUIDs
      expect(thread.messages[0].id).toMatch(/^[0-9a-f-]{36}$/);
      expect(thread.messages[0].author).not.toHaveProperty('id');

      // Verify no numeric IDs leaked
      const jsonStr = JSON.stringify(thread);
      // Should not contain patterns like "id":1 or "id": 1 (integer IDs)
      // But should contain UUID patterns
      expect(jsonStr).not.toMatch(/"(artifact_id|study_id|creator_id|author_id|actor_id)":\s*\d+/);
    });

    it('[PUBLIC_ID] list response contains no internal IDs', async () => {
      // Create a thread first
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const listRes = await request(app)
        .get(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const jsonStr = JSON.stringify(listRes.body.data);

      // No internal integer IDs should appear
      expect(jsonStr).not.toMatch(/"(artifact_id|study_id|creator_id|author_id|actor_id)":\s*\d+/);
    });
  });

  // ─── Permissions Verification ─────────────────────────────────────────────

  describe('Permissions Contract', () => {
    it('[PERMISSIONS] thread includes can_reply, can_resolve, can_reopen', async () => {
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

    it('[PERMISSIONS] message includes can_edit', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const message = createRes.body.data.thread.messages[0];

      expect(message.permissions).toBeDefined();
      expect(typeof message.permissions.can_edit).toBe('boolean');
    });

    it('[PERMISSIONS] author can_edit is true for own messages', async () => {
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const message = createRes.body.data.thread.messages[0];

      // Author should be able to edit their own message
      expect(message.permissions.can_edit).toBe(true);
    });
  });

  // ─── Canonical Isolation Tests ────────────────────────────────────────────

  describe('Canonical Isolation', () => {
    it('[ISOLATION] creating comment does not change artifact status', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

      // Get initial artifact state
      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id);
      const beforeStatus = beforeArtifact?.status;
      const beforePubStatus = beforeArtifact?.publication_status;

      // Create a comment
      await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' })
        .expect(201);

      // Verify artifact unchanged
      const afterArtifact = await ArtifactModel.findByPk(testArtifact.id);
      expect(afterArtifact?.status).toBe(beforeStatus);
      expect(afterArtifact?.publication_status).toBe(beforePubStatus);
    });

    it('[ISOLATION] resolving thread does not change artifact state', async () => {
      const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

      // Create a thread
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;

      // Get artifact state before resolve
      const beforeArtifact = await ArtifactModel.findByPk(testArtifact.id);
      const beforeUpdatedAt = beforeArtifact?.updated_at;

      // Small delay to ensure timestamp would change if artifact was touched
      await new Promise((r) => setTimeout(r, 10));

      // Resolve the thread
      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      // Verify artifact not modified
      const afterArtifact = await ArtifactModel.findByPk(testArtifact.id);
      expect(afterArtifact?.updated_at?.getTime()).toBe(beforeUpdatedAt?.getTime());
    });

    it('[ISOLATION] comment operations do not create artifact_sections', async () => {
      const ArtifactSectionModel = sequelize.models.ArtifactSection;

      // Get initial section count
      const beforeCount = await ArtifactSectionModel.count({
        where: { artifact_id: testArtifact.id },
      });

      // Create and resolve a comment thread
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test comment' });

      const threadId = createRes.body.data.thread.id;

      await request(app)
        .post(`/api/v1/comments/threads/${threadId}/resolve`)
        .set('X-Test-Actor-PublicId', actorPublicId);

      // Verify no new artifact_sections created
      const afterCount = await ArtifactSectionModel.count({
        where: { artifact_id: testArtifact.id },
      });

      expect(afterCount).toBe(beforeCount);
    });
  });

  // ─── Route Convention Tests ───────────────────────────────────────────────

  describe('Route Conventions', () => {
    it('artifact-scoped routes follow /api/v1/artifacts/:id pattern', async () => {
      // Both routes should work with artifact public ID
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
      // Create thread first
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Test' })
        .expect(201);

      const threadId = createRes.body.data.thread.id;

      // Detail, reply, resolve, reopen all work
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
      // Create thread
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${artifactPublicId}/comments`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ section_key: 'summary', body: 'Original' })
        .expect(201);

      const messageId = createRes.body.data.thread.messages[0].id;
      const updatedAt = createRes.body.data.thread.messages[0].updated_at;

      // Edit works
      const editRes = await request(app)
        .patch(`/api/v1/comments/messages/${messageId}`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ body: 'Edited', expected_updated_at: updatedAt })
        .expect(200);

      expect(editRes.body.data.message.body).toBe('Edited');
    });
  });
});
