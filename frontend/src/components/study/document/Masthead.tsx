/**
 * Masthead — Read-only system block with study metadata.
 */

import styles from './document.module.css';

interface MastheadProps {
  studyName: string;
  researcherName: string | null;
  requestedBy?: string | null;
  date: string | null;
}

export function Masthead({ studyName, researcherName, requestedBy, date }: MastheadProps) {
  return (
    <div className={styles.systemBlock}>
      <span className={styles.systemLabel}>System</span>
      <div className={styles.masthead}>
        <div className={styles.mastheadItem}>
          <span className={styles.mastheadKey}>Study</span>
          <span className={styles.mastheadValue}>{studyName}</span>
        </div>
        {researcherName && (
          <div className={styles.mastheadItem}>
            <span className={styles.mastheadKey}>Researcher</span>
            <span className={styles.mastheadValue}>{researcherName}</span>
          </div>
        )}
        {requestedBy && (
          <div className={styles.mastheadItem}>
            <span className={styles.mastheadKey}>Requested by</span>
            <span className={styles.mastheadValue}>{requestedBy}</span>
          </div>
        )}
        {date && (
          <div className={styles.mastheadItem}>
            <span className={styles.mastheadKey}>Date</span>
            <span className={styles.mastheadValue}>
              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
