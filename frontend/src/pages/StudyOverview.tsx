/**
 * StudyOverview — NAV-1c S02 Design
 *
 * Study landing page with truthful lifecycle status.
 * Per STUDY_WORKSPACE_NAV_CORRECTION.md §S02.
 *
 * Content (two sections, no filler):
 * 1. Needs you: top 3 actionable items (brief approval, discovery review queue)
 * 2. Where this study is: one row per lifecycle group with status and action
 */

import { Link } from 'react-router';
import { useStudyWorkspace } from '@/components/study/workspace';
import { WorkspaceLayout } from '@/components/study/workspace';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  deriveAttentionItems,
  deriveLifecycleGroupStatuses,
  type BriefStatusValue,
} from '@/components/study/studyStatus';
import styles from './StudyOverview.module.css';

export function StudyOverview() {
  const {
    studyPublicId,
    studyName,
    briefStatus,
    discoveryCounts,
    isLoading,
    error,
  } = useStudyWorkspace();

  // Derive attention items from canonical state (neutral - no user assignment)
  const attentionItems = deriveAttentionItems(
    studyPublicId,
    briefStatus as BriefStatusValue,
    discoveryCounts,
  );

  // Derive lifecycle group statuses
  const lifecycleStatuses = deriveLifecycleGroupStatuses(
    studyPublicId,
    briefStatus as BriefStatusValue,
    discoveryCounts,
  );

  // Show more than 3 items link
  const hasMoreItems = attentionItems.length >= 3;

  return (
    <WorkspaceLayout
      header={
        <div className={styles.header}>
          <span className={styles.eyebrow}>Study</span>
          <h1 className={styles.title}>{studyName}</h1>
        </div>
      }
    >
      <div className={styles.content}>
        {/* Loading state */}
        {isLoading && <Skeleton variant="card" count={2} />}

        {/* Error state */}
        {error && (
          <div className={styles.errorState} role="alert">
            <p>Could not load study data.</p>
            <p className={styles.errorMessage}>{error.message}</p>
          </div>
        )}

        {/* Main content when loaded */}
        {!isLoading && !error && (
          <>
            {/* §1 Needs attention (neutral - no user assignment claim) */}
            {attentionItems.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Needs attention</h2>
                <div className={styles.needsYouList}>
                  {attentionItems.map((item) => (
                    <Link
                      key={item.id}
                      to={item.href}
                      className={styles.needsYouRow}
                    >
                      <div className={styles.needsYouContent}>
                        <span className={styles.needsYouLabel}>{item.label}</span>
                        {item.sublabel && (
                          <span className={styles.needsYouSublabel}>{item.sublabel}</span>
                        )}
                      </div>
                      <span className={styles.needsYouAction}>{item.action} →</span>
                    </Link>
                  ))}
                </div>
                {hasMoreItems && (
                  <Link
                    to={`/studies/${studyPublicId}/discovery`}
                    className={styles.seeAllLink}
                  >
                    See all in Discovery →
                  </Link>
                )}
              </section>
            )}

            {/* §2 Where this study is */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Where this study is</h2>
              <div className={styles.lifecycleGrid}>
                {lifecycleStatuses.map((group) => (
                  <div key={group.group} className={styles.lifecycleRow}>
                    <span className={styles.lifecycleGroup}>{group.group}</span>
                    <div className={styles.lifecycleStatus}>
                      <span className={styles.lifecycleStatusText}>{group.status}</span>
                      {group.statusMuted && (
                        <span className={styles.lifecycleStatusMuted}>{group.statusMuted}</span>
                      )}
                    </div>
                    <div className={styles.lifecycleAction}>
                      {group.action && (
                        <Link to={group.action.href} className={styles.lifecycleActionLink}>
                          {group.action.label} →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
}
