/**
 * CoachingRail — AI Coach advisory panel for Brief and Plan workspaces.
 *
 * Coach M3A: Workspace Coaching rail with artifact-level invocation.
 * Coach M3B: Extended with section-level coaching.
 *
 * Features:
 * - Shared coaching history (artifact + section reviews)
 * - Primary run display with status
 * - Current vs earlier version indicators
 * - Lazy-loaded run detail
 * - Polling for active runs
 * - Explicit "Review artifact" invocation (M3A)
 * - Section context with "Review this section" (M3B)
 * - Back to artifact coaching navigation (M3B)
 *
 * CRITICAL: Opening Coaching MUST NOT invoke AI automatically.
 * Only explicit researcher action (Review artifact / Review this section) creates a run.
 *
 * Spec: M3A sections 1-21, M3B sections 13-29
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useCoachHistory,
  useCoachRun,
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

/** M3B: Section context state */
export interface CoachingSectionContext {
  /** Stable section key from contract */
  sectionKey: string;
  /** Human-readable label from contract */
  label: string;
}

interface CoachingRailProps {
  /** Artifact public ID */
  artifactPublicId: string;
  /** Artifact type (brief or plan) */
  artifactType: ArtifactType;
  /** Current artifact content version */
  currentContentVersion: number;
  /** Current user's public ID */
  currentUserPublicId: string;
  /** M3B: Section context (null = artifact context) */
  sectionContext?: CoachingSectionContext | null;
  /** M3B: Callback when section context changes (for navigation state) */
  onSectionContextChange?: (context: CoachingSectionContext | null) => void;
}

// ─── Section Display Names ──────────────────────────────────────────────────
// CRITICAL: Keys MUST match artifact_sections.section_key exactly.
// See: packages/artifact-contracts/src/*.contract.ts for authoritative keys.
// See: frontend/src/components/study/document/sectionLabels.ts for alignment.
//
// CANONICAL SECTION IDENTITY RULE:
// Coach section identity uses the exact canonical artifact_sections.section_key.
// Do NOT use UI presentation IDs, heading labels, or invented Coach aliases.

const BRIEF_SECTION_LABELS: Record<string, string> = {
  summary: 'Summary',
  problem_narrative: 'Problem',
  method_prose: 'Method',
  participants_prose: 'Participants',
  out_of_scope: 'Out of scope',
  risks: 'Risks',
};

const PLAN_SECTION_LABELS: Record<string, string> = {
  plan_summary: 'Summary',
  plan_background: 'Background',
  plan_method_approach: 'Method',
  plan_participants_prose: 'Participants',
  plan_deliverables: 'Deliverables',
  plan_risks: 'Risks and mitigations',
  plan_commitments: 'Brief commitments',
};

function getSectionDisplayName(
  artifactType: ArtifactType,
  sectionKey: string | null,
): string {
  if (!sectionKey) return 'Artifact';
  const labels = artifactType === 'brief' ? BRIEF_SECTION_LABELS : PLAN_SECTION_LABELS;
  return labels[sectionKey] ?? 'Section';
}

// ─── Artifact Display Names ──────────────────────────────────────────────────

/**
 * Get user-friendly display name for artifact type.
 * Never expose internal "artifact" terminology to users.
 */
