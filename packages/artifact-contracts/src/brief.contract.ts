/**
 * Research Brief Artifact Contract
 *
 * Defines all fields in the Brief artifact:
 * - Field identity and type
 * - Canonical storage location
 * - Authority (who/what is authoritative)
 * - Editability
 * - Generation mapping (YAML task_id for LLM-generated fields)
 * - Projection behavior (Workspace and Markdown)
 * - Fallback behavior
 *
 * YAML task IDs (from config/prompts/research_brief.yaml):
 * - descriptive_title
 * - summary
 * - problem_narrative
 * - method_rationale
 * - participant_rationale
 * - out_of_scope_rationale
 * - risks
 * - approval_items
 */

import type {
  ArtifactContract,
  GeneratedFieldDefinition,
  UserInputFieldDefinition,
  SystemFieldDefinition,
  ComputedFieldDefinition,
  CascadeFieldDefinition,
} from './types';

// ─── Generated Fields (LLM tasks) ──────────────────────────────────

const descriptiveTitle: GeneratedFieldDefinition = {
  key: 'descriptive_title',
  authority: 'generated',
  generation_task_id: 'descriptive_title',
  data_type: 'string',
  canonical: {
    table: 'artifact_sections',
    section_key: 'descriptive_title',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'masthead', position: 'title' },
  fallback: { type: 'default', value: 'Research Brief' },
  description: 'Humanized study title generated from slug',
};

const summary: GeneratedFieldDefinition = {
  key: 'summary',
  authority: 'generated',
  generation_task_id: 'summary',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'summary',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Summary' },
  fallback: { type: 'omit' },
  description: '2-3 sentence elevator pitch for the study',
};

const problemNarrative: GeneratedFieldDefinition = {
  key: 'problem_narrative',
  authority: 'generated',
  generation_task_id: 'problem_narrative',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'problem_narrative',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Problem' },
  fallback: { type: 'omit' },
  description: '2-3 paragraph problem framing narrative',
};

const methodProse: GeneratedFieldDefinition = {
  key: 'method_prose',
  authority: 'generated',
  generation_task_id: 'method_rationale',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'method_prose',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Method' },
  fallback: { type: 'omit' },
  description: 'Methodology justification prose',
};

const participantsProse: GeneratedFieldDefinition = {
  key: 'participants_prose',
  authority: 'generated',
  generation_task_id: 'participant_rationale',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'participants_prose',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Participants' },
  fallback: { type: 'omit' },
  description: 'Participant composition and rationale',
};

const outOfScope: GeneratedFieldDefinition = {
  key: 'out_of_scope',
  authority: 'generated',
  generation_task_id: 'out_of_scope_rationale',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'out_of_scope',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Out of scope' },
  fallback: { type: 'omit' },
  description: 'Scope boundaries and rationale',
};

const risks: GeneratedFieldDefinition = {
  key: 'risks',
  authority: 'generated',
  generation_task_id: 'risks',
  data_type: 'structured_json',
  canonical: {
    table: 'artifact_sections',
    section_key: 'risks',
    content_type: 'structured_json',
  },
  editable: false,
  required: true,
  workspace: { type: 'table', columns: ['Risk', 'Source', 'Mitigation'] },
  markdown: { type: 'table', columns: ['Risk', 'Source', 'Mitigation'] },
  fallback: { type: 'omit' },
  description: '3-5 study-specific risks with sources and mitigations',
};

const approvalItems: GeneratedFieldDefinition = {
  key: 'approval_items',
  authority: 'generated',
  generation_task_id: 'approval_items',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'approval_items',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'MarkdownDisplay' },
  markdown: { type: 'prose', section_heading: 'Approval' },
  fallback: { type: 'omit' },
  description: '4 approval checklist items',
};

// ─── User Input Fields (modal form) ────────────────────────────────

const studyName: UserInputFieldDefinition = {
  key: 'study_name',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'research_studies',
    column: 'name',
  },
  editable: false,
  required: true,
  workspace: { type: 'system_block', label: 'Study' },
  markdown: { type: 'masthead', position: 'subtitle' },
  fallback: { type: 'omit' },
  description: 'Study name from modal selection',
};

const leadResearcher: UserInputFieldDefinition = {
  key: 'lead_researcher',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'research_studies',
    column: 'researcher_name',
  },
  editable: false,
  required: true,
  workspace: { type: 'system_block', label: 'Researcher' },
  markdown: { type: 'masthead', position: 'subtitle' },
  fallback: { type: 'omit' },
  description: 'Lead researcher display name',
};

