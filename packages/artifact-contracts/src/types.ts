/**
 * Artifact Contract Types
 *
 * Contracts define field metadata for Brief and Plan artifacts:
 * - field identity
 * - type
 * - canonical location
 * - authority (who/what is authoritative)
 * - editability
 * - generation mapping (for LLM-generated fields)
 * - projection behavior (Workspace and Markdown)
 * - fallback behavior
 *
 * Contracts are METADATA, not state. They do NOT contain research content.
 * Canonical state remains in: artifact_sections, study_variables, research_studies, research_artifacts.
 */

// ─── Artifact Types ────────────────────────────────────────────────

export type ArtifactType = 'brief' | 'plan';

// ─── Field Data Types ──────────────────────────────────────────────

export type FieldDataType =
  | 'string'
  | 'number'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'structured_json'
  | 'markdown_prose';

// ─── Canonical Storage Locations ───────────────────────────────────

/**
 * Canonical source for artifact section content (prose or structured JSON)
 */
export interface ArtifactSectionSource {
  readonly table: 'artifact_sections';
  readonly section_key: string;
  readonly content_type: 'prose' | 'structured_json';
}

/**
 * Canonical source for cascade variables
 */
export interface StudyVariableSource {
  readonly table: 'study_variables';
  readonly variable_key: string;
  readonly is_pool: boolean;
}

/**
 * Canonical source for study lifecycle state
 */
export interface ResearchStudySource {
  readonly table: 'research_studies';
  readonly column: string;
}

/**
 * Canonical source for artifact identity/metadata
 */
export interface ResearchArtifactSource {
  readonly table: 'research_artifacts';
  readonly column: string;
}

/**
 * Computed value with no persisted canonical source
 */
export interface ComputedSource {
  readonly source: 'computed';
  readonly derivation: string;
}

/**
 * Transient value — never persisted, template-only
 */
export interface TransientSource {
  readonly source: 'transient';
}

/**
 * Unsupported field — canonical source not yet implemented
 */
export interface UnsupportedSource {
  readonly source: 'unsupported';
  readonly reason: string;
  readonly backlog_ref?: string;
}

export type CanonicalSource =
  | ArtifactSectionSource
  | StudyVariableSource
  | ResearchStudySource
  | ResearchArtifactSource
  | ComputedSource
  | TransientSource
  | UnsupportedSource;

// ─── Workspace Projection ──────────────────────────────────────────

export interface ProseWorkspaceProjection {
  readonly type: 'prose';
  readonly component: 'MarkdownDisplay' | 'ArtifactEditor';
}

export interface FactWorkspaceProjection {
  readonly type: 'fact';
  readonly label: string;
  readonly derivation?: string;
}

export interface TableWorkspaceProjection {
  readonly type: 'table';
  readonly columns: readonly string[];
}

export interface StructuredRowsWorkspaceProjection {
  readonly type: 'structured_rows';
  readonly id_field: string;
}

export interface SystemBlockWorkspaceProjection {
  readonly type: 'system_block';
  readonly label: string;
}

export interface HiddenWorkspaceProjection {
  readonly type: 'hidden';
}

export interface UnsupportedWorkspaceProjection {
  readonly type: 'unsupported';
  readonly reason: string;
}

export type WorkspaceProjection =
  | ProseWorkspaceProjection
  | FactWorkspaceProjection
  | TableWorkspaceProjection
  | StructuredRowsWorkspaceProjection
  | SystemBlockWorkspaceProjection
  | HiddenWorkspaceProjection
  | UnsupportedWorkspaceProjection;

// ─── Markdown Projection ───────────────────────────────────────────

export interface ProseMarkdownProjection {
  readonly type: 'prose';
  readonly section_heading?: string;
}

export interface TableMarkdownProjection {
  readonly type: 'table';
  readonly columns: readonly string[];
}

export interface BulletListMarkdownProjection {
  readonly type: 'bullet_list';
  readonly item_template: string;
}

export interface MetadataRowMarkdownProjection {
  readonly type: 'metadata_row';
  readonly label: string;
}

export interface MastheadMarkdownProjection {
  readonly type: 'masthead';
  readonly position: 'title' | 'subtitle' | 'date' | 'status';
}

export interface OmitMarkdownProjection {
  readonly type: 'omit';
}

export interface UnsupportedMarkdownProjection {
  readonly type: 'unsupported';
  readonly reason: string;
}

export type MarkdownProjection =
  | ProseMarkdownProjection
  | TableMarkdownProjection
  | BulletListMarkdownProjection
  | MetadataRowMarkdownProjection
  | MastheadMarkdownProjection
  | OmitMarkdownProjection
  | UnsupportedMarkdownProjection;

// ─── Fallback Behavior ─────────────────────────────────────────────

export type FallbackBehavior =
  | { readonly type: 'omit' }
  | { readonly type: 'empty_string' }
  | { readonly type: 'null' }
  | { readonly type: 'default'; readonly value: unknown };

// ─── Field Definition Base ─────────────────────────────────────────

