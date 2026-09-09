/**
 * Plan Form — Exactly 2 direct fields. Everything else is inherited context.
 * Lead researcher (prefilled, reassignable) + operational risks (optional).
 * Contract: research-plan.md
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { useStudy, useStudyBrief, useCascadeReadiness } from '@/api/queries/useStudy';
import { useSubmitPlan } from '@/api/mutations/useSubmitPlan';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProvenanceField } from '@/components/ui/ProvenanceField';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import styles from './PlanForm.module.css';

interface FormValues {
  operational_risks: string;
}

export function PlanForm() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const { data: study, isLoading: studyLoading } = useStudy(studyPublicId || '');
  const { data: brief, isLoading: briefLoading } = useStudyBrief(studyPublicId || '');
  const { data: readiness, isLoading: readinessLoading } = useCascadeReadiness(studyPublicId || '');
  const submitPlan = useSubmitPlan(studyPublicId || '');
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { operational_risks: '' },
  });

  const isLoading = studyLoading || briefLoading || readinessLoading;

  if (isLoading) return <Skeleton variant="card" count={2} />;
  if (!study) return <ErrorState message="Could not load study." />;

  // Cascade readiness gate
  if (readiness && !readiness.ready) {
    return (
      <>
        <PageHeader
          title="Research Plan"
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: study.name, to: `/studies/${studyPublicId}` },
            { label: 'New plan' },
          ]}
        />
        <Alert variant="warning" title="Not ready yet">
          The research plan needs context from an approved brief. Missing:
          <ul style={{ marginTop: 'var(--space-2)' }}>
            {readiness.missing.map((m) => (
              <li key={m.variable}>
                <strong>{m.human_label}</strong> — {m.resolution_hint}
              </li>
            ))}
          </ul>
        </Alert>
      </>
    );
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await submitPlan.mutateAsync({
        operational_risks: values.operational_risks || undefined,
      });
      navigate(`/studies/${studyPublicId}/plan`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Plan generation failed. Try again.',
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Research Plan"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: study.name, to: `/studies/${studyPublicId}` },
          { label: 'New plan' },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        {serverError && (
          <Alert variant="error" title="Plan generation failed">
            {serverError}
          </Alert>
        )}

        {/* The two direct fields */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Plan details</legend>

          <ProvenanceField
            label="Lead researcher"
            provenanceLabel="From your session — change if someone else is leading"
            variant="prefilled"
            defaultValue={me?.actor.display_name || ''}
            readOnly
          />

          <Textarea
            label="Anything that could go wrong?"
            hint="Optional — operational risks, constraints, or concerns."
            {...register('operational_risks')}
          />
        </fieldset>

        {/* Inherited context (read-only) */}
        {brief && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Inherited from the approved brief</legend>

            {brief.cascade_fields.research_objectives && (
              <ProvenanceField
                label="Research objectives"
                provenanceLabel="From the approved brief"
                variant="derived"
                defaultValue={brief.cascade_fields.research_objectives}
              />
            )}

            {brief.cascade_fields.research_questions && (
              <ProvenanceField
                label="Research questions"
                provenanceLabel="From the approved brief"
                variant="derived"
                defaultValue={brief.cascade_fields.research_questions}
              />
            )}

            {brief.cascade_fields.methodology_selection && (
              <ProvenanceField
                label="Methodology"
                provenanceLabel="From the approved brief"
                variant="derived"
                defaultValue={brief.cascade_fields.methodology_selection.replace(/_/g, ' ')}
              />
            )}

            {brief.cascade_fields.participant_approach && (
              <ProvenanceField
                label="Participant approach"
                provenanceLabel="From the approved brief"
                variant="derived"
                defaultValue={brief.cascade_fields.participant_approach}
              />
            )}

            {brief.cascade_fields.start_date && (
              <ProvenanceField
                label="Start date"
                provenanceLabel="From the approved brief"
                variant="derived"
                defaultValue={brief.cascade_fields.start_date}
              />
            )}
          </fieldset>
        )}

        <div className={styles.actions}>
          <Button type="submit" loading={submitPlan.isPending}>
            Generate plan
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/studies/${studyPublicId}`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
