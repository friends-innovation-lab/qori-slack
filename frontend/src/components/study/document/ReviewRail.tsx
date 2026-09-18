/**
 * ReviewRail — Sidebar for review state, approval info, and feedback.
 * Matches design: sticky rail with approval state and future comment threads.
 */

import styles from './document.module.css';

interface ReviewRailProps {
  /** Brief approval status */
  briefStatus: 'pending_approval' | 'approved' | 'changes_requested' | null;
  /** Reviewer name */
  reviewerName?: string | null;
  /** Approval date */
  approvedAt?: string | null;
  /** Change feedback comment */
  changeFeedback?: string | null;
  /** Whether rail is in overlay mode (mobile) */
  isOverlay?: boolean;
  /** Close handler for overlay mode */
  onClose?: () => void;
}

export function ReviewRail({
  briefStatus,
  reviewerName,
  approvedAt,
  changeFeedback,
  isOverlay,
  onClose,
}: ReviewRailProps) {
  const formattedDate = approvedAt
    ? new Date(approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const railClassName = `${styles.reviewRail}${isOverlay ? ` ${styles.overlay}` : ''}`;

  return (
    <aside className={railClassName} aria-label="Review">
      <div className={styles.reviewCard}>
        <div className={styles.reviewCardHeader}>
          Review · approval gate
          {onClose && (
            <button
              className={styles.railCloseButton}
              style={{ display: 'inline-block' }}
              onClick={onClose}
            >
              Close ✕
            </button>
          )}
        </div>
        <div className={styles.reviewCardBody}>
          <div className={styles.reviewCardText}>
            {briefStatus === 'approved' && (
              <>
                <strong style={{ color: 'var(--color-success)' }}>Approved</strong>
                {reviewerName && <> by {reviewerName}</>}
                {formattedDate && <> · {formattedDate}</>}.
                {' '}The brief is now the citation source for downstream artifacts; edits after approval flag them stale.
              </>
            )}
            {briefStatus === 'pending_approval' && (
              <>
                <strong style={{ color: 'var(--color-warning)' }}>Pending approval</strong>.
                {' '}A stakeholder review is required before proceeding to the research plan.
              </>
            )}
            {briefStatus === 'changes_requested' && (
              <>
                <strong style={{ color: 'var(--color-error)' }}>Changes requested</strong>
                {reviewerName && <> by {reviewerName}</>}.
                {changeFeedback && (
                  <div style={{ borderLeft: '3px solid var(--color-error)', paddingLeft: '10px', marginTop: '8px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                    {changeFeedback}
                  </div>
                )}
              </>
            )}
            {!briefStatus && (
              <>Review state not yet determined.</>
            )}
          </div>
        </div>
      </div>
      <p className={styles.reviewRailNote}>
        Feedback anchors to sections today. Future: comment threads attach to structured IDs (OBJ / RQ / TB) and render here; ID tags in the document open their provenance in this rail.
      </p>
    </aside>
  );
}