function getArtifactDisplayName(artifactType: ArtifactType): string {
  return artifactType === 'brief' ? 'Research Brief' : 'Research Plan';
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

/**
 * M3B: Select the primary section-review run using exact precedence:
 * 1. Current user's active section-review for CURRENT version + exact section
 * 2. Another collaborator's active section-review for CURRENT version + exact section
 * 3. Latest completed/failed section-review for CURRENT version + exact section
 * 4. Latest EARLIER-VERSION review for exact same section
 * 5. null (no matching runs)
 *
 * CRITICAL: Only matches exact selectedSectionKey. Other sections excluded.
 * CRITICAL: Artifact-scope runs are excluded.
 */
export function selectPrimarySectionRun(
  runs: CoachRunSummaryResource[],
  currentContentVersion: number,
  currentUserPublicId: string,
  selectedSectionKey: string,
): CoachRunSummaryResource | null {
  // Filter to section-scope reviews for exact section key only
  const sectionRuns = runs.filter(
    (r) => r.review_scope === 'section' && r.selected_section_key === selectedSectionKey,
  );

  if (sectionRuns.length === 0) return null;

  // Partition by current version
  const currentVersionRuns = sectionRuns.filter(
    (r) => r.content_version === currentContentVersion,
  );
  const earlierVersionRuns = sectionRuns.filter(
    (r) => r.content_version !== currentContentVersion,
  );

  // 1. Current user's active run for current version + exact section
  const ownActive = currentVersionRuns.find(
    (r) => r.requested_by.public_id === currentUserPublicId && isActiveRun(r),
  );
  if (ownActive) return ownActive;

  // 2. Any active run for current version + exact section (collaborator's)
  const anyActive = currentVersionRuns.find((r) => isActiveRun(r));
  if (anyActive) return anyActive;

  // 3. Latest completed/failed for current version + exact section
  const latestCurrentTerminal = currentVersionRuns.find(
    (r) => r.status === 'completed' || r.status === 'failed',
  );
  if (latestCurrentTerminal) return latestCurrentTerminal;

  // 4. Latest earlier version section review
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
  sectionContext,
  onSectionContextChange,
}: CoachingRailProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  // M3B: Remember last section for "return to section" during rail session
  const [rememberedSection, setRememberedSection] = useState<CoachingSectionContext | null>(null);

  // Fetch coaching history (includes capabilities from M3B)
  const historyQuery = useCoachHistory({
    artifactPublicId,
    limit: 20,
  });

  const runs = historyQuery.data?.runs ?? [];
  const capabilities = historyQuery.data?.capabilities;

  // M3B: Determine if we're in section context
  const isInSectionContext = sectionContext != null;

  // M3B: Track remembered section when entering section context
  useEffect(() => {
    if (sectionContext) {
      setRememberedSection(sectionContext);
    }
  }, [sectionContext]);

  // Select primary run based on context
  const primaryRun = useMemo(() => {
    if (isInSectionContext && sectionContext) {
      return selectPrimarySectionRun(
        runs,
        currentContentVersion,
        currentUserPublicId,
        sectionContext.sectionKey,
      );
    }
    return selectPrimaryArtifactRun(runs, currentContentVersion, currentUserPublicId);
  }, [runs, currentContentVersion, currentUserPublicId, isInSectionContext, sectionContext]);

  // M3B: Filter history for section context
  const displayedHistory = useMemo(() => {
    if (isInSectionContext && sectionContext) {
      // Section context: show only this exact section's runs
      return runs.filter(
        (r) => r.review_scope === 'section' && r.selected_section_key === sectionContext.sectionKey,
      );
    }
    // Artifact context: show all runs (artifact + all sections)
    return runs;
  }, [runs, isInSectionContext, sectionContext]);

  // Track which run to display in detail
  const displayedRunId = selectedRunId ?? primaryRun?.id ?? null;

  // Fetch active run with polling (only if primary run is active)
  const shouldPoll = primaryRun && isActiveRun(primaryRun);
  const activeRunQuery = useActiveCoachRun({
    runId: shouldPoll ? primaryRun.id : null,
  });

  // M3B FIX: Lazily fetch detail for displayed run when NOT polling (completed/failed runs).
  // This ensures structured results are available for completed historical runs.
  // The query key matches useActiveCoachRun, so cache is shared (no duplicate fetches).
  const detailQuery = useCoachRun({
    runId: displayedRunId ?? '',
    enabled: displayedRunId != null && !shouldPoll,
  });

  // Get the detailed run for display.
  // Priority: active polling data > lazy-loaded detail data
  const displayedRun = useMemo(() => {
    if (!displayedRunId) return null;

    // If we have polled data for this run, use it (most fresh)
    if (activeRunQuery.data?.run?.id === displayedRunId) {
      return activeRunQuery.data.run;
    }

    // Otherwise use lazy-loaded detail (for completed/failed runs)
    if (detailQuery.data?.run?.id === displayedRunId) {
      return detailQuery.data.run;
    }

    return null;
  }, [displayedRunId, activeRunQuery.data?.run, detailQuery.data?.run]);

  // CRITICAL: Derive the effective primary run status from polled data if available.
  // This fixes the stale UI bug where history cache shows 'running' but polled
  // run has transitioned to 'completed' or 'failed'.
  const effectivePrimaryRun = useMemo(() => {
    if (!primaryRun) return null;

    // If we have polled data for the primary run, merge the fresh status
    const polledRun = activeRunQuery.data?.run;
    if (polledRun && polledRun.id === primaryRun.id) {
      return {
        ...primaryRun,
        status: polledRun.status,
        completed_at: polledRun.completed_at ?? primaryRun.completed_at,
        failed_at: polledRun.failed_at ?? primaryRun.failed_at,
      };
    }

    return primaryRun;
  }, [primaryRun, activeRunQuery.data?.run]);

  // Create coach run mutation
  const createRun = useCreateCoachRun({
    artifactPublicId,
    onSuccess: (run) => {
      // Automatically show the new run
      setSelectedRunId(run.id);
    },
  });

  // M3B: Check for active run based on current context.
  // CRITICAL: Use effectivePrimaryRun to account for polled status transitions.
  // When the polled run transitions to terminal, hasActiveRun must become false
  // to enable the Review button.
  const hasActiveRun = useMemo(() => {
    // First check: if the effective primary run is still active, return true immediately
    if (effectivePrimaryRun && isActiveRun(effectivePrimaryRun)) {
      // Verify it matches our context
      if (isInSectionContext && sectionContext) {
        if (
          effectivePrimaryRun.review_scope === 'section' &&
          effectivePrimaryRun.selected_section_key === sectionContext.sectionKey &&
          effectivePrimaryRun.content_version === currentContentVersion &&
          effectivePrimaryRun.requested_by.public_id === currentUserPublicId
        ) {
          return true;
        }
      } else {
        if (
          effectivePrimaryRun.review_scope === 'artifact' &&
          effectivePrimaryRun.content_version === currentContentVersion &&
          effectivePrimaryRun.requested_by.public_id === currentUserPublicId
        ) {
          return true;
        }
      }
    }

    // Fallback: check other runs in history (for edge cases like collaborator runs)
    if (isInSectionContext && sectionContext) {
      return runs.some(
        (r) =>
          r.id !== effectivePrimaryRun?.id && // Exclude effective primary (already checked)
          r.requested_by.public_id === currentUserPublicId &&
          r.content_version === currentContentVersion &&
          r.review_scope === 'section' &&
          r.selected_section_key === sectionContext.sectionKey &&
          isActiveRun(r),
      );
    }
    return runs.some(
      (r) =>
        r.id !== effectivePrimaryRun?.id && // Exclude effective primary (already checked)
        r.requested_by.public_id === currentUserPublicId &&
        r.content_version === currentContentVersion &&
        r.review_scope === 'artifact' &&
        isActiveRun(r),
    );
  }, [runs, currentUserPublicId, currentContentVersion, isInSectionContext, sectionContext, effectivePrimaryRun]);

  // M3B: Check if current version has a completed/failed run (for "Review again" label)
  // Use effectivePrimaryRun to account for polled status transitions.
  const hasCurrentVersionTerminalRun = useMemo(() => {
    // First check effective primary run
    if (
      effectivePrimaryRun &&
      effectivePrimaryRun.content_version === currentContentVersion &&
      (effectivePrimaryRun.status === 'completed' || effectivePrimaryRun.status === 'failed')
    ) {
      if (isInSectionContext && sectionContext) {
        if (
          effectivePrimaryRun.review_scope === 'section' &&
          effectivePrimaryRun.selected_section_key === sectionContext.sectionKey
        ) {
          return true;
        }
      } else if (effectivePrimaryRun.review_scope === 'artifact') {
        return true;
      }
    }

    // Fallback: check history
    if (isInSectionContext && sectionContext) {
      return runs.some(
        (r) =>
          r.id !== effectivePrimaryRun?.id &&
          r.content_version === currentContentVersion &&
          r.review_scope === 'section' &&
          r.selected_section_key === sectionContext.sectionKey &&
          (r.status === 'completed' || r.status === 'failed'),
      );
    }
    return runs.some(
      (r) =>
        r.id !== effectivePrimaryRun?.id &&
        r.content_version === currentContentVersion &&
        r.review_scope === 'artifact' &&
        (r.status === 'completed' || r.status === 'failed'),
    );
  }, [runs, currentContentVersion, isInSectionContext, sectionContext, effectivePrimaryRun]);

  // M3B: Handle create review (artifact or section)
  const handleCreateReview = useCallback(() => {
    if (isInSectionContext && sectionContext) {
      createRun.mutate({
        reviewScope: 'section',
        sectionKey: sectionContext.sectionKey,
      });
    } else {
      createRun.mutate({ reviewScope: 'artifact' });
    }
  }, [createRun, isInSectionContext, sectionContext]);

  // M3B: Handle back to artifact coaching
  const handleBackToArtifact = useCallback(() => {
    onSectionContextChange?.(null);
    setSelectedRunId(null);
  }, [onSectionContextChange]);

  // M3B: Handle return to remembered section
  const handleReturnToSection = useCallback(() => {
    if (rememberedSection) {
      onSectionContextChange?.(rememberedSection);
      setSelectedRunId(null);
    }
  }, [rememberedSection, onSectionContextChange]);

  // M3B: Get section label for display (from capabilities or fallback)
  const getSectionLabelFromCapabilities = useCallback(
    (sectionKey: string): string => {
      const section = capabilities?.coachable_sections?.find(
        (s) => s.section_key === sectionKey,
      );
      return section?.label ?? getSectionDisplayName(artifactType, sectionKey);
    },
    [capabilities, artifactType],
  );

  /**
   * M3B FIX: Handle history row selection with automatic context switching.
   *
   * When selecting a run from history:
   * - If run.review_scope === 'section': switch to that section's context
   * - If run.review_scope === 'artifact': switch to artifact context
   *
   * This ensures clicking a section history row from artifact context
   * navigates into the correct section context automatically.
   */
  const handleSelectRun = useCallback(
    (run: CoachRunSummaryResource) => {
      setSelectedRunId(run.id);

      // Switch context based on run scope
      if (run.review_scope === 'section' && run.selected_section_key) {
        // Navigate to section context
        const label = getSectionLabelFromCapabilities(run.selected_section_key);
        onSectionContextChange?.({
          sectionKey: run.selected_section_key,
          label,
        });
      } else if (run.review_scope === 'artifact') {
        // Navigate to artifact context (only if currently in section context)
        if (isInSectionContext) {
          onSectionContextChange?.(null);
        }
      }
    },
    [onSectionContextChange, isInSectionContext, getSectionLabelFromCapabilities],
  );

  // M3B: Determine action button label
  // CRITICAL: Never expose "artifact" to users — use "Research Brief"/"Research Plan"
  const actionButtonLabel = useMemo(() => {
    const displayName = getArtifactDisplayName(artifactType);
    if (isInSectionContext) {
      return hasCurrentVersionTerminalRun ? 'Review section again' : 'Review this section';
    }
    return hasCurrentVersionTerminalRun ? `Review ${displayName} again` : `Review ${displayName}`;
  }, [isInSectionContext, hasCurrentVersionTerminalRun, artifactType]);

  // M3B: Context label for status heading
  // CRITICAL: Never expose "artifact" to users — use "Research Brief"/"Research Plan"
  const contextLabel = isInSectionContext && sectionContext
    ? sectionContext.label
    : getArtifactDisplayName(artifactType);

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

  // Empty state - no coaching history (context-aware)
  if (displayedHistory.length === 0 && !effectivePrimaryRun) {
    return (
      <div className={styles.coachingRail}>
        <p className={styles.eyebrow}>AI Coach</p>

        {/* M3B: Section context header */}
        {isInSectionContext && sectionContext && (
          <div className={styles.sectionContextHeader}>
            <h3 className={styles.sectionContextLabel}>{sectionContext.label}</h3>
            <span className={styles.sectionContextTag}>Section review</span>
          </div>
        )}

        {/* M3B: Back to full document coaching (in section context) */}
        {isInSectionContext && (
          <button
            type="button"
            className={styles.backLink}
            onClick={handleBackToArtifact}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to {getArtifactDisplayName(artifactType)} coaching
          </button>
        )}

        <div className={styles.emptyState}>
          <Sparkles size={24} className={styles.emptyIcon} aria-hidden="true" />
          <h3 className={styles.emptyTitle}>
            {isInSectionContext
              ? 'No section reviews yet'
              : 'No coaching reviews yet'}
          </h3>
          <p className={styles.emptyBody}>
            Get AI-powered feedback on {isInSectionContext ? `this section` : `your ${contextLabel}`}.
          </p>
        </div>
        <div className={styles.actions}>
          <Button
            size="sm"
            onClick={handleCreateReview}
            disabled={createRun.isPending}
            loading={createRun.isPending}
          >
            {actionButtonLabel}
          </Button>
        </div>
      </div>
    );
  }

  // Has runs - show primary run and history
  return (
    <div className={styles.coachingRail}>
      <p className={styles.eyebrow}>AI Coach</p>

      {/* M3B: Section context header */}
      {isInSectionContext && sectionContext && (
        <div className={styles.sectionContextHeader}>
          <h3 className={styles.sectionContextLabel}>{sectionContext.label}</h3>
          <span className={styles.sectionContextTag}>Section review</span>
        </div>
      )}

      {/* M3B: Back to full document coaching (in section context) */}
      {isInSectionContext && (
        <button
          type="button"
          className={styles.backLink}
          onClick={handleBackToArtifact}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to {getArtifactDisplayName(artifactType)} coaching
        </button>
      )}

      {/* M3B: Return to section (in artifact context with remembered section) */}
      {!isInSectionContext && rememberedSection && (
        <button
          type="button"
          className={styles.returnLink}
          onClick={handleReturnToSection}
        >
          Return to {rememberedSection.label}
        </button>
      )}

      {/* Primary run display - uses effectivePrimaryRun for status to handle polled transitions */}
      {effectivePrimaryRun && (
        <>
          {/* Status heading with user-friendly copy */}
          {effectivePrimaryRun.status === 'pending' && (
            <>
              <h2 className={`${styles.status} ${styles.statusPending}`}>
                <span className={styles.spinner} aria-hidden="true" />{' '}
                Preparing your {isInSectionContext ? sectionContext?.label : contextLabel} review…
              </h2>
              <p className={styles.workingCopy}>
                You can keep working while Coach prepares your review.
              </p>
            </>
          )}
          {effectivePrimaryRun.status === 'running' && (
            <>
              <h2 className={`${styles.status} ${styles.statusRunning}`}>
                <span className={styles.spinner} aria-hidden="true" />{' '}
                Reviewing your {isInSectionContext ? sectionContext?.label : contextLabel}…
              </h2>
              <p className={styles.workingCopy}>
                You can keep working while Coach reviews your {isInSectionContext ? 'section' : artifactType}.
              </p>
            </>
          )}
          {effectivePrimaryRun.status === 'completed' && (
            <h2 className={`${styles.status} ${styles.statusCompleted}`}>
              Review complete
            </h2>
          )}
          {effectivePrimaryRun.status === 'failed' && (
            <h2 className={`${styles.status} ${styles.statusFailed}`}>
              Review couldn't be completed
            </h2>
          )}

          {/* Meta info */}
          <p className={styles.meta}>
            {effectivePrimaryRun.requested_by.display_name ?? 'Researcher'} ·{' '}
            {formatTimestamp(effectivePrimaryRun.requested_at)}
          </p>

          {/* Version badge */}
          <div style={{ marginTop: 'var(--space-2)' }}>
            <VersionBadge isCurrent={effectivePrimaryRun.is_current_version} />
          </div>

          {/* Completed run - show result */}
          {effectivePrimaryRun.status === 'completed' && displayedRun && (
            <StructuredResult run={displayedRun} />
          )}

          {/* Failed run - show error with safety copy */}
          {effectivePrimaryRun.status === 'failed' && (
            <div className={styles.failureMessage}>
              {displayedRun?.failure?.message ?? 'Coach couldn\'t complete this review.'}
              <p className={styles.failureSafetyCopy}>
                Your {isInSectionContext ? sectionContext?.label : contextLabel} wasn't changed. You can try again.
              </p>
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
          {actionButtonLabel}
        </Button>
      </div>

      {hasActiveRun && (
        <p id="active-run-hint" className={styles.meta}>
          A review is already in progress.
        </p>
      )}

      {/* History section */}
      {displayedHistory.length > 0 && (
        <div className={styles.historySection}>
          <h3 className={styles.historyLabel}>
            {isInSectionContext ? 'Section history' : 'History'}
          </h3>
          <ul className={styles.historyList} role="listbox" aria-label="Coaching history">
            {displayedHistory.map((run) => {
              // Use effective status for the primary run to reflect polled updates
              const effectiveStatus =
                effectivePrimaryRun && run.id === effectivePrimaryRun.id
                  ? effectivePrimaryRun.status
                  : run.status;

              return (
                <li
                  key={run.id}
                  className={`${styles.historyRow} ${
                    displayedRunId === run.id ? styles.historyRowSelected : ''
                  }`}
                  role="option"
                  aria-selected={displayedRunId === run.id}
                  aria-label={
                    run.review_scope === 'section'
                      ? `Open ${getSectionLabelFromCapabilities(run.selected_section_key!)} coaching review`
                      : `Open ${getArtifactDisplayName(artifactType)} coaching review`
                  }
                  tabIndex={0}
                  onClick={() => handleSelectRun(run)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectRun(run);
                    }
                  }}
                >
                  <div className={styles.historyRowHeader}>
                    <span className={styles.historyRowLabel}>
                      {run.review_scope === 'section'
                        ? `${getSectionLabelFromCapabilities(run.selected_section_key!)} review`
                        : `${getArtifactDisplayName(artifactType)} review`}
                    </span>
                    <StatusBadge status={effectiveStatus} />
                  </div>
                  <div className={styles.historyRowMeta}>
                    {run.requested_by.display_name ?? 'Researcher'} ·{' '}
                    {formatShortTimestamp(run.requested_at)}
                    {!run.is_current_version && ' · Earlier version'}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
