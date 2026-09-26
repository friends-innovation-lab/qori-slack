/**
 * Coaching Contract Types — Coach M2
 *
 * Defines the contract interface for artifact-type-specific coaching behavior.
 * Each contract specifies rubric, context policy, output schema, prompts, and limits.
 */

import type { CoachingReviewScope } from '../../database/models/coaching_run';

// ─── Rubric ─────────────────────────────────────────────────────────────

/**
 * A single rubric criterion for coaching evaluation.
 */
export interface RubricCriterion {
  /** Unique identifier for this criterion */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this criterion evaluates */
  description: string;
  /** Category of criterion (optional grouping) */
  category?: string;
  /** Whether this criterion applies to section reviews */
  appliesToSection: boolean;
  /** Whether this criterion applies to artifact reviews */
  appliesToArtifact: boolean;
}

// ─── Context Policy ─────────────────────────────────────────────────────

/**
 * Defines what context is included in Coach generation.
 */
export interface ContextPolicy {
  /** Maximum context budget in tokens */
  maxContextTokens: number;
  /** Required context entries (always included) */
  requiredContext: ContextEntrySpec[];
  /** Supporting context entries (included if budget allows, in priority order) */
  supportingContext: ContextEntrySpec[];
  /** Whether truncation is allowed for large sections */
  allowTruncation: boolean;
  /** Maximum tokens per individual context entry (before truncation) */
  maxTokensPerEntry: number;
}

/**
 * Specification for a context entry.
 */
export interface ContextEntrySpec {
  /** Object type (e.g., 'artifact_section', 'artifact') */
  objectType: string;
  /** Section key filter (if applicable) */
  sectionKey?: string | null;
  /** Whether this entry is citation-eligible */
  citationEligible: boolean;
  /** Priority for budget allocation (lower = higher priority) */
  priority: number;
}

// ─── Output Schema ──────────────────────────────────────────────────────

/**
 * Output schema definition.
 */
export interface OutputSchema {
  /** Maximum items per category (strength, issue, suggestion, question) */
  maxItemsPerCategory: number;
  /** Minimum items per category (do not fill quotas) */
  minItemsPerCategory: number;
  /** Maximum text length per item */
  maxItemTextLength: number;
  /** Maximum references per item */
  maxReferencesPerItem: number;
  /** Categories enabled for this contract */
  enabledCategories: Array<'strength' | 'issue' | 'suggestion' | 'question'>;
}

// ─── Model Configuration ────────────────────────────────────────────────

/**
 * Model configuration for generation.
 */
export interface ModelConfig {
  /** Model tier (haiku, sonnet, opus) */
  tier: 'haiku' | 'sonnet' | 'opus';
  /** Temperature for generation */
  temperature: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Provider timeout in milliseconds */
  timeoutMs: number;
}

// ─── Section Metadata ───────────────────────────────────────────────────

/**
 * Metadata for a valid section key.
 */
export interface SectionMetadata {
  /** Section key identifier */
  key: string;
  /** Human-readable display name */
  displayName: string;
  /** Whether this section is coachable */
  coachable: boolean;
}

// ─── Coaching Contract ──────────────────────────────────────────────────

/**
 * Complete coaching contract definition for an artifact type.
 */
export interface CoachingContract {
  /** Artifact type this contract applies to */
  artifactType: string;
  /** Contract version (semver) */
  contractVersion: string;
  /** Prompt template version */
  promptTemplateVersion: string;

  // Rubric
  /** Evaluation criteria */
  rubric: RubricCriterion[];

  // Context
  /** Context selection policy */
  contextPolicy: ContextPolicy;

  // Output
  /** Output schema constraints */
  outputSchema: OutputSchema;

  // Model
  /** Model configuration */
  modelConfig: ModelConfig;

  // Repair
  /** Maximum repair attempts for invalid output */
  maxRepairAttempts: number;

  // Section Support
  /** Valid section keys for this artifact type */
  sections: SectionMetadata[];

  /**
   * Get system prompt for Coach generation.
   */
  getSystemPrompt(scope: CoachingReviewScope, sectionKey: string | null): string;

  /**
   * Get user prompt template for Coach generation.
   * Variables: {{artifact_context}}, {{selected_section}}, {{ref_handles}}
   */
  getUserPromptTemplate(scope: CoachingReviewScope, sectionKey: string | null): string;

  /**
   * Get repair prompt to fix invalid output.
   */
  getRepairPrompt(validationErrors: string[]): string;

  /**
   * Check if a section key is valid for this artifact type.
   */
  isValidSectionKey(sectionKey: string): boolean;

  /**
   * Get the display name for a section key.
   */
  getSectionDisplayName(sectionKey: string): string | null;
}

// ─── Citation Handle ────────────────────────────────────────────────────

/**
 * A citation handle assigned to a context entry.
 */
export interface CitationHandle {
  /** Opaque handle (e.g., "REF-001") */
  handle: string;
  /** Object type */
  objectType: string;
  /** Object ID */
  objectId: string;
  /** Object version (if applicable) */
  objectVersion: number | null;
  /** Section key (if applicable) */
  sectionKey: string | null;
  /** Authoritative label from Qori metadata */
  label: string;
}
