/**
 * DeskInsightsPage — DR-4d Insights list for Desk Research.
 *
 * Per SPEC-2 §1-2:
 * - Project-wide insights (D1: same list appears in every study)
 * - Header tabs: Insights n / Sources n
 * - Status groups: Proposed, Accepted, Rejected, Withdrawn
 * - Filter bar: status chips + source select (DR01)
 * - Empty state when no sources (DR02)
 * - Selecting a row opens InsightDetailPanel in ContextRail
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FileText, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useInsights,
  useInsight,
  useInsightRevisions,
  useInsightReviews,
  type InsightSummary,
} from '@/api/insights';
import type { EvidenceReference } from '@qori/api-contracts';

/** Status filter values (subset of InsightStatus that API filter accepts) */
type StatusFilterValue = 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'all';
import { useDiscoveryArtifacts } from '@/api/queries/useDiscovery';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  InsightRow,
  InsightDetailPanel,
  RevisionHistory,
  groupInsights,
  type InsightGroup,
} from '@/components/insights';
import styles from './DeskInsightsPage.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** Tab configuration */
type TabId = 'insights' | 'sources';

interface Tab {
  id: TabId;
  label: string;
  path: string;
}

const tabs: Tab[] = [
  { id: 'insights', label: 'Insights', path: '' },
  { id: 'sources', label: 'Sources', path: '/sources' },
];

/** Status filter options */
const STATUS_FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'proposed', label: 'Needs review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

/** Group display configuration */
const GROUP_CONFIG: Record<InsightGroup, { title: string; collapsible: boolean }> = {
  proposed: { title: 'Proposed', collapsible: false },
  accepted: { title: 'Accepted', collapsible: false },
  rejected: { title: 'Rejected', collapsible: true },
  withdrawn: { title: 'Withdrawn', collapsible: true },
};

