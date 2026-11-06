/**
 * Feature Flag Tests for Readout AI Generation — DISC-WEB-2
 *
 * HTTP-level tests verifying READOUT_AI_ENABLED feature flag enforcement:
 * - POST /generate returns 503 FEATURE_DISABLED when flag is unset/false
 * - POST /generate proceeds when flag is true
 * - No generation job created when disabled
 * - Other readout endpoints remain unaffected by the flag
 */

import request from 'supertest';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll } from './setup/testDb';
import { randomUUID } from 'crypto';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { ResearchStudy } from '../../database/models/research_study';

// Save original env value for restoration
const ORIGINAL_FLAG_VALUE = process.env.READOUT_AI_ENABLED;

describe('DISC-WEB-2 Readout AI Feature Flag', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let testStudy: ResearchStudy;
  let researcherActor: Actor;

  // IDs
  let projectId: number;
  let projectPublicId: string;
  let studyId: number;
  let studyPublicId: string;
  let researcherActorId: number;
  let researcherPublicId: string;

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

    // Create test actor (researcher)
    researcherActor = await ActorModel.create({
      display_name: 'Test Researcher',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;
    researcherActorId = (researcherActor as any).id;
    researcherPublicId = (researcherActor as any).public_id;

    // Create test project
    testProject = await ProjectModel.create({
      name: 'Readout AI Flag Test Project',
      slug: 'readout-ai-flag-test',
      created_by: researcherPublicId,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
    projectId = (testProject as any).id;
    projectPublicId = (testProject as any).public_id;

    // Create test study
    testStudy = await StudyModel.create({
      name: 'Readout AI Flag Test Study',
      project_id: projectId,
      created_by: researcherPublicId,
      channel_name: 'readout-ai-flag-test-channel',
      researcher_name: 'Test Researcher',
      researcher_email: 'researcher@test.com',
      status: 'active',
    }) as ResearchStudy;
    studyId = (testStudy as any).id;
    studyPublicId = (testStudy as any).public_id;

    // Create researcher membership
    await ProjectMembershipModel.create({
      project_id: projectId,
      actor_id: researcherActorId,
      role: 'researcher',
      membership_source: 'explicit',
    });
  });

  afterEach(() => {
    // Restore original flag value after each test
    if (ORIGINAL_FLAG_VALUE === undefined) {
      delete process.env.READOUT_AI_ENABLED;
    } else {
      process.env.READOUT_AI_ENABLED = ORIGINAL_FLAG_VALUE;
    }
  });

  afterAll(async () => {
    // Final restoration
    if (ORIGINAL_FLAG_VALUE === undefined) {
      delete process.env.READOUT_AI_ENABLED;
    } else {
      process.env.READOUT_AI_ENABLED = ORIGINAL_FLAG_VALUE;
    }
    await sequelize.close();
  });

  // Helper to create a readout
  async function createReadout(title: string = 'Test Readout'): Promise<string> {
    const res = await request(app)
      .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts`)
      .set('X-Test-Actor-PublicId', researcherPublicId)
      .send({ title, question: 'Test question?' })
      .expect(201);

    return res.body.data.publicId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG UNSET — POST /generate returns 503
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flag unset (default disabled)', () => {
    beforeEach(() => {
      delete process.env.READOUT_AI_ENABLED;
    });

    it('POST /generate returns 503 FEATURE_DISABLED', async () => {
      const readoutPublicId = await createReadout();

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/generate`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          idempotencyKey: randomUUID().replace(/-/g, '').slice(0, 32),
          selectedRevisionIds: ['test-revision-id'],
        })
        .expect(503);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
      expect(res.body.error.message).toBe('Readout AI generation is not available');
    });

    it('creates no generation version', async () => {
      const readoutPublicId = await createReadout();
      const VersionModel = sequelize.models.DeskResearchReadoutVersion;

      const countBefore = await VersionModel.count();

      await request(app)
        .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/generate`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          idempotencyKey: randomUUID().replace(/-/g, '').slice(0, 32),
          selectedRevisionIds: ['test-revision-id'],
        })
        .expect(503);

      const countAfter = await VersionModel.count();
      expect(countAfter).toBe(countBefore);
    });

    it('other readout endpoints remain available', async () => {
      const readoutPublicId = await createReadout();

      // GET readout should work
      const getRes = await request(app)
        .get(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .expect(200);

      expect(getRes.body.data.publicId).toBe(readoutPublicId);

      // GET eligibility should work
      await request(app)
        .get(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/eligibility`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .expect(200);

      // GET versions should work
      await request(app)
        .get(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/versions`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .expect(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG EXPLICITLY FALSE — POST /generate returns 503
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flag explicitly false', () => {
    beforeEach(() => {
      process.env.READOUT_AI_ENABLED = 'false';
    });

    it('POST /generate returns 503 FEATURE_DISABLED', async () => {
      const readoutPublicId = await createReadout();

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/generate`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          idempotencyKey: randomUUID().replace(/-/g, '').slice(0, 32),
          selectedRevisionIds: ['test-revision-id'],
        })
        .expect(503);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
    });

    it('creates no mutations', async () => {
      const readoutPublicId = await createReadout();
      const VersionModel = sequelize.models.DeskResearchReadoutVersion;

      const countBefore = await VersionModel.count();

      await request(app)
        .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/generate`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          idempotencyKey: randomUUID().replace(/-/g, '').slice(0, 32),
          selectedRevisionIds: ['test-revision-id'],
        })
        .expect(503);

      expect(await VersionModel.count()).toBe(countBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG TRUE — POST /generate proceeds (gate passes)
  // Full generation flow tested elsewhere; here we only verify gate behavior
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flag true (enabled)', () => {
    beforeEach(() => {
      process.env.READOUT_AI_ENABLED = 'true';
    });

    it('does NOT return 503 FEATURE_DISABLED', async () => {
      const readoutPublicId = await createReadout();

      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/generate`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          idempotencyKey: randomUUID().replace(/-/g, '').slice(0, 32),
          selectedRevisionIds: ['test-revision-id'],
        });

      // The key assertion: flag enabled should NOT return FEATURE_DISABLED
      // May return 422 (evidence selection error) or other validation errors,
      // but NOT 503 FEATURE_DISABLED
      expect(res.status).not.toBe(503);
      if (res.body.error) {
        expect(res.body.error.code).not.toBe('FEATURE_DISABLED');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHORIZATION STILL ENFORCED — flag doesn't bypass auth
  // ═══════════════════════════════════════════════════════════════════════════

  describe('authorization still enforced when flag enabled', () => {
    beforeEach(() => {
      process.env.READOUT_AI_ENABLED = 'true';
    });

    it('requires authentication', async () => {
      const readoutPublicId = await createReadout();

      await request(app)
        .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${readoutPublicId}/generate`)
        // No X-Test-Actor-PublicId header
        .send({
          idempotencyKey: randomUUID().replace(/-/g, '').slice(0, 32),
          selectedRevisionIds: [randomUUID()], // Use valid UUID format
        })
        .expect(401);
    });

    // Note: Role authorization (researcher requirement) is tested in dr6b-readout-api.test.ts
    // This test file focuses specifically on the READOUT_AI_ENABLED feature flag
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE GATE CHECKED BEFORE RESOURCE RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('gate checked before resource resolution', () => {
    beforeEach(() => {
      delete process.env.READOUT_AI_ENABLED;
    });

    it('returns 503 even for non-existent readout', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectPublicId}/studies/${studyPublicId}/readouts/${randomUUID()}/generate`)
        .set('X-Test-Actor-PublicId', researcherPublicId)
        .send({
          idempotencyKey: randomUUID().replace(/-/g, '').slice(0, 32),
          selectedRevisionIds: ['test-revision-id'],
        })
        .expect(503);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
    });
  });
});
