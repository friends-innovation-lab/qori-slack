/**
 * Extractor Tests
 *
 * Tests contract-driven extraction of generated artifact fields.
 */

import {
  BRIEF_CONTRACT,
  PLAN_CONTRACT,
  extractGeneratedArtifactFields,
  buildTaskToSectionKeyMap,
  buildSectionKeyToTaskMap,
  getProseTaskIds,
  getStructuredJsonTaskIds,
  getCanonicalSectionKeys,
  type AiResponses,
} from '../index';

// ─── Brief Extraction Tests ────────────────────────────────────────

describe('Brief Generated Task Extraction', () => {
  const validBriefResponses: AiResponses = {
    descriptive_title: 'Mobile Navigation Study',
    summary: 'This study will investigate...',
    problem_narrative: 'Veterans face challenges...',
    method_rationale: 'We chose moderated interviews...',
    participant_rationale: 'We will recruit 8 Veterans...',
    out_of_scope_rationale: 'This study will not cover...',
    risks: JSON.stringify([
      { risk: 'Low recruitment', source: 'Historical data', mitigation: 'Start early' },
    ]),
    approval_items: '- [ ] Stakeholder sign-off\n- [ ] Budget approved',
  };

  it('extracts all generated fields from valid responses', () => {
    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: validBriefResponses,
    });

    expect(result.success).toBe(true);
    expect(result.extracted).toHaveLength(8);
    expect(result.missing_required).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('maps task IDs to correct section keys', () => {
    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: validBriefResponses,
    });

    const sectionKeyMap = new Map(result.extracted.map(e => [e.field_key, e.section_key]));

    expect(sectionKeyMap.get('summary')).toBe('summary');
    expect(sectionKeyMap.get('problem_narrative')).toBe('problem_narrative');
    expect(sectionKeyMap.get('method_prose')).toBe('method_prose');
    expect(sectionKeyMap.get('participants_prose')).toBe('participants_prose');
    expect(sectionKeyMap.get('out_of_scope')).toBe('out_of_scope');
    expect(sectionKeyMap.get('risks')).toBe('risks');
    expect(sectionKeyMap.get('approval_items')).toBe('approval_items');
    expect(sectionKeyMap.get('descriptive_title')).toBe('descriptive_title');
  });

  it('identifies prose vs structured_json content types', () => {
    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: validBriefResponses,
    });

    const typeMap = new Map(result.extracted.map(e => [e.field_key, e.content_type]));

    // Prose fields
    expect(typeMap.get('summary')).toBe('prose');
    expect(typeMap.get('problem_narrative')).toBe('prose');
    expect(typeMap.get('method_prose')).toBe('prose');
    expect(typeMap.get('participants_prose')).toBe('prose');
    expect(typeMap.get('out_of_scope')).toBe('prose');
    expect(typeMap.get('approval_items')).toBe('prose');
    expect(typeMap.get('descriptive_title')).toBe('prose');

    // Structured JSON fields
    expect(typeMap.get('risks')).toBe('structured_json');
  });
});

// ─── Plan Extraction Tests ─────────────────────────────────────────

describe('Plan Generated Task Extraction', () => {
  const validPlanResponses: AiResponses = {
    summary: 'This plan outlines...',
    background: 'The VA mobile app...',
    method_approach: 'We will conduct...',
    session_format_detail: '60-minute remote...',
    data_collection_methods: 'Screen recording and notes...',
    participant_glance: '8 Veterans',
    participant_composition_prose: 'We need participants who...',
    deliverables_narrative: '- Session summaries\n- Affinity map\n- Research readout',
    risks: JSON.stringify([
      { risk: 'Schedule delays', likelihood: 'Medium', mitigation: 'Buffer time' },
    ]),
    brief_operationalization: JSON.stringify([
      { commitment: 'OBJ-001', address: 'Session questions cover this objective' },
    ]),
  };

  it('extracts all generated fields from valid responses', () => {
    const result = extractGeneratedArtifactFields({
      contract: PLAN_CONTRACT,
      aiResponses: validPlanResponses,
    });

    expect(result.success).toBe(true);
    expect(result.extracted).toHaveLength(10);
    expect(result.missing_required).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('maps risks → plan_risks (NOT risks_raw)', () => {
    const result = extractGeneratedArtifactFields({
      contract: PLAN_CONTRACT,
      aiResponses: validPlanResponses,
    });

    const risksField = result.extracted.find(e => e.field_key === 'plan_risks');
    expect(risksField).toBeDefined();
    expect(risksField?.section_key).toBe('plan_risks');
    expect(risksField?.section_key).not.toBe('risks_raw');
    expect(risksField?.section_key).not.toBe('risks');
  });

  it('maps brief_operationalization → plan_commitments', () => {
    const result = extractGeneratedArtifactFields({
      contract: PLAN_CONTRACT,
      aiResponses: validPlanResponses,
    });

    const commitmentsField = result.extracted.find(e => e.field_key === 'plan_commitments');
    expect(commitmentsField).toBeDefined();
    expect(commitmentsField?.section_key).toBe('plan_commitments');
  });

  it('all plan section keys are prefixed with plan_', () => {
    const result = extractGeneratedArtifactFields({
      contract: PLAN_CONTRACT,
      aiResponses: validPlanResponses,
    });

    for (const field of result.extracted) {
      expect(field.section_key).toMatch(/^plan_/);
    }
  });
});

// ─── Prose Extraction Tests ────────────────────────────────────────

describe('Prose Extraction', () => {
  it('preserves Markdown content exactly', () => {
    const markdownContent = `## Heading

This is **bold** and _italic_.

- Bullet 1
- Bullet 2

> Quote block
`;
    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: {
        ...createMinimalBriefResponses(),
        summary: markdownContent,
      },
    });

    const summaryField = result.extracted.find(e => e.field_key === 'summary');
    expect(summaryField?.content).toBe(markdownContent);
  });

  it('does not convert Markdown to HTML', () => {
    const markdownContent = '**bold** and <script>alert("xss")</script>';
    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: {
        ...createMinimalBriefResponses(),
        summary: markdownContent,
      },
    });

    const summaryField = result.extracted.find(e => e.field_key === 'summary');
    expect(summaryField?.content).toBe(markdownContent);
    expect(summaryField?.content).not.toContain('<strong>');
  });
});

