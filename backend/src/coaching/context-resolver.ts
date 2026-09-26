/**
 * Coach Context Resolver — Coach M2
 *
 * Resolves context for Coach generation. Builds the immutable context payload
 * and assigns citation handles (REF-001, REF-002, etc.) to eligible entries.
 *
 * Key responsibilities:
 * - Load artifact at exact content_version (not latest)
 * - Apply context policy (required vs supporting)
 * - Deterministic selection and ordering
 * - Token budget management
 * - Citation handle assignment
 * - Context manifest preparation for persistence
 */

import type { CoachingContract, CitationHandle, ContextPolicy } from './contracts/types';
import type { CoachingReviewScope } from '../database/models/coaching_run';
import type { RecordCoachingContextInput } from '../application/coaching.app-service';
import type { ResearchArtifact } from '../database/models/research_artifact';
import type { ArtifactSection } from '../database/models/artifact_section';
import sequelize from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Resolved context for Coach generation.
 */
export interface ResolvedContext {
  /** Formatted artifact context for prompt */
  artifactContext: string;
  /** Formatted section content for section-scoped reviews */
  sectionContent: string | null;
  /** Formatted reference handles for prompt */
  refHandlesText: string;
  /** Citation handle lookup map (handle -> metadata) */
  citationHandles: Map<string, CitationHandle>;
  /** Context manifest entries for persistence */
  manifestEntries: RecordCoachingContextInput[];
  /** Actual content version used */
  contentVersion: number;
}

/**
 * Context resolution error.
 */
export class ContextResolutionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ContextResolutionError';
  }
}

// ─── Model References ───────────────────────────────────────────────────

const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
const SectionModel = sequelize.models.ArtifactSection as typeof ArtifactSection;

// ─── Token Estimation ───────────────────────────────────────────────────

/**
 * Rough token estimation (characters / 4).
 * Conservative estimate for English text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Context Resolution ─────────────────────────────────────────────────

/**
 * Resolve context for a coaching run.
 *
 * @param artifactId - Artifact internal ID
 * @param contentVersion - Exact content version to resolve (from run creation)
 * @param scope - Review scope (artifact or section)
 * @param selectedSectionKey - Section key for section-scoped reviews
 * @param contract - Coaching contract with context policy
 * @returns Resolved context with citation handles and manifest
 * @throws ContextResolutionError if artifact/version not found
 */
