/**
 * Home — Research portfolio. Immediately useful start.
 * Panels: Needs your review (queue), Active studies, Start research.
 */

import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useHome } from '@/api/queries/useHome';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import styles from './Home.module.css';

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function Home() {
  const { me } = useAuth();
  const { data: home, isLoading, error } = useHome();

  const firstName = me?.actor.display_name?.split(' ')[0] || 'there';

  if (error) {
    return (
      <ErrorState
        message="Could not load your home page. Try refreshing."
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
        title={`Hello, ${firstName}`}
        meta={<span>{formatDate()}</span>}
        actions={
          <Link to="/projects/new">
            <Button icon={<Plus size={16} />}>Start research</Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className={styles.panels}>
          <Skeleton variant="card" count={3} />
        </div>
      ) : !home ? null : (
        <div className={styles.panels}>
          {/* Queue preview — only if items exist */}
          {home.queue_preview.length > 0 && (
            <section aria-labelledby="queue-heading" className={styles.panel}>
              <h2 id="queue-heading" className={styles.panelHeading}>
                Needs your review
                <span className={styles.count}>{home.queue_preview.length}</span>
              </h2>
              <ul className={styles.queueList}>
                {home.queue_preview.map((item) => (
                  <li key={item.id} className={styles.queueItem}>
                    <div className={styles.queueStatement}>{item.statement}</div>
                    <Link to={item.action_route} className={styles.queueAction}>
                      {item.action_label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Active studies */}
          <section aria-labelledby="studies-heading" className={styles.panel}>
            <h2 id="studies-heading" className={styles.panelHeading}>
              Active studies
            </h2>
            {home.active_studies.length === 0 ? (
              <EmptyState
                heading="No active studies"
                description="Start a new research project to begin your first study."
                action={
                  <Link to="/projects/new">
                    <Button variant="secondary" icon={<Plus size={16} />}>
                      Start research
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className={styles.studyGrid}>
                {home.active_studies.map((study) => (
                  <Card
                    key={study.public_id}
                    to={`/studies/${study.public_id}`}
                    padding="compact"
                  >
                    <div className={styles.studyCardHeader}>
                      <span className={styles.studyName}>{study.name}</span>
                      {study.brief_status && (
                        <StatusBadge status={study.brief_status} />
                      )}
                    </div>
                    <div className={styles.studyMeta}>
                      {study.project_name}
                    </div>
                    {study.next_action && (
                      <div className={styles.nextAction}>
                        Next: {study.next_action}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Recent activity */}
          {home.recent_activity.length > 0 && (
            <section aria-labelledby="activity-heading" className={styles.panel}>
              <h2 id="activity-heading" className={styles.panelHeading}>
                Recent activity
              </h2>
              <ul className={styles.activityList}>
                {home.recent_activity.map((event) => (
                  <li key={event.id} className={styles.activityItem}>
                    <span>{event.description}</span>
                    <span className="text-meta">
                      {new Date(event.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
