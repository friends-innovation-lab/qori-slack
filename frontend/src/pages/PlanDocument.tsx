/**
 * PlanDocument — Research Plan document in Workspace v2 shell.
 *
 * CC-4: Migrated to workspace shell with:
 * - usePlanViewModel called before early returns (fixes PF-19)
 * - View model provenance for all sections (fixes PF-20)
 * - WorkspaceLayout composition
 * - ArtifactHeader with tabs
 * - Alert appearance="rule" for save failures
 *
 * Plan has NO approval gate. Inherited Brief commitments are read-only.
 */

import { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import type { JSONContent } from '@tiptap/react';
import { MessageSquare } from 'lucide-react';
import { useStudyPlan } from '@/api/queries/useStudy';
import { useSavePlanContent } from '@/api/mutations/useSaveContent';
import { useCommentThreads, deriveOpenThreadCount, groupThreadsBySection } from '@/api/comments';
import { usePlanViewModel } from '@/hooks/usePlanViewModel';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtifactEditor } from '@/components/study/editor/ArtifactEditor';
import { serializePlan } from '@/components/study/editor/serializer';
import { buildEditorDocument } from '@/components/study/editor/markdownBridge';
import { MarkdownDisplay } from '@/components/study/editor/MarkdownDisplay';
import { useSavePipeline } from '@/components/study/editor/useSavePipeline';
import { WorkspaceLayout, ContextRail, type RailMode } from '@/components/study/workspace';
import { LifecycleRail } from '@/components/study/LifecycleRail';
import { computeLifecycleNodes } from '@/components/study/lifecycle';
import {
  ArtifactHeader,
  CommentsRail,
  DocumentSection,
  Masthead,
  FactsGrid,
  StructuredItemRow,
  StructuredItemRows,
  DocumentTable,
  CollapsibleSection,
  SaveStateIndicator,
  type CommentsRailScope,
  type SectionCommentProps,
} from '@/components/study/document';
import type { FieldProvenance } from '@qori/artifact-contracts';
import docStyles from '@/components/study/document/document.module.css';
import headerStyles from '@/components/study/document/ArtifactHeader.module.css';
import styles from './PlanDocument.module.css';

/** Helper to check if provenance is inherited */
function isInherited(provenance: FieldProvenance | FieldProvenance[] | undefined): boolean {
  if (!provenance) return false;
  const list = Array.isArray(provenance) ? provenance : [provenance];
  return list.length > 0 && list.every((p) => p.authority === 'inherited');
}

