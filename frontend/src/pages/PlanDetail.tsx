/**
 * Plan Detail — Read view of the generated research plan.
 * No approval step — brief is the only gate.
 */

import { useParams, Link } from 'react-router';
import { useStudyPlan } from '@/api/queries/useStudy';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import styles from './PlanDetail.module.css';

export function PlanDetail() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const { data: plan, isLoading, error } = useStudyPlan(studyPublicId || '');

  if (isLoading) return <Skeleton variant="card" count={2} />;
  if (error || !plan) return <ErrorState message="Could not load plan." />;

  if (!plan.plan_url) {
    return (
      <>
        <PageHeader
          title="Research Plan"
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: plan.study.name, to: `/studies/${studyPublicId}` },
            { label: 'Plan' },
          ]}
        />
        <EmptyState
          heading="No plan yet"
          description="Create a research plan after your brief is approved."
          action={
            <Link to={`/studies/${studyPublicId}/plan/new`}>
              <Button>Create plan</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Research Plan"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: plan.study.name, to: `/studies/${studyPublicId}` },
          { label: 'Plan' },
        ]}
        meta={
          plan.plan_created_at ? (
            <span className="text-secondary">
              Created {new Date(plan.plan_created_at).toLocaleDateString()}
            </span>
          ) : undefined
        }
      />

      <div className={styles.content}>
        <Card>
          <a
            href={plan.plan_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.docLink}
          >
            View full plan on GitHub ↗
          </a>
        </Card>

        {/* Inherited context summary */}
        <Card>
          <h2 className={styles.sectionTitle}>Plan context</h2>
          <dl className={styles.fieldList}>
            {plan.inherited_context.research_objectives && (
              <>
                <dt>Objectives</dt>
                <dd>{plan.inherited_context.research_objectives}</dd>
              </>
            )}
            {plan.inherited_context.methodology_selection && (
              <>
                <dt>Methodology</dt>
                <dd>{plan.inherited_context.methodology_selection.replace(/_/g, ' ')}</dd>
              </>
            )}
            {plan.inherited_context.timeline_phases && (
              <>
                <dt>Timeline</dt>
                <dd>{plan.inherited_context.timeline_phases}</dd>
              </>
            )}
            {plan.inherited_context.participant_approach && (
              <>
                <dt>Participants</dt>
                <dd>{plan.inherited_context.participant_approach}</dd>
              </>
            )}
          </dl>
        </Card>
      </div>
    </>
  );
}
