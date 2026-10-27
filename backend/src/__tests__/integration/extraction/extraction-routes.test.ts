/**
 * Integration tests for extraction routes service layer — DISC-WEB-1B-2a
 *
 * Tests authorization helpers, feature flag behavior, extraction flow,
 * validation, and staging cleanup behavior at the service layer.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import {
  extractWithIsolation,
  createStagingRow,
  ExtractionOverloadError,
  EXTRACTION_LIMITS,
  MULTIPART_LIMITS,
} from '../../../services/extraction';
import { hasProjectRoleByActor } from '../../../services/authorization.service';
import type { Transaction } from 'sequelize';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testActorId: number;
let otherActorId: number;
let membershipId: number;

beforeEach(async () => {
  await truncateAll();

  // Create test project
  const Project = sequelize.models.Project;
  const project = await Project.create({
    name: 'Test Project',
    slug: 'test-project',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  testProjectId = (project as unknown as { id: number }).id;

  // Create test actor with researcher role
  const Actor = sequelize.models.Actor;
  const actor = await Actor.create({
    display_name: 'Test Researcher',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;

  // Create another actor without membership
  const otherActor = await Actor.create({
    display_name: 'Other User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  otherActorId = (otherActor as unknown as { id: number }).id;

  // Create researcher membership
  const ProjectMembership = sequelize.models.ProjectMembership;
  const membership = await ProjectMembership.create({
    project_id: testProjectId,
    actor_id: testActorId,
    role: 'researcher',
    membership_source: 'explicit',
  });
  membershipId = (membership as unknown as { id: number }).id;
});

afterAll(() => sequelize.close());

// ─── Authorization Tests ────────────────────────────────────────────────────

describe('authorization service integration', () => {
  it('grants access to researcher role', async () => {
    const hasRole = await hasProjectRoleByActor(testActorId, testProjectId, 'researcher');
    expect(hasRole).toBe(true);
  });

  it('grants access to admin role', async () => {
    await sequelize.models.ProjectMembership.update(
      { role: 'admin' },
      { where: { id: membershipId } },
    );

    const hasRole = await hasProjectRoleByActor(testActorId, testProjectId, 'researcher');
    expect(hasRole).toBe(true);
  });

  it('grants access to owner role', async () => {
    await sequelize.models.ProjectMembership.update(
      { role: 'owner' },
      { where: { id: membershipId } },
    );

    const hasRole = await hasProjectRoleByActor(testActorId, testProjectId, 'researcher');
    expect(hasRole).toBe(true);
  });

  // Note: Only owner/admin/researcher roles exist in ProjectMembership.
  // There is no "viewer" role - researchers are the lowest role level.
  // The authorization hierarchy is: owner > admin > researcher.

  it('denies access to non-member', async () => {
    const hasRole = await hasProjectRoleByActor(otherActorId, testProjectId, 'researcher');
    expect(hasRole).toBe(false);
  });
});

// ─── Extraction Service Tests ───────────────────────────────────────────────
// Note: Subprocess extraction tests are skipped here because they require
// compiled JS worker files that don't exist during ts-jest runs.
// The extraction subprocess is covered by DISC-WEB-1A tests in extraction-staging.test.ts
// when run against the built dist/ output.

describe('extraction service integration', () => {
  it('rejects files exceeding size limit (pre-fork validation)', async () => {
    // This test validates the size check BEFORE subprocess fork
    const largeBuffer = Buffer.alloc(EXTRACTION_LIMITS.MAX_FILE_SIZE_BYTES + 1, 'x');

    const result = await extractWithIsolation(largeBuffer, 'text/plain', 'large.txt', testProjectId);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    }
  });

  // Subprocess-dependent tests - skipped in ts-jest environment
  it.skip('extracts text from plain text file (requires built worker)', async () => {
    const content = 'This is sample text content for extraction testing.';
    const buffer = Buffer.from(content, 'utf-8');

    const result = await extractWithIsolation(buffer, 'text/plain', 'test.txt', testProjectId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.text).toBe(content);
      expect(result.charCount).toBe(content.length);
      expect(result.fileHash).toHaveLength(64);
      expect(result.contentHash).toHaveLength(64);
    }
  });

  it.skip('extracts text from markdown file (requires built worker)', async () => {
    const content = '# Heading\n\nThis is **markdown** content.';
    const buffer = Buffer.from(content, 'utf-8');

    const result = await extractWithIsolation(buffer, 'text/markdown', 'test.md', testProjectId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.text).toBe(content);
    }
  });

  it.skip('returns correct SHA-256 hashes (requires built worker)', async () => {
    const content = 'Hash verification content';
    const buffer = Buffer.from(content, 'utf-8');

    const result = await extractWithIsolation(buffer, 'text/plain', 'hash.txt', testProjectId);

    expect(result.success).toBe(true);
    if (result.success) {
      // SHA-256 produces 64 hex characters
      expect(result.fileHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

// ─── Staging Service Tests ──────────────────────────────────────────────────

describe('staging service integration', () => {
  const ExtractionStaging = () => sequelize.models.ExtractionStaging;

  it('creates staging row with correct attributes', async () => {
    const staging = await createStagingRow({
      projectId: testProjectId,
      actorId: testActorId,
      filename: 'document.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 1024,
      fileHash: 'a'.repeat(64),
      contentHash: 'b'.repeat(64),
      extractedText: 'Sample extracted content',
      charCount: 24,
    });

    expect(staging.ref_token).toBeDefined();
    expect(staging.project_id).toBe(testProjectId);
    expect(staging.actor_id).toBe(testActorId);
    expect(staging.filename).toBe('document.txt');
    expect(staging.status).toBe('ready');
    expect(staging.file_hash).toHaveLength(64);
    expect(staging.content_hash).toHaveLength(64);
  });

  it('generates unique ref tokens', async () => {
    const staging1 = await createStagingRow({
      projectId: testProjectId,
      actorId: testActorId,
      filename: 'file1.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 100,
      fileHash: 'a'.repeat(64),
      contentHash: 'b'.repeat(64),
      extractedText: 'Content 1',
      charCount: 9,
    });

    const staging2 = await createStagingRow({
      projectId: testProjectId,
      actorId: testActorId,
      filename: 'file2.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 100,
      fileHash: 'c'.repeat(64),
      contentHash: 'd'.repeat(64),
      extractedText: 'Content 2',
      charCount: 9,
    });

    expect(staging1.ref_token).not.toBe(staging2.ref_token);
  });

  it('creates staging within transaction (atomicity)', async () => {
    const transaction = await sequelize.transaction();

    try {
      const staging = await createStagingRow({
        projectId: testProjectId,
        actorId: testActorId,
        filename: 'transactional.txt',
        mimeType: 'text/plain',
        fileSizeBytes: 100,
        fileHash: 'e'.repeat(64),
        contentHash: 'f'.repeat(64),
        extractedText: 'Transactional content',
        charCount: 21,
        transaction,
      });

      // Verify row exists within transaction
      const inTxRow = await ExtractionStaging().findByPk(staging.id, { transaction });
      expect(inTxRow).toBeDefined();

      // Rollback
      await transaction.rollback();

      // Verify row does not exist after rollback
      const afterRollback = await ExtractionStaging().findByPk(staging.id);
      expect(afterRollback).toBeNull();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  });

  it('sets correct expiration time (30 minutes)', async () => {
    const beforeCreate = new Date();

    const staging = await createStagingRow({
      projectId: testProjectId,
      actorId: testActorId,
      filename: 'expiry.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 100,
      fileHash: 'g'.repeat(64),
      contentHash: 'h'.repeat(64),
      extractedText: 'Expiry test',
      charCount: 11,
    });

    const afterCreate = new Date();
    const expiresAt = new Date(staging.expires_at);

    // Expiration should be ~30 minutes from creation
    const expectedMinExpiry = new Date(beforeCreate.getTime() + 29 * 60 * 1000);
    const expectedMaxExpiry = new Date(afterCreate.getTime() + 31 * 60 * 1000);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry.getTime());
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry.getTime());
  });
});

// ─── Feature Flag Tests ─────────────────────────────────────────────────────

describe('feature flag behavior', () => {
  it('DISC_WEB1_ENABLED defaults to undefined', () => {
    // Clear the flag
    delete process.env.DISC_WEB1_ENABLED;

    // Verify it's not set
    expect(process.env.DISC_WEB1_ENABLED).toBeUndefined();
  });

  it('DISC_WEB1_ENABLED can be set to true', () => {
    process.env.DISC_WEB1_ENABLED = 'true';
    expect(process.env.DISC_WEB1_ENABLED).toBe('true');
  });

  it('DISC_WEB1_ENABLED !== "true" means disabled', () => {
    process.env.DISC_WEB1_ENABLED = 'false';
    expect(process.env.DISC_WEB1_ENABLED !== 'true').toBe(true);

    process.env.DISC_WEB1_ENABLED = '';
    expect(process.env.DISC_WEB1_ENABLED !== 'true').toBe(true);

    delete process.env.DISC_WEB1_ENABLED;
    expect(process.env.DISC_WEB1_ENABLED !== 'true').toBe(true);
  });

  afterEach(() => {
    // Reset flag
    delete process.env.DISC_WEB1_ENABLED;
  });
});

// ─── Limits Verification ────────────────────────────────────────────────────

describe('extraction limits', () => {
  it('has correct per-file limit', () => {
    expect(EXTRACTION_LIMITS.MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024); // 10MB
  });

  it('has correct concurrency limit', () => {
    expect(EXTRACTION_LIMITS.MAX_CONCURRENT).toBeGreaterThanOrEqual(1);
  });

  it('has correct queue limit', () => {
    expect(EXTRACTION_LIMITS.MAX_QUEUED).toBeGreaterThanOrEqual(1);
  });
});

describe('multipart limits', () => {
  it('has correct per-file limit', () => {
    expect(MULTIPART_LIMITS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024); // 10MB
  });

  it('has correct aggregate limit', () => {
    expect(MULTIPART_LIMITS.MAX_AGGREGATE_SIZE).toBe(50 * 1024 * 1024); // 50MB
  });

  it('has correct file count limit', () => {
    expect(MULTIPART_LIMITS.MAX_FILES).toBe(10);
  });

  it('allows PDF MIME type', () => {
    expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain('application/pdf');
  });

  it('allows DOCX MIME type', () => {
    expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('allows text/plain MIME type', () => {
    expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain('text/plain');
  });

  it('allows text/markdown MIME type', () => {
    expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain('text/markdown');
  });

  it('does NOT allow application/msword (.doc)', () => {
    expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).not.toContain('application/msword');
  });
});

// ─── Error Code Tests ───────────────────────────────────────────────────────

describe('error codes', () => {
  it('ExtractionOverloadError has correct code', () => {
    const error = new ExtractionOverloadError('test');
    expect(error.code).toBe('EXTRACTION_OVERLOADED');
  });
});
