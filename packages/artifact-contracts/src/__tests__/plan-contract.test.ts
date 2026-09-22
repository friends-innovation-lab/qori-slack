/**
 * Plan Contract Tests
 *
 * Validates Plan artifact contract:
 * - All generated fields reference valid YAML task IDs
 * - Section key mappings are correct (including risks → plan_risks)
 * - Inherited fields reference Brief
 * - Unsupported fields are properly documented
 * - Contract structure is valid
 */

import {
  PLAN_CONTRACT,
  PLAN_YAML_TASK_IDS,
  getGeneratedFields,
  getEditableFields,
  getUnsupportedFields,
  buildTaskToSectionMap,
  isGeneratedField,
  isInheritedField,
  isCascadeField,
  isComputedField,
  isSystemField,
  isUnsupportedField,
  validateContractStructure,
  validateContractAgainstYaml,
  validateTaskSectionMapping,
  type YamlTemplate,
  type InheritedFieldDefinition,
  type UnsupportedFieldDefinition,
} from '../index';

// ─── Mock YAML Template ────────────────────────────────────────────

const MOCK_PLAN_YAML: YamlTemplate = {
  id: 'research_plan',
  version: 'v7.2',
  ai_generation_tasks: [
    { task_id: 'summary' },
    { task_id: 'background' },
    { task_id: 'method_approach' },
    { task_id: 'session_format_detail' },
    { task_id: 'data_collection_methods' },
    { task_id: 'participant_glance' },
    { task_id: 'participant_composition_prose' },
    { task_id: 'deliverables_narrative' },
    { task_id: 'risks' },
    { task_id: 'brief_operationalization' },
  ],
  emits: [
    { key: 'study_timeline' },
    { key: 'risks' },
    { key: 'deliverables' },
  ],
};

// ─── Contract Identity Tests ───────────────────────────────────────

describe('Plan Contract Identity', () => {
  it('has correct artifact_type', () => {
    expect(PLAN_CONTRACT.artifact_type).toBe('plan');
  });

  it('has correct template_id', () => {
    expect(PLAN_CONTRACT.template_id).toBe('research_plan');
  });

  it('has version matching YAML', () => {
    expect(PLAN_CONTRACT.template_version).toBe('v7.2');
  });
});

// ─── Generated Fields Tests ────────────────────────────────────────

describe('Plan Generated Fields', () => {
  const generatedFields = getGeneratedFields(PLAN_CONTRACT);

  it('has 10 generated fields', () => {
    expect(generatedFields).toHaveLength(10);
  });

  it('generated fields match YAML task IDs', () => {
    const contractTaskIds = generatedFields.map(f => f.generation_task_id);
    const yamlTaskIds = [...PLAN_YAML_TASK_IDS];

    // Every contract task ID should exist in YAML
    for (const taskId of contractTaskIds) {
      expect(yamlTaskIds).toContain(taskId);
    }

    // Every YAML task ID should be referenced by a contract field
    for (const taskId of yamlTaskIds) {
      expect(contractTaskIds).toContain(taskId);
    }
  });

  it('all generated fields have artifact_sections canonical source', () => {
    for (const field of generatedFields) {
      expect(field.canonical.table).toBe('artifact_sections');
    }
  });

  it('all generated fields have plan_ prefixed section_key', () => {
    for (const field of generatedFields) {
      expect(field.canonical.section_key).toMatch(/^plan_/);
    }
  });
});

// ─── Task-Section Mapping Tests (Critical: risks bug prevention) ───

