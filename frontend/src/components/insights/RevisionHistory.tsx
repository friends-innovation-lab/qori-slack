/**
 * RevisionHistory — Timeline of revisions and review decisions.
 *
 * Per DR06:
 * - Newest first
 * - Each revision: ID, status badge, "In use" tag, wording, decision lines
 * - Decision lines: who · when · optional note
 * - "View" link to open read-only snapshot
 * - No undo/reopen controls (per D5)
 */

import { CheckCircle, XCircle, Archive, Clock } from 'lucide-react';
import { InUseBadge } from './InsightStatusBadge';
import styles from './insights.module.css';
import type { RevisionDetail, ReviewRecord, ReviewAction } from '@qori/api-contracts';

// ─── Revision History Item ───────────────────────────────────────────────────

interface RevisionHistoryItemProps {
  /** Revision data */
  revision: RevisionDetail;
  /** Review decisions for this revision */
  decisions?: ReviewRecord[];
  /** Handler for viewing the revision */
  onView?: () => void;
  /** Additional class name */
  className?: string;
}

export function RevisionHistoryItem({
  revision,
  decisions = [],
  onView,
  className,
}: RevisionHistoryItemProps) {
  const statusLabel = getRevisionStatusLabel(revision, decisions);

  return (
    <div className={`${styles.revisionHistoryItem} ${className || ''}`}>
      <div className={styles.revisionHistoryHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className={styles.revisionHistoryId}>r{revision.revisionNumber}</span>
          <RevisionStatusBadge status={statusLabel} />
          {revision.isAccepted && <InUseBadge />}
        </div>
        {onView && (
          <button
            type="button"
            onClick={onView}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '12px',
              color: 'var(--color-brand-text)',
              cursor: 'pointer',
            }}
          >
            View
          </button>
        )}
      </div>

      <div className={styles.revisionHistoryWording}>
        {revision.content.wording}
      </div>

      {decisions.length > 0 && (
        <div className={styles.revisionHistoryDecisions}>
          {decisions.map((decision) => (
            <DecisionLine key={decision.id} decision={decision} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Full Revision History ───────────────────────────────────────────────────

interface RevisionHistoryProps {
  /** List of revisions (will be sorted newest first) */
  revisions: RevisionDetail[];
  /** All review records */
  reviews: ReviewRecord[];
  /** Handler for viewing a revision */
  onViewRevision?: (revision: RevisionDetail) => void;
  /** Additional class name */
  className?: string;
}

export function RevisionHistory({
  revisions,
  reviews,
  onViewRevision,
  className,
}: RevisionHistoryProps) {
  // Sort newest first
  const sortedRevisions = [...revisions].sort(
    (a, b) => b.revisionNumber - a.revisionNumber,
  );

  // Group decisions by revision
  const decisionsByRevision = groupDecisionsByRevision(reviews);

  if (sortedRevisions.length === 0) {
    return (
      <div className={className} style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
        No revision history.
      </div>
    );
  }

  return (
    <div className={`${styles.revisionHistory} ${className || ''}`}>
      {sortedRevisions.map((revision) => (
        <RevisionHistoryItem
          key={revision.id}
          revision={revision}
          decisions={decisionsByRevision[revision.id] || []}
          onView={onViewRevision ? () => onViewRevision(revision) : undefined}
        />
      ))}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type RevisionStatusType = 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'withdrawn';

interface RevisionStatusBadgeProps {
  status: RevisionStatusType;
}

function RevisionStatusBadge({ status }: RevisionStatusBadgeProps) {
  const config: Record<RevisionStatusType, { icon: typeof CheckCircle; label: string; color: string }> = {
    proposed: { icon: Clock, label: 'Proposed', color: 'var(--color-brand-text)' },
    accepted: { icon: CheckCircle, label: 'Accepted', color: 'var(--color-success)' },
    rejected: { icon: XCircle, label: 'Rejected', color: 'var(--color-error)' },
    superseded: { icon: Clock, label: 'Superseded', color: 'var(--color-text-muted)' },
    withdrawn: { icon: Archive, label: 'Withdrawn', color: 'var(--color-text-muted)' },
  };

  const cfg = config[status];
  const Icon = cfg.icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        fontSize: '11px',
        fontWeight: 600,
        color: cfg.color,
      }}
    >
      <Icon size={12} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

interface DecisionLineProps {
  decision: ReviewRecord;
}

function DecisionLine({ decision }: DecisionLineProps) {
  const actionLabel = getActionLabel(decision.action);
  const Icon = getActionIcon(decision.action);

  return (
    <div className={styles.revisionHistoryDecision}>
      <Icon size={12} aria-hidden="true" />
      <strong>{actionLabel}</strong>
      <span>by {formatActorName(decision.reviewedBy)}</span>
      <span>· {formatDate(decision.createdAt)}</span>
      {decision.comment && <span>· {decision.comment}</span>}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRevisionStatusLabel(
  revision: RevisionDetail,
  decisions: ReviewRecord[],
): RevisionStatusType {
  // Check for withdrawal (applies to whole insight, not revision)
  const hasWithdrawal = decisions.some((d) => d.action === 'withdraw');
  if (hasWithdrawal) return 'withdrawn';

  // Check if currently accepted
  if (revision.isAccepted) return 'accepted';

  // Check if this revision was rejected
  const wasRejected = decisions.some(
    (d) => d.action === 'reject' && d.revisionId === revision.id,
  );
  if (wasRejected) return 'rejected';

  // Check if superseded (another revision was accepted after this)
  // This is determined by: not accepted, not latest, not rejected
  if (!revision.isLatest && !revision.isAccepted) return 'superseded';

  return 'proposed';
}

function getActionLabel(action: ReviewAction): string {
  switch (action) {
    case 'accept':
      return 'Accepted';
    case 'reject':
      return 'Rejected';
    case 'withdraw':
      return 'Withdrawn';
  }
}

function getActionIcon(action: ReviewAction): typeof CheckCircle {
  switch (action) {
    case 'accept':
      return CheckCircle;
    case 'reject':
      return XCircle;
    case 'withdraw':
      return Archive;
  }
}

function groupDecisionsByRevision(reviews: ReviewRecord[]): Record<number, ReviewRecord[]> {
  const grouped: Record<number, ReviewRecord[]> = {};

  for (const review of reviews) {
    if (review.revisionId != null) {
      if (!grouped[review.revisionId]) {
        grouped[review.revisionId] = [];
      }
      grouped[review.revisionId].push(review);
    }
  }

  return grouped;
}

function formatActorName(actor: string): string {
  // Extract name from "user:email" or "system:ai" format
  if (actor.startsWith('user:')) {
    const email = actor.slice(5);
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (actor.startsWith('system:')) {
    return 'Qori';
  }
  return actor;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}
