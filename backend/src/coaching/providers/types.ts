/**
 * Coach Model Provider Types — Coach M2
 *
 * Core interfaces for Coach provider abstraction. The Coach execution engine
 * works with these interfaces, not vendor-specific SDKs.
 *
 * Design principles:
 * - Provider adapters are thin wrappers
 * - Core Coach logic never imports vendor types
 * - Failure normalization happens in adapters
 * - Token/usage extraction happens in adapters
 */

import type { CoachingFailureCode } from '../../database/models/coaching_run';

// ─── Generation Input ───────────────────────────────────────────────────

/**
 * Input for Coach generation request.
 */
export interface CoachGenerationInput {
  /** System prompt defining Coach behavior and output format */
  systemPrompt: string;
  /** User prompt with artifact context and instructions */
  userPrompt: string;
  /** Model name (resolved by provider adapter) */
  model: string;
  /** Temperature for generation (typically 0.3-0.5 for structured output) */
  temperature: number;
  /** Maximum output tokens */
  maxTokens: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Idempotency key for retry deduplication (optional) */
  idempotencyKey?: string;
}

// ─── Generation Result ──────────────────────────────────────────────────

/**
 * Successful generation result.
 */
export interface CoachGenerationSuccess {
  success: true;
  /** Raw text response (to be validated/parsed by Coach engine) */
  content: string;
  /** Token usage metadata */
  usage: CoachUsageMetadata;
  /** Provider-reported model used */
  model: string;
}

/**
 * Failed generation result.
 */
export interface CoachGenerationFailure {
  success: false;
  /** Normalized failure code */
  failureCode: CoachingFailureCode;
  /** Sanitized diagnostic message (no provider secrets/raw payloads) */
  diagnostic: string;
  /** Partial usage if available */
  usage?: Partial<CoachUsageMetadata>;
}

export type CoachGenerationResult = CoachGenerationSuccess | CoachGenerationFailure;

// ─── Usage Metadata ─────────────────────────────────────────────────────

/**
 * Token and cost metadata from provider.
 */
export interface CoachUsageMetadata {
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Estimated cost in USD (if calculable) */
  estimatedCost?: number;
  /** Actual provider-reported cost in USD (if available) */
  actualProviderCost?: number;
}

// ─── Provider Interface ─────────────────────────────────────────────────

/**
 * Coach model provider interface.
 *
 * Implementations wrap vendor SDKs and provide normalized results.
 * The Coach engine uses only this interface.
 */
export interface CoachModelProvider {
  /** Provider name for logging/metadata */
  readonly providerName: string;

  /**
   * Generate a coaching review.
   *
   * @param input - Generation parameters
   * @returns Generation result (success or failure)
   *
   * Contract:
   * - MUST normalize all provider errors into CoachGenerationFailure
   * - MUST respect timeoutMs
   * - MUST extract usage metadata when available
   * - SHOULD use idempotencyKey if provider supports it
   * - MUST NOT throw for recoverable errors (return failure instead)
   * - MAY throw for unrecoverable errors (SDK misconfiguration, etc.)
   */
  generateReview(input: CoachGenerationInput): Promise<CoachGenerationResult>;

  /**
   * Check if provider supports idempotency keys.
   */
  supportsIdempotency(): boolean;
}

// ─── Provider Configuration ─────────────────────────────────────────────

/**
 * Configuration for creating a provider instance.
 */
export interface CoachProviderConfig {
  /** Model tier to use (haiku, sonnet, opus) */
  tier: 'haiku' | 'sonnet' | 'opus';
  /** Override model name (optional) */
  modelOverride?: string;
}
