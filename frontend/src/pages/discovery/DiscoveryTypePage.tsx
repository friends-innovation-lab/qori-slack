/**
 * DiscoveryTypePage — NAV-1b
 *
 * Type-specific Discovery page showing runs of a single type.
 * Per STUDY_WORKSPACE_NAV_CORRECTION.md §S04, §S05.
 *
 * Routes:
 * - /studies/:studyPublicId/discovery/desk → Desk research
 * - /studies/:studyPublicId/discovery/stakeholders → Stakeholders
 * - /studies/:studyPublicId/discovery/surveys → Surveys
 *
 * Content:
 * - Type-specific header with add action
 * - Needs your review (this type only, if any)
 * - Runs (ungrouped RunLedgerTable)
 * - Empty state (per-type explainer)
 */

import { useMemo } from 'react';
import { Link, useLocation } from 'react-router';
import { FileText, Users, BarChart2 } from 'lucide-react';
import {
  useDiscoveryRuns,
  useDiscoveryArtifacts,
} from '@/api/queries/useDiscovery';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { DocumentSection } from '@/components/study/document';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { RunLedgerTable, ReviewQueue } from '@/components/discovery';
import type { DiscoveryTypeKey } from '@qori/api-contracts';
import type { DiscoveryTypeFilter } from '@/components/study/workspaceLifecycle';
import styles from './DiscoveryHub.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** Route param to discovery type mapping */
const typeParamMap: Record<string, DiscoveryTypeFilter> = {
  desk: 'desk',
  stakeholders: 'stakeholder',
  surveys: 'survey',
};

/** Discovery filter to API type mapping */
const filterToApiType: Record<DiscoveryTypeFilter, DiscoveryTypeKey> = {
  desk: 'desk_research',
  stakeholder: 'stakeholder_synthesis',
  survey: 'survey_synthesis',
};

/** Type configuration */
interface TypeConfig {
  label: string;
  description: string;
  icon: typeof FileText;
  addPath: string | null;
  addLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}

const typeConfigs: Record<DiscoveryTypeFilter, TypeConfig> = {
  desk: {
    label: 'Desk research',
    description: 'Reports, policies, prior studies, and other documents',
    icon: FileText,
    addPath: '/discovery/new/desk',
    addLabel: 'Add documents',
    emptyTitle: 'No desk research yet',
    emptyDescription: 'Upload reports, studies, policy documents, or other desk research to analyze.',
  },
  stakeholder: {
    label: 'Stakeholders',
    description: 'Interview transcripts, meeting notes, and stakeholder feedback',
    icon: Users,
    addPath: '/discovery/new/stakeholder',
    addLabel: 'Add material',
    emptyTitle: 'No stakeholder material yet',
    emptyDescription: 'Upload interview transcripts, meeting notes, or stakeholder feedback to synthesize.',
  },
  survey: {
    label: 'Surveys',
    description: 'Survey response data for analysis',
    icon: BarChart2,
    addPath: null, // DISC-4: Survey intake not yet available
    addLabel: 'Add survey data',
    emptyTitle: 'No survey data yet',
    emptyDescription: 'Survey analysis is coming soon.',
  },
};

/** Extract type from pathname */
function getTypeFromPath(pathname: string): string | undefined {
  // Match /discovery/desk, /discovery/stakeholders, /discovery/surveys
  const match = pathname.match(/\/discovery\/(desk|stakeholders|surveys)(?:\/|$)/);
  return match ? match[1] : undefined;
}

export function DiscoveryTypePage() {
  const { studyPublicId, projectPublicId } = useStudyWorkspace();
  const location = useLocation();

  // Get type from pathname (e.g., /discovery/desk -> desk)
  const typeFromPath = getTypeFromPath(location.pathname);

  // Map path segment to filter type
  const filterType = typeFromPath ? typeParamMap[typeFromPath] : undefined;
  const apiType = filterType ? filterToApiType[filterType] : undefined;
  const config = filterType ? typeConfigs[filterType] : undefined;

  // Fetch runs filtered by type
  const runsQuery = useDiscoveryRuns(
    projectPublicId,
    apiType ? { type: apiType } : undefined,
    {
      enabled: !!projectPublicId && !!apiType,
      refetchInterval: undefined, // Could add polling for pending runs
    },
  );

  // Fetch artifacts for status counts
  const artifactsQuery = useDiscoveryArtifacts(
    projectPublicId,
    { status: 'current', type: apiType, limit: 100 },
    { enabled: !!projectPublicId && !!apiType },
  );

  // Check if there's any data
  const hasRuns = runsQuery.data && runsQuery.data.length > 0;
  const artifactCount = artifactsQuery.data?.length ?? 0;

  // Filter runs that need review
  const needsReviewRuns = useMemo(() => {
    if (!runsQuery.data) return [];
    return runsQuery.data.filter((run) => run.status === 'failed');
  }, [runsQuery.data]);

  // Section numbering: only count rendered sections
  const getSectionNumber = (sectionIndex: number) => {
    let num = 1;
    if (needsReviewRuns.length > 0 && sectionIndex > 0) {
      num += 1;
    }
    return num + sectionIndex;
  };

  // Handle invalid type param
  if (!filterType || !config) {
    return (
      <WorkspaceLayout header={<div className={styles.header}><h1>Not found</h1></div>}>
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <p>Unknown discovery type.</p>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  const Icon = config.icon;

  return (
    <WorkspaceLayout
      header={
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <span className={styles.eyebrow}>Discovery</span>
            <h1 className={styles.title}>{config.label}</h1>
            <p className={styles.meta}>{config.description}</p>
            {hasRuns && (
              <p className={styles.statusLine}>
                <span className={styles.count}>{artifactCount}</span> {artifactCount === 1 ? 'artifact' : 'artifacts'}
                {needsReviewRuns.length > 0 && (
                  <>
                    {' · '}
                    <span className={styles.count}>{needsReviewRuns.length}</span> needs review
                  </>
                )}
              </p>
            )}
          </div>

          <div className={styles.headerActions}>
            {config.addPath ? (
              <Link
                to={`/studies/${studyPublicId}${config.addPath}`}
                className={styles.addButton}
              >
                {config.addLabel}
              </Link>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                Coming soon
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          {/* Loading state */}
          {runsQuery.isLoading && <Skeleton variant="card" count={2} />}

          {/* Empty state */}
          {!hasRuns && !runsQuery.isLoading && (
            <div className={docStyles.emptyState}>
              <Icon size={32} className={docStyles.emptyIcon} aria-hidden="true" />
              <h2 className={docStyles.emptyTitle}>{config.emptyTitle}</h2>
              <p className={docStyles.emptyDescription}>{config.emptyDescription}</p>
              {config.addPath && (
                <Link
                  to={`/studies/${studyPublicId}${config.addPath}`}
                  className={docStyles.emptyAction}
                >
                  {config.addLabel} →
                </Link>
              )}
            </div>
          )}

          {/* Needs your review */}
          {needsReviewRuns.length > 0 && (
            <DocumentSection sectionId="needs-review" title="1 &nbsp; Needs your review">
              <ReviewQueue runs={needsReviewRuns} studyPublicId={studyPublicId} />
            </DocumentSection>
          )}

          {/* Runs (ungrouped) */}
          {hasRuns && (
            <DocumentSection
              sectionId="runs"
              title={`${getSectionNumber(0)} &nbsp; Runs (${runsQuery.data?.length || 0})`}
            >
              <RunLedgerTable
                runs={runsQuery.data || []}
                studyPublicId={studyPublicId}
                grouped={false}
              />
            </DocumentSection>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
