/**
 * Upload Admission Control Tests — DISC-WEB-1B-2d
 *
 * Deterministic tests for HTTP request admission control.
 *
 * These tests verify:
 * - Admission limit (2 active, 0 queued by default)
 * - 503 rejection BEFORE body parsing for excess requests
 * - Permit release guarantees
 * - No staging rows on rejected requests
 * - Double release safety
 *
 * Note: Full extraction flow tests are in extraction-routes.test.ts.
 * This suite focuses on admission control behavior in isolation.
 */

import request from 'supertest';
import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import { getTestApp } from '../setup/testApp';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';

import {
  getUploadAdmissionStatus,
  acquireUploadAdmission,
  UploadBusyError,
  EXTRACTION_LIMITS,
  __resetUploadAdmissionForTesting,
} from '../../../services/extraction';

// Save original env values
const ORIGINAL_FLAG_VALUE = process.env.DISC_WEB1_ENABLED;

describe('Upload Admission Control — DISC-WEB-1B-2d', () => {
  let sequelize: Sequelize;
  let app: Express;
  let testProjectPublicId: string;
  let testActorPublicId: string;

  beforeAll(async () => {
    sequelize = getTestDb();
    app = getTestApp();
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await truncateAll();

    const OrganizationModel = sequelize.models.Organization;
    const ProjectModel = sequelize.models.Project;
    const ActorModel = sequelize.models.Actor;
    const ProjectMembershipModel = sequelize.models.ProjectMembership;

    const testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } });

    const actor = await ActorModel.create({
      display_name: 'Upload Test Researcher',
      organization_id: (testOrg as any).id,
      status: 'active',
    });
    testActorPublicId = (actor as any).public_id;

    const project = await ProjectModel.create({
      name: 'Upload Test Project',
      slug: 'upload-test',
      created_by: testActorPublicId,
      organization_id: (testOrg as any).id,
      status: 'active',
    });
    testProjectPublicId = (project as any).public_id;

    await ProjectMembershipModel.create({
      project_id: (project as any).id,
      actor_id: (actor as any).id,
      role: 'researcher',
      membership_source: 'explicit',
    });

    process.env.DISC_WEB1_ENABLED = 'true';
  });

  afterEach(() => {
    // Reset upload admission semaphore to prevent permit leaks between tests
    __resetUploadAdmissionForTesting();

    if (ORIGINAL_FLAG_VALUE === undefined) {
      delete process.env.DISC_WEB1_ENABLED;
    } else {
      process.env.DISC_WEB1_ENABLED = ORIGINAL_FLAG_VALUE;
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('admission semaphore behavior', () => {
    it('default capacity is 2 active, 0 queued', () => {
      const status = getUploadAdmissionStatus();
      expect(status.max).toBe(2);
      expect(status.maxQueued).toBe(0);
      expect(status.available).toBeLessThanOrEqual(status.max);
    });

    it('acquire and release work correctly', async () => {
      const status1 = getUploadAdmissionStatus();
      const initialAvailable = status1.available;

      const release1 = await acquireUploadAdmission();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable - 1);

      const release2 = await acquireUploadAdmission();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable - 2);

      // Third acquire should throw (no queue allowed)
      await expect(acquireUploadAdmission()).rejects.toThrow(UploadBusyError);

      // Release permits
      release1();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable - 1);

      release2();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);
    });

    it('double release is safely ignored', async () => {
      const initialAvailable = getUploadAdmissionStatus().available;

      const release = await acquireUploadAdmission();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable - 1);

      // First release
      release();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);

      // Second release (should be no-op)
      release();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);

      // Third release (should be no-op)
      release();
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);
    });

    it('UploadBusyError has correct code', async () => {
      const release1 = await acquireUploadAdmission();
      const release2 = await acquireUploadAdmission();

      try {
        await acquireUploadAdmission();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UploadBusyError);
        expect((error as UploadBusyError).code).toBe('EXTRACTION_UPLOAD_BUSY');
      } finally {
        release1();
        release2();
      }
    });

    it('permits recovered after exception in usage', async () => {
      const initialAvailable = getUploadAdmissionStatus().available;

      const release = await acquireUploadAdmission();

      // Simulate usage pattern with error - error is caught but permit is released
      try {
        try {
          throw new Error('Simulated error');
        } finally {
          release();
        }
      } catch {
        // Expected - error was thrown
      }

      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);
    });
  });

  describe('HTTP admission rejection', () => {
    it('third concurrent request receives 503 EXTRACTION_UPLOAD_BUSY', async () => {
      // Acquire both permits manually to simulate busy state
      const release1 = await acquireUploadAdmission();
      const release2 = await acquireUploadAdmission();

      try {
        // Now an HTTP request should be rejected immediately
        const res = await request(app)
          .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
          .set('X-Test-Actor-PublicId', testActorPublicId)
          .set('Content-Type', 'multipart/form-data; boundary=test')
          .send('--test\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\ntest\r\n--test--');

        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe('EXTRACTION_UPLOAD_BUSY');
        expect(res.body.error.message).toContain('busy');
      } finally {
        release1();
        release2();
      }
    });

    it('rejection happens BEFORE body is consumed', async () => {
      const release1 = await acquireUploadAdmission();
      const release2 = await acquireUploadAdmission();

      const ExtractionStagingModel = sequelize.models.ExtractionStaging;
      const countBefore = await ExtractionStagingModel.count();

      try {
        // Large payload that would be rejected before parsing
        const largeContent = 'x'.repeat(10000);
        const res = await request(app)
          .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
          .set('X-Test-Actor-PublicId', testActorPublicId)
          .attach('file', Buffer.from(largeContent), {
            filename: 'should-not-be-parsed.txt',
            contentType: 'text/plain',
          });

        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe('EXTRACTION_UPLOAD_BUSY');

        // No staging rows created (body never parsed)
        const countAfter = await ExtractionStagingModel.count();
        expect(countAfter).toBe(countBefore);
      } finally {
        release1();
        release2();
      }
    });

    it('rejection does not leak permits', async () => {
      const initialAvailable = getUploadAdmissionStatus().available;

      // Acquire both permits
      const release1 = await acquireUploadAdmission();
      const release2 = await acquireUploadAdmission();

      try {
        // Make request that will be rejected
        await request(app)
          .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
          .set('X-Test-Actor-PublicId', testActorPublicId)
          .set('Content-Type', 'multipart/form-data; boundary=test')
          .send('--test--');

        // Permit count unchanged (rejected request didn't acquire)
        expect(getUploadAdmissionStatus().available).toBe(0);
      } finally {
        release1();
        release2();
      }

      // All permits recovered after manual releases
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);
    });
  });

  describe('no staging rows on rejection', () => {
    it('no staging rows created when admission rejected', async () => {
      const ExtractionStagingModel = sequelize.models.ExtractionStaging;
      const countBefore = await ExtractionStagingModel.count();

      const release1 = await acquireUploadAdmission();
      const release2 = await acquireUploadAdmission();

      try {
        const testContent = 'This content should never be staged because admission was rejected.';
        const res = await request(app)
          .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
          .set('X-Test-Actor-PublicId', testActorPublicId)
          .attach('file', Buffer.from(testContent), {
            filename: 'never-staged.txt',
            contentType: 'text/plain',
          });

        expect(res.status).toBe(503);

        const countAfter = await ExtractionStagingModel.count();
        expect(countAfter).toBe(countBefore);
      } finally {
        release1();
        release2();
      }
    });
  });

  describe('pre-admission errors do not consume permits', () => {
    it('feature disabled error does not consume permit', async () => {
      const initialAvailable = getUploadAdmissionStatus().available;

      process.env.DISC_WEB1_ENABLED = 'false';

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Content-Type', 'multipart/form-data; boundary=test')
        .send('--test--');

      process.env.DISC_WEB1_ENABLED = 'true';

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('FEATURE_DISABLED');

      // No permit consumed
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);
    });

    it('invalid content type error does not consume permit', async () => {
      const initialAvailable = getUploadAdmissionStatus().available;

      const res = await request(app)
        .post(`/api/v1/projects/${testProjectPublicId}/extraction/documents`)
        .set('X-Test-Actor-PublicId', testActorPublicId)
        .set('Content-Type', 'application/json')
        .send('{}');

      expect(res.status).toBe(400);

      // No permit consumed
      expect(getUploadAdmissionStatus().available).toBe(initialAvailable);
    });
  });

  describe('configuration', () => {
    it('EXTRACTION_LIMITS includes upload settings', () => {
      expect(EXTRACTION_LIMITS.MAX_UPLOAD_REQUESTS).toBe(2);
      expect(EXTRACTION_LIMITS.MAX_UPLOAD_QUEUED).toBe(0);
      expect(EXTRACTION_LIMITS.UPLOAD_TIMEOUT_MS).toBe(120000);
    });

    it('upload timeout is 2 minutes by default', () => {
      expect(EXTRACTION_LIMITS.UPLOAD_TIMEOUT_MS).toBe(120_000);
    });
  });
});
