/**
 * New Project — 3 required fields: name, problem statement, approver (optional).
 * Slug previews live below name. No wizard — single focused form.
 * Contract: qori-start.md
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateProject } from '@/api/mutations/useCreateProject';
import { PageHeader } from '@/components/shell/PageHeader';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import styles from './NewProject.module.css';

const schema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(80, 'Project name must be 80 characters or fewer'),
  problem_statement: z
    .string()
    .min(1, 'Problem statement is required. Discovery and briefs are derived against this.')
    .max(2000, 'Problem statement must be 2000 characters or fewer'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or fewer')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function NewProject() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', problem_statement: '', description: '' },
  });

  const nameValue = watch('name');
  const slug = toSlug(nameValue);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const project = await createProject.mutateAsync({
        name: values.name,
        problem_statement: values.problem_statement,
        description: values.description || undefined,
      });
      navigate(`/projects/${project.public_id}`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Could not create project. Try again.',
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Start research"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'New project' },
        ]}
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        {serverError && (
          <Alert variant="error" title="Could not create project">
            {serverError}
          </Alert>
        )}

        <Input
          label="Project name"
          placeholder="e.g., Mobile Scheduling Experience"
          maxLength={80}
          required
          error={errors.name?.message}
          {...register('name')}
        />

        {slug && (
          <div className={styles.slugPreview}>
            <span className="text-secondary">Project URL: </span>
            <code className="text-mono">{slug}</code>
          </div>
        )}

        <Textarea
          label="What problem are you trying to solve?"
          hint="The question this research needs to answer. Gaps and research questions are derived against this."
          placeholder="Veterans struggle to find their claim status online, leading to high call center volume..."
          maxLength={2000}
          required
          error={errors.problem_statement?.message}
          {...register('problem_statement')}
        />

        <Textarea
          label="Description"
          hint="Optional context about this research program."
          placeholder="Research supporting the mobile scheduling redesign initiative..."
          maxLength={500}
          error={errors.description?.message}
          {...register('description')}
        />

        <div className={styles.actions}>
          <Button type="submit" loading={createProject.isPending}>
            Create project
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/')}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
