/**
 * PlanDocument — Full document-style Plan view matching YAML template section order.
 *
 * Sections: Masthead, Summary + Facts, Background, Objectives (inherited),
 * Research Questions (inherited), Method, Participants, Timeline, Deliverables,
 * Risks, Brief Commitments, Validity (collapsed), Provenance (collapsed),
 * Document Info (collapsed).
 *
 * Plan has NO approval gate. Inherited Brief commitments are read-only.
 */

import { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import type { JSONContent } from '@tiptap/react';
import { useStudyPlan } from '@/api/queries/useStudy';
import { useSavePlanContent } from '@/api/mutations/useSaveContent';
import { StatusBadge } from '@/components/ui/StatusBadge';
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
import {
  ArtifactTabs, DocumentSection, Masthead, FactsGrid,
  StructuredItemRow, DocumentTable, CollapsibleSection,
  SaveStateIndicator,
} from '@/components/study/document';
import docStyles from '@/components/study/document/document.module.css';
import styles from './PlanDocument.module.css';

interface Objective { id: string; objective: string }
interface Question { id: string; question: string; priority?: string | null }

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

export function PlanDocument() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const { data: plan, isLoading, error } = useStudyPlan(studyPublicId || '');
  const savePlan = useSavePlanContent(studyPublicId || '');
  const pipeline = useSavePipeline();
  const editorRef = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

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

  if (isLoading) return <Skeleton variant="card" count={3} />;
  if (error || !plan) return <ErrorState message="Could not load plan." />;

  if (!plan.plan_url) {
    return (
      <>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className={styles.sep}>&rsaquo;</span>
          <Link to={`/studies/${studyPublicId}`}>{plan.study.name}</Link>
          <span className={styles.sep}>&rsaquo;</span>
          <span>Plan</span>
        </nav>
        <ArtifactTabs active="plan" studyPublicId={studyPublicId || ''} />
        <EmptyState
          heading="No plan yet"
          description="Create a research plan after your brief is approved."
          action={
            <Link to={`/studies/${studyPublicId}/plan/new`}>
              <Button>Create plan</Button>
            </Link>
          }
        />
      </>
    );
  }

  // Structured arrays — prefer parsed, fall back to inherited_context
  const objectives: Objective[] = (plan as any).structured_fields?.research_objectives
    || safeParse<Objective>(plan.inherited_context.research_objectives);
  const questions: Question[] = (plan as any).structured_fields?.research_questions
    || safeParse<Question>(plan.inherited_context.research_questions);

  const prose = (plan as any).prose_sections || {};
  const meta = (plan as any).study_metadata || {};
  const methodology = plan.inherited_context.methodology_selection?.replace(/_/g, ' ') || null;

  // Parse structured JSON sections
  let risks: Array<{ risk: string; likelihood: string; mitigation: string }> = [];
  if (prose.plan_risks) {
    try { risks = JSON.parse(prose.plan_risks); } catch { /* ignore */ }
  }

  let commitments: Array<{ commitment: string; address: string }> = [];
  if (prose.plan_commitments) {
    try { commitments = JSON.parse(prose.plan_commitments); } catch { /* ignore */ }
  }

  // Timeline phases from cascade
  let timelinePhases: Array<{ phase: string; dates: string; duration?: string }> = [];
  if (plan.inherited_context.timeline_phases) {
    try { timelinePhases = JSON.parse(plan.inherited_context.timeline_phases); } catch { /* ignore */ }
  }

  // Deliverables from cascade
  let deliverables: Array<{ id?: string; deliverable_name: string; format?: string; addresses_objective?: string }> = [];
  if (plan.inherited_context.deliverables) {
    try { deliverables = JSON.parse(plan.inherited_context.deliverables); } catch { /* ignore */ }
  }

  // Derive research period from timeline phases if available
  let researchPeriod: { start: string; end: string; duration: string } | null = null;
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
    researchPeriod = {
      start: startDate,
      end: endDate,
      duration: totalWeeks > 0 ? `${totalWeeks} weeks` : '',
    };
  }

  // Session info from prose or cascade (if structured source exists)
  const sessionFormat = plan.inherited_context.session_format || null;
  const sessionDuration = plan.inherited_context.session_duration || null;

  // Quick facts — matches design: Method, Participants, Sessions, Timeline
  const facts = [
    methodology ? { label: 'Method', value: methodology } : null,
    plan.inherited_context.participant_approach ? { label: 'Participants', value: plan.inherited_context.participant_approach } : null,
    (sessionDuration || sessionFormat) ? {
      label: 'Sessions',
      value: sessionDuration || '',
      sub: sessionFormat || undefined,
    } : null,
    researchPeriod ? {
      label: 'Timeline',
      value: researchPeriod.duration || 'See timeline',
      sub: researchPeriod.start && researchPeriod.end ? `${researchPeriod.start} – ${researchPeriod.end}` : undefined,
    } : null,
  ].filter(Boolean) as { label: string; value: string; sub?: string }[];

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className={styles.sep}>&rsaquo;</span>
        <Link to={`/studies/${studyPublicId}`}>{plan.study.name}</Link>
        <span className={styles.sep}>&rsaquo;</span>
        <span>Plan</span>
      </nav>

      <div className={docStyles.pageHead}>
        <div className={docStyles.pageHeadLeft}>
          <h1 className={docStyles.pageTitle}>Research Plan</h1>
          <div className={docStyles.pageMeta}>
            <StatusBadge status="active" />
            {plan.plan_url && (
              <a href={plan.plan_url} target="_blank" rel="noopener noreferrer" className={docStyles.githubLink}>
                View on GitHub &nearr;
              </a>
            )}
            {plan.plan_created_at && (
              <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--color-text-muted)' }}>
                Created {new Date(plan.plan_created_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className={docStyles.pageActions}>
          <SaveStateIndicator
            state={isEditing ? (isDirty ? 'dirty' : 'saved') : pipeline.state === 'sync_failed' ? 'error' : 'saved'}
            label={pipeline.state === 'saving' ? 'Saving...' : pipeline.state === 'sync_failed' ? 'Saved — GitHub sync pending' : undefined}
          />
          {!isEditing ? (
            <Button variant="secondary" onClick={handleEdit}>Edit</Button>
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

      <ArtifactTabs active="plan" studyPublicId={studyPublicId || ''} />

      {/* Save failure banners */}
      {pipeline.state === 'save_failed' && (
        <Alert variant="error" title="Save failed">
          {pipeline.error || 'Could not save changes. Your edits are still in the editor.'}
        </Alert>
      )}
      {pipeline.state === 'sync_failed' && (
        <Alert variant="warning" title="Saved — GitHub sync pending">
          Your changes were saved to Qori. The GitHub projection can be retried.
        </Alert>
      )}

      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>

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
          {/* Masthead (system) */}
          <Masthead
            studyName={plan.study.name}
            researcherName={meta.researcher_name}
            date={meta.created_at || plan.study.created_at}
          />

          {/* Summary (generated) */}
          <DocumentSection sectionId="summary" title="Summary" provenance="generated" editable>
            {prose.plan_summary ? (
              <MarkdownDisplay markdown={prose.plan_summary} className={docStyles.blockProse} />
            ) : (
              <p className={docStyles.block}>Plan generated. See sections below.</p>
            )}
            {facts.length > 0 && <FactsGrid facts={facts} />}
          </DocumentSection>

          {/* Background (generated) */}
          {prose.plan_background && (
            <DocumentSection sectionId="background" title="Background" provenance="generated" editable>
              <MarkdownDisplay markdown={prose.plan_background} className={docStyles.blockProse} />
            </DocumentSection>
          )}

          {/* Objectives (inherited from Brief — read-only) */}
          {objectives.length > 0 && (
            <DocumentSection sectionId="objectives" title="Objectives" provenance="inherited" editable={false}>
              {objectives.map((o) => (
                <StructuredItemRow key={o.id} id={o.id} text={o.objective} />
              ))}
            </DocumentSection>
          )}

          {/* Research questions (inherited from Brief — read-only) */}
          {questions.length > 0 && (
            <DocumentSection sectionId="questions" title="Research questions" provenance="inherited" editable={false}>
              {questions.map((q) => (
                <StructuredItemRow key={q.id} id={q.id} text={q.question} priority={q.priority} />
              ))}
            </DocumentSection>
          )}

          {/* Method (generated) */}
          <DocumentSection sectionId="method" title="Method" provenance="generated" editable>
            {methodology && (
              <div className={docStyles.systemBlock}>
                <p><strong>Approach</strong> &mdash; {methodology}</p>
              </div>
            )}
            {prose.plan_method_approach && (
              <MarkdownDisplay markdown={prose.plan_method_approach} className={docStyles.blockProse} />
            )}
            {prose.plan_session_format && (
              <>
                <h3 className={docStyles.secSubheading}>Session format</h3>
                <MarkdownDisplay markdown={prose.plan_session_format} className={docStyles.blockProse} />
              </>
            )}
            {prose.plan_data_collection && (
              <>
                <h3 className={docStyles.secSubheading}>Data collection</h3>
                <MarkdownDisplay markdown={prose.plan_data_collection} className={docStyles.blockProse} />
              </>
            )}
          </DocumentSection>

          {/* Participants (generated) */}
          <DocumentSection sectionId="participants" title="Participants" provenance="generated" editable>
            {prose.plan_participants_prose ? (
              <MarkdownDisplay markdown={prose.plan_participants_prose} className={docStyles.blockProse} />
            ) : plan.inherited_context.participant_approach ? (
              <p className={docStyles.block}>{plan.inherited_context.participant_approach}</p>
            ) : null}
            {plan.inherited_context.compensation && (
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>Computed</span>
                <p><strong>Compensation</strong> &mdash; {plan.inherited_context.compensation}</p>
              </div>
            )}
          </DocumentSection>

          {/* Timeline (system — derived) */}
          {(timelinePhases.length > 0 || researchPeriod) && (
            <DocumentSection sectionId="timeline" title="Timeline" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>System</span>
                {/* Research period header — per approved design */}
                {researchPeriod && (
                  <div className={docStyles.researchPeriod}>
                    <span className={docStyles.periodLabel}>Research period</span>
                    <span className={docStyles.periodValue}>
                      {researchPeriod.start && researchPeriod.end
                        ? `${researchPeriod.start} – ${researchPeriod.end}`
                        : 'See phases below'}
                    </span>
                    {researchPeriod.duration && (
                      <span className={docStyles.periodDuration}>{researchPeriod.duration}</span>
                    )}
                  </div>
                )}
                {/* Phase table */}
                {timelinePhases.length > 0 && (
                  <DocumentTable
                    columns={[
                      { key: 'phase', label: 'Phase' },
                      { key: 'dates', label: 'Dates' },
                      { key: 'duration', label: 'Duration', align: 'right' },
                    ]}
                    rows={timelinePhases}
                  />
                )}
              </div>
            </DocumentSection>
          )}

          {/* Deliverables (generated) */}
          {(prose.plan_deliverables || deliverables.length > 0) && (
            <DocumentSection sectionId="deliverables" title="Deliverables" provenance="generated" editable>
              {prose.plan_deliverables ? (
                <MarkdownDisplay markdown={prose.plan_deliverables} className={docStyles.blockProse} />
              ) : deliverables.length > 0 ? (
                <DocumentTable
                  columns={[
                    { key: 'deliverable_name', label: 'Deliverable' },
                    { key: 'format', label: 'Format' },
                  ]}
                  rows={deliverables}
                />
              ) : null}
            </DocumentSection>
          )}

          {/* Risks (generated) */}
          {risks.length > 0 && (
            <DocumentSection sectionId="risks" title="Risks and mitigations" provenance="generated" editable>
              <DocumentTable
                columns={[
                  { key: 'risk', label: 'Risk' },
                  { key: 'likelihood', label: 'Likelihood', align: 'center' },
                  { key: 'mitigation', label: 'Mitigation' },
                ]}
                rows={risks}
              />
            </DocumentSection>
          )}

          {/* Brief commitments operationalized (generated) */}
          {commitments.length > 0 && (
            <DocumentSection sectionId="commitments" title="Brief commitments operationalized" provenance="generated" editable>
              <DocumentTable
                columns={[
                  { key: 'commitment', label: 'Brief commitment' },
                  { key: 'address', label: 'How this plan addresses it' },
                ]}
                rows={commitments}
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
                { commitment: 'Research objectives', count: objectives.length },
                { commitment: 'Research questions', count: questions.length },
                { commitment: 'Methodology', count: methodology || 'N/A' },
              ]}
            />
          </CollapsibleSection>

          {/* Document information (collapsed) */}
          <CollapsibleSection title="Document information">
            <DocumentTable
              columns={[{ key: 'field', label: '' }, { key: 'value', label: '' }]}
              rows={[
                { field: 'Study', value: plan.study.name },
                { field: 'Created', value: plan.plan_created_at ? new Date(plan.plan_created_at).toLocaleDateString() : '' },
              ]}
            />
            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
              Generated by Qori. The Workspace is the editing surface; GitHub holds the durable rendered projection.
            </p>
          </CollapsibleSection>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Build TipTap editor document from Plan API data.
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
 * Inherited objectives/questions are NOT included — they remain read-only.
 *
 * Section keys MUST match backend artifact_sections.section_key values:
 * - plan_summary, plan_background, plan_method_approach, plan_session_format,
 *   plan_data_collection, plan_participants_prose, plan_deliverables
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

  // Summary — editable generated prose (section_key: 'plan_summary')
  if (prose.plan_summary) {
    sections.push({
      sectionId: 'plan_summary',
      markdown: prose.plan_summary,
      provenance: 'generated',
      title: 'Summary',
    });
  }

  // Background — editable generated prose (section_key: 'plan_background')
  if (prose.plan_background) {
    sections.push({
      sectionId: 'plan_background',
      markdown: prose.plan_background,
      provenance: 'generated',
      title: 'Background',
    });
  }

  // Method — editable generated prose (section_key: 'plan_method_approach')
  // Includes approach, session format, and data collection as combined markdown
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

  // Participants — editable generated prose (section_key: 'plan_participants_prose')
  if (prose.plan_participants_prose) {
    sections.push({
      sectionId: 'plan_participants_prose',
      markdown: prose.plan_participants_prose,
      provenance: 'generated',
      title: 'Participants',
    });
  }

  // Deliverables — editable generated prose (section_key: 'plan_deliverables')
  if (prose.plan_deliverables) {
    sections.push({
      sectionId: 'plan_deliverables',
      markdown: prose.plan_deliverables,
      provenance: 'generated',
      title: 'Deliverables',
    });
  }

  // Build document using markdown bridge
  // Note: Objectives, questions are inherited — shown in view mode only
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
