/**
 * Coach Context Resolver — Coach M2
 *
 * Resolves context for Coach generation. Builds the immutable context payload
 * and assigns citation handles (REF-001, REF-002, etc.) to eligible entries.
 *
 * Key responsibilities:
 * - Load immutable snapshot content (not current artifact)
 * - Apply context policy (required vs supporting)
 * - Deterministic selection and ordering
 * - Token budget management
 * - Citation handle assignment
 * - Context manifest preparation for persistence
 *
 * Coach M2 Architecture:
 * Context is resolved from the immutable snapshot captured at run creation,
 * NOT from current artifact content. This ensures the Coach reviews exactly
 * what the researcher requested, even if the artifact was edited before
 * execution.
 */

import type { CoachingContract, CitationHandle, ContextPolicy } from './contracts/types';
import type { CoachingReviewScope } from '../database/models/coaching_run';
import type { RecordCoachingContextInput } from '../application/coaching.app-service';
import type { CoachingRunSnapshot, CanonicalSnapshotContent } from '../database/models/coaching_run_snapshot';
import type { ResearchArtifact } from '../database/models/research_artifact';
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

const SnapshotModel = sequelize.models.CoachingRunSnapshot as typeof CoachingRunSnapshot;
const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

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
 * Resolve context for a coaching run using immutable snapshot.
 *
 * Coach M2: Uses the immutable snapshot captured at run creation time,
 * NOT current artifact content. This ensures execution is deterministic
 * regardless of when the worker processes the run.
 *
 * @param runId - Run ID to resolve context for
 * @param artifactId - Artifact internal ID (for manifest metadata)
 * @param contentVersion - Content version from run (for manifest metadata)
 * @param scope - Review scope (artifact or section)
 * @param selectedSectionKey - Section key for section-scoped reviews
 * @param contract - Coaching contract with context policy
 * @returns Resolved context with citation handles and manifest
 * @throws ContextResolutionError if snapshot not found
 */
export async function resolveContext(
  runId: string,
  artifactId: number,
  contentVersion: number,
  scope: CoachingReviewScope,
  selectedSectionKey: string | null,
  contract: CoachingContract,
): Promise<ResolvedContext> {
  // 1. Load immutable snapshot (authoritative for execution)
  const snapshot = await SnapshotModel.findOne({
    where: { run_id: runId },
  }) as CoachingRunSnapshot | null;

  if (!snapshot) {
    throw new ContextResolutionError(
      `Snapshot not found for run ${runId}. This run may have been created before M2 snapshot support.`,
      'SNAPSHOT_NOT_FOUND'
    );
  }

  // 2. Load artifact for identity metadata (public_id, title fallback)
  const artifact = await ArtifactModel.findByPk(artifactId) as ResearchArtifact | null;
  if (!artifact) {
    throw new ContextResolutionError(
      `Artifact ${artifactId} not found`,
      'ARTIFACT_NOT_FOUND'
    );
  }

  // 3. Extract snapshot content
  const snapshotContent = snapshot.canonical_snapshot_json as CanonicalSnapshotContent;

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

  // 5. Build artifact context from snapshot
  const contextParts: string[] = [];
  const policy = contract.contextPolicy;
  let totalTokens = 0;

  // Use snapshot title, fallback to current artifact title or type
  const artifactTitle = snapshotContent.title || artifact.title || `${snapshot.artifact_type} artifact`;

  // Add artifact-level context
  const artifactHandle = assignHandle(
    'artifact',
    snapshot.artifact_public_id,
    snapshot.content_version,
    null,
    artifactTitle,
  );

  manifestEntries.push({
    object_type: 'artifact',
    object_id: snapshot.artifact_public_id,
    object_version: snapshot.content_version,
    section_key: null,
    context_role: 'primary',
    position: 0,
  });

  // Build artifact header
  contextParts.push(`# ${artifactTitle}`);
  contextParts.push(`[${artifactHandle}] Artifact: ${snapshot.artifact_type}, Version: ${snapshot.content_version}`);
  contextParts.push('');

  // 6. Add sections from snapshot with deterministic ordering
  // Convert snapshot sections object to array for sorting
  const sectionEntries = Object.entries(snapshotContent.sections).map(([key, data]) => ({
    section_key: key,
    content: data.content,
    content_type: data.content_type,
  }));

  const sortedSections = sectionEntries.sort((a, b) => {
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
          `${snapshot.artifact_public_id}:${section.section_key}`,
          snapshot.content_version,
          section.section_key,
          displayName,
        );

        contextParts.push(`## ${displayName}`);
        contextParts.push(`[${sectionHandle}]`);
        contextParts.push(truncatedContent);
        contextParts.push('');

        manifestEntries.push({
          object_type: 'artifact_section',
          object_id: `${snapshot.artifact_public_id}:${section.section_key}`,
          object_version: snapshot.content_version,
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
      `${snapshot.artifact_public_id}:${section.section_key}`,
      snapshot.content_version,
      section.section_key,
      displayName,
    );

    contextParts.push(`## ${displayName}`);
    contextParts.push(`[${sectionHandle}]`);
    contextParts.push(content);
    contextParts.push('');

    manifestEntries.push({
      object_type: 'artifact_section',
      object_id: `${snapshot.artifact_public_id}:${section.section_key}`,
      object_version: snapshot.content_version,
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
      `Selected section '${selectedSectionKey}' not found in snapshot`,
      'SECTION_NOT_FOUND'
    );
  }

  return {
    artifactContext: contextParts.join('\n'),
    sectionContent: selectedSectionContent,
    refHandlesText,
    citationHandles,
    manifestEntries,
    contentVersion: snapshot.content_version,
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
