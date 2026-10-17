/**
 * DeskReadoutsPage — DR-6b-4c Readouts overview for Desk Research.
 *
 * Per DR-6b design spec (Rev 2):
 * - Study-scoped readouts list (RO01)
 * - Empty state when no readouts (RO02)
 * - Shared tabs: Insights / Sources / Desk readouts
 *
 * DR-6b-4c scope:
 * - Backend pagination support
 * - Loading, error/retry, empty, responsive states
 * - No "New readout" or "Generate" buttons
 *
 * DR-6b-4d: Rows now link to detail editor page.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { FileText, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReadoutsList } from '@/api/readouts';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { DeskTabs } from '@/components/discovery';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import type { ReadoutSummary } from '@/api/readouts';
import styles from './DeskReadoutsPage.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** Default page size */
const PAGE_SIZE = 20;

/** Format ISO date string for display */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Get status display for a readout */
function getStatusDisplay(readout: ReadoutSummary): {
  label: string;
  className: string;
} {
  if (readout.approvedAt && readout.approvedVersion !== null) {
    return {
      label: `Approved v${readout.approvedVersion}`,
      className: styles.statusApproved,
    };
  }
  return {
    label: 'Draft',
    className: styles.statusDraft,
  };
}

export function DeskReadoutsPage() {
  const { studyPublicId, projectPublicId } = useStudyWorkspace();
  const [offset, setOffset] = useState(0);

  // Fetch readouts for this study
  const readoutsQuery = useReadoutsList(projectPublicId, studyPublicId, {
    limit: PAGE_SIZE,
    offset,
  });

  const readouts = readoutsQuery.data?.data.readouts ?? [];
  const total = readoutsQuery.data?.data.total ?? 0;
  const hasMore = offset + readouts.length < total;
  const hasPrevious = offset > 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Pagination handlers
  const handleNextPage = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  const handlePreviousPage = useCallback(() => {
    setOffset((prev) => Math.max(0, prev - PAGE_SIZE));
  }, []);

  // Retry handler
  const handleRetry = useCallback(() => {
    readoutsQuery.refetch();
  }, [readoutsQuery]);

  // Loading state
  if (readoutsQuery.isLoading) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            {/* Masthead placeholder */}
            <div className={styles.masthead}>
              <div className={styles.mastheadMain}>
                <span className={styles.eyebrow}>Discovery &rsaquo; Desk research</span>
                <h1 className={styles.title}>Desk readouts</h1>
                <p className={styles.meta}>Project &middot; {projectPublicId}</p>
              </div>
            </div>

            <DeskTabs
              studyPublicId={studyPublicId}
              activeTab="readouts"
            />

            <Skeleton variant="card" count={3} />
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Error state
  if (readoutsQuery.error) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <div className={styles.masthead}>
              <div className={styles.mastheadMain}>
                <span className={styles.eyebrow}>Discovery &rsaquo; Desk research</span>
                <h1 className={styles.title}>Desk readouts</h1>
                <p className={styles.meta}>Project &middot; {projectPublicId}</p>
              </div>
            </div>

            <DeskTabs
              studyPublicId={studyPublicId}
              activeTab="readouts"
            />

            <div className={styles.errorState} role="alert">
              <AlertCircle size={32} className={styles.errorIcon} aria-hidden="true" />
              <h2 className={styles.errorTitle}>Failed to load readouts</h2>
              <p className={styles.errorDescription}>
                {readoutsQuery.error instanceof Error
                  ? readoutsQuery.error.message
                  : 'An unexpected error occurred'}
              </p>
              <Button variant="secondary" onClick={handleRetry}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Empty state
  if (readouts.length === 0 && offset === 0) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <div className={styles.masthead}>
              <div className={styles.mastheadMain}>
                <span className={styles.eyebrow}>Discovery &rsaquo; Desk research</span>
                <h1 className={styles.title}>Desk readouts</h1>
                <p className={styles.meta}>Project &middot; {projectPublicId}</p>
              </div>
            </div>

            <DeskTabs
              studyPublicId={studyPublicId}
              activeTab="readouts"
              counts={{ readouts: 0 }}
            />

            <div className={docStyles.emptyState}>
              <FileText size={32} className={docStyles.emptyIcon} aria-hidden="true" />
              <h2 className={docStyles.emptyTitle}>No readouts yet</h2>
              <p className={docStyles.emptyDescription}>
                Readouts synthesize your desk research insights into findings
                and implications for the Research Brief.
              </p>
              <Link
                to={`/studies/${studyPublicId}/discovery/desk`}
                className={docStyles.emptyAction}
              >
                Review insights first &rarr;
              </Link>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // List state
  return (
    <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          <div className={styles.masthead}>
            <div className={styles.mastheadMain}>
              <span className={styles.eyebrow}>Discovery &rsaquo; Desk research</span>
              <h1 className={styles.title}>Desk readouts</h1>
              <p className={styles.meta}>Project &middot; {projectPublicId}</p>
              {total > 0 && (
                <p className={styles.statusLine}>
                  <span className={styles.count}>{total}</span>{' '}
                  {total === 1 ? 'readout' : 'readouts'}
                </p>
              )}
            </div>
          </div>

          <DeskTabs
            studyPublicId={studyPublicId}
            activeTab="readouts"
            counts={{ readouts: total }}
          />

          {/* Readout list */}
          <div className={styles.readoutList} role="list" aria-label="Desk readouts">
            {readouts.map((readout) => {
              const status = getStatusDisplay(readout);
              return (
                <Link
                  key={readout.publicId}
                  to={`/studies/${studyPublicId}/discovery/desk/readouts/${readout.publicId}`}
                  className={styles.readoutRow}
                  role="listitem"
                >
                  <div className={styles.readoutMain}>
                    <span className={styles.readoutId}>{readout.displayId}</span>
                    <span className={styles.readoutTitle}>{readout.title}</span>
                  </div>
                  <div className={styles.readoutMeta}>
                    <span className={`${styles.readoutStatus} ${status.className}`}>
                      {status.label}
                    </span>
                    <span className={styles.readoutDate}>
                      {formatDate(readout.createdAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className={styles.pagination}
              aria-label="Readouts pagination"
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft size={16} />}
                onClick={handlePreviousPage}
                disabled={!hasPrevious}
                aria-label="Previous page"
              >
                Previous
              </Button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronRight size={16} />}
                onClick={handleNextPage}
                disabled={!hasMore}
                aria-label="Next page"
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
