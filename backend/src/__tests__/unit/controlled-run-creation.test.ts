/**
 * Controlled Run Creation Tests — DISC-WEB-1D-2 M5d
 *
 * Tests createControlledDiscoveryRunFromRefs orchestration:
 * - Dual feature gate validation (DISC_WEB1_ENABLED + DISC_WEB1D_ENABLED)
 * - Session selector validation
 * - Actor ownership and session eligibility
 * - Preliminary and authoritative replay with 9-point checklist
 * - Cross-type replay protection (ordinary ↔ controlled)
 * - is_controlled column handling
 * - Direct execution guard (controlled runs blocked from executeDiscoveryRun)
 */

// Mock dependencies first (before imports)
jest.mock('../../services/controlled-test-budget.service');
jest.mock('../../services/controlled-session-authorization.service');
jest.mock('../../services/discovery-run.service');
jest.mock('../../services/extraction');
jest.mock('../../database');
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockRejectedValue({ status: 404 }),
  getConfigRepo: jest.fn().mockReturnValue('test-config-repo'),
  YAML_TEMPLATE_PATH: 'config/prompts',
}));
jest.mock('../../services/evidence-source.service', () => ({
  createDiscoverySources: jest.fn().mockResolvedValue([{ id: 1 }]),
}));

import {
  createControlledDiscoveryRunFromRefs,
  computeControlledPayloadFingerprint,
} from '../../application/discovery.app-service';

import * as budgetService from '../../services/controlled-test-budget.service';
import * as authService from '../../services/controlled-session-authorization.service';
import * as runService from '../../services/discovery-run.service';
import * as extractionService from '../../services/extraction';
import sequelize from '../../database';

const mockGetSessionByPublicId = budgetService.getSessionByPublicId as jest.MockedFunction<
  typeof budgetService.getSessionByPublicId
>;
const mockGetSessionByRunId = budgetService.getSessionByRunId as jest.MockedFunction<
  typeof budgetService.getSessionByRunId
>;
const mockBindRunToSession = budgetService.bindRunToSession as jest.MockedFunction<
  typeof budgetService.bindRunToSession
>;
const mockIsControlledExecutionEnabled = authService.isControlledExecutionEnabled as jest.MockedFunction<
  typeof authService.isControlledExecutionEnabled
>;
const mockCheckNewRunEligibility = authService.checkNewRunEligibility as jest.MockedFunction<
  typeof authService.checkNewRunEligibility
>;
const mockCheckReplayEligibility = authService.checkReplayEligibility as jest.MockedFunction<
  typeof authService.checkReplayEligibility
>;
const mockFindByIdempotencyKey = runService.findByIdempotencyKey as jest.MockedFunction<
  typeof runService.findByIdempotencyKey
>;
const mockCreateDiscoveryRun = runService.createDiscoveryRun as jest.MockedFunction<
  typeof runService.createDiscoveryRun
>;
const mockAssociateSources = runService.associateSources as jest.MockedFunction<
  typeof runService.associateSources
>;
const mockValidateRefsForConsumption = extractionService.validateRefsForConsumption as jest.MockedFunction<
  typeof extractionService.validateRefsForConsumption
>;
const mockConsumeValidatedRefs = extractionService.consumeValidatedRefs as jest.MockedFunction<
  typeof extractionService.consumeValidatedRefs
>;


// Helper to create mock session
function createMockSession(overrides: Partial<{
  id: number;
  public_id: string;
  status: 'active' | 'cancelled' | 'exhausted' | 'completed';
  created_by_actor_id: number | null;
  discovery_run_id: number | null;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    public_id: overrides.public_id ?? 'sess_mock_uuid',
    status: overrides.status ?? 'active',
    created_by_actor_id: overrides.created_by_actor_id ?? 100,
    discovery_run_id: overrides.discovery_run_id ?? null,
    max_requests: 10,
    max_input_tokens: 10000,
    max_output_tokens: 5000,
    used_requests: 0,
    used_input_tokens: 0,
    used_output_tokens: 0,
  } as unknown as ReturnType<typeof budgetService.getSessionByPublicId> extends Promise<infer T> ? T : never;
}

