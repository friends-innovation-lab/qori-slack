/**
 * Research Plan Artifact Contract
 *
 * Defines all fields in the Plan artifact:
 * - Field identity and type
 * - Canonical storage location
 * - Authority (who/what is authoritative)
 * - Editability
 * - Generation mapping (YAML task_id for LLM-generated fields)
 * - Projection behavior (Workspace and Markdown)
 * - Fallback behavior
 *
 * YAML task IDs (from config/prompts/research_plan.yaml):
 * - summary
 * - background
 * - method_approach
 * - session_format_detail
 * - data_collection_methods
 * - participant_glance
 * - participant_composition_prose
 * - deliverables_narrative
 * - risks
 * - brief_operationalization
 */

import type {
  ArtifactContract,
  GeneratedFieldDefinition,
  InheritedFieldDefinition,
  UserInputFieldDefinition,
  SystemFieldDefinition,
  ComputedFieldDefinition,
  CascadeFieldDefinition,
  UnsupportedFieldDefinition,
} from './types';

// ─── Generated Fields (LLM tasks) ──────────────────────────────────

const planSummary: GeneratedFieldDefinition = {
  key: 'plan_summary',
  authority: 'generated',
  generation_task_id: 'summary',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_summary',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Summary' },
  fallback: { type: 'omit' },
  description: '2-3 sentence plan summary',
};

const planBackground: GeneratedFieldDefinition = {
  key: 'plan_background',
  authority: 'generated',
  generation_task_id: 'background',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_background',
    content_type: 'prose',
  },
  editable: true,
  required: false,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Background' },
  fallback: { type: 'omit' },
  description: '3-4 sentence background paragraph (conditional on business_context)',
};

const planMethodApproach: GeneratedFieldDefinition = {
  key: 'plan_method_approach',
  authority: 'generated',
  generation_task_id: 'method_approach',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_method_approach',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Method' },
  fallback: { type: 'omit' },
  description: '2-3 sentences describing methodology approach',
};

const planSessionFormat: GeneratedFieldDefinition = {
  key: 'plan_session_format',
  authority: 'generated',
  generation_task_id: 'session_format_detail',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_session_format',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose' },
  fallback: { type: 'omit' },
  description: '1-2 sentences on session format',
};

const planDataCollection: GeneratedFieldDefinition = {
  key: 'plan_data_collection',
  authority: 'generated',
  generation_task_id: 'data_collection_methods',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_data_collection',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose' },
  fallback: { type: 'omit' },
  description: '1-2 sentences on data collection methods',
};

const planParticipantGlance: GeneratedFieldDefinition = {
  key: 'plan_participant_glance',
  authority: 'generated',
  generation_task_id: 'participant_glance',
  data_type: 'string',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_participant_glance',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: {
    type: 'fact',
    label: 'Participants',
    derivation: 'ONE-LINE participant composition for Quick Facts',
  },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'One-line participant composition for summary table',
};

const planParticipantsProse: GeneratedFieldDefinition = {
  key: 'plan_participants_prose',
  authority: 'generated',
  generation_task_id: 'participant_composition_prose',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_participants_prose',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Participants' },
  fallback: { type: 'omit' },
  description: 'Participant requirements and bullet list',
};

const planDeliverables: GeneratedFieldDefinition = {
  key: 'plan_deliverables',
  authority: 'generated',
  generation_task_id: 'deliverables_narrative',
  data_type: 'markdown_prose',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_deliverables',
    content_type: 'prose',
  },
  editable: true,
  required: true,
  workspace: { type: 'prose', component: 'ArtifactEditor' },
  markdown: { type: 'prose', section_heading: 'Deliverables' },
  fallback: { type: 'omit' },
  description: 'Bullet list of methodology-specific deliverables',
};

const planRisks: GeneratedFieldDefinition = {
  key: 'plan_risks',
  authority: 'generated',
  generation_task_id: 'risks',
  data_type: 'structured_json',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_risks',
    content_type: 'structured_json',
  },
  editable: false,
  required: true,
  workspace: { type: 'table', columns: ['Risk', 'Likelihood', 'Mitigation'] },
  markdown: { type: 'table', columns: ['Risk', 'Likelihood', 'Mitigation'] },
  fallback: { type: 'omit' },
  description: '3 study-specific risks as JSON array',
};

const planCommitments: GeneratedFieldDefinition = {
  key: 'plan_commitments',
  authority: 'generated',
  generation_task_id: 'brief_operationalization',
  data_type: 'structured_json',
  canonical: {
    table: 'artifact_sections',
    section_key: 'plan_commitments',
    content_type: 'structured_json',
  },
  editable: false,
  required: true,
  workspace: { type: 'table', columns: ['Brief commitment', 'How this plan addresses it'] },
  markdown: { type: 'table', columns: ['Brief commitment', 'How this plan addresses it'] },
  fallback: { type: 'omit' },
  description: 'How plan addresses each brief commitment',
};

