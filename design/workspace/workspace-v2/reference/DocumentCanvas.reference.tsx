/**
 * DESIGN REFERENCE — NOT PRODUCTION
 * The document column composition for Brief and Plan using the production primitives
 * (frontend/src/components/study/document/*) with their v2 markup. Static sample content, no data layer.
 * Shows: ArtifactHeader (new) · Alert appearance="rule" · Masthead artifactLabel · FactsGrid (dl) ·
 * StructuredItemRows · DocumentTable (scroll + data-label + emphasis) · CollapsibleSection (summary) · ApprovalSection.
 * Canvases render a typed BriefViewModel / PlanViewModel directly: no derivation, no provenance literals.
 * Spec: COMPONENT_MAPPING.md §3.4–3.15 and §4, WORKSPACE_V2_SPEC.md §1.1 and §7.
 */
import type { ReactNode } from 'react';
import { Menu, ChevronRight, ClipboardCheck } from 'lucide-react';
import type { MastheadViewModel, QuickFact, FieldProvenance } from '@qori/artifact-contracts';
import { DocumentSectionReference, isInherited } from './DocumentSection.reference';
import { sampleBriefVm, samplePlanVm } from './sample-view-models';
import './workspace-v2.reference.css';

/* ── ArtifactHeader (new) ── */
export function ArtifactHeaderReference({ active, editing, dirty, saveState, showRailToggle, railOpen }: {
  active: 'brief' | 'plan'; editing: boolean; dirty?: boolean; saveState?: ReactNode; showRailToggle?: boolean; railOpen?: boolean;
}) {
  return (
    <header className="artifactHeader">
      <button type="button" className="iconButton navToggle" aria-label="Study navigation" aria-expanded={false} aria-controls="workspace-nav"><Menu size={20} aria-hidden="true" /></button>
      <nav className="crumb" aria-label="Breadcrumb"><ol><li><a href="/studies/st_123">Permit Application Status Experience</a></li></ol></nav>
      <nav className="artifactTabs" aria-label="Study artifacts">
        <ul>
          <li><a href="/studies/st_123/brief" className={`artifactTab${active === 'brief' ? ' artifactTabActive' : ''}`} aria-current={active === 'brief' ? 'page' : undefined}>Brief</a></li>
          <li><a href="/studies/st_123/plan" className={`artifactTab${active === 'plan' ? ' artifactTabActive' : ''}`} aria-current={active === 'plan' ? 'page' : undefined}>Research Plan</a></li>
        </ul>
      </nav>
      <span className="headerGrow" />
      {saveState}
      <a className="githubLink" href="https://github.com/…" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      <span className="headerRule" aria-hidden="true" />
      {showRailToggle && !editing && (
        <button type="button" className="iconButton" aria-label="Review panel" aria-pressed={!!railOpen} aria-controls="context-rail"><ClipboardCheck size={16} aria-hidden="true" /></button>
      )}
      {!editing
        ? <button type="button" className="button secondary sm">Edit</button>
        : (<><button type="button" className="button secondary sm">Cancel</button><button type="button" className="button primary sm" disabled={!dirty}>Save</button></>)}
    </header>
  );
}

/* ── SaveStateIndicator states (SPEC §8.5) ── */
export const SaveStates = {
  saved: <span className="saveState" aria-live="polite"><span className="saveDot saveDotSaved" />Saved · 9:41 AM</span>,
  dirty: <span className="saveState" aria-live="polite"><span className="saveDot saveDotDirty" />Unsaved changes</span>,
  saving: <span className="saveState" aria-live="polite"><span className="saveDot saveDotSaving" />Saving…</span>,
  syncPending: <span className="saveState" aria-live="polite"><span className="saveDot saveDotSyncPending" />Saved · GitHub sync pending</span>,
  error: <span className="saveState" aria-live="polite"><span className="saveDot saveDotError" />Save failed</span>,
};

