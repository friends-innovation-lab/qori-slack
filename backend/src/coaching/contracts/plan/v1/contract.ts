/**
 * Plan Coaching Contract v1 — Coach M2
 *
 * Coaching contract for Research Plan artifacts. Evaluates plans against
 * research execution best practices and brief commitments.
 *
 * Criteria focus areas:
 * - Research-question alignment
 * - Method/session fit
 * - Participant fit
 * - Data-collection coherence
 * - Deliverables
 * - Risks
 * - Brief commitments
 * - Internal consistency
 */

import type {
  CoachingContract,
  RubricCriterion,
  ContextPolicy,
  OutputSchema,
  ModelConfig,
  SectionMetadata,
} from '../../types';
import type { CoachingReviewScope } from '../../../../database/models/coaching_run';
import { COACH_PROVIDER_TIMEOUT_MS, COACH_DEFAULT_REPAIR_ATTEMPTS, COACH_MAX_ITEMS_PER_CATEGORY } from '../../../config';

// ─── Contract Metadata ──────────────────────────────────────────────────

const ARTIFACT_TYPE = 'plan';
const CONTRACT_VERSION = '1.0.0';
const PROMPT_TEMPLATE_VERSION = '1.0.0';

// ─── Valid Section Keys ─────────────────────────────────────────────────

const PLAN_SECTIONS: SectionMetadata[] = [
  { key: 'research_summary', displayName: 'Research Summary', coachable: true },
  { key: 'objectives_questions', displayName: 'Objectives & Questions', coachable: true },
  { key: 'methodology_approach', displayName: 'Methodology Approach', coachable: true },
  { key: 'participant_criteria', displayName: 'Participant Criteria', coachable: true },
  { key: 'session_structure', displayName: 'Session Structure', coachable: true },
  { key: 'analysis_approach', displayName: 'Analysis Approach', coachable: true },
  { key: 'timeline_milestones', displayName: 'Timeline & Milestones', coachable: true },
  { key: 'deliverables', displayName: 'Deliverables', coachable: true },
  { key: 'plan_risks', displayName: 'Plan Risks', coachable: true },
];

// ─── Rubric Criteria ────────────────────────────────────────────────────

const PLAN_RUBRIC: RubricCriterion[] = [
  {
    id: 'research_question_alignment',
    name: 'Research Question Alignment',
    description: 'The plan activities directly address the research questions from the brief',
    category: 'alignment',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'method_session_fit',
    name: 'Method/Session Fit',
    description: 'Session structure supports the chosen methodology and will yield valid data',
    category: 'methodology',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'participant_fit',
    name: 'Participant Fit',
    description: 'Participant criteria and recruitment approach will reach the target population',
    category: 'methodology',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'data_collection_coherence',
    name: 'Data Collection Coherence',
    description: 'Data collection methods align with analysis approach and deliverables',
    category: 'methodology',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'deliverables_alignment',
    name: 'Deliverables Alignment',
    description: 'Planned deliverables match research objectives and stakeholder needs',
    category: 'planning',
    appliesToSection: false,
    appliesToArtifact: true,
  },
  {
    id: 'risk_mitigation',
    name: 'Risk Mitigation',
    description: 'Risks are identified with actionable contingency plans',
    category: 'planning',
    appliesToSection: false,
    appliesToArtifact: true,
  },
  {
    id: 'brief_commitments',
    name: 'Brief Commitments',
    description: 'The plan fulfills commitments made in the approved brief',
    category: 'alignment',
    appliesToSection: false,
    appliesToArtifact: true,
  },
  {
    id: 'internal_consistency',
    name: 'Internal Consistency',
    description: 'All sections align with each other without contradictions or timeline conflicts',
    category: 'quality',
    appliesToSection: false,
    appliesToArtifact: true,
  },
];

// ─── Context Policy ─────────────────────────────────────────────────────

const PLAN_CONTEXT_POLICY: ContextPolicy = {
  maxContextTokens: 50000,
  maxTokensPerEntry: 8000,
  allowTruncation: true,
  requiredContext: [
    { objectType: 'artifact', sectionKey: null, citationEligible: true, priority: 0 },
  ],
  supportingContext: [
    // Individual sections as fallback for large artifacts
    ...PLAN_SECTIONS.map((s, idx) => ({
      objectType: 'artifact_section',
      sectionKey: s.key,
      citationEligible: true,
      priority: idx + 1,
    })),
  ],
};

// ─── Output Schema ──────────────────────────────────────────────────────

const PLAN_OUTPUT_SCHEMA: OutputSchema = {
  maxItemsPerCategory: COACH_MAX_ITEMS_PER_CATEGORY,
  minItemsPerCategory: 0,
  maxItemTextLength: 500,
  maxReferencesPerItem: 3,
  enabledCategories: ['strength', 'issue', 'suggestion', 'question'],
};

// ─── Model Configuration ────────────────────────────────────────────────

const PLAN_MODEL_CONFIG: ModelConfig = {
  tier: 'sonnet',
  temperature: 0.3,
  maxOutputTokens: 4096,
  timeoutMs: COACH_PROVIDER_TIMEOUT_MS,
};

// ─── Prompt Templates ───────────────────────────────────────────────────

