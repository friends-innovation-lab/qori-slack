/**
 * BriefDocument — Research Brief in Workspace v2 shell.
 *
 * CC-5: Migrated to workspace shell with:
 * - useBriefViewModel called before early returns
 * - WorkspaceLayout composition
 * - View model provenance for all sections
 * - ArtifactHeader with tabs
 * - Alert appearance="rule" for status notices
 * - ContextRail for review panel
 * - DDR-16: Document Information omits fabricated fallbacks
 * - PF-05: Grips removed
 * - artifact_version fix: uses typed brief.artifact_version ?? 1
 *
 * CC-4.5 editor hydration fix preserved: five editable prose sections hydrate.
 */

import { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import type { JSONContent, Editor } from '@tiptap/react';
import { ClipboardCheck } from 'lucide-react';
import { useStudyBrief } from '@/api/queries/useStudy';
import { useApproveBrief, useRequestChanges } from '@/api/mutations/useApproveBrief';
import { useSaveBriefContent } from '@/api/mutations/useSaveContent';
import { useBriefViewModel } from '@/hooks/useBriefViewModel';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Textarea } from '@/components/ui/Textarea';
import { ArtifactEditor } from '@/components/study/editor/ArtifactEditor';
import { serializeBrief } from '@/components/study/editor/serializer';
import { buildEditorDocument, type SectionProvenance } from '@/components/study/editor/markdownBridge';
import { MarkdownDisplay } from '@/components/study/editor/MarkdownDisplay';
import { useSavePipeline } from '@/components/study/editor/useSavePipeline';
import { WorkspaceLayout, ContextRail, type RailMode } from '@/components/study/workspace';
import { LifecycleRail } from '@/components/study/LifecycleRail';
import { computeLifecycleNodes } from '@/components/study/lifecycle';
import {
  ArtifactHeader,
  ApprovalSection,
  DocumentSection,
  Masthead,
  FactsGrid,
  StructuredItemRow,
  StructuredItemRows,
  DocumentTable,
  CollapsibleSection,
  SaveStateIndicator,
} from '@/components/study/document';
import docStyles from '@/components/study/document/document.module.css';
import styles from './BriefDocument.module.css';

/**
 * Build TipTap editor document from Brief API data.
 *
 * Hydrates only the EDITABLE prose sections from the contract:
 * - summary (GENERATED · EDITABLE)
 * - problem_narrative (GENERATED · EDITABLE)
 * - method_prose (GENERATED · EDITABLE)
 * - participants_prose (GENERATED · EDITABLE)
 * - out_of_scope (GENERATED · EDITABLE)
 *
 * Does NOT hydrate:
 * - objectives, questions, barriers (CANONICAL · READ-ONLY)
 * - quick facts, timeline (SYSTEM / COMPUTED · READ-ONLY)
 *
 * CC-4.5 (DDR-11): Fixes PF-04 — methodology not prepended to method_prose.
 */
function buildBriefEditorContent(
  prose: Record<string, string | null>,
): JSONContent {
  const sections: Array<{
    sectionId: string;
    markdown: string;
    provenance?: SectionProvenance;
    title?: string;
  }> = [];

  // Summary (GENERATED · EDITABLE)
  if (prose.summary) {
    sections.push({
      sectionId: 'summary',
      markdown: prose.summary,
      provenance: 'generated',
      title: 'Summary',
    });
  }

  // Problem narrative (GENERATED · EDITABLE)
  if (prose.problem_narrative) {
    sections.push({
      sectionId: 'problem_narrative',
      markdown: prose.problem_narrative,
      provenance: 'generated',
      title: 'Problem',
    });
  }

  // Method prose (GENERATED · EDITABLE)
  // NOTE: methodology (Approach) is READ-ONLY · SYSTEM and displayed separately
  // in view mode. It is NOT part of the editable content.
  if (prose.method_prose) {
    sections.push({
      sectionId: 'method_prose',
      markdown: prose.method_prose,
      provenance: 'generated',
      title: 'Method',
    });
  }

  // Participants prose (GENERATED · EDITABLE)
  if (prose.participants_prose) {
    sections.push({
      sectionId: 'participants_prose',
      markdown: prose.participants_prose,
      provenance: 'generated',
      title: 'Participants',
    });
  }

  // Out of scope (GENERATED · EDITABLE)
  if (prose.out_of_scope) {
    sections.push({
      sectionId: 'out_of_scope',
      markdown: prose.out_of_scope,
      provenance: 'generated',
      title: 'Out of scope',
    });
  }

  // Empty state fallback
  if (sections.length === 0) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'No editable content available. Generate a brief first.' }],
        },
      ],
    };
  }

  return buildEditorDocument(sections);
}

