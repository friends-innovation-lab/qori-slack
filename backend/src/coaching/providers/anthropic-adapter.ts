/**
 * Anthropic Coach Provider Adapter — Coach M2
 *
 * Thin wrapper around the existing modelProvider.ts for Coach execution.
 * Handles Anthropic-specific concerns:
 * - Timeout handling
 * - Error normalization
 * - Usage metadata extraction
 * - Idempotency key passthrough (when SDK supports it)
 *
 * TRANSITIONAL: Uses @langchain/anthropic via modelProvider.ts.
 * If provider changes, only this adapter and modelProvider need modification.
 */

import type {
  CoachModelProvider,
  CoachGenerationInput,
  CoachGenerationResult,
  CoachUsageMetadata,
} from './types';
import type { CoachingFailureCode } from '../../database/models/coaching_run';
import { createModel, getModelName, type ModelTier } from '../../helpers/modelProvider';

/**
 * Anthropic provider adapter for Coach.
 */
export class AnthropicCoachProvider implements CoachModelProvider {
  readonly providerName = 'anthropic';

  private readonly tier: ModelTier;
  private readonly modelOverride?: string;

  constructor(options: { tier: ModelTier; modelOverride?: string } = { tier: 'sonnet' }) {
    this.tier = options.tier;
    this.modelOverride = options.modelOverride;
  }

  supportsIdempotency(): boolean {
    // Anthropic supports idempotency via x-idempotency-key header,
    // but @langchain/anthropic doesn't expose it yet.
    // Return false for now — Coach is correct without it.
    return false;
  }

  async generateReview(input: CoachGenerationInput): Promise<CoachGenerationResult> {
    const startTime = Date.now();
    const modelName = this.modelOverride || getModelName(this.tier);

    try {
      // Create model instance with input parameters
      const llm = createModel({
        tier: this.tier,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        purpose: 'coach-review',
      });

      // Build prompt with system and user sections
      // LangChain ChatAnthropic accepts an array of messages or a single string
      const fullPrompt = `${input.systemPrompt}\n\n${input.userPrompt}`;

      // Execute with timeout
      const response = await this.invokeWithTimeout(llm, fullPrompt, input.timeoutMs);
      const latencyMs = Date.now() - startTime;

      // Extract usage metadata
      const usage = this.extractUsage(response, latencyMs);

      // LangChain returns content as string or array of content blocks
      const content = this.extractContent(response);

      return {
        success: true,
        content,
        usage,
        model: modelName,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.normalizeError(error, latencyMs);
    }
  }

  /**
   * Invoke LLM with timeout.
   */
  private async invokeWithTimeout(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    llm: any,
    prompt: string,
    timeoutMs: number,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // LangChain's invoke doesn't natively support AbortController,
      // so we race the promise against a timeout
      const result = await Promise.race([
        llm.invoke(prompt),
        new Promise((_, reject) => {
          setTimeout(() => reject(new TimeoutError('Provider timeout')), timeoutMs);
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract text content from LangChain response.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractContent(response: any): string {
    if (typeof response?.content === 'string') {
      return response.content;
    }
    // Handle array of content blocks (text blocks)
    if (Array.isArray(response?.content)) {
      return response.content
        .filter((block: unknown) => typeof block === 'object' && block !== null && 'text' in block)
        .map((block: { text: string }) => block.text)
        .join('');
    }
    // Fallback: stringify
    return String(response?.content ?? '');
  }

  /**
   * Extract usage metadata from LangChain response.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractUsage(response: any, latencyMs: number): CoachUsageMetadata {
    // LangChain exposes usage via response_metadata.usage
    const usage = response?.response_metadata?.usage ?? response?.usage_metadata ?? {};

    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const totalTokens = inputTokens + outputTokens;

    // Estimate cost based on Claude 3.5 Sonnet pricing (approximate)
    // Input: $3/MTok, Output: $15/MTok
    const estimatedCost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
      estimatedCost,
    };
  }

  /**
   * Normalize errors to CoachGenerationFailure.
   */
  private normalizeError(
    error: unknown,
    latencyMs: number,
  ): CoachGenerationResult {
    const partialUsage: Partial<CoachUsageMetadata> = { latencyMs };

    // Timeout
    if (error instanceof TimeoutError) {
      return {
        success: false,
        failureCode: 'PROVIDER_TIMEOUT',
        diagnostic: 'Provider request timed out',
        usage: partialUsage,
      };
    }

    // Anthropic-specific error handling
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // Rate limiting
    if (lowerMessage.includes('rate') && lowerMessage.includes('limit')) {
      return {
        success: false,
        failureCode: 'RATE_LIMITED',
        diagnostic: 'Provider rate limit exceeded',
        usage: partialUsage,
      };
    }

    // Overloaded / unavailable
    if (
      lowerMessage.includes('overloaded') ||
      lowerMessage.includes('unavailable') ||
      lowerMessage.includes('503') ||
      lowerMessage.includes('502')
    ) {
      return {
        success: false,
        failureCode: 'PROVIDER_UNAVAILABLE',
        diagnostic: 'Provider temporarily unavailable',
        usage: partialUsage,
      };
    }

    // Invalid response (malformed JSON, etc.)
    if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('malformed') ||
      lowerMessage.includes('parse')
    ) {
      return {
        success: false,
        failureCode: 'INVALID_MODEL_RESPONSE',
        diagnostic: 'Provider returned invalid response',
        usage: partialUsage,
      };
    }

    // Default: general generation failure
    // Sanitize message to avoid leaking secrets
    const sanitizedDiagnostic = this.sanitizeDiagnostic(message);

    return {
      success: false,
      failureCode: 'GENERATION_FAILED',
      diagnostic: sanitizedDiagnostic,
      usage: partialUsage,
    };
  }

  /**
   * Sanitize diagnostic message to avoid leaking sensitive data.
   */
  private sanitizeDiagnostic(message: string): string {
    // Remove anything that looks like an API key
    let sanitized = message.replace(/sk-[a-zA-Z0-9-_]+/g, '[REDACTED_KEY]');
    // Remove URLs with potential credentials
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[REDACTED_URL]');
    // Truncate to reasonable length
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200) + '...';
    }
    return sanitized || 'Generation failed';
  }
}

/**
 * Custom timeout error class.
 */
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Create an Anthropic provider instance with default configuration.
 */
export function createAnthropicProvider(
  options: { tier?: ModelTier; modelOverride?: string } = {},
): CoachModelProvider {
  return new AnthropicCoachProvider({
    tier: options.tier ?? 'sonnet',
    modelOverride: options.modelOverride,
  });
}
