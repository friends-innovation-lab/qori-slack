/**
 * DiscoveryMarker — DISC-3 B1
 *
 * Static marker for Discovery runs/artifacts. Renders D1, S1, V1, X1.
 * Button variant added in DISC-6 for interactive marker navigation.
 *
 * Per DISCOVERY_REDLINES.md B1:
 * - One treatment for D, S, V and X. No per-type color.
 * - Accessible name: "Evidence from D1, desk research: {run name}".
 * - Pre-Ready: "—" mono 11 muted, aria-label="No marker yet".
 * - Unavailable: muted, strikethrough, never a button.
 */

import styles from './DiscoveryMarker.module.css';

interface DiscoveryMarkerProps {
  /** The marker string, e.g., "D1", "S2", "V1" */
  marker: string | null;
  /** Run/artifact name for accessible label */
  name?: string;
  /** Discovery type for accessible label */
  type?: 'desk_research' | 'stakeholder_synthesis' | 'survey_synthesis';
  /** Whether the marker target is unavailable (deleted artifact) */
  unavailable?: boolean;
}

/** Map discovery type to human-readable label */
const typeLabels: Record<string, string> = {
  desk_research: 'desk research',
  stakeholder_synthesis: 'stakeholder synthesis',
  survey_synthesis: 'survey synthesis',
};

/**
 * Static Discovery marker (DISC-3).
 * Button variant for interactive navigation added in DISC-6.
 */
export function DiscoveryMarker({
  marker,
  name,
  type,
  unavailable = false,
}: DiscoveryMarkerProps) {
  // Pre-Ready: show dash placeholder
  if (!marker) {
    return (
      <span className={styles.marker} aria-label="No marker yet">
        —
      </span>
    );
  }

  // Build accessible name
  const typeLabel = type ? typeLabels[type] : null;
  const accessibleName = name && typeLabel
    ? `Evidence from ${marker}, ${typeLabel}: ${name}`
    : marker;

  // Unavailable: muted with strikethrough
  if (unavailable) {
    return (
      <span
        className={`${styles.marker} ${styles.unavailable}`}
        aria-label={`${accessibleName}, unavailable`}
      >
        {marker}
      </span>
    );
  }

  return (
    <span className={styles.marker} aria-label={accessibleName}>
      {marker}
    </span>
  );
}

/**
 * Group of markers with proper spacing.
 */
export function DiscoveryMarkerGroup({
  children,
}: {
  children: React.ReactNode;
}) {
  return <span className={styles.group}>{children}</span>;
}
