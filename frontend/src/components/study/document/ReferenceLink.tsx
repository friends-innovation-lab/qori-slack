/**
 * ReferenceLink — Clickable Coach reference that navigates to document section.
 *
 * M3C-B: Renders as a button when clickable, static badge when not resolvable.
 *
 * Features:
 * - Uses navigation coordinator to determine clickability
 * - Accessible: native button, aria-label, keyboard activation
 * - Shows reviewed version provenance when available
 * - Never displays model-generated URLs or guessed destinations
 * - Never displays raw section_key or object_id — always uses trusted labels
 */

import type { CoachRunReferenceResource } from '@qori/api-contracts';
import { useReferenceNavigation, type ReferenceArtifactType } from '../workspace';
import { getSectionLabel, type ArtifactType as SectionArtifactType } from './sectionLabels';
import styles from './CoachingRail.module.css';

type ArtifactType = ReferenceArtifactType;

// ─── Label Resolution ───────────────────────────────────────────────────────

/** Neutral fallback for unknown reference identities */
const UNKNOWN_REFERENCE_LABEL = 'Source reference';

/**
 * Check if a string looks like a raw internal key (snake_case identifier).
 * Examples: plan_participant_glance, brief_method_prose, BRIEF-abc123:summary
 */
function looksLikeRawKey(value: string): boolean {
  // Snake_case keys: plan_foo_bar, brief_method
  if (/^(plan_|brief_)?[a-z][a-z0-9_]*$/.test(value)) return true;
  // Object IDs: BRIEF-abc123:section, PLAN-xyz:field
  if (/^(BRIEF|PLAN)-[a-zA-Z0-9]+:/.test(value)) return true;
  return false;
}

/**
 * Get human-readable display label for a reference.
 *
 * M3C-B Architecture:
 * 1. Trusted section label from sectionLabels.ts (single authority)
 * 2. reference.label IF already human-readable
 * 3. Neutral fallback for unknown identities — NEVER humanize raw keys
 *
 * Never returns raw section_key, object_id, or internal identifiers.
 */
function getDisplayLabel(
  reference: CoachRunReferenceResource,
  artifactType: ArtifactType,
): string {
  // Priority 1: Trusted label from centralized registry
  if (reference.section_key) {
    const trustedLabel = getSectionLabel(artifactType as SectionArtifactType, reference.section_key);
    // getSectionLabel returns 'Older section' for unknown keys
    if (trustedLabel !== 'Older section') {
      return trustedLabel;
    }
  }

  // Priority 2: reference.label if it doesn't look like a raw key
  if (!looksLikeRawKey(reference.label)) {
    return reference.label;
  }

  // Priority 3: Neutral fallback — never humanize raw keys
  return UNKNOWN_REFERENCE_LABEL;
}

interface ReferenceLinkProps {
  /** Reference from coach run item */
  reference: CoachRunReferenceResource;
  /** Current artifact type (brief or plan) */
  artifactType: ArtifactType;
  /** Origin coach run ID (for pinning on cross-artifact nav) */
  originCoachRunId: string;
  /** Origin study public ID */
  originStudyPublicId: string;
  /** Origin section context (null = artifact context) */
  originSection: {
    sectionKey: string;
    label: string;
  } | null;
  /** Run content version for provenance */
  runContentVersion: number;
  /** Context entries for more precise version derivation */
  contextEntries?: Array<{
    object_type: string;
    object_id: string;
    object_version: number | null;
  }>;
  /** Whether to show version provenance */
  showProvenance?: boolean;
}

export function ReferenceLink({
  reference,
  artifactType,
  originCoachRunId,
  originStudyPublicId,
  originSection,
  runContentVersion,
  contextEntries = [],
  showProvenance = false,
}: ReferenceLinkProps) {
  const {
    isReferenceClickable,
    navigateToReference,
    getReviewedVersionForReference,
  } = useReferenceNavigation();

  const clickable = isReferenceClickable(reference, artifactType);

  // Get reviewed version for provenance display
  const reviewedVersion = getReviewedVersionForReference(
    reference,
    runContentVersion,
    contextEntries,
  );

  // Derive human-readable display label
  // Priority: trusted section label lookup > smart fallback humanization
  // Never display raw section_key, object_id, or internal identifiers
  const displayLabel = getDisplayLabel(reference, artifactType);

  // Build provenance label with optional version
  const provenanceLabel =
    showProvenance && reviewedVersion != null
      ? `${displayLabel} · reviewed v${reviewedVersion}`
      : displayLabel;

  const handleClick = () => {
    if (!clickable) return;

    navigateToReference({
      reference,
      originCoachRunId,
      originArtifact: {
        type: artifactType,
        studyPublicId: originStudyPublicId,
      },
      originSection,
      reviewedVersion,
    });
  };

  if (!clickable) {
    // Non-clickable: render as static badge with human-readable label
    // For unknown references, displayLabel is already "Source reference"
    const titleText =
      displayLabel === UNKNOWN_REFERENCE_LABEL ? displayLabel : `${displayLabel} reference`;
    return (
      <span
        className={styles.resultRef}
        title={titleText}
      >
        {displayLabel}
      </span>
    );
  }

  // Clickable: render as button with accessible name
  return (
    <button
      type="button"
      className={`${styles.resultRef} ${styles.resultRefClickable}`}
      onClick={handleClick}
      aria-label={`Open ${displayLabel} section`}
      title={provenanceLabel}
    >
      {displayLabel}
    </button>
  );
}
