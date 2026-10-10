/**
 * DeskSourcesPage — DR-4d Sources tab for Desk Research.
 *
 * Per SPEC-2 §5 (DR03):
 * - Sources grouped by DiscoveryRun
 * - Extraction status inherited from run (D4)
 * - Processing/failure states
 * - Links to existing run/source views
 * - Protected sources (D9) show "in use" indicator
 */

import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  FileText,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useDiscoveryRuns, useDiscoveryArtifacts } from '@/api/queries/useDiscovery';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { DocumentSection } from '@/components/study/document';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DiscoveryRunSummary, DiscoveryArtifactSummary } from '@qori/api-contracts';
import styles from './DeskSourcesPage.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** Tab configuration */
type TabId = 'insights' | 'sources';

interface Tab {
  id: TabId;
  label: string;
  path: string;
}

const tabs: Tab[] = [
  { id: 'insights', label: 'Insights', path: '' },
  { id: 'sources', label: 'Sources', path: '/sources' },
];

/** Run status display configuration */
const RUN_STATUS_CONFIG: Record<
  DiscoveryRunSummary['status'],
  { icon: typeof CheckCircle; label: string; className: string }
> = {
  pending: { icon: Clock, label: 'Pending', className: 'statusPending' },
  processing: { icon: Loader2, label: 'Processing', className: 'statusProcessing' },
  completed: { icon: CheckCircle, label: 'Completed', className: 'statusCompleted' },
  failed: { icon: AlertCircle, label: 'Failed', className: 'statusFailed' },
  cancelled: { icon: AlertCircle, label: 'Cancelled', className: 'statusFailed' },
};

/** Group artifacts by run */
interface RunWithArtifacts {
  run: DiscoveryRunSummary;
  artifacts: DiscoveryArtifactSummary[];
}

function groupArtifactsByRun(
  runs: DiscoveryRunSummary[],
  artifacts: DiscoveryArtifactSummary[]
): RunWithArtifacts[] {
  const artifactsByRun = new Map<string, DiscoveryArtifactSummary[]>();

  for (const artifact of artifacts) {
    const runId = artifact.runPublicId;
    if (!artifactsByRun.has(runId)) {
      artifactsByRun.set(runId, []);
    }
    artifactsByRun.get(runId)!.push(artifact);
  }

  return runs
    .map((run) => ({
      run,
      artifacts: artifactsByRun.get(run.publicId) || [],
    }))
    .sort((a, b) => {
      // Failed runs first (needs your attention)
      if (a.run.status === 'failed' && b.run.status !== 'failed') return -1;
      if (b.run.status === 'failed' && a.run.status !== 'failed') return 1;
      // Then by date descending
      return new Date(b.run.createdAt).getTime() - new Date(a.run.createdAt).getTime();
    });
}

