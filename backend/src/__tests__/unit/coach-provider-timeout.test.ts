/**
 * Coach Provider Timeout Tests — Coach M2 Debug
 *
 * Unit tests for provider timeout behavior:
 * - Never-resolving provider triggers timeout
 * - Slow-but-successful provider completes
 * - Timeout fires at correct elapsed time
 *
 * These tests use deterministic timeouts (50-100ms) to verify
 * timeout behavior without flakiness.
 */

import { AnthropicCoachProvider } from '../../coaching/providers/anthropic-adapter';
import type { CoachGenerationInput, CoachDiagnosticContext } from '../../coaching/providers/types';

// Mock the modelProvider module
jest.mock('../../helpers/modelProvider', () => ({
  createModel: jest.fn(),
  getModelName: jest.fn().mockReturnValue('claude-sonnet-4-20250514'),
}));

// Import after mocking
import { createModel } from '../../helpers/modelProvider';

// Mock diagnostic logging to verify it's called
jest.mock('../../coaching/execution-diagnostics', () => ({
  logProviderTimeoutArmed: jest.fn(),
  logProviderTimeoutFired: jest.fn(),
}));

import {
  logProviderTimeoutArmed,
  logProviderTimeoutFired,
} from '../../coaching/execution-diagnostics';

const mockedCreateModel = createModel as jest.MockedFunction<typeof createModel>;
const mockedLogTimeoutArmed = logProviderTimeoutArmed as jest.MockedFunction<typeof logProviderTimeoutArmed>;
const mockedLogTimeoutFired = logProviderTimeoutFired as jest.MockedFunction<typeof logProviderTimeoutFired>;