describe('Plan Task-Section Mapping', () => {
  const taskToSection = buildTaskToSectionMap(PLAN_CONTRACT);

  it('summary → plan_summary', () => {
    expect(taskToSection.get('summary')).toBe('plan_summary');
  });

  it('background → plan_background', () => {
    expect(taskToSection.get('background')).toBe('plan_background');
  });

  it('method_approach → plan_method_approach', () => {
    expect(taskToSection.get('method_approach')).toBe('plan_method_approach');
  });

  it('session_format_detail → plan_session_format', () => {
    expect(taskToSection.get('session_format_detail')).toBe('plan_session_format');
  });

  it('data_collection_methods → plan_data_collection', () => {
    expect(taskToSection.get('data_collection_methods')).toBe('plan_data_collection');
  });

  it('participant_glance → plan_participant_glance', () => {
    expect(taskToSection.get('participant_glance')).toBe('plan_participant_glance');
  });

  it('participant_composition_prose → plan_participants_prose', () => {
    expect(taskToSection.get('participant_composition_prose')).toBe('plan_participants_prose');
  });

  it('deliverables_narrative → plan_deliverables', () => {
    expect(taskToSection.get('deliverables_narrative')).toBe('plan_deliverables');
  });

  it('risks → plan_risks (NOT risks_raw)', () => {
    // REGRESSION TEST: This is the exact bug pattern that caused empty risks sections
    expect(taskToSection.get('risks')).toBe('plan_risks');
    expect(taskToSection.get('risks')).not.toBe('risks_raw');
    expect(taskToSection.get('risks')).not.toBe('risks');
  });

  it('brief_operationalization → plan_commitments', () => {
    expect(taskToSection.get('brief_operationalization')).toBe('plan_commitments');
  });

  it('has exactly 10 mappings (one per task)', () => {
    expect(taskToSection.size).toBe(10);
  });
});

// ─── Inherited Fields Tests ────────────────────────────────────────

describe('Plan Inherited Fields', () => {
  const inheritedFields = PLAN_CONTRACT.fields.filter(isInheritedField) as InheritedFieldDefinition[];

  it('has inherited fields from Brief', () => {
    expect(inheritedFields.length).toBeGreaterThan(0);
  });

  it('research_objectives inherits from Brief', () => {
    const field = inheritedFields.find(f => f.key === 'research_objectives');
    expect(field).toBeDefined();
    expect(field?.inherits_from.artifact).toBe('brief');
    expect(field?.inherits_from.field).toBe('research_objectives');
  });

  it('research_questions inherits from Brief', () => {
    const field = inheritedFields.find(f => f.key === 'research_questions');
    expect(field).toBeDefined();
    expect(field?.inherits_from.artifact).toBe('brief');
  });

  it('methodology_selection inherits from Brief', () => {
    const field = inheritedFields.find(f => f.key === 'methodology_selection');
    expect(field).toBeDefined();
    expect(field?.inherits_from.artifact).toBe('brief');
  });

  it('timeline_phases inherits from Brief', () => {
    const field = inheritedFields.find(f => f.key === 'timeline_phases');
    expect(field).toBeDefined();
    expect(field?.inherits_from.artifact).toBe('brief');
  });

  it('all inherited fields are NOT editable', () => {
    for (const field of inheritedFields) {
      expect(field.editable).toBe(false);
    }
  });

  it('all inherited fields have study_variables canonical source', () => {
    for (const field of inheritedFields) {
      expect(field.canonical.table).toBe('study_variables');
    }
  });
});

// ─── Unsupported Fields Tests (Backlog #377) ───────────────────────

describe('Plan Unsupported Fields', () => {
  const unsupportedFields = getUnsupportedFields(PLAN_CONTRACT);

  it('has 3 unsupported fields', () => {
    expect(unsupportedFields).toHaveLength(3);
  });

  it('session_format is unsupported', () => {
    const field = unsupportedFields.find(f => f.key === 'session_format');
    expect(field).toBeDefined();
    expect(field?.canonical.source).toBe('unsupported');
  });

  it('session_duration is unsupported', () => {
    const field = unsupportedFields.find(f => f.key === 'session_duration');
    expect(field).toBeDefined();
    expect(field?.canonical.source).toBe('unsupported');
  });

  it('compensation is unsupported', () => {
    const field = unsupportedFields.find(f => f.key === 'compensation');
    expect(field).toBeDefined();
    expect(field?.canonical.source).toBe('unsupported');
  });

  it('unsupported fields reference backlog #377', () => {
    for (const field of unsupportedFields) {
      if (field.canonical.source === 'unsupported') {
        expect(field.canonical.backlog_ref).toBe('#377');
      }
    }
  });

  it('unsupported fields have omit fallback', () => {
    for (const field of unsupportedFields) {
      expect(field.fallback.type).toBe('omit');
    }
  });

  it('unsupported fields are NOT required', () => {
    for (const field of unsupportedFields) {
      expect(field.required).toBe(false);
    }
  });

  it('unsupported fields have unsupported workspace projection', () => {
    for (const field of unsupportedFields) {
      expect(field.workspace.type).toBe('unsupported');
    }
  });
});