export function PlanDocument() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();

  // Call hooks unconditionally at the top (fixes PF-19)
  const { data: plan, isLoading, error } = useStudyPlan(studyPublicId || '');
  const { viewModel: vm, exists: planExists } = usePlanViewModel(studyPublicId || '');
  const savePlan = useSavePlanContent(studyPublicId || '');
  const pipeline = useSavePipeline();

  const editorRef = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [railMode, setRailMode] = useState<'comments' | null>(null);
  // CMT-7: Track comments scope (section-scoped or all)
  const [commentsScope, setCommentsScope] = useState<CommentsRailScope>({ mode: 'all' });

  // CMT-6: Fetch open comment threads for count display
  const artifactPublicId = (plan as any)?.artifact_public_id || '';
  const commentsQuery = useCommentThreads({
    artifactPublicId,
    status: 'open',
    enabled: !!artifactPublicId,
  });
  const openThreadCount = deriveOpenThreadCount(commentsQuery.data?.threads);
  // CMT-7: Derive per-section counts for section affordances
  const sectionCounts = groupThreadsBySection(commentsQuery.data?.threads);

  // CMT-7: Handler to open Comments rail scoped to a section
  const openSectionComments = useCallback((sectionKey: string) => {
    setCommentsScope({ mode: 'section', sectionKey });
    setRailMode('comments');
  }, []);

  // CMT-7: Create comment props for a section
  const getSectionComment = useCallback(
    (sectionKey: string, label?: string): SectionCommentProps => ({
      count: sectionCounts.get(sectionKey) ?? 0,
      onOpen: () => openSectionComments(sectionKey),
      label,
    }),
    [sectionCounts, openSectionComments],
  );

  // CMT-6/7: Handler to toggle Comments rail from header
  const handleCommentsToggle = useCallback(() => {
    if (railMode === 'comments') {
      setRailMode(null);
    } else {
      // CMT-7: Opening from header = All comments scope
      setCommentsScope({ mode: 'all' });
      setRailMode('comments');
    }
  }, [railMode]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setIsDirty(false);
    pipeline.reset();
    setRailMode(null); // Hide rail while editing
  }, [pipeline]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setIsDirty(false);
    pipeline.reset();
  }, [pipeline]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !plan) return;
    const artifactVersion = (plan as any).artifact_version || 1;
    const serialized = serializePlan(editorRef.current);

    pipeline.startSave();
    try {
      const result = await savePlan.mutateAsync({
        artifact_version: artifactVersion,
        sections: serialized.sections,
        structured: serialized.structured,
      });
      pipeline.completeSave(result);
      setIsEditing(false);
      setIsDirty(false);
    } catch (err) {
      pipeline.failSave(err instanceof Error ? err.message : 'Save failed');
    }
  }, [plan, savePlan, pipeline]);

  // Loading state
  if (isLoading) return <Skeleton variant="card" count={3} />;

  // Error state
  if (error || !plan) return <ErrorState message="Could not load plan." />;

  // Compute lifecycle nodes for navigation
  const lifecycleNodes = computeLifecycleNodes(plan.study?.brief_status ?? null);

  // Study info for lifecycle rail
  const study = {
    name: plan.study?.name || '',
    backTo: '/',
    backLabel: 'All studies',
  };

  // Build save state indicator
  const saveState = (() => {
    if (pipeline.state === 'saving') {
      return <SaveStateIndicator state="saving" label="Saving..." />;
    }
    if (pipeline.state === 'save_failed') {
      return <SaveStateIndicator state="error" label="Save failed" />;
    }
    if (pipeline.state === 'sync_failed') {
      return <SaveStateIndicator state="dirty" label="Saved — GitHub sync pending" />;
    }
    if (isEditing && isDirty) {
      return <SaveStateIndicator state="dirty" label="Unsaved changes" />;
    }
    if (!isEditing && pipeline.lastSavedAt) {
      return <SaveStateIndicator state="saved" savedAt={pipeline.lastSavedAt} />;
    }
    return null;
  })();

  // Action buttons
  const actions = !isEditing ? (
    <Button variant="secondary" size="sm" onClick={handleEdit}>Edit</Button>
  ) : (
    <>
      <Button variant="secondary" size="sm" onClick={handleCancel}>Cancel</Button>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={!isDirty || pipeline.state === 'saving'}
        loading={pipeline.state === 'saving'}
      >
        Save
      </Button>
    </>
  );

  // Empty state: no plan URL yet
  if (!planExists) {
    return (
      <WorkspaceLayout
        nav={
          <LifecycleRail
            variant="inverse"
            studyPublicId={studyPublicId || ''}
            nodes={lifecycleNodes}
            study={study}
          />
        }
        header={
          <ArtifactHeader
            studyName={study.name}
            studyPublicId={studyPublicId || ''}
            active="plan"
            navOpen={navOpen}
            onNavToggle={() => setNavOpen(!navOpen)}
            actions={<></>}
          />
        }
        navOpen={navOpen}
        onNavClose={() => setNavOpen(false)}
      >
        <div className={styles.emptyCanvas}>
          <EmptyState
            heading="No plan yet"
            description="Create a research plan after your brief is approved."
            action={
              <Link to={`/studies/${studyPublicId}/plan/new`}>
                <Button>Create plan</Button>
              </Link>
            }
          />
        </div>
      </WorkspaceLayout>
    );
  }

  // View model is guaranteed to exist if planExists is true
  if (!vm) return <ErrorState message="Could not load plan data." />;

  // Structured data from view model
  const objectives = vm.objectives.items;
  const questions = vm.questions.items;
  const risks = vm.risks.items;
  const commitments = vm.commitments.items;
  const timelinePhases = vm.timeline.phases;
  const deliverables = vm.deliverablesTable?.items || [];

  // Prose sections from raw plan data (for editor input)
  const prose = (plan as any).prose_sections || {};
  const methodology = vm.quickFacts.method.exists ? vm.quickFacts.method.value : null;

  // Quick facts from view model
  const facts = [
    vm.quickFacts.method,
    vm.quickFacts.participants,
    vm.quickFacts.sessions,
    vm.quickFacts.timeline,
  ];

  // Source note for inherited sections
  const briefSourceNote = (
    <>From the <Link to={`/studies/${studyPublicId}/brief`}>approved brief</Link></>
  );

  // VC-2A: Persistent artifact status from version display
  const artifactStatus = vm.masthead?.versionDisplay
    ? { tone: 'neutral' as const, label: vm.masthead.versionDisplay }
    : undefined;

  // CMT-6/7: Context rail modes — Comments only (Plan has no Review)
  const showRail = !isEditing;
  const railModes: RailMode[] = [
    {
      id: 'comments',
      label: 'Comments',
      count: openThreadCount > 0 ? openThreadCount : undefined,
      icon: MessageSquare,
      content: (
        <CommentsRail
          artifactPublicId={artifactPublicId}
          artifactType="plan"
          scope={commentsScope}
          onScopeChange={setCommentsScope}
        />
      ),
    },
  ];

  // CMT-6/7: Rail toggle for Comments
  // Only set aria-controls when rail is open (element exists)
  const railToggles = showRail ? (
    <button
      type="button"
      className={headerStyles.railToggle}
      aria-label={`Comments${openThreadCount > 0 ? ` (${openThreadCount} open)` : ''}`}
      aria-pressed={railMode === 'comments'}
      aria-controls={railMode !== null ? 'context-rail' : undefined}
      onClick={handleCommentsToggle}
    >
      <MessageSquare size={16} aria-hidden="true" />
      {openThreadCount > 0 && (
        <span className={headerStyles.railToggleCount}>{openThreadCount}</span>
      )}
    </button>
  ) : undefined;

  return (
    <WorkspaceLayout
      nav={
        <LifecycleRail
          variant="inverse"
          studyPublicId={studyPublicId || ''}
          nodes={lifecycleNodes}
          study={study}
        />
      }
      header={
        <ArtifactHeader
          studyName={study.name}
          studyPublicId={studyPublicId || ''}
          active="plan"
          saveState={saveState}
          status={artifactStatus}
          githubUrl={vm.githubUrl}
          railToggles={railToggles}
          navOpen={navOpen}
          onNavToggle={() => setNavOpen(!navOpen)}
          actions={actions}
        />
      }
      rail={
        showRail ? (
          <ContextRail
            modes={railModes}
            activeMode={railMode}
            onModeChange={(mode) => setRailMode(mode as 'comments' | null)}
          />
        ) : undefined
      }
      railOpen={showRail && railMode !== null}
      navOpen={navOpen}
      onNavClose={() => setNavOpen(false)}
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          {/* Save failure banners */}
          {pipeline.state === 'save_failed' && (
            <Alert variant="error" appearance="rule" title="Save failed">
              {pipeline.error || 'Could not save changes. Your edits are still in the editor.'}
            </Alert>
          )}
          {pipeline.state === 'sync_failed' && (
            <Alert variant="warning" appearance="rule" title="Saved — GitHub sync pending">
              Your changes were saved to Qori. The GitHub projection can be retried.
            </Alert>
          )}

          {/* Edit mode: TipTap editor */}
          {isEditing && (
            <ArtifactEditor
              initialContent={buildPlanEditorContent(prose, methodology)}
              onDirtyChange={setIsDirty}
              editorRef={editorRef}
            />
          )}

          {/* View mode */}
          {!isEditing && (
            <>
              {/* Masthead with artifactLabel and showStatus */}
              <Masthead
                masthead={vm.masthead}
                artifactLabel="Research Plan"
                showStatus
              />

              {/* Summary (generated, editable) */}
              <DocumentSection
                sectionId="summary"
                title="Summary"
                provenance={vm.sections.summary.provenance}
                comment={getSectionComment('summary', 'Summary')}
              >
                {vm.sections.summary.exists ? (
                  <MarkdownDisplay markdown={vm.sections.summary.content || ''} className={docStyles.blockProse} />
                ) : (
                  <p className={docStyles.block}>Plan generated. See sections below.</p>
                )}
                <FactsGrid facts={facts} />
              </DocumentSection>

              {/* Background (generated, editable) */}
              {vm.sections.background.exists && (
                <DocumentSection
                  sectionId="background"
                  title="Background"
                  provenance={vm.sections.background.provenance}
                  comment={getSectionComment('background', 'Background')}
                >
                  <MarkdownDisplay markdown={vm.sections.background.content || ''} className={docStyles.blockProse} />
                </DocumentSection>
              )}

              {/* Objectives (inherited from Brief — read-only) */}
              {vm.objectives.exists && (
                <DocumentSection
                  sectionId="objectives"
                  title="Objectives"
                  provenance={vm.objectives.provenance}
                  sourceNote={isInherited(vm.objectives.provenance) ? briefSourceNote : undefined}
                  comment={getSectionComment('objectives', 'Objectives')}
                >
                  <StructuredItemRows>
                    {objectives.map((o) => (
                      <StructuredItemRow key={o.id} id={o.id} text={o.objective} />
                    ))}
                  </StructuredItemRows>
                </DocumentSection>
              )}

              {/* Research questions (inherited from Brief — read-only) */}
              {vm.questions.exists && (
                <DocumentSection
                  sectionId="questions"
                  title="Research questions"
                  provenance={vm.questions.provenance}
                  sourceNote={isInherited(vm.questions.provenance) ? briefSourceNote : undefined}
                  comment={getSectionComment('questions', 'Research questions')}
                >
                  <StructuredItemRows>
                    {questions.map((q) => (
                      <StructuredItemRow key={q.id} id={q.id} text={q.question} priority={q.priority} />
                    ))}
                  </StructuredItemRows>
                </DocumentSection>
              )}

              {/* Method (generated, editable) */}
              <DocumentSection
                sectionId="method"
                title="Method"
                provenance={[
                  ...(vm.sections.methodApproach.exists ? [vm.sections.methodApproach.provenance] : []),
                  ...(vm.sections.sessionFormat.exists ? [vm.sections.sessionFormat.provenance] : []),
                  ...(vm.sections.dataCollection.exists ? [vm.sections.dataCollection.provenance] : []),
                ].filter(Boolean)}
                comment={getSectionComment('method', 'Method')}
              >
                {methodology && (
                  <p className={docStyles.kvParagraph}>
                    <b>Approach</b> — {methodology}
                  </p>
                )}
                {vm.sections.methodApproach.exists && (
                  <MarkdownDisplay markdown={vm.sections.methodApproach.content || ''} className={docStyles.blockProse} />
                )}
                {vm.sections.sessionFormat.exists && (
                  <p className={docStyles.kvParagraph}>
                    <b>Session format</b> — {vm.sections.sessionFormat.content}
                  </p>
                )}
                {vm.sections.dataCollection.exists && (
                  <p className={docStyles.kvParagraph}>
                    <b>Data collection</b> — {vm.sections.dataCollection.content}
                  </p>
                )}
              </DocumentSection>

              {/* Participants (generated, editable) */}
              <DocumentSection
                sectionId="participants"
                title="Participants"
                provenance={vm.sections.participantsProse.provenance}
                comment={getSectionComment('participants', 'Participants')}
              >
                {vm.sections.participantsProse.exists ? (
                  <MarkdownDisplay markdown={vm.sections.participantsProse.content || ''} className={docStyles.blockProse} />
                ) : vm.participantApproach ? (
                  <p className={docStyles.block}>{vm.participantApproach}</p>
                ) : null}
                {vm.compensation && (
                  <div className={docStyles.systemBlock}>
                    <span className={docStyles.systemLabel}>READ-ONLY · SYSTEM</span>
                    <p className={docStyles.kvParagraph}>
                      <b>Compensation</b> — {vm.compensation}
                    </p>
                  </div>
                )}
              </DocumentSection>

              {/* Timeline (inherited — read-only) */}
              {vm.timeline.exists && (
                <DocumentSection
                  sectionId="timeline"
                  title="Timeline"
                  provenance={vm.timeline.provenance}
                  sourceNote={isInherited(vm.timeline.provenance) ? briefSourceNote : undefined}
                  comment={getSectionComment('timeline', 'Timeline')}
                >
                  {(vm.timeline.summary.startDate || vm.timeline.summary.dateRange) && (
                    <div className={docStyles.researchPeriod}>
                      <span className={docStyles.periodLabel}>Research period</span>
                      <span className={docStyles.periodValue}>
                        {vm.timeline.summary.dateRange || 'See phases below'}
                      </span>
                      {vm.timeline.summary.duration && (
                        <span className={docStyles.periodDuration}>{vm.timeline.summary.duration}</span>
                      )}
                    </div>
                  )}
                  {timelinePhases.length > 0 && (
                    <DocumentTable
                      columns={[
                        { key: 'phase', label: 'Phase' },
                        { key: 'dates', label: 'Dates' },
                        { key: 'duration', label: 'Duration', align: 'center' },
                      ]}
                      rows={timelinePhases as any}
                    />
                  )}
                  {/* DDR-12: Updated footnote copy */}
                  <p className={docStyles.docFootnote}>
                    Timeline begins once fieldwork starts.
                  </p>
                </DocumentSection>
              )}

              {/* Deliverables (generated, editable) */}
              {(vm.sections.deliverables.exists || vm.deliverablesTable?.exists) && (
                <DocumentSection
                  sectionId="deliverables"
                  title="Deliverables"
                  provenance={vm.sections.deliverables.exists
                    ? vm.sections.deliverables.provenance
                    : vm.deliverablesTable?.provenance}
                  comment={getSectionComment('deliverables', 'Deliverables')}
                >
                  {vm.sections.deliverables.exists ? (
                    <MarkdownDisplay markdown={vm.sections.deliverables.content || ''} className={docStyles.blockProse} />
                  ) : vm.deliverablesTable?.exists ? (
                    <DocumentTable
                      columns={[
                        { key: 'deliverable_name', label: 'Deliverable' },
                        { key: 'format', label: 'Format' },
                      ]}
                      rows={deliverables as any}
                    />
                  ) : null}
                </DocumentSection>
              )}

              {/* Risks (generated, read-only per contract) */}
              {vm.risks.exists && (
                <DocumentSection
                  sectionId="risks"
                  title="Risks and mitigations"
                  provenance={vm.risks.provenance}
                  comment={getSectionComment('risks', 'Risks and mitigations')}
                >
                  <DocumentTable
                    columns={[
                      { key: 'risk', label: 'Risk' },
                      { key: 'likelihood', label: 'Likelihood', align: 'center' },
                      { key: 'mitigation', label: 'Mitigation' },
                    ]}
                    rows={risks as any}
                  />
                </DocumentSection>
              )}

              {/* Brief commitments operationalized (system, read-only) */}
              {vm.commitments.exists && (
                <DocumentSection
                  sectionId="commitments"
                  title="Brief commitments operationalized"
                  provenance={vm.commitments.provenance}
                  comment={getSectionComment('commitments', 'Brief commitments')}
                >
                  <DocumentTable
                    columns={[
                      { key: 'commitment', label: 'Brief commitment' },
                      { key: 'address', label: 'How this plan addresses it' },
                    ]}
                    rows={commitments as any}
                  />
                </DocumentSection>
              )}

              {/* Validity checklist (collapsed) */}
              <CollapsibleSection title="Validity checklist">
                <DocumentTable
                  columns={[{ key: 'check', label: 'Check' }, { key: 'result', label: 'Result' }]}
                  rows={[
                    { check: 'Objectives match brief', result: '' },
                    { check: 'Research questions have RQ-XXX IDs', result: '' },
                    { check: 'Target barriers have TB-XXX IDs', result: '' },
                    { check: 'Method matches approved methodology', result: '' },
                    { check: 'Participant count matches brief', result: '' },
                    { check: 'Timeline phases are realistic', result: '' },
                    { check: 'Deliverables are method-appropriate', result: '' },
                    { check: 'Risks are study-specific, not generic', result: '' },
                    { check: 'Brief operationalization covers all commitments', result: '' },
                  ]}
                />
              </CollapsibleSection>

              {/* Research provenance (collapsed) */}
              <CollapsibleSection title="Research provenance">
                <p>This plan operationalizes the approved research brief.</p>
                <DocumentTable
                  columns={[{ key: 'commitment', label: 'Brief commitment' }, { key: 'count', label: 'Count' }]}
                  rows={[
                    { commitment: 'Research objectives', count: vm.objectives.count },
                    { commitment: 'Research questions', count: vm.questions.count },
                    { commitment: 'Target barriers', count: vm.barriers.count },
                    { commitment: 'Methodology', count: methodology || 'N/A' },
                    { commitment: 'Budget', count: vm.budget || 'N/A' },
                  ]}
                />
                <p className={docStyles.docFootnote}>
                  Citation markers throughout: [RQ-XXX] = research question this element addresses · [TB-XXX] = target barrier this task tests · [OBJ-XXX] = objective this deliverable serves.
                </p>
              </CollapsibleSection>

              {/* Document information (collapsed) */}
              <CollapsibleSection title="Document information">
                <DocumentTable
                  columns={[{ key: 'field', label: '' }, { key: 'value', label: '' }]}
                  rows={[
                    { field: 'Generated', value: vm.artifact.createdAt
                      ? new Date(vm.artifact.createdAt).toLocaleString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                        })
                      : '' },
                    { field: 'Model', value: vm.artifact.model || '' },
                    { field: 'Template', value: vm.artifact.templateId && vm.artifact.templateVersion
                      ? `${vm.artifact.templateId} ${vm.artifact.templateVersion}`
                      : '' },
                    { field: 'Study', value: vm.study.name },
                    { field: 'GitHub path', value: vm.artifact.path || '' },
                  ].filter(row => row.value)}
                />
                <p className={docStyles.docFootnote}>
                  Generated by Qori. The Workspace is the editing surface; GitHub holds the durable rendered projection of the same canonical state.
                </p>
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}

