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

import { useParams, Link } from 'react-router';
import { useStudyPlan } from '@/api/queries/useStudy';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
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

  // Quick facts
  const facts = [
    methodology ? { label: 'Method', value: methodology } : null,
    plan.inherited_context.participant_approach ? { label: 'Participants', value: plan.inherited_context.participant_approach } : null,
    plan.inherited_context.timeline_phases ? { label: 'Timeline', value: 'See timeline section' } : null,
  ].filter(Boolean) as { label: string; value: string }[];

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
          <SaveStateIndicator state="saved" />
        </div>
      </div>

      <ArtifactTabs active="plan" studyPublicId={studyPublicId || ''} />

      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>

          {/* Masthead (system) */}
          <Masthead
            studyName={plan.study.name}
            researcherName={meta.researcher_name}
            date={meta.created_at || plan.study.created_at}
          />

          {/* Summary (generated) */}
          <DocumentSection sectionId="summary" title="Summary" provenance="generated" editable>
            {prose.plan_summary ? (
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.plan_summary }} />
            ) : (
              <p className={docStyles.block}>Plan generated. See sections below.</p>
            )}
            {facts.length > 0 && <FactsGrid facts={facts} />}
          </DocumentSection>

          {/* Background (generated) */}
          {prose.plan_background && (
            <DocumentSection sectionId="background" title="Background" provenance="generated" editable>
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.plan_background }} />
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
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.plan_method_approach }} />
            )}
            {prose.plan_session_format && (
              <>
                <h3 className={docStyles.secSubheading}>Session format</h3>
                <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.plan_session_format }} />
              </>
            )}
            {prose.plan_data_collection && (
              <>
                <h3 className={docStyles.secSubheading}>Data collection</h3>
                <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.plan_data_collection }} />
              </>
            )}
          </DocumentSection>

          {/* Participants (generated) */}
          <DocumentSection sectionId="participants" title="Participants" provenance="generated" editable>
            {prose.plan_participants_prose ? (
              <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.plan_participants_prose }} />
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
          {timelinePhases.length > 0 && (
            <DocumentSection sectionId="timeline" title="Timeline" provenance="system" editable={false}>
              <div className={docStyles.systemBlock}>
                <span className={docStyles.systemLabel}>System</span>
                <DocumentTable
                  columns={[
                    { key: 'phase', label: 'Phase' },
                    { key: 'dates', label: 'Dates' },
                    { key: 'duration', label: 'Duration', align: 'right' },
                  ]}
                  rows={timelinePhases}
                />
              </div>
            </DocumentSection>
          )}

          {/* Deliverables (generated) */}
          {(prose.plan_deliverables || deliverables.length > 0) && (
            <DocumentSection sectionId="deliverables" title="Deliverables" provenance="generated" editable>
              {prose.plan_deliverables ? (
                <div className={docStyles.blockProse} dangerouslySetInnerHTML={{ __html: prose.plan_deliverables }} />
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
        </div>
      </div>
    </div>
  );
}
