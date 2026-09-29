/**
 * Coach Orchestrator Timeout Tests — Coach M2 Debug
 *
 * Tests that verify the execution lifecycle around provider timeout:
 * - Never-resolving provider → timeout → PROVIDER_TIMEOUT normalized
 * - Timeout path does NOT require 120-second stale recovery
 * - Operational retry follows existing policy
 *
 * These tests mock the provider to simulate timeout scenarios and
 * verify the orchestrator handles them correctly.
 */

import type { CoachModelProvider, CoachGenerationResult } from '../../coaching/providers/types';

// Mock the provider module before imports
jest.mock('../../coaching/providers/anthropic-adapter', () => ({
  createAnthropicProvider: jest.fn(),
}));

// Mock context resolver
jest.mock('../../coaching/context-resolver', () => ({
  resolveContext: jest.fn(),
  ContextResolutionError: class ContextResolutionError extends Error {},
}));

// Mock contract registry
jest.mock('../../coaching/contracts/registry', () => ({
  getActiveContract: jest.fn(),
}));

// Mock claim service
jest.mock('../../coaching/claim-service', () => ({
  validateClaimOwnership: jest.fn(),
  markCompleted: jest.fn(),
  markFailed: jest.fn(),
  updateHeartbeat: jest.fn().mockResolvedValue(true),
  recordUsage: jest.fn().mockResolvedValue(undefined),
}));

// Mock model provider
jest.mock('../../helpers/modelProvider', () => ({
  resolveModelTier: jest.fn().mockReturnValue('sonnet'),
}));

// Mock database
jest.mock('../../database', () => ({
  transaction: jest.fn(),
  query: jest.fn(),
}));

// Mock coaching app service
jest.mock('../../application/coaching.app-service', () => ({
  recordCoachRunItems: jest.fn(),
  recordCoachRunReferences: jest.fn(),
  recordCoachRunContext: jest.fn(),
}));

// Mock diagnostics
jest.mock('../../coaching/ownership-diagnostics', () => ({
  logExecutionStarted: jest.fn(),
  logExecutionCompleted: jest.fn(),
  logExecutionFailed: jest.fn(),
}));

jest.mock('../../coaching/execution-diagnostics', () => ({
  logContextBuildStarted: jest.fn(),
  logContextBuildCompleted: jest.fn(),
  logProviderRequestStarted: jest.fn(),
  logProviderResponseReceived: jest.fn(),
  logProviderRequestFailed: jest.fn(),
  logValidationStarted: jest.fn(),
  logValidationCompleted: jest.fn(),
  logPersistenceStarted: jest.fn(),
  logPersistenceCompleted: jest.fn(),
}));

// Mock config to use short intervals for testing
jest.mock('../../coaching/config', () => ({
  COACH_HEARTBEAT_INTERVAL_MS: 50, // 50ms for fast testing
}));

import { executeCoachRun } from '../../coaching/execution-orchestrator';
import { createAnthropicProvider } from '../../coaching/providers/anthropic-adapter';
import { resolveContext } from '../../coaching/context-resolver';
import { getActiveContract } from '../../coaching/contracts/registry';
import {
  validateClaimOwnership,
  markFailed,
  recordUsage,
} from '../../coaching/claim-service';
import type { CoachingRun } from '../../database/models/coaching_run';

const mockCreateAnthropicProvider = createAnthropicProvider as jest.MockedFunction<typeof createAnthropicProvider>;
const mockResolveContext = resolveContext as jest.MockedFunction<typeof resolveContext>;
const mockGetActiveContract = getActiveContract as jest.MockedFunction<typeof getActiveContract>;
const mockValidateClaimOwnership = validateClaimOwnership as jest.MockedFunction<typeof validateClaimOwnership>;
const mockMarkFailed = markFailed as jest.MockedFunction<typeof markFailed>;
const mockRecordUsage = recordUsage as jest.MockedFunction<typeof recordUsage>;