export async function resolveContext(
  artifactId: number,
  contentVersion: number,
  scope: CoachingReviewScope,
  selectedSectionKey: string | null,
  contract: CoachingContract,
): Promise<ResolvedContext> {
  // 1. Load artifact
  const artifact = await ArtifactModel.findByPk(artifactId) as ResearchArtifact | null;
  if (!artifact) {
    throw new ContextResolutionError(
      `Artifact ${artifactId} not found`,
      'ARTIFACT_NOT_FOUND'
    );
  }

  // 2. Verify content version matches
  // NOTE: Current architecture stores only current version in artifact_sections.
  // If artifact has advanced beyond run's content_version, we cannot retrieve historical.
  // This is an architecture gap that should be reported.
  if (artifact.content_version !== contentVersion) {
    throw new ContextResolutionError(
      `Artifact version mismatch: run expects v${contentVersion}, artifact is at v${artifact.content_version}. ` +
      `Historical version retrieval is not supported — artifact content may have changed since run creation.`,
      'VERSION_MISMATCH'
    );
  }

  // 3. Load artifact sections
  const sections = await SectionModel.findAll({
    where: { artifact_id: artifactId },
    order: [['section_key', 'ASC']], // Deterministic ordering
  }) as ArtifactSection[];

  // 4. Build context entries with citation handles
  const citationHandles = new Map<string, CitationHandle>();
  const manifestEntries: RecordCoachingContextInput[] = [];
  let handleCounter = 1;

  // Helper to assign citation handle
  const assignHandle = (
    objectType: string,
    objectId: string,
    objectVersion: number | null,
    sectionKey: string | null,
    label: string,
  ): string => {
    const handle = `REF-${String(handleCounter).padStart(3, '0')}`;
    handleCounter++;

    citationHandles.set(handle, {
      handle,
      objectType,
      objectId,
      objectVersion,
      sectionKey,
      label,
    });

    return handle;
  };

  // 5. Build artifact context
  const contextParts: string[] = [];
  const policy = contract.contextPolicy;
  let totalTokens = 0;

  // Add artifact-level context
  const artifactHandle = assignHandle(
    'artifact',
    artifact.public_id,
    contentVersion,
    null,
    artifact.title || `${artifact.artifact_type} artifact`,
  );

  manifestEntries.push({
    object_type: 'artifact',
    object_id: artifact.public_id,
    object_version: contentVersion,
    section_key: null,
    context_role: 'primary',
    position: 0,
  });

  // Build artifact header
  contextParts.push(`# ${artifact.title || `${artifact.artifact_type.charAt(0).toUpperCase()}${artifact.artifact_type.slice(1)}`}`);
  contextParts.push(`[${artifactHandle}] Artifact: ${artifact.artifact_type}, Version: ${contentVersion}`);
  contextParts.push('');

  // 6. Add sections with deterministic ordering
  const sortedSections = [...sections].sort((a, b) => {
    // Use contract section order if available
    const aIdx = contract.sections.findIndex(s => s.key === a.section_key);
    const bIdx = contract.sections.findIndex(s => s.key === b.section_key);
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return a.section_key.localeCompare(b.section_key);
  });

  let selectedSectionContent: string | null = null;
  let position = 1;

  for (const section of sortedSections) {
    const sectionMeta = contract.sections.find(s => s.key === section.section_key);
    const displayName = sectionMeta?.displayName || section.section_key;
    const content = section.content || '';

    // Estimate tokens
    const sectionTokens = estimateTokens(content);

    // Check budget
    if (totalTokens + sectionTokens > policy.maxContextTokens) {
      if (policy.allowTruncation) {
        // Truncate to fit
        const remainingBudget = policy.maxContextTokens - totalTokens;
        const truncatedLength = Math.max(0, remainingBudget * 4 - 100); // Leave room for truncation notice
        const truncatedContent = content.substring(0, truncatedLength) + '\n[...truncated for length]';

        // Still add with truncation
        const sectionHandle = assignHandle(
          'artifact_section',
          `${artifact.public_id}:${section.section_key}`,
          contentVersion,
          section.section_key,
          displayName,
        );

        contextParts.push(`## ${displayName}`);
        contextParts.push(`[${sectionHandle}]`);
        contextParts.push(truncatedContent);
        contextParts.push('');

        manifestEntries.push({
          object_type: 'artifact_section',
          object_id: `${artifact.public_id}:${section.section_key}`,
          object_version: contentVersion,
          section_key: section.section_key,
          context_role: selectedSectionKey === section.section_key ? 'primary' : 'supporting',
          position: position++,
        });

        totalTokens = policy.maxContextTokens;
        break;
      } else {
        // Skip this section
        continue;
      }
    }

    // Add full section
    const sectionHandle = assignHandle(
      'artifact_section',
      `${artifact.public_id}:${section.section_key}`,
      contentVersion,
      section.section_key,
      displayName,
    );

    contextParts.push(`## ${displayName}`);
    contextParts.push(`[${sectionHandle}]`);
    contextParts.push(content);
    contextParts.push('');

    manifestEntries.push({
      object_type: 'artifact_section',
      object_id: `${artifact.public_id}:${section.section_key}`,
      object_version: contentVersion,
      section_key: section.section_key,
      context_role: selectedSectionKey === section.section_key ? 'primary' : 'supporting',
      position: position++,
    });

    // Track selected section content for section-scoped reviews
    if (selectedSectionKey === section.section_key) {
      selectedSectionContent = content;
    }

    totalTokens += sectionTokens;
  }

  // 7. Build reference handles text for prompt
  const refHandlesLines: string[] = ['The following references are available for citation:'];
  for (const [handle, info] of citationHandles) {
    refHandlesLines.push(`- ${handle}: ${info.label}`);
  }
  const refHandlesText = refHandlesLines.join('\n');

  // 8. Validate section-scoped review has selected section
  if (scope === 'section' && selectedSectionKey && !selectedSectionContent) {
    throw new ContextResolutionError(
      `Selected section '${selectedSectionKey}' not found in artifact`,
      'SECTION_NOT_FOUND'
    );
  }

  return {
    artifactContext: contextParts.join('\n'),
    sectionContent: selectedSectionContent,
    refHandlesText,
    citationHandles,
    manifestEntries,
    contentVersion,
  };
}

/**
 * Resolve a citation handle to its authoritative metadata.
 *
 * @param handle - The citation handle (e.g., "REF-001")
 * @param citationHandles - Map of handles to metadata
 * @returns Citation metadata, or null if handle not found
 */
export function resolveCitationHandle(
  handle: string,
  citationHandles: Map<string, CitationHandle>,
): CitationHandle | null {
  return citationHandles.get(handle) ?? null;
}

/**
 * Validate that all citation handles in a list are known.
 *
 * @param handles - List of handles to validate
 * @param citationHandles - Map of valid handles
 * @returns List of unknown handles (empty if all valid)
 */
export function validateCitationHandles(
  handles: string[],
  citationHandles: Map<string, CitationHandle>,
): string[] {
  return handles.filter(h => !citationHandles.has(h));
}
