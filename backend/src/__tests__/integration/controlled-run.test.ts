/**
 * Controlled Run Integration Tests — DISC-WEB-1D-2 M5d
 *
 * Tests controlled Discovery run creation and execution guard with PostgreSQL.
 * Validates:
 * - is_controlled column persistence
 * - Poller exclusion queries
 * - Direct execution guard (controlled runs blocked from executeDiscoveryRun)
 * - Cross-type isolation
 * - Concurrency: Same session/key deduplication, same session/different keys rejection
 * - Rollback: Run creation, binding, evidence, staging consumption failures
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import * as claimService from '../../services/discovery-claim.service';
import { randomUUID } from 'crypto';

// Mock GitHub to prevent ESM import issues and API calls
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockRejectedValue({ status: 404, message: 'Not Found' }),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ path: 'test/path.md', sha: 'abc123', url: 'https://github.com/test' }),
  getConfigRepo: jest.fn().mockReturnValue('test-config-repo'),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
  fetchFileFromRepo: jest.fn().mockResolvedValue({ content: 'test content' }),
}));

// Import controlled execution services after mocking
import { createControlledDiscoveryRunFromRefs } from '../../application/discovery.app-service';
import { createSession, cancelSession } from '../../services/controlled-test-budget.service';
import { createStagingRow } from '../../services/extraction';

const sequelize = getTestDb();
const DiscoveryRunModel = sequelize.models.DiscoveryRun;
const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;

// Test fixtures
let projectId: number;
let actorId: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'M5d Integration Test Project',
    slug: 'disc-web-1d-m5d-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as unknown as { id: number }).id;

  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    status: 'active',
  });
  actorId = (actor as unknown as { id: number }).id;
}

async function createRun(overrides: Partial<{
  is_controlled: boolean;
  status: string;
  worker_id: string | null;
}> = {}): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.create({
    project_id: projectId,
    discovery_type: 'desk_research',
    topic: 'Test Topic',
    topic_slug: `test-topic-${Date.now()}`,
    source_intent: 'Testing',
    actor_id: actorId,
    created_by_identity: 'U_TEST',
    status: overrides.status ?? 'pending',
    is_controlled: overrides.is_controlled ?? false,
    worker_id: overrides.worker_id ?? null,
  } as CreationAttributes<DiscoveryRun>);
  return run as unknown as DiscoveryRun;
}

// Run all tests in the same describe block to avoid connection issues
describe('DISC-WEB-1D-2 M5d: Controlled Run Integration', () => {
  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
  });

  // NOTE: sequelize.close() is handled by the final describe block below
  // Do NOT add afterAll here — both describe blocks share the same connection

  // ═══════════════════════════════════════════════════════════════════════════
  // is_controlled Column Persistence
  // ═══════════════════════════════════════════════════════════════════════════

  describe('is_controlled column', () => {
    it('defaults to FALSE for ordinary runs', async () => {
      const run = await createRun();
      expect(run.is_controlled).toBe(false);
    });

    it('persists TRUE for controlled runs', async () => {
      const run = await createRun({ is_controlled: true });
      expect(run.is_controlled).toBe(true);

      // Verify it survives read
      const reloaded = await DiscoveryRunModel.findByPk(run.id);
      expect((reloaded as any).is_controlled).toBe(true);
    });

    it('is queryable', async () => {
      await createRun({ is_controlled: false });
      await createRun({ is_controlled: true });
      await createRun({ is_controlled: false });

      const ordinaryRuns = await DiscoveryRunModel.findAll({
        where: { is_controlled: false },
      });
      expect(ordinaryRuns).toHaveLength(2);

      const controlledRuns = await DiscoveryRunModel.findAll({
        where: { is_controlled: true },
      });
      expect(controlledRuns).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Poller Exclusion Queries (is_controlled = FALSE)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('poller exclusion', () => {
    it('claimNextPendingRun excludes controlled runs', async () => {
      // Create controlled run (should be excluded)
      await createRun({ is_controlled: true, status: 'pending' });

      // Create ordinary run (should be claimable)
      await createRun({ is_controlled: false, status: 'pending' });

      const claimed = await claimService.claimNextPendingRun('worker-1');
      expect(claimed).not.toBeNull();
      expect(claimed!.is_controlled).toBe(false);
    });

    it('claimNextPendingRun returns null when only controlled runs exist', async () => {
      await createRun({ is_controlled: true, status: 'pending' });
      await createRun({ is_controlled: true, status: 'pending' });

      const claimed = await claimService.claimNextPendingRun('worker-1');
      expect(claimed).toBeNull();
    });

    it('countPendingRuns excludes controlled runs', async () => {
      await createRun({ is_controlled: true, status: 'pending' });
      await createRun({ is_controlled: false, status: 'pending' });
      await createRun({ is_controlled: false, status: 'pending' });

      const count = await claimService.countPendingRuns();
      expect(count).toBe(2); // Only ordinary runs
    });

    it('countProcessingRuns excludes controlled runs', async () => {
      await createRun({ is_controlled: true, status: 'processing', worker_id: 'w1' });
      await createRun({ is_controlled: false, status: 'processing', worker_id: 'w2' });

      const count = await claimService.countProcessingRuns();
      expect(count).toBe(1); // Only ordinary run
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Type Isolation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cross-type isolation', () => {
    it('controlled and ordinary runs can have same topic_slug', async () => {
      const ordinaryRun = await DiscoveryRunModel.create({
        project_id: projectId,
        discovery_type: 'desk_research',
        topic: 'Same Topic',
        topic_slug: 'same-topic',
        source_intent: 'Testing',
        actor_id: actorId,
        created_by_identity: 'U_TEST',
        status: 'pending',
        is_controlled: false,
      } as CreationAttributes<DiscoveryRun>);

      // Same topic slug but controlled
      const controlledRun = await DiscoveryRunModel.create({
        project_id: projectId,
        discovery_type: 'desk_research',
        topic: 'Same Topic',
        topic_slug: 'same-topic',
        source_intent: 'Testing controlled',
        actor_id: actorId,
        created_by_identity: 'U_TEST',
        status: 'pending',
        is_controlled: true,
      } as CreationAttributes<DiscoveryRun>);

      expect((ordinaryRun as any).id).not.toBe((controlledRun as any).id);
      expect((ordinaryRun as any).is_controlled).toBe(false);
      expect((controlledRun as any).is_controlled).toBe(true);
    });

    it('idempotency key scoping separates controlled and ordinary', async () => {
      // Create ordinary run with idempotency key
      // Include explicit public_id to avoid Sequelize binding issues
      const ordinaryRun = await DiscoveryRunModel.create({
        public_id: randomUUID(),
        project_id: projectId,
        discovery_type: 'desk_research',
        topic: 'Topic',
        topic_slug: 'topic',
        source_intent: 'Testing',
        actor_id: actorId,
        created_by_identity: 'U_TEST',
        status: 'pending',
        is_controlled: false,
        idempotency_key: randomUUID(), // Use UUID for idempotency key
        payload_fingerprint: 'fp_ordinary',
      } as CreationAttributes<DiscoveryRun>);

      // Controlled run with different idempotency key
      const controlledRun = await DiscoveryRunModel.create({
        public_id: randomUUID(),
        project_id: projectId,
        discovery_type: 'desk_research',
        topic: 'Topic',
        topic_slug: 'topic-controlled',
        source_intent: 'Testing',
        actor_id: actorId,
        created_by_identity: 'U_TEST',
        status: 'pending',
        is_controlled: true,
        idempotency_key: randomUUID(), // Use UUID for idempotency key
        payload_fingerprint: 'fp_controlled',
      } as CreationAttributes<DiscoveryRun>);

      // Both should exist with different IDs
      expect((ordinaryRun as any).id).not.toBe((controlledRun as any).id);

      // Query by idempotency key should find the right one
      const foundOrdinary = await DiscoveryRunModel.findOne({
        where: {
          idempotency_key: (ordinaryRun as any).idempotency_key,
          project_id: projectId,
        },
      });
      expect((foundOrdinary as any).is_controlled).toBe(false);

      const foundControlled = await DiscoveryRunModel.findOne({
        where: {
          idempotency_key: (controlledRun as any).idempotency_key,
          project_id: projectId,
        },
      });
      expect((foundControlled as any).is_controlled).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Index Verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('index verification', () => {
    it('partial index exists for is_controlled = TRUE', async () => {
      const [indexes] = await sequelize.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'discovery_runs'
        AND indexname = 'idx_discovery_runs_is_controlled'
      `) as [Array<{ indexname: string; indexdef: string }>, unknown];

      expect(indexes).toHaveLength(1);
      expect(indexes[0].indexdef).toContain('is_controlled = true');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Direct Execution Guard
  // ═══════════════════════════════════════════════════════════════════════════

  describe('direct execution guard', () => {
    it('executeDiscoveryRun rejects controlled runs', async () => {
      // Create a controlled run in processing status
      const run = await createRun({
        is_controlled: true,
        status: 'processing',
        worker_id: 'test-worker',
      });

      // Dynamically require to avoid module resolution issues in test setup
      const discoveryAppService = require('../../application/discovery.app-service');

      await expect(
        discoveryAppService.executeDiscoveryRun(run.id, 'test-worker'),
      ).rejects.toThrow(/controlled run.*direct execution not authorized/i);
    });

    it('executeDiscoveryRun proceeds with ordinary runs (smoke test)', async () => {
      // This is a smoke test - full execution requires many dependencies
      // We just verify the is_controlled guard doesn't block ordinary runs
      const run = await createRun({
        is_controlled: false,
        status: 'processing',
        worker_id: 'test-worker',
      });

      const discoveryAppService = require('../../application/discovery.app-service');

      // Will fail for other reasons (no sources, etc.) but not the is_controlled guard
      await expect(
        discoveryAppService.executeDiscoveryRun(run.id, 'test-worker'),
      ).rejects.toThrow(/no associated sources|extracted text/i);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DISC-WEB-1D-2 M5d: Concurrency and Rollback Tests
//
// These tests exercise createControlledDiscoveryRunFromRefs() with real PostgreSQL
// transactions to verify:
// - C1: Same session/key/payload produces exactly one run (idempotent replay)
// - C2: Same session/different keys - second request gets SESSION_ALREADY_BOUND
// - R1-R4: Transaction rollback on various failure points
// ═══════════════════════════════════════════════════════════════════════════════

describe('DISC-WEB-1D-2 M5d: Concurrency and Rollback (PostgreSQL)', () => {
  // Save original env
  const originalDiscWeb1 = process.env.DISC_WEB1_ENABLED;
  const originalDiscWeb1d = process.env.DISC_WEB1D_ENABLED;

  // Test fixtures
  let testProjectId: number;
  let testProjectSlug: string;
  let testActorId: number;

  const sequelize = getTestDb();
  const ProjectModel = sequelize.models.Project;
  const ActorModel = sequelize.models.Actor;
  const DiscoveryRunModel = sequelize.models.DiscoveryRun;
  const ControlledTestSessionModel = sequelize.models.ControlledTestSession;
  const EvidenceSourceModel = sequelize.models.EvidenceSource;
  const ExtractionStagingModel = sequelize.models.ExtractionStaging;
  const ProjectMembershipModel = sequelize.models.ProjectMembership;

  // Helper to create staging refs
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
      fileHash: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
      contentHash: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
      extractedText: 'Sample extracted content for controlled test.',
      charCount: 44,
    });
    return staging.ref_token;
  }

  beforeEach(async () => {
    await truncateAll();

    // Enable both feature flags
    process.env.DISC_WEB1_ENABLED = 'true';
    process.env.DISC_WEB1D_ENABLED = 'true';

    // Create test project
    const project = await ProjectModel.create({
      name: 'M5d Concurrency Test Project',
      slug: `m5d-concurrency-${Date.now()}`,
      status: 'active',
      created_by: 'U_TEST',
      organization_id: TEST_ORG_ID,
    });
    testProjectId = (project as unknown as { id: number }).id;
    testProjectSlug = (project as unknown as { slug: string }).slug;

    // Create test actor
    const actor = await ActorModel.create({
      organization_id: TEST_ORG_ID,
      display_name: 'Test Researcher',
      status: 'active',
    });
    testActorId = (actor as unknown as { id: number }).id;

    // Create researcher membership
    await ProjectMembershipModel.create({
      project_id: testProjectId,
      actor_id: testActorId,
      role: 'researcher',
      membership_source: 'explicit',
    });
  });

  afterEach(() => {
    // Restore feature flags
    if (originalDiscWeb1 !== undefined) {
      process.env.DISC_WEB1_ENABLED = originalDiscWeb1;
    } else {
      delete process.env.DISC_WEB1_ENABLED;
    }
    if (originalDiscWeb1d !== undefined) {
      process.env.DISC_WEB1D_ENABLED = originalDiscWeb1d;
    } else {
      delete process.env.DISC_WEB1D_ENABLED;
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // C1: Same session, same key, same payload — idempotent deduplication
  // ═══════════════════════════════════════════════════════════════════════════

  describe('C1: same session/key/payload concurrency', () => {
    it('produces exactly one run when two concurrent requests use same session/key/payload', async () => {
      // Create session owned by actor
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
        actorId: testActorId,
      });

      // Create staging ref
      const refToken = await createTestStaging();
      const idempotencyKey = randomUUID();

      const params = {
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId,
        discoveryType: 'desk_research' as const,
        topic: 'Concurrent Test Topic',
        sourceIntent: 'Testing concurrent controlled runs',
        sourceRefs: [refToken],
        idempotencyKey,
        createdByIdentity: `api:test-actor:${testActorId}`,
        controlledSessionPublicId: session.public_id,
      };

      // Launch two concurrent requests
      const [result1, result2] = await Promise.all([
        createControlledDiscoveryRunFromRefs(params),
        createControlledDiscoveryRunFromRefs(params),
      ]);

      // Verify exactly one run was created (both return same run ID)
      expect(result1.run.id).toBe(result2.run.id);

      // One should be the creator, one should be a replay
      const replayCount = [result1.isReplay, result2.isReplay].filter(Boolean).length;
      expect(replayCount).toBe(1);

      // Verify exactly one run in database
      const runs = await DiscoveryRunModel.findAll({
        where: { idempotency_key: idempotencyKey },
      });
      expect(runs).toHaveLength(1);

      // Verify exactly one session binding
      const bindings = await ControlledTestSessionModel.findAll({
        where: { discovery_run_id: (runs[0] as any).id },
      });
      expect(bindings).toHaveLength(1);

      // Verify exactly one set of evidence sources
      const sources = await EvidenceSourceModel.count({
        where: { project_id: testProjectId },
      });
      expect(sources).toBe(1);

      // Verify staging was consumed exactly once
      const staging = await ExtractionStagingModel.findOne({
        where: { ref_token: refToken },
      });
      expect((staging as any).consumed_by_run_id).toBe((runs[0] as any).id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // C2: Same session, different keys — second gets SESSION_ALREADY_BOUND
  // ═══════════════════════════════════════════════════════════════════════════

  describe('C2: same session/different keys concurrency', () => {
    it('rejects second request with SESSION_ALREADY_BOUND when same session used with different keys', async () => {
      // Create session owned by actor
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
        actorId: testActorId,
      });

      // Create two separate staging refs
      const refToken1 = await createTestStaging({ filename: 'doc1.txt' });
      const refToken2 = await createTestStaging({ filename: 'doc2.txt' });

      const baseParams = {
        projectId: testProjectId,
        projectSlug: testProjectSlug,
        actorId: testActorId,
        discoveryType: 'desk_research' as const,
        sourceIntent: 'Testing concurrent binding',
        createdByIdentity: `api:test-actor:${testActorId}`,
        controlledSessionPublicId: session.public_id,
      };

      // Launch two concurrent requests with different keys
      const results = await Promise.allSettled([
        createControlledDiscoveryRunFromRefs({
          ...baseParams,
          topic: 'Topic 1',
          sourceRefs: [refToken1],
          idempotencyKey: randomUUID(),
        }),
        createControlledDiscoveryRunFromRefs({
          ...baseParams,
          topic: 'Topic 2',
          sourceRefs: [refToken2],
          idempotencyKey: randomUUID(),
        }),
      ]);

      // One should succeed, one should fail with SESSION_ALREADY_BOUND
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      const failedResult = failures[0] as PromiseRejectedResult;
      expect(failedResult.reason.code).toBe('CONTROLLED_SESSION_ALREADY_BOUND');

      // Verify exactly one run persists
      const runs = await DiscoveryRunModel.findAll({
        where: { is_controlled: true },
      });
      expect(runs).toHaveLength(1);

      // Verify exactly one binding persists
      const bindings = await ControlledTestSessionModel.findAll({
        where: { discovery_run_id: { [require('sequelize').Op.ne]: null } },
      });
      expect(bindings).toHaveLength(1);

      // Verify losing request did not consume its staging ref
      const successResult = successes[0] as PromiseFulfilledResult<any>;
      const winningRun = successResult.value.run;

      // One staging should be consumed, one should not
      const consumedStaging = await ExtractionStagingModel.count({
        where: { consumed_by_run_id: winningRun.id },
      });
      expect(consumedStaging).toBe(1);

      // The other staging should remain unconsumed
      const unconsumedStaging = await ExtractionStagingModel.count({
        where: { consumed_by_run_id: null, status: 'ready' },
      });
      expect(unconsumedStaging).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R1: Run creation failure — all writes roll back
  // ═══════════════════════════════════════════════════════════════════════════

  describe('R1: run creation failure rollback', () => {
    it('rolls back all writes when run creation fails', async () => {
      // Create session owned by actor
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
        actorId: testActorId,
      });

      const refToken = await createTestStaging();
      const idempotencyKey = randomUUID();

      // Mock createDiscoveryRun to fail
      const runService = require('../../services/discovery-run.service');
      const originalCreateRun = runService.createDiscoveryRun;
      runService.createDiscoveryRun = jest.fn().mockRejectedValue(new Error('Simulated run creation failure'));

      try {
        await createControlledDiscoveryRunFromRefs({
          projectId: testProjectId,
          projectSlug: testProjectSlug,
          actorId: testActorId,
          discoveryType: 'desk_research',
          topic: 'Rollback Test',
          sourceIntent: 'Testing rollback',
          sourceRefs: [refToken],
          idempotencyKey,
          createdByIdentity: `api:test-actor:${testActorId}`,
          controlledSessionPublicId: session.public_id,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Simulated run creation failure');
      } finally {
        runService.createDiscoveryRun = originalCreateRun;
      }

      // Verify no run was created
      const runs = await DiscoveryRunModel.count({ where: { is_controlled: true } });
      expect(runs).toBe(0);

      // Verify session was not bound
      const reloadedSession = await ControlledTestSessionModel.findByPk(session.id);
      expect((reloadedSession as any).discovery_run_id).toBeNull();

      // Verify no evidence sources
      const sources = await EvidenceSourceModel.count({ where: { project_id: testProjectId } });
      expect(sources).toBe(0);

      // Verify staging not consumed
      const staging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
      expect((staging as any).consumed_by_run_id).toBeNull();
      expect((staging as any).status).toBe('ready');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R2: Session binding failure — run is rolled back
  // ═══════════════════════════════════════════════════════════════════════════

  describe('R2: session binding failure rollback', () => {
    it('rolls back the run when session binding fails', async () => {
      // Create session and then cancel it (so binding will fail)
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
        actorId: testActorId,
      });

      const refToken = await createTestStaging();
      const idempotencyKey = randomUUID();

      // Cancel the session AFTER the preflight check but during the transaction
      // We'll mock bindRunToSession to cancel the session first, then call original
      const budgetService = require('../../services/controlled-test-budget.service');
      const originalBind = budgetService.bindRunToSession;

      budgetService.bindRunToSession = jest.fn().mockImplementation(async () => {
        // Cancel the session to simulate a race condition
        await cancelSession(session.id, 'Simulated race condition');
        // Now call original which will fail because session is terminal
        return originalBind(session.id, 999, undefined);
      });

      try {
        await createControlledDiscoveryRunFromRefs({
          projectId: testProjectId,
          projectSlug: testProjectSlug,
          actorId: testActorId,
          discoveryType: 'desk_research',
          topic: 'Binding Failure Test',
          sourceIntent: 'Testing binding rollback',
          sourceRefs: [refToken],
          idempotencyKey,
          createdByIdentity: `api:test-actor:${testActorId}`,
          controlledSessionPublicId: session.public_id,
        });
        fail('Should have thrown');
      } catch (error: any) {
        // Could be SESSION_NOT_ACTIVE or SessionTerminalError
        expect(
          error.code === 'CONTROLLED_SESSION_NOT_ACTIVE' ||
          error.message?.includes('terminal')
        ).toBe(true);
      } finally {
        budgetService.bindRunToSession = originalBind;
      }

      // Verify no controlled run persists
      const runs = await DiscoveryRunModel.count({ where: { is_controlled: true } });
      expect(runs).toBe(0);

      // Verify staging not consumed
      const staging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
      expect((staging as any).consumed_by_run_id).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R3: Evidence-source creation failure — run and binding roll back
  // ═══════════════════════════════════════════════════════════════════════════

  describe('R3: evidence-source creation failure rollback', () => {
    it('rolls back run and binding when evidence-source creation fails', async () => {
      // Create session owned by actor
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
        actorId: testActorId,
      });

      const refToken = await createTestStaging();
      const idempotencyKey = randomUUID();

      // Mock createDiscoverySources to fail
      const evidenceService = require('../../services/evidence-source.service');
      const originalCreate = evidenceService.createDiscoverySources;
      evidenceService.createDiscoverySources = jest.fn().mockRejectedValue(
        new Error('Simulated evidence creation failure')
      );

      try {
        await createControlledDiscoveryRunFromRefs({
          projectId: testProjectId,
          projectSlug: testProjectSlug,
          actorId: testActorId,
          discoveryType: 'desk_research',
          topic: 'Evidence Failure Test',
          sourceIntent: 'Testing evidence rollback',
          sourceRefs: [refToken],
          idempotencyKey,
          createdByIdentity: `api:test-actor:${testActorId}`,
          controlledSessionPublicId: session.public_id,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Simulated evidence creation failure');
      } finally {
        evidenceService.createDiscoverySources = originalCreate;
      }

      // Verify no controlled run persists (rolled back)
      const runs = await DiscoveryRunModel.count({ where: { is_controlled: true } });
      expect(runs).toBe(0);

      // Verify session binding was rolled back
      const reloadedSession = await ControlledTestSessionModel.findByPk(session.id);
      expect((reloadedSession as any).discovery_run_id).toBeNull();

      // Verify no evidence sources
      const sources = await EvidenceSourceModel.count({ where: { project_id: testProjectId } });
      expect(sources).toBe(0);

      // Verify staging not consumed
      const staging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
      expect((staging as any).consumed_by_run_id).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R4: Staging consumption failure — all writes roll back
  // ═══════════════════════════════════════════════════════════════════════════

  describe('R4: staging consumption failure rollback', () => {
    it('rolls back all writes when staging consumption fails', async () => {
      // Create session owned by actor
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 50000,
        maxOutputTokens: 20000,
        actorId: testActorId,
      });

      const refToken = await createTestStaging();
      const idempotencyKey = randomUUID();

      // Mock consumeValidatedRefs to fail - use spyOn on the underlying module
      // since the barrel export creates a getter-only property
      const extractionStagingService = require('../../services/extraction/extraction-staging.service');
      const consumeSpy = jest.spyOn(extractionStagingService, 'consumeValidatedRefs')
        .mockRejectedValue(new Error('Simulated staging consumption failure'));

      try {
        await createControlledDiscoveryRunFromRefs({
          projectId: testProjectId,
          projectSlug: testProjectSlug,
          actorId: testActorId,
          discoveryType: 'desk_research',
          topic: 'Consumption Failure Test',
          sourceIntent: 'Testing consumption rollback',
          sourceRefs: [refToken],
          idempotencyKey,
          createdByIdentity: `api:test-actor:${testActorId}`,
          controlledSessionPublicId: session.public_id,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Simulated staging consumption failure');
      } finally {
        consumeSpy.mockRestore();
      }

      // Verify no controlled run persists
      const runs = await DiscoveryRunModel.count({ where: { is_controlled: true } });
      expect(runs).toBe(0);

      // Verify session binding was rolled back
      const reloadedSession = await ControlledTestSessionModel.findByPk(session.id);
      expect((reloadedSession as any).discovery_run_id).toBeNull();

      // Verify no evidence sources persist
      const sources = await EvidenceSourceModel.count({ where: { project_id: testProjectId } });
      expect(sources).toBe(0);

      // Verify staging remains available (not consumed)
      const staging = await ExtractionStagingModel.findOne({ where: { ref_token: refToken } });
      expect((staging as any).consumed_by_run_id).toBeNull();
      expect((staging as any).status).toBe('ready');
    });
  });
});
