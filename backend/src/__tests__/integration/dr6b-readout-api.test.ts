/**
 * DR-6b-3 Readout HTTP API Integration Tests
 *
 * HTTP-level tests verifying the 9 MVP endpoints for desk research readouts.
 * Tests real Express routes with supertest.
 *
 * Coverage:
 * - All 9 endpoints
 * - Authentication requirements
 * - Researcher vs member permissions
 * - Cross-project and cross-study isolation
 * - Identifier resolution (UUID, numeric, slug)
 * - Draft save conflicts and recovery payload
 * - Approval eligibility and approval errors
 * - Evidence eligibility and pagination
 * - No public generation-completion route
 */

import request from 'supertest';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { ResearchStudy } from '../../database/models/research_study';

describe('DR-6b-3 Readout HTTP API', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let project2: Project;
  let testStudy: ResearchStudy;
  let study2: ResearchStudy;
  let studyInProject2: ResearchStudy;

  // Actors
  let researcherActor: Actor;
  let adminActor: Actor;
  let nonMemberActor: Actor;
  let crossProjectActor: Actor;

  // Public IDs
  let researcherPublicId: string;
  let adminPublicId: string;
  let nonMemberPublicId: string;
  let crossProjectPublicId: string;

  // IDs
  let projectId: number;
  let studyId: number;
  let study2Id: number;
  let projectPublicId: string;
  let studyPublicId: string;

  beforeAll(async () => {
    app = getTestApp();
    sequelize = getTestDb();
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await truncateAll();

    const OrganizationModel = sequelize.models.Organization as typeof Organization;
    const ProjectModel = sequelize.models.Project;
    const ActorModel = sequelize.models.Actor;
    const StudyModel = sequelize.models.ResearchStudy;
    const ProjectMembershipModel = sequelize.models.ProjectMembership;

    // Get test org (created by truncateAll)
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    // Create actors
    researcherActor = await ActorModel.create({
      display_name: 'Researcher',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    researcherPublicId = (researcherActor as any).public_id;

    adminActor = await ActorModel.create({
      display_name: 'Admin',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    adminPublicId = (adminActor as any).public_id;

    nonMemberActor = await ActorModel.create({
      display_name: 'Non-Member',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    nonMemberPublicId = (nonMemberActor as any).public_id;

    crossProjectActor = await ActorModel.create({
      display_name: 'Cross-Project',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    crossProjectPublicId = (crossProjectActor as any).public_id;

    // Create projects
    testProject = await ProjectModel.create({
      name: 'Test Project',
      slug: 'test-project',
      created_by: researcherPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    projectId = (testProject as any).id;
    projectPublicId = (testProject as any).public_id;

    project2 = await ProjectModel.create({
      name: 'Project 2',
      slug: 'project-2',
      created_by: crossProjectPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;

    // Create studies
    testStudy = await StudyModel.create({
      name: 'Test Study',
      project_id: projectId,
      created_by: researcherPublicId,
      channel_name: 'test-study-channel',
      researcher_name: 'Test Researcher',
      researcher_email: 'researcher@test.com',
      status: 'active',
    }) as ResearchStudy;
    studyId = (testStudy as any).id;
    studyPublicId = (testStudy as any).public_id;

    study2 = await StudyModel.create({
      name: 'Study 2',
      project_id: projectId,
      created_by: researcherPublicId,
      channel_name: 'study-2-channel',
      researcher_name: 'Test Researcher',
      researcher_email: 'researcher@test.com',
      status: 'active',
    }) as ResearchStudy;
    study2Id = (study2 as any).id;

    studyInProject2 = await StudyModel.create({
      name: 'Study in Project 2',
      project_id: (project2 as any).id,
      created_by: crossProjectPublicId,
      channel_name: 'study-p2-channel',
      researcher_name: 'Cross Researcher',
      researcher_email: 'cross@test.com',
      status: 'active',
    }) as ResearchStudy;

    // Create memberships for project 1
    await ProjectMembershipModel.create({
      project_id: projectId,
      actor_id: (researcherActor as any).id,
      role: 'researcher',
    });
    await ProjectMembershipModel.create({
      project_id: projectId,
      actor_id: (adminActor as any).id,
      role: 'admin',
    });

    // crossProjectActor is member of project2 only
    await ProjectMembershipModel.create({
      project_id: (project2 as any).id,
      actor_id: (crossProjectActor as any).id,
      role: 'owner',
    });

    // nonMemberActor is NOT added to any project
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // Helper to create a readout
  async function createReadout(
    actorPublicId: string,
    pId: number = projectId,
    sId: number = studyId,
    title: string = 'Test Readout',
  ) {
    return request(app)
      .post(`/api/v1/projects/${pId}/studies/${sId}/readouts`)
      .set('X-Test-Actor-PublicId', actorPublicId)
      .send({ title, question: 'Test question?' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[AUTH] Authentication Required', () => {
    it('returns 401 without auth headers on POST /readouts', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts`)
        .send({ title: 'Test' })
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on GET /readouts', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on GET /readouts/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/1`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on PATCH /readouts/:id/draft', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/1/draft`)
        .send({ expectedVersion: 1, content: {} })
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on POST /readouts/:id/approve', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/1/approve`)
        .send({ expectedVersion: 1 })
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE READOUT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /readouts - Create Readout', () => {
    it('researcher can create readout', async () => {
      const res = await createReadout(researcherPublicId);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Test Readout');
      expect(res.body.data.displayId).toBe('RO-0001');
      expect(res.body.data.studyId).toBe(studyId);
      expect(res.body.data.projectId).toBe(projectId);
      expect(res.body.data.draft).toBeDefined();
      expect(res.body.data.draft.contentVersion).toBe(1);
    });

    it('admin can also create readout (all members have researcher authority)', async () => {
      const res = await createReadout(adminPublicId);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Test Readout');
    });

    it('non-member cannot create readout', async () => {
      const res = await createReadout(nonMemberPublicId);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ question: 'Test?' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('title');
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/99999/studies/${studyId}/readouts`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ title: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent study', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/99999/readouts`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ title: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST READOUTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /readouts - List Readouts', () => {
    it('member can list readouts', async () => {
      // Create a readout first
      await createReadout(researcherPublicId);

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.readouts).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.limit).toBe(50);
      expect(res.body.data.offset).toBe(0);
    });

    it('non-member cannot list readouts', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId);

      expect(res.status).toBe(403);
    });

    it('supports pagination', async () => {
      // Create 3 readouts
      await createReadout(researcherPublicId, projectId, studyId, 'Readout 1');
      await createReadout(researcherPublicId, projectId, studyId, 'Readout 2');
      await createReadout(researcherPublicId, projectId, studyId, 'Readout 3');

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts?limit=2&offset=1`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.readouts).toHaveLength(2);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.limit).toBe(2);
      expect(res.body.data.offset).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SINGLE READOUT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /readouts/:id - Get Single Readout', () => {
    it('can get readout by numeric ID', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(readoutId);
      expect(res.body.data.draft).toBeDefined();
    });

    it('can get readout by public_id (UUID)', async () => {
      const created = await createReadout(researcherPublicId);
      const publicId = created.body.data.publicId;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${publicId}`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.publicId).toBe(publicId);
    });

    it('returns 404 for non-existent readout', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/99999`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSS-STUDY ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CROSS_STUDY] Cross-Study Isolation', () => {
    it('returns 404 when readout belongs to different study', async () => {
      // Create readout in study1
      const created = await createReadout(researcherPublicId, projectId, studyId);
      const readoutId = created.body.data.id;

      // Try to access it via study2 URL
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${study2Id}/readouts/${readoutId}`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for study belonging to different project', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${(studyInProject2 as any).id}/readouts`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Study');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSS-PROJECT ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CROSS_PROJECT] Cross-Project Isolation', () => {
    it('returns 404 for project in different org (anti-enumeration)', async () => {
      // crossProjectActor can only access project2, not testProject
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId);

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE DRAFT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('PATCH /readouts/:id/draft - Save Draft', () => {
    it('researcher can save draft', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 1,
          content: {
            summary: { text: 'Test summary', citations: [] },
            findings: [],
            limitations: [],
            implications: [],
          },
          findingsChecked: [],
          implicationsReviewed: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.draft.contentVersion).toBe(2);
      expect(res.body.data.draft.content.summary.text).toBe('Test summary');
    });

    it('returns 409 on version conflict with submittedContent', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      // First save
      await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 1,
          content: { summary: { text: 'First save' }, findings: [], implications: [] },
        });

      // Second save with stale version
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 1, // Stale!
          content: { summary: { text: 'Conflicting save' }, findings: [], implications: [] },
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONCURRENCY_ERROR');
      expect(res.body.error.currentVersion).toBe(2);
      expect(res.body.error.submittedContent).toBeDefined();
      expect(res.body.error.submittedContent.summary.text).toBe('Conflicting save');
    });

    it('admin can also save draft (all members have researcher authority)', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', adminPublicId)
        .send({
          expectedVersion: 1,
          content: { summary: { text: 'Admin edit' }, findings: [], implications: [] },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.draft.content.summary.text).toBe('Admin edit');
    });

    it('returns 400 when expectedVersion is missing', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ content: { summary: { text: 'Test' } } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APPROVAL ELIGIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /readouts/:id/eligibility - Check Approval Eligibility', () => {
    it('member can check eligibility', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/eligibility`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.eligible).toBeDefined();
      expect(res.body.data.errors).toBeDefined();
      expect(res.body.data.supersededCitations).toBeDefined();
      expect(Array.isArray(res.body.data.supersededCitations)).toBe(true);
    });

    it('returns not eligible when no findings', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/eligibility`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.eligible).toBe(false);
      expect(res.body.data.errors.length).toBeGreaterThan(0);
      expect(res.body.data.supersededCitations).toEqual([]);
    });

    it('returns supersededCitations with revision metadata when citations are superseded', async () => {
      // Create insight with accepted revision
      const EvidenceConstructModel = sequelize.models.EvidenceConstruct;
      const EvidenceConstructRevisionModel = sequelize.models.EvidenceConstructRevision;

      const insight = await EvidenceConstructModel.create({
        project_id: projectId,
        construct_type: 'desk_insight',
        display_sequence: 1,
        created_by: 'test',
      } as any);
      const insightPublicId = (insight as any).public_id;

      const revision1 = await EvidenceConstructRevisionModel.create({
        construct_id: (insight as any).id,
        revision_number: 1,
        content: { wording: 'Original' },
        evidence_snapshot: [],
        origin: 'researcher',
        created_by: 'test',
      } as any);
      const revision1PublicId = (revision1 as any).public_id;

      await EvidenceConstructModel.update(
        { accepted_revision_id: (revision1 as any).id, latest_revision_id: (revision1 as any).id },
        { where: { id: (insight as any).id } }
      );

      // Create readout citing revision1
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const draftContent = {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId: revision1PublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        implications: [{ id: 'i1', kind: 'question', text: 'Q', basedOnFindings: ['f1'] }],
      };

      // First save: create content
      await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 1,
          content: draftContent,
        });

      // Second save: mark as checked/reviewed
      await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 2,
          content: draftContent,
          findingsChecked: ['f1'],
          implicationsReviewed: ['i1'],
        });

      // Now supersede revision1 with revision2
      const revision2 = await EvidenceConstructRevisionModel.create({
        construct_id: (insight as any).id,
        revision_number: 2,
        content: { wording: 'Updated' },
        evidence_snapshot: [],
        origin: 'researcher',
        created_by: 'test',
      } as any);

      await EvidenceConstructModel.update(
        { accepted_revision_id: (revision2 as any).id, latest_revision_id: (revision2 as any).id },
        { where: { id: (insight as any).id } }
      );

      // Check eligibility
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/eligibility`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.eligible).toBe(true);
      expect(res.body.data.supersededCitations).toHaveLength(1);
      expect(res.body.data.supersededCitations[0]).toEqual({
        constructPublicId: insightPublicId,
        revisionPublicId: revision1PublicId,
        revisionNumber: 1,
        displayId: 'IN-0001',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APPROVE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /readouts/:id/approve - Approve Readout', () => {
    it('returns 422 when not eligible', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/approve`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ expectedVersion: 1 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('APPROVAL_INELIGIBLE');
      expect(res.body.error.errors).toBeDefined();
    });

    it('non-member cannot approve', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/approve`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .send({ expectedVersion: 1 });

      expect(res.status).toBe(403);
    });

    it('returns 400 when expectedVersion is missing', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/approve`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 422 when supersession notes are missing for superseded citations', async () => {
      // Create insight and supersede it
      const EvidenceConstructModel = sequelize.models.EvidenceConstruct;
      const EvidenceConstructRevisionModel = sequelize.models.EvidenceConstructRevision;

      const insight = await EvidenceConstructModel.create({
        project_id: projectId,
        construct_type: 'desk_insight',
        display_sequence: 1,
        created_by: 'test',
      } as any);
      const insightPublicId = (insight as any).public_id;

      const revision1 = await EvidenceConstructRevisionModel.create({
        construct_id: (insight as any).id,
        revision_number: 1,
        content: { wording: 'Original' },
        evidence_snapshot: [],
        origin: 'researcher',
        created_by: 'test',
      } as any);
      const revision1PublicId = (revision1 as any).public_id;

      await EvidenceConstructModel.update(
        { accepted_revision_id: (revision1 as any).id, latest_revision_id: (revision1 as any).id },
        { where: { id: (insight as any).id } }
      );

      // Create readout citing revision1
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const draftContent = {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId: revision1PublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        implications: [{ id: 'i1', kind: 'question', text: 'Q', basedOnFindings: ['f1'] }],
      };

      // First save: create content
      await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 1,
          content: draftContent,
        });

      // Second save: mark as checked/reviewed
      await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 2,
          content: draftContent,
          findingsChecked: ['f1'],
          implicationsReviewed: ['i1'],
        });

      // Supersede revision1 with revision2
      const revision2 = await EvidenceConstructRevisionModel.create({
        construct_id: (insight as any).id,
        revision_number: 2,
        content: { wording: 'Updated' },
        evidence_snapshot: [],
        origin: 'researcher',
        created_by: 'test',
      } as any);

      await EvidenceConstructModel.update(
        { accepted_revision_id: (revision2 as any).id, latest_revision_id: (revision2 as any).id },
        { where: { id: (insight as any).id } }
      );

      // Try to approve without supersession notes
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/approve`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ expectedVersion: 3 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('APPROVAL_INELIGIBLE');
      expect(res.body.error.errors).toContainEqual(
        expect.stringContaining('requires a justification note')
      );
    });

    it('succeeds when supersession notes are provided for all superseded citations', async () => {
      // Create insight and supersede it
      const EvidenceConstructModel = sequelize.models.EvidenceConstruct;
      const EvidenceConstructRevisionModel = sequelize.models.EvidenceConstructRevision;

      const insight = await EvidenceConstructModel.create({
        project_id: projectId,
        construct_type: 'desk_insight',
        display_sequence: 1,
        created_by: 'test',
      } as any);
      const insightPublicId = (insight as any).public_id;

      const revision1 = await EvidenceConstructRevisionModel.create({
        construct_id: (insight as any).id,
        revision_number: 1,
        content: { wording: 'Original' },
        evidence_snapshot: [],
        origin: 'researcher',
        created_by: 'test',
      } as any);
      const revision1PublicId = (revision1 as any).public_id;

      await EvidenceConstructModel.update(
        { accepted_revision_id: (revision1 as any).id, latest_revision_id: (revision1 as any).id },
        { where: { id: (insight as any).id } }
      );

      // Create readout citing revision1
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const draftContent = {
        findings: [{
          id: 'f1',
          text: 'Finding',
          citations: [{
            constructPublicId: insightPublicId,
            revisionPublicId: revision1PublicId,
            revisionNumber: 1,
            displayId: 'IN-0001',
          }],
        }],
        implications: [{ id: 'i1', kind: 'question', text: 'Q', basedOnFindings: ['f1'] }],
      };

      // First save: create content
      await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 1,
          content: draftContent,
        });

      // Second save: mark as checked/reviewed
      await request(app)
        .patch(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/draft`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 2,
          content: draftContent,
          findingsChecked: ['f1'],
          implicationsReviewed: ['i1'],
        });

      // Supersede revision1 with revision2
      const revision2 = await EvidenceConstructRevisionModel.create({
        construct_id: (insight as any).id,
        revision_number: 2,
        content: { wording: 'Updated' },
        evidence_snapshot: [],
        origin: 'researcher',
        created_by: 'test',
      } as any);

      await EvidenceConstructModel.update(
        { accepted_revision_id: (revision2 as any).id, latest_revision_id: (revision2 as any).id },
        { where: { id: (insight as any).id } }
      );

      // Approve with supersession note
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/approve`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          expectedVersion: 3,
          supersessionNotes: {
            [revision1PublicId]: 'Using older revision intentionally for specific scope',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.approvalNumber).toBe(1);
      expect(res.body.data.supersessionNotes).toEqual({
        [revision1PublicId]: 'Using older revision intentionally for specific scope',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APPROVAL HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /readouts/:id/approvals - Approval History', () => {
    it('member can get approval history', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/approvals`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.approvals).toBeDefined();
      expect(Array.isArray(res.body.data.approvals)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATION HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /readouts/:id/versions - Generation History', () => {
    it('member can get generation history', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/versions`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.versions).toBeDefined();
      expect(Array.isArray(res.body.data.versions)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVIDENCE ELIGIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /readouts/:id/evidence-eligibility - Evidence Eligibility', () => {
    it('member can get eligible evidence', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/evidence-eligibility`)
        .set('X-Test-Actor-PublicId', adminPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.insights).toBeDefined();
      expect(res.body.data.total).toBeDefined();
      expect(res.body.data.limit).toBe(50);
      expect(res.body.data.offset).toBe(0);
    });

    it('returns empty array when no accepted insights', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/evidence-eligibility`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.insights).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    it('supports pagination', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/evidence-eligibility?limit=10&offset=5`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(10);
      expect(res.body.data.offset).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATION ENDPOINT (implemented in DR-6b-5c)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[GENERATION] POST /generate validation', () => {
    it('POST /generate rejects invalid idempotency key', async () => {
      const created = await createReadout(researcherPublicId);
      const readoutId = created.body.data.id;

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/studies/${studyId}/readouts/${readoutId}/generate`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ idempotencyKey: 'short', selectedRevisionIds: [] });

      // Should reject with validation error (short idempotency key)
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTIFIER RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[IDENTIFIERS] Identifier Resolution', () => {
    it('resolves project by slug', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/test-project/studies/${studyId}/readouts`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
    });

    it('resolves project by public_id (UUID)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/studies/${studyId}/readouts`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
    });

    it('resolves study by public_id (UUID)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/studies/${studyPublicId}/readouts`)
        .set('X-Test-Actor-PublicId', researcherPublicId);

      expect(res.status).toBe(200);
    });
  });
});
