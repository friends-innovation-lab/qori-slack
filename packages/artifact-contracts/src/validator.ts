/**
 * YAML Task ID Validator
 *
 * Validates that artifact contracts are consistent with YAML template definitions.
 *
 * Build/test-time validation prevents runtime failures like the
 * risks → risks_raw mismatch that caused empty sections.
 */

import type {
  ArtifactContract,
  ArtifactFieldDefinition,
  GeneratedFieldDefinition,
  CascadeFieldDefinition,
  ArtifactSectionSource,
  StudyVariableSource,
} from './types';
import { isGeneratedField, isCascadeField, getGeneratedFields } from './types';

// ─── Validation Result Types ───────────────────────────────────────

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly task_id?: string;
  readonly section_key?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationError[];
}

// ─── YAML Template Structure (minimal for validation) ──────────────

export interface YamlTask {
  readonly task_id: string;
  readonly prompt?: string;
  readonly model?: string;
  readonly skip_when?: string;
}

export interface YamlEmit {
  readonly key: string;
  readonly pool?: boolean;
  readonly schema?: unknown;
  readonly schema_ref?: string;
}

export interface YamlTemplate {
  readonly id: string;
  readonly version: string;
  readonly ai_generation_tasks?: readonly YamlTask[];
  readonly emits?: readonly YamlEmit[];
}

// ─── Validator Implementation ──────────────────────────────────────

/**
 * Validate an artifact contract against its YAML template definition.
 *
 * @param contract The artifact contract to validate
 * @param yaml The parsed YAML template
 * @returns Validation result with errors and warnings
 */
