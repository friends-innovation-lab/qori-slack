/**
 * Brief Form — 13-field contract with progressive disclosure.
 * Cascade-prefilled values show provenance. Discovery source picker.
 * Contract: research-brief.md
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStudy } from '@/api/queries/useStudy';
import { useSubmitBrief } from '@/api/mutations/useSubmitBrief';
import { PageHeader } from '@/components/shell/PageHeader';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { ResearchMethodology } from '@qori/api-contracts';
import styles from './BriefForm.module.css';

const methodologyOptions: Array<{ value: ResearchMethodology; label: string }> = [
  { value: 'usability_testing', label: 'Usability Testing' },
  { value: 'user_interviews', label: 'User Interviews' },
  { value: 'contextual_inquiry', label: 'Contextual Inquiry' },
  { value: 'concept_testing', label: 'Concept Testing' },
  { value: 'survey', label: 'Survey Research' },
  { value: 'card_sorting', label: 'Card Sorting' },
  { value: 'tree_testing', label: 'Tree Testing' },
  { value: 'mixed_methods', label: 'Mixed Methods' },
];

const schema = z.object({
  problem_statement: z.string().min(1, 'Problem statement is required'),
  learning_objectives: z.string().min(1, 'Learning objectives are required'),
  out_of_scope: z.string().optional().or(z.literal('')),
  methodology: z.string().min(1, 'Select a research method'),
  method_override: z.string().optional().or(z.literal('')),
  participant_approach: z.string().optional().or(z.literal('')),
  recruitment_sources: z.string().optional().or(z.literal('')),
  start_date: z.string().optional().or(z.literal('')),
  decision_deadline: z.string().optional().or(z.literal('')),
  budget: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function getNextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().split('T')[0];
}

export function BriefForm() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const navigate = useNavigate();
  const { data: study, isLoading: studyLoading, error: studyError } = useStudy(studyPublicId || '');
  const submitBrief = useSubmitBrief(study?.project_public_id || '');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      problem_statement: '',
      learning_objectives: '',
      out_of_scope: '',
      methodology: '',
      method_override: '',
      participant_approach: '',
      recruitment_sources: '',
      start_date: getNextMonday(),
      decision_deadline: '',
      budget: '',
    },
  });

  if (studyLoading) return <Skeleton variant="card" count={3} />;
  if (studyError || !study) {
    return <ErrorState message="Could not load study context." />;
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const result = await submitBrief.mutateAsync({
        problem_statement: values.problem_statement,
        learning_objectives: values.learning_objectives,
        out_of_scope: values.out_of_scope || undefined,
        methodology: values.methodology,
        method_override: values.method_override || undefined,
        participant_approach: values.participant_approach || undefined,
        recruitment_sources: values.recruitment_sources || undefined,
        start_date: values.start_date || undefined,
        decision_deadline: values.decision_deadline || undefined,
        budget: values.budget || undefined,
      });
      navigate(`/studies/${result.study_public_id}/brief`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Brief generation failed. Try again.',
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Research Brief"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: study.name, to: `/studies/${studyPublicId}` },
          { label: 'New brief' },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        {serverError && (
          <Alert variant="error" title="Brief generation failed">
            {serverError}
          </Alert>
        )}

        {/* Section: Research Focus */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Research Focus</legend>

          <Textarea
            label="What problem are you solving?"
            hint="This feeds all downstream AI generation."
            required
            error={errors.problem_statement?.message}
            {...register('problem_statement')}
          />

          <Textarea
            label="What will this research answer?"
            hint="Learning objectives — what you need to know."
            required
            error={errors.learning_objectives?.message}
            {...register('learning_objectives')}
          />

          <Textarea
            label="What's out of scope?"
            error={errors.out_of_scope?.message}
            {...register('out_of_scope')}
          />
        </fieldset>

        {/* Section: Method */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Method</legend>

          <Select
            label="What method fits best?"
            options={methodologyOptions}
            placeholder="Select method..."
            required
            error={errors.methodology?.message}
            {...register('methodology')}
          />

          <Input
            label="Custom method"
            hint="For combined or custom approaches not in the dropdown."
            placeholder="e.g., Card sorting + tree testing"
            error={errors.method_override?.message}
            {...register('method_override')}
          />
        </fieldset>

        {/* Section: Participants */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Participants</legend>

          <Textarea
            label="Who are you researching with?"
            placeholder="e.g., 8 Veterans, 50% using assistive technology..."
            error={errors.participant_approach?.message}
            {...register('participant_approach')}
          />

          <Input
            label="Recruitment sources"
            placeholder="e.g., Perigean Recruiting, VA Section 508 Office..."
            error={errors.recruitment_sources?.message}
            {...register('recruitment_sources')}
          />
        </fieldset>

        {/* Section: Timeline & Budget */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Timeline & Budget</legend>

          <div className={styles.row}>
            <Input
              label="When does research start?"
              type="date"
              error={errors.start_date?.message}
              {...register('start_date')}
            />

            <Input
              label="When do stakeholders need findings?"
              type="date"
              error={errors.decision_deadline?.message}
              {...register('decision_deadline')}
            />
          </div>

          <Input
            label="Budget"
            placeholder="e.g., $800 participant incentives"
            error={errors.budget?.message}
            {...register('budget')}
          />
        </fieldset>

        <div className={styles.actions}>
          <Button type="submit" loading={submitBrief.isPending}>
            Generate brief
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
