/**
 * CoachingRail — AI Coach advisory panel for Brief and Plan workspaces.
 *
 * Coach M3A: Workspace Coaching rail with artifact-level invocation.
 *
 * Features:
 * - Shared coaching history (artifact + section reviews)
 * - Primary run display with status
 * - Current vs earlier version indicators
 * - Lazy-loaded run detail
 * - Polling for active runs
 * - Explicit "Review artifact" invocation
 *
 * CRITICAL: Opening Coaching MUST NOT invoke AI automatically.
 * Only explicit researcher action (Review artifact) creates a run.
 *
 * Spec: M3A sections 1-21
 */

import { useState, useCallback, useMemo } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useCoachHistory,
  useActiveCoachRun,
  useCreateCoachRun,
  isActiveRun,
} from '@/api/coaching';
import type {
  CoachRunSummaryResource,
  CoachRunDetailResource,
  CoachItemCategory,
} from '@qori/api-contracts';
import styles from './CoachingRail.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ArtifactType = 'brief' | 'plan';

interface CoachingRailProps {
  /** Artifact public ID */
  artifactPublicId: string;
  /** Artifact type (brief or plan) */
  artifactType: ArtifactType;
  /** Current artifact content version */
  currentContentVersion: number;
  /** Current user's public ID */
  currentUserPublicId: string;
}

// ─── Section Display Names ──────────────────────────────────────────────────

const BRIEF_SECTION_LABELS: Record<string, string> = {
  summary: 'Summary',
  problem_statement: 'Problem Statement',
  learning_objectives: 'Learning Objectives',
  research_questions: 'Research Questions',
  target_barriers: 'Target Barriers',
  participant_approach: 'Participant Approach',
  methodology: 'Methodology',
  timeline: 'Timeline',
  risks: 'Risks',
  discovery_sources: 'Discovery Sources',
};

const PLAN_SECTION_LABELS: Record<string, string> = {
  research_summary: 'Research Summary',
  objectives_questions: 'Objectives & Questions',
  methodology_approach: 'Methodology Approach',
  participant_criteria: 'Participant Criteria',
  session_structure: 'Session Structure',
  analysis_approach: 'Analysis Approach',
  timeline_milestones: 'Timeline & Milestones',
  deliverables: 'Deliverables',
  plan_risks: 'Plan Risks',
};

function getSectionDisplayName(
  artifactType: ArtifactType,
  sectionKey: string | null,
): string {
  if (!sectionKey) return 'Artifact';
  const labels = artifactType === 'brief' ? BRIEF_SECTION_LABELS : PLAN_SECTION_LABELS;
  return labels[sectionKey] ?? 'Section';
}

// ─── Category Labels ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<CoachItemCategory, string> = {
  strength: 'Strengths',
  issue: 'Issues',
  suggestion: 'Suggestions',
  question: 'Questions to consider',
};

const CATEGORY_ORDER: CoachItemCategory[] = ['strength', 'issue', 'suggestion', 'question'];

// ─── Primary Run Selection (Pure/Testable) ──────────────────────────────────

/**
 * Select the primary artifact-review run using M3A precedence:
 * 1. Current user's active artifact-review for CURRENT version
 * 2. Another collaborator's active artifact-review for CURRENT version
 * 3. Latest completed/failed artifact-review for CURRENT version
 * 4. Latest earlier-version artifact-review
 * 5. null (no runs)
 *
 * Section-review runs are excluded from primary selection.
 */
export function selectPrimaryArtifactRun(
  runs: CoachRunSummaryResource[],
  currentContentVersion: number,
  currentUserPublicId: string,
): CoachRunSummaryResource | null {
  // Filter to artifact-scope reviews only
  const artifactRuns = runs.filter((r) => r.review_scope === 'artifact');

  if (artifactRuns.length === 0) return null;

  // Partition by current version
  const currentVersionRuns = artifactRuns.filter(
    (r) => r.content_version === currentContentVersion,
  );
  const earlierVersionRuns = artifactRuns.filter(
    (r) => r.content_version !== currentContentVersion,
  );

  // 1. Current user's active run for current version
  const ownActive = currentVersionRuns.find(
    (r) => r.requested_by.public_id === currentUserPublicId && isActiveRun(r),
  );
  if (ownActive) return ownActive;

  // 2. Any active run for current version (collaborator's)
  const anyActive = currentVersionRuns.find((r) => isActiveRun(r));
  if (anyActive) return anyActive;

  // 3. Latest completed/failed for current version (runs are newest-first)
  const latestCurrentTerminal = currentVersionRuns.find(
    (r) => r.status === 'completed' || r.status === 'failed',
  );
  if (latestCurrentTerminal) return latestCurrentTerminal;

  // 4. Latest earlier version artifact review
  const latestEarlier = earlierVersionRuns[0];
  if (latestEarlier) return latestEarlier;

  return null;
}

