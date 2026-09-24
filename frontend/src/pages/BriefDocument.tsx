/**
 * BriefDocument — Full document-style Brief view matching design reference exactly.
 * HTML structure and class names match brief-view.html reference.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import type { JSONContent, Editor } from '@tiptap/react';
import { useStudyBrief } from '@/api/queries/useStudy';
import { useApproveBrief, useRequestChanges } from '@/api/mutations/useApproveBrief';
import { useSaveBriefContent } from '@/api/mutations/useSaveContent';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Textarea } from '@/components/ui/Textarea';
import { ArtifactEditor } from '@/components/study/editor/ArtifactEditor';
import { serializeBrief } from '@/components/study/editor/serializer';
import { buildEditorDocument, type SectionProvenance } from '@/components/study/editor/markdownBridge';
import { useSavePipeline } from '@/components/study/editor/useSavePipeline';
import { MarkdownDisplay } from '@/components/study/editor/MarkdownDisplay';
import { ApprovalSection } from '@/components/study/document/ApprovalSection';
import {
  projectBriefToWorkspace,
  type BriefProjectionInput,
} from '@qori/artifact-contracts';
import '@/styles/brief-document.css';

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
 * Follows the same pattern as buildPlanEditorContent in PlanDocument.tsx.
 *
 * CC-4.5 (DDR-11): Fixes PF-04 — previously only loaded objectives,
 * which are READ-ONLY per the artifact contract.
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
  // in view mode (lines 509-512). It is NOT part of the editable content.
  // Only hydrate the actual method_prose to avoid duplication on save/reload.
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

export function BriefDocument() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const { data: brief, isLoading, error } = useStudyBrief(studyPublicId!);
  const approveBrief = useApproveBrief(studyPublicId!);
  const requestChanges = useRequestChanges(studyPublicId!);
  const saveBriefContent = useSaveBriefContent(studyPublicId!);
  useAuth(); // Keep auth context available

  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState('');
  const [showReviewRail, setShowReviewRail] = useState(true);
  const [checklist, setChecklist] = useState({ scope: false, timeline: false, participants: false, budget: false });
  const editorRef = useRef<Editor | null>(null);

  const pipeline = useSavePipeline();

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !brief) return;
    pipeline.startSave();
    try {
      const serialized = serializeBrief(editorRef.current);
      const result = await saveBriefContent.mutateAsync({
        artifact_version: 1, // TODO: Track version
        sections: serialized.sections,
        structured: serialized.structured,
      });
      pipeline.completeSave(result);
      setIsDirty(false);
    } catch (err) {
      pipeline.failSave(err instanceof Error ? err.message : 'Save failed');
    }
  }, [pipeline, brief, saveBriefContent]);

  // Project raw API response to view model (centralized derivation)
  const vm = useMemo(() => {
    if (!brief) return null;
    const input: BriefProjectionInput = {
      study: {
        public_id: studyPublicId,
        name: brief.study?.name || '',
        created_at: brief.study?.created_at,
      },
      brief_status: brief.brief_status,
      brief_reviewer_id: brief.brief_approved_by,
      brief_reviewer_display_name: brief.brief_reviewer_display_name,
      brief_change_feedback: brief.brief_change_feedback,
      brief_approved_at: brief.brief_approved_at,
      brief_url: brief.brief_url,
      prose_sections: brief.prose_sections,
      cascade_fields: brief.cascade_fields || {},
      structured_fields: brief.structured_fields,
      artifact_metadata: (brief as any).artifact_metadata,
    };
    return projectBriefToWorkspace(input);
  }, [brief, studyPublicId]);

  if (isLoading) return <div className="brief-doc"><Skeleton height="400px" /></div>;
  if (error || !brief || !vm) return <ErrorState message={error?.message || 'Could not load brief'} />;

  // Approval state from view model
  const isPendingApproval = vm.approval.status === 'pending_approval';
  const isApproved = vm.approval.status === 'approved';
  const isChangesRequested = vm.approval.status === 'changes_requested';
  const allChecked = Object.values(checklist).every(Boolean);

  // Structured data from view model (already parsed/validated)
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

  // Quick facts helper - methodology for display in sections
  const methodology = vm.quickFacts.method.exists ? vm.quickFacts.method.value : null;

  const formatDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  async function handleApprove() {
    await approveBrief.mutateAsync({ checklist_confirmed: true });
  }

  async function handleRequestChanges() {
    if (!changeFeedback.trim()) return;
    await requestChanges.mutateAsync({ comment: changeFeedback.trim() });
    setShowChangesForm(false);
  }

  // Simple save state indicator
  const saveStateText = pipeline.state === 'saving' ? 'Saving...'
    : pipeline.state === 'synced' ? 'Saved'
    : pipeline.state === 'save_failed' ? 'Save failed'
    : pipeline.state === 'sync_failed' ? 'Saved (sync pending)'
    : null;

  return (
    <div className={`brief-doc${isEditing ? ' is-editing' : ''}`}>
      {/* Breadcrumbs */}
      <nav className="crumbs" aria-label="Breadcrumb" style={{ fontSize: '13.5px', color: '#565c65', marginBottom: '14px', display: 'flex', gap: '8px' }}>
        <Link to="/" style={{ color: '#005ea2' }}>Home</Link>
        <span style={{ color: '#71767a' }}>›</span>
        <Link to={`/studies/${studyPublicId}`} style={{ color: '#005ea2' }}>{vm.study.name}</Link>
        <span style={{ color: '#71767a' }}>›</span>
        <span style={{ color: '#3d4551' }}>Brief</span>
      </nav>

      {/* Page head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '34px', fontWeight: 700, margin: 0, lineHeight: 1.15 }}>Research Brief</h1>
          <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isApproved && <span className="pill success">✓ Approved</span>}
            {isPendingApproval && <span className="pill warn">Pending approval</span>}
            {isChangesRequested && <span className="pill error">Changes requested</span>}
            {vm.githubUrl && (
              <a href={vm.githubUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13.5px' }}>
                View on GitHub ↗
              </a>
            )}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {saveStateText && <span style={{ fontSize: '13px', color: '#565c65' }}>{saveStateText}</span>}
          {pipeline.lastSavedAt && pipeline.state === 'idle' && (
            <span style={{ fontSize: '12px', color: '#71767a' }}>Last saved {formatDate(pipeline.lastSavedAt)}</span>
          )}
          {!isEditing && <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>}
          {isEditing && (
            <>
              <Button variant="secondary" onClick={() => { setIsEditing(false); setIsDirty(false); }}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={!isDirty}>Save</Button>
            </>
          )}
          {(isPendingApproval || isApproved || isChangesRequested) && !isEditing && (
            <Button
              variant="secondary"
              onClick={() => setShowReviewRail(!showReviewRail)}
              aria-label={showReviewRail ? 'Close review' : 'Review'}
            >
              {showReviewRail ? 'Close review' : 'Review'}
            </Button>
          )}
        </div>
      </div>

      {/* Artifact tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #dfe1e2', margin: '18px 0 0' }} role="tablist">
        <Link
          to={`/studies/${studyPublicId}/brief`}
          role="tab"
          aria-selected="true"
          style={{ padding: '10px 18px', fontSize: '14.5px', fontWeight: 700, color: '#1b1b1b', borderBottom: '3px solid #005ea2', marginBottom: '-1px', textDecoration: 'none' }}
        >
          Brief
        </Link>
        <Link
          to={`/studies/${studyPublicId}/plan`}
          role="tab"
          aria-selected="false"
          style={{ padding: '10px 18px', fontSize: '14.5px', fontWeight: 500, color: '#565c65', borderBottom: '3px solid transparent', marginBottom: '-1px', textDecoration: 'none' }}
        >
          Research Plan
        </Link>
      </div>

      {/* Alert banner */}
      {isApproved && (
        <div style={{ display: 'flex', gap: '14px', padding: '16px 20px', margin: '20px 0 0', borderLeft: '8px solid #00a91c', background: '#ecf3ec', alignItems: 'flex-start' }}>
          <span style={{ color: '#00a91c', lineHeight: 0 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" fill="currentColor"/><path d="M6.5 11.5l3 3 6-6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>Brief approved</div>
            <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#3d4551' }}>
              {vm.approval.reviewerDisplayName && <>Approved by {vm.approval.reviewerDisplayName} · </>}
              {formatDate(vm.approval.approvedAt)}.{' '}
              <Link to={`/studies/${studyPublicId}/plan`}>Open the research plan →</Link>
            </div>
          </div>
        </div>
      )}

      {isPendingApproval && (
        <div style={{ display: 'flex', gap: '14px', padding: '16px 20px', margin: '20px 0 0', borderLeft: '8px solid #ffbe2e', background: '#faf3d1', alignItems: 'flex-start' }}>
          <span style={{ color: '#ffbe2e', lineHeight: 0, flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>Pending approval</div>
            <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#3d4551' }}>
              {vm.approval.reviewerDisplayName && <>Sent to <b>{vm.approval.reviewerDisplayName}</b> for approval. </>}
              Use the Review panel to approve or request changes.
            </div>
          </div>
        </div>
      )}

      {isChangesRequested && (
        <div style={{ display: 'flex', gap: '14px', padding: '16px 20px', margin: '20px 0 0', borderLeft: '8px solid #b50909', background: '#f8eae7', alignItems: 'flex-start' }}>
          <span style={{ color: '#b50909', lineHeight: 0, flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>Changes requested</div>
            <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#3d4551' }}>
              {vm.approval.changeFeedback && <div style={{ borderLeft: '3px solid #b50909', paddingLeft: '10px', fontStyle: 'italic', marginTop: '8px' }}>{vm.approval.changeFeedback}</div>}
            </div>
          </div>
          <Button variant="secondary" onClick={() => setIsEditing(true)}>Revise</Button>
        </div>
      )}

      {/* Document body */}
      <div className="doc-wrap">
        <div className="doc-col">
          {/* Edit mode: hydrates editable prose sections (CC-4.5 fix for PF-04/DDR-11) */}
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
              {/* Masthead */}
              <div className="blk ro">
                <span className="lock">READ-ONLY · SYSTEM</span>
                <div className="masthead">
                  <span><span className="k">Study</span>{vm.masthead.studyName}</span>
                  {vm.masthead.requestorName && <span><span className="k">Requested by</span>{vm.masthead.requestorName}</span>}
                  <span><span className="k">Date</span>{vm.masthead.dateFormatted || formatDate(vm.masthead.date)}</span>
                </div>
              </div>

              {/* Summary */}
              <section className="doc-sec" data-sec="summary">
                <h2>Summary<span className="prov">GENERATED · EDITABLE</span></h2>
                {summaryProse && (
                  <div className="blk ed">
                    <span className="grip" aria-hidden="true">⋮⋮</span>
                    <MarkdownDisplay markdown={summaryProse} />
                  </div>
                )}
                {/* Quick Facts */}
                <div className="blk ro">
                  <span className="lock">READ-ONLY · SYSTEM</span>
                  <div className="facts">
                    {vm.quickFacts.method.exists && (
                      <div>
                        <div className="k">Method</div>
                        <div className="v">{vm.quickFacts.method.value}</div>
                        {vm.quickFacts.method.sub && <div className="s">{vm.quickFacts.method.sub}</div>}
                      </div>
                    )}
                    {vm.quickFacts.participants.exists && (
                      <div>
                        <div className="k">Participants</div>
                        <div className="v">{vm.quickFacts.participants.value}</div>
                        {vm.quickFacts.participants.sub && <div className="s">{vm.quickFacts.participants.sub}</div>}
                      </div>
                    )}
                    {vm.quickFacts.timeline.exists && (
                      <div>
                        <div className="k">Timeline</div>
                        <div className="v">{vm.quickFacts.timeline.value}</div>
                        {vm.quickFacts.timeline.sub && <div className="s">{vm.quickFacts.timeline.sub}</div>}
                      </div>
                    )}
                    {vm.quickFacts.decisionDeadline.exists && (
                      <div>
                        <div className="k">Decision deadline</div>
                        <div className="v">{vm.quickFacts.decisionDeadline.value}</div>
                        {vm.quickFacts.decisionDeadline.sub && <div className="s">{vm.quickFacts.decisionDeadline.sub}</div>}
                      </div>
                    )}
                    {vm.quickFacts.budget.exists && (
                      <div>
                        <div className="k">Budget</div>
                        <div className="v">{vm.quickFacts.budget.value}</div>
                        {vm.quickFacts.budget.sub && <div className="s">{vm.quickFacts.budget.sub}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Problem */}
              {(problemProse || barriers.length > 0) && (
                <section className="doc-sec" data-sec="problem">
                  <h2>Problem<span className="prov">GENERATED + CANONICAL</span></h2>
                  {problemProse && (
                    <div className="blk ed">
                      <span className="grip" aria-hidden="true">⋮⋮</span>
                      <MarkdownDisplay markdown={problemProse} />
                    </div>
                  )}
                  {barriers.length > 0 && (
                    <>
                      <h3>Target barriers for validation</h3>
                      <div className="blk ed">
                        <span className="grip" aria-hidden="true">⋮⋮</span>
                        <div className="itemrows">
                          {barriers.map((b) => (
                            <div key={b.id} className="itemrow">
                              <span className="idtag" title={`${b.id} — stable canonical ID`}>{b.id}</span>
                              <span className="txt">{b.barrier}{b.source && <em> — {b.source}</em>}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* What we'll learn (Objectives + Research Questions) */}
              {(objectives.length > 0 || questions.length > 0) && (
                <section className="doc-sec" data-sec="objectives">
                  <h2>What we'll learn<span className="prov canonical">CANONICAL · EDITABLE</span></h2>
                  {objectives.length > 0 && (
                    <div className="blk ed">
                      <span className="grip" aria-hidden="true">⋮⋮</span>
                      <div className="itemrows">
                        {objectives.map((o) => (
                          <div key={o.id} className="itemrow">
                            <span className="idtag" title={`${o.id} — stable canonical ID`}>{o.id}</span>
                            <span className="txt">{o.objective}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {questions.length > 0 && (
                    <>
                      <h3>Research questions</h3>
                      <div className="blk ed">
                        <span className="grip" aria-hidden="true">⋮⋮</span>
                        <div className="itemrows">
                          {questions.map((q) => (
                            <div key={q.id} className="itemrow">
                              <span className="idtag" title={`${q.id} — stable canonical ID`}>{q.id}</span>
                              <span className="txt">{q.question}</span>
                              {q.priority && (
                                <span className={`pill ${q.priority === 'Primary' ? 'success' : q.priority === 'Secondary' ? 'info' : 'gray'}`}>
                                  {q.priority}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* Method */}
              {(methodology || methodProse) && (
                <section className="doc-sec" data-sec="method">
                  <h2>Method<span className="prov">GENERATED · EDITABLE</span></h2>
                  <div className="blk ro">
                    <span className="lock">READ-ONLY · SYSTEM</span>
                    {methodology && <p className="kv"><b>Approach</b> — {methodology}</p>}
                  </div>
                  {methodProse && (
                    <div className="blk ed">
                      <span className="grip" aria-hidden="true">⋮⋮</span>
                      <MarkdownDisplay markdown={methodProse} />
                    </div>
                  )}
                </section>
              )}

              {/* Participants — render segments table if available, else prose fallback */}
              {(vm.participantSegments.exists || participantsProse) && (
                <section className="doc-sec" data-sec="participants">
                  <h2>Participants<span className="prov">GENERATED + CANONICAL</span></h2>
                  {participantSegments.length > 0 ? (
                    <div className="blk ed">
                      <span className="grip" aria-hidden="true">⋮⋮</span>
                      <div>
                        <table className="doc-table">
                          <thead>
                            <tr>
                              <th>Segment</th>
                              <th>Count</th>
                              <th>Rationale</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participantSegments.map((s: { segment: string; count: number | string; rationale: string }, i: number) => (
                              <tr key={i}>
                                <td>{s.segment}</td>
                                <td><b>{s.count}</b></td>
                                <td>{s.rationale}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {/* Prose paragraph after table, then inline Recruitment */}
                        {participantsProse && <MarkdownDisplay markdown={participantsProse} />}
                        {vm.recruitmentSources && (
                          <p className="kv"><b>Recruitment</b> — {vm.recruitmentSources}</p>
                        )}
                      </div>
                    </div>
                  ) : participantsProse ? (
                    <div className="blk ed">
                      <span className="grip" aria-hidden="true">⋮⋮</span>
                      <MarkdownDisplay markdown={participantsProse} />
                      {vm.recruitmentSources && (
                        <p className="kv"><b>Recruitment</b> — {vm.recruitmentSources}</p>
                      )}
                    </div>
                  ) : (
                    <div className="blk ro">
                      <span className="lock">READ-ONLY · SYSTEM</span>
                      <p>{vm.participantSegments.approach}</p>
                      {vm.recruitmentSources && (
                        <p className="kv"><b>Recruitment</b> — {vm.recruitmentSources}</p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Out of scope */}
              {outOfScopeProse && (
                <section className="doc-sec" data-sec="out-of-scope">
                  <h2>Out of scope<span className="prov">GENERATED · EDITABLE</span></h2>
                  <div className="blk ed">
                    <span className="grip" aria-hidden="true">⋮⋮</span>
                    <MarkdownDisplay markdown={outOfScopeProse} />
                  </div>
                </section>
              )}

              {/* Risks */}
              {risks.length > 0 && (
                <section className="doc-sec" data-sec="risks">
                  <h2>Risks<span className="prov">GENERATED · EDITABLE</span></h2>
                  <div className="blk ed">
                    <span className="grip" aria-hidden="true">⋮⋮</span>
                    <div>
                      <table className="doc-table">
                        <thead>
                          <tr>
                            <th>Risk</th>
                            <th>Source</th>
                            <th>Mitigation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {risks.map((r, i) => (
                            <tr key={i}>
                              <td>{r.risk}</td>
                              <td>{r.source}</td>
                              <td>{r.mitigation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {/* Timeline — render phases table if available, else fallback to start/deadline */}
              {/* vm.timeline.summary.startDate includes fallback from cascade.start_date via projection */}
              {(vm.timeline.exists || vm.timeline.summary.startDate || vm.quickFacts.decisionDeadline.exists) && (
                <section className="doc-sec" data-sec="timeline">
                  <h2>Timeline<span className="prov system">SYSTEM · READ-ONLY</span></h2>
                  <div className="blk ro">
                    <span className="lock">READ-ONLY · SYSTEM</span>
                    {timelinePhases.length > 0 ? (
                      <table className="doc-table">
                        <thead>
                          <tr>
                            <th>Phase</th>
                            <th>Dates</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timelinePhases.map((p, i) => (
                            <tr key={i}>
                              <td>{p.phase}</td>
                              <td>{p.dates}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="facts" style={{ marginTop: 0 }}>
                        {vm.timeline.summary.startDate && (
                          <div>
                            <div className="k">Start date</div>
                            <div className="v">{formatDate(vm.timeline.summary.startDate)}</div>
                          </div>
                        )}
                        {vm.quickFacts.decisionDeadline.exists && (
                          <div>
                            <div className="k">Decision deadline</div>
                            <div className="v">{vm.quickFacts.decisionDeadline.value}</div>
                            {vm.quickFacts.decisionDeadline.sub && <div className="s">{vm.quickFacts.decisionDeadline.sub}</div>}
                          </div>
                        )}
                      </div>
                    )}
                    {timelinePhases.length > 0 && vm.quickFacts.decisionDeadline.exists && (
                      <p className="kv"><b>Hard deadline</b> — {vm.quickFacts.decisionDeadline.value}{vm.quickFacts.decisionDeadline.sub && ` (${vm.quickFacts.decisionDeadline.sub})`}</p>
                    )}
                  </div>
                </section>
              )}

              {/* Approval — uses ApprovalSection component (single source of truth) */}
              <ApprovalSection budget={vm.quickFacts.budget.exists ? vm.quickFacts.budget.value : null} isApproved={isApproved} />

              {/* Collapsible sections */}
              <details className="sys">
                <summary>Validity checklist</summary>
                <div className="inner">
                  <table className="doc-table">
                    <thead><tr><th>Check</th><th>Result</th></tr></thead>
                    <tbody>
                      <tr><td>Problem statement grounds target barriers</td><td></td></tr>
                      <tr><td>Learning objectives map to research questions</td><td></td></tr>
                      <tr><td>Methodology fits the research questions</td><td></td></tr>
                      <tr><td>Participant approach addresses criteria</td><td></td></tr>
                      <tr><td>Discovery sources cited where used</td><td></td></tr>
                      <tr><td>Out of scope is explicit</td><td></td></tr>
                    </tbody>
                  </table>
                </div>
              </details>

              <details className="sys">
                <summary>Research provenance</summary>
                <div className="inner">
                  <p>This brief establishes the research scope for downstream templates.</p>
                  <table className="doc-table">
                    <thead><tr><th>Commitment</th><th>Count</th></tr></thead>
                    <tbody>
                      <tr><td>Research objectives</td><td>{vm.objectives.count}</td></tr>
                      <tr><td>Research questions</td><td>{vm.questions.count}</td></tr>
                      <tr><td>Target barriers</td><td>{vm.barriers.count}</td></tr>
                      <tr><td>Methodology</td><td>{vm.quickFacts.method.exists ? vm.quickFacts.method.value : '—'}</td></tr>
                      <tr><td>Budget</td><td>{vm.quickFacts.budget.exists ? vm.quickFacts.budget.value : '—'}</td></tr>
                    </tbody>
                  </table>
                  {discoverySources.length > 0 && (
                    <>
                      <p style={{ marginTop: '10px' }}><b>Discovery sources</b> — synthesized from {discoverySources.length} sources.</p>
                      <table className="doc-table">
                        <thead><tr><th>Prefix</th><th>Source</th><th>Type</th><th>Findings used</th></tr></thead>
                        <tbody>
                          {discoverySources.map((d: { prefix: string; source: string; type: string; findings: string }, i: number) => (
                            <tr key={i}><td>{d.prefix}</td><td>{d.source}</td><td>{d.type}</td><td>{d.findings}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </details>

              <details className="sys">
                <summary>Document information</summary>
                <div className="inner">
                  <table className="doc-table">
                    <tbody>
                      <tr><td>Generated</td><td>{formatDate(vm.artifact.createdAt)}</td></tr>
                      <tr><td>Model</td><td>{vm.artifact.model || 'claude-sonnet-4-6'}</td></tr>
                      <tr><td>Template</td><td>{vm.artifact.templateId && vm.artifact.templateVersion ? `${vm.artifact.templateId} ${vm.artifact.templateVersion}` : 'research_brief v7.1'}</td></tr>
                      <tr><td>Study</td><td>{vm.study.name}</td></tr>
                      {vm.artifact.path && <tr><td>GitHub path</td><td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{vm.artifact.path.split('/').slice(-1)[0]}</td></tr>}
                    </tbody>
                  </table>
                  <p>Generated by Qori. The Workspace is the editing surface; GitHub holds the durable rendered projection of the same canonical state.</p>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Review rail */}
        {!isEditing && showReviewRail && (isPendingApproval || isApproved || isChangesRequested) && (
          <aside className="review-rail" aria-label="Review">
            <div className="rcard">
              <div className="hd">
                Review · approval gate
                <button className="rail-close" onClick={() => setShowReviewRail(false)} aria-label="Close review">Close ✕</button>
              </div>
              <div className="bd">
                <div className="txt">
                  {isApproved && (
                    <>
                      <b style={{ color: '#446443' }}>Approved</b>
                      {vm.approval.reviewerDisplayName && <> by {vm.approval.reviewerDisplayName}</>}
                      {vm.approval.approvedAt && <> · {formatDate(vm.approval.approvedAt)}</>}
                      . The brief is now the citation source for downstream artifacts; edits after approval flag them stale.
                    </>
                  )}
                  {isPendingApproval && !showChangesForm && (
                    <>
                      <b style={{ color: '#6b5410' }}>Pending approval</b>. A stakeholder review is required before proceeding to the research plan.
                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(checklist).map(([key, checked]) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13.5px' }}>
                            <input type="checkbox" checked={checked} onChange={(e) => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))} style={{ marginTop: '3px' }} />
                            <span>
                              {key === 'scope' && 'Scope and method are appropriate'}
                              {key === 'timeline' && 'Timeline and deadline are feasible'}
                              {key === 'participants' && 'Participant approach is sound'}
                              {key === 'budget' && 'Budget is reasonable'}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleApprove} disabled={!allChecked || approveBrief.isPending}>
                          {approveBrief.isPending ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button variant="secondary" onClick={() => setShowChangesForm(true)}>Request changes</Button>
                      </div>
                    </>
                  )}
                  {isPendingApproval && showChangesForm && (
                    <>
                      <b style={{ color: '#6b5410' }}>Request changes</b>
                      <Textarea
                        label="Feedback"
                        value={changeFeedback}
                        onChange={(e) => setChangeFeedback(e.target.value)}
                        placeholder="Describe the changes needed..."
                        style={{ marginTop: '12px', minHeight: '80px' }}
                      />
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                        <Button variant="secondary" onClick={() => setShowChangesForm(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleRequestChanges} disabled={!changeFeedback.trim() || requestChanges.isPending}>
                          {requestChanges.isPending ? 'Submitting...' : 'Submit'}
                        </Button>
                      </div>
                    </>
                  )}
                  {isChangesRequested && (
                    <>
                      <b style={{ color: '#b50909' }}>Changes requested</b>
                      {vm.approval.reviewerDisplayName && <> by {vm.approval.reviewerDisplayName}</>}.
                      {vm.approval.changeFeedback && (
                        <div style={{ borderLeft: '3px solid #b50909', paddingLeft: '10px', fontStyle: 'italic', marginTop: '8px' }}>{vm.approval.changeFeedback}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="rail-note">
              Feedback anchors to sections today. Future: comment threads attach to structured IDs (OBJ / RQ / TB) and render here.
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
