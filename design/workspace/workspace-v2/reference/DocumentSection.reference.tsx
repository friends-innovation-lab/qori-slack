/**
 * DESIGN REFERENCE — NOT PRODUCTION
 * Target markup for DocumentSection + ProvenanceTag (frontend/src/components/study/document/).
 * Provenance comes from the view model (FieldProvenance). React never authors label text or editability.
 * Spec: COMPONENT_MAPPING.md §3.9–3.10, §4.3 · WORKSPACE_V2_SPEC.md §1.1, §9.
 */
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { FieldProvenance } from '@qori/artifact-contracts';
import { sampleBriefVm as b, samplePlanVm as p } from './sample-view-models';
import './workspace-v2.reference.css';

const asList = (x?: FieldProvenance | FieldProvenance[]) => (x ? (Array.isArray(x) ? x : [x]) : []);

/** Allowed presentation-only transform (SPEC §9.2): dedupe + join labels. */
export function provenanceText(list: FieldProvenance[]) {
  return [...new Set(list.map((p) => p.label))].join(' + ');
}

export function ProvenanceTagReference({ provenance, forceVisible }: { provenance: FieldProvenance | FieldProvenance[]; forceVisible?: boolean }) {
  const list = asList(provenance);
  if (list.length === 0) return null;
  // NEVER aria-hidden (PF-14). Opacity 0 keeps it in the accessibility tree.
  return <span className={`provTag${forceVisible ? ' provTagVisible' : ''}`}>{provenanceText(list)}</span>;
}

export function DocumentSectionReference({ sectionId, title, provenance, sourceNote, children, forceProvVisible }: {
  sectionId: string; title: string; provenance?: FieldProvenance | FieldProvenance[]; sourceNote?: ReactNode; children: ReactNode; forceProvVisible?: boolean;
}) {
  const list = asList(provenance);
  const headingId = `sec-${sectionId}-h`;
  const locked = list.length > 0 && list.every((x) => !x.editable);
  return (
    <section className="docSec" data-sec={sectionId} id={`sec-${sectionId}`} aria-labelledby={headingId}>
      <div className="secHead">
        <h2 className="secHeading" id={headingId}>{title}</h2>
        {locked && <span className="secLock" aria-hidden="true" title="Read-only"><Lock size={14} /></span>}
        <ProvenanceTagReference provenance={list} forceVisible={forceProvVisible} />
      </div>
      {sourceNote && <p className="secSource">{sourceNote}</p>}
      {children}
    </section>
  );
}

/** `sourceNote` rule (page-side, since the link needs studyPublicId): pass only when every entry is inherited. */
export const isInherited = (list: FieldProvenance[]) => list.length > 0 && list.every((x) => x.authority === 'inherited');

/**
 * State board: every authority/editability combination the projection currently emits (COMPONENT_MAPPING §4.3).
 * `forceProvVisible` simulates :hover/:focus-within.
 */
export function DocumentSectionStatesReference() {
  const body = <div className="blockProse"><p>Residents can’t tell where their application stands.</p></div>;
  const src = <>From the <a href="/studies/st_123/brief">approved brief</a></>;
  const rows: [string, FieldProvenance[]][] = [
    ['Summary: generated, editable (default)', [b.sections.summary.provenance]],
    ['Problem: compound (generated + canonical)', [b.sections.problemNarrative.provenance, b.barriers.provenance]],
    ['What we’ll learn: canonical, read-only', [b.objectives.provenance, b.questions.provenance]],
    ['Risks: generated, read-only', [b.risks.provenance]],
    ['Timeline (Brief): computed', [b.timeline.provenance]],
    ['Objectives (Plan): inherited', [p.objectives.provenance]],
    ['Brief commitments (Plan): system', [p.commitments.provenance]],
  ];
  return (
    <div className="docCol">
      {rows.map(([title, list], i) => (
        <DocumentSectionReference key={title} sectionId={`s${i}`} title={title} provenance={list} forceProvVisible={i > 0}
          sourceNote={isInherited(list) ? src : undefined}>{body}</DocumentSectionReference>
      ))}
      {/* editing: N/A (production swaps to ArtifactEditor), see EditorStates.reference.tsx */}
      {/* flagged: reserved, not rendered in UX-3A */}
    </div>
  );
}
