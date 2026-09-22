/**
 * Types Tests
 *
 * Validates type guards and utility functions.
 */

import {
  isGeneratedField,
  isInheritedField,
  isComputedField,
  isUserInputField,
  isSystemField,
  isCascadeField,
  isUnsupportedField,
  getGeneratedFields,
  getContractTaskIds,
  getEditableFields,
  getUnsupportedFields,
  buildTaskToSectionMap,
  type ArtifactContract,
  type GeneratedFieldDefinition,
  type InheritedFieldDefinition,
  type ComputedFieldDefinition,
  type UserInputFieldDefinition,
  type SystemFieldDefinition,
  type CascadeFieldDefinition,
  type UnsupportedFieldDefinition,
} from '../index';

// ─── Mock Fields ───────────────────────────────────────────────────

const mockGeneratedField: GeneratedFieldDefinition = {
  key: 'test_generated',
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

const mockInheritedField: InheritedFieldDefinition = {
  key: 'test_inherited',
  authority: 'inherited',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'test_var',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'source_field',
  },
  editable: false,
  required: true,
  workspace: { type: 'structured_rows', id_field: 'id' },
  markdown: { type: 'bullet_list', item_template: '{{item}}' },
  fallback: { type: 'omit' },
};

const mockComputedField: ComputedFieldDefinition = {
  key: 'test_computed',
  authority: 'computed',
  data_type: 'string',
  canonical: {
    source: 'computed',
    derivation: 'some_function()',
  },
  editable: false,
  required: true,
  workspace: { type: 'fact', label: 'Test' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
};

const mockUserInputField: UserInputFieldDefinition = {
  key: 'test_user_input',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'research_studies',
    column: 'name',
  },
  editable: false,
  required: true,
  workspace: { type: 'system_block', label: 'Name' },
  markdown: { type: 'masthead', position: 'title' },
  fallback: { type: 'omit' },
};

const mockSystemField: SystemFieldDefinition = {
  key: 'test_system',
  authority: 'system',
  data_type: 'string',
  canonical: {
    table: 'research_artifacts',
    column: 'public_id',
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
};

const mockCascadeField: CascadeFieldDefinition = {
  key: 'test_cascade',
  authority: 'cascade',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'test_cascade_var',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'table', columns: ['Col1', 'Col2'] },
  markdown: { type: 'table', columns: ['Col1', 'Col2'] },
  fallback: { type: 'omit' },
  schema_ref: 'schemas/test.yaml',
};

const mockUnsupportedField: UnsupportedFieldDefinition = {
  key: 'test_unsupported',
  authority: 'unsupported',
  data_type: 'string',
  canonical: {
    source: 'unsupported',
    reason: 'Not implemented',
    backlog_ref: '#123',
  },
  editable: false,
  required: false,
  workspace: { type: 'unsupported', reason: 'Not available' },
  markdown: { type: 'unsupported', reason: 'Not available' },
  fallback: { type: 'omit' },
};

const mockContract: ArtifactContract = {
  artifact_type: 'brief',
  template_id: 'test_template',
  template_version: 'v1.0',
  fields: [
    mockGeneratedField,
    mockInheritedField,
    mockComputedField,
    mockUserInputField,
    mockSystemField,
    mockCascadeField,
    mockUnsupportedField,
  ],
};

// ─── Type Guard Tests ──────────────────────────────────────────────