/* ── Alert appearance="rule" ── */
export function NoticeReference({ tone, title, children, action }: { tone: 'success' | 'warning' | 'error'; title: string; children: ReactNode; action?: ReactNode }) {
  const cls = { success: 'noticeSuccess', warning: 'noticeWarning', error: 'noticeError' }[tone];
  return (
    <div className={`notice ${cls}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="noticeDot" aria-hidden="true" />
      <span><b>{title}</b> {children}</span>
      {action && <span className="noticeAction">{action}</span>}
    </div>
  );
}

/* ── Masthead (masthead: MastheadViewModel) ── */
export function MastheadReference({ masthead, artifactLabel, showStatus }: { masthead: MastheadViewModel; artifactLabel: string; showStatus?: boolean }) {
  const meta: [string, string | null | undefined][] = [
    ['Researcher', masthead.researcherName], ['Requested by', masthead.requestorName], ['Date', masthead.dateFormatted],
    ['Status', showStatus ? (masthead.versionDisplay ?? masthead.statusDisplay) : null],
  ];
  return (
    <header className="masthead">
      <h1 className="mastTitle"><span className="mastEyebrow">{artifactLabel}</span><span className="mastName">{masthead.studyName}</span></h1>
      <span className="systemLabel">READ-ONLY · SYSTEM</span>
      <dl className="mastMeta">
        {meta.filter(([, v]) => !!v).map(([k, v]) => (<div key={k} className="mastheadItem"><dt className="mastheadKey">{k}</dt><dd className="mastheadValue">{v}</dd></div>))}
      </dl>
    </header>
  );
}

/* ── FactsGrid (facts: QuickFact[]; drops exists:false) ── */
export function FactsGridReference({ facts }: { facts: QuickFact[] }) {
  const shown = facts.filter((f) => f.exists);
  if (shown.length === 0) return null;
  return (
    <div className="systemBlock">
      <span className="systemLabel">READ-ONLY · SYSTEM</span>
      <dl className="factsGrid">
        {shown.map((f) => (<div key={f.label} className="factItem"><dt className="factKey">{f.label}</dt><dd className="factValue">{f.value}</dd>{f.sub && <dd className="factSub">{f.sub}</dd>}</div>))}
      </dl>
    </div>
  );
}

/* ── StructuredItemRows ── */
export function RowsReference({ items }: { items: { id: string; text: string; source?: string; priority?: 'Primary' | 'Secondary' | 'Exploratory' }[] }) {
  return (
    <div className="itemRows">
      {items.map((it) => (
        <div key={it.id} className="itemRow">
          <span className="idTag" title={`${it.id} — stable canonical ID`} data-stable-id={it.id}>{it.id}</span>
          <span className="itemText">{it.text}{it.source && <em className="itemSource"> — {it.source}</em>}</span>
          {it.priority && <span className={`priorityBadge ${it.priority === 'Primary' ? 'priorityPrimary' : it.priority === 'Secondary' ? 'prioritySecondary' : 'priorityExploratory'}`}>{it.priority}</span>}
        </div>
      ))}
    </div>
  );
}

/* ── DocumentTable ── */
export function TableReference({ columns, rows }: { columns: { key: string; label: string; align?: 'center'; emphasis?: boolean }[]; rows: Record<string, string>[] }) {
  return (
    <div className="tableScroll">
      <table className="docTable stackedTable">
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col" style={{ textAlign: c.align ?? 'left' }}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>{columns.map((c) => <td key={c.key} data-label={c.label} className={[c.align === 'center' && 'cellCenter', c.emphasis && 'cellEmphasis'].filter(Boolean).join(' ') || undefined}>{r[c.key]}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* ── CollapsibleSection ── */
export function CollapsibleReference({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <details className="collapsible">
      <summary><span className="collapsibleChevron" aria-hidden="true"><ChevronRight size={12} /></span><span className="collapsibleTitle">{title}</span>{summary && <span className="collapsibleSummary">{summary}</span>}</summary>
      <div className="collapsibleInner">{children}</div>
    </details>
  );
}

/* helper: only include provenance for data that renders (COMPONENT_MAPPING §4.3) */
const prov = (...pairs: [boolean, FieldProvenance][]) => pairs.filter(([on]) => on).map(([, p]) => p);
const briefLink = <>From the <a href="/studies/st_123/brief">approved brief</a></>;

/* ═══ Brief canvas: pending approval (SPEC §7 order, bindings per COMPONENT_MAPPING §4) ═══ */
export function BriefCanvasReference({ vm = sampleBriefVm }: { vm?: typeof sampleBriefVm }) {
  const qf = vm.quickFacts; const sec = vm.sections;
  return (
    <div className="docWrap"><div className="docCol">
      {vm.approval.isPendingApproval && (
        <NoticeReference tone="warning" title="Pending approval">
          {vm.approval.reviewerDisplayName && <>Sent to <b>{vm.approval.reviewerDisplayName}</b> for approval. </>}Use the Review panel to approve or request changes.
        </NoticeReference>
      )}
      <MastheadReference masthead={vm.masthead} artifactLabel="Research Brief" />

      <DocumentSectionReference sectionId="summary" title="Summary" provenance={prov([sec.summary.exists, sec.summary.provenance])}>
        {sec.summary.exists && <div className="blockProse"><p>{sec.summary.content}</p></div>}
        <FactsGridReference facts={[qf.method, qf.participants, qf.timeline, qf.decisionDeadline, qf.budget]} />
      </DocumentSectionReference>

      {(sec.problemNarrative.exists || vm.barriers.exists) && (
        <DocumentSectionReference sectionId="problem" title="Problem"
          provenance={prov([sec.problemNarrative.exists, sec.problemNarrative.provenance], [vm.barriers.exists, vm.barriers.provenance])}>
          {sec.problemNarrative.exists && <div className="blockProse"><p>{sec.problemNarrative.content}</p></div>}
          {vm.barriers.exists && (<><h3 className="secSubheading">Target barriers for validation</h3>
            <RowsReference items={vm.barriers.items.map((x) => ({ id: x.id, text: x.barrier, source: x.source ?? undefined }))} /></>)}
        </DocumentSectionReference>
      )}

      {(vm.objectives.exists || vm.questions.exists) && (
        <DocumentSectionReference sectionId="objectives" title="What we'll learn"
          provenance={prov([vm.objectives.exists, vm.objectives.provenance], [vm.questions.exists, vm.questions.provenance])}>
          <RowsReference items={vm.objectives.items.map((o) => ({ id: o.id, text: o.objective }))} />
          {vm.questions.exists && (<><h3 className="secSubheading">Research questions</h3>
            <RowsReference items={vm.questions.items.map((q) => ({ id: q.id, text: q.question, priority: (q.priority ?? undefined) as 'Primary' | 'Secondary' | 'Exploratory' | undefined }))} /></>)}
        </DocumentSectionReference>
      )}

      {(qf.method.exists || sec.methodProse.exists) && (
        <DocumentSectionReference sectionId="method" title="Method" provenance={prov([sec.methodProse.exists, sec.methodProse.provenance])}>
          {qf.method.exists && <p className="kvParagraph"><b>Approach</b> — {qf.method.value}</p>}
          {sec.methodProse.exists && <div className="blockProse"><p>{sec.methodProse.content}</p></div>}
        </DocumentSectionReference>
      )}

      {(vm.participantSegments.exists || sec.participantsProse.exists) && (
        <DocumentSectionReference sectionId="participants" title="Participants"
          provenance={prov([vm.participantSegments.exists, vm.participantSegments.provenance], [sec.participantsProse.exists, sec.participantsProse.provenance])}>
          <TableReference
            columns={[{ key: 'segment', label: 'Segment' }, { key: 'count', label: 'Count', align: 'center', emphasis: true }, { key: 'rationale', label: 'Rationale' }]}
            rows={vm.participantSegments.items.map((x) => ({ segment: x.segment, count: String(x.count), rationale: x.rationale }))} />
          {vm.recruitmentSources && <p className="kvParagraph"><b>Recruitment</b> — {vm.recruitmentSources}</p>}
        </DocumentSectionReference>
      )}

      {sec.outOfScope.exists && (
        <DocumentSectionReference sectionId="out-of-scope" title="Out of scope" provenance={[sec.outOfScope.provenance]}>
          <div className="blockProse"><p>{sec.outOfScope.content}</p></div>
        </DocumentSectionReference>
      )}

      {vm.risks.exists && (
        <DocumentSectionReference sectionId="risks" title="Risks" provenance={[vm.risks.provenance]}>
          <TableReference columns={[{ key: 'risk', label: 'Risk' }, { key: 'source', label: 'Source' }, { key: 'mitigation', label: 'Mitigation' }]} rows={vm.risks.items as unknown as Record<string, string>[]} />
        </DocumentSectionReference>
      )}

      {(vm.timeline.exists || vm.timeline.summary.startDate || qf.decisionDeadline.exists) && (
        <DocumentSectionReference sectionId="timeline" title="Timeline" provenance={[vm.timeline.provenance]}>
          <TableReference columns={[{ key: 'phase', label: 'Phase' }, { key: 'dates', label: 'Dates' }]} rows={vm.timeline.phases as unknown as Record<string, string>[]} />
          {qf.decisionDeadline.exists && <p className="kvParagraph"><b>Hard deadline</b> — {qf.decisionDeadline.value}{qf.decisionDeadline.sub && ` (${qf.decisionDeadline.sub})`}</p>}
        </DocumentSectionReference>
      )}

      {/* ApprovalSection: component unchanged (no vm provenance); copy unchanged (PF-08) */}
      <section className="docSec" data-sec="approval" aria-labelledby="sec-approval-h">
        <div className="secHead"><h2 className="secHeading" id="sec-approval-h">Approval</h2></div>
        <ul className="approvalChecklist">
          {['Stakeholder approves scope and method', 'Stakeholder approves timeline and deadline', 'Budget confirmed', 'Recruitment criteria validated with stakeholder'].map((t) => (
            <li key={t} className="approvalChecklistItem"><span className="approvalGlyph" aria-hidden="true">○</span><span className="srOnly">Not complete: </span><span>{t}</span></li>
          ))}
        </ul>
      </section>

      <CollapsibleReference title="Validity checklist" summary="6 checks"><p>…production rows unchanged…</p></CollapsibleReference>
      <CollapsibleReference title="Research provenance" summary={`${vm.objectives.count} objective · ${vm.questions.count} questions`}><p>This brief establishes the research scope for downstream templates.</p></CollapsibleReference>
      <CollapsibleReference title="Document information">
        {/* DDR-16: omit empty rows, no invented model/template */}
        <TableReference columns={[{ key: 'field', label: '' }, { key: 'value', label: '' }]}
          rows={[
            { field: 'Model', value: vm.artifact.model ?? '' },
            { field: 'Template', value: vm.artifact.templateId && vm.artifact.templateVersion ? `${vm.artifact.templateId} ${vm.artifact.templateVersion}` : '' },
            { field: 'Study', value: vm.study.name },
          ].filter((r) => r.value)} />
      </CollapsibleReference>
    </div></div>
  );
}

/* ═══ Plan canvas: inherited sections, research period, footnote ═══ */
export function PlanCanvasReference({ vm = samplePlanVm }: { vm?: typeof samplePlanVm }) {
  const qf = vm.quickFacts; const sec = vm.sections;
  const methodProv = prov([sec.methodApproach.exists, sec.methodApproach.provenance], [sec.sessionFormat.exists, sec.sessionFormat.provenance], [sec.dataCollection.exists, sec.dataCollection.provenance]);
  return (
    <div className="docWrap"><div className="docCol">
      <MastheadReference masthead={vm.masthead} artifactLabel="Research Plan" showStatus />
      <DocumentSectionReference sectionId="summary" title="Summary" provenance={[sec.summary.provenance]}>
        {sec.summary.exists ? <div className="blockProse"><p>{sec.summary.content}</p></div> : <p className="block">Plan generated. See sections below.</p>}
        <FactsGridReference facts={[qf.method, qf.participants, qf.sessions, qf.timeline]} />
      </DocumentSectionReference>
      {vm.objectives.exists && (
        <DocumentSectionReference sectionId="objectives" title="Objectives" provenance={[vm.objectives.provenance]}
          sourceNote={isInherited([vm.objectives.provenance]) ? briefLink : undefined}>
          <RowsReference items={vm.objectives.items.map((o) => ({ id: o.id, text: o.objective }))} />
        </DocumentSectionReference>
      )}
      {vm.questions.exists && (
        <DocumentSectionReference sectionId="questions" title="Research questions" provenance={[vm.questions.provenance]}
          sourceNote={isInherited([vm.questions.provenance]) ? briefLink : undefined}>
          <RowsReference items={vm.questions.items.map((q) => ({ id: q.id, text: q.question, priority: (q.priority ?? undefined) as 'Primary' | 'Secondary' | 'Exploratory' | undefined }))} />
        </DocumentSectionReference>
      )}
      <DocumentSectionReference sectionId="method" title="Method" provenance={methodProv}>
        {qf.method.exists && <p className="kvParagraph"><b>Approach</b> — {qf.method.value}</p>}
        {sec.methodApproach.exists && <div className="blockProse"><p>{sec.methodApproach.content}</p></div>}
        {sec.sessionFormat.exists && <p className="kvParagraph"><b>Session format</b> — {sec.sessionFormat.content}</p>}
      </DocumentSectionReference>
      {vm.timeline.exists && (
        <DocumentSectionReference sectionId="timeline" title="Timeline" provenance={[vm.timeline.provenance]}
          sourceNote={isInherited([vm.timeline.provenance]) ? briefLink : undefined}>
          {vm.timeline.summary.dateRange && (
            <div className="researchPeriod"><span className="periodLabel">Research period</span><span className="periodValue">{vm.timeline.summary.dateRange}</span>
              {vm.timeline.summary.duration && <span className="periodDuration">{vm.timeline.summary.duration}</span>}</div>
          )}
          <TableReference columns={[{ key: 'phase', label: 'Phase' }, { key: 'dates', label: 'Dates' }, { key: 'duration', label: 'Duration', align: 'center' }]} rows={vm.timeline.phases as unknown as Record<string, string>[]} />
          <p className="docFootnote">{/* DDR-12 copy */}Timeline begins once fieldwork starts.</p>
        </DocumentSectionReference>
      )}
      {vm.risks.exists && (
        <DocumentSectionReference sectionId="risks" title="Risks and mitigations" provenance={[vm.risks.provenance]}>
          <TableReference columns={[{ key: 'risk', label: 'Risk' }, { key: 'likelihood', label: 'Likelihood', align: 'center' }, { key: 'mitigation', label: 'Mitigation' }]} rows={vm.risks.items as unknown as Record<string, string>[]} />
        </DocumentSectionReference>
      )}
      {vm.commitments.exists && (
        <DocumentSectionReference sectionId="commitments" title="Brief commitments operationalized" provenance={[vm.commitments.provenance]}>
          <TableReference columns={[{ key: 'commitment', label: 'Brief commitment' }, { key: 'address', label: 'How this plan addresses it' }]} rows={vm.commitments.items as unknown as Record<string, string>[]} />
        </DocumentSectionReference>
      )}
    </div></div>
  );
}