export function DeskSourcesPage() {
  const { studyPublicId, projectPublicId } = useStudyWorkspace();

  // Fetch runs filtered by desk_research type
  const runsQuery = useDiscoveryRuns(projectPublicId, { type: 'desk_research' }, {
    enabled: !!projectPublicId,
  });

  // Fetch all artifacts for desk research
  const artifactsQuery = useDiscoveryArtifacts(
    projectPublicId,
    { status: 'current', type: 'desk_research', limit: 200 },
    { enabled: !!projectPublicId }
  );

  // Group artifacts by run
  const runsWithArtifacts = useMemo(() => {
    if (!runsQuery.data || !artifactsQuery.data) return [];
    return groupArtifactsByRun(runsQuery.data, artifactsQuery.data);
  }, [runsQuery.data, artifactsQuery.data]);

  // Counts
  const totalSources = artifactsQuery.data?.length ?? 0;
  const totalRuns = runsQuery.data?.length ?? 0;
  const failedRuns = runsQuery.data?.filter((r) => r.status === 'failed').length ?? 0;

  // Loading state
  if (runsQuery.isLoading || artifactsQuery.isLoading) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <Skeleton variant="card" count={3} />
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Error state
  if (runsQuery.error || artifactsQuery.error) {
    const error = runsQuery.error || artifactsQuery.error;
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <div className={styles.masthead}>
              <div className={styles.mastheadMain}>
                <span className={styles.eyebrow}>Discovery › Desk research</span>
                <h1 className={styles.title}>Error loading sources</h1>
                <p className={styles.meta}>
                  {error instanceof Error ? error.message : 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          {/* Masthead */}
          <div className={styles.masthead}>
            <div className={styles.mastheadMain}>
              <span className={styles.eyebrow}>Discovery › Desk research</span>
              <h1 className={styles.title}>Sources</h1>
              <p className={styles.meta}>
                Project · {projectPublicId} — Shared by every study in this project.
              </p>
              {totalSources > 0 && (
                <p className={styles.statusLine}>
                  <span className={styles.count}>{totalSources}</span> source{totalSources !== 1 ? 's' : ''}
                  {' · '}
                  <span className={styles.count}>{totalRuns}</span> run{totalRuns !== 1 ? 's' : ''}
                  {failedRuns > 0 && (
                    <>
                      {' · '}
                      <span className={styles.needsReview}>{failedRuns} need attention</span>
                    </>
                  )}
                </p>
              )}
            </div>

            <div className={styles.mastheadActions}>
              <Link
                to={`/studies/${studyPublicId}/discovery/new/desk`}
                className={styles.addButton}
              >
                <Plus size={16} />
                Add sources
              </Link>
            </div>
          </div>

          {/* Header tabs */}
          <div className={styles.headerTabs} role="tablist">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={`/studies/${studyPublicId}/discovery/desk${tab.path}`}
                role="tab"
                aria-selected={tab.id === 'sources'}
                className={`${styles.headerTab} ${tab.id === 'sources' ? styles.headerTabActive : ''}`}
              >
                {tab.label}
                {tab.id === 'sources' && totalSources > 0 && (
                  <span className={styles.tabCount}>{totalSources}</span>
                )}
              </Link>
            ))}
          </div>

          {/* Empty state */}
          {totalRuns === 0 && (
            <div className={docStyles.emptyState}>
              <FileText size={32} className={docStyles.emptyIcon} aria-hidden="true" />
              <h2 className={docStyles.emptyTitle}>No sources yet</h2>
              <p className={docStyles.emptyDescription}>
                Upload reports, studies, policy documents, or other desk research.
                Qori will extract insights for you to review.
              </p>
              <Link
                to={`/studies/${studyPublicId}/discovery/new/desk`}
                className={docStyles.emptyAction}
              >
                Add sources →
              </Link>
            </div>
          )}

          {/* Needs attention section (failed runs) */}
          {failedRuns > 0 && (
            <DocumentSection
              sectionId="needs-attention"
              title={`1 · Needs your attention (${failedRuns})`}
            >
              <div className={styles.runsList}>
                {runsWithArtifacts
                  .filter((r) => r.run.status === 'failed')
                  .map(({ run, artifacts }) => (
                    <RunCard
                      key={run.publicId}
                      run={run}
                      artifacts={artifacts}
                      studyPublicId={studyPublicId}
                    />
                  ))}
              </div>
            </DocumentSection>
          )}

          {/* All runs section */}
          {totalRuns > 0 && (
            <DocumentSection
              sectionId="runs"
              title={`${failedRuns > 0 ? '2' : '1'} · Runs (${totalRuns})`}
            >
              <div className={styles.runsList}>
                {runsWithArtifacts
                  .filter((r) => r.run.status !== 'failed')
                  .map(({ run, artifacts }) => (
                    <RunCard
                      key={run.publicId}
                      run={run}
                      artifacts={artifacts}
                      studyPublicId={studyPublicId}
                    />
                  ))}
              </div>
            </DocumentSection>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}

/** Run card component */
interface RunCardProps {
  run: DiscoveryRunSummary;
  artifacts: DiscoveryArtifactSummary[];
  studyPublicId: string;
}

function RunCard({ run, artifacts, studyPublicId }: RunCardProps) {
  const statusConfig = RUN_STATUS_CONFIG[run.status];
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Link
      to={`/studies/${studyPublicId}/discovery/runs/${run.publicId}`}
      className={styles.runCard}
    >
      <div className={styles.runHeader}>
        <span className={styles.runName}>{run.topic || `Run ${run.publicId.slice(0, 8)}`}</span>
        <span className={`${styles.runStatus} ${styles[statusConfig.className]}`}>
          <StatusIcon
            size={14}
            aria-hidden="true"
            className={run.status === 'processing' ? styles.spinIcon : undefined}
          />
          {statusConfig.label}
        </span>
      </div>

      <div className={styles.runMeta}>
        <span>{formatDate(run.createdAt)}</span>
        <span>·</span>
        <span>{artifacts.length} source{artifacts.length !== 1 ? 's' : ''}</span>
        {/* Note: extractedInsightsCount not available on DiscoveryRunSummary - would need detail endpoint */}
      </div>

      {/* Show artifact titles preview */}
      {artifacts.length > 0 && (
        <div className={styles.runArtifacts}>
          {artifacts.slice(0, 3).map((artifact) => (
            <span key={artifact.publicId} className={styles.artifactName}>
              <FileText size={12} aria-hidden="true" />
              {artifact.title}
            </span>
          ))}
          {artifacts.length > 3 && (
            <span className={styles.artifactMore}>
              +{artifacts.length - 3} more
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