// ─── Structured JSON Extraction Tests ──────────────────────────────

describe('Structured JSON Extraction', () => {
  it('validates JSON shape for structured fields', () => {
    const validJson = JSON.stringify([
      { risk: 'Test', source: 'Test', mitigation: 'Test' },
    ]);

    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: {
        ...createMinimalBriefResponses(),
        risks: validJson,
      },
    });

    expect(result.success).toBe(true);
    const risksField = result.extracted.find(e => e.field_key === 'risks');
    expect(risksField).toBeDefined();
    expect(risksField?.content_type).toBe('structured_json');
  });

  it('fails on malformed JSON for required structured field', () => {
    const malformedJson = 'not valid json {';

    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: {
        ...createMinimalBriefResponses(),
        risks: malformedJson,
      },
      strict: true,
    });

    expect(result.success).toBe(false);
    expect(result.malformed_json.some(m => m.field_key === 'risks')).toBe(true);
    expect(result.errors.some(e => e.includes('malformed JSON'))).toBe(true);
  });

  it('reports malformed JSON but continues in non-strict mode', () => {
    const malformedJson = '{invalid}';

    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: {
        ...createMinimalBriefResponses(),
        risks: malformedJson,
      },
      strict: false,
    });

    // Non-strict mode: success is still true (no fatal errors)
    expect(result.success).toBe(true);
    expect(result.malformed_json.some(m => m.field_key === 'risks')).toBe(true);
    // The malformed field is NOT in extracted
    expect(result.extracted.find(e => e.field_key === 'risks')).toBeUndefined();
  });
});

// ─── Missing Required Field Tests ──────────────────────────────────

describe('Missing Required Generated Field', () => {
  it('fails when required generated field is missing in strict mode', () => {
    const incompleteResponses: AiResponses = {
      // Missing 'summary' which is required
      descriptive_title: 'Title',
      problem_narrative: 'Problem',
      method_rationale: 'Method',
      participant_rationale: 'Participants',
      out_of_scope_rationale: 'Out of scope',
      risks: '[]',
      approval_items: 'Items',
    };

    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: incompleteResponses,
      strict: true,
    });

    expect(result.success).toBe(false);
    expect(result.missing_required).toContain('summary');
    expect(result.errors.some(e => e.includes('summary'))).toBe(true);
  });

  it('reports but does not fail missing required field in non-strict mode', () => {
    const incompleteResponses: AiResponses = {
      // Missing 'summary' which is required
      descriptive_title: 'Title',
    };

    const result = extractGeneratedArtifactFields({
      contract: BRIEF_CONTRACT,
      aiResponses: incompleteResponses,
      strict: false,
    });

    expect(result.success).toBe(true);
    expect(result.missing_required.length).toBeGreaterThan(0);
    expect(result.missing_required).toContain('summary');
  });
});

// ─── Missing Optional Field Tests ──────────────────────────────────

