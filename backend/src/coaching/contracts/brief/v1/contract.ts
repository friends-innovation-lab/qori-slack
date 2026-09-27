/**
 * Brief Coaching Contract v1 — Coach M2
 *
 * Coaching contract for Research Brief artifacts. Evaluates briefs against
 * research methodology best practices.
 *
 * Criteria focus areas:
 * - Problem ↔ objective alignment
 * - Methodological fit
 * - Participant ↔ method fit
 * - Scope clarity
 * - Risk coverage
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

const ARTIFACT_TYPE = 'brief';
const CONTRACT_VERSION = '1.0.0';
const PROMPT_TEMPLATE_VERSION = '1.0.0';

// ─── Valid Section Keys ─────────────────────────────────────────────────

const BRIEF_SECTIONS: SectionMetadata[] = [
  { key: 'summary', displayName: 'Summary', coachable: true },
  { key: 'problem_statement', displayName: 'Problem Statement', coachable: true },
  { key: 'learning_objectives', displayName: 'Learning Objectives', coachable: true },
  { key: 'research_questions', displayName: 'Research Questions', coachable: true },
  { key: 'target_barriers', displayName: 'Target Barriers', coachable: true },
  { key: 'participant_approach', displayName: 'Participant Approach', coachable: true },
  { key: 'methodology', displayName: 'Methodology', coachable: true },
  { key: 'timeline', displayName: 'Timeline', coachable: true },
  { key: 'risks', displayName: 'Risks', coachable: true },
  { key: 'discovery_sources', displayName: 'Discovery Sources', coachable: true },
];

// ─── Rubric Criteria ────────────────────────────────────────────────────

const BRIEF_RUBRIC: RubricCriterion[] = [
  {
    id: 'problem_objective_alignment',
    name: 'Problem-Objective Alignment',
    description: 'Learning objectives directly address the stated problem and will produce actionable insights',
    category: 'alignment',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'methodological_fit',
    name: 'Methodological Fit',
    description: 'The chosen methodology is appropriate for the research questions and will yield valid findings',
    category: 'methodology',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'participant_method_fit',
    name: 'Participant-Method Fit',
    description: 'The participant approach matches the methodology requirements and can reach the target population',
    category: 'methodology',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'scope_clarity',
    name: 'Scope Clarity',
    description: 'The scope is clearly defined with explicit boundaries and out-of-scope declarations',
    category: 'clarity',
    appliesToSection: true,
    appliesToArtifact: true,
  },
  {
    id: 'risk_coverage',
    name: 'Risk Coverage',
    description: 'Risks are identified with realistic mitigation strategies',
    category: 'planning',
    appliesToSection: false,
    appliesToArtifact: true,
  },
  {
    id: 'internal_consistency',
    name: 'Internal Consistency',
    description: 'All sections align with each other without contradictions or gaps',
    category: 'quality',
    appliesToSection: false,
    appliesToArtifact: true,
  },
];

// ─── Context Policy ─────────────────────────────────────────────────────

const BRIEF_CONTEXT_POLICY: ContextPolicy = {
  maxContextTokens: 50000,
  maxTokensPerEntry: 8000,
  allowTruncation: true,
  requiredContext: [
    { objectType: 'artifact', sectionKey: null, citationEligible: true, priority: 0 },
  ],
  supportingContext: [
    // Individual sections as fallback for large artifacts
    ...BRIEF_SECTIONS.map((s, idx) => ({
      objectType: 'artifact_section',
      sectionKey: s.key,
      citationEligible: true,
      priority: idx + 1,
    })),
  ],
};

// ─── Output Schema ──────────────────────────────────────────────────────

const BRIEF_OUTPUT_SCHEMA: OutputSchema = {
  maxItemsPerCategory: COACH_MAX_ITEMS_PER_CATEGORY,
  minItemsPerCategory: 0,
  maxItemTextLength: 500,
  maxReferencesPerItem: 3,
  enabledCategories: ['strength', 'issue', 'suggestion', 'question'],
};

// ─── Model Configuration ────────────────────────────────────────────────

const BRIEF_MODEL_CONFIG: ModelConfig = {
  tier: 'sonnet',
  temperature: 0.3,
  maxOutputTokens: 4096,
  timeoutMs: COACH_PROVIDER_TIMEOUT_MS,
};

// ─── Prompt Templates ───────────────────────────────────────────────────

const SYSTEM_PROMPT_ARTIFACT = `You are Qori Coach, an expert research methodology advisor reviewing a Research Brief.

Your role is to provide constructive feedback as a trusted colleague — not a gatekeeper. You help researchers strengthen their research design before fieldwork begins.

## Your Evaluation Criteria

Assess the brief against these criteria:
1. **Problem-Objective Alignment**: Do learning objectives directly address the stated problem?
2. **Methodological Fit**: Is the methodology appropriate for the research questions?
3. **Participant-Method Fit**: Does the participant approach match methodology requirements?
4. **Scope Clarity**: Is the scope clearly defined with explicit boundaries?
5. **Risk Coverage**: Are risks identified with realistic mitigations?
6. **Internal Consistency**: Do all sections align without contradictions?

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
- Focus on research methodology, not writing style.
- Be specific and actionable.
- This is advice only — the researcher makes final decisions.

Do NOT include:
- Scores or ratings
- Hidden reasoning or chain-of-thought
- References to information not in the provided context
- General praise without specific evidence`;

const SYSTEM_PROMPT_SECTION = `You are Qori Coach, an expert research methodology advisor reviewing a specific section of a Research Brief.

Your role is to provide focused feedback on the selected section while considering its relationship to the overall brief.

## Your Evaluation Criteria

For section reviews, assess:
1. **Problem-Objective Alignment**: Does this section support the research goals?
2. **Methodological Fit**: Is the approach in this section methodologically sound?
3. **Participant-Method Fit**: Does participant/method alignment hold in this section?
4. **Scope Clarity**: Is this section's scope clear and well-bounded?

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
- Focus feedback on the selected section, with context from the whole brief.
- Use only the REF handles provided. Never fabricate references.
- Be specific to the section content.
- This is advice only — the researcher makes final decisions.`;

const USER_PROMPT_ARTIFACT = `# Research Brief Review

Review the following Research Brief and provide coaching feedback.

## Available References

{{ref_handles}}

## Brief Content

{{artifact_context}}

---

Provide your structured feedback as JSON. Focus on the most important strengths, issues, suggestions, and questions for the researcher.`;

const USER_PROMPT_SECTION = `# Research Brief Section Review

Review the **{{selected_section}}** section of this Research Brief.

## Available References

{{ref_handles}}

## Full Brief Context

{{artifact_context}}

## Focus Section: {{selected_section}}

{{section_content}}

---

Provide your structured feedback as JSON. Focus on the selected section while considering the overall brief context.`;

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

export const BriefCoachingContractV1: CoachingContract = {
  artifactType: ARTIFACT_TYPE,
  contractVersion: CONTRACT_VERSION,
  promptTemplateVersion: PROMPT_TEMPLATE_VERSION,

  rubric: BRIEF_RUBRIC,
  contextPolicy: BRIEF_CONTEXT_POLICY,
  outputSchema: BRIEF_OUTPUT_SCHEMA,
  modelConfig: BRIEF_MODEL_CONFIG,
  maxRepairAttempts: COACH_DEFAULT_REPAIR_ATTEMPTS,
  sections: BRIEF_SECTIONS,

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
    return BRIEF_SECTIONS.some(s => s.key === sectionKey && s.coachable);
  },

  getSectionDisplayName(sectionKey: string): string | null {
    const section = BRIEF_SECTIONS.find(s => s.key === sectionKey);
    return section?.displayName ?? null;
  },
};
