/**
 * StudyWorkspaceLayout — NAV-1a
 *
 * Persistent study workspace shell for all routes under /studies/:studyPublicId/*.
 * Per STUDY_WORKSPACE_NAV_CORRECTION.md §2.
 *
 * Owns:
 * - Study data query (shared with all child routes via context)
 * - Brief status (for Plan lock)
 * - Discovery counts (for rail badges)
 * - Nav drawer state
 * - LifecycleRail rendering (ONCE, not per-page)
 *
 * Uses existing WorkspaceLayout for the actual shell structure.
 * Child routes render into <Outlet />.
 */

import { useState, useCallback, useMemo } from 'react';
import { useParams, Outlet } from 'react-router';
import { useStudy, useStudyBrief } from '@/api/queries/useStudy';
import { useDiscoveryCounts } from '@/api/queries/useDiscovery';
import { LifecycleRail, type DiscoveryCounts } from '@/components/study/LifecycleRail';
import { computeLifecycleNodes } from '@/components/study/lifecycle';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { StudyWorkspaceProvider, type StudyWorkspaceState } from './StudyWorkspaceContext';
import styles from './StudyWorkspaceLayout.module.css';

export function StudyWorkspaceLayout() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();

  // Nav drawer state (for responsive < 980px)
  const [navOpen, setNavOpen] = useState(false);
  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleNav = useCallback(() => setNavOpen((prev) => !prev), []);

  // Fetch study data (shared with all child routes)
  const {
    data: study,
    isLoading: studyLoading,
    error: studyError,
  } = useStudy(studyPublicId || '');

  // Fetch brief status (for Plan lock in lifecycle rail)
  const { data: brief } = useStudyBrief(studyPublicId || '');

  // Get project ID for Discovery API calls
  const projectPublicId = study?.project_public_id || '';

  // Fetch discovery counts (for rail badges)
  const countsResult = useDiscoveryCounts(projectPublicId, {
    enabled: !!projectPublicId,
  });

  // Build lifecycle rail counts
  const discoveryCounts: DiscoveryCounts | undefined = useMemo(() => {
    if (!countsResult.data) return undefined;
    return {
      desk: countsResult.data.desk,
      stakeholder: countsResult.data.stakeholder,
      survey: countsResult.data.survey,
      needsReview: countsResult.data.needsReview,
    };
  }, [countsResult.data]);

  // Get brief status for Plan lock
  // Priority: brief query > study.brief_status (brief query is more current)
  const briefStatus = brief?.brief_status ?? study?.brief_status ?? null;

  // Compute lifecycle nodes
  const lifecycleNodes = useMemo(
    () => computeLifecycleNodes(briefStatus),
    [briefStatus],
  );

  // Build context value
  const contextValue: StudyWorkspaceState = useMemo(
    () => ({
      studyPublicId: studyPublicId || '',
      projectPublicId,
      studyName: study?.name || '',
      briefStatus,
      lifecycleNodes,
      discoveryCounts,
      navOpen,
      openNav,
      closeNav,
      toggleNav,
      isLoading: studyLoading,
      error: studyError,
    }),
    [
      studyPublicId,
      projectPublicId,
      study?.name,
      briefStatus,
      lifecycleNodes,
      discoveryCounts,
      navOpen,
      openNav,
      closeNav,
      toggleNav,
      studyLoading,
      studyError,
    ],
  );

  // Study info for lifecycle rail
  const studyInfo = useMemo(
    () => ({
      name: study?.name || '',
      backTo: '/',
      backLabel: 'All studies',
    }),
    [study?.name],
  );

  // Loading state
  if (studyLoading) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loadingRail}>
          <Skeleton variant="card" count={1} />
        </div>
        <div className={styles.loadingContent}>
          <Skeleton variant="card" count={3} />
        </div>
      </div>
    );
  }

  // Error state
  if (studyError || !study) {
    return (
      <div className={styles.errorShell}>
        <ErrorState message={studyError?.message || 'Could not load study'} />
      </div>
    );
  }

  return (
    <StudyWorkspaceProvider value={contextValue}>
      <div className={styles.shell}>
        {/* Lifecycle rail - rendered ONCE for all study routes */}
        <aside className={`${styles.rail} ${navOpen ? styles.railOpen : ''}`}>
          <LifecycleRail
            variant="inverse"
            studyPublicId={studyPublicId || ''}
            nodes={lifecycleNodes}
            study={studyInfo}
            discoveryCounts={discoveryCounts}
          />
        </aside>

        {/* Scrim for mobile nav */}
        {navOpen && (
          <div
            className={styles.scrim}
            onClick={closeNav}
            aria-hidden="true"
          />
        )}

        {/* Content area - child routes render here */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </StudyWorkspaceProvider>
  );
}
