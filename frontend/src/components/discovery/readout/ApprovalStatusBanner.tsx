/**
 * ApprovalStatusBanner — Approval and staleness status display
 *
 * DR-6b-4e-F1 Scope F: Evidence staleness display
 * - Shows outOfDateSince and outOfDateReason when evidence is stale
 * - Shows current approval status with approved version
 * - Indicates draft vs approval coexistence state
 */

import { AlertTriangle, CheckCircle, Clock, FileEdit, Info } from 'lucide-react';
import styles from './readout.module.css';

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 */
function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

interface ApprovalStatusBannerProps {
  /** ISO timestamp when evidence became stale, null if fresh */
  outOfDateSince: string | null;
  /** Human-readable reason for staleness */
  outOfDateReason: string | null;
  /** ISO timestamp of most recent approval, null if never approved */
  approvedAt: string | null;
  /** Version number of most recent approval */
  approvedVersion: number | null;
  /** Current draft content version */
  draftContentVersion: number;
  /** Version number from which latest approval was created */
  sourceDraftContentVersion?: number;
  /** Whether user can review/edit */
  canEdit: boolean;
  /** Callback to open approval history */
  onViewHistory?: () => void;
  /** Callback to start editing draft */
  onEditDraft?: () => void;
}

export function ApprovalStatusBanner({
  outOfDateSince,
  outOfDateReason,
  approvedAt,
  approvedVersion,
  draftContentVersion,
  sourceDraftContentVersion,
  canEdit,
  onViewHistory,
  onEditDraft,
}: ApprovalStatusBannerProps) {
  const isApproved = approvedAt !== null;
  const isStale = outOfDateSince !== null;

  // Check if draft has diverged from latest approval
  // Draft diverges when draft.contentVersion > approval.sourceDraftContentVersion
  const hasDraftChanges =
    sourceDraftContentVersion !== undefined && draftContentVersion > sourceDraftContentVersion;

  return (
    <div className={styles.statusBanner}>
      {/* Staleness Warning */}
      {isStale && (
        <div className={styles.staleBanner}>
          <div className={styles.staleBannerIcon}>
            <AlertTriangle size={18} />
          </div>
          <div className={styles.staleBannerContent}>
            <strong>Evidence may be outdated</strong>
            <p>
              {outOfDateReason ||
                `Some cited evidence has been updated since ${formatTimeAgo(outOfDateSince)}`}
            </p>
          </div>
        </div>
      )}

      {/* Approval Status */}
      <div className={styles.approvalStatusRow}>
        {isApproved ? (
          <div className={styles.approvalStatusApproved}>
            <CheckCircle size={16} />
            <span>
              Approved (v{approvedVersion}){' '}
              <span className={styles.approvalStatusTime}>
                {formatTimeAgo(approvedAt)}
              </span>
            </span>
            {onViewHistory && (
              <button
                type="button"
                className={styles.statusActionLink}
                onClick={onViewHistory}
              >
                View history
              </button>
            )}
          </div>
        ) : (
          <div className={styles.approvalStatusPending}>
            <Clock size={16} />
            <span>Not yet approved</span>
          </div>
        )}
      </div>

      {/* Draft/Approval Coexistence Notice (Scope D) */}
      {isApproved && hasDraftChanges && (
        <div className={styles.draftCoexistenceBanner}>
          <div className={styles.draftCoexistenceIcon}>
            <FileEdit size={16} />
          </div>
          <div className={styles.draftCoexistenceContent}>
            <strong>Draft has unpublished changes</strong>
            <p>
              The draft contains edits made after the last approval. A new approval will capture
              these changes.
            </p>
          </div>
          {canEdit && onEditDraft && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEditDraft}>
              Edit Draft
            </button>
          )}
        </div>
      )}

      {/* Research Brief Handoff Notice (brief version for banner) */}
      {isApproved && !isStale && !hasDraftChanges && (
        <div className={styles.handoffNoticeBrief}>
          <Info size={14} />
          <span>This approved readout can be cited in Research Briefs.</span>
        </div>
      )}
    </div>
  );
}
