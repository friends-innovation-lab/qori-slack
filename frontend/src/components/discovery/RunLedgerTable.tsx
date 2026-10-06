/**
 * RunLedgerTable — DISC-3 B6
 *
 * Discovery runs ledger grouped by type, with sticky group sub-headers.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §4.1.
 *
 * Columns: Marker | Run (topic) | Sources | Status | Updated | Used by
 */

import { Link } from 'react-router';
import { Check, LoaderCircle, AlertTriangle, Clock } from 'lucide-react';
import type { DiscoveryRunSummary, DiscoveryTypeKey } from '@qori/api-contracts';
import { DiscoveryMarker } from './DiscoveryMarker';
import styles from './RunLedgerTable.module.css';

interface RunLedgerTableProps {
  runs: DiscoveryRunSummary[];
  studyPublicId: string;
  /** Whether to group by type (default: true) */
  grouped?: boolean;
  /** Maximum rows per group before collapse */
  maxPerGroup?: number;
}

/** Type labels for group headers */
const typeLabels: Record<DiscoveryTypeKey, string> = {
  desk_research: 'Desk research',
  stakeholder_synthesis: 'Stakeholder synthesis',
  survey_synthesis: 'Survey synthesis',
};

/** Type order for display */
const typeOrder: DiscoveryTypeKey[] = [
  'desk_research',
  'stakeholder_synthesis',
  'survey_synthesis',
];

/** Format date for "Updated" column */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Status icon and label */
function RunStatus({ run }: { run: DiscoveryRunSummary }) {
  switch (run.status) {
    case 'completed':
      return (
        <span className={styles.statusReady}>
          <Check size={12} aria-hidden="true" />
          Ready
        </span>
      );
    case 'processing':
    case 'pending':
      return (
        <span className={styles.statusProcessing}>
          <LoaderCircle size={12} className={styles.spin} aria-hidden="true" />
          Analyzing
        </span>
      );
    case 'failed':
      return (
        <span className={styles.statusFailed}>
          <AlertTriangle size={12} aria-hidden="true" />
          Failed
          {run.failureMessage && ` · ${run.failureMessage}`}
        </span>
      );
    case 'cancelled':
      return (
        <span className={styles.statusMuted}>
          <Clock size={12} aria-hidden="true" />
          Cancelled
        </span>
      );
    default:
      return <span className={styles.statusMuted}>{run.status}</span>;
  }
}

export function RunLedgerTable({
  runs,
  studyPublicId,
  grouped = true,
  maxPerGroup = 10,
}: RunLedgerTableProps) {
  // Group runs by type
  const groupedByType = typeOrder.reduce(
    (acc, type) => {
      acc[type] = runs.filter((r) => r.discoveryType === type);
      return acc;
    },
    {} as Record<DiscoveryTypeKey, DiscoveryRunSummary[]>,
  );

  const groupKeys = grouped
    ? typeOrder.filter((t) => groupedByType[t].length > 0)
    : (['all'] as const);

  if (runs.length === 0) {
    return null;
  }

  return (
    <div className={styles.ledger}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.thMarker}>Marker</th>
            <th className={styles.thRun}>Run (topic)</th>
            <th className={styles.thSources}>Sources</th>
            <th className={styles.thStatus}>Status</th>
            <th className={styles.thUpdated}>Updated</th>
            <th className={styles.thUsedBy}>Used by</th>
          </tr>
        </thead>
        <tbody>
          {groupKeys.map((groupKey) => {
            const groupRuns =
              groupKey === 'all'
                ? runs
                : groupedByType[groupKey as DiscoveryTypeKey];

            if (groupRuns.length === 0) return null;

            return (
              <RunGroup
                key={groupKey}
                label={groupKey === 'all' ? null : typeLabels[groupKey as DiscoveryTypeKey]}
                runs={groupRuns}
                studyPublicId={studyPublicId}
                maxRows={maxPerGroup}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface RunGroupProps {
  label: string | null;
  runs: DiscoveryRunSummary[];
  studyPublicId: string;
  maxRows: number;
}

function RunGroup({ label, runs, studyPublicId, maxRows }: RunGroupProps) {
  // Sort by updated descending
  const sorted = [...runs].sort((a, b) => {
    const aDate = new Date(a.completedAt || a.startedAt || a.createdAt);
    const bDate = new Date(b.completedAt || b.startedAt || b.createdAt);
    return bDate.getTime() - aDate.getTime();
  });

  const showAll = sorted.length <= maxRows;
  const displayed = showAll ? sorted : sorted.slice(0, maxRows);

  return (
    <>
      {label && (
        <tr className={styles.groupHeader}>
          <th colSpan={6} className={styles.groupLabel}>
            {label}
          </th>
        </tr>
      )}
      {displayed.map((run) => (
        <tr key={run.publicId} className={styles.row}>
          <td className={styles.cellMarker}>
            <DiscoveryMarker
              marker={run.marker}
              name={run.topic}
              type={run.discoveryType}
            />
          </td>
          <td className={styles.cellRun}>
            <Link
              to={`/studies/${studyPublicId}/discovery/runs/${run.publicId}`}
              className={styles.runLink}
            >
              {run.topic}
            </Link>
          </td>
          <td className={styles.cellSources}>
            {run.sourceCount} {run.sourceCount === 1 ? 'file' : 'files'}
          </td>
          <td className={styles.cellStatus}>
            <RunStatus run={run} />
          </td>
          <td className={styles.cellUpdated}>
            {formatDate(run.completedAt || run.startedAt || run.createdAt)}
          </td>
          <td className={styles.cellUsedBy}>
            {/* DISC-3: Placeholder for used_by lineage. Full impl in DISC-6. */}
            —
          </td>
        </tr>
      ))}
      {!showAll && (
        <tr className={styles.showAllRow}>
          <td colSpan={6}>
            <button type="button" className={styles.showAllBtn}>
              Show all {sorted.length}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