export function validateContractAgainstYaml(
  contract: ArtifactContract,
  yaml: YamlTemplate,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Validate template ID matches
  if (contract.template_id !== yaml.id) {
    errors.push({
      code: 'TEMPLATE_ID_MISMATCH',
      message: `Contract template_id "${contract.template_id}" does not match YAML id "${yaml.id}"`,
    });
  }

  // 2. Validate template version matches
  if (contract.template_version !== yaml.version) {
    warnings.push({
      code: 'TEMPLATE_VERSION_MISMATCH',
      message: `Contract template_version "${contract.template_version}" does not match YAML version "${yaml.version}"`,
    });
  }

  // 3. Build set of YAML task IDs
  const yamlTaskIds = new Set(
    (yaml.ai_generation_tasks ?? []).map(t => t.task_id),
  );

  // 4. Validate every generated field references an existing YAML task
  const generatedFields = getGeneratedFields(contract);
  for (const field of generatedFields) {
    if (!yamlTaskIds.has(field.generation_task_id)) {
      errors.push({
        code: 'MISSING_YAML_TASK',
        message: `Generated field "${field.key}" references task_id "${field.generation_task_id}" which does not exist in YAML`,
        field: field.key,
        task_id: field.generation_task_id,
      });
    }
  }

  // 5. Validate no duplicate task_id mappings (each task → exactly one section)
  const taskToSection = new Map<string, string[]>();
  for (const field of generatedFields) {
    const existing = taskToSection.get(field.generation_task_id) ?? [];
    existing.push(field.canonical.section_key);
    taskToSection.set(field.generation_task_id, existing);
  }
  for (const [taskId, sections] of taskToSection) {
    if (sections.length > 1) {
      errors.push({
        code: 'DUPLICATE_TASK_MAPPING',
        message: `Task "${taskId}" maps to multiple section_keys: ${sections.join(', ')}`,
        task_id: taskId,
      });
    }
  }

  // 6. Validate section_key uniqueness within artifact type
  const sectionKeys = new Map<string, string[]>();
  for (const field of contract.fields) {
    if (isGeneratedField(field)) {
      const key = field.canonical.section_key;
      const existing = sectionKeys.get(key) ?? [];
      existing.push(field.key);
      sectionKeys.set(key, existing);
    }
  }
  for (const [sectionKey, fields] of sectionKeys) {
    if (fields.length > 1) {
      errors.push({
        code: 'DUPLICATE_SECTION_KEY',
        message: `Section key "${sectionKey}" used by multiple fields: ${fields.join(', ')}`,
        section_key: sectionKey,
      });
    }
  }

  // 7. Validate cascade fields have schema_ref if they reference a schema
  const cascadeFields = contract.fields.filter(isCascadeField);
  const yamlEmits = new Set((yaml.emits ?? []).map(e => e.key));
  for (const field of cascadeFields) {
    if (field.canonical.table === 'study_variables') {
      // Check if YAML emits this variable
      if (!yamlEmits.has(field.canonical.variable_key)) {
        // This is OK for inherited fields — they may come from upstream template
        // Only warn if this is the template that should emit it
        if (field.authority === 'cascade') {
          warnings.push({
            code: 'CASCADE_NOT_IN_EMITS',
            message: `Cascade field "${field.key}" (variable_key: "${field.canonical.variable_key}") not found in YAML emits`,
            field: field.key,
          });
        }
      }
    }
  }

  // 8. Validate required fields have valid canonical destinations
  for (const field of contract.fields) {
    if (field.required && field.fallback.type === 'omit') {
      // Required field with omit fallback — canonical must be resolvable
      if ('source' in field.canonical) {
        if (field.canonical.source === 'unsupported') {
          // Unsupported fields can't be required
          errors.push({
            code: 'UNSUPPORTED_REQUIRED',
            message: `Field "${field.key}" is marked required but has unsupported canonical source`,
            field: field.key,
          });
        }
      }
    }
  }

  // 9. Warn about orphan YAML tasks (tasks not referenced by any contract field)
  for (const taskId of yamlTaskIds) {
    const hasMapping = generatedFields.some(f => f.generation_task_id === taskId);
    if (!hasMapping) {
      warnings.push({
        code: 'ORPHAN_YAML_TASK',
        message: `YAML task "${taskId}" is not referenced by any contract field`,
        task_id: taskId,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate task_id → section_key mapping is consistent.
 *
 * This is the specific check that would have caught the risks → risks_raw bug.
 *
 * @param contract The artifact contract
 * @param expectedMappings Map of task_id → expected section_key
 * @returns Array of mismatches
 */
export function validateTaskSectionMapping(
  contract: ArtifactContract,
  expectedMappings: Map<string, string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const generatedFields = getGeneratedFields(contract);

  for (const [taskId, expectedSection] of expectedMappings) {
    const field = generatedFields.find(f => f.generation_task_id === taskId);
    if (!field) {
      errors.push({
        code: 'MISSING_TASK_FIELD',
        message: `Expected task "${taskId}" → section "${expectedSection}" but no field references this task`,
        task_id: taskId,
        section_key: expectedSection,
      });
    } else if (field.canonical.section_key !== expectedSection) {
      errors.push({
        code: 'SECTION_KEY_MISMATCH',
        message: `Task "${taskId}" maps to section "${field.canonical.section_key}" but expected "${expectedSection}"`,
        task_id: taskId,
        section_key: field.canonical.section_key,
        field: field.key,
      });
    }
  }

  return errors;
}

/**
 * Validate contract field structure (type-level checks).
 */
export function validateContractStructure(contract: ArtifactContract): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate each field has consistent authority + canonical pairing
  for (const field of contract.fields) {
    switch (field.authority) {
      case 'generated':
        // Generated fields must have artifact_sections canonical source
        // Type GeneratedFieldDefinition guarantees generation_task_id exists
        if (!('table' in field.canonical) || field.canonical.table !== 'artifact_sections') {
          errors.push({
            code: 'INVALID_CANONICAL_FOR_GENERATED',
            message: `Generated field "${field.key}" must have artifact_sections canonical source`,
            field: field.key,
          });
        }
        break;

      case 'inherited':
        // Type InheritedFieldDefinition guarantees inherits_from exists
        // No additional validation needed beyond what the type system provides
        break;

      case 'unsupported':
        // Unsupported fields must have unsupported canonical source
        if (!('source' in field.canonical) || field.canonical.source !== 'unsupported') {
          errors.push({
            code: 'INVALID_CANONICAL_FOR_UNSUPPORTED',
            message: `Unsupported field "${field.key}" must have unsupported canonical source`,
            field: field.key,
          });
        }
        break;
    }

    // Validate workspace/markdown projections exist
    if (!field.workspace) {
      errors.push({
        code: 'MISSING_WORKSPACE_PROJECTION',
        message: `Field "${field.key}" is missing workspace projection`,
        field: field.key,
      });
    }
    if (!field.markdown) {
      errors.push({
        code: 'MISSING_MARKDOWN_PROJECTION',
        message: `Field "${field.key}" is missing markdown projection`,
        field: field.key,
      });
    }
  }

  return errors;
}

/**
 * Full contract validation (structure + YAML alignment).
 */
export function validateContract(
  contract: ArtifactContract,
  yaml: YamlTemplate,
): ValidationResult {
  const structureErrors = validateContractStructure(contract);
  const yamlResult = validateContractAgainstYaml(contract, yaml);

  return {
    valid: structureErrors.length === 0 && yamlResult.valid,
    errors: [...structureErrors, ...yamlResult.errors],
    warnings: yamlResult.warnings,
  };
}
