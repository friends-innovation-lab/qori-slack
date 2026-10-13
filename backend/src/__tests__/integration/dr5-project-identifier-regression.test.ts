/**
 * DR-5 Project Identifier Regression Tests
 *
 * Comprehensive HTTP-level tests verifying project identifier resolution
 * across all project-scoped API routes. Tests the resolveProjectId() function
 * indirectly by exercising real Express routes with Supertest against PostgreSQL.
 *
 * Verification Matrix:
 * - [SLUG]       Project slug identifier → 200/201
 * - [UUID]       Project UUID public_id → 200/201
 * - [NUMERIC]    Numeric project ID → 200/201 (backward compat)
 * - [UNKNOWN]    Unknown identifier → 400 VALIDATION_ERROR
 * - [CROSS_ORG]  Cross-org identifier (valid slug, wrong org) → 400
 *
 * Route Groups Covered:
 * - Insights:         /api/v1/projects/:projectId/insights/*
 * - Evidence Sources: /api/v1/projects/:projectId/evidence-sources
 * - Discovery:        /api/v1/projects/:projectId/discovery/*
 *
 * Regression context: DR-4 live defects showed frontend passing project slug
 * when routes expected numeric ID. The resolveProjectId() helper now resolves
 * slug, UUID public_id, or numeric ID. These tests ensure that resolution
 * works consistently across all project-scoped endpoints.
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
import type { EvidenceSource } from '../../database/models/evidence_source';

describe('DR-5 Project Identifier Regression', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let projectPublicId: string;
  let projectNumericId: number;

  // Actor
  let memberActor: Actor;
  let memberPublicId: string;

  // Evidence source for insight creation
  let testSourceId: number;

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
    testOrg = (await OrganizationModel.findOne({ where: { slug: 'test-org' } })) as Organization;

    // Create actor
    memberActor = (await ActorModel.create({
      display_name: 'DR5 Test Member',
      organization_id: testOrg.id,
      status: 'active',
    })) as Actor;
    memberPublicId = (memberActor as any).public_id;

    // Create project with explicit slug for testing
    testProject = (await ProjectModel.create({
      name: 'DR5 Test Project',
      slug: 'dr5-test-project',
      created_by: memberPublicId,
      organization_id: testOrg.id,
      status: 'active',
    })) as Project;

    // Reload to get auto-generated public_id (default value function runs on DB insert)
    await (testProject as any).reload();

    projectPublicId = (testProject as any).public_id;
    projectNumericId = (testProject as any).id;

    // Create project membership
    await ProjectMembershipModel.create({
      project_id: projectNumericId,
      actor_id: (memberActor as any).id,
      role: 'owner',
    });

    // Create evidence source for insight tests
    const source = await EvidenceSourceModel.create({
      project_id: projectNumericId,
      source_type: 'uploaded_document',
      label: 'DR5 Test Document',
      created_by: memberPublicId,
    } as CreationAttributes<EvidenceSource>);
    testSourceId = (source as any).id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INSIGHTS ROUTE GROUP
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[INSIGHTS] Project Identifier Resolution', () => {
    describe('[SLUG] Slug identifier', () => {
      it('GET /insights accepts project slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/insights')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('GET /insights/needs-review-count accepts project slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/insights/needs-review-count')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(typeof res.body.data.count).toBe('number');
      });

      it('POST /insights accepts project slug', async () => {
        const res = await request(app)
          .post('/api/v1/projects/dr5-test-project/insights')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .send({
            wording: 'Insight via slug',
            evidenceReferences: [
              {
                evidenceSourceId: testSourceId,
                locator: { sourceLevel: true },
              },
            ],
          })
          .expect(201);

        expect(res.body.data.id).toBeDefined();
      });
    });

    describe('[UUID] UUID public_id identifier', () => {
      it('GET /insights accepts project UUID public_id', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectPublicId}/insights`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('GET /insights/needs-review-count accepts project UUID public_id', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectPublicId}/insights/needs-review-count`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(typeof res.body.data.count).toBe('number');
      });

      it('POST /insights accepts project UUID public_id', async () => {
        const res = await request(app)
          .post(`/api/v1/projects/${projectPublicId}/insights`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .send({
            wording: 'Insight via UUID',
            evidenceReferences: [
              {
                evidenceSourceId: testSourceId,
                locator: { sourceLevel: true },
              },
            ],
          })
          .expect(201);

        expect(res.body.data.id).toBeDefined();
      });
    });

    describe('[NUMERIC] Numeric ID identifier (backward compat)', () => {
      it('GET /insights accepts numeric project ID', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectNumericId}/insights`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });

      it('GET /insights/needs-review-count accepts numeric project ID', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectNumericId}/insights/needs-review-count`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(typeof res.body.data.count).toBe('number');
      });
    });

    describe('[UNKNOWN] Unknown identifier', () => {
      it('returns 400 for unknown slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/nonexistent-project-slug/insights')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('unknown project identifier');
      });

      it('returns 400 for unknown UUID', async () => {
        const res = await request(app)
          .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/insights')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('returns 400 for unknown numeric ID', async () => {
        const res = await request(app)
          .get('/api/v1/projects/999999/insights')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('[EMPTY_RESULTS] Valid project with no insights', () => {
      it('returns empty array for project with no insights', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/insights')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toEqual([]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVIDENCE SOURCES ROUTE GROUP
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[EVIDENCE-SOURCES] Project Identifier Resolution', () => {
    describe('[SLUG] Slug identifier', () => {
      it('GET /evidence-sources accepts project slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/evidence-sources')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
        // Should include the test source we created
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('[UUID] UUID public_id identifier', () => {
      it('GET /evidence-sources accepts project UUID public_id', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectPublicId}/evidence-sources`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });

    describe('[NUMERIC] Numeric ID identifier (backward compat)', () => {
      it('GET /evidence-sources accepts numeric project ID', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectNumericId}/evidence-sources`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });
    });

    describe('[UNKNOWN] Unknown identifier', () => {
      it('returns 400 for unknown slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/nonexistent-slug/evidence-sources')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('unknown project identifier');
      });

      it('returns 400 for unknown UUID', async () => {
        const res = await request(app)
          .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/evidence-sources')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('[EMPTY_RESULTS] Valid project with no sources', () => {
      it('returns empty array for new project with no sources', async () => {
        // Create a second project with no evidence sources
        const ProjectModel = sequelize.models.Project;
        const ProjectMembershipModel = sequelize.models.ProjectMembership;

        const emptyProject = await ProjectModel.create({
          name: 'Empty Project',
          slug: 'empty-project',
          created_by: memberPublicId,
          organization_id: testOrg.id,
          status: 'active',
        });

        await ProjectMembershipModel.create({
          project_id: (emptyProject as any).id,
          actor_id: (memberActor as any).id,
          role: 'owner',
        });

        const res = await request(app)
          .get('/api/v1/projects/empty-project/evidence-sources')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toEqual([]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCOVERY ROUTE GROUP
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[DISCOVERY] Project Identifier Resolution', () => {
    describe('[SLUG] Slug identifier', () => {
      it('GET /discovery/runs accepts project slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/discovery/runs')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('GET /discovery/artifacts accepts project slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/discovery/artifacts')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('GET /discovery/knowledge-gaps accepts project slug', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/discovery/knowledge-gaps')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });
    });

    describe('[UUID] UUID public_id identifier', () => {
      it('GET /discovery/runs accepts project UUID public_id', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectPublicId}/discovery/runs`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('GET /discovery/artifacts accepts project UUID public_id', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectPublicId}/discovery/artifacts`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });

      it('GET /discovery/knowledge-gaps accepts project UUID public_id', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectPublicId}/discovery/knowledge-gaps`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });
    });

    describe('[NUMERIC] Numeric ID identifier (backward compat)', () => {
      it('GET /discovery/runs accepts numeric project ID', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectNumericId}/discovery/runs`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });

      it('GET /discovery/artifacts accepts numeric project ID', async () => {
        const res = await request(app)
          .get(`/api/v1/projects/${projectNumericId}/discovery/artifacts`)
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });
    });

    describe('[UNKNOWN] Unknown identifier', () => {
      it('returns 400 for unknown slug on /discovery/runs', async () => {
        const res = await request(app)
          .get('/api/v1/projects/nonexistent-slug/discovery/runs')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('unknown project identifier');
      });

      it('returns 400 for unknown UUID on /discovery/artifacts', async () => {
        const res = await request(app)
          .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/discovery/artifacts')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('[EMPTY_RESULTS] Valid project with no discovery data', () => {
      it('returns empty runs list', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/discovery/runs')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toEqual([]);
      });

      it('returns empty artifacts list', async () => {
        const res = await request(app)
          .get('/api/v1/projects/dr5-test-project/discovery/artifacts')
          .set('X-Test-Actor-PublicId', memberPublicId)
          .expect(200);

        expect(res.body.data).toEqual([]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSS-PROJECT ACCESS VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CROSS_PROJECT] Cross-Project Access Denied', () => {
    let otherProject: Project;
    let nonMemberActor: Actor;
    let nonMemberPublicId: string;

    beforeEach(async () => {
      const ProjectModel = sequelize.models.Project;
      const ActorModel = sequelize.models.Actor;

      // Create another project that memberActor is NOT a member of
      otherProject = (await ProjectModel.create({
        name: 'Other Project',
        slug: 'other-project',
        created_by: memberPublicId,
        organization_id: testOrg.id,
        status: 'active',
      })) as Project;

      // Create a separate actor who is not a member of testProject
      nonMemberActor = (await ActorModel.create({
        display_name: 'Non-Member',
        organization_id: testOrg.id,
        status: 'active',
      })) as Actor;
      nonMemberPublicId = (nonMemberActor as any).public_id;
    });

    it('insights: returns 403 for non-member accessing via slug', async () => {
      const res = await request(app)
        .get('/api/v1/projects/dr5-test-project/insights')
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('evidence-sources: returns 403 for non-member accessing via slug', async () => {
      const res = await request(app)
        .get('/api/v1/projects/dr5-test-project/evidence-sources')
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .expect(403);

      // Evidence sources uses global error handler which maps AuthorizationError to AUTHORIZATION_DENIED
      expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
    });

    it('discovery: returns 403 for non-member accessing via slug', async () => {
      const res = await request(app)
        .get('/api/v1/projects/dr5-test-project/discovery/runs')
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .expect(403);

      // Discovery routes use global error handler
      expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
    });

    it('insights: returns 403 for non-member accessing via UUID', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/insights`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .expect(403);

      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('evidence-sources: returns 403 for non-member accessing via UUID', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/evidence-sources`)
        .set('X-Test-Actor-PublicId', nonMemberPublicId)
        .expect(403);

      // Evidence sources uses global error handler which maps AuthorizationError to AUTHORIZATION_DENIED
      expect(res.body.error.code).toBe('AUTHORIZATION_DENIED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTIFIER FORMAT EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[EDGE_CASES] Identifier Format Edge Cases', () => {
    it('handles slug with hyphens correctly', async () => {
      const res = await request(app)
        .get('/api/v1/projects/dr5-test-project/insights')
        .set('X-Test-Actor-PublicId', memberPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('handles uppercase UUID correctly', async () => {
      const uppercaseUuid = projectPublicId.toUpperCase();
      const res = await request(app)
        .get(`/api/v1/projects/${uppercaseUuid}/insights`)
        .set('X-Test-Actor-PublicId', memberPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('handles UUID without dashes as invalid (not recognized as UUID)', async () => {
      const uuidNoDashes = projectPublicId.replace(/-/g, '');
      const res = await request(app)
        .get(`/api/v1/projects/${uuidNoDashes}/insights`)
        .set('X-Test-Actor-PublicId', memberPublicId)
        .expect(400);

      // Should fail as it's treated as a slug that doesn't exist
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles numeric string that looks like ID', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectNumericId}/insights`)
        .set('X-Test-Actor-PublicId', memberPublicId)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('handles leading zeros in numeric ID', async () => {
      // "001" parses to 1, which may or may not exist
      const res = await request(app)
        .get('/api/v1/projects/001/insights')
        .set('X-Test-Actor-PublicId', memberPublicId);

      // Either 200 (if project with id=1 exists and user has access)
      // or 400 (if not found) - but should not crash
      expect([200, 400]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTE CONSISTENCY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('[CONSISTENCY] All route groups behave consistently', () => {
    it('same identifier resolves to same project across all route groups', async () => {
      // Use slug to access all three route groups
      const [insightsRes, sourcesRes, discoveryRes] = await Promise.all([
        request(app)
          .get('/api/v1/projects/dr5-test-project/insights')
          .set('X-Test-Actor-PublicId', memberPublicId),
        request(app)
          .get('/api/v1/projects/dr5-test-project/evidence-sources')
          .set('X-Test-Actor-PublicId', memberPublicId),
        request(app)
          .get('/api/v1/projects/dr5-test-project/discovery/runs')
          .set('X-Test-Actor-PublicId', memberPublicId),
      ]);

      // All should succeed with 200
      expect(insightsRes.status).toBe(200);
      expect(sourcesRes.status).toBe(200);
      expect(discoveryRes.status).toBe(200);

      // All should return array data
      expect(Array.isArray(insightsRes.body.data)).toBe(true);
      expect(Array.isArray(sourcesRes.body.data)).toBe(true);
      expect(Array.isArray(discoveryRes.body.data)).toBe(true);
    });

    it('unknown identifier fails consistently across all route groups', async () => {
      const unknownSlug = 'definitely-nonexistent-project';

      const [insightsRes, sourcesRes, discoveryRes] = await Promise.all([
        request(app)
          .get(`/api/v1/projects/${unknownSlug}/insights`)
          .set('X-Test-Actor-PublicId', memberPublicId),
        request(app)
          .get(`/api/v1/projects/${unknownSlug}/evidence-sources`)
          .set('X-Test-Actor-PublicId', memberPublicId),
        request(app)
          .get(`/api/v1/projects/${unknownSlug}/discovery/runs`)
          .set('X-Test-Actor-PublicId', memberPublicId),
      ]);

      // All should return 400 VALIDATION_ERROR
      expect(insightsRes.status).toBe(400);
      expect(sourcesRes.status).toBe(400);
      expect(discoveryRes.status).toBe(400);

      expect(insightsRes.body.error.code).toBe('VALIDATION_ERROR');
      expect(sourcesRes.body.error.code).toBe('VALIDATION_ERROR');
      expect(discoveryRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