// ─── Inherited Fields (from Brief, read-only) ──────────────────────

const researchObjectives: InheritedFieldDefinition = {
  key: 'research_objectives',
  authority: 'inherited',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'research_objectives',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'research_objectives',
  },
  editable: false,
  required: true,
  workspace: { type: 'structured_rows', id_field: 'id' },
  markdown: { type: 'bullet_list', item_template: '**[{{id}}]** {{objective}}' },
  fallback: { type: 'omit' },
  description: 'Approved objectives from Brief (read-only)',
};

const researchQuestions: InheritedFieldDefinition = {
  key: 'research_questions',
  authority: 'inherited',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'research_questions',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'research_questions',
  },
  editable: false,
  required: true,
  workspace: { type: 'structured_rows', id_field: 'id' },
  markdown: { type: 'bullet_list', item_template: '**[{{id}}]** {{question}} _({{priority}})_' },
  fallback: { type: 'omit' },
  description: 'Approved research questions from Brief (read-only)',
};

const targetBarriers: InheritedFieldDefinition = {
  key: 'target_barriers',
  authority: 'inherited',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'target_barriers',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'target_barriers',
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'Target barriers from Brief (used in provenance section)',
};

const methodologySelection: InheritedFieldDefinition = {
  key: 'methodology_selection',
  authority: 'inherited',
  data_type: 'enum',
  canonical: {
    table: 'study_variables',
    variable_key: 'methodology_selection',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'methodology_selection',
  },
  editable: false,
  required: true,
  workspace: { type: 'fact', label: 'Method' },
  markdown: { type: 'metadata_row', label: 'Method' },
  fallback: { type: 'omit' },
  description: 'Approved methodology from Brief (read-only)',
};

const timelinePhases: InheritedFieldDefinition = {
  key: 'timeline_phases',
  authority: 'inherited',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'timeline_phases',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'timeline_phases',
  },
  editable: false,
  required: true,
  workspace: { type: 'table', columns: ['Phase', 'Dates', 'Duration'] },
  markdown: { type: 'table', columns: ['Phase', 'Dates', 'Duration'] },
  fallback: { type: 'omit' },
  description: 'Timeline phases from Brief (read-only)',
};

const participantApproach: InheritedFieldDefinition = {
  key: 'participant_approach',
  authority: 'inherited',
  data_type: 'string',
  canonical: {
    table: 'study_variables',
    variable_key: 'participant_approach',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'participant_approach',
  },
  editable: false,
  required: false,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'Participant approach from Brief',
};

const budgetInherited: InheritedFieldDefinition = {
  key: 'budget',
  authority: 'inherited',
  data_type: 'string',
  canonical: {
    table: 'study_variables',
    variable_key: 'budget',
    is_pool: false,
  },
  inherits_from: {
    artifact: 'brief',
    field: 'budget',
  },
  editable: false,
  required: false,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'Budget envelope from Brief',
};

// ─── User Input Fields ─────────────────────────────────────────────

const projectTitle: UserInputFieldDefinition = {
  key: 'project_title',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    table: 'research_studies',
    column: 'name',
  },
  editable: false,
  required: true,
  workspace: { type: 'system_block', label: 'Study' },
  markdown: { type: 'masthead', position: 'title' },
  fallback: { type: 'omit' },
  description: 'Study/project title',
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

const operationalRisks: UserInputFieldDefinition = {
  key: 'operational_risks',
  authority: 'user_input',
  data_type: 'string',
  canonical: {
    source: 'transient',
  },
  editable: false,
  required: false,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'Researcher-noted execution risks (input to risks task)',
};

// ─── Computed Fields ───────────────────────────────────────────────