const requestorName: UserInputFieldDefinition = {
  key: 'requestor_name',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'study_variables',
    variable_key: 'requestor_name',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'system_block', label: 'Requested by' },
  markdown: { type: 'masthead', position: 'subtitle' },
  fallback: { type: 'omit' },
  description: 'Stakeholder who requested the research',
};

const methodologySelection: UserInputFieldDefinition = {
  key: 'methodology_selection',
  authority: 'user_input',
  data_type: 'enum',
  canonical: {
    table: 'study_variables',
    variable_key: 'methodology_selection',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'fact', label: 'Method' },
  markdown: { type: 'metadata_row', label: 'Method' },
  fallback: { type: 'omit' },
  description: 'Selected research methodology',
};

const startDate: UserInputFieldDefinition = {
  key: 'start_date',
  authority: 'user_input',
  data_type: 'date',
  canonical: {
    table: 'study_variables',
    variable_key: 'start_date',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'Research start date',
};

const decisionDeadline: UserInputFieldDefinition = {
  key: 'decision_deadline',
  authority: 'user_input',
  data_type: 'date',
  canonical: {
    table: 'study_variables',
    variable_key: 'decision_deadline',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'fact', label: 'Decision deadline' },
  markdown: { type: 'metadata_row', label: 'Hard deadline' },
  fallback: { type: 'omit' },
  description: 'Hard deadline for findings',
};

const budget: UserInputFieldDefinition = {
  key: 'budget',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'study_variables',
    variable_key: 'budget',
    is_pool: false,
  },
  editable: false,
  required: false,
  workspace: { type: 'fact', label: 'Budget' },
  markdown: { type: 'metadata_row', label: 'Budget' },
  fallback: { type: 'omit' },
  description: 'Budget envelope',
};

const participantApproach: UserInputFieldDefinition = {
  key: 'participant_approach',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'study_variables',
    variable_key: 'participant_approach',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: {
    type: 'fact',
    label: 'Participants',
    derivation: 'Extract count from prose prefix (e.g., "8 Veterans" → "8 participants")',
  },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'Participant composition and count',
};

const recruitmentSources: UserInputFieldDefinition = {
  key: 'recruitment_sources',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'study_variables',
    variable_key: 'recruitment_sources',
    is_pool: false,
  },
  editable: false,
  required: false,
  workspace: { type: 'hidden' },
  markdown: { type: 'prose' },
  fallback: { type: 'omit' },
  description: 'Where to recruit participants',
};

// ─── Computed Fields ───────────────────────────────────────────────

const timelinePreference: ComputedFieldDefinition = {
  key: 'timeline_preference',
  authority: 'computed',
  data_type: 'enum',
  canonical: {
    table: 'study_variables',
    variable_key: 'timeline_preference',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'default', value: 'standard' },
  description: 'Inferred from start_date and decision_deadline gap',
};

const timelinePhases: ComputedFieldDefinition = {
  key: 'timeline_phases',
  authority: 'computed',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'timeline_phases',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'table', columns: ['Phase', 'Dates'] },
  markdown: { type: 'table', columns: ['Phase', 'Dates'] },
  fallback: { type: 'omit' },
  description: 'Computed from start_date + timeline_preference',
};

// ─── Cascade Fields (extracted from output) ────────────────────────

const researchObjectives: CascadeFieldDefinition = {
  key: 'research_objectives',
  authority: 'cascade',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'research_objectives',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'structured_rows', id_field: 'id' },
  markdown: { type: 'bullet_list', item_template: '**[{{id}}]** {{objective}}' },
  fallback: { type: 'omit' },
  schema_ref: 'schemas/research_objective.yaml',
  description: 'Extracted research objectives with stable IDs (OBJ-001, OBJ-002, ...)',
};

const researchQuestions: CascadeFieldDefinition = {
  key: 'research_questions',
  authority: 'cascade',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'research_questions',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'structured_rows', id_field: 'id' },
  markdown: { type: 'bullet_list', item_template: '**[{{id}}]** {{question}} _({{priority}})_' },
  fallback: { type: 'omit' },
  schema_ref: 'schemas/research_question.yaml',
  description: 'Extracted research questions with stable IDs (RQ-001, RQ-002, ...)',
};

