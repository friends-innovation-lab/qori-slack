/**
 * DR-1 HTTP Authorization Integration Tests
 *
 * HTTP-level tests verifying authorization enforcement on desk insight routes.
 * Tests real Express routes with supertest, not just service layer.
 *
 * Verification Matrix:
 * - [AUTH]          401 without auth headers
 * - [NON_MEMBER]    403 for non-project-members
 * - [CROSS_PROJECT] 404/403 for cross-project access (anti-enumeration)
 * - [RESEARCHER]    Researcher can accept own revision (D2)
 * - [ADMIN]         Admin can review
 * - [OWNER]         Owner can review
 * - [WITHDRAW]      Only researcher+ can withdraw
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
import type { EvidenceSource } from '../../database/models/evidence_source';

describe('DR-1 HTTP Authorization', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let project2: Project;

  // Actors
  let researcherActor: Actor;
  let adminActor: Actor;
  let ownerActor: Actor;
  let nonMemberActor: Actor;
  let crossProjectActor: Actor;

  // Sources
  let sourceId: number;

  // Public IDs
  let researcherPublicId: string;
  let adminPublicId: string;
  let ownerPublicId: string;
  let nonMemberPublicId: string;
  let crossProjectPublicId: string;

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
    const EvidenceSourceModel = sequelize.models.EvidenceSource;
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

    ownerActor = await ActorModel.create({
      display_name: 'Owner',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    ownerPublicId = (ownerActor as any).public_id;

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
      created_by: ownerPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;

    project2 = await ProjectModel.create({
      name: 'Project 2',
      slug: 'project-2',
      created_by: crossProjectPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;

    // Create memberships for project 1
    await ProjectMembershipModel.create({
      project_id: (testProject as any).id,
      actor_id: (researcherActor as any).id,
      role: 'researcher',
    });
    await ProjectMembershipModel.create({
      project_id: (testProject as any).id,
      actor_id: (adminActor as any).id,
      role: 'admin',
    });
    await ProjectMembershipModel.create({
      project_id: (testProject as any).id,
      actor_id: (ownerActor as any).id,
      role: 'owner',
    });

    // crossProjectActor is member of project2 only
    await ProjectMembershipModel.create({
      project_id: (project2 as any).id,
      actor_id: (crossProjectActor as any).id,
      role: 'owner',
    });

    // nonMemberActor is NOT added to any project

    // Create evidence source
    const source = await EvidenceSourceModel.create({
      project_id: (testProject as any).id,
      source_type: 'uploaded_document',
      label: 'Test Document',
      created_by: ownerPublicId,
    } as CreationAttributes<EvidenceSource>);
    sourceId = (source as any).id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // Helper to create insight via API
  async function createInsight(actorPublicId: string, projectId: number = (testProject as any).id) {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/insights`)
      .set('X-Test-Actor-PublicId', actorPublicId)
      .send({
        wording: 'Test insight wording',
        evidenceReferences: [{
          evidenceSourceId: sourceId,
          evidenceSourcePublicId: 'test-uuid',
          locator: { sourceLevel: true },
          validation: 'source_attributed_unverified',
          sourceLabel: 'Test Document',
        }],
      });
    return res;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[AUTH] Authentication Required', () => {
    it('returns 401 without auth headers on GET /insights', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${(testProject as any).id}/insights`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on POST /insights', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights`)
        .send({ wording: 'Test', evidenceReferences: [] })
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 without auth headers on POST /reviews', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/1/reviews`)
        .send({ action: 'accept', revisionId: 1, expectedVersion: 1 })
        .expect(401);

      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT MEMBERSHIP AUTHORIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[NON_MEMBER] Non-Project-Member Denied', () => {
    it('non-member cannot list insights', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${(testProject as any).id}/insights`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('non-member cannot create insight', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .send({
          wording: 'Test insight',
          evidenceReferences: [{
            evidenceSourceId: sourceId,
            locator: { sourceLevel: true },
          }],
        })
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('non-member cannot get needs-review-count', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${(testProject as any).id}/insights/needs-review-count`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSS-PROJECT AUTHORIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CROSS_PROJECT] Cross-Project Actor Denied', () => {
    it('cross-project actor cannot list insights', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${(testProject as any).id}/insights`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('cross-project actor cannot create insight', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId)
        .send({
          wording: 'Test insight',
          evidenceReferences: [{
            evidenceSourceId: sourceId,
            locator: { sourceLevel: true },
          }],
        })
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('cross-project actor cannot submit review', async () => {
      // First create insight as owner
      const createRes = await createInsight(ownerPublicId);
      expect(createRes.status).toBe(201);
      const insightId = createRes.body.data.id;
      const revisionId = createRes.body.data.latestRevision.id;

      // Cross-project actor tries to accept
      const res = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId)
        .send({
          action: 'accept',
          revisionId,
          expectedVersion: 1,
        })
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // D2: RESEARCHER SELF-ACCEPT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[RESEARCHER] Researcher Can Accept Own Revision (D2)', () => {
    it('researcher can create and accept own insight', async () => {
      // Create insight
      const createRes = await createInsight(researcherPublicId);
      expect(createRes.status).toBe(201);
      const insightId = createRes.body.data.id;
      const revisionId = createRes.body.data.latestRevision.id;

      // Accept own revision
      const acceptRes = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          action: 'accept',
          revisionId,
          expectedVersion: 1,
        })
        .expect(201);

      expect(acceptRes.body.data.status).toBe('accepted');
      expect(acceptRes.body.data.acceptedRevisionNumber).toBe(1);
    });

    it('researcher can reject revision', async () => {
      const createRes = await createInsight(researcherPublicId);
      expect(createRes.status).toBe(201);
      const insightId = createRes.body.data.id;
      const revisionId = createRes.body.data.latestRevision.id;

      const rejectRes = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          action: 'reject',
          revisionId,
          comment: 'Needs more evidence',
          expectedVersion: 1,
        })
        .expect(201);

      expect(rejectRes.body.data.status).toBe('rejected');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN/OWNER REVIEW AUTHORIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[ADMIN] Admin Can Review', () => {
    it('admin can accept revision', async () => {
      const createRes = await createInsight(researcherPublicId);
      expect(createRes.status).toBe(201);
      const insightId = createRes.body.data.id;
      const revisionId = createRes.body.data.latestRevision.id;

      const acceptRes = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', adminPublicId)
        .send({
          action: 'accept',
          revisionId,
          expectedVersion: 1,
        })
        .expect(201);

      expect(acceptRes.body.data.status).toBe('accepted');
    });
  });

  describe('[OWNER] Owner Can Review', () => {
    it('owner can accept revision', async () => {
      const createRes = await createInsight(researcherPublicId);
      expect(createRes.status).toBe(201);
      const insightId = createRes.body.data.id;
      const revisionId = createRes.body.data.latestRevision.id;

      const acceptRes = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .send({
          action: 'accept',
          revisionId,
          expectedVersion: 1,
        })
        .expect(201);

      expect(acceptRes.body.data.status).toBe('accepted');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WITHDRAWAL AUTHORIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[WITHDRAW] Withdrawal Requires Researcher Role', () => {
    it('researcher can withdraw accepted insight', async () => {
      // Create and accept
      const createRes = await createInsight(researcherPublicId);
      expect(createRes.status).toBe(201);
      const insightId = createRes.body.data.id;
      const revisionId = createRes.body.data.latestRevision.id;

      await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({ action: 'accept', revisionId, expectedVersion: 1 })
        .expect(201);

      // Withdraw
      const withdrawRes = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          action: 'withdraw',
          comment: 'Superseded by new findings',
          expectedVersion: 2,
        })
        .expect(201);

      expect(withdrawRes.body.data.status).toBe('withdrawn');
    });

    it('non-member cannot withdraw', async () => {
      // Create and accept as owner
      const createRes = await createInsight(ownerPublicId);
      expect(createRes.status).toBe(201);
      const insightId = createRes.body.data.id;
      const revisionId = createRes.body.data.latestRevision.id;

      await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .send({ action: 'accept', revisionId, expectedVersion: 1 })
        .expect(201);

      // Non-member tries to withdraw
      const res = await request(app)
        .post(`/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .send({
          action: 'withdraw',
          comment: 'Trying to withdraw',
          expectedVersion: 2,
        })
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTE INVENTORY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Route Inventory Verification', () => {
    it('all 10 routes enforce project membership', async () => {
      // Create insight first for routes that need it
      const createRes = await createInsight(ownerPublicId);
      const insightId = createRes.body.data.id;

      const routes = [
        { method: 'get', path: `/api/v1/projects/${(testProject as any).id}/insights` },
        { method: 'get', path: `/api/v1/projects/${(testProject as any).id}/insights/needs-review-count` },
        { method: 'get', path: `/api/v1/projects/${(testProject as any).id}/insights/synthesis-eligible` },
        { method: 'post', path: `/api/v1/projects/${(testProject as any).id}/insights`, body: { wording: 'x', evidenceReferences: [{ evidenceSourceId: sourceId, locator: {} }] } },
        { method: 'get', path: `/api/v1/projects/${(testProject as any).id}/insights/${insightId}` },
        { method: 'get', path: `/api/v1/projects/${(testProject as any).id}/insights/${insightId}/revisions` },
        { method: 'get', path: `/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews` },
        { method: 'post', path: `/api/v1/projects/${(testProject as any).id}/insights/${insightId}/revisions`, body: { wording: 'x', evidenceReferences: [{ evidenceSourceId: sourceId, locator: {} }], expectedVersion: 1 } },
        { method: 'post', path: `/api/v1/projects/${(testProject as any).id}/insights/${insightId}/reviews`, body: { action: 'accept', revisionId: 1, expectedVersion: 1 } },
        { method: 'get', path: `/api/v1/projects/${(testProject as any).id}/insights/source-protection/${sourceId}` },
      ];

      for (const route of routes) {
        const req = (request(app) as any)[route.method](route.path)
          .set('X-Test-Actor-PublicId', nonMemberPublicId);

        if (route.body) {
          req.send(route.body);
        }

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DR-4 HOTFIX: PROJECT SLUG RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[DR4-HOTFIX] Project Identifier Resolution', () => {
    it('GET /insights accepts project slug as identifier', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/test-project/insights`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /insights/needs-review-count accepts project slug', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/test-project/insights/needs-review-count`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(200);

      expect(res.body.data.count).toBeDefined();
    });

    it('POST /insights accepts project slug and creates insight', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/test-project/insights`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .send({
          wording: 'Insight created via project slug',
          evidenceReferences: [{
            evidenceSourceId: sourceId,
            locator: { sourceLevel: true },
          }],
        })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.latestRevision.content.wording).toBe('Insight created via project slug');
    });

    it('returns empty list for project slug with no insights', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/project-2/insights`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('returns 400 for unknown project slug', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/nonexistent-project-slug/insights`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('unknown project identifier');
    });

    it('maintains project isolation when using slug', async () => {
      // Create insight in project 1
      await request(app)
        .post(`/api/v1/projects/test-project/insights`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .send({
          wording: 'Project 1 insight',
          evidenceReferences: [{
            evidenceSourceId: sourceId,
            locator: { sourceLevel: true },
          }],
        })
        .expect(201);

      // Access via slug - crossProjectActor (member of project-2 only) should get 403
      const res = await request(app)
        .get(`/api/v1/projects/test-project/insights`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('accepts numeric project ID for backward compatibility', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${(testProject as any).id}/insights`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DR-4 HOTFIX: DISCOVERY ROUTES PROJECT SLUG RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[DR4-HOTFIX] Discovery Project Identifier Resolution', () => {
    it('GET /discovery/runs accepts project slug', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/test-project/discovery/runs?type=desk_research`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /discovery/artifacts accepts project slug', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/test-project/discovery/artifacts`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /discovery/knowledge-gaps accepts project slug', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/test-project/discovery/knowledge-gaps`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('returns empty runs list for project with no runs', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/project-2/discovery/runs`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('returns 400 for unknown project slug on discovery routes', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/nonexistent-slug/discovery/runs`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('unknown project identifier');
    });

    it('maintains project isolation on discovery routes', async () => {
      // crossProjectActor (member of project-2 only) cannot access test-project discovery
      const res = await request(app)
        .get(`/api/v1/projects/test-project/discovery/runs`)
        .set('X-Test-Actor-PublicId', crossProjectPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('accepts numeric project ID for backward compatibility on discovery routes', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${(testProject as any).id}/discovery/runs`)
        .set('X-Test-Actor-PublicId', ownerPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });
});
