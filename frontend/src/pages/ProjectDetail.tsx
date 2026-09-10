/**
 * ProjectDetail — Project overview with studies list.
 * Empty-study state provides the UX-3A action to start first study + Brief.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Plus, BookOpen } from 'lucide-react';
import { useProject, useProjectStudies } from '@/api/queries/useProjects';
import { useCreateStudy } from '@/api/mutations/useCreateStudy';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import styles from './ProjectDetail.module.css';

export function ProjectDetail() {
  const { projectPublicId } = useParams<{ projectPublicId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectPublicId || '');
  const { data: studies, isLoading: studiesLoading, error: studiesError } = useProjectStudies(projectPublicId || '');
  const createStudy = useCreateStudy(projectPublicId || '');
  const [showNewStudy, setShowNewStudy] = useState(false);
  const [studyName, setStudyName] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  if (projectError) {
    return <ErrorState message="Could not load project." />;
  }

  if (projectLoading) {
    return <Skeleton variant="card" count={2} />;
  }

  if (!project) {
    return <ErrorState message="Project not found." />;
  }

  async function handleCreateStudy() {
    if (!studyName.trim()) return;
    setServerError(null);
    try {
      const study = await createStudy.mutateAsync({ name: studyName.trim() });
      navigate(`/studies/${study.public_id}/brief/new`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Could not create study.',
      );
    }
  }

  const hasStudies = studies && studies.length > 0;

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Projects', to: '/projects' },
          { label: project.name },
        ]}
        meta={<StatusBadge status={project.status} />}
        actions={
          !showNewStudy ? (
            <Button
              icon={<Plus size={16} />}
              onClick={() => setShowNewStudy(true)}
            >
              New study
            </Button>
          ) : undefined
        }
      />

      {project.problem_statement && (
        <p className={styles.problemStatement}>{project.problem_statement}</p>
      )}

      {/* New study inline form */}
      {showNewStudy && (
        <div className={styles.newStudyForm}>
          {serverError && (
            <Alert variant="error" title="Could not create study">
              {serverError}
            </Alert>
          )}
          <div className={styles.newStudyRow}>
            <Input
              label="Study name"
              placeholder="e.g., Claims Status Usability"
              value={studyName}
              onChange={(e) => setStudyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateStudy();
                }
              }}
            />
            <div className={styles.newStudyActions}>
              <Button
                onClick={handleCreateStudy}
                loading={createStudy.isPending}
                disabled={!studyName.trim()}
              >
                Create & start brief
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewStudy(false);
                  setStudyName('');
                  setServerError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Studies section */}
      <section aria-labelledby="studies-heading" className={styles.section}>
        <h2 id="studies-heading" className={styles.sectionHeading}>
          Studies
          {hasStudies && (
            <span className={styles.count}>{studies.length}</span>
          )}
        </h2>

        {studiesLoading ? (
          <Skeleton variant="card" count={2} />
        ) : studiesError ? (
          <ErrorState message="Could not load studies." />
        ) : !hasStudies ? (
          <EmptyState
            heading="No studies yet"
            description="Create your first study to begin a research brief."
            action={
              !showNewStudy ? (
                <Button
                  variant="secondary"
                  icon={<Plus size={16} />}
                  onClick={() => setShowNewStudy(true)}
                >
                  Start first study
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={styles.studyGrid}>
            {studies.map((study) => (
              <Card
                key={study.public_id}
                to={`/studies/${study.public_id}`}
                padding="compact"
              >
                <div className={styles.studyHeader}>
                  <BookOpen size={16} aria-hidden="true" />
                  <span className={styles.studyName}>{study.name}</span>
                </div>
                {study.brief_status && (
                  <StatusBadge status={study.brief_status} />
                )}
                <div className={styles.studyMeta}>
                  Created {new Date(study.created_at).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
