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
 */

import type { CoachRunReferenceResource } from '@qori/api-contracts';
import { useReferenceNavigation, type ReferenceArtifactType } from '../workspace';
import styles from './CoachingRail.module.css';

type ArtifactType = ReferenceArtifactType;

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

  // Build label with optional version provenance
  const label = reference.label;
  const provenanceLabel =
    showProvenance && reviewedVersion != null
      ? `${label} · reviewed v${reviewedVersion}`
      : label;

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
    // Non-clickable: render as static badge
    return (
      <span className={styles.resultRef} title={provenanceLabel}>
        {label}
      </span>
    );
  }

  // Clickable: render as button
  return (
    <button
      type="button"
      className={`${styles.resultRef} ${styles.resultRefClickable}`}
      onClick={handleClick}
      aria-label={`Jump to ${label} in document`}
      title={provenanceLabel}
    >
      {label}
    </button>
  );
}
