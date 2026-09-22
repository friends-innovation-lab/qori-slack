/**
 * Brief Contract Tests
 *
 * Validates Brief artifact contract:
 * - All generated fields reference valid YAML task IDs
 * - Section key mappings are correct
 * - Contract structure is valid
 * - Specific regression tests (e.g., risks key)
 */

import {
  BRIEF_CONTRACT,
  BRIEF_YAML_TASK_IDS,
  getGeneratedFields,
  getEditableFields,
  getUnsupportedFields,
  buildTaskToSectionMap,
  isGeneratedField,
  isCascadeField,
  isUserInputField,
  isSystemField,
  validateContractStructure,
  validateContractAgainstYaml,
  validateTaskSectionMapping,
  type YamlTemplate,
} from '../index';

// ─── Mock YAML Template ────────────────────────────────────────────

const MOCK_BRIEF_YAML: YamlTemplate = {
  id: 'research_brief',
  version: 'v7.1',
  ai_generation_tasks: [
    { task_id: 'descriptive_title' },
    { task_id: 'summary' },
    { task_id: 'problem_narrative' },
    { task_id: 'method_rationale' },
    { task_id: 'participant_rationale' },
    { task_id: 'out_of_scope_rationale' },
    { task_id: 'risks' },
    { task_id: 'approval_items' },
  ],
  emits: [
    { key: 'research_objectives' },
    { key: 'research_questions' },
    { key: 'target_barriers' },
    { key: 'methodology_selection' },
    { key: 'participant_criteria' },
    { key: 'out_of_scope' },
    { key: 'business_context' },
    { key: 'timeline_preference' },
    { key: 'start_date' },
    { key: 'decision_deadline' },
    { key: 'budget' },
    { key: 'participant_approach' },
    { key: 'recruitment_sources' },
  ],
};

// ─── Contract Identity Tests ───────────────────────────────────────

describe('Brief Contract Identity', () => {
  it('has correct artifact_type', () => {
    expect(BRIEF_CONTRACT.artifact_type).toBe('brief');
  });

  it('has correct template_id', () => {
    expect(BRIEF_CONTRACT.template_id).toBe('research_brief');
  });

  it('has version matching YAML', () => {
    expect(BRIEF_CONTRACT.template_version).toBe('v7.1');
  });
});

// ─── Generated Fields Tests ────────────────────────────────────────

