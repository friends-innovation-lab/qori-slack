/**
 * Section Labels — Presentation mapping for artifact sections.
 *
 * Maps stable section_key identifiers to user-friendly labels.
 * Used by Comments UI for section selector and thread display.
 *
 * CMT-6: Initial mapping based on BriefDocument and PlanDocument sections.
 * CMT-7: Added commentable flag for section affordance rendering.
 */

/**
 * Artifact type identifier.
 */
export type ArtifactType = 'brief' | 'plan';

/**
 * Section definition with stable key and display label.
 */
export interface SectionDefinition {
  readonly key: string;
  readonly label: string;
  /** Whether this section supports comments (CMT-7). Defaults to true. */
  readonly commentable?: boolean;
}

/**
 * Brief commentable sections.
 * Based on sectionId values in BriefDocument.tsx.
 */
export const BRIEF_SECTIONS: readonly SectionDefinition[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'problem', label: 'Problem' },
  { key: 'objectives', label: "What we'll learn" },
  { key: 'method', label: 'Method' },
  { key: 'participants', label: 'Participants' },
  { key: 'out-of-scope', label: 'Out of scope' },
  { key: 'risks', label: 'Risks' },
  { key: 'timeline', label: 'Timeline' },
] as const;

/**
 * Plan commentable sections.
 * Based on sectionId values in PlanDocument.tsx.
 */
export const PLAN_SECTIONS: readonly SectionDefinition[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'background', label: 'Background' },
  { key: 'objectives', label: 'Objectives' },
  { key: 'questions', label: 'Research questions' },
  { key: 'method', label: 'Method' },
  { key: 'participants', label: 'Participants' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'risks', label: 'Risks and mitigations' },
  { key: 'commitments', label: 'Brief commitments' },
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