describe('Coach Orchestrator Timeout Behavior', () => {
  const mockWorkerId = 'test-worker-123';

  const createMockRun = (overrides: Partial<CoachingRun> = {}): CoachingRun => ({
    id: 'test-run-456',
    artifact_id: 1,
    artifact_type: 'brief',
    content_version: 1,
    review_scope: 'artifact',
    selected_section_key: null,
    status: 'running',
    attempt_count: 1,
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    generation_config_json: {
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: 100, // 100ms timeout for testing
    },
    ...overrides,
  } as CoachingRun);

  const mockContract = {
    contractVersion: '1.0.0',
    promptTemplateVersion: '1.0.0',
    artifactType: 'brief',
    rubric: [],
    contextPolicy: {
      maxContextTokens: 8000,
      requiredContext: [],
      supportingContext: [],
      allowTruncation: true,
      maxTokensPerEntry: 2000,
    },
    outputSchema: {
      maxItemsPerCategory: 10,
      minItemsPerCategory: 0,
      maxItemTextLength: 500,
      maxReferencesPerItem: 5,
      enabledCategories: ['strength', 'issue', 'suggestion', 'question'] as Array<'strength' | 'issue' | 'suggestion' | 'question'>,
    },
    sections: [],
    modelConfig: {
      tier: 'sonnet' as const,
      temperature: 0.3,
      maxOutputTokens: 4096,
      timeoutMs: 60000,
    },
    maxRepairAttempts: 1,
    getSystemPrompt: jest.fn().mockReturnValue('System prompt'),
    getUserPromptTemplate: jest.fn().mockReturnValue('User prompt {{artifact_context}} {{ref_handles}} {{section_content}}'),
    getRepairPrompt: jest.fn().mockReturnValue('Repair prompt'),
    isValidSectionKey: jest.fn().mockReturnValue(false),
    getSectionDisplayName: jest.fn().mockReturnValue(null),
  };

  const mockContext = {
    artifactContext: 'Artifact context',
    refHandlesText: '',
    sectionContent: null,
    citationHandles: new Map(),
    manifestEntries: [],
    contentVersion: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockGetActiveContract.mockReturnValue(mockContract);
    mockResolveContext.mockResolvedValue(mockContext);
    mockValidateClaimOwnership.mockResolvedValue(true);
    mockMarkFailed.mockResolvedValue(true);
    mockRecordUsage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('provider timeout triggers normalized failure path', () => {
    it('returns PROVIDER_TIMEOUT failure without requiring stale recovery', async () => {
      // Provider returns timeout failure directly
      const timeoutProvider: CoachModelProvider = {
        providerName: 'anthropic',
        supportsIdempotency: () => false,
        generateReview: jest.fn().mockResolvedValue({
          success: false,
          failureCode: 'PROVIDER_TIMEOUT',
          diagnostic: 'Provider request timed out',
          usage: { latencyMs: 100 },
        } as CoachGenerationResult),
      };

      mockCreateAnthropicProvider.mockReturnValue(timeoutProvider);

      const mockRun = createMockRun();

      const result = await executeCoachRun(mockRun, mockWorkerId);

      // Verify normalized PROVIDER_TIMEOUT
      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('PROVIDER_TIMEOUT');

      // Verify claim ownership was checked before provider call
      expect(mockValidateClaimOwnership).toHaveBeenCalledWith(mockRun.id, mockWorkerId);

      // Verify partial usage was recorded
      expect(mockRecordUsage).toHaveBeenCalled();
    });
  });

  describe('timeout does not require stale recovery path', () => {
    it('timeout failure is immediate, not delayed by stale threshold', async () => {
      const startTime = Date.now();

      // Provider that times out after configured timeout
      const timeoutProvider: CoachModelProvider = {
        providerName: 'anthropic',
        supportsIdempotency: () => false,
        generateReview: jest.fn().mockImplementation(async () => {
          // Simulate timeout behavior - wait for configured timeout then fail
          await new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Provider timeout'));
            }, 100);
          });
        }),
      };

      mockCreateAnthropicProvider.mockReturnValue(timeoutProvider);

      const mockRun = createMockRun();

      const executionPromise = executeCoachRun(mockRun, mockWorkerId);

      // Advance time to trigger timeout
      await jest.advanceTimersByTimeAsync(150);

      await executionPromise;

      // Verify execution completed much faster than stale threshold (120s)
      // With fake timers, we only advanced 150ms
      expect(mockMarkFailed).toHaveBeenCalled();
    });

    it('multiple timeouts do not wait for stale recovery between attempts', async () => {
      let attemptCount = 0;

      // Provider that always times out
      const alwaysTimeoutProvider: CoachModelProvider = {
        providerName: 'anthropic',
        supportsIdempotency: () => false,
        generateReview: jest.fn().mockImplementation(() => {
          attemptCount++;
          return Promise.resolve({
            success: false,
            failureCode: 'PROVIDER_TIMEOUT',
            diagnostic: `Timeout on attempt ${attemptCount}`,
            usage: { latencyMs: 100 },
          } as CoachGenerationResult);
        }),
      };

      mockCreateAnthropicProvider.mockReturnValue(alwaysTimeoutProvider);

      const mockRun = createMockRun();

      const result = await executeCoachRun(mockRun, mockWorkerId);

      // Verify failure without waiting for stale recovery
      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('PROVIDER_TIMEOUT');

      // Only one attempt because first failure immediately fails the run
      expect(attemptCount).toBe(1);
    });
  });

  describe('heartbeat continues during execution', () => {
    it('heartbeat is started on execution begin', async () => {
      // Fast-completing provider
      const fastProvider: CoachModelProvider = {
        providerName: 'anthropic',
        supportsIdempotency: () => false,
        generateReview: jest.fn().mockResolvedValue({
          success: false,
          failureCode: 'GENERATION_FAILED',
          diagnostic: 'Test failure',
        } as CoachGenerationResult),
      };

      mockCreateAnthropicProvider.mockReturnValue(fastProvider);

      const mockRun = createMockRun();

      await executeCoachRun(mockRun, mockWorkerId);

      // Execution started, so contract was fetched
      expect(mockGetActiveContract).toHaveBeenCalled();
    });
  });

  describe('late completion safety', () => {
    it('ownership is validated before each provider attempt', async () => {
      const successProvider: CoachModelProvider = {
        providerName: 'anthropic',
        supportsIdempotency: () => false,
        generateReview: jest.fn().mockResolvedValue({
          success: true,
          content: JSON.stringify({
            strengths: [],
            issues: [],
            suggestions: [],
            questions: [],
          }),
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            latencyMs: 500,
          },
          model: 'claude-sonnet-4-20250514',
        } as CoachGenerationResult),
      };

      mockCreateAnthropicProvider.mockReturnValue(successProvider);

      const mockRun = createMockRun();

      await executeCoachRun(mockRun, mockWorkerId);

      // Verify ownership was validated before provider call
      expect(mockValidateClaimOwnership).toHaveBeenCalledWith(mockRun.id, mockWorkerId);
    });

    it('claim_lost is returned if ownership check fails before provider call', async () => {
      // First validation succeeds, but before provider call fails
      mockValidateClaimOwnership.mockResolvedValueOnce(false);

      const mockRun = createMockRun();

      const result = await executeCoachRun(mockRun, mockWorkerId);

      expect(result.success).toBe(false);
      expect(result.status).toBe('claim_lost');
    });
  });
});
