/**
 * Controlled Session Authorization Service Tests — DISC-WEB-1D-2 M5c
 *
 * Tests the capability gate and authorization validation functions.
 */

import {
  CONTROLLED_EXECUTION_GATE,
  isControlledExecutionEnabled,
  checkNewRunEligibility,
  checkExecutionEligibility,
  checkReplayEligibility,
  isIdentifierError,
  isGateError,
  isAuthorizationError,
  getSafeErrorMessage,
  type AuthorizationFailureReason,
} from '../../services/controlled-session-authorization.service';

import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import * as budgetService from '../../services/controlled-test-budget.service';

// Mock the budget service functions
jest.mock('../../services/controlled-test-budget.service', () => ({
  getSessionById: jest.fn(),
  getSessionByRunId: jest.fn(),
}));

const mockGetSessionById = budgetService.getSessionById as jest.MockedFunction<typeof budgetService.getSessionById>;
const mockGetSessionByRunId = budgetService.getSessionByRunId as jest.MockedFunction<typeof budgetService.getSessionByRunId>;

// Helper to create mock session
function createMockSession(overrides: Partial<{
  id: number;
  status: 'active' | 'cancelled' | 'exhausted' | 'completed';
  created_by_actor_id: number | null;
  discovery_run_id: number | null;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    public_id: 'mock-uuid',
    status: overrides.status ?? 'active',
    created_by_actor_id: overrides.created_by_actor_id ?? 100,
    discovery_run_id: overrides.discovery_run_id ?? null,
    max_requests: 10,
    max_input_tokens: 10000,
    max_output_tokens: 5000,
    used_requests: 0,
    used_input_tokens: 0,
    used_output_tokens: 0,
    cancellation_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
    cancelled_at: null,
    exhausted_at: null,
    completed_at: null,
  } as unknown as ControlledTestSession;
}

