/**
 * BriefDocument — Full document-style Brief view matching YAML template section order.
 *
 * Sections: Masthead, Summary + Facts, Problem + Barriers, Objectives + Questions,
 * Method, Participants, Out of Scope, Risks, Timeline, Approval, Validity (collapsed),
 * Provenance (collapsed), Document Info (collapsed).
 *
 * Brief is the only approval-gated artifact. Review rail on the right.
 */

import { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import type { JSONContent } from '@tiptap/react';
import { useStudyBrief } from '@/api/queries/useStudy';
import { useApproveBrief, useRequestChanges } from '@/api/mutations/useApproveBrief';
import { useSaveBriefContent } from '@/api/mutations/useSaveContent';
import { useAuth } from '@/auth/AuthProvider';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Textarea } from '@/components/ui/Textarea';
import { ArtifactEditor } from '@/components/study/editor/ArtifactEditor';
import { serializeBrief } from '@/components/study/editor/serializer';
import { buildEditorDocument } from '@/components/study/editor/markdownBridge';
import { MarkdownDisplay } from '@/components/study/editor/MarkdownDisplay';
import { useSavePipeline } from '@/components/study/editor/useSavePipeline';
import {
  ArtifactTabs, DocumentSection, Masthead, FactsGrid,
  StructuredItemRow, DocumentTable, CollapsibleSection,
  SaveStateIndicator,
} from '@/components/study/document';
import { StructuredItemRows } from '@/components/study/document/StructuredItemRows';
import { ApprovalSection } from '@/components/study/document/ApprovalSection';
import { ReviewRail } from '@/components/study/document/ReviewRail';
import docStyles from '@/components/study/document/document.module.css';
import styles from './BriefDocument.module.css';

interface Objective { id: string; objective: string }
interface Question { id: string; question: string; priority?: string | null }
interface Barrier { id: string; barrier: string; source?: string | null }
interface ParticipantSegment {
  segment: string;
  count: number | string;
  rationale: string;
  [key: string]: string | number | null;
}
interface DiscoverySource {
  prefix: string;
  source: string;
  type: string;
  findings: string;
  [key: string]: string | number | null;
}

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

/**
 * Strip leading "Approach" line from method prose if present.
 * The Approach is rendered as a system block; we don't want it duplicated in the editable prose.
 */
function stripLeadingApproach(prose: string): string {
  // Match lines like "**Approach** — ...", "Approach — ...", or HTML <p><b>Approach</b> — ...</p>
  const patterns = [
    /^\s*\*\*Approach\*\*\s*[—–-]\s*[^\n]*\n*/i,
    /^\s*Approach\s*[—–-]\s*[^\n]*\n*/i,
    /^\s*<p>\s*<b>Approach<\/b>\s*[—–-][^<]*<\/p>\s*/i,
  ];
  let result = prose;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  return result.trim();
}

/**
 * Build TipTap editor document from Brief API data.
 *
 * Architecture:
 * - Each prose section is stored as canonical MARKDOWN
 * - Parse each section's markdown separately via @tiptap/markdown
 * - Wrap parsed content in qoriSection nodes with sectionId
 * - Returns JSONContent for the editor
 *
 * This preserves Qori section identity while enabling rich TipTap editing.
 * The serializer converts edits back to MARKDOWN on save.
 *
 * Section keys MUST match backend artifact_sections.section_key values:
 * - summary, problem_narrative, method_prose, participants_prose, out_of_scope
 */