// ─── Format Utilities ───────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CoachRunSummaryResource['status'] }) {
  const labels: Record<typeof status, string> = {
    pending: 'Queued',
    running: 'Reviewing',
    completed: 'Complete',
    failed: 'Failed',
  };

  const classMap: Record<typeof status, string> = {
    pending: styles.statusBadgePending,
    running: styles.statusBadgeRunning,
    completed: styles.statusBadgeCompleted,
    failed: styles.statusBadgeFailed,
  };

  return (
    <span className={`${styles.statusBadge} ${classMap[status]}`}>
      {status === 'running' && <span className={styles.spinner} aria-hidden="true" />}
      {labels[status]}
    </span>
  );
}

function VersionBadge({ isCurrent }: { isCurrent: boolean }) {
  return (
    <span
      className={`${styles.versionBadge} ${isCurrent ? styles.versionCurrent : styles.versionEarlier}`}
    >
      {isCurrent ? 'Current version' : 'Earlier version'}
    </span>
  );
}

function StructuredResult({ run }: { run: CoachRunDetailResource }) {
  // Group items by category
  const itemsByCategory = useMemo(() => {
    const groups = new Map<CoachItemCategory, typeof run.items>();
    for (const item of run.items) {
      const existing = groups.get(item.category) ?? [];
      existing.push(item);
      groups.set(item.category, existing);
    }
    return groups;
  }, [run.items]);

  return (
    <div className={styles.resultSection}>
      {CATEGORY_ORDER.map((category) => {
        const items = itemsByCategory.get(category);
        if (!items || items.length === 0) return null;

        return (
          <div key={category} className={styles.resultCategory}>
            <h4 className={styles.resultCategoryLabel}>{CATEGORY_LABELS[category]}</h4>
            <ul className={styles.resultList}>
              {items
                .sort((a, b) => a.position - b.position)
                .map((item) => (
                  <li key={item.id} className={styles.resultItem}>
                    <p className={styles.resultItemText}>{item.text}</p>
                    {item.references.length > 0 && (
                      <div className={styles.resultItemRefs}>
                        {item.references.map((ref) => (
                          <span key={ref.id} className={styles.resultRef}>
                            {ref.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CoachingRail({
  artifactPublicId,
  artifactType,
  currentContentVersion,
  currentUserPublicId,
}: CoachingRailProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Fetch coaching history
  const historyQuery = useCoachHistory({
    artifactPublicId,
    limit: 20,
  });

  // Select primary run
  const runs = historyQuery.data?.runs ?? [];
  const primaryRun = useMemo(
    () => selectPrimaryArtifactRun(runs, currentContentVersion, currentUserPublicId),
    [runs, currentContentVersion, currentUserPublicId],
  );

  // Track which run to display in detail
  const displayedRunId = selectedRunId ?? primaryRun?.id ?? null;

  // Fetch active run with polling (only if primary run is active)
  const shouldPoll = primaryRun && isActiveRun(primaryRun);
  const activeRunQuery = useActiveCoachRun({
    runId: shouldPoll ? primaryRun.id : null,
  });

  // Get the detailed run for display
  const displayedRun = displayedRunId
    ? (activeRunQuery.data?.run?.id === displayedRunId
        ? activeRunQuery.data.run
        : null)
    : null;

  // Create coach run mutation
  const createRun = useCreateCoachRun({
    artifactPublicId,
    onSuccess: (run) => {
      // Automatically show the new run
      setSelectedRunId(run.id);
    },
  });

  // Check if user has an active run for current version
  const hasActiveRun = runs.some(
    (r) =>
      r.requested_by.public_id === currentUserPublicId &&
      r.content_version === currentContentVersion &&
      r.review_scope === 'artifact' &&
      isActiveRun(r),
  );

  const handleCreateReview = useCallback(() => {
    createRun.mutate('artifact');
  }, [createRun]);

  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
  }, []);

  // Loading state
  if (historyQuery.isLoading) {
    return (
      <div className={styles.coachingRail}>
        <p className={styles.eyebrow}>AI Coach</p>
        <p className={styles.body}>Loading...</p>
      </div>
    );
  }

  // Error state
  if (historyQuery.isError) {
    return (
      <div className={styles.coachingRail}>
        <p className={styles.eyebrow}>AI Coach</p>
        <h2 className={`${styles.status} ${styles.statusFailed}`}>
          <AlertCircle size={18} aria-hidden="true" /> Error
        </h2>
        <p className={styles.body}>Could not load coaching history.</p>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => historyQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state - no coaching history
  if (runs.length === 0) {
    return (
      <div className={styles.coachingRail}>
        <p className={styles.eyebrow}>AI Coach</p>
        <div className={styles.emptyState}>
          <Sparkles size={24} className={styles.emptyIcon} aria-hidden="true" />
          <h3 className={styles.emptyTitle}>No coaching reviews yet</h3>
          <p className={styles.emptyBody}>
            Get AI-powered feedback on your {artifactType === 'brief' ? 'brief' : 'plan'}.
          </p>
        </div>
        <div className={styles.actions}>
          <Button
            size="sm"
            onClick={handleCreateReview}
            disabled={createRun.isPending}
            loading={createRun.isPending}
          >
            Review artifact
          </Button>
        </div>
      </div>
    );
  }

  // Has runs - show primary run and history
  return (
    <div className={styles.coachingRail}>
      <p className={styles.eyebrow}>AI Coach</p>

      {/* Primary run display */}
      {primaryRun && (
        <>
          {/* Status heading */}
          {primaryRun.status === 'pending' && (
            <h2 className={`${styles.status} ${styles.statusPending}`}>
              Queued for review
            </h2>
          )}
          {primaryRun.status === 'running' && (
            <h2 className={`${styles.status} ${styles.statusRunning}`}>
              <span className={styles.spinner} aria-hidden="true" /> Reviewing artifact
            </h2>
          )}
          {primaryRun.status === 'completed' && (
            <h2 className={`${styles.status} ${styles.statusCompleted}`}>
              Review complete
            </h2>
          )}
          {primaryRun.status === 'failed' && (
            <h2 className={`${styles.status} ${styles.statusFailed}`}>
              Review failed
            </h2>
          )}

          {/* Meta info */}
          <p className={styles.meta}>
            {primaryRun.requested_by.display_name ?? 'Researcher'} ·{' '}
            {formatTimestamp(primaryRun.requested_at)}
          </p>

          {/* Version badge */}
          <div style={{ marginTop: 'var(--space-2)' }}>
            <VersionBadge isCurrent={primaryRun.is_current_version} />
          </div>

          {/* Completed run - show result */}
          {primaryRun.status === 'completed' && displayedRun && (
            <StructuredResult run={displayedRun} />
          )}

          {/* Failed run - show error */}
          {primaryRun.status === 'failed' && displayedRun?.failure && (
            <div className={styles.failureMessage}>
              {displayedRun.failure.message}
            </div>
          )}

          {/* Failed state - retry placeholder (not functional in M3A) */}
          {primaryRun.status === 'failed' && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <span
                className={styles.retryPlaceholder}
                aria-disabled="true"
                title="Retry will be available in a future release"
              >
                Retry
              </span>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          size="sm"
          onClick={handleCreateReview}
          disabled={hasActiveRun || createRun.isPending}
          loading={createRun.isPending}
          aria-describedby={hasActiveRun ? 'active-run-hint' : undefined}
        >
          Review artifact
        </Button>
      </div>

      {hasActiveRun && (
        <p id="active-run-hint" className={styles.meta}>
          A review is already in progress.
        </p>
      )}

      {/* History section */}
      {runs.length > 0 && (
        <div className={styles.historySection}>
          <h3 className={styles.historyLabel}>History</h3>
          <ul className={styles.historyList} role="listbox" aria-label="Coaching history">
            {runs.map((run) => (
              <li
                key={run.id}
                className={`${styles.historyRow} ${
                  displayedRunId === run.id ? styles.historyRowSelected : ''
                }`}
                role="option"
                aria-selected={displayedRunId === run.id}
                tabIndex={0}
                onClick={() => handleSelectRun(run.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectRun(run.id);
                  }
                }}
              >
                <div className={styles.historyRowHeader}>
                  <span className={styles.historyRowLabel}>
                    {run.review_scope === 'section'
                      ? `${getSectionDisplayName(artifactType, run.selected_section_key)} review`
                      : 'Artifact review'}
                  </span>
                  <StatusBadge status={run.status} />
                </div>
                <div className={styles.historyRowMeta}>
                  {run.requested_by.display_name ?? 'Researcher'} ·{' '}
                  {formatShortTimestamp(run.requested_at)}
                  {!run.is_current_version && ' · Earlier version'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
