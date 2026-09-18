/**
 * BriefDocument — Full document-style Brief view matching design reference exactly.
 * HTML structure and class names match brief-view.html reference.
 */

import { useState, useRef, useCallback } from 'react';
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
import '@/styles/brief-document.css';

interface Objective { id: string; objective: string }
interface Question { id: string; question: string; priority?: string | null }
interface Barrier { id: string; barrier: string; source?: string | null }
interface ParticipantSegment {
  segment: string;
  count: number | string;
  rationale: string;
}
interface TimelinePhase {
  phase: string;
  dates: string;
  duration?: string;
}
interface Risk {
  risk: string;
  source: string;
  mitigation: string;
}
interface DiscoverySource {
  prefix: string;
  source: string;
  type: string;
  findings: string;
}

function safeParse<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

function buildBriefEditorContent(cascade: {
  research_objectives?: string | null;
  research_questions?: string | null;
  target_barriers?: string | null;
}): JSONContent {
  const sections: Array<{ sectionId: string; markdown: string; provenance?: SectionProvenance; title?: string }> = [];
  // Build basic sections from cascade fields - these are the editable prose sections
  if (cascade.research_objectives) {
    sections.push({ sectionId: 'objectives', markdown: cascade.research_objectives, provenance: 'canonical', title: "What we'll learn" });
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

  if (isLoading) return <div className="brief-doc"><Skeleton height="400px" /></div>;
  if (error || !brief) return <ErrorState message={error?.message || 'Could not load brief'} />;

  const isPendingApproval = brief.brief_status === 'pending_approval';
  const isApproved = brief.brief_status === 'approved';
  const isChangesRequested = brief.brief_status === 'changes_requested';
  const allChecked = Object.values(checklist).every(Boolean);

  // Parse structured data from cascade_fields (stored as JSON strings)
  const objectives: Objective[] = safeParse(brief.cascade_fields.research_objectives);
  const questions: Question[] = safeParse(brief.cascade_fields.research_questions);
  const barriers: Barrier[] = safeParse(brief.cascade_fields.target_barriers);
  const participantSegments: ParticipantSegment[] = safeParse(brief.cascade_fields.participant_segments);
  const timelinePhases: TimelinePhase[] = safeParse(brief.cascade_fields.timeline_phases);
  const discoverySources: DiscoverySource[] = safeParse(brief.cascade_fields.discovery_sources);

  const risks: Risk[] = []; // Risks would be in a prose section if present

  const methodology = brief.cascade_fields.methodology_selection?.replace(/_/g, ' ') || null;
  const sessionFormat = brief.cascade_fields.session_format || null;
  const sessionDuration = brief.cascade_fields.session_duration || null;
  const methodSub = [sessionFormat, sessionDuration].filter(Boolean).join(' · ') || null;

  const participantCount = participantSegments.reduce((sum, s) => {
    const n = typeof s.count === 'number' ? s.count : parseInt(String(s.count), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const timelineDuration = timelinePhases.length > 0 ? `${timelinePhases.length * 2} weeks` : null;
  const timelineDateRange = timelinePhases.length > 0
    ? `${timelinePhases[0]?.dates?.split(' – ')[0] || ''} – ${timelinePhases[timelinePhases.length - 1]?.dates?.split(' – ')[1] || ''}`
    : null;

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

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
    <div className="brief-doc">
      {/* Breadcrumbs */}
      <nav className="crumbs" aria-label="Breadcrumb" style={{ fontSize: '13.5px', color: '#565c65', marginBottom: '14px', display: 'flex', gap: '8px' }}>
        <Link to="/" style={{ color: '#005ea2' }}>Home</Link>
        <span style={{ color: '#71767a' }}>›</span>
        <Link to={`/studies/${studyPublicId}`} style={{ color: '#005ea2' }}>{brief.study.name}</Link>
        <span style={{ color: '#71767a' }}>›</span>
        <span style={{ color: '#3d4551' }}>Brief</span>
      </nav>

      {/* Page head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '34px', fontWeight: 700, margin: 0, lineHeight: 1.15 }}>Research Brief</h1>
          <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isApproved && <span className="pill success">✓ Approved</span>}
            {isPendingApproval && <span className="pill" style={{ color: '#6b5410', borderColor: '#c2a53a', background: '#faf3d1' }}>Pending approval</span>}
            {isChangesRequested && <span className="pill" style={{ color: '#b50909', borderColor: '#b50909', background: '#f8eae7' }}>Changes requested</span>}
            {brief.brief_url && (
              <a href={brief.brief_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13.5px' }}>
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
              {brief.brief_reviewer_display_name && <>Approved by {brief.brief_reviewer_display_name} · </>}
              {formatDate(brief.brief_approved_at)}.{' '}
              <Link to={`/studies/${studyPublicId}/plan`}>Open the research plan →</Link>
            </div>
          </div>
        </div>
      )}

      {isPendingApproval && (
        <div style={{ display: 'flex', gap: '14px', padding: '16px 20px', margin: '20px 0 0', borderLeft: '8px solid #ffbe2e', background: '#faf3d1', alignItems: 'flex-start' }}>
          <span style={{ color: '#ffbe2e', lineHeight: 0 }}>⏳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>Pending approval</div>
            <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#3d4551' }}>
              {brief.brief_reviewer_display_name && <>Assigned to {brief.brief_reviewer_display_name}. </>}
              Use the Review panel to approve or request changes.
            </div>
          </div>
        </div>
      )}

      {isChangesRequested && (
        <div style={{ display: 'flex', gap: '14px', padding: '16px 20px', margin: '20px 0 0', borderLeft: '8px solid #b50909', background: '#f8eae7', alignItems: 'flex-start' }}>
          <span style={{ color: '#b50909', lineHeight: 0 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>Changes requested</div>
            <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#3d4551' }}>
              {brief.brief_change_feedback && <div style={{ borderLeft: '3px solid #b50909', paddingLeft: '10px', fontStyle: 'italic', marginTop: '8px' }}>{brief.brief_change_feedback}</div>}
            </div>
          </div>
          <Button variant="secondary" onClick={() => setIsEditing(true)}>Revise</Button>
        </div>
      )}

      {/* Document body */}
      <div className="doc-wrap">
        <div className="doc-col">
          {/* Edit mode */}
          {isEditing && (
            <ArtifactEditor
              initialContent={buildBriefEditorContent(brief.cascade_fields)}
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
                  <span><span className="k">Study</span>{brief.study.name}</span>
                  {brief.cascade_fields.requestor_name && <span><span className="k">Requested by</span>{brief.cascade_fields.requestor_name}</span>}
                  <span><span className="k">Date</span>{formatDate(brief.study.created_at)}</span>
                </div>
              </div>

              {/* Summary */}
              <section className="doc-sec" data-sec="summary">
                <h2>Summary<span className="prov">GENERATED · EDITABLE</span></h2>
                {/* Quick Facts */}
                <div className="blk ro">
                  <span className="lock">READ-ONLY · SYSTEM</span>
                  <div className="facts">
                    {methodology && (
                      <div>
                        <div className="k">Method</div>
                        <div className="v">{methodology}</div>
                        {methodSub && <div className="s">{methodSub}</div>}
                      </div>
                    )}
                    {participantCount > 0 && (
                      <div>
                        <div className="k">Participants</div>
                        <div className="v">{participantCount} residents</div>
                        {participantSegments.length > 0 && <div className="s">{participantSegments.length} segments</div>}
                      </div>
                    )}
                    {timelineDuration && (
                      <div>
                        <div className="k">Timeline</div>
                        <div className="v">{timelineDuration}</div>
                        {timelineDateRange && <div className="s">{timelineDateRange}</div>}
                      </div>
                    )}
                    {brief.cascade_fields.decision_deadline && (
                      <div>
                        <div className="k">Decision deadline</div>
                        <div className="v">{brief.cascade_fields.decision_deadline}</div>
                        {brief.cascade_fields.decision_deadline_context && <div className="s">{brief.cascade_fields.decision_deadline_context}</div>}
                      </div>
                    )}
                    {brief.cascade_fields.budget && (
                      <div>
                        <div className="k">Budget</div>
                        <div className="v">{brief.cascade_fields.budget}</div>
                        {brief.cascade_fields.budget_purpose && <div className="s">{brief.cascade_fields.budget_purpose}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Problem */}
              {barriers.length > 0 && (
                <section className="doc-sec" data-sec="problem">
                  <h2>Problem<span className="prov">GENERATED + CANONICAL</span></h2>
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
                </section>
              )}

              {/* Objectives */}
              {objectives.length > 0 && (
                <section className="doc-sec" data-sec="objectives">
                  <h2>What we'll learn<span className="prov canonical">CANONICAL · EDITABLE</span></h2>
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
                </section>
              )}

              {/* Research questions */}
              {questions.length > 0 && (
                <section className="doc-sec" data-sec="questions">
                  <h2>Research questions<span className="prov canonical">CANONICAL · EDITABLE</span></h2>
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
                </section>
              )}

              {/* Method */}
              {methodology && (
                <section className="doc-sec" data-sec="method">
                  <h2>Method<span className="prov">GENERATED · EDITABLE</span></h2>
                  <div className="blk ro">
                    <span className="lock">READ-ONLY · SYSTEM</span>
                    <p className="kv"><b>Approach</b> — {methodology}</p>
                  </div>
                </section>
              )}

              {/* Participants */}
              {participantSegments.length > 0 && (
                <section className="doc-sec" data-sec="participants">
                  <h2>Participants<span className="prov">GENERATED + CANONICAL</span></h2>
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
                          {participantSegments.map((s, i) => (
                            <tr key={i}>
                              <td>{s.segment}</td>
                              <td><b>{s.count}</b></td>
                              <td>{s.rationale}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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

              {/* Timeline */}
              {timelinePhases.length > 0 && (
                <section className="doc-sec" data-sec="timeline">
                  <h2>Timeline<span className="prov system">SYSTEM · READ-ONLY</span></h2>
                  <div className="blk ro">
                    <span className="lock">READ-ONLY · SYSTEM</span>
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
                    {brief.cascade_fields.decision_deadline && (
                      <p className="kv"><b>Hard deadline</b> — {brief.cascade_fields.decision_deadline}{brief.cascade_fields.decision_deadline_context && ` (${brief.cascade_fields.decision_deadline_context})`}</p>
                    )}
                  </div>
                </section>
              )}

              {/* Collapsible sections */}
              <details className="sys">
                <summary>Research provenance</summary>
                <div className="inner">
                  <p>This brief establishes the research scope for downstream templates.</p>
                  <table className="doc-table">
                    <thead><tr><th>Commitment</th><th>Count</th></tr></thead>
                    <tbody>
                      <tr><td>Research objectives</td><td>{objectives.length}</td></tr>
                      <tr><td>Research questions</td><td>{questions.length}</td></tr>
                      <tr><td>Target barriers</td><td>{barriers.length}</td></tr>
                      <tr><td>Methodology</td><td>{methodology || '—'}</td></tr>
                      <tr><td>Budget</td><td>{brief.cascade_fields.budget || '—'}</td></tr>
                    </tbody>
                  </table>
                  {discoverySources.length > 0 && (
                    <>
                      <p style={{ marginTop: '10px' }}><b>Discovery sources</b> — synthesized from {discoverySources.length} sources.</p>
                      <table className="doc-table">
                        <thead><tr><th>Prefix</th><th>Source</th><th>Type</th><th>Findings used</th></tr></thead>
                        <tbody>
                          {discoverySources.map((d, i) => (
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
                      <tr><td>Generated</td><td>{formatDate(brief.study.created_at)}</td></tr>
                      <tr><td>Model</td><td>claude-sonnet-4-6</td></tr>
                      <tr><td>Template</td><td>research_brief v7.1</td></tr>
                      <tr><td>Study</td><td>{brief.study.name}</td></tr>
                      {brief.brief_url && <tr><td>GitHub path</td><td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{brief.brief_url.split('/').slice(-1)[0]}</td></tr>}
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
                      {brief.brief_reviewer_display_name && <> by {brief.brief_reviewer_display_name}</>}
                      {brief.brief_approved_at && <> · {formatDate(brief.brief_approved_at)}</>}
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
                      {brief.brief_reviewer_display_name && <> by {brief.brief_reviewer_display_name}</>}.
                      {brief.brief_change_feedback && (
                        <div style={{ borderLeft: '3px solid #b50909', paddingLeft: '10px', fontStyle: 'italic', marginTop: '8px' }}>{brief.brief_change_feedback}</div>
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
