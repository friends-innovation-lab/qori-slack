/**
 * InsightRow — Row display for insight list.
 *
 * Per DR02:
 * - Grid 56px | 1fr | auto
 * - ID mono 11/600 brand-deep (IN-0001 format per D7)
 * - Wording serif 15.5/26 (proposed rows use text-meta)
 * - Meta: origin tag + decision + source file names
 * - Selected: brand-wash + 2px inset indicator
 * - Pending block: dashed border-emphasis with diff preview
 */

import { forwardRef, type KeyboardEvent } from 'react';
import { InsightStatusBadge, OriginTag } from './InsightStatusBadge';
import styles from './insights.module.css';
import type { InsightSummary, InsightStatus } from '@qori/api-contracts';

interface PendingRevisionInfo {
  revisionNumber: number;
  wording: string;
  editedBy: string;
}

interface InsightRowProps {
  /** Insight summary data */
  insight: InsightSummary;
  /** Whether this row is selected */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Keyboard handler for accessibility */
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** Source file names to display */
  sourceNames?: string[];
  /** Pending revision info (for accepted_with_pending status) */
  pendingRevision?: PendingRevisionInfo;
  /** Additional class name */
  className?: string;
}

export const InsightRow = forwardRef<HTMLDivElement, InsightRowProps>(
  function InsightRow(
    {
      insight,
      selected = false,
      onClick,
      onKeyDown,
      sourceNames,
      pendingRevision,
      className,
    },
    ref,
  ) {
    const isProposed = insight.status === 'proposed';
    const hasPending = insight.status === 'accepted_with_pending' && pendingRevision;

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
      onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        role="row"
        tabIndex={0}
        aria-selected={selected}
        className={`${styles.insightRow} ${selected ? styles.insightRowSelected : ''} ${className || ''}`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        {/* Column 1: Display ID */}
        <div className={styles.insightRowId}>{insight.displayId}</div>

        {/* Column 2: Wording + Meta */}
        <div>
          <div
            className={`${styles.insightRowWording} ${isProposed ? styles.insightRowWordingProposed : ''}`}
          >
            {insight.wording}
          </div>

          <div className={styles.insightRowMeta}>
            <OriginTag origin={insight.origin} />
            <InsightStatusBadge status={insight.status} />
            {sourceNames && sourceNames.length > 0 && (
              <span>{sourceNames.join(', ')}</span>
            )}
          </div>

          {/* Pending revision block for accepted_with_pending */}
          {hasPending && (
            <div className={styles.pendingBlock}>
              <div className={styles.pendingBlockLabel}>
                Revision r{pendingRevision.revisionNumber} pending
                <span> · Edited by {pendingRevision.editedBy}</span>
                <span> · not in use</span>
              </div>
              <div className={styles.pendingBlockWording}>
                {pendingRevision.wording}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Actions slot (empty, for future use) */}
        <div className={styles.insightRowActions} />
      </div>
    );
  },
);

// ─── Status group helpers ────────────────────────────────────────────────────

export type InsightGroup = 'proposed' | 'accepted' | 'rejected' | 'withdrawn';

/**
 * Get the group an insight belongs to for list organization.
 */
export function getInsightGroup(status: InsightStatus): InsightGroup {
  switch (status) {
    case 'proposed':
      return 'proposed';
    case 'accepted':
    case 'accepted_with_pending':
      return 'accepted';
    case 'rejected':
      return 'rejected';
    case 'withdrawn':
      return 'withdrawn';
  }
}

/**
 * Group insights by status for list display.
 */
export function groupInsights(insights: InsightSummary[]): Record<InsightGroup, InsightSummary[]> {
  const groups: Record<InsightGroup, InsightSummary[]> = {
    proposed: [],
    accepted: [],
    rejected: [],
    withdrawn: [],
  };

  for (const insight of insights) {
    const group = getInsightGroup(insight.status);
    groups[group].push(insight);
  }

  return groups;
}
