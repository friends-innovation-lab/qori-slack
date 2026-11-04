/**
 * Model Provider Boundary (PH-2 / ADR 0034)
 *
 * Single entry point for model instantiation. All Qori workflows request
 * models by logical tier (haiku, sonnet, opus). The provider-specific
 * mapping lives here and nowhere else.
 *
 * TRANSITIONAL: Currently Anthropic-only via @langchain/anthropic.
 * If the provider changes, only this file needs modification.
 *
 * Do NOT import ChatAnthropic or any provider SDK outside this module.
 * A pattern enforcement test guards this invariant.
 */

import { ChatAnthropic } from '@langchain/anthropic';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

/** Logical model tiers available to Qori workflows */
export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export interface CreateModelOptions {
  /** Logical capability tier */
  tier: ModelTier;
  /** Sampling temperature (default: 0.4 for sonnet, 0 for haiku/opus) */
  temperature?: number;
  /** Maximum output tokens (default: 8192) */
  maxTokens?: number;
  /** Human-readable purpose for logging (e.g., 'codebook-generation') */
  purpose?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Tier → Provider Model Mapping
// ─────────────────────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<ModelTier, { modelName: string; envOverride: string; defaultTemp: number }> = {
  haiku: {
    modelName: 'claude-haiku-4-5-20251001',
    envOverride: 'EXTRACTION_MODEL_NAME',
    defaultTemp: 0,
  },
  sonnet: {
    modelName: 'claude-sonnet-4-6',
    envOverride: 'ANTHROPIC_MODEL_NAME',
    defaultTemp: 0.4,
  },
  opus: {
    modelName: 'claude-opus-4-6',
    envOverride: 'ANTHROPIC_MODEL_OPUS',
    defaultTemp: 0,
  },
};

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a model instance for the given logical tier.
 *
 * Resolves the provider-specific model name from environment variables
 * or defaults. All provider configuration lives in this function.
 *
 * @throws if ANTHROPIC_API_KEY is not set
 */
export function createModel(options: CreateModelOptions): ChatAnthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }

  const tierConfig = TIER_DEFAULTS[options.tier];
  const modelName = process.env[tierConfig.envOverride] || tierConfig.modelName;
  const temperature = options.temperature ?? tierConfig.defaultTemp;
  const maxTokens = options.maxTokens ?? parseInt(process.env.ANTHROPIC_MAX_TOKENS || '8192', 10);

  return new ChatAnthropic({
    anthropicApiKey: apiKey,
    modelName,
    temperature,
    maxTokens,
  });
}

/**
 * Resolve a model name string (from YAML task.model or extraction config)
 * to a logical tier. Used when callers already have a specific model name
 * but need to go through the factory.
 *
 * Falls back to 'sonnet' for unrecognized names.
 */
export function resolveModelTier(modelName: string): ModelTier {
  const lower = modelName.toLowerCase();
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('opus')) return 'opus';
  return 'sonnet';
}

/**
 * Get the current model name for a tier (for metadata/provenance, not instantiation).
 */
export function getModelName(tier: ModelTier): string {
  const tierConfig = TIER_DEFAULTS[tier];
  return process.env[tierConfig.envOverride] || tierConfig.modelName;
}

/**
 * Get the default sonnet model name (convenience for provenance metadata).
 */
export function getDefaultModelName(): string {
  return getModelName('sonnet');
}

// ─────────────────────────────────────────────────────────────────────
// Controlled Test Model Factory (DISC-WEB-1D-2 M2)
// ─────────────────────────────────────────────────────────────────────

/**
 * Hard output cap for controlled test execution.
 * This is API-enforced; the model cannot exceed this limit.
 */
export const CONTROLLED_TEST_MAX_TOKENS = 4096;

/**
 * Model tier used for controlled test execution.
 * Sonnet provides balanced capability for synthetic testing.
 */
export const CONTROLLED_TEST_TIER: ModelTier = 'sonnet';

/**
 * Explicit allowlist of models approved for controlled synthetic testing.
 * This list is intentionally narrow and does NOT inherit from production
 * environment variables (ANTHROPIC_MODEL_NAME, etc.).
 *
 * To add a model: verify it with the team, add to this array, and update tests.
 */
export const CONTROLLED_TEST_MODEL_ALLOWLIST: readonly string[] = [
  'claude-sonnet-4-6',  // M8a: Single known-valid model for controlled execution
] as const;

/**
 * Default model for controlled test execution.
 * Must be present in CONTROLLED_TEST_MODEL_ALLOWLIST.
 */
export const CONTROLLED_TEST_DEFAULT_MODEL = 'claude-sonnet-4-6';

export interface ControlledTestModelConfig {
  /** Human-readable purpose for logging/provenance */
  purpose?: string;
  /** Temperature (default: 0 for deterministic output) */
  temperature?: number;
  /**
   * Explicit model selection from CONTROLLED_TEST_MODEL_ALLOWLIST.
   * If not specified, uses CONTROLLED_TEST_DEFAULT_MODEL.
   * Throws if the requested model is not in the allowlist.
   */
  model?: string;
}

/**
 * Create a model instance for controlled Discovery test execution.
 *
 * This factory is ISOLATED from production execution paths and enforces:
 * - SDK retries disabled (maxRetries: 0) — single attempt per request
 * - Hard output cap (4096 tokens) — API-enforced limit
 * - Deterministic temperature (0) — reproducible output
 * - Explicit model selection from narrow allowlist (NO env override inheritance)
 *
 * Used by the controlled test budget service (M3+) to ensure budget
 * accounting is exact and not affected by SDK retry behavior.
 *
 * WARNING: Do not use this factory for normal Slack/REST AI execution.
 * The disabled retries make it unsuitable for production reliability.
 *
 * @throws if ANTHROPIC_API_KEY is not set
 * @throws if requested model is not in CONTROLLED_TEST_MODEL_ALLOWLIST
 */
export function createControlledTestModel(
  config: ControlledTestModelConfig = {},
): ChatAnthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }

  // Explicit model selection — NO env override inheritance
  const requestedModel = config.model ?? CONTROLLED_TEST_DEFAULT_MODEL;

  // Fail closed: reject models not in allowlist
  if (!CONTROLLED_TEST_MODEL_ALLOWLIST.includes(requestedModel)) {
    throw new Error(
      `Controlled test model '${requestedModel}' is not in the approved allowlist. ` +
        `Allowed models: ${CONTROLLED_TEST_MODEL_ALLOWLIST.join(', ')}`,
    );
  }

  const temperature = config.temperature ?? 0; // Deterministic by default

  return new ChatAnthropic({
    anthropicApiKey: apiKey,
    modelName: requestedModel,
    temperature,
    maxTokens: CONTROLLED_TEST_MAX_TOKENS,
    // CRITICAL: Disable SDK retries for exact budget accounting
    // Default is maxRetries: 2; we override to 0
    clientOptions: {
      maxRetries: 0,
    },
  });
}

/**
 * Verify that a model was created with controlled test configuration.
 * Used by tests to confirm correct factory behavior.
 *
 * Returns the configuration values that can be inspected.
 */
export function getControlledTestModelConfig(model: ChatAnthropic): {
  maxTokens: number | undefined;
  temperature: number | undefined;
  modelName: string | undefined;
} {
  // Access internal configuration (for test verification only)
  // These properties are set during construction
  return {
    maxTokens: (model as unknown as { maxTokens?: number }).maxTokens,
    temperature: (model as unknown as { temperature?: number }).temperature,
    modelName: (model as unknown as { modelName?: string }).modelName,
  };
}