const timelineSummary: ComputedFieldDefinition = {
  key: 'timeline_summary',
  authority: 'computed',
  data_type: 'string',
  canonical: {
    source: 'computed',
    derivation: 'buildTimelineSummary(timelinePhases)',
  },
  editable: false,
  required: true,
  workspace: { type: 'fact', label: 'Timeline' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  description: 'Computed timeline summary (e.g., "6 weeks, starting Sep 14")',
};

const perParticipantCompensation: ComputedFieldDefinition = {
  key: 'per_participant_compensation',
  authority: 'computed',
  data_type: 'number',
  canonical: {
    source: 'computed',
    derivation: 'study.parsed_budget_amount / study.target_participants',
  },
  editable: false,
  required: false,
  workspace: { type: 'hidden' },
  markdown: { type: 'prose' },
  fallback: { type: 'omit' },
  description: 'Computed per-person compensation',
};

// ─── Cascade Fields (emitted by Plan template) ─────────────────────

const studyTimeline: CascadeFieldDefinition = {
  key: 'study_timeline',
  authority: 'cascade',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'study_timeline',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  schema_ref: 'schemas/study_timeline.yaml',
  description: 'Extracted timeline phases for downstream consumption',
};

const planRisksCascade: CascadeFieldDefinition = {
  key: 'risks_cascade',
  authority: 'cascade',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'risks',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  schema_ref: 'schemas/study_risk.yaml',
  description: 'Extracted risks for downstream consumption',
};

const deliverables: CascadeFieldDefinition = {
  key: 'deliverables',
  authority: 'cascade',
  data_type: 'array',
  canonical: {
    table: 'study_variables',
    variable_key: 'deliverables',
    is_pool: false,
  },
  editable: false,
  required: true,
  workspace: { type: 'hidden' },
  markdown: { type: 'omit' },
  fallback: { type: 'omit' },
  schema_ref: 'schemas/study_deliverable.yaml',
  description: 'Extracted deliverables with addresses_objective',
};

// ─── System Fields ─────────────────────────────────────────────────

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

// ─── Unsupported Fields (Backlog #377) ─────────────────────────────

const sessionFormat: UnsupportedFieldDefinition = {
  key: 'session_format',
  authority: 'unsupported',
  data_type: 'string',
  canonical: {
    source: 'unsupported',
    reason: 'Not emitted by Brief — requires Brief YAML contract change',
    backlog_ref: '#377',
  },
  editable: false,
  required: false,
  workspace: {
    type: 'unsupported',
    reason: 'Canonical source unavailable',
  },
  markdown: {
    type: 'unsupported',
    reason: 'Canonical source unavailable',
  },
  fallback: { type: 'omit' },
  description: 'Session format (e.g., "60-min remote interview") — not yet implemented',
};

const sessionDuration: UnsupportedFieldDefinition = {
  key: 'session_duration',
  authority: 'unsupported',
  data_type: 'string',
  canonical: {
    source: 'unsupported',
    reason: 'Not emitted by Brief — requires Brief YAML contract change',
    backlog_ref: '#377',
  },
  editable: false,
  required: false,
  workspace: {
    type: 'unsupported',
    reason: 'Canonical source unavailable',
  },
  markdown: {
    type: 'unsupported',
    reason: 'Canonical source unavailable',
  },
  fallback: { type: 'omit' },
  description: 'Session duration (e.g., "60 minutes") — not yet implemented',
};

const compensation: UnsupportedFieldDefinition = {
  key: 'compensation',
  authority: 'unsupported',
  data_type: 'string',
  canonical: {
    source: 'unsupported',
    reason: 'Computed but not persisted as cascade variable',
    backlog_ref: '#377',
  },
  editable: false,
  required: false,
  workspace: {
    type: 'unsupported',
    reason: 'Canonical source unavailable',
  },
  markdown: {
    type: 'unsupported',
    reason: 'Canonical source unavailable',
  },
  fallback: { type: 'omit' },
  description: 'Participant compensation string — not yet implemented',
};

// ─── Plan Contract ─────────────────────────────────────────────────

export const PLAN_CONTRACT: ArtifactContract = {
  artifact_type: 'plan',
  template_id: 'research_plan',
  template_version: 'v7.2',
  fields: [
    // Generated fields (LLM tasks)
    planSummary,
    planBackground,
    planMethodApproach,
    planSessionFormat,
    planDataCollection,
    planParticipantGlance,
    planParticipantsProse,
    planDeliverables,
    planRisks,
    planCommitments,
    // Inherited fields (from Brief)
    researchObjectives,
    researchQuestions,
    targetBarriers,
    methodologySelection,
    timelinePhases,
    participantApproach,
    budgetInherited,
    // User input fields
    projectTitle,
    leadResearcher,
    operationalRisks,
    // Computed fields
    timelineSummary,
    perParticipantCompensation,
    // Cascade fields (emitted by Plan)
    studyTimeline,
    planRisksCascade,
    deliverables,
    // System fields
    artifactPublicId,
    contentVersion,
    templateVersion,
    // Unsupported fields (Backlog #377)
    sessionFormat,
    sessionDuration,
    compensation,
  ],
} as const;

/**
 * Plan YAML task IDs — must match config/prompts/research_plan.yaml
 */
export const PLAN_YAML_TASK_IDS = [
  'summary',
  'background',
  'method_approach',
  'session_format_detail',
  'data_collection_methods',
  'participant_glance',
  'participant_composition_prose',
  'deliverables_narrative',
  'risks',
  'brief_operationalization',
] as const;

export type PlanYamlTaskId = typeof PLAN_YAML_TASK_IDS[number];