const SYSTEM_PROMPT_ARTIFACT = `You are Qori Coach, an expert research methodology advisor reviewing a Research Plan.

Your role is to provide constructive feedback as a trusted colleague. You help researchers refine their execution plan before fieldwork begins.

## Your Evaluation Criteria

Assess the plan against these criteria:
1. **Research Question Alignment**: Do activities address the research questions?
2. **Method/Session Fit**: Does the session structure support the methodology?
3. **Participant Fit**: Will the recruitment approach reach the target population?
4. **Data Collection Coherence**: Do data collection methods align with analysis approach?
5. **Deliverables Alignment**: Do deliverables match objectives and stakeholder needs?
6. **Risk Mitigation**: Are risks identified with actionable contingencies?
7. **Brief Commitments**: Does the plan fulfill the approved brief's commitments?
8. **Internal Consistency**: Do all sections align without contradictions?

## Output Format

Respond with valid JSON matching this structure:
{
  "strengths": [
    { "text": "...", "references": ["REF-001"] }
  ],
  "issues": [
    { "text": "...", "references": ["REF-002", "REF-003"] }
  ],
  "suggestions": [
    { "text": "...", "references": [] }
  ],
  "questions": [
    { "text": "...", "references": ["REF-001"] }
  ]
}

## Guidelines

- Provide 0-5 items per category. Do NOT fill quotas — only include substantive feedback.
- Order items by importance (most important first).
- Keep each item concise (1-2 sentences).
- Use only the REF handles provided in the context. Never fabricate references.
- Focus on research execution quality, not writing style.
- Be specific and actionable.
- This is advice only — the researcher makes final decisions.

Do NOT include:
- Scores or ratings
- Hidden reasoning or chain-of-thought
- References to information not in the provided context
- General praise without specific evidence`;

const SYSTEM_PROMPT_SECTION = `You are Qori Coach, an expert research methodology advisor reviewing a specific section of a Research Plan.

Your role is to provide focused feedback on the selected section while considering its relationship to the overall plan.

## Your Evaluation Criteria

For section reviews, assess:
1. **Research Question Alignment**: Does this section support the research questions?
2. **Method/Session Fit**: Is the approach in this section methodologically sound?
3. **Participant Fit**: Does this section support reaching the target population?
4. **Data Collection Coherence**: Does this section align with analysis and deliverables?

## Output Format

Respond with valid JSON matching this structure:
{
  "strengths": [
    { "text": "...", "references": ["REF-001"] }
  ],
  "issues": [
    { "text": "...", "references": ["REF-002"] }
  ],
  "suggestions": [
    { "text": "...", "references": [] }
  ],
  "questions": [
    { "text": "...", "references": ["REF-001"] }
  ]
}

## Guidelines

- Provide 0-3 items per category for section reviews. Quality over quantity.
- Focus feedback on the selected section, with context from the whole plan.
- Use only the REF handles provided. Never fabricate references.
- Be specific to the section content.
- This is advice only — the researcher makes final decisions.`;

const USER_PROMPT_ARTIFACT = `# Research Plan Review

Review the following Research Plan and provide coaching feedback.

## Available References

{{ref_handles}}

## Plan Content

{{artifact_context}}

---

Provide your structured feedback as JSON. Focus on the most important strengths, issues, suggestions, and questions for the researcher.`;

const USER_PROMPT_SECTION = `# Research Plan Section Review

Review the **{{selected_section}}** section of this Research Plan.

## Available References

{{ref_handles}}

## Full Plan Context

{{artifact_context}}

## Focus Section: {{selected_section}}

{{section_content}}

---

Provide your structured feedback as JSON. Focus on the selected section while considering the overall plan context.`;

const REPAIR_PROMPT = `Your previous response had validation errors:

{{validation_errors}}

Please provide a corrected response that:
1. Uses valid JSON format
2. Only includes the categories: strengths, issues, suggestions, questions
3. Each item has "text" (string) and "references" (array of REF handles)
4. Only uses REF handles that were provided in the context
5. Keeps each item concise (1-2 sentences)

Respond with ONLY the corrected JSON, no explanation.`;

// ─── Contract Implementation ────────────────────────────────────────────

export const PlanCoachingContractV1: CoachingContract = {
  artifactType: ARTIFACT_TYPE,
  contractVersion: CONTRACT_VERSION,
  promptTemplateVersion: PROMPT_TEMPLATE_VERSION,

  rubric: PLAN_RUBRIC,
  contextPolicy: PLAN_CONTEXT_POLICY,
  outputSchema: PLAN_OUTPUT_SCHEMA,
  modelConfig: PLAN_MODEL_CONFIG,
  maxRepairAttempts: COACH_DEFAULT_REPAIR_ATTEMPTS,
  sections: PLAN_SECTIONS,

  getSystemPrompt(scope: CoachingReviewScope, _sectionKey: string | null): string {
    return scope === 'artifact' ? SYSTEM_PROMPT_ARTIFACT : SYSTEM_PROMPT_SECTION;
  },

  getUserPromptTemplate(scope: CoachingReviewScope, sectionKey: string | null): string {
    if (scope === 'artifact') {
      return USER_PROMPT_ARTIFACT;
    }
    // For section scope, include section name
    const displayName = this.getSectionDisplayName(sectionKey ?? '') ?? sectionKey;
    return USER_PROMPT_SECTION.replace(/\{\{selected_section\}\}/g, displayName ?? '');
  },

  getRepairPrompt(validationErrors: string[]): string {
    return REPAIR_PROMPT.replace('{{validation_errors}}', validationErrors.join('\n'));
  },

  isValidSectionKey(sectionKey: string): boolean {
    return PLAN_SECTIONS.some(s => s.key === sectionKey && s.coachable);
  },

  getSectionDisplayName(sectionKey: string): string | null {
    const section = PLAN_SECTIONS.find(s => s.key === sectionKey);
    return section?.displayName ?? null;
  },
};
