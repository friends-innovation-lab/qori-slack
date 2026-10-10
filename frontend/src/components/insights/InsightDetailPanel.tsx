/**
 * InsightDetailPanel — Panel view for a single insight.
 *
 * Per DR03/DR04/DR06/DR07/DR08b:
 * - Version blocks: In use (solid, success) vs Pending (dashed)
 * - Evidence without confusing accepted vs latest
 * - Action slots for mutations (controlled by parent)
 * - Read-only permission state (DR10b)
 * - Eligibility line: synthesis scope indicator
 *
 * DOES NOT independently fetch or mutate data.
 */

import { forwardRef, type ReactNode } from 'react';
import { CheckCircle, Slash, Lock } from 'lucide-react';
import { InsightStatusBadge, OriginTag, InUseBadge } from './InsightStatusBadge';
import { EvidenceReferenceCard } from './EvidenceReferenceCard';
import styles from './insights.module.css';
import type {
  InsightDetail,
  RevisionDetail,
  EvidenceReference,
} from '@qori/api-contracts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsightDetailPanelProps {
  /** Insight detail data */
  insight: InsightDetail;
  /** Whether the user has edit permission */
  canEdit?: boolean;
  /** Reason shown when canEdit is false (DR10b) */
  readOnlyReason?: string;
  /** Action buttons slot (controlled by parent) */
  actionSlot?: ReactNode;
  /** Handler for navigating to evidence source */
  onNavigateToSource?: (reference: EvidenceReference) => void;
  /** DR-4d: Handler for filtering by evidence source */
  onFilterBySource?: (reference: EvidenceReference) => void;
  /** Handler for viewing revision history */
  onViewHistory?: () => void;
  /** Additional class name */
  className?: string;
}

export const InsightDetailPanel = forwardRef<HTMLDivElement, InsightDetailPanelProps>(
  function InsightDetailPanel(
    {
      insight,
      canEdit = true,
      readOnlyReason,
      actionSlot,
      onNavigateToSource,
      onFilterBySource,
      onViewHistory,
      className,
    },
    ref,
  ) {
    const hasAccepted = insight.acceptedRevision !== null;
    const hasPending =
      insight.status === 'accepted_with_pending' &&
      insight.latestRevision.id !== insight.acceptedRevision?.id;
    const isWithdrawn = insight.status === 'withdrawn';
    const isEligible = hasAccepted && !isWithdrawn;

    return (
      <div ref={ref} className={`${styles.insightPanel} ${className || ''}`}>
        {/* Header: ID + status */}
        <header className={styles.insightPanelHeader}>
          <h2 className={styles.insightPanelId} id="insight-panel-title">
            {insight.displayId}
          </h2>
          <div className={styles.insightPanelMeta}>
            <InsightStatusBadge status={insight.status} />
            <OriginTag origin={insight.origin} />
          </div>
        </header>

        {/* Body: scrollable content */}
        <div className={styles.insightPanelBody}>
          {/* Accepted revision block (if exists) */}
          {hasAccepted && insight.acceptedRevision && (
            <section className={styles.insightPanelSection}>
              <h3 className={styles.insightPanelSectionTitle}>Accepted Version</h3>
              <RevisionBlock
                revision={insight.acceptedRevision}
                variant="inUse"
                onNavigateToSource={onNavigateToSource}
                onFilterBySource={onFilterBySource}
              />
            </section>
          )}

          {/* Pending revision block (for accepted_with_pending) */}
          {hasPending && (
            <section className={styles.insightPanelSection}>
              <h3 className={styles.insightPanelSectionTitle}>Pending Revision</h3>
              <RevisionBlock
                revision={insight.latestRevision}
                variant="pending"
                label={`Revision r${insight.latestRevision.revisionNumber} pending`}
                onNavigateToSource={onNavigateToSource}
                onFilterBySource={onFilterBySource}
              />
            </section>
          )}

          {/* For proposed insights (no accepted), show latest */}
          {!hasAccepted && (
            <section className={styles.insightPanelSection}>
              <h3 className={styles.insightPanelSectionTitle}>Proposed Version</h3>
              <RevisionBlock
                revision={insight.latestRevision}
                variant="pending"
                label={
                  insight.origin === 'ai'
                    ? "Qori's interpretation"
                    : `Revision r${insight.latestRevision.revisionNumber}`
                }
                onNavigateToSource={onNavigateToSource}
                onFilterBySource={onFilterBySource}
              />
            </section>
          )}

          {/* Eligibility line */}
          <EligibilityLine eligible={isEligible} withdrawn={isWithdrawn} />

          {/* History link */}
          {onViewHistory && insight.revisionCount > 1 && (
            <button
              type="button"
              onClick={onViewHistory}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginTop: 'var(--space-2)',
                fontSize: '12px',
                color: 'var(--color-brand-text)',
                cursor: 'pointer',
              }}
            >
              View {insight.revisionCount} revision{insight.revisionCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Action bar or read-only notice */}
        {canEdit ? (
          actionSlot && (
            <div className={styles.insightPanelActions}>
              <div className={styles.insightPanelActionButtons}>{actionSlot}</div>
              <ActionWhyLine insight={insight} />
            </div>
          )
        ) : (
          <ReadOnlyNotice reason={readOnlyReason} />
        )}
      </div>
    );
  },
);

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RevisionBlockProps {
  revision: RevisionDetail;
  variant: 'inUse' | 'pending' | 'past';
  label?: string;
  onNavigateToSource?: (reference: EvidenceReference) => void;
  onFilterBySource?: (reference: EvidenceReference) => void;
}

