/**
 * DISC-WEB-2 Researcher Controlled Run Integration Tests
 *
 * Tests the researcher-controlled run creation endpoint:
 * POST /api/v1/projects/:projectId/discovery/controlled-runs
 *
 * Validates:
 * 1. Feature gate enforcement (DISC_WEB2_RESEARCHER_ENABLED)
 * 2. Idempotency (same key returns existing run)
 * 3. Per-actor researcher session constraint
 * 4. Source ref validation and consumption
 * 5. Atomic transaction (session + run + sources + binding)
 * 6. Error handling (missing auth, invalid project, etc.)
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import { randomUUID } from 'crypto';

// Mock GitHub to prevent ESM import issues and API calls
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockRejectedValue({ status: 404, message: 'Not Found' }),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ path: 'test/path.md', sha: 'abc123', url: 'https://github.com/test' }),
  getConfigRepo: jest.fn().mockReturnValue('test-config-repo'),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
  fetchFileFromRepo: jest.fn().mockResolvedValue({ content: 'test content' }),
}));

// Import after mocking
import { createResearcherControlledRun } from '../../application/discovery.app-service';
import { createStagingRow } from '../../services/extraction';
import {
  isResearcherExecutionEnabled,
  RESEARCHER_SESSION_BUDGET,
} from '../../services/controlled-test-budget.service';

const sequelize = getTestDb();
const DiscoveryRunModel = sequelize.models.DiscoveryRun;
const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;

// Test fixtures
let projectId: number;
let projectSlug: string;
let actor1Id: number;
let actor2Id: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-WEB-2 Researcher Test Project',
    slug: 'disc-web-2-researcher-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as unknown as { id: number }).id;
  projectSlug = 'disc-web-2-researcher-test';

  const actor1 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher 1',
    status: 'active',
  });
  actor1Id = (actor1 as unknown as { id: number }).id;

  const actor2 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher 2',
    status: 'active',
  });
  actor2Id = (actor2 as unknown as { id: number }).id;
}

async function createTestStagingRef(actorId: number): Promise<string> {
  const extractedText = 'Test content for researcher controlled run.';
  const staging = await createStagingRow({
    projectId,
    actorId,
    filename: `test-${Date.now()}.pdf`,
    extractedText,
    contentHash: randomUUID().replace(/-/g, '').slice(0, 32),
    mimeType: 'application/pdf',
    fileSizeBytes: 1024,
    fileHash: randomUUID().replace(/-/g, ''),
    charCount: extractedText.length,
  });
  return staging.ref_token;
}

describe('DISC-WEB-2 Researcher Controlled Run Integration', () => {
  // Store original env values
  const originalDiscWeb1Enabled = process.env.DISC_WEB1_ENABLED;
  const originalDiscWeb2ResearcherEnabled = process.env.DISC_WEB2_RESEARCHER_ENABLED;

  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
    // Enable features by default
    process.env.DISC_WEB1_ENABLED = 'true';
    process.env.DISC_WEB2_RESEARCHER_ENABLED = 'true';
  });

  afterEach(() => {
    // Restore original env values
    process.env.DISC_WEB1_ENABLED = originalDiscWeb1Enabled;
    process.env.DISC_WEB2_RESEARCHER_ENABLED = originalDiscWeb2ResearcherEnabled;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE GATE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('feature gate enforcement', () => {
    it('isResearcherExecutionEnabled returns false when gate is off', () => {
      process.env.DISC_WEB2_RESEARCHER_ENABLED = 'false';
      expect(isResearcherExecutionEnabled()).toBe(false);
    });

    it('isResearcherExecutionEnabled returns true when gate is on', () => {
      process.env.DISC_WEB2_RESEARCHER_ENABLED = 'true';
      expect(isResearcherExecutionEnabled()).toBe(true);
    });

    it('rejects researcher run creation when DISC_WEB2_RESEARCHER_ENABLED is off', async () => {
      process.env.DISC_WEB2_RESEARCHER_ENABLED = 'false';

      const sourceRef = await createTestStagingRef(actor1Id);

      await expect(
        createResearcherControlledRun({
          projectId,
          projectSlug,
          actorId: actor1Id,
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceIntent: 'Testing',
          sourceRefs: [sourceRef],
          idempotencyKey: randomUUID(),
          createdByIdentity: 'api:test-actor',
        }),
      ).rejects.toThrow(/Researcher execution is not available/);
    });

    it('rejects researcher run creation when DISC_WEB1_ENABLED is off', async () => {
      process.env.DISC_WEB1_ENABLED = 'false';

      await expect(
        createResearcherControlledRun({
          projectId,
          projectSlug,
          actorId: actor1Id,
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceIntent: 'Testing',
          sourceRefs: ['ref-that-wont-be-validated'],
          idempotencyKey: randomUUID(),
          createdByIdentity: 'api:test-actor',
        }),
      ).rejects.toThrow(/Source reference consumption is not available/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESSFUL CREATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('successful researcher run creation', () => {
    it('creates researcher session and controlled run atomically', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);
      const idempotencyKey = randomUUID();

      const result = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'AI Research Analysis',
        sourceIntent: 'Testing researcher flow',
        sourceRefs: [sourceRef],
        idempotencyKey,
        createdByIdentity: 'api:test-actor',
      });

      // Verify result
      expect(result.isReplay).toBe(false);
      expect(result.sourceCount).toBe(1);
      expect(result.sessionPublicId).toBeDefined();
      expect(result.budget).toEqual({
        maxRequests: RESEARCHER_SESSION_BUDGET.maxRequests,
        maxInputTokens: RESEARCHER_SESSION_BUDGET.maxInputTokens,
        maxOutputTokens: RESEARCHER_SESSION_BUDGET.maxOutputTokens,
      });

      // Verify run is controlled
      expect(result.run.is_controlled).toBe(true);
      expect(result.run.status).toBe('pending');

      // Verify session was created with researcher type
      const session = await ControlledTestSessionModel.findOne({
        where: { public_id: result.sessionPublicId },
      });
      expect(session).not.toBeNull();
      expect(session!.session_type).toBe('researcher');
      expect(session!.status).toBe('active');
      expect(session!.created_by_actor_id).toBe(actor1Id);
      expect(session!.discovery_run_id).toBe(result.run.id);
    });

    it('uses fixed server-side budget (not configurable)', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);

      const result = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'Budget Test',
        sourceIntent: null,
        sourceRefs: [sourceRef],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:test-actor',
      });

      // Budget should always be the fixed researcher budget
      expect(result.budget.maxRequests).toBe(4);
      expect(result.budget.maxInputTokens).toBe(40_000);
      expect(result.budget.maxOutputTokens).toBe(16_384);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEMPOTENCY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('idempotency', () => {
    it('returns existing run on replay with same idempotency key and payload', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);
      const idempotencyKey = randomUUID();
      const params = {
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research' as const,
        topic: 'Idempotent Topic',
        sourceIntent: 'Testing idempotency',
        sourceRefs: [sourceRef],
        idempotencyKey,
        createdByIdentity: 'api:test-actor',
      };

      // First call creates
      const result1 = await createResearcherControlledRun(params);
      expect(result1.isReplay).toBe(false);

      // Second call returns existing (idempotent)
      const result2 = await createResearcherControlledRun(params);
      expect(result2.isReplay).toBe(true);
      expect(result2.run.public_id).toBe(result1.run.public_id);
      expect(result2.sessionPublicId).toBe(result1.sessionPublicId);
      expect(result2.sourceCount).toBe(0); // No new sources created
    });

    it('checks idempotency BEFORE rejecting for existing active session', async () => {
      // Create first run
      const sourceRef1 = await createTestStagingRef(actor1Id);
      const idempotencyKey = randomUUID();
      const params = {
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research' as const,
        topic: 'First Run',
        sourceIntent: 'Testing',
        sourceRefs: [sourceRef1],
        idempotencyKey,
        createdByIdentity: 'api:test-actor',
      };

      const result1 = await createResearcherControlledRun(params);
      expect(result1.isReplay).toBe(false);

      // Same key should return existing run (not error about active session)
      const result2 = await createResearcherControlledRun(params);
      expect(result2.isReplay).toBe(true);
      expect(result2.run.public_id).toBe(result1.run.public_id);
    });

    it('rejects replay with different payload fingerprint', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);
      const idempotencyKey = randomUUID();

      // First call creates
      await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'Original Topic',
        sourceIntent: null,
        sourceRefs: [sourceRef],
        idempotencyKey,
        createdByIdentity: 'api:test-actor',
      });

      // Same key, different topic = conflict
      await expect(
        createResearcherControlledRun({
          projectId,
          projectSlug,
          actorId: actor1Id,
          discoveryType: 'desk_research',
          topic: 'Different Topic', // Changed
          sourceIntent: null,
          sourceRefs: [sourceRef],
          idempotencyKey, // Same key
          createdByIdentity: 'api:test-actor',
        }),
      ).rejects.toThrow(/different request payload/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-ACTOR SESSION CONSTRAINT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('per-actor researcher session constraint', () => {
    it('rejects second researcher run for same actor with different idempotency key', async () => {
      const sourceRef1 = await createTestStagingRef(actor1Id);
      const sourceRef2 = await createTestStagingRef(actor1Id);

      // First run creates session
      await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'First Topic',
        sourceIntent: null,
        sourceRefs: [sourceRef1],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:test-actor',
      });

      // Second run with different key should fail (actor has active session)
      await expect(
        createResearcherControlledRun({
          projectId,
          projectSlug,
          actorId: actor1Id,
          discoveryType: 'desk_research',
          topic: 'Second Topic',
          sourceIntent: null,
          sourceRefs: [sourceRef2],
          idempotencyKey: randomUUID(), // Different key
          createdByIdentity: 'api:test-actor',
        }),
      ).rejects.toThrow(/active researcher session/);
    });

    it('allows different actors to have concurrent researcher sessions', async () => {
      const sourceRef1 = await createTestStagingRef(actor1Id);
      const sourceRef2 = await createTestStagingRef(actor2Id);

      // Actor 1 creates run
      const result1 = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'Actor 1 Topic',
        sourceIntent: null,
        sourceRefs: [sourceRef1],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:actor-1',
      });

      // Actor 2 can also create run
      const result2 = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor2Id,
        discoveryType: 'desk_research',
        topic: 'Actor 2 Topic',
        sourceIntent: null,
        sourceRefs: [sourceRef2],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:actor-2',
      });

      expect(result1.run.id).not.toBe(result2.run.id);
      expect(result1.sessionPublicId).not.toBe(result2.sessionPublicId);
    });

    it('allows new session after previous session completes', async () => {
      const sourceRef1 = await createTestStagingRef(actor1Id);

      // Create first run
      const result1 = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'First Topic',
        sourceIntent: null,
        sourceRefs: [sourceRef1],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:test-actor',
      });

      // Complete the session
      const session = await ControlledTestSessionModel.findOne({
        where: { public_id: result1.sessionPublicId },
      });
      session!.status = 'completed';
      session!.completed_at = new Date();
      await session!.save();

      // Now actor can create another run
      const sourceRef2 = await createTestStagingRef(actor1Id);
      const result2 = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'Second Topic',
        sourceIntent: null,
        sourceRefs: [sourceRef2],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:test-actor',
      });

      expect(result2.isReplay).toBe(false);
      expect(result2.sessionPublicId).not.toBe(result1.sessionPublicId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOURCE REF VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('source ref validation', () => {
    it('rejects invalid source refs', async () => {
      // Use a valid UUID format that doesn't exist in the database
      const nonExistentRef = randomUUID();
      await expect(
        createResearcherControlledRun({
          projectId,
          projectSlug,
          actorId: actor1Id,
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceIntent: null,
          sourceRefs: [nonExistentRef],
          idempotencyKey: randomUUID(),
          createdByIdentity: 'api:test-actor',
        }),
      ).rejects.toThrow(/source references are no longer available/);
    });

    it('consumes staging refs atomically', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);

      await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'Test Topic',
        sourceIntent: null,
        sourceRefs: [sourceRef],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:test-actor',
      });

      // Ref should be consumed - trying to use again should fail (new session, different key)
      // But first we need to complete the session
      const sessions = await ControlledTestSessionModel.findAll({
        where: { created_by_actor_id: actor1Id, status: 'active' },
      });
      for (const s of sessions) {
        s.status = 'completed';
        s.completed_at = new Date();
        await s.save();
      }

      await expect(
        createResearcherControlledRun({
          projectId,
          projectSlug,
          actorId: actor1Id,
          discoveryType: 'desk_research',
          topic: 'Another Topic',
          sourceIntent: null,
          sourceRefs: [sourceRef], // Same ref, should be consumed
          idempotencyKey: randomUUID(),
          createdByIdentity: 'api:test-actor',
        }),
      ).rejects.toThrow(/source references are no longer available/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN PROPERTIES TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('run properties', () => {
    it('creates run with correct discovery type', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);

      const result = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'stakeholder_synthesis',
        topic: 'Stakeholder Analysis',
        sourceIntent: 'Interview synthesis',
        sourceRefs: [sourceRef],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:test-actor',
      });

      expect(result.run.discovery_type).toBe('stakeholder_synthesis');
    });

    it('creates run with is_controlled = true', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);

      const result = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'Controlled Flag Test',
        sourceIntent: null,
        sourceRefs: [sourceRef],
        idempotencyKey: randomUUID(),
        createdByIdentity: 'api:test-actor',
      });

      expect(result.run.is_controlled).toBe(true);

      // Verify from database
      const reloaded = await DiscoveryRunModel.findByPk(result.run.id) as any;
      expect(reloaded.is_controlled).toBe(true);
    });

    it('stores payload fingerprint for idempotency', async () => {
      const sourceRef = await createTestStagingRef(actor1Id);
      const idempotencyKey = randomUUID();

      const result = await createResearcherControlledRun({
        projectId,
        projectSlug,
        actorId: actor1Id,
        discoveryType: 'desk_research',
        topic: 'Fingerprint Test',
        sourceIntent: null,
        sourceRefs: [sourceRef],
        idempotencyKey,
        createdByIdentity: 'api:test-actor',
      });

      expect(result.run.idempotency_key).toBe(idempotencyKey);
      expect(result.run.payload_fingerprint).toBeDefined();
      expect(result.run.payload_fingerprint).toHaveLength(64); // SHA-256 hex
    });
  });
});
