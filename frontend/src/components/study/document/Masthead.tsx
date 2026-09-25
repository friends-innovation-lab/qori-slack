/**
 * Masthead — Read-only system block with study metadata.
 *
 * CC-4: Extended to accept MastheadViewModel from view model (§3.7).
 * - artifactLabel: eyebrow text (e.g., "Research Plan")
 * - showStatus: whether to display versionDisplay or statusDisplay
 * - masthead: view model data (preferred over legacy props)
 */

import type { MastheadViewModel } from '@qori/artifact-contracts';
import styles from './document.module.css';

interface MastheadProps {
  /** View model masthead data (preferred) */
  masthead?: MastheadViewModel;
  /** Eyebrow label (e.g., "Research Plan", "Research Brief") */
  artifactLabel?: string;
  /** Whether to show status (uses versionDisplay or statusDisplay) */
  showStatus?: boolean;

  // Legacy props (removed in CC-5)
  studyName?: string;
  researcherName?: string | null;
  requestedBy?: string | null;
  date?: string | null;
  /** Artifact status with optional version (e.g., "Current · v1") */
  status?: string | null;
}

export function Masthead({
  masthead,
  artifactLabel,
  showStatus = false,
  // Legacy props
  studyName: legacyStudyName,
  researcherName: legacyResearcherName,
  requestedBy: legacyRequestedBy,
  date: legacyDate,
  status: legacyStatus,
}: MastheadProps) {
  // Use view model data if provided, otherwise fall back to legacy props
  const studyName = masthead?.studyName ?? legacyStudyName ?? '';
  const researcherName = masthead?.researcherName ?? legacyResearcherName;
  const requestorName = masthead?.requestorName ?? legacyRequestedBy;
  // Use pre-formatted date from view model if available
  const dateFormatted = masthead?.dateFormatted ?? (legacyDate
    ? new Date(legacyDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null);
  // Status display: versionDisplay (e.g., "Current · v2") or statusDisplay
  const statusDisplay = showStatus
    ? (masthead?.versionDisplay ?? masthead?.statusDisplay ?? legacyStatus)
    : legacyStatus;

  // Build meta items in order (only non-empty values)
  const meta: [string, string | null | undefined][] = [
    ['Researcher', researcherName],
    ['Requested by', requestorName],
    ['Date', dateFormatted],
    ['Status', statusDisplay],
  ];

  return (
    <header className={styles.masthead}>
      <h1 className={styles.mastTitle}>
        {artifactLabel && <span className={styles.mastEyebrow}>{artifactLabel}</span>}
        <span className={styles.mastName}>{studyName}</span>
      </h1>
      <span className={styles.srOnly}>READ-ONLY · SYSTEM</span>
      <dl className={styles.mastMeta}>
        {meta.filter(([, v]) => !!v).map(([k, v]) => (
          <div key={k} className={styles.mastheadItem}>
            <dt className={styles.mastheadKey}>{k}</dt>
            <dd className={styles.mastheadValue}>{v}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
