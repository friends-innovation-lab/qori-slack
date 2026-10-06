/**
 * DiscoveryHub — DISC-3
 *
 * Discovery Hub page showing all Discovery evidence for a project.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §4.
 *
 * Sections:
 * - §1 Needs your review (failed runs)
 * - §2 Discovery runs (ledger grouped by type)
 * - §4 What we don't know yet (knowledge gaps)
 * - §5 Into the brief
 *
 * Note: §3 "Across sources" is DISC-5 (synthesis) — not rendered in DISC-3.
 */

import { useState, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { ChevronDown, FileText, Users } from 'lucide-react';
import { useStudy } from '@/api/queries/useStudy';
import {
  useDiscoveryRuns,
  useDiscoveryArtifacts,
  useKnowledgeGaps,
  useDiscoveryCounts,
} from '@/api/queries/useDiscovery';
import { WorkspaceLayout } from '@/components/study/workspace/WorkspaceLayout';
import { LifecycleRail, type DiscoveryCounts } from '@/components/study/LifecycleRail';
import { computeLifecycleNodes } from '@/components/study/lifecycle';
import { DocumentSection } from '@/components/study/document';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  RunLedgerTable,
  ReviewQueue,
  HubEmptyExplainer,
  KnowledgeGapsSection,
} from '@/components/discovery';
import type { DiscoveryTypeKey } from '@qori/api-contracts';
import styles from './DiscoveryHub.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** Filter type from query param to API type */
const filterTypeMap: Record<string, DiscoveryTypeKey | undefined> = {
  desk: 'desk_research',
  stakeholder: 'stakeholder_synthesis',
  survey: 'survey_synthesis',
};

