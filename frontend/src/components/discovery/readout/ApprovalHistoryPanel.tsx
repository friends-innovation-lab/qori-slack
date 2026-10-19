/**
 * ApprovalHistoryPanel — Historical snapshot viewing
 *
 * DR-6b-4e-F1 Scope E: Approval history with historical snapshot viewing
 * - Lists all approvals for a readout
 * - Allows viewing historical snapshots (read-only)
 * - Shows approval metadata (date, actor, note)
 */

import { useState, useCallback } from 'react';
import { History, ChevronRight, X, Clock, User, FileText } from 'lucide-react';
import type { ApprovalDetail } from '@/api/readouts';
import { ApprovedViewSnapshot } from './ApprovedViewSnapshot';
import styles from './readout.module.css';

/**
 * Format a date as a human-readable string
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface ApprovalHistoryPanelProps {
  /** List of approval records, newest first */
  approvals: ApprovalDetail[];
  /** Whether the history is loading */
  isLoading?: boolean;
  /** Error loading history */
  error?: string | null;
  /** Callback when panel is closed */
  onClose: () => void;
}

export function ApprovalHistoryPanel({
  approvals,
  isLoading,
  error,
  onClose,
}: ApprovalHistoryPanelProps) {
  // Selected approval for detailed view (null = list view)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalDetail | null>(null);

  const handleSelectApproval = useCallback((approval: ApprovalDetail) => {
    setSelectedApproval(approval);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedApproval(null);
  }, []);

  return (
    <div className={styles.historyPanel}>
      {/* Panel Header */}
      <div className={styles.historyHeader}>
        <div className={styles.historyHeaderLeft}>
          {selectedApproval ? (
            <button
              type="button"
              className={styles.historyBackButton}
              onClick={handleBackToList}
              aria-label="Back to approval list"
            >
              <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              Back
            </button>
          ) : (
            <div className={styles.historyTitle}>
              <History size={18} />
              <h2>Approval History</h2>
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.historyCloseButton}
          onClick={onClose}
          aria-label="Close history panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Panel Body */}
      <div className={styles.historyBody}>
        {isLoading && (
          <div className={styles.historyLoading}>
            <div className={styles.loadingSpinner} />
            <p>Loading approval history...</p>
          </div>
        )}

        {error && (
          <div className={styles.historyError}>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && !selectedApproval && (
          <ApprovalList approvals={approvals} onSelect={handleSelectApproval} />
        )}

        {!isLoading && !error && selectedApproval && (
          <div className={styles.historySnapshotView}>
            <ApprovedViewSnapshot approval={selectedApproval} isHistorical />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * List of approval summaries
 */
interface ApprovalListProps {
  approvals: ApprovalDetail[];
  onSelect: (approval: ApprovalDetail) => void;
}

function ApprovalList({ approvals, onSelect }: ApprovalListProps) {
  if (approvals.length === 0) {
    return (
      <div className={styles.historyEmpty}>
        <History size={32} />
        <p>No approvals yet</p>
        <span>This readout has not been approved.</span>
      </div>
    );
  }

  return (
    <div className={styles.approvalList}>
      {approvals.map((approval) => (
        <ApprovalListItem
          key={approval.id}
          approval={approval}
          isLatest={approval === approvals[0]}
          onSelect={() => onSelect(approval)}
        />
      ))}
    </div>
  );
}

/**
 * Individual approval summary item
 */
interface ApprovalListItemProps {
  approval: ApprovalDetail;
  isLatest: boolean;
  onSelect: () => void;
}

function ApprovalListItem({ approval, isLatest, onSelect }: ApprovalListItemProps) {
  const { approvalNumber, approvedAt, approvedByActorId, approvalNote } = approval;

  return (
    <button
      type="button"
      className={styles.approvalListItem}
      onClick={onSelect}
      aria-label={`View approval #${approvalNumber}`}
    >
      <div className={styles.approvalListItemHeader}>
        <span className={styles.approvalListItemNumber}>
          Approval #{approvalNumber}
          {isLatest && <span className={styles.latestBadge}>Latest</span>}
        </span>
        <ChevronRight size={16} />
      </div>
      <div className={styles.approvalListItemMeta}>
        <span className={styles.approvalListItemMetaItem}>
          <Clock size={12} />
          {formatDate(approvedAt)}
        </span>
        <span className={styles.approvalListItemMetaItem}>
          <User size={12} />
          Actor #{approvedByActorId}
        </span>
      </div>
      {approvalNote && (
        <div className={styles.approvalListItemNote}>
          <FileText size={12} />
          <span>{approvalNote}</span>
        </div>
      )}
    </button>
  );
}
