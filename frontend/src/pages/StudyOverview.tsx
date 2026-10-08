/**
 * StudyOverview — NAV-1c S02 Design
 *
 * Study landing page with truthful lifecycle status.
 * Per STUDY_WORKSPACE_NAV_CORRECTION.md §S02.
 *
 * Visual reference:
 *   design/workspace/workspace-v2/study-shell/screens/02 Study Overview.html
 *
 * Content (two sections, no filler):
 * 1. Needs attention: top 3 actionable items (brief approval, discovery review queue)
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
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Needs attention</h2>
                  <span className={styles.sectionCount}>{attentionItems.length}</span>
                </div>
                <ul className={styles.needsAttentionList}>
                  {attentionItems.map((item) => (
                    <li key={item.id}>
                      <Link to={item.href} className={styles.needsAttentionItem}>
                        <div className={styles.needsAttentionContent}>
                          <span className={styles.needsAttentionLabel}>{item.label}</span>
                          {item.sublabel && (
                            <span className={styles.needsAttentionSublabel}>{item.sublabel}</span>
                          )}
                        </div>
                        <span className={styles.needsAttentionAction}>{item.action} →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {attentionItems.length >= 3 && (
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
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Where this study is</h2>
              </div>
              <ul className={styles.lifecycleGrid}>
                {lifecycleStatuses.map((group) => {
                  // Dim rows without actions (unqueried groups showing "—")
                  const isDim = !group.action && group.status === '—';
                  const rowClassName = isDim
                    ? `${styles.lifecycleRow} ${styles.lifecycleRowDim}`
                    : styles.lifecycleRow;

                  return (
                    <li key={group.group} className={rowClassName}>
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
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
}
