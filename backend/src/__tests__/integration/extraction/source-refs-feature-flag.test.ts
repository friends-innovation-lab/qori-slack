/**
 * Feature Flag Tests for Discovery sourceRefs[] — DISC-WEB-1B-2b
 *
 * HTTP-level tests verifying DISC_WEB1_ENABLED feature flag enforcement:
 * - sourceRefs[] returns 503 FEATURE_DISABLED when flag is unset/false
 * - sourceRefs[] proceeds when flag is true
 * - Legacy sources[] remains unaffected by flag
 * - Disabled requests create no mutations
 */

import request from 'supertest';
import { getTestApp } from '../setup/testApp';
import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import { createStagingRow } from '../../../services/extraction';
import { randomUUID } from 'crypto';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';

// Save original env value for restoration
const ORIGINAL_FLAG_VALUE = process.env.DISC_WEB1_ENABLED;

describe('DISC-WEB-1B-2b Feature Flag', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testProjectId: number;
  let testProjectPublicId: string;
  let testActorId: number;
  let testActorPublicId: string;

  beforeAll(async () => {
    app = getTestApp();
    sequelize = getTestDb();
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await truncateAll();

    const OrganizationModel = sequelize.models.Organization;
    const ProjectModel = sequelize.models.Project;
    const ActorModel = sequelize.models.Actor;
    const ProjectMembershipModel = sequelize.models.ProjectMembership;

    // Get test org (created by truncateAll)
    const testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } });

    // Create test actor
    const actor = await ActorModel.create({
      display_name: 'Test Researcher',
      organization_id: (testOrg as any).id,
      status: 'active',
    });
    testActorId = (actor as any).id;
    testActorPublicId = (actor as any).public_id;

    // Create test project
    const project = await ProjectModel.create({
      name: 'Feature Flag Test Project',
      slug: 'feature-flag-test',
      created_by: testActorPublicId,
      organization_id: (testOrg as any).id,
      status: 'active',
    });
    testProjectId = (project as any).id;
    testProjectPublicId = (project as any).public_id;

    // Create researcher membership
    await ProjectMembershipModel.create({
      project_id: testProjectId,
      actor_id: testActorId,
      role: 'researcher',
      membership_source: 'explicit',
    });
  });

  afterEach(() => {
    // Restore original flag value after each test
    if (ORIGINAL_FLAG_VALUE === undefined) {
      delete process.env.DISC_WEB1_ENABLED;
    } else {
      process.env.DISC_WEB1_ENABLED = ORIGINAL_FLAG_VALUE;
    }
  });

  afterAll(async () => {
    // Final restoration
    if (ORIGINAL_FLAG_VALUE === undefined) {
      delete process.env.DISC_WEB1_ENABLED;
    } else {
      process.env.DISC_WEB1_ENABLED = ORIGINAL_FLAG_VALUE;
    }
    await sequelize.close();
  });

  // Helper to create a staging row
  async function createTestStaging(): Promise<string> {
    const staging = await createStagingRow({
      projectId: testProjectId,
      actorId: testActorId,
      filename: `test-${randomUUID()}.txt`,
      mimeType: 'text/plain',
      fileSizeBytes: 1024,
      fileHash: 'a'.repeat(64),
      contentHash: 'b'.repeat(64),
      extractedText: 'Test content for feature flag verification.',
      charCount: 44,
    });
    return staging.ref_token;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG UNSET — sourceRefs[] returns 503
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flag unset', () => {
    beforeEach(() => {
      delete process.env.DISC_WEB1_ENABLED;
    });

    it('sourceRefs[] returns 503 FEATURE_DISABLED', async () => {
      const refToken = await createTestStaging();

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Flag Unset Test',
          sourceRefs: [refToken],
        })
        .expect(503);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
      expect(res.body.error.message).toBe('Source reference consumption is not available');
    });

    it('creates no DiscoveryRun', async () => {
      const refToken = await createTestStaging();
      const DiscoveryRunModel = sequelize.models.DiscoveryRun;

      const countBefore = await DiscoveryRunModel.count();

      await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'No Mutation Test',
          sourceRefs: [refToken],
        })
        .expect(503);

      const countAfter = await DiscoveryRunModel.count();
      expect(countAfter).toBe(countBefore);
    });

    it('creates no EvidenceSource', async () => {
      const refToken = await createTestStaging();
      const EvidenceSourceModel = sequelize.models.EvidenceSource;

      const countBefore = await EvidenceSourceModel.count();

      await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'No EvidenceSource Test',
          sourceRefs: [refToken],
        })
        .expect(503);

      const countAfter = await EvidenceSourceModel.count();
      expect(countAfter).toBe(countBefore);
    });

    it('does not consume staging ref', async () => {
      const refToken = await createTestStaging();
      const ExtractionStagingModel = sequelize.models.ExtractionStaging;

      await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'No Consumption Test',
          sourceRefs: [refToken],
        })
        .expect(503);

      // Verify staging is still 'ready'
      const staging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
      expect((staging as any).status).toBe('ready');
    });

    it('legacy sources[] remains available', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .send({
          discoveryType: 'desk_research',
          topic: 'Legacy Sources Test',
          sources: [{
            filename: 'test.txt',
            extractedText: 'Sample content for legacy path.',
            contentHash: 'c'.repeat(64),
            mimeType: 'text/plain',
            sizeBytes: 100,
          }],
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.publicId).toBeDefined();
      expect(res.body.data.status).toBe('pending');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG EXPLICITLY FALSE — sourceRefs[] returns 503
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flag explicitly false', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'false';
    });

    it('sourceRefs[] returns 503 FEATURE_DISABLED', async () => {
      const refToken = await createTestStaging();

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Flag False Test',
          sourceRefs: [refToken],
        })
        .expect(503);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
    });

    it('creates no mutations', async () => {
      const refToken = await createTestStaging();
      const DiscoveryRunModel = sequelize.models.DiscoveryRun;
      const EvidenceSourceModel = sequelize.models.EvidenceSource;
      const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;

      const runCountBefore = await DiscoveryRunModel.count();
      const sourceCountBefore = await EvidenceSourceModel.count();
      const assocCountBefore = await DiscoveryRunSourceModel.count();

      await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'No Mutations Test',
          sourceRefs: [refToken],
        })
        .expect(503);

      expect(await DiscoveryRunModel.count()).toBe(runCountBefore);
      expect(await EvidenceSourceModel.count()).toBe(sourceCountBefore);
      expect(await DiscoveryRunSourceModel.count()).toBe(assocCountBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG TRUE — sourceRefs[] proceeds (gate passes)
  // Full flow tested in source-refs.test.ts; here we only verify gate behavior
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flag true', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('does NOT return 503 FEATURE_DISABLED', async () => {
      const refToken = await createTestStaging();

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Flag Enabled Test',
          sourceRefs: [refToken],
        });

      // The key assertion: flag enabled should NOT return FEATURE_DISABLED
      // (Full 201 flow is tested in source-refs.test.ts)
      expect(res.status).not.toBe(503);
      if (res.body.error) {
        expect(res.body.error.code).not.toBe('FEATURE_DISABLED');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY — sources[] unaffected by flag
  // ═══════════════════════════════════════════════════════════════════════════

  describe('legacy sources[] compatibility', () => {
    it('works when flag is unset', async () => {
      delete process.env.DISC_WEB1_ENABLED;

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .send({
          discoveryType: 'desk_research',
          topic: 'Legacy Unset Test',
          sources: [{
            filename: 'test.txt',
            extractedText: 'Content for legacy test.',
            contentHash: 'd'.repeat(64),
            mimeType: 'text/plain',
            sizeBytes: 50,
          }],
        })
        .expect(201);

      expect(res.body.data.publicId).toBeDefined();
    });

    it('works when flag is false', async () => {
      process.env.DISC_WEB1_ENABLED = 'false';

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .send({
          discoveryType: 'desk_research',
          topic: 'Legacy False Test',
          sources: [{
            filename: 'test.txt',
            extractedText: 'Content for legacy test with flag false.',
            contentHash: 'e'.repeat(64),
            mimeType: 'text/plain',
            sizeBytes: 60,
          }],
        })
        .expect(201);

      expect(res.body.data.publicId).toBeDefined();
    });

    it('works when flag is true', async () => {
      process.env.DISC_WEB1_ENABLED = 'true';

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .send({
          discoveryType: 'desk_research',
          topic: 'Legacy True Test',
          sources: [{
            filename: 'test.txt',
            extractedText: 'Content for legacy test with flag true.',
            contentHash: 'f'.repeat(64),
            mimeType: 'text/plain',
            sizeBytes: 70,
          }],
        })
        .expect(201);

      expect(res.body.data.publicId).toBeDefined();
    });
  });
});
