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

import { useState, useRef, useCallback, useMemo } from 'react';
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
  StructuredItemRow, StructuredItemRows, DocumentTable, CollapsibleSection,
  SaveStateIndicator,
} from '@/components/study/document';
import {
  projectPlanToWorkspace,
  type PlanProjectionInput,
} from '@qori/artifact-contracts';
import docStyles from '@/components/study/document/document.module.css';
import styles from './PlanDocument.module.css';

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

  // Project raw API response to view model (centralized derivation)
  const vm = useMemo(() => {
    const input: PlanProjectionInput = {
      study: {
        public_id: studyPublicId || '',
        name: plan.study?.name || '',
        created_at: plan.study?.created_at,
      },
      plan_url: plan.plan_url,
      plan_created_at: plan.plan_created_at,
      prose_sections: (plan as any).prose_sections,
      inherited_context: plan.inherited_context || {},
      structured_fields: (plan as any).structured_fields,
      study_metadata: (plan as any).study_metadata,
      artifact_metadata: (plan as any).artifact_metadata,
      artifact_version: (plan as any).artifact_version,
    };
    return projectPlanToWorkspace(input);
  }, [plan, studyPublicId]);

  // Structured data from view model (already parsed/validated)
  const objectives = vm.objectives.items;
  const questions = vm.questions.items;
  const risks = vm.risks.items;
  const commitments = vm.commitments.items;
  const timelinePhases = vm.timeline.phases;
  const deliverables = vm.deliverablesTable?.items || [];

  // Prose sections from view model (for editor input, keep raw access)
  const prose = (plan as any).prose_sections || {};
  const methodology = vm.quickFacts.method.exists ? vm.quickFacts.method.value : null;

  // Quick facts from view model (already derived)
  const facts = [
    vm.quickFacts.method.exists ? { label: 'Method', value: vm.quickFacts.method.value } : null,
    vm.quickFacts.participants.exists ? { label: 'Participants', value: vm.quickFacts.participants.value } : null,
    vm.quickFacts.sessions.exists ? {
      label: 'Sessions',
      value: vm.quickFacts.sessions.value,
      sub: vm.quickFacts.sessions.sub || undefined,
    } : null,
    vm.quickFacts.timeline.exists ? {
      label: 'Timeline',
      value: vm.quickFacts.timeline.value,
      sub: vm.quickFacts.timeline.sub || undefined,
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
            studyName={vm.masthead.studyName}
            researcherName={vm.masthead.researcherName ?? null}
            date={vm.masthead.date ?? null}
            status={vm.masthead.versionDisplay}
          />

          {/* Summary (generated) */}
          <DocumentSection sectionId="summary" title="Summary" provenance="generated" editable>
            {vm.sections.summary.exists ? (
              <MarkdownDisplay markdown={vm.sections.summary.content || ''} className={docStyles.blockProse} />
            ) : (
              <p className={docStyles.block}>Plan generated. See sections below.</p>
            )}
            {/* Quick facts in separate system block per design reference */}
            {/* FactsGrid renders its own systemBlock with READ-ONLY · SYSTEM label */}
            {facts.length > 0 && <FactsGrid facts={facts} />}
          </DocumentSection>

          {/* Background (generated) */}
          {vm.sections.background.exists && (
            <DocumentSection sectionId="background" title="Background" provenance="generated" editable>
              <MarkdownDisplay markdown={vm.sections.background.content || ''} className={docStyles.blockProse} />
            </DocumentSection>
          )}

          {/* Objectives (inherited from Brief — read-only) */}
          {objectives.length > 0 && (
            <DocumentSection sectionId="objectives" title="Objectives" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>READ-ONLY · SYSTEM</span>
                <p style={{ fontSize: 'var(--text-secondary-size)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                  What we aim to learn — inherited from the approved brief:
                </p>
                <StructuredItemRows>
                  {objectives.map((o) => (
                    <StructuredItemRow key={o.id} id={o.id} text={o.objective} />
                  ))}
                </StructuredItemRows>
              </div>
            </DocumentSection>
          )}

          {/* Research questions (inherited from Brief — read-only) */}
          {questions.length > 0 && (
            <DocumentSection sectionId="questions" title="Research questions" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>READ-ONLY · SYSTEM</span>
                <StructuredItemRows>
                  {questions.map((q) => (
                    <StructuredItemRow key={q.id} id={q.id} text={q.question} priority={q.priority} />
                  ))}
                </StructuredItemRows>
              </div>
            </DocumentSection>
          )}

          {/* Method (generated) — kv pattern per design reference */}
          <DocumentSection sectionId="method" title="Method" provenance="generated" editable>
            {methodology && (
              <p className={docStyles.kvParagraph}>
                <b>Approach</b> &mdash; {methodology}
              </p>
            )}
            {vm.sections.methodApproach.exists && (
              <MarkdownDisplay markdown={vm.sections.methodApproach.content || ''} className={docStyles.blockProse} />
            )}
            {vm.sections.sessionFormat.exists && (
              <p className={docStyles.kvParagraph}>
                <b>Session format</b> &mdash; {vm.sections.sessionFormat.content}
              </p>
            )}
            {vm.sections.dataCollection.exists && (
              <p className={docStyles.kvParagraph}>
                <b>Data collection</b> &mdash; {vm.sections.dataCollection.content}
              </p>
            )}
          </DocumentSection>

          {/* Participants (generated + canonical) */}
          <DocumentSection sectionId="participants" title="Participants" provenance="generated" editable>
            {vm.sections.participantsProse.exists ? (
              <MarkdownDisplay markdown={vm.sections.participantsProse.content || ''} className={docStyles.blockProse} />
            ) : vm.participantApproach ? (
              <p className={docStyles.block}>{vm.participantApproach}</p>
            ) : null}
            {/* NOTE: Recruitment source not yet available - no separate recruitment data in cascade */}
            {/* Compensation — read-only system block with kv pattern */}
            {vm.compensation && (
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>READ-ONLY · SYSTEM</span>
                <p className={docStyles.kvParagraph}>
                  <b>Compensation</b> &mdash; {vm.compensation}
                </p>
              </div>
            )}
          </DocumentSection>

          {/* Timeline (system — derived, read-only) */}
          {vm.timeline.exists && (
            <DocumentSection sectionId="timeline" title="Timeline" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>READ-ONLY · SYSTEM</span>
                {/* Research period header — outside table per design reference */}
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
                {/* Phase table — Duration center-aligned per design */}
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
                {/* Footer note per design reference */}
                <p style={{
                  fontSize: 'var(--text-secondary-size)',
                  color: 'var(--color-text-muted)',
                  borderLeft: '3px solid var(--color-border-secondary)',
                  paddingLeft: 'var(--space-3)',
                  marginTop: 'var(--space-3)',
                  marginBottom: 0,
                }}>
                  Timeline begins after stakeholder approval of this plan.
                </p>
              </div>
            </DocumentSection>
          )}

          {/* Deliverables (generated) */}
          {(vm.sections.deliverables.exists || vm.deliverablesTable?.exists) && (
            <DocumentSection sectionId="deliverables" title="Deliverables" provenance="generated" editable>
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

          {/* Risks (generated) */}
          {risks.length > 0 && (
            <DocumentSection sectionId="risks" title="Risks and mitigations" provenance="generated" editable>
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

          {/* Brief commitments operationalized (system — read-only) */}
          {commitments.length > 0 && (
            <DocumentSection sectionId="commitments" title="Brief commitments operationalized" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>READ-ONLY · SYSTEM</span>
                <DocumentTable
                  columns={[
                    { key: 'commitment', label: 'Brief commitment' },
                    { key: 'address', label: 'How this plan addresses it' },
                  ]}
                  rows={commitments as any}
                />
              </div>
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
            {/* Source table: only rendered when explicit source data is available */}
            {/* NOTE: No explicit source/artifact references currently stored in Plan cascade */}
            {/* This gap should be addressed when provenance tracking is implemented */}
            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
              Citation markers throughout: [RQ-XXX] = research question this element addresses · [TB-XXX] = target barrier this task tests · [OBJ-XXX] = objective this deliverable serves.
            </p>
          </CollapsibleSection>

          {/* Document information (collapsed) — using view model's artifact metadata */}
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
              ].filter(row => row.value)} // Filter out empty rows
            />
            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
              Generated by Qori. The Workspace is the editing surface; GitHub holds the durable rendered projection of the same canonical state.
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
