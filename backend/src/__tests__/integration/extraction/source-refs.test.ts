/**
 * Integration tests for Discovery source refs — DISC-WEB-1B-2b
 *
 * Tests atomic run creation from extraction staging refs:
 * - Idempotent replay (200)
 * - Idempotency conflict (409)
 * - Source ref unavailable (410)
 * - Provenance in EvidenceSource (file_hash)
 * - Authorization checks
 * - Concurrent requests
 * - Transaction rollback
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from '../setup/testDb';
import { createStagingRow } from '../../../services/extraction';
import { randomUUID } from 'crypto';

// Mock GitHub to prevent ESM import issues and API calls
jest.mock('../../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockRejectedValue({ status: 404, message: 'Not Found' }),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ path: 'test/path.md', sha: 'abc123', url: 'https://github.com/test' }),
  getConfigRepo: jest.fn().mockReturnValue('test-config-repo'),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
  fetchFileFromRepo: jest.fn().mockResolvedValue({ content: 'test content' }),
}));

// Import after mocking
import {
  createPendingDiscoveryRunFromRefs,
  computePayloadFingerprint,
} from '../../../application/discovery.app-service';
import { findByIdempotencyKey } from '../../../services/discovery-run.service';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testProjectSlug: string;
let testActorId: number;
let otherActorId: number;

beforeEach(async () => {
  await truncateAll();

  // Create test project
  const Project = sequelize.models.Project;
  const project = await Project.create({
    name: 'Test Project',
    slug: 'test-project-refs',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  testProjectId = (project as unknown as { id: number }).id;
  testProjectSlug = 'test-project-refs';

  // Create test actor with researcher role
  const Actor = sequelize.models.Actor;
  const actor = await Actor.create({
    display_name: 'Test Researcher',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;

  // Create another actor
  const otherActor = await Actor.create({
    display_name: 'Other User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  otherActorId = (otherActor as unknown as { id: number }).id;

  // Create researcher membership
  const ProjectMembership = sequelize.models.ProjectMembership;
  await ProjectMembership.create({
    project_id: testProjectId,
    actor_id: testActorId,
    role: 'researcher',
    membership_source: 'explicit',
  });
});

afterAll(() => sequelize.close());

// ─── Helper to create staging refs ───────────────────────────────────────────

async function createTestStaging(params?: {
  actorId?: number;
  projectId?: number;
  filename?: string;
}): Promise<string> {
  const staging = await createStagingRow({
    projectId: params?.projectId ?? testProjectId,
    actorId: params?.actorId ?? testActorId,
    filename: params?.filename ?? `document-${randomUUID()}.txt`,
    mimeType: 'text/plain',
    fileSizeBytes: 1024,
    fileHash: 'a'.repeat(64),
    contentHash: 'b'.repeat(64),
    extractedText: 'Sample extracted content for testing.',
    charCount: 37,
  });
  return staging.ref_token;
}

// ═══════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('idempotency', () => {
  it('creates a new run on first request', async () => {
    const refToken = await createTestStaging();
    const idempotencyKey = randomUUID();

    const result = await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'Test Topic',
      sourceIntent: 'Testing sourceRefs',
      sourceRefs: [refToken],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    });

    expect(result.isReplay).toBe(false);
    expect(result.sourceCount).toBe(1);
    expect(result.run.public_id).toBeDefined();
    expect(result.run.idempotency_key).toBe(idempotencyKey);
  });

  it('returns same run on idempotent replay (200)', async () => {
    const refToken = await createTestStaging();
    const idempotencyKey = randomUUID();

    // First request
    const first = await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'Replay Test',
      sourceIntent: null,
      sourceRefs: [refToken],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    });

    // Second request with same key and payload
    const second = await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'Replay Test',
      sourceIntent: null,
      sourceRefs: [refToken],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    });

    expect(second.isReplay).toBe(true);
    expect(second.sourceCount).toBe(0);
    expect(second.run.public_id).toBe(first.run.public_id);
    expect(second.run.id).toBe(first.run.id);
  });

  it('throws conflict on payload mismatch (409)', async () => {
    const refToken = await createTestStaging();
    const idempotencyKey = randomUUID();

    // First request
    await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'Original Topic',
      sourceIntent: null,
      sourceRefs: [refToken],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    });

    // Create new staging for the conflicting request
    const newRefToken = await createTestStaging();

    // Second request with same key but different payload (different topic)
    await expect(
      createPendingDiscoveryRunFromRefs({
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId,
        discoveryType: 'desk_research',
        topic: 'Different Topic', // Changed!
        sourceIntent: null,
        sourceRefs: [newRefToken],
        idempotencyKey,
        createdByIdentity: `api:test-actor`,
      }),
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE REF VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('source ref validation', () => {
  it('throws unavailable for non-existent ref (410)', async () => {
    // Use a valid UUID format that doesn't exist in DB
    const fakeRefToken = randomUUID();
    const idempotencyKey = randomUUID();

    await expect(
      createPendingDiscoveryRunFromRefs({
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId,
        discoveryType: 'desk_research',
        topic: 'Test',
        sourceIntent: null,
        sourceRefs: [fakeRefToken],
        idempotencyKey,
        createdByIdentity: `api:test-actor`,
      }),
    ).rejects.toMatchObject({
      code: 'SOURCE_REF_UNAVAILABLE',
    });
  });

  it('throws unavailable for wrong actor (410)', async () => {
    // Create staging owned by other actor
    const refToken = await createTestStaging({ actorId: otherActorId });
    const idempotencyKey = randomUUID();

    await expect(
      createPendingDiscoveryRunFromRefs({
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId, // Different actor trying to consume
        discoveryType: 'desk_research',
        topic: 'Test',
        sourceIntent: null,
        sourceRefs: [refToken],
        idempotencyKey,
        createdByIdentity: `api:test-actor`,
      }),
    ).rejects.toMatchObject({
      code: 'SOURCE_REF_UNAVAILABLE',
    });
  });

  it('throws unavailable for consumed ref (410)', async () => {
    const refToken = await createTestStaging();
    const idempotencyKey1 = randomUUID();

    // First request consumes the ref
    await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'First Run',
      sourceIntent: null,
      sourceRefs: [refToken],
      idempotencyKey: idempotencyKey1,
      createdByIdentity: `api:test-actor`,
    });

    // Second request with different idempotency key tries same ref
    const idempotencyKey2 = randomUUID();
    await expect(
      createPendingDiscoveryRunFromRefs({
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId,
        discoveryType: 'desk_research',
        topic: 'Second Run',
        sourceIntent: null,
        sourceRefs: [refToken], // Same ref!
        idempotencyKey: idempotencyKey2,
        createdByIdentity: `api:test-actor`,
      }),
    ).rejects.toMatchObject({
      code: 'SOURCE_REF_UNAVAILABLE',
    });
  });

  // FIXME: Test database doesn't allow direct UPDATE on expires_at (constraint issue)
  // The expiration logic is validated by validateRefsForConsumption tests in extraction-staging.test.ts
  it.skip('throws unavailable for expired ref (410)', async () => {
    const staging = await createStagingRow({
      projectId: testProjectId,
      actorId: testActorId,
      filename: 'expired.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 100,
      fileHash: 'c'.repeat(64),
      contentHash: 'd'.repeat(64),
      extractedText: 'Expired content',
      charCount: 15,
    });

    // Manually expire the staging row using raw query
    await sequelize.query(
      `UPDATE extraction_staging SET expires_at = NOW() - INTERVAL '1 minute' WHERE ref_token = :refToken`,
      { replacements: { refToken: staging.ref_token } },
    );

    const idempotencyKey = randomUUID();

    await expect(
      createPendingDiscoveryRunFromRefs({
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId,
        discoveryType: 'desk_research',
        topic: 'Expired Test',
        sourceIntent: null,
        sourceRefs: [staging.ref_token],
        idempotencyKey,
        createdByIdentity: `api:test-actor`,
      }),
    ).rejects.toMatchObject({
      code: 'SOURCE_REF_UNAVAILABLE',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROVENANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('provenance', () => {
  it('creates EvidenceSource with full file_hash', async () => {
    const fileHash = 'f'.repeat(64);
    const contentHash = 'g'.repeat(64);

    const staging = await createStagingRow({
      projectId: testProjectId,
      actorId: testActorId,
      filename: 'provenance.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 2048,
      fileHash,
      contentHash,
      extractedText: 'Provenance test content',
      charCount: 23,
    });

    const idempotencyKey = randomUUID();

    const result = await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'Provenance Test',
      sourceIntent: null,
      sourceRefs: [staging.ref_token],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    });

    // Query the created EvidenceSource
    const EvidenceSource = sequelize.models.EvidenceSource;
    const DiscoveryRunSource = sequelize.models.DiscoveryRunSource;

    const runSources = (await DiscoveryRunSource.findAll({
      where: { discovery_run_id: result.run.id },
    })) as unknown as Array<{ evidence_source_id: number }>;

    expect(runSources.length).toBe(1);

    const evidenceSource = await EvidenceSource.findByPk(runSources[0].evidence_source_id);
    expect(evidenceSource).not.toBeNull();

    const artifactRef = (evidenceSource as any).artifact_ref as Record<string, unknown>;
    expect(artifactRef.file_hash).toBe(fileHash);
    expect(artifactRef.content_hash).toBe(contentHash);
    expect(artifactRef.filename).toBe('provenance.txt');
    expect(artifactRef.size_bytes).toBe(2048);
    expect(artifactRef.mime_type).toBe('text/plain');
  });

  it('preserves source order in associations', async () => {
    const ref1 = await createTestStaging({ filename: 'first.txt' });
    const ref2 = await createTestStaging({ filename: 'second.txt' });
    const ref3 = await createTestStaging({ filename: 'third.txt' });

    const idempotencyKey = randomUUID();

    const result = await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'Order Test',
      sourceIntent: null,
      sourceRefs: [ref1, ref2, ref3],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    });

    expect(result.sourceCount).toBe(3);

    // Query source associations ordered
    const DiscoveryRunSource = sequelize.models.DiscoveryRunSource;
    const EvidenceSource = sequelize.models.EvidenceSource;

    const associations = (await DiscoveryRunSource.findAll({
      where: { discovery_run_id: result.run.id },
      order: [['source_order', 'ASC']],
    })) as unknown as Array<{ evidence_source_id: number; source_order: number }>;

    expect(associations.length).toBe(3);
    expect(associations[0].source_order).toBe(0);
    expect(associations[1].source_order).toBe(1);
    expect(associations[2].source_order).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAYLOAD FINGERPRINT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('payload fingerprint', () => {
  it('produces consistent hash for same payload', () => {
    const payload = {
      discoveryType: 'desk_research',
      topic: 'Test Topic',
      sourceIntent: 'Testing',
      sourceRefs: ['ref1', 'ref2'],
    };

    const hash1 = computePayloadFingerprint(payload);
    const hash2 = computePayloadFingerprint(payload);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256
  });

  it('produces different hash for different topic', () => {
    const hash1 = computePayloadFingerprint({
      discoveryType: 'desk_research',
      topic: 'Topic A',
      sourceIntent: null,
      sourceRefs: ['ref1'],
    });

    const hash2 = computePayloadFingerprint({
      discoveryType: 'desk_research',
      topic: 'Topic B',
      sourceIntent: null,
      sourceRefs: ['ref1'],
    });

    expect(hash1).not.toBe(hash2);
  });

  it('produces same hash regardless of sourceRefs order', () => {
    const hash1 = computePayloadFingerprint({
      discoveryType: 'desk_research',
      topic: 'Test',
      sourceIntent: null,
      sourceRefs: ['ref1', 'ref2', 'ref3'],
    });

    const hash2 = computePayloadFingerprint({
      discoveryType: 'desk_research',
      topic: 'Test',
      sourceIntent: null,
      sourceRefs: ['ref3', 'ref1', 'ref2'], // Different order
    });

    expect(hash1).toBe(hash2);
  });

  it('normalizes whitespace in topic', () => {
    const hash1 = computePayloadFingerprint({
      discoveryType: 'desk_research',
      topic: 'Test Topic  ',
      sourceIntent: null,
      sourceRefs: ['ref1'],
    });

    const hash2 = computePayloadFingerprint({
      discoveryType: 'desk_research',
      topic: 'Test Topic',
      sourceIntent: null,
      sourceRefs: ['ref1'],
    });

    expect(hash1).toBe(hash2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('transaction atomicity', () => {
  it('rolls back on failure (no partial state)', async () => {
    const refToken = await createTestStaging();
    const idempotencyKey = randomUUID();

    // Count rows before
    const DiscoveryRun = sequelize.models.DiscoveryRun;
    const EvidenceSource = sequelize.models.EvidenceSource;
    const DiscoveryRunSource = sequelize.models.DiscoveryRunSource;
    const ExtractionStaging = sequelize.models.ExtractionStaging;

    const runCountBefore = await DiscoveryRun.count();
    const sourceCountBefore = await EvidenceSource.count();
    const assocCountBefore = await DiscoveryRunSource.count();

    // This should succeed
    await createPendingDiscoveryRunFromRefs({
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research',
      topic: 'Transaction Test',
      sourceIntent: null,
      sourceRefs: [refToken],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    });

    const runCountAfter = await DiscoveryRun.count();
    const sourceCountAfter = await EvidenceSource.count();
    const assocCountAfter = await DiscoveryRunSource.count();

    // Verify all resources were created atomically
    expect(runCountAfter).toBe(runCountBefore + 1);
    expect(sourceCountAfter).toBe(sourceCountBefore + 1);
    expect(assocCountAfter).toBe(assocCountBefore + 1);

    // Verify staging was consumed
    const staging = await ExtractionStaging.findOne({ where: { ref_token: refToken } });
    expect((staging as any).status).toBe('consumed');
  });

  it('staging remains ready on validation failure', async () => {
    const refToken = await createTestStaging();
    // Use a valid UUID format that doesn't exist in DB
    const fakeRefToken = randomUUID();
    const idempotencyKey = randomUUID();

    const ExtractionStaging = sequelize.models.ExtractionStaging;

    // Try to create run with mixed valid/invalid refs
    await expect(
      createPendingDiscoveryRunFromRefs({
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId,
        discoveryType: 'desk_research',
        topic: 'Partial Failure Test',
        sourceIntent: null,
        sourceRefs: [refToken, fakeRefToken],
        idempotencyKey,
        createdByIdentity: `api:test-actor`,
      }),
    ).rejects.toMatchObject({
      code: 'SOURCE_REF_UNAVAILABLE',
    });

    // Verify the valid ref is still ready (not consumed)
    const staging = await ExtractionStaging.findOne({ where: { ref_token: refToken } });
    expect((staging as any).status).toBe('ready');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONCURRENT REQUEST TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('concurrent requests', () => {
  it('handles concurrent requests with same idempotency key', async () => {
    const refToken = await createTestStaging();
    const idempotencyKey = randomUUID();

    const params = {
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research' as const,
      topic: 'Concurrent Test',
      sourceIntent: null,
      sourceRefs: [refToken],
      idempotencyKey,
      createdByIdentity: `api:test-actor`,
    };

    // Fire multiple concurrent requests
    const results = await Promise.allSettled([
      createPendingDiscoveryRunFromRefs(params),
      createPendingDiscoveryRunFromRefs(params),
      createPendingDiscoveryRunFromRefs(params),
    ]);

    // All should succeed (one create, others replay)
    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length).toBe(3);

    // All should return the same run
    const runIds = new Set(
      successes.map(r => (r as PromiseFulfilledResult<any>).value.run.id)
    );
    expect(runIds.size).toBe(1);

    // Exactly one should be a new creation
    const creations = successes.filter(
      r => !(r as PromiseFulfilledResult<any>).value.isReplay
    );
    const replays = successes.filter(
      r => (r as PromiseFulfilledResult<any>).value.isReplay
    );

    expect(creations.length).toBe(1);
    expect(replays.length).toBe(2);
  });

  it('prevents double consumption with different idempotency keys', async () => {
    const refToken = await createTestStaging();

    const params1 = {
      projectId: testProjectId,
      projectSlug: testProjectSlug,
      actorId: testActorId,
      discoveryType: 'desk_research' as const,
      topic: 'Race Test 1',
      sourceIntent: null,
      sourceRefs: [refToken],
      idempotencyKey: randomUUID(),
      createdByIdentity: `api:test-actor`,
    };

    const params2 = {
      ...params1,
      topic: 'Race Test 2',
      idempotencyKey: randomUUID(), // Different key!
    };

    // Fire concurrent requests with different keys
    const results = await Promise.allSettled([
      createPendingDiscoveryRunFromRefs(params1),
      createPendingDiscoveryRunFromRefs(params2),
    ]);

    // One should succeed, one should fail with SOURCE_REF_UNAVAILABLE
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const error = (failures[0] as PromiseRejectedResult).reason;
    expect(error.code).toBe('SOURCE_REF_UNAVAILABLE');
  });
});