const targetBarriers: CascadeFieldDefinition = {
  key: 'target_barriers',
  authority: 'cascade',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'target_barriers',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'structured_rows', id_field: 'id' },
  markdown: { type: 'bullet_list', item_template: '**[{{id}}]** {{barrier}} _({{source}})_' },
  fallback: { type: 'omit' },
  schema_ref: 'schemas/target_barrier.yaml',
  description: 'Extracted target barriers with stable IDs (TB-001, TB-002, ...)',
};

// ─── System Fields ─────────────────────────────────────────────────

const briefStatus: SystemFieldDefinition = {
  key: 'brief_status',
  authority: 'system',
  data_type: 'enum',
  canonical: {
    table: 'research_studies',
    column: 'brief_status',
  },
  editable: false,
  required: false,
  workspace: { type: 'system_block', label: 'Status' },
  markdown: { type: 'masthead', position: 'status' },
  fallback: { type: 'null' },
  description: 'Approval lifecycle status (pending_approval, changes_requested, approved)',
};

const briefChangeFeedback: SystemFieldDefinition = {
  key: 'brief_change_feedback',
  authority: 'system',
  data_type: 'string',
  canonical: {
    table: 'research_studies',
    column: 'brief_change_feedback',
  },
  editable: false,
  required: false,
  workspace: { type: 'system_block', label: 'Feedback' },
  markdown: { type: 'omit' },
  fallback: { type: 'null' },
  description: 'Feedback from approver when changes requested',
};

const briefReviewerId: SystemFieldDefinition = {
  key: 'brief_reviewer_id',
  authority: 'system',
  data_type: 'string',
  canonical: {
    table: 'research_studies',
    column: 'brief_reviewer_id',
  },
  editable: false,
  required: false,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'null' },
  description: 'Slack user ID of the assigned reviewer',
};

const briefApprovedAt: SystemFieldDefinition = {
  key: 'brief_approved_at',
  authority: 'system',
  data_type: 'date',
  canonical: {
    table: 'research_studies',
    column: 'brief_approved_at',
  },
  editable: false,
  required: false,
  workspace: { type: 'system_block', label: 'Approved' },
  markdown: { type: 'omit' },
  fallback: { type: 'null' },
  description: 'Timestamp when brief was approved',
};

const artifactPublicId: SystemFieldDefinition = {
  key: 'artifact_public_id',
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
  description: 'Stable artifact identity (UUID)',
};

const contentVersion: SystemFieldDefinition = {
  key: 'content_version',
  authority: 'system',
  data_type: 'number',
  canonical: {
    table: 'research_artifacts',
    column: 'content_version',
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'default', value: 1 },
  description: 'Optimistic concurrency version counter',
};

const templateVersion: SystemFieldDefinition = {
  key: 'template_version',
  authority: 'system',
  data_type: 'string',
  canonical: {
    table: 'research_artifacts',
    column: 'template_version',
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'YAML template version used for generation',
};

// ─── Brief Contract ────────────────────────────────────────────────

export const BRIEF_CONTRACT: ArtifactContract = {
  artifact_type: 'brief',
  template_id: 'research_brief',
  template_version: 'v7.1',
  fields: [
    // Generated fields (LLM tasks)
    descriptiveTitle,
    summary,
    problemNarrative,
    methodProse,
    participantsProse,
    outOfScope,
    risks,
    approvalItems,
    // User input fields
    studyName,
    leadResearcher,
    requestorName,
    methodologySelection,
    startDate,
    decisionDeadline,
    budget,
    participantApproach,
    recruitmentSources,
    // Computed fields
    timelinePreference,
    timelinePhases,
    // Cascade fields
    researchObjectives,
    researchQuestions,
    targetBarriers,
    // System fields
    briefStatus,
    briefChangeFeedback,
    briefReviewerId,
    briefApprovedAt,
    artifactPublicId,
    contentVersion,
    templateVersion,
  ],
} as const;

/**
 * Brief YAML task IDs — must match config/prompts/research_brief.yaml
 */
export const BRIEF_YAML_TASK_IDS = [
  'descriptive_title',
  'summary',
  'problem_narrative',
  'method_rationale',
  'participant_rationale',
  'out_of_scope_rationale',
  'risks',
  'approval_items',
] as const;

export type BriefYamlTaskId = typeof BRIEF_YAML_TASK_IDS[number];