// ─── Computed Fields Tests ─────────────────────────────────────────

describe('Plan Computed Fields', () => {
  const computedFields = PLAN_CONTRACT.fields.filter(isComputedField);

  it('has computed fields', () => {
    expect(computedFields.length).toBeGreaterThan(0);
  });

  it('timeline_summary is computed', () => {
    const field = computedFields.find(f => f.key === 'timeline_summary');
    expect(field).toBeDefined();
    if (field && 'source' in field.canonical) {
      expect(field.canonical.source).toBe('computed');
    }
  });

  it('per_participant_compensation is computed', () => {
    const field = computedFields.find(f => f.key === 'per_participant_compensation');
    expect(field).toBeDefined();
    if (field && 'source' in field.canonical) {
      expect(field.canonical.source).toBe('computed');
    }
  });

  it('computed fields have derivation description', () => {
    for (const field of computedFields) {
      if ('source' in field.canonical && field.canonical.source === 'computed') {
        expect(field.canonical.derivation).toBeTruthy();
      }
    }
  });

  it('computed fields are NOT editable', () => {
    for (const field of computedFields) {
      expect(field.editable).toBe(false);
    }
  });
});

// ─── Editable Fields Tests ─────────────────────────────────────────

describe('Plan Editable Fields', () => {
  const editableFields = getEditableFields(PLAN_CONTRACT);

  it('prose fields are editable', () => {
    const editableKeys = editableFields.map(f => f.key);
    expect(editableKeys).toContain('plan_summary');
    expect(editableKeys).toContain('plan_background');
    expect(editableKeys).toContain('plan_method_approach');
    expect(editableKeys).toContain('plan_participants_prose');
    expect(editableKeys).toContain('plan_deliverables');
  });

  it('structured JSON fields are NOT editable', () => {
    const risksField = PLAN_CONTRACT.fields.find(f => f.key === 'plan_risks');
    const commitmentsField = PLAN_CONTRACT.fields.find(f => f.key === 'plan_commitments');

    expect(risksField?.editable).toBe(false);
    expect(commitmentsField?.editable).toBe(false);
  });

  it('inherited fields are NOT editable', () => {
    const inheritedFields = PLAN_CONTRACT.fields.filter(isInheritedField);
    for (const field of inheritedFields) {
      expect(field.editable).toBe(false);
    }
  });
});

// ─── Contract Structure Validation ─────────────────────────────────

describe('Plan Contract Structure Validation', () => {
  it('passes structure validation', () => {
    const errors = validateContractStructure(PLAN_CONTRACT);
    expect(errors).toHaveLength(0);
  });
});

// ─── Contract vs YAML Validation ───────────────────────────────────

