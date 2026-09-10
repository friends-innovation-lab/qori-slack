/**
 * Projects — List of research projects the actor has access to.
 * Calls GET /api/v1/projects. Cards link to project detail by public_id.
 */

import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useProjects } from '@/api/queries/useProjects';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import styles from './Projects.module.css';

export function Projects() {
  const { data: projects, isLoading, error } = useProjects();

  if (error) {
    return (
      <ErrorState
        message="Could not load projects. Try refreshing."
        action={
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Projects"
        actions={
          <Link to="/projects/new">
            <Button icon={<Plus size={16} />}>New project</Button>
          </Link>
        }
      />

      {isLoading ? (
        <Skeleton variant="card" count={3} />
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          heading="No projects yet"
          description="Create your first research project to get started."
          action={
            <Link to="/projects/new">
              <Button variant="secondary" icon={<Plus size={16} />}>
                New project
              </Button>
            </Link>
          }
        />
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <Card
              key={project.public_id}
              to={`/projects/${project.public_id}`}
              padding="compact"
            >
              <div className={styles.cardHeader}>
                <span className={styles.name}>{project.name}</span>
                <StatusBadge status={project.status} />
              </div>
              {project.description && (
                <p className={styles.description}>{project.description}</p>
              )}
              <div className={styles.meta}>
                Created {new Date(project.created_at).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
