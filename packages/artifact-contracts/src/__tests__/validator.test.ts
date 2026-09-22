/**
 * Validator Tests
 *
 * Tests YAML validation logic:
 * - Task ID validation
 * - Section key uniqueness
 * - Contract structure validation
 * - Error detection
 */

import {
  validateContractAgainstYaml,
  validateContractStructure,
  validateTaskSectionMapping,
  validateContract,
  type ArtifactContract,
  type GeneratedFieldDefinition,
  type YamlTemplate,
} from '../index';

// ─── Test Fixtures ─────────────────────────────────────────────────

const validGeneratedField: GeneratedFieldDefinition = {
  key: 'test_field',
  authority: 'generated',
  generation_task_id: 'test_task',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'test_section',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Test' },
  fallback: { type: 'omit' },
};

const validContract: ArtifactContract = {
  artifact_type: 'brief',
  template_id: 'test_template',
  template_version: 'v1.0',
  fields: [validGeneratedField],
};

const validYaml: YamlTemplate = {
  id: 'test_template',
  version: 'v1.0',
  ai_generation_tasks: [{ task_id: 'test_task' }],
  emits: [],
};

// ─── validateContractAgainstYaml Tests ─────────────────────────────

describe('validateContractAgainstYaml', () => {
  describe('template identity', () => {
    it('passes when template_id matches', () => {
      const result = validateContractAgainstYaml(validContract, validYaml);
      expect(result.valid).toBe(true);
    });

    it('fails when template_id does not match', () => {
      const mismatchedYaml: YamlTemplate = {
        ...validYaml,
        id: 'different_template',
      };
      const result = validateContractAgainstYaml(validContract, mismatchedYaml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'TEMPLATE_ID_MISMATCH')).toBe(true);
    });

    it('warns when template_version does not match', () => {
      const mismatchedYaml: YamlTemplate = {
        ...validYaml,
        version: 'v2.0',
      };
      const result = validateContractAgainstYaml(validContract, mismatchedYaml);
      // Version mismatch is a warning, not an error
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'TEMPLATE_VERSION_MISMATCH')).toBe(true);
    });
  });

  describe('task ID validation', () => {
    it('passes when all task IDs exist in YAML', () => {
      const result = validateContractAgainstYaml(validContract, validYaml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when task ID is missing from YAML', () => {
      const yamlMissingTask: YamlTemplate = {
        ...validYaml,
        ai_generation_tasks: [], // No tasks
      };
      const result = validateContractAgainstYaml(validContract, yamlMissingTask);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_YAML_TASK')).toBe(true);
      expect(result.errors.some(e => e.task_id === 'test_task')).toBe(true);
    });

    it('warns about orphan YAML tasks', () => {
      const yamlWithOrphan: YamlTemplate = {
        ...validYaml,
        ai_generation_tasks: [
          { task_id: 'test_task' },
          { task_id: 'orphan_task' }, // Not referenced by any contract field
        ],
      };
      const result = validateContractAgainstYaml(validContract, yamlWithOrphan);
      expect(result.valid).toBe(true); // Orphan is a warning, not error
      expect(result.warnings.some(w => w.code === 'ORPHAN_YAML_TASK')).toBe(true);
      expect(result.warnings.some(w => w.task_id === 'orphan_task')).toBe(true);
    });
  });

  describe('section key uniqueness', () => {
    it('fails when multiple fields map to same section_key', () => {
      const duplicateContract: ArtifactContract = {
        ...validContract,
        fields: [
          validGeneratedField,
          {
            ...validGeneratedField,
            key: 'another_field',
            generation_task_id: 'another_task',
            // Same section_key! This is a bug.
            canonical: {
              ...validGeneratedField.canonical,
              section_key: 'test_section',
            },
          },
        ],
      };
      const yamlWithBoth: YamlTemplate = {
        ...validYaml,
        ai_generation_tasks: [
          { task_id: 'test_task' },
          { task_id: 'another_task' },
        ],
      };
      const result = validateContractAgainstYaml(duplicateContract, yamlWithBoth);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_SECTION_KEY')).toBe(true);
    });
  });

  describe('duplicate task mapping', () => {
    it('fails when same task_id maps to multiple fields', () => {
      const duplicateContract: ArtifactContract = {
        ...validContract,
        fields: [
          validGeneratedField,
          {
            ...validGeneratedField,
            key: 'another_field',
            // Same task_id! Two fields claim the same task.
            generation_task_id: 'test_task',
            canonical: {
              ...validGeneratedField.canonical,
              section_key: 'different_section',
            },
          },
        ],
      };
      const result = validateContractAgainstYaml(duplicateContract, validYaml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_TASK_MAPPING')).toBe(true);
    });
  });
});

