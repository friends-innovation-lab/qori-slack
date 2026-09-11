/**
 * BriefDocument — Full document-style Brief view matching YAML template section order.
 *
 * Sections: Masthead, Summary + Facts, Problem + Barriers, Objectives + Questions,
 * Method, Participants, Out of Scope, Risks, Timeline, Approval, Validity (collapsed),
 * Provenance (collapsed), Document Info (collapsed).
 *
 * Brief is the only approval-gated artifact. Review rail on the right.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useStudyBrief } from '@/api/queries/useStudy';
import { useApproveBrief, useRequestChanges } from '@/api/mutations/useApproveBrief';
import { useAuth } from '@/auth/AuthProvider';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Textarea } from '@/components/ui/Textarea';
import {
  ArtifactTabs, DocumentSection, Masthead, FactsGrid,
  StructuredItemRow, DocumentTable, CollapsibleSection,
  SaveStateIndicator,
} from '@/components/study/document';
import docStyles from '@/components/study/document/document.module.css';
import styles from './BriefDocument.module.css';

interface Objective { id: string; objective: string }
interface Question { id: string; question: string; priority?: string | null }
interface Barrier { id: string; barrier: string; source?: string | null }

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

export function BriefDocument() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  useAuth();
  const { data: brief, isLoading, error } = useStudyBrief(studyPublicId || '');
  const approveBrief = useApproveBrief(studyPublicId || '');
  const requestChanges = useRequestChanges(studyPublicId || '');

  const [showChangesForm, setShowChangesForm] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState('');
  const [changesSubmitted, setChangesSubmitted] = useState(false);
  const [checklist, setChecklist] = useState({
    scope: false, timeline: false, participants: false, budget: false,
  });

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

  // Prose sections from artifact_sections (if available)
  const prose = (brief as any).prose_sections || {};
  const meta = (brief as any).study_metadata || {};

  // Quick facts
  const methodology = brief.cascade_fields.methodology_selection?.replace(/_/g, ' ') || null;
  const facts = [
    methodology ? { label: 'Method', value: methodology } : null,
    brief.cascade_fields.participant_approach ? { label: 'Participants', value: brief.cascade_fields.participant_approach } : null,
    brief.cascade_fields.start_date ? { label: 'Start date', value: brief.cascade_fields.start_date } : null,
    brief.cascade_fields.budget ? { label: 'Budget', value: brief.cascade_fields.budget } : null,
  ].filter(Boolean) as { label: string; value: string }[];

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
          <SaveStateIndicator state="saved" />
          {!isChangesRequested && (
            <Link to={`/studies/${studyPublicId}/brief/new`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          )}
          {isChangesRequested && (
            <Link to={`/studies/${studyPublicId}/brief/new`}>
              <Button>Revise</Button>
            </Link>
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

      {/* Document body */}
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>

          {/* Masthead (system) */}
          <Masthead
            studyName={brief.study.name}
            researcherName={meta.researcher_name}
            date={meta.created_at || brief.study.created_at}
          />

          {/* Summary (generated) */}
          <DocumentSection sectionId="summary" title="Summary" provenance="generated" editable>
            {prose.summary ? (
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.summary }} />
            ) : brief.cascade_fields.research_objectives ? (
              <p className={docStyles.block}>Brief generated. See sections below for details.</p>
            ) : null}
            {facts.length > 0 && <FactsGrid facts={facts} />}
          </DocumentSection>

          {/* Problem + Barriers (generated + canonical) */}
          <DocumentSection sectionId="problem" title="Problem" provenance="generated" editable>
            {prose.problem_narrative && (
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.problem_narrative }} />
            )}
            {barriers.length > 0 && (
              <>
                <h3 className={docStyles.secSubheading}>Target barriers for validation</h3>
                {barriers.map((b) => (
                  <StructuredItemRow key={b.id} id={b.id} text={b.barrier} source={b.source} />
                ))}
              </>
            )}
          </DocumentSection>

          {/* Objectives + Questions (canonical) */}
          <DocumentSection sectionId="objectives" title="What we'll learn" provenance="canonical" editable>
            {objectives.map((o) => (
              <StructuredItemRow key={o.id} id={o.id} text={o.objective} />
            ))}
            {questions.length > 0 && (
              <>
                <h3 className={docStyles.secSubheading}>Research questions</h3>
                {questions.map((q) => (
                  <StructuredItemRow key={q.id} id={q.id} text={q.question} priority={q.priority} />
                ))}
              </>
            )}
          </DocumentSection>

          {/* Method (generated) */}
          <DocumentSection sectionId="method" title="Method" provenance="generated" editable>
            {methodology && (
              <div className={docStyles.systemBlock}>
                <p><strong>Approach</strong> &mdash; {methodology}</p>
              </div>
            )}
            {prose.method_prose && (
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.method_prose }} />
            )}
          </DocumentSection>

          {/* Participants (generated + canonical) */}
          <DocumentSection sectionId="participants" title="Participants" provenance="generated" editable>
            {prose.participants_prose && (
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.participants_prose }} />
            )}
            {!prose.participants_prose && brief.cascade_fields.participant_approach && (
              <p className={docStyles.block}>{brief.cascade_fields.participant_approach}</p>
            )}
          </DocumentSection>

          {/* Out of scope (generated) */}
          {(prose.out_of_scope || brief.cascade_fields.research_objectives) && (
            <DocumentSection sectionId="scope" title="Out of scope" provenance="generated" editable>
              {prose.out_of_scope ? (
                <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.out_of_scope }} />
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
          {brief.cascade_fields.start_date && (
            <DocumentSection sectionId="timeline" title="Timeline" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>System</span>
                <p><strong>Start date:</strong> {brief.cascade_fields.start_date}</p>
              </div>
            </DocumentSection>
          )}

          {/* Approval (system) */}
          {prose.approval_items && (
            <DocumentSection sectionId="approval" title="Approval" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>System</span>
                <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.approval_items }} />
              </div>
            </DocumentSection>
          )}

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
            <p>This brief establishes the research scope for downstream templates.</p>
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
          </CollapsibleSection>

          {/* Document information (collapsed) */}
          <CollapsibleSection title="Document information">
            <DocumentTable
              columns={[{ key: 'field', label: '' }, { key: 'value', label: '' }]}
              rows={[
                { field: 'Study', value: brief.study.name },
                { field: 'Status', value: brief.brief_status || 'draft' },
                { field: 'Created', value: brief.study.created_at ? new Date(brief.study.created_at).toLocaleDateString() : '' },
              ]}
            />
            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
              Generated by Qori. The Workspace is the editing surface; GitHub holds the durable rendered projection.
            </p>
          </CollapsibleSection>
        </div>

        {/* Review rail (Brief only) — right side */}
        {(isPendingApproval || isApproved) && (
          <aside className={styles.reviewRail} aria-label="Review">
            {isPendingApproval && (
              <div className={styles.railCard}>
                <div className={styles.railCardHeader}>Review &middot; approval gate</div>
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
            {isApproved && (
              <div className={styles.railCard}>
                <div className={styles.railCardHeader}>Review &middot; approval gate</div>
                <div className={styles.railCardBody}>
                  <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                    Approved
                    {brief.brief_approved_at && ` &middot; ${new Date(brief.brief_approved_at).toLocaleDateString()}`}
                  </p>
                  <p style={{ fontSize: 'var(--text-secondary-size)', color: 'var(--color-text-muted)' }}>
                    The brief is the citation source for downstream artifacts.
                  </p>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
