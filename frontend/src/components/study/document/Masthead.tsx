/**
 * Masthead — Read-only system block with study metadata.
 * Matches design: inline flex-wrap layout with key-value pairs.
 */

import styles from './document.module.css';

interface MastheadProps {
  studyName: string;
  researcherName: string | null;
  requestedBy?: string | null;
  date: string | null;
  /** Artifact status with optional version (e.g., "Current · v1") */
  status?: string | null;
}

export function Masthead({ studyName, researcherName, requestedBy, date, status }: MastheadProps) {
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className={styles.systemBlock}>
      <span className={styles.systemLabel}>READ-ONLY · SYSTEM</span>
      <div className={styles.masthead}>
        <span className={styles.mastheadItem}>
          <span className={styles.mastheadKey}>Study</span>
          <span className={styles.mastheadValue}>{studyName}</span>
        </span>
        {researcherName && (
          <span className={styles.mastheadItem}>
            <span className={styles.mastheadKey}>Researcher</span>
            <span className={styles.mastheadValue}>{researcherName}</span>
          </span>
        )}
        {requestedBy && (
          <span className={styles.mastheadItem}>
            <span className={styles.mastheadKey}>Requested by</span>
            <span className={styles.mastheadValue}>{requestedBy}</span>
          </span>
        )}
        {formattedDate && (
          <span className={styles.mastheadItem}>
            <span className={styles.mastheadKey}>Date</span>
            <span className={styles.mastheadValue}>{formattedDate}</span>
          </span>
        )}
        {status && (
          <span className={styles.mastheadItem}>
            <span className={styles.mastheadKey}>Status</span>
            <span className={styles.mastheadValue}>{status}</span>
          </span>
        )}
      </div>
    </div>
  );
}
