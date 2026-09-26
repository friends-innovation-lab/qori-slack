/**
 * Coach Output Validator — Coach M2
 *
 * Validates structured Coach output against contract schema.
 * Ensures atomic validity — no partial results.
 *
 * Validation checks:
 * - Valid JSON structure
 * - Allowed categories only
 * - Item count limits
 * - Required fields present
 * - Citation handles are valid
 * - Text length limits
 */

import type { CoachingContract, OutputSchema, CitationHandle } from './contracts/types';
import type { CoachingReviewScope } from '../database/models/coaching_run';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * A single coaching item from model output.
 */
export interface CoachOutputItem {
  text: string;
  references: string[];
}

/**
 * Parsed and validated Coach output.
 */
export interface ValidatedCoachOutput {
  strengths: CoachOutputItem[];
  issues: CoachOutputItem[];
  suggestions: CoachOutputItem[];
  questions: CoachOutputItem[];
}

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  output?: ValidatedCoachOutput;
  errors: string[];
}

// ─── Validation ─────────────────────────────────────────────────────────

/**
 * Validate Coach model output against contract schema.
 *
 * @param rawOutput - Raw text output from model
 * @param schema - Output schema from contract
 * @param citationHandles - Valid citation handles
 * @param scope - Review scope
 * @param selectedSectionKey - Selected section for section-scoped reviews
 * @returns Validation result with parsed output or errors
 */
export function validateCoachOutput(
  rawOutput: string,
  schema: OutputSchema,
  citationHandles: Map<string, CitationHandle>,
  scope: CoachingReviewScope,
  selectedSectionKey: string | null,
): ValidationResult {
  const errors: string[] = [];

  // 1. Parse JSON
  let parsed: unknown;
  try {
    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        valid: false,
        errors: ['No JSON object found in response'],
      };
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  // 2. Verify top-level structure
  if (typeof parsed !== 'object' || parsed === null) {
    return {
      valid: false,
      errors: ['Response must be a JSON object'],
    };
  }

  const obj = parsed as Record<string, unknown>;

  // 3. Check for unexpected categories
  const allowedKeys = new Set(['strengths', 'issues', 'suggestions', 'questions']);
  const unexpectedKeys = Object.keys(obj).filter(k => !allowedKeys.has(k));
  if (unexpectedKeys.length > 0) {
    errors.push(`Unexpected categories: ${unexpectedKeys.join(', ')}`);
  }

  // 4. Validate each category
  const output: ValidatedCoachOutput = {
    strengths: [],
    issues: [],
    suggestions: [],
    questions: [],
  };

  const categories: Array<{ key: keyof ValidatedCoachOutput; singular: string }> = [
    { key: 'strengths', singular: 'strength' },
    { key: 'issues', singular: 'issue' },
    { key: 'suggestions', singular: 'suggestion' },
    { key: 'questions', singular: 'question' },
  ];

  for (const { key, singular } of categories) {
    // Check if category is enabled
    if (!schema.enabledCategories.includes(singular as any)) {
      if (obj[key] !== undefined && Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        errors.push(`Category '${key}' is not enabled for this contract`);
      }
      continue;
    }

    const items = obj[key];

    // Category can be missing or empty
    if (items === undefined || items === null) {
      continue;
    }

    if (!Array.isArray(items)) {
      errors.push(`Category '${key}' must be an array`);
      continue;
    }

    // Check item count limits
    if (items.length > schema.maxItemsPerCategory) {
      errors.push(`Category '${key}' has ${items.length} items, max is ${schema.maxItemsPerCategory}`);
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemPath = `${key}[${i}]`;

      // Validate item structure
      const itemErrors = validateItem(item, itemPath, schema, citationHandles);
      errors.push(...itemErrors);

      if (itemErrors.length === 0) {
        output[key].push({
          text: (item as { text: string }).text,
          references: (item as { references: string[] }).references || [],
        });
      }
    }
  }

  // 5. Return result
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, output, errors: [] };
}

/**
 * Validate a single item.
 */
function validateItem(
  item: unknown,
  path: string,
  schema: OutputSchema,
  citationHandles: Map<string, CitationHandle>,
): string[] {
  const errors: string[] = [];

  if (typeof item !== 'object' || item === null) {
    errors.push(`${path}: must be an object`);
    return errors;
  }

  const obj = item as Record<string, unknown>;

  // Check required 'text' field
  if (typeof obj.text !== 'string') {
    errors.push(`${path}.text: must be a string`);
  } else {
    // Check text length
    if (obj.text.length > schema.maxItemTextLength) {
      errors.push(`${path}.text: exceeds max length of ${schema.maxItemTextLength}`);
    }
    if (obj.text.trim().length === 0) {
      errors.push(`${path}.text: cannot be empty`);
    }
  }

  // Check 'references' field
  if (obj.references !== undefined) {
    if (!Array.isArray(obj.references)) {
      errors.push(`${path}.references: must be an array`);
    } else {
      // Check reference count
      if (obj.references.length > schema.maxReferencesPerItem) {
        errors.push(`${path}.references: exceeds max of ${schema.maxReferencesPerItem}`);
      }

      // Validate each reference
      for (let i = 0; i < obj.references.length; i++) {
        const ref = obj.references[i];
        if (typeof ref !== 'string') {
          errors.push(`${path}.references[${i}]: must be a string`);
          continue;
        }

        // Check if reference handle is valid
        if (!citationHandles.has(ref)) {
          errors.push(`${path}.references[${i}]: unknown handle '${ref}'`);
        }
      }
    }
  }

  return errors;
}

/**
 * Format validation errors for repair prompt.
 */
export function formatValidationErrors(errors: string[]): string {
  return errors.map(e => `- ${e}`).join('\n');
}

/**
 * Check if output has any items (not empty).
 */
export function hasAnyItems(output: ValidatedCoachOutput): boolean {
  return (
    output.strengths.length > 0 ||
    output.issues.length > 0 ||
    output.suggestions.length > 0 ||
    output.questions.length > 0
  );
}

/**
 * Count total items in output.
 */
export function countTotalItems(output: ValidatedCoachOutput): number {
  return (
    output.strengths.length +
    output.issues.length +
    output.suggestions.length +
    output.questions.length
  );
}