function buildBriefEditorContent(
  prose: Record<string, string | null>,
): JSONContent {
  const sections: Array<{
    sectionId: string;
    markdown: string;
    provenance?: 'canonical' | 'generated' | 'system' | 'inherited';
    title?: string;
  }> = [];

  // Summary — editable generated prose (section_key: 'summary')
  if (prose.summary) {
    sections.push({
      sectionId: 'summary',
      markdown: prose.summary,
      provenance: 'generated',
      title: 'Summary',
    });
  }

  // Problem — editable generated prose (section_key: 'problem_narrative')
  // Note: barriers are displayed in view mode only, not in editor
  if (prose.problem_narrative) {
    sections.push({
      sectionId: 'problem_narrative',
      markdown: prose.problem_narrative,
      provenance: 'generated',
      title: 'Problem',
    });
  }

  // Method — editable generated prose (section_key: 'method_prose')
  // Note: The system Approach block is rendered separately in view mode.
  // Do NOT prepend methodology here — that caused duplication.
  if (prose.method_prose) {
    sections.push({
      sectionId: 'method_prose',
      markdown: prose.method_prose,
      provenance: 'generated',
      title: 'Method',
    });
  }

  // Participants — editable generated prose (section_key: 'participants_prose')
  if (prose.participants_prose) {
    sections.push({
      sectionId: 'participants_prose',
      markdown: prose.participants_prose,
      provenance: 'generated',
      title: 'Participants',
    });
  }

  // Out of scope — editable generated prose (section_key: 'out_of_scope')
  if (prose.out_of_scope) {
    sections.push({
      sectionId: 'out_of_scope',
      markdown: prose.out_of_scope,
      provenance: 'generated',
      title: 'Out of scope',
    });
  }

  // Build document using markdown bridge
  // Note: Objectives, questions, barriers are canonical items shown in view mode only
  if (sections.length === 0) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'No content available for editing. Generate a brief first.' }],
        },
      ],
    };
  }

  return buildEditorDocument(sections);
}