function RevisionBlock({
  revision,
  variant,
  label,
  onNavigateToSource,
  onFilterBySource,
}: RevisionBlockProps) {
  const blockClass =
    variant === 'inUse'
      ? styles.revisionBlockInUse
      : variant === 'pending'
        ? styles.revisionBlockPending
        : styles.revisionBlockPast;

  return (
    <div className={`${styles.revisionBlock} ${blockClass}`}>
      <div className={styles.revisionBlockHeader}>
        <div className={styles.revisionBlockLabel}>
          {label || `r${revision.revisionNumber}`}
          {variant === 'inUse' && <InUseBadge />}
        </div>
        <OriginTag origin={revision.origin} />
      </div>

      <div className={styles.revisionBlockContent}>
        <div className={styles.revisionBlockWording}>{revision.content.wording}</div>

        {/* Evidence references */}
        {revision.evidenceSnapshot.length > 0 && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Evidence ({revision.evidenceSnapshot.length})
            </div>
            {revision.evidenceSnapshot.map((ref, index) => (
              <EvidenceReferenceCard
                key={`${ref.evidenceSourceId}-${index}`}
                reference={ref}
                addedDate={revision.createdAt}
                onNavigateToSource={
                  onNavigateToSource ? () => onNavigateToSource(ref) : undefined
                }
                onFilterBySource={
                  onFilterBySource ? () => onFilterBySource(ref) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EligibilityLineProps {
  eligible: boolean;
  withdrawn: boolean;
}

function EligibilityLine({ eligible, withdrawn }: EligibilityLineProps) {
  const Icon = eligible ? CheckCircle : Slash;
  const text = withdrawn
    ? 'Withdrawn — not in synthesis scope'
    : eligible
      ? 'Eligible for synthesis'
      : 'Not yet accepted — not in synthesis scope';

  return (
    <div
      className={`${styles.insightPanelEligibility} ${eligible ? styles.insightPanelEligibilityYes : styles.insightPanelEligibilityNo}`}
      style={{ marginTop: 'var(--space-3)' }}
    >
      <Icon size={14} aria-hidden="true" />
      {text}
    </div>
  );
}

interface ActionWhyLineProps {
  insight: InsightDetail;
}

function ActionWhyLine({ insight }: ActionWhyLineProps) {
  let whyText = '';

  switch (insight.status) {
    case 'proposed':
      whyText = 'Accepting will add this insight to the synthesis scope.';
      break;
    case 'accepted':
      whyText = 'This insight is accepted and in the synthesis scope.';
      break;
    case 'accepted_with_pending':
      whyText = 'Accepting the new revision will update the synthesis scope.';
      break;
    case 'rejected':
      whyText = 'This insight was rejected and is not in the synthesis scope.';
      break;
    case 'withdrawn':
      whyText = 'This insight was withdrawn and is no longer in the synthesis scope.';
      break;
  }

  if (!whyText) return null;

  return <div className={styles.insightPanelWhy}>{whyText}</div>;
}

interface ReadOnlyNoticeProps {
  reason?: string;
}

function ReadOnlyNotice({ reason }: ReadOnlyNoticeProps) {
  return (
    <div className={styles.insightPanelReadOnly}>
      <Lock size={14} aria-hidden="true" style={{ marginRight: 'var(--space-1)', display: 'inline' }} />
      {reason || 'You have view-only access to this insight.'}
    </div>
  );
}
