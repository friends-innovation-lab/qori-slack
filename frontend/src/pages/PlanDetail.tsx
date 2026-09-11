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
import { ObjectivesList, QuestionsList, BarriersList, ScalarField } from '@/components/ui/CascadeFields';
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

        {/* Inherited context from Brief */}
        <Card>
          <h2 className={styles.sectionTitle}>
            Inherited from Brief
            <span className={styles.inheritedLabel}>read-only</span>
          </h2>
          <ObjectivesList raw={plan.inherited_context.research_objectives} />
          <QuestionsList raw={plan.inherited_context.research_questions} />
          <BarriersList raw={plan.inherited_context.target_barriers} />

          <dl className={styles.scalarGroup}>
            <ScalarField label="Methodology" value={plan.inherited_context.methodology_selection?.replace(/_/g, ' ') || null} />
            <ScalarField label="Participants" value={plan.inherited_context.participant_approach} />
            <ScalarField label="Timeline" value={plan.inherited_context.timeline_phases} />
            <ScalarField label="Compensation" value={plan.inherited_context.compensation} />
            <ScalarField label="Deliverables" value={plan.inherited_context.deliverables} />
          </dl>
        </Card>
      </div>
    </>
  );
}