/** Format ISO date string to readable format */
function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BriefDocument() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();

  // Call hooks unconditionally at the top (same pattern as PlanDocument)
  const { data: brief, isLoading, error } = useStudyBrief(studyPublicId || '');
  const { viewModel: vm } = useBriefViewModel(studyPublicId || '');
  const approveBrief = useApproveBrief(studyPublicId || '');
  const requestChanges = useRequestChanges(studyPublicId || '');
  const saveBriefContent = useSaveBriefContent(studyPublicId || '');
  const pipeline = useSavePipeline();

  const editorRef = useRef<Editor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState('');
  const [checklist, setChecklist] = useState({
    scope: false,
    timeline: false,
    participants: false,
    budget: false,
  });
  const [railMode, setRailMode] = useState<'review' | null>('review');

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
    setRailMode('review'); // Show rail when returning to view
  }, [pipeline]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !brief) return;
    // DDR-10 fix: use actual artifact_version from response.
    // The type includes artifact_version?: number. Fallback to 1 is defensive
    // for the edge case where the field is undefined (shouldn't happen for
    // existing artifacts, but the type allows it).
    const artifactVersion = brief.artifact_version ?? 1;
    const serialized = serializeBrief(editorRef.current);

    pipeline.startSave();
    try {
      const result = await saveBriefContent.mutateAsync({
        artifact_version: artifactVersion,
        sections: serialized.sections,
        structured: serialized.structured,
      });
      pipeline.completeSave(result);
      setIsEditing(false);
      setIsDirty(false);
      setRailMode('review');
    } catch (err) {
      pipeline.failSave(err instanceof Error ? err.message : 'Save failed');
    }
  }, [brief, saveBriefContent, pipeline]);

  async function handleApprove() {
    await approveBrief.mutateAsync({ checklist_confirmed: true });
  }

  async function handleRequestChanges() {
    if (!changeFeedback.trim()) return;
    await requestChanges.mutateAsync({ comment: changeFeedback.trim() });
    setShowChangesForm(false);
    setChangeFeedback('');
  }

  // Loading state
  if (isLoading) return <Skeleton variant="card" count={3} />;

  // Error state
  if (error || !brief || !vm) {
    return <ErrorState message={error?.message || 'Could not load brief'} />;
  }

  // Compute lifecycle nodes for navigation
  const lifecycleNodes = computeLifecycleNodes(brief.brief_status ?? null);

  // Study info for lifecycle rail
  const study = {
    name: vm.study.name,
    backTo: '/',
    backLabel: 'All studies',
  };

  // Approval state from view model
  const isPendingApproval = vm.approval.status === 'pending_approval';
  const isApproved = vm.approval.status === 'approved';
  const isChangesRequested = vm.approval.status === 'changes_requested';
  const allChecked = Object.values(checklist).every(Boolean);

  // Structured data from view model
  const objectives = vm.objectives.items;
  const questions = vm.questions.items;
  const barriers = vm.barriers.items;
  const participantSegments = vm.participantSegments.items;
  const discoverySources = vm.discoverySources?.items ?? [];
  const timelinePhases = vm.timeline.phases;
  const risks = vm.risks.items;

  // Prose sections from view model
  const summaryProse = vm.sections.summary?.content || null;
  const problemProse = vm.sections.problemNarrative?.content || null;
  const outOfScopeProse = vm.sections.outOfScope?.content || null;
  const participantsProse = vm.sections.participantsProse?.content || null;
  const methodProse = vm.sections.methodProse?.content || null;

  // Quick facts
  const methodology = vm.quickFacts.method.exists ? vm.quickFacts.method.value : null;
  const facts = [
    vm.quickFacts.method,
    vm.quickFacts.participants,
    vm.quickFacts.timeline,
    vm.quickFacts.decisionDeadline,
    vm.quickFacts.budget,
  ];

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
    <Button variant="secondary" size="sm" onClick={handleEdit}>
      Edit
    </Button>
  ) : (
    <>
      <Button variant="secondary" size="sm" onClick={handleCancel}>
        Cancel
      </Button>
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

  // Review rail content (moved from inline JSX per CC-5)
  const reviewContent = (
    <div className={styles.reviewContent}>
      {isApproved && (
        <>
          <h2 className={styles.reviewStatusApproved}>Approved</h2>
          <p className={styles.reviewBody}>
            {vm.approval.reviewerDisplayName && <>Approved by {vm.approval.reviewerDisplayName}</>}
            {vm.approval.approvedAt && <> · {formatDate(vm.approval.approvedAt)}</>}
            . The brief is now the citation source for downstream artifacts.
          </p>
        </>
      )}

      {isPendingApproval && !showChangesForm && (
        <>
          <h2 className={styles.reviewStatusPending}>Pending approval</h2>
          <p className={styles.reviewBody}>
            A stakeholder review is required before proceeding to the research plan.
          </p>
          <fieldset className={styles.reviewChecklist}>
            <legend className={styles.srOnly}>Approval checklist</legend>
            {Object.entries(checklist).map(([key, checked]) => (
              <label key={key} className={styles.checklistItem}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>
                  {key === 'scope' && 'Scope and method are appropriate'}
                  {key === 'timeline' && 'Timeline and deadline are feasible'}
                  {key === 'participants' && 'Participant approach is sound'}
                  {key === 'budget' && 'Budget is reasonable'}
                </span>
              </label>
            ))}
          </fieldset>
          {!allChecked && (
            <p className={styles.checklistHint} id="checklist-hint">
              Confirm all four checks to approve.
            </p>
          )}
          <div className={styles.reviewActions}>
            <Button
              onClick={handleApprove}
              disabled={!allChecked || approveBrief.isPending}
              loading={approveBrief.isPending}
              aria-describedby={!allChecked ? 'checklist-hint' : undefined}
            >
              {approveBrief.isPending ? 'Approving...' : 'Approve'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowChangesForm(true)}>
              Request changes
            </Button>
          </div>
        </>
      )}

      {isPendingApproval && showChangesForm && (
        <>
          <h2 className={styles.reviewStatusPending}>Request changes</h2>
          <Textarea
            label="Feedback"
            value={changeFeedback}
            onChange={(e) => setChangeFeedback(e.target.value)}
            placeholder="Describe the changes needed..."
            className={styles.feedbackTextarea}
          />
          <div className={styles.reviewActions}>
            <Button variant="secondary" size="sm" onClick={() => setShowChangesForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestChanges}
              disabled={!changeFeedback.trim() || requestChanges.isPending}
              loading={requestChanges.isPending}
            >
              {requestChanges.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </>
      )}

      {isChangesRequested && (
        <>
          <h2 className={styles.reviewStatusError}>Changes requested</h2>
          <p className={styles.reviewBody}>
            {vm.approval.reviewerDisplayName && <>by {vm.approval.reviewerDisplayName}</>}
          </p>
          {vm.approval.changeFeedback && (
            <blockquote className={styles.feedbackQuote}>
              {vm.approval.changeFeedback}
            </blockquote>
          )}
        </>
      )}
    </div>
  );

  // Context rail modes (only review for UX-3A)
  const railModes: RailMode[] = [
    {
      id: 'review',
      label: 'Review',
      icon: ClipboardCheck,
      content: reviewContent,
    },
  ];

  // Show rail when not editing and has approval status
  const showRail = !isEditing && (isPendingApproval || isApproved || isChangesRequested);

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
          active="brief"
          saveState={saveState}
          githubUrl={vm.githubUrl}
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
            onModeChange={(mode) => setRailMode(mode as 'review' | null)}
          />
        ) : undefined
      }
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

          {/* Status notices */}
          {!isEditing && isApproved && (
            <Alert variant="success" appearance="rule" title="Brief approved">
              {vm.approval.reviewerDisplayName && (
                <>Approved by {vm.approval.reviewerDisplayName} · </>
              )}
              {formatDate(vm.approval.approvedAt)}.{' '}
              <Link to={`/studies/${studyPublicId}/plan`}>Open the research plan →</Link>
            </Alert>
          )}
          {!isEditing && isPendingApproval && (
            <Alert variant="warning" appearance="rule" title="Pending approval">
              {vm.approval.reviewerDisplayName && (
                <>Sent to <b>{vm.approval.reviewerDisplayName}</b> for approval. </>
              )}
              Use the Review panel to approve or request changes.
            </Alert>
          )}
          {!isEditing && isChangesRequested && (
            <Alert
              variant="error"
              appearance="rule"
              title="Changes requested"
              action={
                <Button variant="secondary" size="sm" onClick={handleEdit}>
                  Revise
                </Button>
              }
            >
              {vm.approval.changeFeedback && (
                <blockquote className={styles.inlineFeedback}>
                  {vm.approval.changeFeedback}
                </blockquote>
              )}
            </Alert>
          )}

          {/* Edit mode: TipTap editor (CC-4.5 hydration preserved) */}
          {isEditing && (
            <ArtifactEditor
              initialContent={buildBriefEditorContent(brief.prose_sections || {})}
              onDirtyChange={setIsDirty}
              editorRef={editorRef}
            />
          )}

          {/* View mode */}
          {!isEditing && (
            <>
              {/* Masthead with artifactLabel */}
              <Masthead masthead={vm.masthead} artifactLabel="Research Brief" />

              {/* Summary (generated, editable) */}
              <DocumentSection
                sectionId="summary"
                title="Summary"
                provenance={vm.sections.summary.provenance}
              >
                {summaryProse ? (
                  <MarkdownDisplay markdown={summaryProse} className={docStyles.blockProse} />
                ) : (
                  <p className={docStyles.block}>Brief generated. See sections below.</p>
                )}
                <FactsGrid facts={facts} />
              </DocumentSection>

              {/* Problem (generated + canonical) */}
              {(vm.sections.problemNarrative.exists || vm.barriers.exists) && (
                <DocumentSection
                  sectionId="problem"
                  title="Problem"
                  provenance={[
                    ...(vm.sections.problemNarrative.exists
                      ? [vm.sections.problemNarrative.provenance]
                      : []),
                    ...(vm.barriers.exists ? [vm.barriers.provenance] : []),
                  ].filter(Boolean)}
                >
                  {problemProse && (
                    <MarkdownDisplay markdown={problemProse} className={docStyles.blockProse} />
                  )}
                  {barriers.length > 0 && (
                    <>
                      <h3 className={docStyles.secSubheading}>Target barriers for validation</h3>
                      <StructuredItemRows>
                        {barriers.map((b) => (
                          <StructuredItemRow key={b.id} id={b.id} text={b.barrier} source={b.source} />
                        ))}
                      </StructuredItemRows>
                    </>
                  )}
                </DocumentSection>
              )}

              {/* What we'll learn (canonical, read-only) */}
              {(vm.objectives.exists || vm.questions.exists) && (
                <DocumentSection
                  sectionId="objectives"
                  title="What we'll learn"
                  provenance={[
                    ...(vm.objectives.exists ? [vm.objectives.provenance] : []),
                    ...(vm.questions.exists ? [vm.questions.provenance] : []),
                  ].filter(Boolean)}
                >
                  {objectives.length > 0 && (
                    <StructuredItemRows>
                      {objectives.map((o) => (
                        <StructuredItemRow key={o.id} id={o.id} text={o.objective} />
                      ))}
                    </StructuredItemRows>
                  )}
                  {questions.length > 0 && (
                    <>
                      <h3 className={docStyles.secSubheading}>Research questions</h3>
                      <StructuredItemRows>
                        {questions.map((q) => (
                          <StructuredItemRow key={q.id} id={q.id} text={q.question} priority={q.priority} />
                        ))}
                      </StructuredItemRows>
                    </>
                  )}
                </DocumentSection>
              )}

              {/* Method (generated, editable) */}
              {(vm.quickFacts.method.exists || vm.sections.methodProse.exists) && (
                <DocumentSection
                  sectionId="method"
                  title="Method"
                  provenance={vm.sections.methodProse.provenance}
                >
                  {methodology && (
                    <p className={docStyles.kvParagraph}>
                      <b>Approach</b> — {methodology}
                    </p>
                  )}
                  {methodProse && (
                    <MarkdownDisplay markdown={methodProse} className={docStyles.blockProse} />
                  )}
                </DocumentSection>
              )}

              {/* Participants (generated + canonical) */}
              {(vm.participantSegments.exists || vm.sections.participantsProse.exists) && (
                <DocumentSection
                  sectionId="participants"
                  title="Participants"
                  provenance={[
                    ...(vm.participantSegments.exists ? [vm.participantSegments.provenance] : []),
                    ...(vm.sections.participantsProse.exists
                      ? [vm.sections.participantsProse.provenance]
                      : []),
                  ].filter(Boolean)}
                >
                  {participantSegments.length > 0 ? (
                    <>
                      <DocumentTable
                        columns={[
                          { key: 'segment', label: 'Segment' },
                          { key: 'count', label: 'Count', align: 'center' },
                          { key: 'rationale', label: 'Rationale' },
                        ]}
                        rows={participantSegments as any}
                      />
                      {participantsProse && (
                        <MarkdownDisplay markdown={participantsProse} className={docStyles.blockProse} />
                      )}
                      {vm.recruitmentSources && (
                        <p className={docStyles.kvParagraph}>
                          <b>Recruitment</b> — {vm.recruitmentSources}
                        </p>
                      )}
                    </>
                  ) : participantsProse ? (
                    <>
                      <MarkdownDisplay markdown={participantsProse} className={docStyles.blockProse} />
                      {vm.recruitmentSources && (
                        <p className={docStyles.kvParagraph}>
                          <b>Recruitment</b> — {vm.recruitmentSources}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p>{vm.participantSegments.approach}</p>
                      {vm.recruitmentSources && (
                        <p className={docStyles.kvParagraph}>
                          <b>Recruitment</b> — {vm.recruitmentSources}
                        </p>
                      )}
                    </>
                  )}
                </DocumentSection>
              )}

              {/* Out of scope (generated, editable) */}
              {vm.sections.outOfScope.exists && (
                <DocumentSection
                  sectionId="out-of-scope"
                  title="Out of scope"
                  provenance={vm.sections.outOfScope.provenance}
                >
                  <MarkdownDisplay markdown={outOfScopeProse || ''} className={docStyles.blockProse} />
                </DocumentSection>
              )}

              {/* Risks (generated, read-only) */}
              {vm.risks.exists && (
                <DocumentSection
                  sectionId="risks"
                  title="Risks"
                  provenance={vm.risks.provenance}
                >
                  <DocumentTable
                    columns={[
                      { key: 'risk', label: 'Risk' },
                      { key: 'source', label: 'Source' },
                      { key: 'mitigation', label: 'Mitigation' },
                    ]}
                    rows={risks as any}
                  />
                </DocumentSection>
              )}

              {/* Timeline (computed, read-only) */}
              {(vm.timeline.exists ||
                vm.timeline.summary.startDate ||
                vm.quickFacts.decisionDeadline.exists) && (
                <DocumentSection
                  sectionId="timeline"
                  title="Timeline"
                  provenance={vm.timeline.provenance}
                >
                  {timelinePhases.length > 0 ? (
                    <>
                      <DocumentTable
                        columns={[
                          { key: 'phase', label: 'Phase' },
                          { key: 'dates', label: 'Dates' },
                        ]}
                        rows={timelinePhases as any}
                      />
                      {vm.quickFacts.decisionDeadline.exists && (
                        <p className={docStyles.kvParagraph}>
                          <b>Hard deadline</b> — {vm.quickFacts.decisionDeadline.value}
                          {vm.quickFacts.decisionDeadline.sub &&
                            ` (${vm.quickFacts.decisionDeadline.sub})`}
                        </p>
                      )}
                    </>
                  ) : (
                    <FactsGrid
                      facts={[
                        ...(vm.timeline.summary.startDate
                          ? [
                              {
                                label: 'Start date',
                                value: formatDate(vm.timeline.summary.startDate) || '',
                                exists: true,
                              },
                            ]
                          : []),
                        ...(vm.quickFacts.decisionDeadline.exists
                          ? [vm.quickFacts.decisionDeadline]
                          : []),
                      ]}
                    />
                  )}
                </DocumentSection>
              )}

              {/* Approval checklist (using ApprovalSection component) */}
              <ApprovalSection
                budget={vm.quickFacts.budget.exists ? vm.quickFacts.budget.value : null}
                isApproved={isApproved}
              />

              {/* Validity checklist (collapsed) */}
              <CollapsibleSection title="Validity checklist">
                <DocumentTable
                  columns={[
                    { key: 'check', label: 'Check' },
                    { key: 'result', label: 'Result' },
                  ]}
                  rows={[
                    { check: 'Problem statement grounds target barriers', result: '' },
                    { check: 'Learning objectives map to research questions', result: '' },
                    { check: 'Methodology fits the research questions', result: '' },
                    { check: 'Participant approach addresses criteria', result: '' },
                    { check: 'Discovery sources cited where used', result: '' },
                    { check: 'Out of scope is explicit', result: '' },
                  ]}
                />
              </CollapsibleSection>

              {/* Research provenance (collapsed) */}
              <CollapsibleSection title="Research provenance">
                <p>This brief establishes the research scope for downstream templates.</p>
                <DocumentTable
                  columns={[
                    { key: 'commitment', label: 'Commitment' },
                    { key: 'count', label: 'Count' },
                  ]}
                  rows={[
                    { commitment: 'Research objectives', count: vm.objectives.count },
                    { commitment: 'Research questions', count: vm.questions.count },
                    { commitment: 'Target barriers', count: vm.barriers.count },
                    { commitment: 'Methodology', count: methodology || '—' },
                    {
                      commitment: 'Budget',
                      count: vm.quickFacts.budget.exists ? vm.quickFacts.budget.value : '—',
                    },
                  ]}
                />
                {discoverySources.length > 0 && (
                  <>
                    <p className={docStyles.docFootnote}>
                      <b>Discovery sources</b> — synthesized from {discoverySources.length} sources.
                    </p>
                    <DocumentTable
                      columns={[
                        { key: 'prefix', label: 'Prefix' },
                        { key: 'source', label: 'Source' },
                        { key: 'type', label: 'Type' },
                        { key: 'findings', label: 'Findings used' },
                      ]}
                      rows={discoverySources as any}
                    />
                  </>
                )}
              </CollapsibleSection>

              {/* Document information (DDR-16: omit empty rows, no fabricated fallbacks) */}
              <CollapsibleSection title="Document information">
                <DocumentTable
                  columns={[
                    { key: 'field', label: '' },
                    { key: 'value', label: '' },
                  ]}
                  rows={[
                    {
                      field: 'Generated',
                      value: vm.artifact.createdAt
                        ? new Date(vm.artifact.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short',
                          })
                        : '',
                    },
                    { field: 'Model', value: vm.artifact.model || '' },
                    {
                      field: 'Template',
                      value:
                        vm.artifact.templateId && vm.artifact.templateVersion
                          ? `${vm.artifact.templateId} ${vm.artifact.templateVersion}`
                          : '',
                    },
                    { field: 'Study', value: vm.study.name },
                    { field: 'GitHub path', value: vm.artifact.path || '' },
                  ].filter((row) => row.value)}
                />
                <p className={docStyles.docFootnote}>
                  Generated by Qori. The Workspace is the editing surface; GitHub holds the durable
                  rendered projection of the same canonical state.
                </p>
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
