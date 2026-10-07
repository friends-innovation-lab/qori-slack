/**
 * DiscoveryRunPage — DISC-3
 *
 * NAV-1a: Removed page-level LifecycleRail — now owned by StudyWorkspaceLayout.
 *
 * Discovery run detail page with tabs: Report, Sources, Extracted.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §6, §8.
 *
 * States:
 * - Processing: Two-state fallback (Pending, Analyzing) since backend doesn't expose steps
 * - Failed: Show recovery options ("Upload files again" per DISC-2 content purge)
 * - Completed: Show artifact content with tabs
 */

import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router';
import { LoaderCircle, AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import {
  useDiscoveryRun,
  useDiscoveryArtifact,
  useArtifactVariables,
} from '@/api/queries/useDiscovery';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { DocumentSection, FactsGrid } from '@/components/study/document';
import { MarkdownDisplay } from '@/components/study/editor/MarkdownDisplay';
import { DiscoveryMarker } from '@/components/discovery';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { DiscoveryTypeKey, DiscoveryArtifactDetail } from '@qori/api-contracts';
import styles from './DiscoveryRunPage.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** Type labels */
const typeLabels: Record<DiscoveryTypeKey, string> = {
  desk_research: 'Desk Research',
  stakeholder_synthesis: 'Stakeholder Synthesis',
  survey_synthesis: 'Survey Synthesis',
};

/** Tab type */
type RunTab = 'report' | 'sources' | 'extracted';

/** Determine active tab from URL */
function getActiveTab(pathname: string): RunTab {
  if (pathname.endsWith('/sources')) return 'sources';
  if (pathname.endsWith('/extracted')) return 'extracted';
  return 'report';
}

export function DiscoveryRunPage() {
  // NAV-1a: Get study data from workspace context (loaded by layout)
  const {
    studyPublicId,
    projectPublicId,
  } = useStudyWorkspace();

  const { runId } = useParams<{ runId: string }>();
  const location = useLocation();

  const activeTab = getActiveTab(location.pathname);

  // DISC-3: Poll for status updates when run is pending/processing.
  const [pollingEnabled, setPollingEnabled] = useState(true);

  // Fetch run with conditional polling
  const runQuery = useDiscoveryRun(projectPublicId, runId || '', {
    enabled: !!projectPublicId && !!runId,
    // Poll every 2s while polling is enabled (based on status)
    refetchInterval: pollingEnabled ? 2000 : false,
  });

  // Stop polling once run completes or fails
  useEffect(() => {
    const status = runQuery.data?.status;
    if (status && status !== 'pending' && status !== 'processing') {
      setPollingEnabled(false);
    }
  }, [runQuery.data?.status]);

  // Fetch artifact detail for canonical content (Report tab)
  const artifactPublicId = runQuery.data?.currentArtifact?.publicId;
  const artifactQuery = useDiscoveryArtifact(projectPublicId, artifactPublicId || '', {
    enabled: !!projectPublicId && !!artifactPublicId && activeTab === 'report',
  });

  // Fetch variables for the artifact (Extracted tab)
  const variablesQuery = useArtifactVariables(projectPublicId, artifactPublicId || '', {
    enabled: !!projectPublicId && !!artifactPublicId && activeTab === 'extracted',
  });

  // Handle polling updates - refetch effect
  const run = runQuery.data;
  const isProcessing = run?.status === 'pending' || run?.status === 'processing';

  // Loading state
  if (runQuery.isLoading) {
    return <Skeleton variant="card" count={3} />;
  }

  // Error state
  if (runQuery.error || !run) {
    return <ErrorState message={runQuery.error?.message || 'Could not load run'} />;
  }

  // Build tabs based on URL
  const basePath = `/studies/${studyPublicId}/discovery/runs/${runId}`;

  return (
    <WorkspaceLayout
      // NAV-1a: nav prop removed — LifecycleRail owned by StudyWorkspaceLayout
      header={
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.eyebrow}>
              <span>{typeLabels[run.discoveryType]}</span>
              {run.marker && (
                <DiscoveryMarker
                  marker={run.marker}
                  name={run.topic}
                  type={run.discoveryType}
                />
              )}
            </div>
            <h1 className={styles.title}>{run.topic}</h1>
            <div className={styles.meta}>
              <StatusBadge status={run.status} />
              {run.sourceIntent && (
                <span className={styles.intent}>{run.sourceIntent}</span>
              )}
            </div>
          </div>

          {/* Tabs (only show for completed runs) */}
          {run.status === 'completed' && (
            <nav className={styles.tabs} aria-label="Run sections">
              <Link
                to={basePath}
                className={`${styles.tab} ${activeTab === 'report' ? styles.tabActive : ''}`}
                aria-current={activeTab === 'report' ? 'page' : undefined}
              >
                Report
              </Link>
              <Link
                to={`${basePath}/sources`}
                className={`${styles.tab} ${activeTab === 'sources' ? styles.tabActive : ''}`}
                aria-current={activeTab === 'sources' ? 'page' : undefined}
              >
                Sources
              </Link>
              <Link
                to={`${basePath}/extracted`}
                className={`${styles.tab} ${activeTab === 'extracted' ? styles.tabActive : ''}`}
                aria-current={activeTab === 'extracted' ? 'page' : undefined}
              >
                Extracted
              </Link>
            </nav>
          )}
        </div>
      }
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          {/* Processing state */}
          {isProcessing && (
            <ProcessingState status={run.status} />
          )}

          {/* Failed state */}
          {run.status === 'failed' && (
            <FailedState
              failureCode={run.failureCode}
              failureMessage={run.failureMessage}
              discoveryType={run.discoveryType}
              studyPublicId={studyPublicId}
            />
          )}

          {/* Completed state - show content based on tab */}
          {run.status === 'completed' && (
            <>
              {activeTab === 'report' && (
                <ReportTab
                  run={run}
                  artifact={artifactQuery.data}
                  isLoading={artifactQuery.isLoading}
                  error={artifactQuery.error}
                />
              )}
              {activeTab === 'sources' && (
                <SourcesTab sources={run.sources} />
              )}
              {activeTab === 'extracted' && (
                <ExtractedTab variables={variablesQuery.data} isLoading={variablesQuery.isLoading} />
              )}
            </>
          )}

          {/* Cancelled state */}
          {run.status === 'cancelled' && (
            <Alert variant="warning" title="Run cancelled">
              This run was cancelled before completion.
            </Alert>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}

/** Processing state component */
function ProcessingState({ status }: { status: string }) {
  // Two-state fallback per DISCOVERY_REDLINES.md B9
  const label = status === 'pending' ? 'Pending' : 'Analyzing';
  const description =
    status === 'pending'
      ? 'Qori is preparing to analyze your files...'
      : 'Qori is analyzing your files and extracting insights...';

  return (
    <div className={styles.processingState} role="status">
      <LoaderCircle size={32} className={styles.spinner} aria-hidden="true" />
      <h2 className={styles.processingTitle}>{label}</h2>
      <p className={styles.processingDescription}>{description}</p>
      <p className={styles.processingHint}>This usually takes 1-2 minutes.</p>
    </div>
  );
}

/** Failed state component */
function FailedState({
  failureCode,
  failureMessage,
  discoveryType,
  studyPublicId,
}: {
  failureCode: string | null;
  failureMessage: string | null;
  discoveryType: DiscoveryTypeKey;
  studyPublicId: string;
}) {
  // DISC-2: Prepared content is purged on failure, so offer "Upload files again"
  const intakePath =
    discoveryType === 'desk_research'
      ? `/studies/${studyPublicId}/discovery/new/desk`
      : `/studies/${studyPublicId}/discovery/new/stakeholder`;

  return (
    <div className={styles.failedState}>
      <div className={styles.failedIcon}>
        <AlertTriangle size={32} aria-hidden="true" />
      </div>
      <h2 className={styles.failedTitle}>Analysis failed</h2>
      <p className={styles.failedDescription}>
        {failureMessage || 'An error occurred while analyzing your files.'}
      </p>
      {failureCode && (
        <p className={styles.failedCode}>Error code: {failureCode}</p>
      )}
      <div className={styles.failedActions}>
        <Link to={intakePath} className={styles.actionLink}>
          <RefreshCw size={14} aria-hidden="true" />
          Upload files again
        </Link>
        <Link to={`/studies/${studyPublicId}/discovery`} className={styles.actionLinkSecondary}>
          Back to Discovery
        </Link>
      </div>
    </div>
  );
}

/** Report tab content */
function ReportTab({
  run,
  artifact,
  isLoading,
  error,
}: {
  run: NonNullable<ReturnType<typeof useDiscoveryRun>['data']>;
  artifact: DiscoveryArtifactDetail | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const artifactSummary = run.currentArtifact;

  if (!artifactSummary) {
    return (
      <Alert variant="info" title="No report yet">
        The analysis is still in progress.
      </Alert>
    );
  }

  // Quick facts for the masthead
  const facts = [
    { label: 'Sources', value: String(run.sourceCount), exists: true },
    { label: 'Version', value: String(artifactSummary.version), exists: true },
    {
      label: 'Generated',
      value: new Date(artifactSummary.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      exists: true,
    },
  ];

  // Loading state for artifact content
  if (isLoading) {
    return (
      <>
        <FactsGrid facts={facts} />
        <Skeleton variant="card" count={2} />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <FactsGrid facts={facts} />
        <Alert variant="error" title="Could not load report">
          {error.message}
        </Alert>
      </>
    );
  }

  // Render canonical content with MarkdownDisplay
  const canonicalContent = artifact?.canonicalContent;

  return (
    <>
      <FactsGrid facts={facts} />

      {canonicalContent ? (
        <article className={docStyles.prose}>
          <MarkdownDisplay markdown={canonicalContent} />
        </article>
      ) : (
        <Alert variant="info" title="No content">
          This artifact has no canonical content.
        </Alert>
      )}
    </>
  );
}

/** Sources tab content */
function SourcesTab({
  sources,
}: {
  sources: Array<{ publicId: string; label: string; sourceType: string; order: number }>;
}) {
  if (sources.length === 0) {
    return (
      <Alert variant="info" title="No sources">
        No source files found for this run.
      </Alert>
    );
  }

  return (
    <DocumentSection sectionId="sources" title={`Sources (${sources.length})`}>
      <ul className={styles.sourcesList}>
        {sources.map((source) => (
          <li key={source.publicId} className={styles.sourceItem}>
            <FileText size={16} aria-hidden="true" />
            <span className={styles.sourceLabel}>{source.label}</span>
            <span className={styles.sourceType}>{source.sourceType}</span>
          </li>
        ))}
      </ul>
    </DocumentSection>
  );
}

/** Extracted tab content */
function ExtractedTab({
  variables,
  isLoading,
}: {
  variables: ReturnType<typeof useArtifactVariables>['data'];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton variant="card" count={2} />;
  }

  if (!variables || variables.variables.length === 0) {
    return (
      <Alert variant="info" title="No extracted variables">
        No cascade variables were extracted from this artifact.
      </Alert>
    );
  }

  return (
    <DocumentSection
      sectionId="extracted"
      title={`Extracted variables (${variables.variableCount})`}
    >
      <p className={docStyles.block}>
        These variables can be cascaded into the Research Brief and other downstream artifacts.
      </p>
      <ul className={styles.variablesList}>
        {variables.variables.map((variable, index) => (
          <li key={variable.key || index} className={styles.variableItem}>
            <span className={styles.variableLabel}>{variable.label}</span>
            <span className={styles.variableValue}>
              {typeof variable.value === 'string'
                ? variable.value
                : JSON.stringify(variable.value, null, 2)}
            </span>
          </li>
        ))}
      </ul>
    </DocumentSection>
  );
}
