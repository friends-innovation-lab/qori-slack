/**
 * StudyOverview — Main research workspace shell + orientation tab.
 * Shows lifecycle rail, progress, needs-attention, at-a-glance metadata.
 */

import { useParams, Link } from 'react-router';
import { useStudy, useStudyBrief } from '@/api/queries/useStudy';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LifecycleRail } from '@/components/study/LifecycleRail';
import { computeLifecycleNodes } from '@/components/study/lifecycle';
import styles from './StudyOverview.module.css';

export function StudyOverview() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const { data: study, isLoading, error } = useStudy(studyPublicId || '');
  const { data: brief } = useStudyBrief(studyPublicId || '');

  if (isLoading) return <Skeleton variant="card" count={2} />;
  if (error || !study) return <ErrorState message="Could not load study." />;

  const lifecycleNodes = computeLifecycleNodes(study.brief_status);
  const briefApproved = study.brief_status === 'approved';
  const hasBrief = !!study.brief_status;

  return (
    <div className={styles.layout}>
      <LifecycleRail studyPublicId={studyPublicId!} nodes={lifecycleNodes} />

      <div className={styles.content}>
        <PageHeader
          title={study.name}
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: study.name },
          ]}
          meta={
            study.brief_status ? (
              <StatusBadge status={study.brief_status} />
            ) : undefined
          }
        />

        {/* Needs attention */}
        {study.brief_status === 'pending_approval' && (
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
              <dd>{study.status}</dd>
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}