describe('Plan Contract vs YAML Validation', () => {
  it('validates successfully against YAML', () => {
    const result = validateContractAgainstYaml(PLAN_CONTRACT, MOCK_PLAN_YAML);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing YAML task', () => {
    const badYaml: YamlTemplate = {
      ...MOCK_PLAN_YAML,
      ai_generation_tasks: MOCK_PLAN_YAML.ai_generation_tasks?.filter(
        t => t.task_id !== 'risks',
      ),
    };
    const result = validateContractAgainstYaml(PLAN_CONTRACT, badYaml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_YAML_TASK')).toBe(true);
    expect(result.errors.some(e => e.task_id === 'risks')).toBe(true);
  });
});

// ─── Task-Section Mapping Validation ───────────────────────────────

describe('Plan Task-Section Mapping Validation', () => {
  it('validates correct mappings', () => {
    const expectedMappings = new Map([
      ['risks', 'plan_risks'],
      ['brief_operationalization', 'plan_commitments'],
    ]);
    const errors = validateTaskSectionMapping(PLAN_CONTRACT, expectedMappings);
    expect(errors).toHaveLength(0);
  });

  it('detects incorrect mapping (risks_raw bug pattern)', () => {
    const badMappings = new Map([
      ['risks', 'risks_raw'], // This would be a bug!
    ]);
    const errors = validateTaskSectionMapping(PLAN_CONTRACT, badMappings);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('SECTION_KEY_MISMATCH');
    expect(errors[0].task_id).toBe('risks');
  });

  it('detects incorrect mapping (unprefixed section key)', () => {
    const badMappings = new Map([
      ['risks', 'risks'], // Should be plan_risks, not risks
    ]);
    const errors = validateTaskSectionMapping(PLAN_CONTRACT, badMappings);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('SECTION_KEY_MISMATCH');
  });
});

// ─── Workspace Projection Tests ────────────────────────────────────

describe('Plan Workspace Projections', () => {
  it('prose fields use ArtifactEditor', () => {
    const generatedFields = getGeneratedFields(PLAN_CONTRACT);
    const proseFields = generatedFields.filter(
      f => f.data_type === 'markdown_prose' && f.editable,
    );
    for (const field of proseFields) {
      if (field.workspace.type === 'prose') {
        expect(field.workspace.component).toBe('ArtifactEditor');
      }
    }
  });

  it('risks field uses table projection', () => {
    const risksField = PLAN_CONTRACT.fields.find(f => f.key === 'plan_risks');
    expect(risksField?.workspace.type).toBe('table');
    if (risksField?.workspace.type === 'table') {
      expect(risksField.workspace.columns).toContain('Risk');
      expect(risksField.workspace.columns).toContain('Likelihood');
      expect(risksField.workspace.columns).toContain('Mitigation');
    }
  });

  it('inherited objectives use structured_rows projection', () => {
    const objectivesField = PLAN_CONTRACT.fields.find(f => f.key === 'research_objectives');
    expect(objectivesField?.workspace.type).toBe('structured_rows');
    if (objectivesField?.workspace.type === 'structured_rows') {
      expect(objectivesField.workspace.id_field).toBe('id');
    }
  });

  it('timeline_phases uses table projection', () => {
    const timelineField = PLAN_CONTRACT.fields.find(f => f.key === 'timeline_phases');
    expect(timelineField?.workspace.type).toBe('table');
  });
});

// ─── Quick Facts Derivation Test ───────────────────────────────────

describe('Plan Quick Facts Fields', () => {
  it('participant_glance is used for Quick Facts (not full prose)', () => {
    const glanceField = PLAN_CONTRACT.fields.find(f => f.key === 'plan_participant_glance');
    expect(glanceField).toBeDefined();
    expect(glanceField?.workspace.type).toBe('fact');
    if (glanceField?.workspace.type === 'fact') {
      expect(glanceField.workspace.label).toBe('Participants');
      expect(glanceField.workspace.derivation).toBeTruthy();
    }
  });

  it('timeline_summary is used for Quick Facts', () => {
    const timelineSummary = PLAN_CONTRACT.fields.find(f => f.key === 'timeline_summary');
    expect(timelineSummary).toBeDefined();
    expect(timelineSummary?.workspace.type).toBe('fact');
  });

  it('methodology_selection is shown as fact', () => {
    const methodField = PLAN_CONTRACT.fields.find(f => f.key === 'methodology_selection');
    expect(methodField?.workspace.type).toBe('fact');
    if (methodField?.workspace.type === 'fact') {
      expect(methodField.workspace.label).toBe('Method');
    }
  });
});

// ─── Cascade Fields Tests ──────────────────────────────────────────

describe('Plan Cascade Fields', () => {
  const cascadeFields = PLAN_CONTRACT.fields.filter(isCascadeField);

  it('has cascade fields for downstream consumption', () => {
    expect(cascadeFields.length).toBeGreaterThan(0);
  });

  it('study_timeline is a cascade field', () => {
    const field = cascadeFields.find(f => f.key === 'study_timeline');
    expect(field).toBeDefined();
    expect(field?.schema_ref).toBe('schemas/study_timeline.yaml');
  });

  it('deliverables is a cascade field', () => {
    const field = cascadeFields.find(f => f.key === 'deliverables');
    expect(field).toBeDefined();
    expect(field?.schema_ref).toBe('schemas/study_deliverable.yaml');
  });
});
