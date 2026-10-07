/**
 * StudyOverview — Study orientation page.
 * NAV-1a: Now renders inside StudyWorkspaceLayout (no page-level rail).
 *
 * Shows: progress, needs-attention, at-a-glance metadata.
 */

import { Link } from 'react-router';
import { useStudyBrief } from '@/api/queries/useStudy';
import { useStudyWorkspace } from '@/components/study/workspace';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import styles from './StudyOverview.module.css';

export function StudyOverview() {
  // NAV-1a: Get study data from workspace context (loaded by layout)
  const {
    studyPublicId,
    studyName,
    briefStatus,
  } = useStudyWorkspace();

  // Fetch brief for "At a glance" section
  const { data: brief } = useStudyBrief(studyPublicId);

  const briefApproved = briefStatus === 'approved';
  const hasBrief = !!briefStatus;

  return (
    <div className={styles.content}>
      <PageHeader
        title={studyName}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: studyName },
        ]}
        meta={
          briefStatus ? (
            <StatusBadge status={briefStatus} />
          ) : undefined
        }
      />

      {/* Needs attention */}
      {briefStatus === 'pending_approval' && (
        <Card padding="compact" className={styles.attentionCard}>
          <div className={styles.attentionRow}>
            <span>Brief needs approval</span>
            <Link to={`/studies/${studyPublicId}/brief`}>
              <Button variant="secondary">Review</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* What next */}
      {!hasBrief && (
        <EmptyState
          heading="Ready to define your research"
          description="Create a research brief to define what you'll study, why, and how."
          action={
            <Link to={`/studies/${studyPublicId}/brief/new`}>
              <Button>Create brief</Button>
            </Link>
          }
        />
      )}

      {briefApproved && (
        <Card>
          <h2 className={styles.sectionTitle}>Next step</h2>
          <p>
            Your brief has been approved. Create a research plan to outline
            the operational details.
          </p>
          <div className={styles.nextAction}>
            <Link to={`/studies/${studyPublicId}/plan/new`}>
              <Button>Create research plan</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* At a glance */}
      {brief && (
        <Card className={styles.glanceCard}>
          <h2 className={styles.sectionTitle}>At a glance</h2>
          <dl className={styles.glanceList}>
            {brief.cascade_fields.methodology_selection && (
              <>
                <dt>Method</dt>
                <dd>{brief.cascade_fields.methodology_selection.replace(/_/g, ' ')}</dd>
              </>
            )}
            {brief.cascade_fields.start_date && (
              <>
                <dt>Start date</dt>
                <dd>{brief.cascade_fields.start_date}</dd>
              </>
            )}
            <dt>Status</dt>
            <dd>{briefStatus || 'Not started'}</dd>
          </dl>
        </Card>
      )}
    </div>
  );
}