export function DiscoveryHub() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const [searchParams] = useSearchParams();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Get filter type from URL
  const typeFilter = searchParams.get('type');
  const discoveryTypeFilter = typeFilter ? filterTypeMap[typeFilter] : undefined;

  // Fetch study to get project_public_id
  const { data: study, isLoading: studyLoading, error: studyError } = useStudy(studyPublicId || '');

  // Get project ID for Discovery API calls
  const projectPublicId = study?.project_public_id || '';

  // Fetch Discovery data with polling for pending runs
  const runsQuery = useDiscoveryRuns(
    projectPublicId,
    discoveryTypeFilter ? { type: discoveryTypeFilter } : undefined,
    {
      enabled: !!projectPublicId,
      // Poll every 2s if any run is pending/processing
      refetchInterval: undefined, // Set below based on data
    },
  );

  const artifactsQuery = useDiscoveryArtifacts(
    projectPublicId,
    { status: 'current', limit: 100 },
    { enabled: !!projectPublicId },
  );

  const knowledgeGapsQuery = useKnowledgeGaps(projectPublicId, { enabled: !!projectPublicId });

  const countsResult = useDiscoveryCounts(projectPublicId, { enabled: !!projectPublicId });

  // Build lifecycle rail counts
  const discoveryCounts: DiscoveryCounts | undefined = countsResult.data
    ? {
        desk: countsResult.data.desk,
        stakeholder: countsResult.data.stakeholder,
        survey: countsResult.data.survey,
        needsReview: countsResult.data.needsReview,
      }
    : undefined;

  // Compute lifecycle nodes for Brief status
  const briefStatus = null; // TODO: Get from study or brief query
  const lifecycleNodes = computeLifecycleNodes(briefStatus);

  // Check if there's any discovery data
  const hasRuns = runsQuery.data && runsQuery.data.length > 0;
  const hasArtifacts = artifactsQuery.data && artifactsQuery.data.length > 0;
  const hasDiscovery = hasRuns || hasArtifacts;

  // Filter runs that need review
  const needsReviewRuns = useMemo(() => {
    if (!runsQuery.data) return [];
    return runsQuery.data.filter((run) => run.status === 'failed');
  }, [runsQuery.data]);

  // Loading state
  if (studyLoading) {
    return <Skeleton variant="card" count={3} />;
  }

  // Error state
  if (studyError || !study) {
    return <ErrorState message={studyError?.message || 'Could not load study'} />;
  }

  // Study info for lifecycle rail
  const studyInfo = {
    name: study.name,
    backTo: '/',
    backLabel: 'All studies',
  };

  // Artifact counts for status line
  const deskCount = artifactsQuery.data?.filter(
    (a) => a.artifactType === 'desk_research',
  ).length ?? 0;
  const stakeholderCount = artifactsQuery.data?.filter(
    (a) => a.artifactType === 'stakeholder_synthesis',
  ).length ?? 0;
  const surveyCount = artifactsQuery.data?.filter(
    (a) => a.artifactType === 'survey_synthesis',
  ).length ?? 0;
  const totalArtifacts = deskCount + stakeholderCount + surveyCount;

  return (
    <WorkspaceLayout
      nav={
        <LifecycleRail
          variant="inverse"
          studyPublicId={studyPublicId || ''}
          nodes={lifecycleNodes}
          study={studyInfo}
          discoveryCounts={discoveryCounts}
        />
      }
      header={
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <span className={styles.eyebrow}>Discovery</span>
            <h1 className={styles.title}>{study.name}</h1>
            <p className={styles.meta}>
              <span className={styles.scope}>Project discovery · shared by all studies</span>
            </p>
            {hasDiscovery && (
              <p className={styles.statusLine}>
                <span className={styles.count}>{totalArtifacts}</span> artifacts
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
            {/* Add evidence menu (DISC-3: 2 items only) */}
            <div className={styles.menuContainer}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                Add evidence
                <ChevronDown size={14} aria-hidden="true" />
              </Button>
              {menuOpen && (
                <div className={styles.menu} role="menu">
                  <Link
                    to={`/studies/${studyPublicId}/discovery/new/desk`}
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    <FileText size={14} aria-hidden="true" />
                    <div>
                      <span className={styles.menuItemTitle}>Documents</span>
                      <span className={styles.menuItemSub}>Reports, policies, prior studies</span>
                    </div>
                  </Link>
                  <Link
                    to={`/studies/${studyPublicId}/discovery/new/stakeholder`}
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Users size={14} aria-hidden="true" />
                    <div>
                      <span className={styles.menuItemTitle}>Stakeholder material</span>
                      <span className={styles.menuItemSub}>Transcripts, notes, feedback</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      navOpen={navOpen}
      onNavClose={() => setNavOpen(false)}
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          {/* Empty state */}
          {!hasDiscovery && !runsQuery.isLoading && (
            <HubEmptyExplainer studyPublicId={studyPublicId || ''} />
          )}

          {/* Loading state for runs */}
          {runsQuery.isLoading && <Skeleton variant="card" count={2} />}

          {/* §1 Needs your review */}
          {needsReviewRuns.length > 0 && (
            <DocumentSection sectionId="needs-review" title="1 &nbsp; Needs your review">
              <ReviewQueue runs={needsReviewRuns} studyPublicId={studyPublicId || ''} />
            </DocumentSection>
          )}

          {/* §2 Discovery runs */}
          {hasRuns && (
            <DocumentSection
              sectionId="discovery-runs"
              title={`2 &nbsp; Discovery runs (${runsQuery.data?.length || 0})`}
            >
              <RunLedgerTable
                runs={runsQuery.data || []}
                studyPublicId={studyPublicId || ''}
                grouped={!discoveryTypeFilter}
              />
            </DocumentSection>
          )}

          {/* §3 Across sources — DISC-5, not rendered */}

          {/* §4 What we don't know yet (knowledge gaps) */}
          {knowledgeGapsQuery.data && knowledgeGapsQuery.data.gaps.length > 0 && (
            <DocumentSection
              sectionId="knowledge-gaps"
              title={`${hasRuns ? '3' : '2'} &nbsp; What we don't know yet (${knowledgeGapsQuery.data.gaps.length})`}
            >
              <KnowledgeGapsSection gaps={knowledgeGapsQuery.data.gaps} />
            </DocumentSection>
          )}

          {/* §5 Into the brief */}
          {hasDiscovery && (
            <DocumentSection
              sectionId="into-brief"
              title={`${
                knowledgeGapsQuery.data?.gaps.length
                  ? hasRuns
                    ? '4'
                    : '3'
                  : hasRuns
                    ? '3'
                    : '2'
              } &nbsp; Into the brief`}
            >
              {/* TODO: Check if Brief exists and show appropriate state */}
              <p className={docStyles.block}>
                The brief hasn't been started.{' '}
                <Link to={`/studies/${studyPublicId}/brief/new`}>Start brief →</Link>
              </p>
            </DocumentSection>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