describe('Brief Generated Fields', () => {
  const generatedFields = getGeneratedFields(BRIEF_CONTRACT);

  it('has 8 generated fields', () => {
    expect(generatedFields).toHaveLength(8);
  });

  it('generated fields match YAML task IDs', () => {
    const contractTaskIds = generatedFields.map(f => f.generation_task_id);
    const yamlTaskIds = [...BRIEF_YAML_TASK_IDS];

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

  it('all generated fields have non-empty section_key', () => {
    for (const field of generatedFields) {
      expect(field.canonical.section_key).toBeTruthy();
    }
  });
});

// ─── Task-Section Mapping Tests ────────────────────────────────────

describe('Brief Task-Section Mapping', () => {
  const taskToSection = buildTaskToSectionMap(BRIEF_CONTRACT);

  it('descriptive_title → descriptive_title', () => {
    expect(taskToSection.get('descriptive_title')).toBe('descriptive_title');
  });

  it('summary → summary', () => {
    expect(taskToSection.get('summary')).toBe('summary');
  });

  it('problem_narrative → problem_narrative', () => {
    expect(taskToSection.get('problem_narrative')).toBe('problem_narrative');
  });

  it('method_rationale → method_prose', () => {
    expect(taskToSection.get('method_rationale')).toBe('method_prose');
  });

  it('participant_rationale → participants_prose', () => {
    expect(taskToSection.get('participant_rationale')).toBe('participants_prose');
  });

  it('out_of_scope_rationale → out_of_scope', () => {
    expect(taskToSection.get('out_of_scope_rationale')).toBe('out_of_scope');
  });

  it('risks → risks (NOT risks_raw)', () => {
    // REGRESSION TEST: This is the exact bug that caused empty risks sections
    expect(taskToSection.get('risks')).toBe('risks');
    expect(taskToSection.get('risks')).not.toBe('risks_raw');
  });

  it('approval_items → approval_items', () => {
    expect(taskToSection.get('approval_items')).toBe('approval_items');
  });

  it('has exactly 8 mappings (one per task)', () => {
    expect(taskToSection.size).toBe(8);
  });
});

// ─── Section Key Uniqueness Tests ──────────────────────────────────

describe('Brief Section Key Uniqueness', () => {
  it('no duplicate section keys', () => {
    const generatedFields = getGeneratedFields(BRIEF_CONTRACT);
    const sectionKeys = generatedFields.map(f => f.canonical.section_key);
    const uniqueKeys = new Set(sectionKeys);
    expect(sectionKeys.length).toBe(uniqueKeys.size);
  });
});

// ─── Editable Fields Tests ─────────────────────────────────────────

describe('Brief Editable Fields', () => {
  const editableFields = getEditableFields(BRIEF_CONTRACT);

  it('prose fields are editable', () => {
    const editableKeys = editableFields.map(f => f.key);
    expect(editableKeys).toContain('summary');
    expect(editableKeys).toContain('problem_narrative');
    expect(editableKeys).toContain('method_prose');
    expect(editableKeys).toContain('participants_prose');
    expect(editableKeys).toContain('out_of_scope');
    expect(editableKeys).toContain('descriptive_title');
  });

  it('structured JSON risks field is NOT editable', () => {
    const risksField = BRIEF_CONTRACT.fields.find(f => f.key === 'risks');
    expect(risksField?.editable).toBe(false);
  });

  it('cascade fields (objectives, questions, barriers) are NOT editable', () => {
    const objectivesField = BRIEF_CONTRACT.fields.find(f => f.key === 'research_objectives');
    const questionsField = BRIEF_CONTRACT.fields.find(f => f.key === 'research_questions');
    const barriersField = BRIEF_CONTRACT.fields.find(f => f.key === 'target_barriers');

    expect(objectivesField?.editable).toBe(false);
    expect(questionsField?.editable).toBe(false);
    expect(barriersField?.editable).toBe(false);
  });

  it('system fields are NOT editable', () => {
    const systemFields = BRIEF_CONTRACT.fields.filter(isSystemField);
    for (const field of systemFields) {
      expect(field.editable).toBe(false);
    }
  });
});

// ─── Field Authority Tests ─────────────────────────────────────────

describe('Brief Field Authority Distribution', () => {
  it('has generated fields', () => {
    const generated = BRIEF_CONTRACT.fields.filter(isGeneratedField);
    expect(generated.length).toBeGreaterThan(0);
  });

  it('has cascade fields', () => {
    const cascade = BRIEF_CONTRACT.fields.filter(isCascadeField);
    expect(cascade.length).toBeGreaterThan(0);
  });

  it('has user_input fields', () => {
    const userInput = BRIEF_CONTRACT.fields.filter(isUserInputField);
    expect(userInput.length).toBeGreaterThan(0);
  });

  it('has system fields', () => {
    const system = BRIEF_CONTRACT.fields.filter(isSystemField);
    expect(system.length).toBeGreaterThan(0);
  });

  it('has NO unsupported fields', () => {
    const unsupported = getUnsupportedFields(BRIEF_CONTRACT);
    expect(unsupported).toHaveLength(0);
  });
});

// ─── Contract Structure Validation ─────────────────────────────────

describe('Brief Contract Structure Validation', () => {
  it('passes structure validation', () => {
    const errors = validateContractStructure(BRIEF_CONTRACT);
    expect(errors).toHaveLength(0);
  });
});

// ─── Contract vs YAML Validation ───────────────────────────────────

describe('Brief Contract vs YAML Validation', () => {
  it('validates successfully against YAML', () => {
    const result = validateContractAgainstYaml(BRIEF_CONTRACT, MOCK_BRIEF_YAML);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing YAML task', () => {
    const badYaml: YamlTemplate = {
      ...MOCK_BRIEF_YAML,
      ai_generation_tasks: MOCK_BRIEF_YAML.ai_generation_tasks?.filter(
        t => t.task_id !== 'risks',
      ),
    };
    const result = validateContractAgainstYaml(BRIEF_CONTRACT, badYaml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_YAML_TASK')).toBe(true);
    expect(result.errors.some(e => e.task_id === 'risks')).toBe(true);
  });

  it('warns about orphan YAML task', () => {
    const extraYaml: YamlTemplate = {
      ...MOCK_BRIEF_YAML,
      ai_generation_tasks: [
        ...(MOCK_BRIEF_YAML.ai_generation_tasks ?? []),
        { task_id: 'orphan_task' },
      ],
    };
    const result = validateContractAgainstYaml(BRIEF_CONTRACT, extraYaml);
    expect(result.warnings.some(w => w.code === 'ORPHAN_YAML_TASK')).toBe(true);
    expect(result.warnings.some(w => w.task_id === 'orphan_task')).toBe(true);
  });
});

// ─── Task-Section Mapping Validation ───────────────────────────────

describe('Brief Task-Section Mapping Validation', () => {
  it('validates correct mappings', () => {
    const expectedMappings = new Map([
      ['risks', 'risks'],
      ['summary', 'summary'],
    ]);
    const errors = validateTaskSectionMapping(BRIEF_CONTRACT, expectedMappings);
    expect(errors).toHaveLength(0);
  });

  it('detects incorrect mapping (risks_raw bug)', () => {
    const badMappings = new Map([
      ['risks', 'risks_raw'], // This was the bug!
    ]);
    const errors = validateTaskSectionMapping(BRIEF_CONTRACT, badMappings);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('SECTION_KEY_MISMATCH');
    expect(errors[0].task_id).toBe('risks');
  });
});

// ─── Workspace Projection Tests ────────────────────────────────────

describe('Brief Workspace Projections', () => {
  it('editable prose fields use ArtifactEditor or MarkdownDisplay', () => {
    const generatedFields = getGeneratedFields(BRIEF_CONTRACT);
    const proseFields = generatedFields.filter(
      f => f.data_type === 'markdown_prose' && f.editable,
    );
    for (const field of proseFields) {
      if (field.workspace.type === 'prose') {
        // ArtifactEditor for most prose, MarkdownDisplay for approval_items
        expect(['ArtifactEditor', 'MarkdownDisplay']).toContain(field.workspace.component);
      }
    }
  });

  it('main editable prose sections use ArtifactEditor', () => {
    const editableSections = ['summary', 'problem_narrative', 'method_prose', 'participants_prose', 'out_of_scope'];
    for (const key of editableSections) {
      const field = BRIEF_CONTRACT.fields.find(f => f.key === key);
      expect(field).toBeDefined();
      expect(field?.workspace.type).toBe('prose');
      if (field?.workspace.type === 'prose') {
        expect(field.workspace.component).toBe('ArtifactEditor');
      }
    }
  });

  it('risks field uses table projection', () => {
    const risksField = BRIEF_CONTRACT.fields.find(f => f.key === 'risks');
    expect(risksField?.workspace.type).toBe('table');
    if (risksField?.workspace.type === 'table') {
      expect(risksField.workspace.columns).toContain('Risk');
      expect(risksField.workspace.columns).toContain('Source');
      expect(risksField.workspace.columns).toContain('Mitigation');
    }
  });

  it('cascade arrays use structured_rows projection', () => {
    const objectivesField = BRIEF_CONTRACT.fields.find(f => f.key === 'research_objectives');
    expect(objectivesField?.workspace.type).toBe('structured_rows');
    if (objectivesField?.workspace.type === 'structured_rows') {
      expect(objectivesField.workspace.id_field).toBe('id');
    }
  });
});

// ─── Markdown Projection Tests ─────────────────────────────────────

describe('Brief Markdown Projections', () => {
  it('prose fields have section headings', () => {
    const summaryField = BRIEF_CONTRACT.fields.find(f => f.key === 'summary');
    expect(summaryField?.markdown.type).toBe('prose');
    if (summaryField?.markdown.type === 'prose') {
      expect(summaryField.markdown.section_heading).toBe('Summary');
    }
  });

  it('risks field uses table projection', () => {
    const risksField = BRIEF_CONTRACT.fields.find(f => f.key === 'risks');
    expect(risksField?.markdown.type).toBe('table');
  });

  it('cascade arrays use bullet_list projection', () => {
    const objectivesField = BRIEF_CONTRACT.fields.find(f => f.key === 'research_objectives');
    expect(objectivesField?.markdown.type).toBe('bullet_list');
    if (objectivesField?.markdown.type === 'bullet_list') {
      expect(objectivesField.markdown.item_template).toContain('{{id}}');
    }
  });
});

// ─── Required Fields Tests ─────────────────────────────────────────

describe('Brief Required Fields', () => {
  it('all generated fields are required', () => {
    const generatedFields = getGeneratedFields(BRIEF_CONTRACT);
    for (const field of generatedFields) {
      // All Brief generated fields should be required
      expect(field.required).toBe(true);
    }
  });

  it('optional fields have appropriate fallback', () => {
    const budgetField = BRIEF_CONTRACT.fields.find(f => f.key === 'budget');
    expect(budgetField?.required).toBe(false);
    expect(budgetField?.fallback.type).toBe('omit');
  });
});
