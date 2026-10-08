/**
 * DiscoveryHub — DISC-3 + NAV-1b
 *
 * NAV-1a: Removed page-level LifecycleRail — now owned by StudyWorkspaceLayout.
 * NAV-1b: This is now the "Overview" page. Legacy ?type= URLs redirect to section pages.
 *
 * Discovery Hub page showing all Discovery evidence for a project.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §4 and STUDY_WORKSPACE_NAV_CORRECTION.md.
 *
 * Sections:
 * - §1 Needs your review (failed runs)
 * - §2 Discovery runs (ledger grouped by type)
 * - §4 What we don't know yet (knowledge gaps)
 * - §5 Into the brief
 *
 * Note: §3 "Across sources" is DISC-5 (synthesis) — not rendered in DISC-3.
 */

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import { ChevronDown, FileText, Users } from 'lucide-react';
import {
  useDiscoveryRuns,
  useDiscoveryArtifacts,
  useKnowledgeGaps,
} from '@/api/queries/useDiscovery';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { DocumentSection } from '@/components/study/document';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  RunLedgerTable,
  ReviewQueue,
  HubEmptyExplainer,
  KnowledgeGapsSection,
} from '@/components/discovery';
import styles from './DiscoveryHub.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** NAV-1b: Legacy type param to canonical path mapping */
const typeToPath: Record<string, string> = {
  desk: '/desk',
  stakeholder: '/stakeholders',
  survey: '/surveys',
};

export function DiscoveryHub() {
  // NAV-1a: Get study data from workspace context (loaded by layout)
  const {
    studyPublicId,
    projectPublicId,
    studyName,
  } = useStudyWorkspace();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // NAV-1b: Check for legacy ?type= URL and redirect BEFORE rendering
  // This prevents Overview content flash during redirect
  const typeParam = searchParams.get('type');
  const isLegacyRedirect = typeParam && typeToPath[typeParam];

  useEffect(() => {
    if (isLegacyRedirect) {
      // Build new URL preserving non-type query params
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('type');
      const queryString = newParams.toString();
      const newPath = `/studies/${studyPublicId}/discovery${typeToPath[typeParam]}${queryString ? `?${queryString}` : ''}`;
      navigate(newPath, { replace: true });
    }
  }, [isLegacyRedirect, typeParam, searchParams, studyPublicId, navigate]);

  // Don't render Overview content during legacy redirect - prevents flash
  if (isLegacyRedirect) {
    return null;
  }

  // NAV-1b: Overview page shows all types (no filter)
  const runsQuery = useDiscoveryRuns(
    projectPublicId,
    undefined, // No type filter - show all
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

  // Check if there's any discovery data
  const hasRuns = runsQuery.data && runsQuery.data.length > 0;
  const hasArtifacts = artifactsQuery.data && artifactsQuery.data.length > 0;
  const hasDiscovery = hasRuns || hasArtifacts;

  // Filter runs that need review
  const needsReviewRuns = useMemo(() => {
    if (!runsQuery.data) return [];
    return runsQuery.data.filter((run) => run.status === 'failed');
  }, [runsQuery.data]);

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
      // NAV-1a: nav prop removed — LifecycleRail owned by StudyWorkspaceLayout
      // Overview pages: masthead inside docCol for centered canvas alignment
      header={<div className={styles.headerSpacer} />}
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          {/* Masthead — inside docCol for centered canvas alignment per CD S03 */}
          <div className={styles.masthead}>
            <div className={styles.mastheadMain}>
              <span className={styles.eyebrow}>Discovery</span>
              <h1 className={styles.title}>{studyName}</h1>
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

            <div className={styles.mastheadActions}>
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
                grouped={true}
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