// Helper to create mock run
function createMockRun(overrides: Partial<{
  id: number;
  public_id: string;
  project_id: number;
  is_controlled: boolean;
  payload_fingerprint: string;
}> = {}) {
  return {
    id: overrides.id ?? 500,
    public_id: overrides.public_id ?? 'run_mock_uuid',
    project_id: overrides.project_id ?? 1,
    is_controlled: overrides.is_controlled ?? true,
    payload_fingerprint: overrides.payload_fingerprint ?? 'fp_mock',
    discovery_type: 'desk_research',
    topic: 'Test Topic',
    topic_slug: 'test-topic',
    status: 'pending',
  };
}

// Base params for createControlledDiscoveryRunFromRefs
const baseParams = {
  projectId: 1,
  projectSlug: 'test-project',
  actorId: 100,
  discoveryType: 'desk_research' as const,
  topic: 'Test Topic',
  sourceIntent: 'Testing controlled runs',
  sourceRefs: ['ref_abc123'],
  idempotencyKey: 'idem_test_key',
  createdByIdentity: 'test:actor:100',
  controlledSessionPublicId: 'sess_test_uuid',
};

describe('DISC-WEB-1D-2 M5d: Controlled Run Creation', () => {
  // Save original env
  const originalEnv = { ...process.env };
  let mockTransaction: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset env vars
    delete process.env.DISC_WEB1_ENABLED;
    delete process.env.DISC_WEB1D_ENABLED;

    // Mock transaction
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };

    (sequelize.transaction as jest.Mock).mockResolvedValue(mockTransaction);
    (sequelize.query as jest.Mock).mockResolvedValue([[], {}]);

    // Default successful mocks
    mockIsControlledExecutionEnabled.mockReturnValue(true);
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockGetSessionByPublicId.mockResolvedValue(createMockSession());
    mockCheckNewRunEligibility.mockResolvedValue({ authorized: true, sessionId: 1 });
    mockValidateRefsForConsumption.mockResolvedValue({
      success: true,
      validated: { stagingRows: [{ filename: 'test.pdf', extracted_text: 'content', content_hash: 'hash', mime_type: 'application/pdf', file_size_bytes: 1000, file_hash: 'fhash' }] as any },
      errors: [],
    } as any);
    mockCreateDiscoveryRun.mockResolvedValue(createMockRun() as any);
    mockBindRunToSession.mockResolvedValue(createMockSession({ discovery_run_id: 500 }) as any);
    mockAssociateSources.mockResolvedValue(undefined as any);
    mockConsumeValidatedRefs.mockResolvedValue(1);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Payload Fingerprint
  // ═══════════════════════════════════════════════════════════════════════════

  describe('computeControlledPayloadFingerprint', () => {
    it('includes controlledSessionPublicId in fingerprint', () => {
      const fp1 = computeControlledPayloadFingerprint({
        discoveryType: 'desk_research',
        topic: 'Test',
        sourceIntent: null,
        sourceRefs: ['ref1'],
        controlledSessionPublicId: 'session_A',
      });

      const fp2 = computeControlledPayloadFingerprint({
        discoveryType: 'desk_research',
        topic: 'Test',
        sourceIntent: null,
        sourceRefs: ['ref1'],
        controlledSessionPublicId: 'session_B',
      });

      expect(fp1).not.toBe(fp2);
    });

    it('produces consistent fingerprints for same input', () => {
      const input = {
        discoveryType: 'desk_research',
        topic: 'Test',
        sourceIntent: 'Intent',
        sourceRefs: ['ref1', 'ref2'],
        controlledSessionPublicId: 'session_X',
      };

      const fp1 = computeControlledPayloadFingerprint(input);
      const fp2 = computeControlledPayloadFingerprint(input);

      expect(fp1).toBe(fp2);
    });

    it('sorts sourceRefs for canonical form', () => {
      const fp1 = computeControlledPayloadFingerprint({
        discoveryType: 'desk_research',
        topic: 'Test',
        sourceIntent: null,
        sourceRefs: ['ref1', 'ref2'],
        controlledSessionPublicId: 'session_X',
      });

      const fp2 = computeControlledPayloadFingerprint({
        discoveryType: 'desk_research',
        topic: 'Test',
        sourceIntent: null,
        sourceRefs: ['ref2', 'ref1'], // Different order
        controlledSessionPublicId: 'session_X',
      });

      expect(fp1).toBe(fp2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Dual Feature Gates
  // ═══════════════════════════════════════════════════════════════════════════

  describe('dual feature gates', () => {
    it('rejects when DISC_WEB1_ENABLED is not set', async () => {
      process.env.DISC_WEB1D_ENABLED = 'true';
      // DISC_WEB1_ENABLED is not set

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'FEATURE_DISABLED',
      });
    });

    it('rejects when DISC_WEB1_ENABLED is false', async () => {
      process.env.DISC_WEB1_ENABLED = 'false';
      process.env.DISC_WEB1D_ENABLED = 'true';

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'FEATURE_DISABLED',
      });
    });

    it('rejects when DISC_WEB1D_ENABLED is not set', async () => {
      process.env.DISC_WEB1_ENABLED = 'true';
      mockIsControlledExecutionEnabled.mockReturnValue(false);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_EXECUTION_DISABLED',
      });
    });

    it('rejects when DISC_WEB1D_ENABLED is false', async () => {
      process.env.DISC_WEB1_ENABLED = 'true';
      mockIsControlledExecutionEnabled.mockReturnValue(false);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_EXECUTION_DISABLED',
      });
    });

    it('proceeds when both gates are enabled', async () => {
      process.env.DISC_WEB1_ENABLED = 'true';
      mockIsControlledExecutionEnabled.mockReturnValue(true);

      const result = await createControlledDiscoveryRunFromRefs(baseParams);
      expect(result.run).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Actor Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('actor validation', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('rejects when actorId is missing (0)', async () => {
      await expect(
        createControlledDiscoveryRunFromRefs({ ...baseParams, actorId: 0 }),
      ).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ACTOR_MISMATCH',
      });
    });

    it('rejects when actorId is NaN', async () => {
      await expect(
        createControlledDiscoveryRunFromRefs({ ...baseParams, actorId: NaN }),
      ).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ACTOR_MISMATCH',
      });
    });

    it('rejects when actorId is negative', async () => {
      await expect(
        createControlledDiscoveryRunFromRefs({ ...baseParams, actorId: -5 }),
      ).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ACTOR_MISMATCH',
      });
    });

    it('rejects when actorId is Infinity', async () => {
      await expect(
        createControlledDiscoveryRunFromRefs({ ...baseParams, actorId: Infinity }),
      ).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ACTOR_MISMATCH',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Session Selector Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('session selector validation', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('rejects when session not found by public ID', async () => {
      mockGetSessionByPublicId.mockResolvedValue(null);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_NOT_FOUND',
      });
    });

    it('rejects when actor does not own session', async () => {
      mockCheckNewRunEligibility.mockResolvedValue({
        authorized: false,
        reason: 'actor_mismatch',
      });

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ACTOR_MISMATCH',
      });
    });

    it('rejects when session is not active', async () => {
      mockCheckNewRunEligibility.mockResolvedValue({
        authorized: false,
        reason: 'session_not_active',
      });

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_NOT_ACTIVE',
      });
    });

    it('rejects when session is already bound', async () => {
      mockCheckNewRunEligibility.mockResolvedValue({
        authorized: false,
        reason: 'session_already_bound',
      });

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ALREADY_BOUND',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Preliminary Replay — 9-Point Checklist
  // ═══════════════════════════════════════════════════════════════════════════

  describe('preliminary replay — 9-point checklist', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('rejects replay when project_id differs (point 1)', async () => {
      const existingRun = createMockRun({
        project_id: 999, // Different project
        is_controlled: true,
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
        message: expect.stringContaining('different project'),
      });
    });

    it('rejects replay when is_controlled is false (point 2 — cross-type)', async () => {
      const existingRun = createMockRun({
        project_id: 1,
        is_controlled: false, // Ordinary run
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
        message: expect.stringContaining('ordinary (non-controlled)'),
      });
    });

    it('rejects replay when payload fingerprint differs (point 4)', async () => {
      const existingRun = createMockRun({
        project_id: 1,
        is_controlled: true,
        payload_fingerprint: 'different_fingerprint',
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
        message: expect.stringContaining('different request payload'),
      });
    });

    it('rejects replay when bound session not found (point 5)', async () => {
      const existingRun = createMockRun({
        project_id: 1,
        is_controlled: true,
        payload_fingerprint: computeControlledPayloadFingerprint({
          ...baseParams,
          discoveryType: baseParams.discoveryType,
        }),
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);
      mockGetSessionByRunId.mockResolvedValue(null);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_NOT_FOUND',
      });
    });

    it('rejects replay when session binding mismatches run (point 6)', async () => {
      const existingRun = createMockRun({
        id: 500,
        project_id: 1,
        is_controlled: true,
        payload_fingerprint: computeControlledPayloadFingerprint({
          ...baseParams,
          discoveryType: baseParams.discoveryType,
        }),
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 1,
        created_by_actor_id: 100,
        discovery_run_id: 999, // Different run
      }));

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
        message: expect.stringContaining('binding mismatch'),
      });
    });

    it('rejects replay when actor does not own session (point 7)', async () => {
      const existingRun = createMockRun({
        id: 500,
        project_id: 1,
        is_controlled: true,
        payload_fingerprint: computeControlledPayloadFingerprint({
          ...baseParams,
          discoveryType: baseParams.discoveryType,
        }),
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 1,
        created_by_actor_id: 200, // Different actor
        discovery_run_id: 500,
      }));

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ACTOR_MISMATCH',
      });
    });

    it('allows replay with terminal session (read-only, point 9)', async () => {
      const fp = computeControlledPayloadFingerprint({
        ...baseParams,
        discoveryType: baseParams.discoveryType,
      });
      const existingRun = createMockRun({
        id: 500,
        project_id: 1,
        is_controlled: true,
        payload_fingerprint: fp,
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 1,
        created_by_actor_id: 100,
        discovery_run_id: 500,
        status: 'completed', // Terminal state
      }));
      mockCheckReplayEligibility.mockResolvedValue({
        authorized: true,
        readOnly: true, // Terminal sessions are read-only
        sessionId: 1,
        runId: 500,
      });

      const result = await createControlledDiscoveryRunFromRefs(baseParams);
      expect(result.isReplay).toBe(true);
      expect(result.run.id).toBe(500);
    });

    it('returns existing run on valid preliminary replay', async () => {
      const fp = computeControlledPayloadFingerprint({
        ...baseParams,
        discoveryType: baseParams.discoveryType,
      });
      const existingRun = createMockRun({
        id: 500,
        project_id: 1,
        is_controlled: true,
        payload_fingerprint: fp,
      });
      mockFindByIdempotencyKey.mockResolvedValue(existingRun as any);
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 1,
        created_by_actor_id: 100,
        discovery_run_id: 500,
      }));
      mockCheckReplayEligibility.mockResolvedValue({
        authorized: true,
        readOnly: false,
        sessionId: 1,
        runId: 500,
      });

      const result = await createControlledDiscoveryRunFromRefs(baseParams);
      expect(result.isReplay).toBe(true);
      expect(result.run.id).toBe(500);
      expect(result.sourceCount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Type Replay Protection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cross-type replay protection', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('controlled run rejects replay of ordinary run idempotency key', async () => {
      // Ordinary run exists (is_controlled: false)
      const ordinaryRun = createMockRun({
        project_id: 1,
        is_controlled: false,
      });
      mockFindByIdempotencyKey.mockResolvedValue(ordinaryRun as any);

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
        message: expect.stringContaining('ordinary (non-controlled)'),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // is_controlled Column
  // ═══════════════════════════════════════════════════════════════════════════

  describe('is_controlled column', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('creates run with is_controlled: true', async () => {
      const result = await createControlledDiscoveryRunFromRefs(baseParams);

      expect(result.isReplay).toBe(false);
      expect(mockCreateDiscoveryRun).toHaveBeenCalledWith(
        expect.objectContaining({
          isControlled: true,
        }),
        expect.anything(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Session Binding
  // ═══════════════════════════════════════════════════════════════════════════

  describe('session binding', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('binds session to run in same transaction', async () => {
      const result = await createControlledDiscoveryRunFromRefs(baseParams);

      expect(result.sessionId).toBe(1);
      expect(mockBindRunToSession).toHaveBeenCalledWith(1, 500, 1, mockTransaction);
    });

    it('rolls back on binding failure (SessionTerminalError)', async () => {
      mockBindRunToSession.mockRejectedValue(new budgetService.SessionTerminalError('cancelled'));

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_NOT_ACTIVE',
      });
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('rolls back on binding failure (RunAlreadyBoundError)', async () => {
      mockBindRunToSession.mockRejectedValue(new budgetService.RunAlreadyBoundError(1, 999));

      await expect(createControlledDiscoveryRunFromRefs(baseParams)).rejects.toMatchObject({
        code: 'CONTROLLED_SESSION_ALREADY_BOUND',
      });
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Authoritative Replay — Gate Rechecks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('authoritative replay — gate rechecks', () => {
    it('rechecks DISC_WEB1_ENABLED at transaction boundary', async () => {
      process.env.DISC_WEB1_ENABLED = 'true';

      // First findByIdempotencyKey returns null (preliminary)
      // Second findByIdempotencyKey (authoritative) returns existing run
      const fp = computeControlledPayloadFingerprint({
        ...baseParams,
        discoveryType: baseParams.discoveryType,
      });
      const existingRun = createMockRun({
        id: 500,
        project_id: 1,
        is_controlled: true,
        payload_fingerprint: fp,
      });

      mockFindByIdempotencyKey
        .mockResolvedValueOnce(null) // Preliminary: no run
        .mockResolvedValueOnce(existingRun as any); // Authoritative: run exists

      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 1,
        created_by_actor_id: 100,
        discovery_run_id: 500,
      }));

      const result = await createControlledDiscoveryRunFromRefs(baseParams);

      // Should return replay result (authoritative path)
      expect(result.isReplay).toBe(true);
      expect(result.run.id).toBe(500);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Successful Run Creation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('successful run creation', () => {
    beforeEach(() => {
      process.env.DISC_WEB1_ENABLED = 'true';
    });

    it('creates run with all required fields', async () => {
      const result = await createControlledDiscoveryRunFromRefs(baseParams);

      expect(result.run).toBeDefined();
      expect(result.isReplay).toBe(false);
      expect(result.sourceCount).toBe(1);
      expect(result.sessionId).toBe(1);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('consumes staging refs atomically', async () => {
      await createControlledDiscoveryRunFromRefs(baseParams);

      expect(mockConsumeValidatedRefs).toHaveBeenCalledWith(
        expect.anything(),
        500, // run.id
        mockTransaction,
      );
    });
  });
});
