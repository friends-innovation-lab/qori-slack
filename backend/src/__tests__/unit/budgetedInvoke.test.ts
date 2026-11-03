/**
 * DISC-WEB-1D-2 M3: Budgeted AI Invocation Tests
 *
 * Tests the fail-closed invocation wrapper for controlled test sessions.
 * Uses mocks only — no Anthropic network requests.
 */

import {
  budgetedInvoke,
  budgetedInvokeWithRetry,
  type BudgetedInvokeInput,
  type BudgetedInvokeResult,
} from '../../helpers/budgetedInvoke';
import * as budgetService from '../../services/controlled-test-budget.service';
import type { ReconcileUsageResult } from '../../services/controlled-test-budget.service';
import * as modelProvider from '../../helpers/modelProvider';
import { CONTROLLED_TEST_MAX_TOKENS } from '../../helpers/modelProvider';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../services/controlled-test-budget.service');
jest.mock('../../helpers/modelProvider');

const mockBudgetService = budgetService as jest.Mocked<typeof budgetService>;
const mockModelProvider = modelProvider as jest.Mocked<typeof modelProvider>;

// Mock model with invoke and getNumTokens
const createMockModel = (overrides: {
  getNumTokens?: () => Promise<number>;
  invoke?: () => Promise<{ content: string; usage_metadata?: { input_tokens: number; output_tokens: number } }>;
} = {}) => ({
  getNumTokens: overrides.getNumTokens ?? jest.fn().mockResolvedValue(100),
  invoke: overrides.invoke ?? jest.fn().mockResolvedValue({
    content: 'Mock response',
    usage_metadata: { input_tokens: 100, output_tokens: 50 },
  }),
});

// Mock session factory
const createMockSession = (overrides: Partial<ControlledTestSession> = {}): ControlledTestSession => ({
  id: 1,
  public_id: 'test-uuid',
  status: 'active',
  max_requests: 10,
  max_input_tokens: 10000,
  max_output_tokens: 10000,
  used_requests: 0,
  used_input_tokens: 0,
  used_output_tokens: 0,
  discovery_run_id: null,
  created_by_actor_id: null,
  cancelled_at: null,
  cancellation_reason: null,
  exhausted_at: null,
  completed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
} as ControlledTestSession);

// Default successful reservation result (includes reservationId for idempotent reconciliation)
const createSuccessfulReservation = (reservationId: number = 1): budgetService.ReserveBudgetResult => ({
  ok: true,
  reservationId,
  sessionStatus: 'active',
  remainingRequests: 9,
  remainingInputTokens: 9900,
  remainingOutputTokens: 10000,
});

// Default successful reconciliation result
const createSuccessfulReconciliation = (tokensReleased: number = CONTROLLED_TEST_MAX_TOKENS - 50): ReconcileUsageResult => ({
  ok: true,
  alreadyReconciled: false,
  reservedOutputTokens: CONTROLLED_TEST_MAX_TOKENS,
  tokensReleased,
});

