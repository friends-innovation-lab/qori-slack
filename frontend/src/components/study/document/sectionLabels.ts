/**
 * Section Labels — Mapping between backend contract keys and presentation labels.
 *
 * Maps STABLE backend section_key identifiers (from @qori/api-contracts) to
 * user-friendly display labels. Used by Comments UI for section selector and
 * thread display.
 *
 * CRITICAL: The `key` values MUST match the backend VALID_SECTION_KEYS exactly.
 * See: backend/src/types/comments.ts
 *
 * CMT-6: Initial mapping based on artifact contract fields.
 * CMT-7: Added commentable flag for section affordance rendering.
 *        Fixed key mapping to use backend contract keys, not UI presentation IDs.
 */

/**
 * Artifact type identifier.
 */
export type ArtifactType = 'brief' | 'plan';

/**
 * Section definition with stable backend key and display label.
 */
export interface SectionDefinition {
  /** Backend contract section_key (MUST match VALID_SECTION_KEYS) */
  readonly key: string;
  /** User-facing display label */
  readonly label: string;
  /** Whether this section supports comments (CMT-7). Defaults to true. */
  readonly commentable?: boolean;
}

/**
 * Brief commentable sections.
 * Keys MUST match backend VALID_SECTION_KEYS.brief exactly.
 *
 * Backend keys: descriptive_title, summary, problem_narrative, method_prose,
 *               participants_prose, out_of_scope, risks, approval_items
 *
 * Note: Some visible sections (objectives, timeline) are inherited/computed
 * and do NOT have their own backend comment key. They are excluded here.
 */
export const BRIEF_SECTIONS: readonly SectionDefinition[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'problem_narrative', label: 'Problem' },
  { key: 'method_prose', label: 'Method' },
  { key: 'participants_prose', label: 'Participants' },
  { key: 'out_of_scope', label: 'Out of scope' },
  { key: 'risks', label: 'Risks' },
] as const;

/**
 * Plan commentable sections.
 * Keys MUST match backend VALID_SECTION_KEYS.plan exactly.
 *
 * Backend keys: plan_summary, plan_background, plan_method_approach,
 *               plan_session_format, plan_data_collection, plan_participant_glance,
 *               plan_participants_prose, plan_deliverables, plan_risks, plan_commitments
 *
 * Note: Some visible sections (objectives, questions, timeline) are inherited
 * from Brief and do NOT have their own backend comment key. They are excluded here.
 */
export const PLAN_SECTIONS: readonly SectionDefinition[] = [
  { key: 'plan_summary', label: 'Summary' },
  { key: 'plan_background', label: 'Background' },
  { key: 'plan_method_approach', label: 'Method' },
  { key: 'plan_participants_prose', label: 'Participants' },
  { key: 'plan_deliverables', label: 'Deliverables' },
  { key: 'plan_risks', label: 'Risks and mitigations' },
  { key: 'plan_commitments', label: 'Brief commitments' },
] as const;

/**
 * Get sections for a given artifact type.
 */
export function getSectionsForArtifact(
  artifactType: ArtifactType,
): readonly SectionDefinition[] {
  return artifactType === 'brief' ? BRIEF_SECTIONS : PLAN_SECTIONS;
}

/**
 * Get display label for a section key.
 * Returns a safe fallback for unknown keys (orphan readiness).
 */
export function getSectionLabel(
  artifactType: ArtifactType,
  sectionKey: string,
): string {
  const sections = getSectionsForArtifact(artifactType);
  const section = sections.find((s) => s.key === sectionKey);
  return section?.label ?? 'Older section';
}

/**
 * Check if a section key is valid for the given artifact type.
 */
export function isValidSection(
  artifactType: ArtifactType,
  sectionKey: string,
): boolean {
  const sections = getSectionsForArtifact(artifactType);
  return sections.some((s) => s.key === sectionKey);
}

/**
 * Check if a section is commentable.
 * Returns true if section exists and commentable !== false.
 */
export function isCommentableSection(
  artifactType: ArtifactType,
  sectionKey: string,
): boolean {
  const sections = getSectionsForArtifact(artifactType);
  const section = sections.find((s) => s.key === sectionKey);
  // Default to true if commentable is not explicitly false
  return section ? section.commentable !== false : false;
}