describe('Missing Optional Generated Field', () => {
  it('reports missing optional field without failing', () => {
    // Plan background is optional (skip_when in YAML)
    const responsesWithoutBackground: AiResponses = {
      summary: 'Summary',
      // background is missing (optional)
      method_approach: 'Method',
      session_format_detail: 'Format',
      data_collection_methods: 'Collection',
      participant_glance: 'Glance',
      participant_composition_prose: 'Composition',
      deliverables_narrative: 'Deliverables',
      risks: '[]',
      brief_operationalization: '[]',
    };

    const result = extractGeneratedArtifactFields({
      contract: PLAN_CONTRACT,
      aiResponses: responsesWithoutBackground,
      strict: true,
    });

    expect(result.success).toBe(true);
    expect(result.missing_optional).toContain('plan_background');
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Mapping Utility Tests ─────────────────────────────────────────

describe('buildTaskToSectionKeyMap', () => {
  it('builds correct mapping for Brief', () => {
    const map = buildTaskToSectionKeyMap(BRIEF_CONTRACT);

    expect(map.get('summary')?.section_key).toBe('summary');
    expect(map.get('method_rationale')?.section_key).toBe('method_prose');
    expect(map.get('participant_rationale')?.section_key).toBe('participants_prose');
    expect(map.get('risks')?.section_key).toBe('risks');
    expect(map.get('risks')?.content_type).toBe('structured_json');
  });

  it('builds correct mapping for Plan', () => {
    const map = buildTaskToSectionKeyMap(PLAN_CONTRACT);

    expect(map.get('summary')?.section_key).toBe('plan_summary');
    expect(map.get('risks')?.section_key).toBe('plan_risks');
    expect(map.get('brief_operationalization')?.section_key).toBe('plan_commitments');
  });

  it('does NOT map risks → risks_raw (regression)', () => {
    const planMap = buildTaskToSectionKeyMap(PLAN_CONTRACT);
    expect(planMap.get('risks')?.section_key).not.toBe('risks_raw');
  });
});

describe('buildSectionKeyToTaskMap', () => {
  it('builds correct reverse mapping for Brief', () => {
    const map = buildSectionKeyToTaskMap(BRIEF_CONTRACT);

    expect(map.get('summary')).toBe('summary');
    expect(map.get('method_prose')).toBe('method_rationale');
    expect(map.get('participants_prose')).toBe('participant_rationale');
    expect(map.get('risks')).toBe('risks');
  });

  it('builds correct reverse mapping for Plan', () => {
    const map = buildSectionKeyToTaskMap(PLAN_CONTRACT);

    expect(map.get('plan_summary')).toBe('summary');
    expect(map.get('plan_risks')).toBe('risks');
    expect(map.get('plan_commitments')).toBe('brief_operationalization');
  });
});

describe('getProseTaskIds', () => {
  it('returns only prose task IDs for Brief', () => {
    const proseIds = getProseTaskIds(BRIEF_CONTRACT);

    expect(proseIds).toContain('summary');
    expect(proseIds).toContain('method_rationale');
    expect(proseIds).not.toContain('risks'); // risks is structured_json
  });

  it('returns only prose task IDs for Plan', () => {
    const proseIds = getProseTaskIds(PLAN_CONTRACT);

    expect(proseIds).toContain('summary');
    expect(proseIds).toContain('method_approach');
    expect(proseIds).not.toContain('risks'); // risks is structured_json
    expect(proseIds).not.toContain('brief_operationalization'); // structured_json
  });
});

describe('getStructuredJsonTaskIds', () => {
  it('returns only structured JSON task IDs for Brief', () => {
    const jsonIds = getStructuredJsonTaskIds(BRIEF_CONTRACT);

    expect(jsonIds).toContain('risks');
    expect(jsonIds).not.toContain('summary');
  });

  it('returns only structured JSON task IDs for Plan', () => {
    const jsonIds = getStructuredJsonTaskIds(PLAN_CONTRACT);

    expect(jsonIds).toContain('risks');
    expect(jsonIds).toContain('brief_operationalization');
    expect(jsonIds).not.toContain('summary');
  });
});

describe('getCanonicalSectionKeys', () => {
  it('returns all section keys for Brief', () => {
    const keys = getCanonicalSectionKeys(BRIEF_CONTRACT);

    expect(keys).toContain('summary');
    expect(keys).toContain('risks');
    expect(keys).toHaveLength(8);
  });

  it('returns all section keys for Plan', () => {
    const keys = getCanonicalSectionKeys(PLAN_CONTRACT);

    expect(keys).toContain('plan_summary');
    expect(keys).toContain('plan_risks');
    expect(keys).toContain('plan_commitments');
    expect(keys).toHaveLength(10);
  });
});

// ─── Helper Functions ──────────────────────────────────────────────

function createMinimalBriefResponses(): AiResponses {
  return {
    descriptive_title: 'Title',
    summary: 'Summary',
    problem_narrative: 'Problem',
    method_rationale: 'Method',
    participant_rationale: 'Participants',
    out_of_scope_rationale: 'Out of scope',
    risks: '[]',
    approval_items: 'Items',
  };
}