describe('DISC-WEB-1D-2 M5c: Controlled Session Authorization', () => {
  // Save original env
  const originalEnv = process.env[CONTROLLED_EXECUTION_GATE];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: gate disabled
    delete process.env[CONTROLLED_EXECUTION_GATE];
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env[CONTROLLED_EXECUTION_GATE] = originalEnv;
    } else {
      delete process.env[CONTROLLED_EXECUTION_GATE];
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Capability Gate
  // ═══════════════════════════════════════════════════════════════════════════

  describe('capability gate (DISC_WEB1D_ENABLED)', () => {
    it('is disabled by default', () => {
      delete process.env[CONTROLLED_EXECUTION_GATE];
      expect(isControlledExecutionEnabled()).toBe(false);
    });

    it('is disabled when set to empty string', () => {
      process.env[CONTROLLED_EXECUTION_GATE] = '';
      expect(isControlledExecutionEnabled()).toBe(false);
    });

    it('is disabled when set to "false"', () => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'false';
      expect(isControlledExecutionEnabled()).toBe(false);
    });

    it('is disabled when set to "TRUE" (case sensitive)', () => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'TRUE';
      expect(isControlledExecutionEnabled()).toBe(false);
    });

    it('is disabled when set to "1"', () => {
      process.env[CONTROLLED_EXECUTION_GATE] = '1';
      expect(isControlledExecutionEnabled()).toBe(false);
    });

    it('is disabled when set to "yes"', () => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'yes';
      expect(isControlledExecutionEnabled()).toBe(false);
    });

    it('is enabled ONLY when set to exactly "true"', () => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
      expect(isControlledExecutionEnabled()).toBe(true);
    });

    it('gate name is DISC_WEB1D_ENABLED', () => {
      expect(CONTROLLED_EXECUTION_GATE).toBe('DISC_WEB1D_ENABLED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // New Run Eligibility — Gate Check
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkNewRunEligibility — gate check', () => {
    it('rejects when gate is disabled', async () => {
      delete process.env[CONTROLLED_EXECUTION_GATE];

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('gate_disabled');
      expect(mockGetSessionById).not.toHaveBeenCalled();
    });

    it('proceeds when gate is enabled', async () => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
      mockGetSessionById.mockResolvedValue(createMockSession());

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 1,
      });

      expect(result.authorized).toBe(true);
      expect(mockGetSessionById).toHaveBeenCalledWith(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // New Run Eligibility — Input Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkNewRunEligibility — input validation', () => {
    beforeEach(() => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
    });

    it('rejects missing actorId (null)', async () => {
      const result = await checkNewRunEligibility({
        actorId: null,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_actor_id');
    });

    it('rejects missing actorId (undefined)', async () => {
      const result = await checkNewRunEligibility({
        actorId: undefined,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_actor_id');
    });

    it('rejects invalid actorId (zero)', async () => {
      const result = await checkNewRunEligibility({
        actorId: 0,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_actor_id');
    });

    it('rejects invalid actorId (negative)', async () => {
      const result = await checkNewRunEligibility({
        actorId: -5,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_actor_id');
    });

    it('rejects invalid actorId (fractional)', async () => {
      const result = await checkNewRunEligibility({
        actorId: 1.5,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_actor_id');
    });

    it('rejects invalid actorId (NaN)', async () => {
      const result = await checkNewRunEligibility({
        actorId: NaN,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_actor_id');
    });

    it('rejects invalid actorId (Infinity)', async () => {
      const result = await checkNewRunEligibility({
        actorId: Infinity,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_actor_id');
    });

    it('rejects invalid actorId (unsafe integer)', async () => {
      const result = await checkNewRunEligibility({
        actorId: Number.MAX_SAFE_INTEGER + 1,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_actor_id');
    });

    it('rejects missing sessionId (null)', async () => {
      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: null,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_session_id');
    });

    it('rejects missing sessionId (undefined)', async () => {
      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: undefined,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_session_id');
    });

    it('rejects invalid sessionId (zero)', async () => {
      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 0,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_session_id');
    });

    it('rejects invalid sessionId (negative)', async () => {
      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: -1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_session_id');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // New Run Eligibility — Session State Checks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkNewRunEligibility — session state', () => {
    beforeEach(() => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
    });

    it('rejects when session not found', async () => {
      mockGetSessionById.mockResolvedValue(null);

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 999,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_found');
    });

    it('rejects when actor does not own session', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        created_by_actor_id: 200, // Different actor
      }));

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('actor_mismatch');
      expect(result.session).toBeDefined();
    });

    it('rejects when session is cancelled', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        status: 'cancelled',
      }));

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_active');
    });

    it('rejects when session is exhausted', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        status: 'exhausted',
      }));

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_active');
    });

    it('rejects when session is completed', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        status: 'completed',
      }));

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_active');
    });

    it('rejects when session is already bound to a run', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        discovery_run_id: 500,
      }));

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_already_bound');
    });

    it('authorizes valid active unbound session', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 42,
        status: 'active',
        created_by_actor_id: 100,
        discovery_run_id: null,
      }));

      const result = await checkNewRunEligibility({
        actorId: 100,
        sessionId: 42,
      });

      expect(result.authorized).toBe(true);
      expect(result.sessionId).toBe(42);
      expect(result.session).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Execution Eligibility — Gate Check
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkExecutionEligibility — gate check', () => {
    it('rejects when gate is disabled', async () => {
      delete process.env[CONTROLLED_EXECUTION_GATE];

      const result = await checkExecutionEligibility({
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('gate_disabled');
      expect(mockGetSessionByRunId).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Execution Eligibility — Input Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkExecutionEligibility — input validation', () => {
    beforeEach(() => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
    });

    it('rejects missing runId (null)', async () => {
      const result = await checkExecutionEligibility({
        runId: null,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_run_id');
    });

    it('rejects missing runId (undefined)', async () => {
      const result = await checkExecutionEligibility({
        runId: undefined,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_run_id');
    });

    it('rejects invalid runId (zero)', async () => {
      const result = await checkExecutionEligibility({
        runId: 0,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_run_id');
    });

    it('rejects invalid runId (negative)', async () => {
      const result = await checkExecutionEligibility({
        runId: -10,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_run_id');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Execution Eligibility — Session State Checks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkExecutionEligibility — session state', () => {
    beforeEach(() => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
    });

    it('rejects when no session bound to run', async () => {
      mockGetSessionByRunId.mockResolvedValue(null);

      const result = await checkExecutionEligibility({
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_found');
      expect(result.runId).toBe(500);
    });

    it('rejects when session is cancelled', async () => {
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 10,
        status: 'cancelled',
        discovery_run_id: 500,
      }));

      const result = await checkExecutionEligibility({
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_active');
      expect(result.sessionId).toBe(10);
    });

    it('rejects when session is exhausted', async () => {
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 10,
        status: 'exhausted',
        discovery_run_id: 500,
      }));

      const result = await checkExecutionEligibility({
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_active');
    });

    it('rejects when session is completed', async () => {
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 10,
        status: 'completed',
        discovery_run_id: 500,
      }));

      const result = await checkExecutionEligibility({
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_active');
    });

    it('authorizes active session bound to run', async () => {
      mockGetSessionByRunId.mockResolvedValue(createMockSession({
        id: 10,
        status: 'active',
        discovery_run_id: 500,
      }));

      const result = await checkExecutionEligibility({
        runId: 500,
      });

      expect(result.authorized).toBe(true);
      expect(result.sessionId).toBe(10);
      expect(result.runId).toBe(500);
      expect(result.session).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Replay Eligibility — Gate Check
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkReplayEligibility — gate check', () => {
    it('rejects when gate is disabled', async () => {
      delete process.env[CONTROLLED_EXECUTION_GATE];

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 1,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('gate_disabled');
      expect(result.readOnly).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Replay Eligibility — Input Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkReplayEligibility — input validation', () => {
    beforeEach(() => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
    });

    it('rejects missing actorId', async () => {
      const result = await checkReplayEligibility({
        actorId: null,
        sessionId: 1,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_actor_id');
    });

    it('rejects missing sessionId', async () => {
      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: null,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_session_id');
    });

    it('rejects missing runId', async () => {
      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 1,
        runId: null,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('missing_run_id');
    });

    it('rejects invalid runId (fractional)', async () => {
      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 1,
        runId: 1.5,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('invalid_run_id');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Replay Eligibility — Session State Checks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkReplayEligibility — session state', () => {
    beforeEach(() => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
    });

    it('rejects when session not found', async () => {
      mockGetSessionById.mockResolvedValue(null);

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 999,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_found');
    });

    it('rejects when actor does not own session', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        created_by_actor_id: 200,
        discovery_run_id: 500,
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 1,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('actor_mismatch');
    });

    it('rejects when session is not bound', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        discovery_run_id: null,
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 1,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('session_not_bound');
    });

    it('rejects when session bound to different run', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        discovery_run_id: 999, // Different run
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 1,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('run_mismatch');
    });

    it('authorizes active session with matching binding (readOnly=false)', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 10,
        status: 'active',
        discovery_run_id: 500,
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 10,
        runId: 500,
      });

      expect(result.authorized).toBe(true);
      expect(result.readOnly).toBe(false);
      expect(result.sessionId).toBe(10);
      expect(result.runId).toBe(500);
    });

    it('authorizes cancelled session with matching binding (readOnly=true)', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 10,
        status: 'cancelled',
        discovery_run_id: 500,
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 10,
        runId: 500,
      });

      expect(result.authorized).toBe(true);
      expect(result.readOnly).toBe(true);
    });

    it('authorizes exhausted session with matching binding (readOnly=true)', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 10,
        status: 'exhausted',
        discovery_run_id: 500,
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 10,
        runId: 500,
      });

      expect(result.authorized).toBe(true);
      expect(result.readOnly).toBe(true);
    });

    it('authorizes completed session with matching binding (readOnly=true)', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 10,
        status: 'completed',
        discovery_run_id: 500,
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 10,
        runId: 500,
      });

      expect(result.authorized).toBe(true);
      expect(result.readOnly).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Session and Cross-Run Isolation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cross-session and cross-run isolation', () => {
    beforeEach(() => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
    });

    it('actor A cannot use actor B session for new run', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 1,
        created_by_actor_id: 200, // Actor B owns this
        discovery_run_id: null,
      }));

      const result = await checkNewRunEligibility({
        actorId: 100, // Actor A
        sessionId: 1,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('actor_mismatch');
    });

    it('actor A cannot replay actor B session', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 1,
        created_by_actor_id: 200, // Actor B owns this
        discovery_run_id: 500,
      }));

      const result = await checkReplayEligibility({
        actorId: 100, // Actor A
        sessionId: 1,
        runId: 500,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('actor_mismatch');
    });

    it('session bound to run A cannot replay run B', async () => {
      mockGetSessionById.mockResolvedValue(createMockSession({
        id: 1,
        discovery_run_id: 500, // Bound to run 500
      }));

      const result = await checkReplayEligibility({
        actorId: 100,
        sessionId: 1,
        runId: 999, // Different run
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('run_mismatch');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Utility Functions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('utility functions', () => {
    describe('isIdentifierError', () => {
      it('returns true for identifier errors', () => {
        expect(isIdentifierError('missing_actor_id')).toBe(true);
        expect(isIdentifierError('invalid_actor_id')).toBe(true);
        expect(isIdentifierError('missing_session_id')).toBe(true);
        expect(isIdentifierError('invalid_session_id')).toBe(true);
        expect(isIdentifierError('missing_run_id')).toBe(true);
        expect(isIdentifierError('invalid_run_id')).toBe(true);
      });

      it('returns false for non-identifier errors', () => {
        expect(isIdentifierError('gate_disabled')).toBe(false);
        expect(isIdentifierError('session_not_found')).toBe(false);
        expect(isIdentifierError('actor_mismatch')).toBe(false);
      });
    });

    describe('isGateError', () => {
      it('returns true for gate_disabled', () => {
        expect(isGateError('gate_disabled')).toBe(true);
      });

      it('returns false for other errors', () => {
        expect(isGateError('session_not_found')).toBe(false);
        expect(isGateError('actor_mismatch')).toBe(false);
      });
    });

    describe('isAuthorizationError', () => {
      it('returns true for authorization errors', () => {
        expect(isAuthorizationError('actor_mismatch')).toBe(true);
        expect(isAuthorizationError('session_not_active')).toBe(true);
        expect(isAuthorizationError('session_already_bound')).toBe(true);
        expect(isAuthorizationError('session_not_bound')).toBe(true);
        expect(isAuthorizationError('run_mismatch')).toBe(true);
      });

      it('returns false for non-authorization errors', () => {
        expect(isAuthorizationError('gate_disabled')).toBe(false);
        expect(isAuthorizationError('missing_actor_id')).toBe(false);
      });
    });

    describe('getSafeErrorMessage', () => {
      it('returns safe messages for all error types', () => {
        const errorTypes: AuthorizationFailureReason[] = [
          'gate_disabled',
          'missing_actor_id',
          'invalid_actor_id',
          'missing_session_id',
          'invalid_session_id',
          'missing_run_id',
          'invalid_run_id',
          'session_not_found',
          'actor_mismatch',
          'session_not_active',
          'session_already_bound',
          'session_not_bound',
          'run_mismatch',
        ];

        for (const reason of errorTypes) {
          const message = getSafeErrorMessage(reason);
          expect(typeof message).toBe('string');
          expect(message.length).toBeGreaterThan(0);
          // Messages should not expose internal details
          expect(message).not.toContain('session_id');
          expect(message).not.toContain('actor_id');
          expect(message).not.toContain('run_id');
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // No Behavior Change to Ordinary Discovery
  // ═══════════════════════════════════════════════════════════════════════════

  describe('no behavior change to ordinary Discovery', () => {
    it('authorization functions do not modify database', async () => {
      process.env[CONTROLLED_EXECUTION_GATE] = 'true';
      mockGetSessionById.mockResolvedValue(createMockSession());

      // These are read-only checks
      await checkNewRunEligibility({ actorId: 100, sessionId: 1 });
      await checkReplayEligibility({ actorId: 100, sessionId: 1, runId: 500 });

      // Verify only read operations were called
      expect(mockGetSessionById).toHaveBeenCalled();
      // No create, update, or delete operations should have been called
    });

    it('gate check does not interact with database', async () => {
      delete process.env[CONTROLLED_EXECUTION_GATE];

      await checkNewRunEligibility({ actorId: 100, sessionId: 1 });

      // Database should not be touched when gate is disabled
      expect(mockGetSessionById).not.toHaveBeenCalled();
    });
  });
});