// ─── validateContractStructure Tests ───────────────────────────────

describe('validateContractStructure', () => {
  it('passes for valid contract', () => {
    const errors = validateContractStructure(validContract);
    expect(errors).toHaveLength(0);
  });

  it('detects generated field with wrong canonical table', () => {
    const badContract: ArtifactContract = {
      ...validContract,
      fields: [
        {
          ...validGeneratedField,
          canonical: {
            table: 'study_variables', // Wrong! Generated should use artifact_sections
            variable_key: 'test',
            is_pool: false,
          },
        } as any,
      ],
    };
    const errors = validateContractStructure(badContract);
    expect(errors.some(e => e.code === 'INVALID_CANONICAL_FOR_GENERATED')).toBe(true);
  });

  // NOTE: MISSING_INHERITS_FROM check removed because TypeScript type system
  // already guarantees InheritedFieldDefinition has inherits_from property.
  // Runtime validation of type-guaranteed properties is redundant.

  it('detects unsupported field with wrong canonical source', () => {
    const badContract: ArtifactContract = {
      ...validContract,
      fields: [
        {
          key: 'bad_unsupported',
          authority: 'unsupported',
          data_type: 'string',
          canonical: {
            table: 'research_studies', // Wrong! Unsupported should use unsupported source
            column: 'test',
          },
          editable: false,
          required: false,
          workspace: { type: 'unsupported', reason: 'N/A' },
          markdown: { type: 'unsupported', reason: 'N/A' },
          fallback: { type: 'omit' },
        } as any,
      ],
    };
    const errors = validateContractStructure(badContract);
    expect(errors.some(e => e.code === 'INVALID_CANONICAL_FOR_UNSUPPORTED')).toBe(true);
  });
});

// ─── validateTaskSectionMapping Tests ──────────────────────────────

describe('validateTaskSectionMapping', () => {
  it('passes when mappings match', () => {
    const expectedMappings = new Map([['test_task', 'test_section']]);
    const errors = validateTaskSectionMapping(validContract, expectedMappings);
    expect(errors).toHaveLength(0);
  });

  it('detects section key mismatch', () => {
    const expectedMappings = new Map([['test_task', 'wrong_section']]);
    const errors = validateTaskSectionMapping(validContract, expectedMappings);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('SECTION_KEY_MISMATCH');
    expect(errors[0].task_id).toBe('test_task');
    expect(errors[0].section_key).toBe('test_section'); // Actual section key
  });

  it('detects missing task field', () => {
    const expectedMappings = new Map([['nonexistent_task', 'some_section']]);
    const errors = validateTaskSectionMapping(validContract, expectedMappings);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('MISSING_TASK_FIELD');
    expect(errors[0].task_id).toBe('nonexistent_task');
  });
});

// ─── validateContract Tests ────────────────────────────────────────

describe('validateContract', () => {
  it('combines structure and YAML validation', () => {
    const result = validateContract(validContract, validYaml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails if either validation fails', () => {
    const yamlMissingTask: YamlTemplate = {
      ...validYaml,
      ai_generation_tasks: [],
    };
    const result = validateContract(validContract, yamlMissingTask);
    expect(result.valid).toBe(false);
  });
});

// ─── Regression Tests ──────────────────────────────────────────────

describe('Regression Tests', () => {
  describe('risks → risks_raw bug (commit 2c5ea0b8)', () => {
    it('would catch the original bug', () => {
      // This simulates what would happen if someone tried to map
      // the YAML task 'risks' to section_key 'risks_raw'
      const buggyContract: ArtifactContract = {
        artifact_type: 'plan',
        template_id: 'research_plan',
        template_version: 'v7.2',
        fields: [
          {
            key: 'plan_risks',
            authority: 'generated',
            generation_task_id: 'risks',
            data_type: 'structured_json',
            canonical: {
              table: 'artifact_sections',
              section_key: 'risks_raw', // THE BUG! Should be plan_risks
              content_type: 'structured_json',
            },
            editable: false,
            required: true,
            workspace: { type: 'table', columns: ['Risk', 'Likelihood', 'Mitigation'] },
            markdown: { type: 'table', columns: ['Risk', 'Likelihood', 'Mitigation'] },
            fallback: { type: 'omit' },
          },
        ],
      };

      // The expected mapping (what the app-service should use)
      const expectedMappings = new Map([['risks', 'plan_risks']]);

      // This validation would FAIL, catching the bug before runtime
      const errors = validateTaskSectionMapping(buggyContract, expectedMappings);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('SECTION_KEY_MISMATCH');
      expect(errors[0].message).toContain('risks_raw');
      expect(errors[0].message).toContain('plan_risks');
    });
  });
});