describe('AnthropicCoachProvider timeout behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createInput = (
    timeoutMs: number,
    diagnosticContext?: CoachDiagnosticContext,
  ): CoachGenerationInput => ({
    systemPrompt: 'Test system prompt',
    userPrompt: 'Test user prompt',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    maxTokens: 4096,
    timeoutMs,
    diagnosticContext,
  });

  describe('never-resolving provider', () => {
    it('triggers timeout with PROVIDER_TIMEOUT failure code', async () => {
      // Create a never-resolving promise
      const neverResolves = new Promise(() => {
        // Intentionally never resolves
      });

      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockReturnValue(neverResolves),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(50); // 50ms timeout

      const startTime = Date.now();
      const result = await provider.generateReview(input);
      const elapsed = Date.now() - startTime;

      // Verify timeout behavior
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failureCode).toBe('PROVIDER_TIMEOUT');
        expect(result.diagnostic).toBe('Provider request timed out');
      }

      // Verify elapsed time is close to timeout (with some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(45); // At least 45ms
      expect(elapsed).toBeLessThan(150); // But not too long
    });

    it('logs PROVIDER_TIMEOUT_ARMED and PROVIDER_TIMEOUT_FIRED with diagnostic context', async () => {
      const neverResolves = new Promise(() => {});

      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockReturnValue(neverResolves),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const diagnosticContext: CoachDiagnosticContext = {
        runId: 'test-run-123',
        workerId: 'test-worker-456',
      };
      const input = createInput(50, diagnosticContext);

      await provider.generateReview(input);

      // Verify diagnostic logging
      expect(mockedLogTimeoutArmed).toHaveBeenCalledWith(
        'test-run-123',
        'test-worker-456',
        50,
      );
      expect(mockedLogTimeoutFired).toHaveBeenCalledWith(
        'test-run-123',
        'test-worker-456',
        50,
        expect.any(Number), // elapsed time
      );
    });

    it('does not log timeout diagnostics without diagnostic context', async () => {
      const neverResolves = new Promise(() => {});

      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockReturnValue(neverResolves),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(50); // No diagnostic context

      await provider.generateReview(input);

      // Verify no diagnostic logging
      expect(mockedLogTimeoutArmed).not.toHaveBeenCalled();
      expect(mockedLogTimeoutFired).not.toHaveBeenCalled();
    });
  });

  describe('slow-but-successful provider', () => {
    it('completes successfully when response arrives before timeout', async () => {
      // Create a slow but eventually resolving promise
      const slowResponse = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            content: 'Generated content',
            response_metadata: {
              usage: { input_tokens: 100, output_tokens: 50 },
            },
          });
        }, 30); // 30ms delay
      });

      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockReturnValue(slowResponse),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(100); // 100ms timeout, 30ms response

      const result = await provider.generateReview(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.content).toBe('Generated content');
        expect(result.usage.inputTokens).toBe(100);
        expect(result.usage.outputTokens).toBe(50);
      }
    });

    it('logs PROVIDER_TIMEOUT_ARMED but NOT PROVIDER_TIMEOUT_FIRED for successful completion', async () => {
      const fastResponse = Promise.resolve({
        content: 'Fast response',
        response_metadata: {
          usage: { input_tokens: 50, output_tokens: 25 },
        },
      });

      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockReturnValue(fastResponse),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const diagnosticContext: CoachDiagnosticContext = {
        runId: 'test-run-789',
        workerId: 'test-worker-012',
      };
      const input = createInput(100, diagnosticContext);

      await provider.generateReview(input);

      // Verify only armed was logged, not fired
      expect(mockedLogTimeoutArmed).toHaveBeenCalledWith(
        'test-run-789',
        'test-worker-012',
        100,
      );
      expect(mockedLogTimeoutFired).not.toHaveBeenCalled();
    });
  });

  describe('timeout timing accuracy', () => {
    it('fires timeout at approximately the configured time', async () => {
      const neverResolves = new Promise(() => {});

      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockReturnValue(neverResolves),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const timeoutMs = 75;
      const input = createInput(timeoutMs);

      const startTime = Date.now();
      await provider.generateReview(input);
      const elapsed = Date.now() - startTime;

      // Verify timing is accurate within tolerance
      // Allow 25ms tolerance for timer precision
      expect(elapsed).toBeGreaterThanOrEqual(timeoutMs - 5);
      expect(elapsed).toBeLessThan(timeoutMs + 30);
    });

    it('records accurate elapsed time in diagnostic log', async () => {
      const neverResolves = new Promise(() => {});

      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockReturnValue(neverResolves),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const diagnosticContext: CoachDiagnosticContext = {
        runId: 'timing-test',
        workerId: 'timing-worker',
      };
      const timeoutMs = 60;
      const input = createInput(timeoutMs, diagnosticContext);

      const startTime = Date.now();
      await provider.generateReview(input);
      const totalElapsed = Date.now() - startTime;

      // Get the elapsed time that was logged
      const loggedElapsed = mockedLogTimeoutFired.mock.calls[0][3];

      // Logged elapsed should be close to configured timeout
      // Allow tolerance for timer precision and overhead
      expect(loggedElapsed).toBeGreaterThanOrEqual(timeoutMs - 10);
      expect(loggedElapsed).toBeLessThanOrEqual(timeoutMs + 50); // Allow extra overhead
    });
  });

  describe('provider error handling', () => {
    it('returns GENERATION_FAILED for non-timeout errors', async () => {
      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(1000);

      const result = await provider.generateReview(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failureCode).toBe('GENERATION_FAILED');
        expect(result.diagnostic).toContain('Network error');
      }
    });

    it('returns RATE_LIMITED for rate limit errors', async () => {
      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(1000);

      const result = await provider.generateReview(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failureCode).toBe('RATE_LIMITED');
      }
    });

    it('returns PROVIDER_UNAVAILABLE for 503 errors', async () => {
      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(1000);

      const result = await provider.generateReview(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failureCode).toBe('PROVIDER_UNAVAILABLE');
      }
    });
  });

  describe('content extraction', () => {
    it('extracts string content directly', async () => {
      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: 'Direct string content',
          response_metadata: { usage: { input_tokens: 10, output_tokens: 5 } },
        }),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(1000);

      const result = await provider.generateReview(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.content).toBe('Direct string content');
      }
    });

    it('extracts content from array of text blocks', async () => {
      mockedCreateModel.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: [
            { text: 'First block. ' },
            { text: 'Second block.' },
          ],
          response_metadata: { usage: { input_tokens: 10, output_tokens: 5 } },
        }),
      } as unknown as ReturnType<typeof createModel>);

      const provider = new AnthropicCoachProvider({ tier: 'sonnet' });
      const input = createInput(1000);

      const result = await provider.generateReview(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.content).toBe('First block. Second block.');
      }
    });
  });
});
