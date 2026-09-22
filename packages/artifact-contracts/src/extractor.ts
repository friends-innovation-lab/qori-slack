/**
 * Generation Result Extractor
 *
 * Contract-driven extraction of generated artifact fields from YAML AI responses.
 *
 * This replaces handwritten task_id → section_key mappings in app services.
 * The contract is the single source of truth for:
 * - generation_task_id (YAML task)
 * - section_key (artifact_sections canonical storage)
 * - content_type (prose vs structured_json)
 * - required/optional behavior
 */

import type {
  ArtifactContract,
  GeneratedFieldDefinition,
  ArtifactSectionSource,
} from './types';
import { getGeneratedFields } from './types';

// ─── Types ─────────────────────────────────────────────────────────

/**
 * AI responses from YAML template processing (task_id → content)
 */
export type AiResponses = Record<string, string | undefined>;

/**
 * Extracted field value ready for persistence
 */
export interface ExtractedFieldValue {
  readonly field_key: string;
  readonly section_key: string;
  readonly content_type: 'prose' | 'structured_json';
  readonly content: string;
  readonly required: boolean;
}

/**
 * Extraction result for an artifact
 */
export interface ExtractionResult {
  readonly success: boolean;
  readonly extracted: ExtractedFieldValue[];
  readonly missing_required: string[];
  readonly missing_optional: string[];
  readonly malformed_json: Array<{ field_key: string; error: string }>;
  readonly errors: string[];
}

/**
 * Input for extraction
 */
export interface ExtractGeneratedFieldsInput {
  readonly contract: ArtifactContract;
  readonly aiResponses: AiResponses;
  readonly strict?: boolean; // If true, fail on missing required fields
}

// ─── Extraction Implementation ─────────────────────────────────────

/**
 * Extract generated artifact fields from AI responses using the contract.
 *
 * @param input Contract, AI responses, and options
 * @returns Extraction result with extracted values and any errors
 */
export function extractGeneratedArtifactFields(
  input: ExtractGeneratedFieldsInput,
): ExtractionResult {
  const { contract, aiResponses, strict = true } = input;
  const generatedFields = getGeneratedFields(contract);

  const extracted: ExtractedFieldValue[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  const malformedJson: Array<{ field_key: string; error: string }> = [];
  const errors: string[] = [];

  for (const field of generatedFields) {
    const content = aiResponses[field.generation_task_id];

    if (content === undefined || content === null || content === '') {
      // Handle missing content
      if (field.required) {
        missingRequired.push(field.key);
        if (strict) {
          errors.push(
            `Required generated field "${field.key}" (task_id: ${field.generation_task_id}) is missing`,
          );
        }
      } else {
        missingOptional.push(field.key);
      }
      continue;
    }

    // Validate JSON for structured fields
    const contentType = field.canonical.content_type;
    if (contentType === 'structured_json') {
      const jsonError = validateJsonContent(content, field.key);
      if (jsonError) {
        malformedJson.push({ field_key: field.key, error: jsonError });
        if (field.required && strict) {
          errors.push(
            `Required structured field "${field.key}" has malformed JSON: ${jsonError}`,
          );
        }
        continue;
      }
    }

    extracted.push({
      field_key: field.key,
      section_key: field.canonical.section_key,
      content_type: contentType,
      content,
      required: field.required,
    });
  }

  return {
    success: errors.length === 0,
    extracted,
    missing_required: missingRequired,
    missing_optional: missingOptional,
    malformed_json: malformedJson,
    errors,
  };
}

/**
 * Validate that content is valid JSON.
 *
 * @param content Raw content string
 * @param fieldKey Field key for error reporting
 * @returns Error message if invalid, undefined if valid
 */
function validateJsonContent(content: string, fieldKey: string): string | undefined {
  try {
    JSON.parse(content);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid JSON';
  }
}

// ─── Mapping Utilities ─────────────────────────────────────────────

/**
 * Build task_id → section_key mapping from contract.
 * This replaces handwritten sectionMap objects in app services.
 */
export function buildTaskToSectionKeyMap(
  contract: ArtifactContract,
): Map<string, { section_key: string; content_type: 'prose' | 'structured_json' }> {
  const map = new Map<string, { section_key: string; content_type: 'prose' | 'structured_json' }>();
  const generatedFields = getGeneratedFields(contract);

  for (const field of generatedFields) {
    map.set(field.generation_task_id, {
      section_key: field.canonical.section_key,
      content_type: field.canonical.content_type,
    });
  }

  return map;
}

/**
 * Build section_key → task_id mapping from contract.
 * This is the reverse mapping used for re-projection (content-update).
 */
export function buildSectionKeyToTaskMap(
  contract: ArtifactContract,
): Map<string, string> {
  const map = new Map<string, string>();
  const generatedFields = getGeneratedFields(contract);

  for (const field of generatedFields) {
    map.set(field.canonical.section_key, field.generation_task_id);
  }

  return map;
}

/**
 * Get all prose field task IDs from contract.
 */
export function getProseTaskIds(contract: ArtifactContract): string[] {
  return getGeneratedFields(contract)
    .filter(f => f.canonical.content_type === 'prose')
    .map(f => f.generation_task_id);
}

/**
 * Get all structured JSON field task IDs from contract.
 */
export function getStructuredJsonTaskIds(contract: ArtifactContract): string[] {
  return getGeneratedFields(contract)
    .filter(f => f.canonical.content_type === 'structured_json')
    .map(f => f.generation_task_id);
}

/**
 * Get section keys that should be persisted for a contract.
 */
export function getCanonicalSectionKeys(contract: ArtifactContract): string[] {
  return getGeneratedFields(contract).map(f => f.canonical.section_key);
}