describe('DISC-WEB-1D-2 M3: Budgeted AI Invocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: session exists and is active
    mockBudgetService.getSessionById.mockResolvedValue(createMockSession());
    // Default: reservation succeeds (includes reservationId for idempotent reconciliation)
    mockBudgetService.reserveBudget.mockResolvedValue(createSuccessfulReservation());
    // Default: reconciliation succeeds (returns ReconcileUsageResult, not session)
    mockBudgetService.reconcileUsage.mockResolvedValue(createSuccessfulReconciliation());
    // Default: model creation succeeds
    mockModelProvider.createControlledTestModel.mockReturnValue(createMockModel() as any);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Successful invocation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('successful invocation', () => {
    it('completes full reservation → invoke → reconcile cycle', async () => {
      const mockModel = createMockModel();
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test prompt',
        purpose: 'test',
      });

      expect(result.ok).toBe(true);
      expect(result.content).toBe('Mock response');
      expect(result.usage?.estimatedInputTokens).toBe(100);
      expect(result.usage?.reservedOutputTokens).toBe(CONTROLLED_TEST_MAX_TOKENS);
      expect(result.usage?.actualInputTokens).toBe(100);
      expect(result.usage?.actualOutputTokens).toBe(50);
      expect(result.usage?.reconciled).toBe(true);

      // Verify call sequence
      expect(mockBudgetService.getSessionById).toHaveBeenCalledWith(1);
      expect(mockModelProvider.createControlledTestModel).toHaveBeenCalled();
      expect(mockModel.getNumTokens).toHaveBeenCalledWith('Test prompt');
      expect(mockBudgetService.reserveBudget).toHaveBeenCalledWith({
        sessionId: 1,
        estimatedInputTokens: 100,
        reservedOutputTokens: CONTROLLED_TEST_MAX_TOKENS,
        purpose: 'test',
      });
      expect(mockModel.invoke).toHaveBeenCalledWith('Test prompt');
      // New interface: reconcileUsage uses reservationId (from reservation result)
      expect(mockBudgetService.reconcileUsage).toHaveBeenCalledWith({
        reservationId: 1, // From createSuccessfulReservation()
        actualInputTokens: 100,
        actualOutputTokens: 50,
      });
    });

    it('returns content as string when response.content is string', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockResolvedValue({
          content: 'String content',
          usage_metadata: { input_tokens: 50, output_tokens: 25 },
        }),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.content).toBe('String content');
    });

    it('stringifies content when response.content is array', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Block content' }],
          usage_metadata: { input_tokens: 50, output_tokens: 25 },
        }),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.content).toContain('Block content');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Session validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('session validation', () => {
    it('fails with session_not_found when session does not exist', async () => {
      mockBudgetService.getSessionById.mockResolvedValue(null);

      const result = await budgetedInvoke({
        sessionId: 999,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('session_not_found');
      expect(mockModelProvider.createControlledTestModel).not.toHaveBeenCalled();
    });

    it('fails with session_terminal when session is cancelled', async () => {
      mockBudgetService.getSessionById.mockResolvedValue(
        createMockSession({ status: 'cancelled' }),
      );

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('session_terminal');
      expect(result.reservationResult?.reason).toBe('session_terminal');
      expect(mockModelProvider.createControlledTestModel).not.toHaveBeenCalled();
    });

    it('fails with session_terminal when session is completed', async () => {
      mockBudgetService.getSessionById.mockResolvedValue(
        createMockSession({ status: 'completed' }),
      );

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('session_terminal');
    });

    it('fails with session_terminal when session is exhausted', async () => {
      mockBudgetService.getSessionById.mockResolvedValue(
        createMockSession({ status: 'exhausted' }),
      );

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('session_terminal');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Budget exhaustion
  // ═══════════════════════════════════════════════════════════════════════════

  describe('budget exhaustion', () => {
    it('fails with budget_exceeded when request limit reached', async () => {
      mockBudgetService.reserveBudget.mockResolvedValue({
        ok: false,
        reason: 'budget_exceeded',
        sessionStatus: 'active',
      });

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('budget_exceeded');
      expect(result.usage?.reconciled).toBe(false);
    });

    it('fails with budget_exceeded when input token limit reached', async () => {
      mockBudgetService.reserveBudget.mockResolvedValue({
        ok: false,
        reason: 'budget_exceeded',
        sessionStatus: 'active',
      });

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Very long prompt that exceeds budget',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('budget_exceeded');
    });

    it('fails with session_terminal when session became exhausted during reservation', async () => {
      mockBudgetService.reserveBudget.mockResolvedValue({
        ok: false,
        reason: 'session_terminal',
        sessionStatus: 'exhausted',
      });

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('session_terminal');
      expect(result.reservationResult?.sessionStatus).toBe('exhausted');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Token measurement failure
  // ═══════════════════════════════════════════════════════════════════════════

  describe('token measurement failure', () => {
    it('fails with token_measurement_failed when getNumTokens throws', async () => {
      const mockModel = createMockModel({
        getNumTokens: jest.fn().mockRejectedValue(new Error('Tokenizer error')),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('token_measurement_failed');
      expect(result.errorMessage).toContain('Tokenizer error');
      expect(mockBudgetService.reserveBudget).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F2: Invalid token estimate validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('invalid token estimate — F2 wrapper validation', () => {
    it('fails with invalid_token_estimate for zero tokens', async () => {
      const mockModel = createMockModel({
        getNumTokens: jest.fn().mockResolvedValue(0),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_token_estimate');
      expect(result.errorMessage).toContain('must be finite positive integer');
      expect(mockBudgetService.reserveBudget).not.toHaveBeenCalled();
    });

    it('fails with invalid_token_estimate for negative tokens', async () => {
      const mockModel = createMockModel({
        getNumTokens: jest.fn().mockResolvedValue(-5),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_token_estimate');
      expect(mockBudgetService.reserveBudget).not.toHaveBeenCalled();
    });

    it('fails with invalid_token_estimate for fractional tokens', async () => {
      const mockModel = createMockModel({
        getNumTokens: jest.fn().mockResolvedValue(100.5),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_token_estimate');
      expect(mockBudgetService.reserveBudget).not.toHaveBeenCalled();
    });

    it('fails with invalid_token_estimate for NaN', async () => {
      const mockModel = createMockModel({
        getNumTokens: jest.fn().mockResolvedValue(NaN),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_token_estimate');
      expect(mockBudgetService.reserveBudget).not.toHaveBeenCalled();
    });

    it('fails with invalid_token_estimate for Infinity', async () => {
      const mockModel = createMockModel({
        getNumTokens: jest.fn().mockResolvedValue(Infinity),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_token_estimate');
      expect(mockBudgetService.reserveBudget).not.toHaveBeenCalled();
    });

    it('handles InvalidBudgetInputError from service layer', async () => {
      const mockModel = createMockModel();
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);
      mockBudgetService.reserveBudget.mockRejectedValue(
        new budgetService.InvalidBudgetInputError('estimatedInputTokens', 100, 'test error'),
      );

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_token_estimate');
      expect(result.usage?.reconciled).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider failure and timeout
  // ═══════════════════════════════════════════════════════════════════════════

  describe('provider failure', () => {
    it('fails with provider_error and retains reservation on generic error', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockRejectedValue(new Error('API error')),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('provider_error');
      expect(result.errorMessage).toContain('API error');
      expect(result.usage?.reconciled).toBe(false);
      // Reservation was made but not reconciled
      expect(mockBudgetService.reserveBudget).toHaveBeenCalled();
      expect(mockBudgetService.reconcileUsage).not.toHaveBeenCalled();
    });

    it('fails with timeout on timeout-related errors', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockRejectedValue(new Error('Request timed out')),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('timeout');
      expect(result.usage?.reconciled).toBe(false);
    });

    it('detects ECONNRESET as timeout', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockRejectedValue(new Error('read ECONNRESET')),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.error).toBe('timeout');
    });

    it('detects socket hang up as timeout', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockRejectedValue(new Error('socket hang up')),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.error).toBe('timeout');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Missing or malformed usage metadata
  // ═══════════════════════════════════════════════════════════════════════════

  describe('usage metadata handling', () => {
    it('skips reconciliation when usage_metadata is missing', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockResolvedValue({
          content: 'Response without metadata',
          // No usage_metadata
        }),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(true);
      expect(result.content).toBe('Response without metadata');
      expect(result.usage?.actualOutputTokens).toBeUndefined();
      expect(result.usage?.reconciled).toBe(false);
      expect(mockBudgetService.reconcileUsage).not.toHaveBeenCalled();
    });

    it('skips reconciliation when output_tokens is undefined', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockResolvedValue({
          content: 'Response',
          usage_metadata: { input_tokens: 100 }, // No output_tokens
        }),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(true);
      expect(result.usage?.reconciled).toBe(false);
    });

    it('uses estimated input tokens when actual is unavailable', async () => {
      const mockModel = createMockModel({
        getNumTokens: jest.fn().mockResolvedValue(150),
        invoke: jest.fn().mockResolvedValue({
          content: 'Response',
          usage_metadata: { output_tokens: 75 }, // No input_tokens
        }),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(true);
      expect(result.usage?.estimatedInputTokens).toBe(150);
      expect(result.usage?.actualInputTokens).toBeUndefined();
      expect(result.usage?.reconciled).toBe(true);
      // New interface: uses reservationId, actualInputTokens falls back to estimated
      expect(mockBudgetService.reconcileUsage).toHaveBeenCalledWith({
        reservationId: 1, // From createSuccessfulReservation()
        actualInputTokens: 150, // Falls back to estimated
        actualOutputTokens: 75,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Reconciliation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('successful reconciliation', () => {
    it('calls reconcileUsage with reservationId and actual token counts', async () => {
      const mockModel = createMockModel({
        invoke: jest.fn().mockResolvedValue({
          content: 'Response',
          usage_metadata: { input_tokens: 120, output_tokens: 80 },
        }),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      // New interface: uses reservationId instead of sessionId + reservedOutputTokens
      expect(mockBudgetService.reconcileUsage).toHaveBeenCalledWith({
        reservationId: 1, // From createSuccessfulReservation()
        actualInputTokens: 120,
        actualOutputTokens: 80,
      });
    });

    it('succeeds even when reconciliation fails (logs warning)', async () => {
      mockBudgetService.reconcileUsage.mockRejectedValue(
        new Error('Database error'),
      );

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(true);
      expect(result.usage?.reconciled).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconciliation warning'),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Model creation failure
  // ═══════════════════════════════════════════════════════════════════════════

  describe('model creation', () => {
    it('fails with provider_error when model creation throws', async () => {
      mockModelProvider.createControlledTestModel.mockImplementation(() => {
        throw new Error('Model not in allowlist');
      });

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('provider_error');
      expect(result.errorMessage).toContain('Model not in allowlist');
    });

    it('passes modelConfig to createControlledTestModel', async () => {
      const mockModel = createMockModel();
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
        purpose: 'test-purpose',
        modelConfig: { temperature: 0.5 },
      });

      expect(mockModelProvider.createControlledTestModel).toHaveBeenCalledWith({
        purpose: 'test-purpose',
        temperature: 0.5,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // No unguarded fallback
  // ═══════════════════════════════════════════════════════════════════════════

  describe('no unguarded fallback', () => {
    it('never calls production createModel', async () => {
      const createModelMock = jest.fn();
      (modelProvider as any).createModel = createModelMock;

      await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      expect(createModelMock).not.toHaveBeenCalled();
    });

    it('does not retry automatically on failure', async () => {
      const invokeCount = { count: 0 };
      const mockModel = createMockModel({
        invoke: jest.fn().mockImplementation(() => {
          invokeCount.count++;
          if (invokeCount.count === 1) {
            throw new Error('First attempt failed');
          }
          return Promise.resolve({
            content: 'Second attempt',
            usage_metadata: { input_tokens: 100, output_tokens: 50 },
          });
        }),
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

      const result = await budgetedInvoke({
        sessionId: 1,
        prompt: 'Test',
      });

      // Should fail on first attempt, not auto-retry
      expect(result.ok).toBe(false);
      expect(invokeCount.count).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Retry helper tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DISC-WEB-1D-2 M3: Budgeted Invoke With Retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBudgetService.getSessionById.mockResolvedValue(createMockSession());
    mockBudgetService.reserveBudget.mockResolvedValue(createSuccessfulReservation());
    mockBudgetService.reconcileUsage.mockResolvedValue(createSuccessfulReconciliation());
  });

  it('throws when maxAttempts < 1', async () => {
    await expect(
      budgetedInvokeWithRetry({ sessionId: 1, prompt: 'Test' }, 0),
    ).rejects.toThrow('maxAttempts must be at least 1');
  });

  it('returns immediately on success', async () => {
    const mockModel = createMockModel();
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(true);
    expect(mockModel.invoke).toHaveBeenCalledTimes(1);
  });

  it('requires fresh reservation on each retry', async () => {
    let attemptCount = 0;
    const mockModel = createMockModel({
      invoke: jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Provider error');
        }
        return Promise.resolve({
          content: 'Success on third attempt',
          usage_metadata: { input_tokens: 100, output_tokens: 50 },
        });
      }),
    });
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(true);
    expect(result.content).toBe('Success on third attempt');
    // Each attempt should call reserveBudget
    expect(mockBudgetService.reserveBudget).toHaveBeenCalledTimes(3);
    // Each attempt should measure tokens
    expect(mockModel.getNumTokens).toHaveBeenCalledTimes(3);
  });

  it('does not retry on session_not_found', async () => {
    mockBudgetService.getSessionById.mockResolvedValue(null);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('session_not_found');
    expect(mockBudgetService.getSessionById).toHaveBeenCalledTimes(1);
  });

  it('does not retry on session_terminal', async () => {
    mockBudgetService.getSessionById.mockResolvedValue(
      createMockSession({ status: 'cancelled' }),
    );

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('session_terminal');
    expect(mockBudgetService.getSessionById).toHaveBeenCalledTimes(1);
  });

  it('does not retry on budget_exceeded', async () => {
    mockBudgetService.reserveBudget.mockResolvedValue({
      ok: false,
      reason: 'budget_exceeded',
      sessionStatus: 'active',
    });

    const mockModel = createMockModel();
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('budget_exceeded');
    expect(mockBudgetService.reserveBudget).toHaveBeenCalledTimes(1);
  });

  it('does not retry on token_measurement_failed', async () => {
    const mockModel = createMockModel({
      getNumTokens: jest.fn().mockRejectedValue(new Error('Tokenizer error')),
    });
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('token_measurement_failed');
    expect(mockModel.getNumTokens).toHaveBeenCalledTimes(1);
  });

  it('does not retry on invalid_token_estimate', async () => {
    const mockModel = createMockModel({
      getNumTokens: jest.fn().mockResolvedValue(0), // Invalid: zero tokens
    });
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_token_estimate');
    expect(mockModel.getNumTokens).toHaveBeenCalledTimes(1);
  });

  it('retries on provider_error up to maxAttempts', async () => {
    const mockModel = createMockModel({
      invoke: jest.fn().mockRejectedValue(new Error('Provider error')),
    });
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('provider_error');
    expect(mockModel.invoke).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Retrying with fresh reservation'),
    );

    consoleLogSpy.mockRestore();
  });

  it('retries on timeout up to maxAttempts', async () => {
    const mockModel = createMockModel({
      invoke: jest.fn().mockRejectedValue(new Error('Request timed out')),
    });
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      2,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('timeout');
    expect(mockModel.invoke).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Concurrent access tests
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// M5e: Controlled Context Integration
// ═══════════════════════════════════════════════════════════════════════════════

// Mock the controlled execution context
jest.mock('../../context/controlledExecutionContext');

import { getControlledContext } from '../../context/controlledExecutionContext';

const mockGetControlledContext = getControlledContext as jest.MockedFunction<typeof getControlledContext>;

describe('DISC-WEB-1D-2 M5e: Controlled Context Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBudgetService.getSessionById.mockResolvedValue(createMockSession());
    mockBudgetService.reserveBudget.mockResolvedValue(createSuccessfulReservation());
    mockBudgetService.reconcileUsage.mockResolvedValue(createSuccessfulReconciliation());
    // Default: no controlled context
    mockGetControlledContext.mockReturnValue(undefined);
  });

  it('passes discoveryRunId from controlled context to reserveBudget', async () => {
    // Simulate controlled context with sessionId=1, discoveryRunId=42
    mockGetControlledContext.mockReturnValue({
      sessionId: 1,
      discoveryRunId: 42,
      lifecycleId: 1,
      isControlled: true,
      createdAt: new Date().toISOString(),
      purpose: 'test-controlled',
    });

    const mockModel = createMockModel();
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    await budgetedInvoke({
      sessionId: 1,
      prompt: 'Test controlled prompt',
      purpose: 'test',
    });

    // Verify reserveBudget was called with discoveryRunId
    expect(mockBudgetService.reserveBudget).toHaveBeenCalledWith({
      sessionId: 1,
      discoveryRunId: 42, // From controlled context
      estimatedInputTokens: 100,
      reservedOutputTokens: CONTROLLED_TEST_MAX_TOKENS,
      purpose: 'test',
    });
  });

  it('omits discoveryRunId when no controlled context is present', async () => {
    mockGetControlledContext.mockReturnValue(undefined);

    const mockModel = createMockModel();
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    await budgetedInvoke({
      sessionId: 1,
      prompt: 'Test ordinary prompt',
      purpose: 'test',
    });

    // Verify reserveBudget was called without discoveryRunId
    expect(mockBudgetService.reserveBudget).toHaveBeenCalledWith({
      sessionId: 1,
      discoveryRunId: undefined, // No context
      estimatedInputTokens: 100,
      reservedOutputTokens: CONTROLLED_TEST_MAX_TOKENS,
      purpose: 'test',
    });
  });

  it('fails with run_binding_mismatch when context run does not match session binding', async () => {
    mockGetControlledContext.mockReturnValue({
      sessionId: 1,
      discoveryRunId: 42,
      lifecycleId: 1,
      isControlled: true,
      createdAt: new Date().toISOString(),
    });

    // Session is bound to different run
    mockBudgetService.reserveBudget.mockResolvedValue({
      ok: false,
      reason: 'run_binding_mismatch',
      sessionStatus: 'active',
    });

    const mockModel = createMockModel();
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvoke({
      sessionId: 1,
      prompt: 'Test',
      purpose: 'test',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('run_binding_mismatch');
    expect(result.errorMessage).toContain('run_binding_mismatch');
  });

  it('does not retry on run_binding_mismatch', async () => {
    mockGetControlledContext.mockReturnValue({
      sessionId: 1,
      discoveryRunId: 42,
      lifecycleId: 1,
      isControlled: true,
      createdAt: new Date().toISOString(),
    });

    mockBudgetService.reserveBudget.mockResolvedValue({
      ok: false,
      reason: 'run_binding_mismatch',
      sessionStatus: 'active',
    });

    const mockModel = createMockModel();
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    const result = await budgetedInvokeWithRetry(
      { sessionId: 1, prompt: 'Test' },
      3,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('run_binding_mismatch');
    // Should not retry — binding mismatch is non-retryable
    expect(mockBudgetService.reserveBudget).toHaveBeenCalledTimes(1);
  });
});

describe('DISC-WEB-1D-2 M3: Concurrent Budget Access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBudgetService.getSessionById.mockResolvedValue(createMockSession());
    mockBudgetService.reconcileUsage.mockResolvedValue(createSuccessfulReconciliation());
    // Reset context mock for non-M5e tests
    mockGetControlledContext.mockReturnValue(undefined);
  });

  it('concurrent attempts respect shared budget', async () => {
    // Simulate budget that allows only 2 requests
    let reservationCount = 0;
    mockBudgetService.reserveBudget.mockImplementation(async () => {
      reservationCount++;
      if (reservationCount <= 2) {
        return {
          ok: true,
          reservationId: reservationCount, // Unique reservation ID per successful reservation
          sessionStatus: 'active' as const,
          remainingRequests: 2 - reservationCount,
          remainingInputTokens: 9000,
          remainingOutputTokens: 9000,
        };
      }
      return {
        ok: false,
        reason: 'budget_exceeded' as const,
        sessionStatus: 'active' as const,
      };
    });

    const mockModel = createMockModel();
    mockModelProvider.createControlledTestModel.mockReturnValue(mockModel as any);

    // Launch 5 concurrent requests
    const results = await Promise.all([
      budgetedInvoke({ sessionId: 1, prompt: 'Request 1' }),
      budgetedInvoke({ sessionId: 1, prompt: 'Request 2' }),
      budgetedInvoke({ sessionId: 1, prompt: 'Request 3' }),
      budgetedInvoke({ sessionId: 1, prompt: 'Request 4' }),
      budgetedInvoke({ sessionId: 1, prompt: 'Request 5' }),
    ]);

    const successes = results.filter(r => r.ok).length;
    const budgetExceeded = results.filter(r => r.error === 'budget_exceeded').length;

    // First 2 should succeed, remaining 3 should fail
    expect(successes).toBe(2);
    expect(budgetExceeded).toBe(3);
  });
});