describe('Type Guards', () => {
  describe('isGeneratedField', () => {
    it('returns true for generated field', () => {
      expect(isGeneratedField(mockGeneratedField)).toBe(true);
    });

    it('returns false for other field types', () => {
      expect(isGeneratedField(mockInheritedField)).toBe(false);
      expect(isGeneratedField(mockComputedField)).toBe(false);
      expect(isGeneratedField(mockUserInputField)).toBe(false);
      expect(isGeneratedField(mockSystemField)).toBe(false);
      expect(isGeneratedField(mockCascadeField)).toBe(false);
      expect(isGeneratedField(mockUnsupportedField)).toBe(false);
    });
  });

  describe('isInheritedField', () => {
    it('returns true for inherited field', () => {
      expect(isInheritedField(mockInheritedField)).toBe(true);
    });

    it('returns false for other field types', () => {
      expect(isInheritedField(mockGeneratedField)).toBe(false);
    });
  });

  describe('isComputedField', () => {
    it('returns true for computed field', () => {
      expect(isComputedField(mockComputedField)).toBe(true);
    });

    it('returns false for other field types', () => {
      expect(isComputedField(mockGeneratedField)).toBe(false);
    });
  });

  describe('isUserInputField', () => {
    it('returns true for user_input field', () => {
      expect(isUserInputField(mockUserInputField)).toBe(true);
    });

    it('returns false for other field types', () => {
      expect(isUserInputField(mockGeneratedField)).toBe(false);
    });
  });

  describe('isSystemField', () => {
    it('returns true for system field', () => {
      expect(isSystemField(mockSystemField)).toBe(true);
    });

    it('returns false for other field types', () => {
      expect(isSystemField(mockGeneratedField)).toBe(false);
    });
  });

  describe('isCascadeField', () => {
    it('returns true for cascade field', () => {
      expect(isCascadeField(mockCascadeField)).toBe(true);
    });

    it('returns false for other field types', () => {
      expect(isCascadeField(mockGeneratedField)).toBe(false);
    });
  });

  describe('isUnsupportedField', () => {
    it('returns true for unsupported field', () => {
      expect(isUnsupportedField(mockUnsupportedField)).toBe(true);
    });

    it('returns false for other field types', () => {
      expect(isUnsupportedField(mockGeneratedField)).toBe(false);
    });
  });
});

// ─── Utility Function Tests ────────────────────────────────────────

describe('Utility Functions', () => {
  describe('getGeneratedFields', () => {
    it('returns only generated fields', () => {
      const result = getGeneratedFields(mockContract);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('test_generated');
    });
  });

  describe('getContractTaskIds', () => {
    it('returns task IDs from generated fields', () => {
      const result = getContractTaskIds(mockContract);
      expect(result).toEqual(['test_task']);
    });
  });

  describe('getEditableFields', () => {
    it('returns editable fields', () => {
      const result = getEditableFields(mockContract);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('test_generated');
    });
  });

  describe('getUnsupportedFields', () => {
    it('returns unsupported fields', () => {
      const result = getUnsupportedFields(mockContract);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('test_unsupported');
    });
  });

  describe('buildTaskToSectionMap', () => {
    it('builds task_id → section_key mapping', () => {
      const map = buildTaskToSectionMap(mockContract);
      expect(map.size).toBe(1);
      expect(map.get('test_task')).toBe('test_section');
    });

    it('handles empty contract', () => {
      const emptyContract: ArtifactContract = {
        artifact_type: 'brief',
        template_id: 'empty',
        template_version: 'v1.0',
        fields: [],
      };
      const map = buildTaskToSectionMap(emptyContract);
      expect(map.size).toBe(0);
    });
  });
});

// ─── Discriminated Union Type Narrowing Tests ─────────────────────

describe('Discriminated Union Type Narrowing', () => {
  it('narrows GeneratedFieldDefinition to access generation_task_id', () => {
    const field = mockContract.fields[0];
    if (isGeneratedField(field)) {
      // TypeScript should allow accessing generation_task_id here
      expect(field.generation_task_id).toBe('test_task');
      expect(field.canonical.table).toBe('artifact_sections');
    }
  });

  it('narrows InheritedFieldDefinition to access inherits_from', () => {
    const field = mockContract.fields[1];
    if (isInheritedField(field)) {
      // TypeScript should allow accessing inherits_from here
      expect(field.inherits_from.artifact).toBe('brief');
      expect(field.inherits_from.field).toBe('source_field');
    }
  });

  it('narrows ComputedFieldDefinition to access derivation', () => {
    const field = mockContract.fields[2];
    if (isComputedField(field)) {
      // TypeScript should allow accessing computed canonical
      if ('source' in field.canonical && field.canonical.source === 'computed') {
        expect(field.canonical.derivation).toBe('some_function()');
      }
    }
  });

  it('narrows UnsupportedFieldDefinition to access backlog_ref', () => {
    const field = mockContract.fields[6];
    if (isUnsupportedField(field)) {
      if (field.canonical.source === 'unsupported') {
        expect(field.canonical.backlog_ref).toBe('#123');
      }
    }
  });
});