/**
 * Build TipTap editor document from Plan API data.
 * Unchanged from production (locked architecture).
 */
function buildPlanEditorContent(
  prose: Record<string, string | null>,
  methodology: string | null,
): JSONContent {
  const sections: Array<{
    sectionId: string;
    markdown: string;
    provenance?: 'canonical' | 'generated' | 'system' | 'inherited';
    title?: string;
  }> = [];

  if (prose.plan_summary) {
    sections.push({
      sectionId: 'plan_summary',
      markdown: prose.plan_summary,
      provenance: 'generated',
      title: 'Summary',
    });
  }

  if (prose.plan_background) {
    sections.push({
      sectionId: 'plan_background',
      markdown: prose.plan_background,
      provenance: 'generated',
      title: 'Background',
    });
  }

  if (prose.plan_method_approach || prose.plan_session_format || prose.plan_data_collection) {
    let methodMarkdown = '';
    if (methodology) {
      methodMarkdown += `**Approach** — ${methodology}\n\n`;
    }
    if (prose.plan_method_approach) {
      methodMarkdown += prose.plan_method_approach;
    }
    if (prose.plan_session_format) {
      methodMarkdown += `\n\n### Session format\n\n${prose.plan_session_format}`;
    }
    if (prose.plan_data_collection) {
      methodMarkdown += `\n\n### Data collection\n\n${prose.plan_data_collection}`;
    }
    sections.push({
      sectionId: 'plan_method_approach',
      markdown: methodMarkdown.trim(),
      provenance: 'generated',
      title: 'Method',
    });
  }

  if (prose.plan_participants_prose) {
    sections.push({
      sectionId: 'plan_participants_prose',
      markdown: prose.plan_participants_prose,
      provenance: 'generated',
      title: 'Participants',
    });
  }

  if (prose.plan_deliverables) {
    sections.push({
      sectionId: 'plan_deliverables',
      markdown: prose.plan_deliverables,
      provenance: 'generated',
      title: 'Deliverables',
    });
  }

  if (sections.length === 0) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'No content available for editing. Generate a plan first.' }],
        },
      ],
    };
  }

  return buildEditorDocument(sections);
}
