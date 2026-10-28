/**
 * Category D: End-to-End Integration Tests — DISC-WEB-1B-2c
 *
 * Tests the complete upload → Discovery flow:
 * 1. Multipart upload → compiled worker → PostgreSQL staging
 * 2. Authenticated sourceRefs[] → DiscoveryRun + EvidenceSource
 * 3. Staging consumed → idempotent HTTP 200 replay
 * 4. Replay works even after staging cleanup
 *
 * Requires: PostgreSQL, compiled worker (npm run build)
 * Mocks: GitHub only
 * Never invokes: AI/LLM
 */

import request from 'supertest';
import { getTestApp } from '../setup/testApp';
import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import { randomUUID } from 'crypto';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';
import { STANDARD_TEXT } from '../../__fixtures__/documents/fixture-helper';

// Mock GitHub to prevent API calls
jest.mock('../../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockResolvedValue(null),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ success: true }),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
  getConfigRepo: jest.fn().mockReturnValue('test-config-repo'),
  checkFileExists: jest.fn().mockResolvedValue(false),
}));

// Save original env value for restoration
const ORIGINAL_FLAG_VALUE = process.env.DISC_WEB1_ENABLED;

describe('Category D: End-to-End Integration', () => {
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

    // Get test org
    const testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } });

    // Create test actor
    const actor = await ActorModel.create({
      display_name: 'E2E Test Researcher',
      organization_id: (testOrg as any).id,
      status: 'active',
    });
    testActorId = (actor as any).id;
    testActorPublicId = (actor as any).public_id;

    // Create test project
    const project = await ProjectModel.create({
      name: 'E2E Test Project',
      slug: 'e2e-test',
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

    // Enable feature flag for E2E tests
    process.env.DISC_WEB1_ENABLED = 'true';
  });

  afterEach(() => {
    if (ORIGINAL_FLAG_VALUE === undefined) {
      delete process.env.DISC_WEB1_ENABLED;
    } else {
      process.env.DISC_WEB1_ENABLED = ORIGINAL_FLAG_VALUE;
    }
  });

  afterAll(async () => {
    if (ORIGINAL_FLAG_VALUE === undefined) {
      delete process.env.DISC_WEB1_ENABLED;
    } else {
      process.env.DISC_WEB1_ENABLED = ORIGINAL_FLAG_VALUE;
    }
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL HAPPY PATH
  // ═══════════════════════════════════════════════════════════════════════════

  describe('full happy path', () => {
    it('upload → staging → sourceRefs → run → replay', async () => {
      const ExtractionStagingModel = sequelize.models.ExtractionStaging;
      const DiscoveryRunModel = sequelize.models.DiscoveryRun;
      const EvidenceSourceModel = sequelize.models.EvidenceSource;
      const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;

      // Step 1: Upload document
      const uploadRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT), { filename: 'e2e-test.txt', contentType: 'text/plain' })
        .expect(201);

      expect(uploadRes.body.data.refs).toHaveLength(1);
      const refToken = uploadRes.body.data.refs[0].refToken;
      const fileHash = uploadRes.body.data.refs[0].fileHash;
      const contentHash = uploadRes.body.data.refs[0].contentHash;

      // Verify staging row created
      const staging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
      expect(staging).not.toBeNull();
      expect((staging as any).status).toBe('ready');

      // Step 2: Create Discovery run with sourceRefs
      const idempotencyKey = randomUUID();
      const createRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          discoveryType: 'desk_research',
          topic: 'E2E Integration Test',
          sourceRefs: [refToken],
        })
        .expect(201);

      expect(createRes.body.data.publicId).toBeDefined();
      expect(createRes.body.data.status).toBe('pending');
      expect(createRes.body.meta.isReplay).toBe(false);

      const runPublicId = createRes.body.data.publicId;

      // Step 3: Verify staging consumed
      await staging?.reload();
      expect((staging as any).status).toBe('consumed');
      expect((staging as any).consumed_by_run_id).not.toBeNull();

      // Step 4: Verify DiscoveryRun created
      const run = await DiscoveryRunModel.findOne({ where: { public_id: runPublicId } });
      expect(run).not.toBeNull();
      expect((run as any).idempotency_key).toBe(idempotencyKey);

      // Step 5: Verify EvidenceSource with provenance
      const runSources = await DiscoveryRunSourceModel.findAll({
        where: { discovery_run_id: (run as any).id },
      });
      expect(runSources).toHaveLength(1);

      const evidenceSource = await EvidenceSourceModel.findByPk((runSources[0] as any).evidence_source_id);
      expect(evidenceSource).not.toBeNull();
      expect((evidenceSource as any).artifact_ref.file_hash).toBe(fileHash);
      expect((evidenceSource as any).artifact_ref.content_hash).toBe(contentHash);

      // Step 6: Idempotent replay returns 200
      const replayRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          discoveryType: 'desk_research',
          topic: 'E2E Integration Test',
          sourceRefs: [refToken],
        })
        .expect(200);

      expect(replayRes.body.data.publicId).toBe(runPublicId);
      expect(replayRes.body.meta.isReplay).toBe(true);
    });

    it('idempotent replay works after staging row is deleted', async () => {
      const ExtractionStagingModel = sequelize.models.ExtractionStaging;

      // Step 1: Upload and create run
      const uploadRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT), { filename: 'cleanup-test.txt', contentType: 'text/plain' })
        .expect(201);

      const refToken = uploadRes.body.data.refs[0].refToken;
      const idempotencyKey = randomUUID();

      const createRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          discoveryType: 'desk_research',
          topic: 'Cleanup Test',
          sourceRefs: [refToken],
        })
        .expect(201);

      const runPublicId = createRes.body.data.publicId;

      // Step 2: Delete staging row (simulating cleanup)
      await ExtractionStagingModel.destroy({ where: { ref_token: refToken } });

      // Verify staging is gone
      const deletedStaging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
      expect(deletedStaging).toBeNull();

      // Step 3: Idempotent replay still works (run exists, staging check skipped)
      const replayRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          discoveryType: 'desk_research',
          topic: 'Cleanup Test',
          sourceRefs: [refToken],
        })
        .expect(200);

      expect(replayRes.body.data.publicId).toBe(runPublicId);
      expect(replayRes.body.meta.isReplay).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIPLE REFS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('multiple refs', () => {
    it('consumes multiple refs atomically', async () => {
      const ExtractionStagingModel = sequelize.models.ExtractionStaging;

      // Upload two files
      const uploadRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file1', Buffer.from(STANDARD_TEXT + ' File 1'), { filename: 'file1.txt', contentType: 'text/plain' })
        .attach('file2', Buffer.from(STANDARD_TEXT + ' File 2'), { filename: 'file2.txt', contentType: 'text/plain' })
        .expect(201);

      expect(uploadRes.body.data.refs).toHaveLength(2);
      const refTokens = uploadRes.body.data.refs.map((r: any) => r.refToken);

      // Create run with both refs
      const createRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Multiple Refs Test',
          sourceRefs: refTokens,
        })
        .expect(201);

      expect(createRes.body.data.publicId).toBeDefined();

      // Verify both staging rows consumed
      for (const refToken of refTokens) {
        const staging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
        expect((staging as any).status).toBe('consumed');
      }
    });

    it('rolls back if any ref is unavailable', async () => {
      const ExtractionStagingModel = sequelize.models.ExtractionStaging;

      // Upload one file
      const uploadRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT), { filename: 'rollback.txt', contentType: 'text/plain' })
        .expect(201);

      const validRefToken = uploadRes.body.data.refs[0].refToken;
      const fakeRefToken = randomUUID();

      // Try to create run with valid + invalid ref
      await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Rollback Test',
          sourceRefs: [validRefToken, fakeRefToken],
        })
        .expect(410); // SOURCE_REF_UNAVAILABLE

      // Valid ref should still be 'ready' (rollback)
      const staging = await ExtractionStagingModel.findOne({ where: { ref_token: validRefToken } });
      expect((staging as any).status).toBe('ready');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT/ACTOR ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('project isolation', () => {
    it('rejects ref from different project', async () => {
      // Create another project
      const ProjectModel = sequelize.models.Project;
      const OrganizationModel = sequelize.models.Organization;
      const ProjectMembershipModel = sequelize.models.ProjectMembership;

      const testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } });
      const otherProject = await ProjectModel.create({
        name: 'Other Project',
        slug: 'other-project',
        created_by: testActorPublicId,
        organization_id: (testOrg as any).id,
        status: 'active',
      });
      const otherProjectPublicId = (otherProject as any).public_id;

      await ProjectMembershipModel.create({
        project_id: (otherProject as any).id,
        actor_id: testActorId,
        role: 'researcher',
        membership_source: 'explicit',
      });

      // Upload to first project
      const uploadRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT), { filename: 'project1.txt', contentType: 'text/plain' })
        .expect(201);

      const refToken = uploadRes.body.data.refs[0].refToken;

      // Try to use ref in different project
      await request(app)
        .post(`/api/v1/projects/${otherProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Cross-Project Test',
          sourceRefs: [refToken],
        })
        .expect(410); // SOURCE_REF_UNAVAILABLE
    });
  });

  describe('actor isolation', () => {
    it('rejects ref from different actor', async () => {
      // Create another actor
      const ActorModel = sequelize.models.Actor;
      const ProjectMembershipModel = sequelize.models.ProjectMembership;

      const otherActor = await ActorModel.create({
        display_name: 'Other Researcher',
        organization_id: TEST_ORG_ID,
        status: 'active',
      });
      const otherActorPublicId = (otherActor as any).public_id;

      await ProjectMembershipModel.create({
        project_id: testProjectId,
        actor_id: (otherActor as any).id,
        role: 'researcher',
        membership_source: 'explicit',
      });

      // Upload as first actor
      const uploadRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT), { filename: 'actor1.txt', contentType: 'text/plain' })
        .expect(201);

      const refToken = uploadRes.body.data.refs[0].refToken;

      // Try to use ref as different actor
      await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', otherActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Cross-Actor Test',
          sourceRefs: [refToken],
        })
        .expect(410); // SOURCE_REF_UNAVAILABLE
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEMPOTENCY CONFLICT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('idempotency conflict', () => {
    it('returns 409 for same key with different payload', async () => {
      // Upload first file
      const uploadRes1 = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT), { filename: 'first.txt', contentType: 'text/plain' })
        .expect(201);

      const refToken1 = uploadRes1.body.data.refs[0].refToken;
      const idempotencyKey = randomUUID();

      // Create run
      await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          discoveryType: 'desk_research',
          topic: 'First Topic',
          sourceRefs: [refToken1],
        })
        .expect(201);

      // Upload second file
      const uploadRes2 = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT + ' different'), { filename: 'second.txt', contentType: 'text/plain' })
        .expect(201);

      const refToken2 = uploadRes2.body.data.refs[0].refToken;

      // Try same key with different topic
      const conflictRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          discoveryType: 'desk_research',
          topic: 'Different Topic', // Different!
          sourceRefs: [refToken2],
        })
        .expect(409);

      expect(conflictRes.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE PRESERVATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('provenance preservation', () => {
    it('EvidenceSource has immutable file_hash and content_hash', async () => {
      const EvidenceSourceModel = sequelize.models.EvidenceSource;
      const DiscoveryRunModel = sequelize.models.DiscoveryRun;
      const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;

      const uploadRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .attach('file', Buffer.from(STANDARD_TEXT), { filename: 'provenance.txt', contentType: 'text/plain' })
        .expect(201);

      const expectedFileHash = uploadRes.body.data.refs[0].fileHash;
      const expectedContentHash = uploadRes.body.data.refs[0].contentHash;
      const refToken = uploadRes.body.data.refs[0].refToken;

      const createRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Idempotency-Key', randomUUID())
        .send({
          discoveryType: 'desk_research',
          topic: 'Provenance Test',
          sourceRefs: [refToken],
        })
        .expect(201);

      const run = await DiscoveryRunModel.findOne({
        where: { public_id: createRes.body.data.publicId },
      });

      const runSource = await DiscoveryRunSourceModel.findOne({
        where: { discovery_run_id: (run as any).id },
      });

      const evidenceSource = await EvidenceSourceModel.findByPk((runSource as any).evidence_source_id);

      // Verify hashes match exactly
      expect((evidenceSource as any).artifact_ref.file_hash).toBe(expectedFileHash);
      expect((evidenceSource as any).artifact_ref.content_hash).toBe(expectedContentHash);

      // Verify hashes are 64-character hex
      expect(expectedFileHash).toMatch(/^[a-f0-9]{64}$/);
      expect(expectedContentHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY sources[] REGRESSION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('legacy sources[] regression', () => {
    it('legacy sources[] still works alongside sourceRefs', async () => {
      // Legacy path should work
      const legacyRes = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/discovery/runs`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .send({
          discoveryType: 'desk_research',
          topic: 'Legacy Test',
          sources: [{
            filename: 'legacy.txt',
            extractedText: STANDARD_TEXT,
            contentHash: 'a'.repeat(64),
            mimeType: 'text/plain',
            sizeBytes: STANDARD_TEXT.length,
          }],
        })
        .expect(201);

      expect(legacyRes.body.data.publicId).toBeDefined();
      expect(legacyRes.body.data.status).toBe('pending');
    });
  });
});