interface FieldDefinitionBase {
  readonly key: string;
  readonly data_type: FieldDataType;
  readonly editable: boolean;
  readonly required: boolean;
  readonly workspace: WorkspaceProjection;
  readonly markdown: MarkdownProjection;
  readonly fallback: FallbackBehavior;
  readonly description?: string;
}

// ─── Discriminated Union: Field Definition Types ───────────────────

/**
 * Field generated by LLM task in YAML template
 */
export interface GeneratedFieldDefinition extends FieldDefinitionBase {
  readonly authority: 'generated';
  readonly generation_task_id: string;
  readonly canonical: ArtifactSectionSource;
}

/**
 * Field inherited from upstream artifact (e.g., Plan inherits Brief objectives)
 */
export interface InheritedFieldDefinition extends FieldDefinitionBase {
  readonly authority: 'inherited';
  readonly canonical: StudyVariableSource;
  readonly inherits_from: {
    readonly artifact: ArtifactType;
    readonly field: string;
  };
}

/**
 * Field with value computed deterministically (not LLM)
 */
export interface ComputedFieldDefinition extends FieldDefinitionBase {
  readonly authority: 'computed';
  readonly canonical: ComputedSource | StudyVariableSource;
}

/**
 * Field with value from user input (modal form)
 */
export interface UserInputFieldDefinition extends FieldDefinitionBase {
  readonly authority: 'user_input';
  readonly canonical: StudyVariableSource | ResearchStudySource | TransientSource;
}

/**
 * Field with value assigned by system (timestamps, IDs, statuses)
 */
export interface SystemFieldDefinition extends FieldDefinitionBase {
  readonly authority: 'system';
  readonly canonical: ResearchStudySource | ResearchArtifactSource;
}

/**
 * Field with value from cascade extraction (emitted by template)
 */
export interface CascadeFieldDefinition extends FieldDefinitionBase {
  readonly authority: 'cascade';
  readonly canonical: StudyVariableSource;
  readonly schema_ref?: string;
}

/**
 * Unsupported field — documented gap, not yet implemented
 */
export interface UnsupportedFieldDefinition extends FieldDefinitionBase {
  readonly authority: 'unsupported';
  readonly canonical: UnsupportedSource;
}

/**
 * Discriminated union of all field definition types
 */
export type ArtifactFieldDefinition =
  | GeneratedFieldDefinition
  | InheritedFieldDefinition
  | ComputedFieldDefinition
  | UserInputFieldDefinition
  | SystemFieldDefinition
  | CascadeFieldDefinition
  | UnsupportedFieldDefinition;

// ─── Contract Definition ───────────────────────────────────────────

/**
 * Complete artifact contract — metadata describing all fields
 */
export interface ArtifactContract {
  readonly artifact_type: ArtifactType;
  readonly template_id: string;
  readonly template_version: string;
  readonly fields: readonly ArtifactFieldDefinition[];
}

// ─── Type Guards ───────────────────────────────────────────────────

export function isGeneratedField(field: ArtifactFieldDefinition): field is GeneratedFieldDefinition {
  return field.authority === 'generated';
}

export function isInheritedField(field: ArtifactFieldDefinition): field is InheritedFieldDefinition {
  return field.authority === 'inherited';
}

export function isComputedField(field: ArtifactFieldDefinition): field is ComputedFieldDefinition {
  return field.authority === 'computed';
}

export function isUserInputField(field: ArtifactFieldDefinition): field is UserInputFieldDefinition {
  return field.authority === 'user_input';
}

export function isSystemField(field: ArtifactFieldDefinition): field is SystemFieldDefinition {
  return field.authority === 'system';
}

export function isCascadeField(field: ArtifactFieldDefinition): field is CascadeFieldDefinition {
  return field.authority === 'cascade';
}

export function isUnsupportedField(field: ArtifactFieldDefinition): field is UnsupportedFieldDefinition {
  return field.authority === 'unsupported';
}

// ─── Utility Functions ─────────────────────────────────────────────

/**
 * Get all generated fields from a contract (fields with LLM task IDs)
 */
export function getGeneratedFields(contract: ArtifactContract): GeneratedFieldDefinition[] {
  return contract.fields.filter(isGeneratedField);
}

/**
 * Get all task IDs declared in a contract
 */
export function getContractTaskIds(contract: ArtifactContract): string[] {
  return getGeneratedFields(contract).map(f => f.generation_task_id);
}

/**
 * Get editable fields from a contract
 */
export function getEditableFields(contract: ArtifactContract): ArtifactFieldDefinition[] {
  return contract.fields.filter(f => f.editable);
}

/**
 * Get unsupported fields (documented gaps)
 */
export function getUnsupportedFields(contract: ArtifactContract): UnsupportedFieldDefinition[] {
  return contract.fields.filter(isUnsupportedField);
}

/**
 * Build task_id → section_key mapping for generation extraction
 */
export function buildTaskToSectionMap(contract: ArtifactContract): Map<string, string> {
  const map = new Map<string, string>();
  for (const field of getGeneratedFields(contract)) {
    map.set(field.generation_task_id, field.canonical.section_key);
  }
  return map;
}
