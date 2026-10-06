/**
 * ReviewQueue — DISC-3 B5
 *
 * Queue of runs needing researcher review (failed states).
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §4.1:
 * "Needs your review" section — a queue, not a card stack.
 *
 * Each row: Object · Gate · Consequence/count · Action
 * Sorted by: expiry first (DISC-4), then failures, then gates.
 */

import { Link } from 'react-router';
import { AlertTriangle, Clock } from 'lucide-react';
import type { DiscoveryRunSummary, DiscoveryTypeKey } from '@qori/api-contracts';
import styles from './ReviewQueue.module.css';

interface ReviewQueueProps {
  runs: DiscoveryRunSummary[];
  studyPublicId: string;
}

/** Type labels for display */
const typeLabels: Record<DiscoveryTypeKey, string> = {
  desk_research: 'Desk',
  stakeholder_synthesis: 'Stakeholder',
  survey_synthesis: 'Survey',
};

/**
 * Filter runs that need review (failed or needs_review states).
 */
function filterNeedsReview(runs: DiscoveryRunSummary[]): DiscoveryRunSummary[] {
  return runs.filter((run) => run.status === 'failed');
}

/**
 * Get gate/consequence message based on run state.
 */
function getGateMessage(run: DiscoveryRunSummary): { icon: 'error' | 'warning'; message: string } {
  if (run.status === 'failed') {
    const reason = run.failureMessage || 'Processing error';
    return { icon: 'error', message: `Failed — ${reason}` };
  }
  // DISC-4: Survey stages would add more states here
  return { icon: 'warning', message: 'Needs attention' };
}

/**
 * Get action label and route.
 */
function getAction(run: DiscoveryRunSummary, studyPublicId: string): { label: string; to: string } {
  if (run.status === 'failed') {
    return {
      label: 'Resolve →',
      to: `/studies/${studyPublicId}/discovery/runs/${run.publicId}`,
    };
  }
  return {
    label: 'Continue →',
    to: `/studies/${studyPublicId}/discovery/runs/${run.publicId}`,
  };
}

export function ReviewQueue({ runs, studyPublicId }: ReviewQueueProps) {
  const needsReview = filterNeedsReview(runs);

  // Sort: failures first (DISC-3 doesn't have expiry)
  const sorted = [...needsReview].sort((a, b) => {
    // Failed first
    if (a.status === 'failed' && b.status !== 'failed') return -1;
    if (b.status === 'failed' && a.status !== 'failed') return 1;
    // Then by updated desc
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className={styles.queue} role="list" aria-label="Items needing your review">
      {sorted.map((run) => {
        const gate = getGateMessage(run);
        const action = getAction(run, studyPublicId);

        return (
          <div key={run.publicId} className={styles.row} role="listitem">
            {/* Object: type · name */}
            <div className={styles.object}>
              <span className={styles.type}>{typeLabels[run.discoveryType]}</span>
              <span className={styles.name}>{run.topic}</span>
            </div>

            {/* Gate: icon + message */}
            <div className={`${styles.gate} ${styles[gate.icon]}`}>
              {gate.icon === 'error' ? (
                <AlertTriangle size={12} aria-hidden="true" />
              ) : (
                <Clock size={12} aria-hidden="true" />
              )}
              <span>{gate.message}</span>
            </div>

            {/* Action */}
            <Link to={action.to} className={styles.action}>
              {action.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