export function DeskInsightsPage() {
  const { studyPublicId, projectPublicId } = useStudyWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state from URL params
  const statusFilter = (searchParams.get('status') as StatusFilterValue) || 'all';
  // DR-4d: Source filter uses numeric evidenceSourceId from insight evidence snapshots
  const sourceIdFilter = searchParams.get('sourceId');
  const sourceIdNum = sourceIdFilter ? parseInt(sourceIdFilter, 10) : undefined;
  const sourceLabelFilter = searchParams.get('sourceLabel') || null;

  // Selection state
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<InsightGroup>>(
    new Set(['rejected', 'withdrawn'])
  );

  // Refs for focus management
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Fetch insights with status and source filters
  // DR-4d: sourceId filter uses numeric ID from evidence snapshots
  const insightsQuery = useInsights(projectPublicId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    sourceId: sourceIdNum,
    limit: 100,
  });

  // Fetch selected insight detail
  const selectedInsight = useInsight(
    projectPublicId,
    selectedInsightId || ''
  );

  // Fetch revisions for selected insight
  const revisionsQuery = useInsightRevisions(
    projectPublicId,
    selectedInsightId || ''
  );

  // Fetch reviews for selected insight
  const reviewsQuery = useInsightReviews(
    projectPublicId,
    selectedInsightId || ''
  );

  // Fetch sources for filter dropdown
  const sourcesQuery = useDiscoveryArtifacts(
    projectPublicId,
    { status: 'current', type: 'desk_research', limit: 100 },
    { enabled: !!projectPublicId }
  );

  // Group insights by status
  const groupedInsights = useMemo(() => {
    if (!insightsQuery.data?.data) return null;
    return groupInsights(insightsQuery.data.data);
  }, [insightsQuery.data]);

  // Counts
  const totalCount = insightsQuery.data?.data?.length ?? 0;
  const sourceCount = sourcesQuery.data?.length ?? 0;
  const proposedCount = groupedInsights?.proposed.length ?? 0;

  // Update filter
  const updateFilter = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'all') {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, [setSearchParams]);

  // DR-4d: Set source filter from evidence reference
  const setSourceFilter = useCallback((sourceId: number, sourceLabel: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sourceId', String(sourceId));
      next.set('sourceLabel', sourceLabel);
      return next;
    });
  }, [setSearchParams]);

  // DR-4d: Clear source filter
  const clearSourceFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('sourceId');
      next.delete('sourceLabel');
      return next;
    });
  }, [setSearchParams]);

  // DR-4d: Handle source click from evidence reference - apply source filter
  const handleSourceClick = useCallback((reference: EvidenceReference) => {
    const label = reference.sourceLabel || `Source ${reference.evidenceSourceId}`;
    setSourceFilter(reference.evidenceSourceId, label);
  }, [setSourceFilter]);

  // Toggle group collapse
  const toggleGroup = useCallback((group: InsightGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  // Handle row selection
  const handleSelectInsight = useCallback((insight: InsightSummary) => {
    setSelectedInsightId(insight.publicId);
  }, []);

  // Handle panel close
  const handleClosePanel = useCallback(() => {
    setSelectedInsightId(null);
    // Return focus to the row
    if (selectedInsightId) {
      rowRefs.current.get(selectedInsightId)?.focus();
    }
  }, [selectedInsightId]);

  // Keyboard navigation within groups
  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, insights: InsightSummary[], currentIndex: number) => {
      let nextIndex = -1;

      switch (e.key) {
        case 'ArrowDown':
          nextIndex = Math.min(currentIndex + 1, insights.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'Escape':
          if (selectedInsightId) {
            handleClosePanel();
          }
          return;
        default:
          return;
      }

      if (nextIndex !== -1 && nextIndex !== currentIndex) {
        e.preventDefault();
        const nextInsight = insights[nextIndex];
        rowRefs.current.get(nextInsight.publicId)?.focus();
      }
    },
    [selectedInsightId, handleClosePanel]
  );

  // Check if we have sources
  const hasSources = sourceCount > 0;

  // Loading state
  if (insightsQuery.isLoading) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <Skeleton variant="card" count={3} />
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Error state
  if (insightsQuery.error) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <div className={styles.masthead}>
              <div className={styles.mastheadMain}>
                <span className={styles.eyebrow}>Discovery › Desk research</span>
                <h1 className={styles.title}>Error loading insights</h1>
                <p className={styles.meta}>
                  {insightsQuery.error instanceof Error
                    ? insightsQuery.error.message
                    : 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Render group section
  const renderGroup = (group: InsightGroup, insights: InsightSummary[]) => {
    if (insights.length === 0) return null;

    const config = GROUP_CONFIG[group];
    const isCollapsed = collapsedGroups.has(group);

    return (
      <section key={group} className={styles.insightGroup} aria-labelledby={`group-${group}-heading`}>
        <button
          type="button"
          id={`group-${group}-heading`}
          className={styles.groupHeader}
          onClick={() => config.collapsible && toggleGroup(group)}
          aria-expanded={!isCollapsed}
          disabled={!config.collapsible}
        >
          {config.collapsible && (
            isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />
          )}
          <span>{config.title}</span>
          <span className={styles.groupCount}>({insights.length})</span>
        </button>
        {!isCollapsed && (
          <div role="grid" aria-label={`${config.title} insights`}>
            {insights.map((insight, index) => (
              <InsightRow
                key={insight.publicId}
                ref={(el) => {
                  if (el) rowRefs.current.set(insight.publicId, el);
                }}
                insight={insight}
                selected={insight.publicId === selectedInsightId}
                onClick={() => handleSelectInsight(insight)}
                onKeyDown={(e) => handleRowKeyDown(e, insights, index)}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <WorkspaceLayout
      header={<div className={styles.headerSpacer} />}
      rail={
        selectedInsightId && selectedInsight.data ? (
          <div className={styles.insightPanel}>
            <InsightDetailPanel
              insight={selectedInsight.data}
              canEdit={true} // TODO DR-4e: Wire permissions
              onFilterBySource={handleSourceClick}
              onViewHistory={() => {
                // History is shown inline via RevisionHistory component
              }}
            />
            {revisionsQuery.data && reviewsQuery.data && (
              <div className={styles.revisionSection}>
                <h3 className={styles.revisionTitle}>
                  Revision History ({revisionsQuery.data.length})
                </h3>
                <RevisionHistory
                  revisions={revisionsQuery.data}
                  reviews={reviewsQuery.data}
                />
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          {/* Masthead */}
          <div className={styles.masthead}>
            <div className={styles.mastheadMain}>
              <span className={styles.eyebrow}>Discovery › Desk research</span>
              <h1 className={styles.title}>Insights</h1>
              <p className={styles.meta}>
                Project · {projectPublicId} — Shared by every study in this project.
              </p>
              {hasSources && (
                <p className={styles.statusLine}>
                  <span className={styles.count}>{totalCount}</span> insights
                  {proposedCount > 0 && (
                    <>
                      {' · '}
                      <span className={styles.needsReview}>{proposedCount} need review</span>
                    </>
                  )}
                </p>
              )}
            </div>

            <div className={styles.mastheadActions}>
              <Link
                to={`/studies/${studyPublicId}/discovery/new/desk`}
                className={styles.addButton}
              >
                <Plus size={16} />
                Add sources
              </Link>
            </div>
          </div>

          {/* Header tabs */}
          <div className={styles.headerTabs} role="tablist">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={`/studies/${studyPublicId}/discovery/desk${tab.path}`}
                role="tab"
                aria-selected={tab.id === 'insights'}
                className={`${styles.headerTab} ${tab.id === 'insights' ? styles.headerTabActive : ''}`}
              >
                {tab.label}
                {tab.id === 'insights' && totalCount > 0 && (
                  <span className={styles.tabCount}>{totalCount}</span>
                )}
                {tab.id === 'sources' && sourceCount > 0 && (
                  <span className={styles.tabCount}>{sourceCount}</span>
                )}
              </Link>
            ))}
          </div>

          {/* Empty state - no sources yet (DR02) */}
          {!hasSources && (
            <div className={docStyles.emptyState}>
              <FileText size={32} className={docStyles.emptyIcon} aria-hidden="true" />
              <h2 className={docStyles.emptyTitle}>No sources yet</h2>
              <p className={docStyles.emptyDescription}>
                Upload reports, studies, policy documents, or other desk research.
                Qori will extract insights for you to review.
              </p>
              <Link
                to={`/studies/${studyPublicId}/discovery/new/desk`}
                className={docStyles.emptyAction}
              >
                Add sources →
              </Link>
            </div>
          )}

          {/* Filter bar (DR01) */}
          {hasSources && (
            <div className={styles.filterBar}>
              <div className={styles.statusFilters} role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`${styles.statusChip} ${statusFilter === filter.value ? styles.statusChipActive : ''}`}
                    onClick={() => updateFilter('status', filter.value)}
                    aria-pressed={statusFilter === filter.value}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* DR-4d: Active source filter indicator with clear button */}
              {sourceIdNum && sourceLabelFilter && (
                <div className={styles.activeSourceFilter}>
                  <span className={styles.sourceFilterLabel}>
                    Source: {sourceLabelFilter}
                  </span>
                  <button
                    type="button"
                    className={styles.clearSourceFilter}
                    onClick={clearSourceFilter}
                    aria-label="Clear source filter"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Insights groups */}
          {hasSources && groupedInsights && (
            <>
              {renderGroup('proposed', groupedInsights.proposed)}
              {renderGroup('accepted', groupedInsights.accepted)}
              {renderGroup('rejected', groupedInsights.rejected)}
              {renderGroup('withdrawn', groupedInsights.withdrawn)}

              {totalCount === 0 && (
                <div className={styles.noResults}>
                  <p>No insights match your filters.</p>
                  <button
                    type="button"
                    className={styles.clearFilters}
                    onClick={() => setSearchParams(new URLSearchParams())}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