export function BriefDocument() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  useAuth();
  const { data: brief, isLoading, error } = useStudyBrief(studyPublicId || '');
  const approveBrief = useApproveBrief(studyPublicId || '');
  const requestChanges = useRequestChanges(studyPublicId || '');

  const saveBrief = useSaveBriefContent(studyPublicId || '');
  const pipeline = useSavePipeline();
  const editorRef = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [showChangesForm, setShowChangesForm] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState('');
  const [changesSubmitted, setChangesSubmitted] = useState(false);
  const [showReviewRail, setShowReviewRail] = useState(true);
  const [showRailOverlay, setShowRailOverlay] = useState(false);
  const [checklist, setChecklist] = useState({
    scope: false, timeline: false, participants: false, budget: false,
  });

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setIsDirty(false);
    pipeline.reset();
  }, [pipeline]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setIsDirty(false);
    pipeline.reset();
  }, [pipeline]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !brief) return;
    const artifactVersion = (brief as any).artifact_version || 1;
    const serialized = serializeBrief(editorRef.current);

    // Save-success invariant: prevent empty PATCH from reporting success
    const hasSections = Object.keys(serialized.sections).length > 0;
    const hasStructured = Object.keys(serialized.structured).length > 0;
    if (!hasSections && !hasStructured) {
      console.error('[BriefDocument] Serializer produced empty payload despite dirty state. Check TipTap hydration.');
      pipeline.failSave('No changes detected. Editor may not have parsed sections correctly.');
      return;
    }

    pipeline.startSave();
    try {
      const result = await saveBrief.mutateAsync({
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
  }, [brief, saveBrief, pipeline]);

  if (isLoading) return <Skeleton variant="card" count={3} />;
  if (error || !brief) return <ErrorState message="Could not load brief." />;

  const isPendingApproval = brief.brief_status === 'pending_approval';
  const isApproved = brief.brief_status === 'approved';
  const isChangesRequested = brief.brief_status === 'changes_requested';
  const allChecked = Object.values(checklist).every(Boolean);

  // Structured arrays — prefer parsed structured_fields, fall back to cascade_fields
  const objectives: Objective[] = (brief as any).structured_fields?.research_objectives
    || safeParse<Objective>(brief.cascade_fields.research_objectives);
  const questions: Question[] = (brief as any).structured_fields?.research_questions
    || safeParse<Question>(brief.cascade_fields.research_questions);
  const barriers: Barrier[] = (brief as any).structured_fields?.target_barriers
    || safeParse<Barrier>(brief.cascade_fields.target_barriers);
  const participantSegments: ParticipantSegment[] = (brief as any).structured_fields?.participant_segments
    || safeParse<ParticipantSegment>((brief as any).cascade_fields?.participant_segments);
  const discoverySources: DiscoverySource[] = (brief as any).structured_fields?.discovery_sources
    || safeParse<DiscoverySource>((brief as any).cascade_fields?.discovery_sources);

  // Artifact metadata for Document information section
  const artifactMetadata = (brief as any).artifact_metadata || {};
  const recruitmentSources = (brief as any).cascade_fields?.recruitment_sources || null;

  // Prose sections from artifact_sections (if available)
  const prose = (brief as any).prose_sections || {};
  const meta = (brief as any).study_metadata || {};

  // Parse timeline phases from cascade (structured data)
  let timelinePhases: Array<{ phase: string; dates: string; duration?: string }> = [];
  if (brief.cascade_fields.timeline_phases) {
    try { timelinePhases = JSON.parse(brief.cascade_fields.timeline_phases); } catch { /* ignore */ }
  }

  // Derive timeline duration and date range from timeline_phases
  let timelineDuration = '';
  let timelineDateRange = '';
  if (timelinePhases.length > 0) {
    // Get first phase start and last phase end from the dates field
    const firstPhase = timelinePhases[0];
    const lastPhase = timelinePhases[timelinePhases.length - 1];
    // Dates are typically formatted as "Sep 14 – Sep 25, 2026"
    const firstDates = firstPhase.dates?.split('–').map(s => s.trim()) || [];
    const lastDates = lastPhase.dates?.split('–').map(s => s.trim()) || [];
    const startDate = firstDates[0] || '';
    const endDate = lastDates[1] || lastDates[0] || '';
    // Calculate total duration from individual phase durations if available
    const totalWeeks = timelinePhases.reduce((sum, p) => {
      const match = p.duration?.match(/(\d+)\s*week/i);
      return sum + (match ? parseInt(match[1], 10) : 0);
    }, 0);
    timelineDuration = totalWeeks > 0 ? `${totalWeeks} weeks` : '';
    timelineDateRange = startDate && endDate ? `${startDate} – ${endDate}` : '';
  }

  // Quick facts — matches design: Method, Participants, Timeline, Decision deadline, Budget
  const methodology = brief.cascade_fields.methodology_selection?.replace(/_/g, ' ') || null;
  const sessionFormat = brief.cascade_fields.session_format || null;
  const sessionDuration = brief.cascade_fields.session_duration || null;
  const methodSub = [sessionFormat, sessionDuration].filter(Boolean).join(' · ') || undefined;
  const decisionDeadline = brief.cascade_fields.decision_deadline || null;

  // Derive concise participant summary from segments (reference: "8 residents" / "3 segments")
  // Never use participants_prose in Quick Facts
  const participantCount = participantSegments.reduce((sum, s) => {
    const n = typeof s.count === 'number' ? s.count : parseInt(String(s.count), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const participantFactValue = participantCount > 0 ? `${participantCount} residents` : null;
  const participantFactSub = participantSegments.length > 0 ? `${participantSegments.length} segment${participantSegments.length !== 1 ? 's' : ''}` : undefined;

  // Decision deadline context (e.g., "Q1 portal release planning")
  const decisionDeadlineContext = brief.cascade_fields.decision_deadline_context || null;
  // Budget purpose (e.g., "Participant incentives")
  const budgetPurpose = brief.cascade_fields.budget_purpose || null;

  const facts = [
    methodology ? { label: 'Method', value: methodology, sub: methodSub } : null,
    participantFactValue ? { label: 'Participants', value: participantFactValue, sub: participantFactSub } : null,
    (timelineDuration || timelineDateRange) ? {
      label: 'Timeline',
      value: timelineDuration || 'See timeline',
      sub: timelineDateRange || undefined,
    } : null,
    decisionDeadline ? { label: 'Decision deadline', value: decisionDeadline, sub: decisionDeadlineContext || undefined } : null,
    brief.cascade_fields.budget ? { label: 'Budget', value: brief.cascade_fields.budget, sub: budgetPurpose || undefined } : null,
  ].filter(Boolean) as { label: string; value: string; sub?: string }[];

  // Risks from prose_sections or cascade
  let risks: Array<{ risk: string; source: string; mitigation: string }> = [];
  if (prose.risks) {
    try { risks = JSON.parse(prose.risks); } catch { /* ignore */ }
  }

  async function handleApprove() {
    await approveBrief.mutateAsync({ checklist_confirmed: true });
  }

  async function handleRequestChanges() {
    if (!changeFeedback.trim()) return;
    await requestChanges.mutateAsync({ comment: changeFeedback });
    setShowChangesForm(false);
    setChangeFeedback('');
    setChangesSubmitted(true);
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className={styles.sep}>&rsaquo;</span>
        <Link to={`/studies/${studyPublicId}`}>{brief.study.name}</Link>
        <span className={styles.sep}>&rsaquo;</span>
        <span>Brief</span>
      </nav>

      {/* Page head */}
      <div className={docStyles.pageHead}>
        <div className={docStyles.pageHeadLeft}>
          <h1 className={docStyles.pageTitle}>Research Brief</h1>
          <div className={docStyles.pageMeta}>
            <StatusBadge status={brief.brief_status || 'draft'} />
            {brief.brief_url && (
              <a href={brief.brief_url} target="_blank" rel="noopener noreferrer" className={docStyles.githubLink}>
                View on GitHub &nearr;
              </a>
            )}
          </div>
        </div>
        <div className={docStyles.pageActions}>
          <SaveStateIndicator
            state={isEditing ? (isDirty ? 'dirty' : 'saved') : pipeline.state === 'sync_failed' ? 'error' : 'saved'}
            label={pipeline.state === 'saving' ? 'Saving...' : pipeline.state === 'sync_failed' ? 'Saved — GitHub sync pending' : undefined}
          />
          {!isEditing ? (
            <>
              {!isChangesRequested && (
                <Button variant="secondary" onClick={handleEdit}>Edit</Button>
              )}
              {isChangesRequested && (
                <Button onClick={handleEdit}>Revise</Button>
              )}
              {(isPendingApproval || isApproved || isChangesRequested) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    // On mobile (< 1240px), use overlay; on desktop, toggle inline rail
                    if (window.innerWidth < 1240) {
                      setShowRailOverlay(true);
                    } else {
                      setShowReviewRail((prev) => !prev);
                    }
                  }}
                >
                  {showReviewRail ? 'Close review' : 'Review'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!isDirty || pipeline.state === 'saving'}
                loading={pipeline.state === 'saving'}
              >
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Artifact tabs */}
      <ArtifactTabs active="brief" studyPublicId={studyPublicId || ''} />

      {/* Status banners */}
      {isPendingApproval && (
        <Alert variant="warning" title="Pending approval">
          This brief is waiting for stakeholder approval.
          {brief.brief_reviewer_display_name && (
            <> Reviewer: <strong>{brief.brief_reviewer_display_name}</strong></>
          )}
        </Alert>
      )}

      {isApproved && (
        <Alert variant="success" title="Brief approved">
          Approved{brief.brief_approved_at ? ` on ${new Date(brief.brief_approved_at).toLocaleDateString()}` : ''}.
          {' '}
          <Link to={`/studies/${studyPublicId}/plan/new`}>Open the research plan &rarr;</Link>
        </Alert>
      )}

      {isChangesRequested && (
        <Alert variant="error" title="Changes requested">
          {brief.brief_reviewer_display_name && (
            <p><strong>{brief.brief_reviewer_display_name}</strong> requested changes.</p>
          )}
          {brief.brief_change_feedback && <p>{brief.brief_change_feedback}</p>}
        </Alert>
      )}

      {changesSubmitted && !isChangesRequested && (
        <Alert variant="success" title="Changes requested and sent to the researcher">
          Your feedback has been saved.
        </Alert>
      )}

      {/* Save failure banner */}
      {pipeline.state === 'save_failed' && (
        <Alert variant="error" title="Save failed">
          {pipeline.error || 'Could not save changes. Your edits are still in the editor — try again.'}
        </Alert>
      )}
      {pipeline.state === 'sync_failed' && (
        <Alert variant="warning" title="Saved — GitHub sync pending">
          Your changes were saved to Qori. The GitHub projection failed and can be retried.
          {pipeline.error && <> ({pipeline.error})</>}
        </Alert>
      )}

      {/* Document body */}
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>

          {/* Edit mode: TipTap editor */}
          {isEditing && (
            <ArtifactEditor
              initialContent={buildBriefEditorContent(prose)}
              onDirtyChange={setIsDirty}
              editorRef={editorRef}
            />
          )}

          {/* View mode: read-only document sections */}
          {!isEditing && (
          <>
          {/* Masthead (system) */}
          <Masthead
            studyName={brief.study.name}
            researcherName={meta.researcher_name}
            requestedBy={meta.requestor_name}
            date={meta.created_at || brief.study.created_at}
          />

          {/* Summary (generated) */}
          <DocumentSection sectionId="summary" title="Summary" provenance="generated" editable>
            {prose.summary ? (
              <MarkdownDisplay markdown={prose.summary} className={docStyles.blockProse} />
            ) : brief.cascade_fields.research_objectives ? (
              <p className={docStyles.block}>Brief generated. See sections below for details.</p>
            ) : null}
            {facts.length > 0 && <FactsGrid facts={facts} />}
          </DocumentSection>

          {/* Problem + Barriers (generated + canonical) */}
          <DocumentSection sectionId="problem" title="Problem" provenance="generated+canonical" editable>
            {prose.problem_narrative && (
              <MarkdownDisplay markdown={prose.problem_narrative} className={docStyles.blockProse} />
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

          {/* Objectives + Questions (canonical) */}
          <DocumentSection sectionId="objectives" title="What we'll learn" provenance="canonical" editable>
            <StructuredItemRows>
              {objectives.map((o) => (
                <StructuredItemRow key={o.id} id={o.id} text={o.objective} />
              ))}
            </StructuredItemRows>
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

          {/* Method (generated) */}
          <DocumentSection sectionId="method" title="Method" provenance="generated" editable>
            {methodology && (
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>READ-ONLY · SYSTEM</span>
                <p className={docStyles.kvParagraph}>
                  <b>Approach</b> — {methodology}
                </p>
              </div>
            )}
            {prose.method_prose && (
              <MarkdownDisplay markdown={stripLeadingApproach(prose.method_prose)} className={docStyles.blockProse} />
            )}
          </DocumentSection>

          {/* Participants (generated + canonical) */}
          <DocumentSection sectionId="participants" title="Participants" provenance="generated+canonical" editable>
            {/* Participant segments table (if available) */}
            {participantSegments.length > 0 && (
              <DocumentTable
                columns={[
                  { key: 'segment', label: 'Segment', width: '28%' },
                  { key: 'count', label: 'Count', width: '10%', align: 'center' },
                  { key: 'rationale', label: 'Rationale', width: '62%' },
                ]}
                rows={participantSegments}
              />
            )}
            {prose.participants_prose && (
              <MarkdownDisplay markdown={prose.participants_prose} className={docStyles.blockProse} />
            )}
            {!prose.participants_prose && brief.cascade_fields.participant_approach && (
              <p className={docStyles.block}>{brief.cascade_fields.participant_approach}</p>
            )}
            {/* Recruitment subsection */}
            {recruitmentSources && (
              <div className={docStyles.editableBlock}>
                <p className={docStyles.kvParagraph}>
                  <b>Recruitment</b> — {recruitmentSources}
                </p>
              </div>
            )}
          </DocumentSection>

          {/* Out of scope (generated) */}
          {(prose.out_of_scope || brief.cascade_fields.research_objectives) && (
            <DocumentSection sectionId="scope" title="Out of scope" provenance="generated" editable>
              {prose.out_of_scope ? (
                <MarkdownDisplay markdown={prose.out_of_scope} className={docStyles.blockProse} />
              ) : null}
            </DocumentSection>
          )}

          {/* Risks (generated) */}
          {risks.length > 0 && (
            <DocumentSection sectionId="risks" title="Risks" provenance="generated" editable>
              <DocumentTable
                columns={[
                  { key: 'risk', label: 'Risk' },
                  { key: 'source', label: 'Source' },
                  { key: 'mitigation', label: 'Mitigation' },
                ]}
                rows={risks}
              />
            </DocumentSection>
          )}

          {/* Timeline (system) */}
          {(timelinePhases.length > 0 || brief.cascade_fields.start_date) && (
            <DocumentSection sectionId="timeline" title="Timeline" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>System</span>
                {/* Phase table from timeline_phases */}
                {timelinePhases.length > 0 ? (
                  <>
                    <DocumentTable
                      columns={[
                        { key: 'phase', label: 'Phase' },
                        { key: 'dates', label: 'Dates' },
                      ]}
                      rows={timelinePhases}
                    />
                    {decisionDeadline && (
                      <p style={{ marginTop: 'var(--space-3)' }}>
                        <strong>Hard deadline</strong> &mdash; {decisionDeadline}
                      </p>
                    )}
                  </>
                ) : (
                  <p><strong>Start date:</strong> {brief.cascade_fields.start_date}</p>
                )}
              </div>
            </DocumentSection>
          )}

          {/* Approval (system) — always rendered */}
          <ApprovalSection
            budget={brief.cascade_fields.budget}
            isApproved={isApproved}
          />

          {/* Validity checklist (collapsed) */}
          <CollapsibleSection title="Validity checklist">
            <DocumentTable
              columns={[{ key: 'check', label: 'Check' }, { key: 'result', label: 'Result' }]}
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
            <p style={{ fontSize: 'var(--text-secondary-size)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              This brief establishes the research scope for downstream templates.
            </p>
            <DocumentTable
              columns={[{ key: 'commitment', label: 'Commitment' }, { key: 'count', label: 'Count' }]}
              rows={[
                { commitment: 'Research objectives', count: objectives.length },
                { commitment: 'Research questions', count: questions.length },
                { commitment: 'Target barriers', count: barriers.length },
                { commitment: 'Methodology', count: methodology || 'N/A' },
                { commitment: 'Budget', count: brief.cascade_fields.budget || 'N/A' },
              ]}
            />
            {discoverySources.length > 0 && (
              <>
                <p style={{ fontSize: 'var(--text-secondary-size)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
                  <strong>Discovery sources</strong> — synthesized from {discoverySources.length} source{discoverySources.length !== 1 ? 's' : ''}.
                  Citation markers numbered per-section; prefix indicates source type.
                </p>
                <DocumentTable
                  columns={[
                    { key: 'prefix', label: 'Prefix' },
                    { key: 'source', label: 'Source' },
                    { key: 'type', label: 'Type' },
                    { key: 'findings', label: 'Findings used' },
                  ]}
                  rows={discoverySources}
                />
              </>
            )}
          </CollapsibleSection>

          {/* Document information (collapsed) */}
          <CollapsibleSection title="Document information">
            <DocumentTable
              columns={[{ key: 'field', label: '' }, { key: 'value', label: '' }]}
              rows={[
                {
                  field: 'Generated',
                  value: artifactMetadata.created_at
                    ? new Date(artifactMetadata.created_at).toLocaleString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                      })
                    : brief.study.created_at
                      ? new Date(brief.study.created_at).toLocaleString()
                      : 'N/A',
                },
                { field: 'Model', value: 'claude-sonnet-4-6' },
                {
                  field: 'Template',
                  value: artifactMetadata.template_id && artifactMetadata.template_version
                    ? `${artifactMetadata.template_id} v${artifactMetadata.template_version}`
                    : 'research_brief',
                },
                { field: 'Study', value: brief.study.name },
                {
                  field: 'GitHub path',
                  value: artifactMetadata.path || meta.study_path || 'N/A',
                },
              ]}
            />
            <p style={{ fontSize: 'var(--text-secondary-size)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
              Generated by Qori. The Workspace is the editing surface; GitHub holds the durable rendered projection of the same canonical state.
            </p>
          </CollapsibleSection>
          </>
          )}
        </div>

        {/* Review rail (Brief only) — right side, hidden during editing, closed by default */}
        {!isEditing && (isPendingApproval || isApproved || isChangesRequested) && (
          <>
            {/* Desktop rail (opened via Review button, closed by default) */}
            {showReviewRail && (
            <aside className={styles.reviewRail} aria-label="Review">
              {isPendingApproval && (
                <div className={styles.railCard}>
                  <div className={styles.railCardHeader}>
                    Review · approval gate
                    <button
                      className={docStyles.railCloseButton}
                      style={{ display: 'inline-block' }}
                      onClick={() => setShowReviewRail(false)}
                    >
                      Close ✕
                    </button>
                  </div>
                  <div className={styles.railCardBody}>
                    {!showChangesForm ? (
                      <>
                        <div className={styles.checklistGroup}>
                          {Object.entries(checklist).map(([key, checked]) => (
                            <label key={key} className={styles.checkItem}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))}
                              />
                              <span>
                                {key === 'scope' && 'Scope and method are appropriate'}
                                {key === 'timeline' && 'Timeline and deadline are feasible'}
                                {key === 'participants' && 'Participant approach is sound'}
                                {key === 'budget' && 'Budget is reasonable'}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className={styles.railActions}>
                          <Button onClick={handleApprove} disabled={!allChecked} loading={approveBrief.isPending}>
                            Approve brief
                          </Button>
                          <Button variant="secondary" onClick={() => setShowChangesForm(true)}>
                            Request changes
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Textarea
                          label="What needs to change?"
                          required
                          value={changeFeedback}
                          onChange={(e) => setChangeFeedback(e.target.value)}
                        />
                        <div className={styles.railActions}>
                          <Button onClick={handleRequestChanges} variant="danger" disabled={!changeFeedback.trim()} loading={requestChanges.isPending}>
                            Submit feedback
                          </Button>
                          <Button variant="ghost" onClick={() => setShowChangesForm(false)}>Cancel</Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {(isApproved || isChangesRequested) && (
                <ReviewRail
                  briefStatus={brief.brief_status}
                  reviewerName={brief.brief_reviewer_display_name}
                  approvedAt={brief.brief_approved_at}
                  changeFeedback={brief.brief_change_feedback}
                  onClose={() => setShowReviewRail(false)}
                />
              )}
              <p className={docStyles.reviewRailNote}>
                Feedback anchors to sections today. Future: comment threads attach to structured IDs (OBJ / RQ / TB) and render here; ID tags in the document open their provenance in this rail.
              </p>
            </aside>
            )}

            {/* Mobile overlay rail */}
            {showRailOverlay && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.3)',
                  zIndex: 39,
                }}
                onClick={() => setShowRailOverlay(false)}
              />
            )}
            {showRailOverlay && (
              <ReviewRail
                briefStatus={brief.brief_status}
                reviewerName={brief.brief_reviewer_display_name}
                approvedAt={brief.brief_approved_at}
                changeFeedback={brief.brief_change_feedback}
                isOverlay
                onClose={() => setShowRailOverlay(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
