/**
 * DESIGN REFERENCE — NOT PRODUCTION
 * Sample view models typed against the real projection contract (@qori/artifact-contracts @ 7f0366d8).
 * Provenance values are exactly what projectBriefToWorkspace / projectPlanToWorkspace emit for these fields.
 * Reference canvases render these objects directly, the same way production pages should render `vm`.
 */
import type { BriefViewModel, PlanViewModel, FieldProvenance } from '@qori/artifact-contracts';

const P = {
  genEdit: { authority: 'generated', editable: true, label: 'GENERATED · EDITABLE' },
  genRO: { authority: 'generated', editable: false, label: 'GENERATED · READ-ONLY' },
  canonRO: { authority: 'canonical', editable: false, label: 'CANONICAL · READ-ONLY' },
  inherited: { authority: 'inherited', editable: false, label: 'INHERITED · READ-ONLY' },
  computed: { authority: 'computed', editable: false, label: 'COMPUTED · READ-ONLY' },
  system: { authority: 'system', editable: false, label: 'READ-ONLY · SYSTEM' },
} satisfies Record<string, FieldProvenance>;

const study = { publicId: 'st_123', name: 'Permit Application Status Experience', createdAt: '2026-09-14T15:00:00Z' };
const objectives = [{ id: 'OBJ-001', objective: 'Identify which status signals residents rely on to decide whether to call' }];
const questions = [
  { id: 'RQ-001', question: 'What do residents believe each current status label means?', priority: 'Primary' },
  { id: 'RQ-002', question: 'When do residents decide to call instead of waiting?', priority: 'Secondary' },
];
const barriers = [
  { id: 'TB-001', barrier: 'Stage names don’t map to what residents need to do next', source: 'Desk research D1' },
  { id: 'TB-002', barrier: 'No expected-duration signal per stage', source: 'Stakeholder synthesis D2' },
];
const phases = [
  { phase: 'Recruitment', dates: 'Sep 21 – Oct 2', duration: '2 weeks' },
  { phase: 'Sessions', dates: 'Oct 5 – Oct 16', duration: '2 weeks' },
  { phase: 'Synthesis', dates: 'Oct 19 – Oct 30', duration: '2 weeks' },
];
const timelineSummary = { duration: '6 weeks', dateRange: 'Sep 21 – Oct 30', startDate: 'Sep 21', endDate: 'Oct 30' };
const prose = (sectionKey: string, content: string | null, provenance: FieldProvenance = P.genEdit) =>
  ({ sectionKey, content, provenance, exists: !!content });

export const sampleBriefVm: BriefViewModel = {
  artifact: { publicId: 'art_b1', contentVersion: 3, templateId: 'research_brief', templateVersion: 'v7.1', createdAt: '2026-09-14T15:00:00Z', model: 'claude-sonnet-4-6', path: '01-brief/permit-application-status-experience--research-brief.md' },
  study,
  masthead: { studyName: study.name, requestorName: 'Marcus Lee', date: study.createdAt, dateFormatted: 'Sep 14, 2026', statusDisplay: 'Pending approval' },
  githubUrl: 'https://github.com/…/research-brief.md',
  approval: { status: 'pending_approval', isPendingApproval: true, isChangesRequested: false, isApproved: false, reviewerName: 'usr_9', reviewerDisplayName: 'Marcus Lee', changeFeedback: null, approvedAt: null },
  quickFacts: {
    method: { label: 'Method', value: 'user interviews', exists: true },
    participants: { label: 'Participants', value: '8 participants', sub: '2 segments', exists: true },
    timeline: { label: 'Timeline', value: '6 weeks', sub: 'Sep 21 – Oct 30', exists: true },
    decisionDeadline: { label: 'Decision deadline', value: 'Nov 6', sub: 'Budget cycle', exists: true },
    budget: { label: 'Budget', value: '', exists: false },
  },
  sections: {
    summary: prose('summary', 'Residents who apply for building permits can’t tell where their application stands, so they call the permit desk.[D1]'),
    problemNarrative: prose('problem_narrative', 'Status pages show internal stage names that residents don’t recognize.'),
    methodProse: prose('method_prose', 'Remote, 45-minute sessions with a screen share of the current status page.'),
    participantsProse: prose('participants_prose', null),
    outOfScope: prose('out_of_scope', 'Payment and fee flows.'),
  },
  objectives: { items: objectives, count: 1, provenance: P.canonRO, exists: true },
  questions: { items: questions, count: 2, provenance: P.canonRO, exists: true },
  barriers: { items: barriers, count: 2, provenance: P.canonRO, exists: true },
  participantSegments: {
    items: [{ segment: 'First-time applicants', count: 5, rationale: 'Highest call volume' }, { segment: 'Contractors', count: 3, rationale: 'Repeat users, different expectations' }],
    totalCount: 8, approach: null, provenance: P.genEdit, exists: true,
  },
  timeline: { phases, summary: timelineSummary, provenance: P.computed, exists: true },
  risks: { items: [{ risk: 'Contractors decline sessions', source: 'Recruitment', mitigation: 'Offer 30-minute option' }], provenance: P.genRO, exists: true },
  recruitmentSources: 'Permit desk intercept list',
};

export const samplePlanVm: PlanViewModel = {
  artifact: { publicId: 'art_p1', contentVersion: 2, templateId: 'research_plan', templateVersion: 'v3.0', createdAt: '2026-09-18T15:00:00Z', model: 'claude-sonnet-4-6', path: '02-plan/permit-application-status-experience--research-plan.md' },
  study,
  masthead: { studyName: study.name, researcherName: 'Dana Ortiz', date: '2026-09-18T15:00:00Z', dateFormatted: 'Sep 18, 2026', versionDisplay: 'Current · v2' },
  githubUrl: 'https://github.com/…/research-plan.md',
  quickFacts: {
    method: { label: 'Method', value: 'user interviews', exists: true },
    participants: { label: 'Participants', value: '8 participants', exists: true },
    sessions: { label: 'Sessions', value: '', exists: false },
    timeline: { label: 'Timeline', value: '6 weeks', sub: 'Sep 21 – Oct 30', exists: true },
  },
  sections: {
    summary: prose('plan_summary', 'Eight remote interviews test which status signals let residents act without calling.'),
    background: prose('plan_background', null),
    methodApproach: prose('plan_method_approach', 'Semi-structured interviews with a think-aloud task on the current status page.'),
    sessionFormat: prose('plan_session_format', 'Remote, 45 minutes.'),
    dataCollection: prose('plan_data_collection', null),
    participantsProse: prose('plan_participants_prose', 'Five first-time applicants and three contractors.'),
    deliverables: prose('plan_deliverables', null),
  },
  objectives: { items: objectives, count: 1, provenance: P.inherited, exists: true },
  questions: { items: questions, count: 2, provenance: P.inherited, exists: true },
  barriers: { items: barriers, count: 2, provenance: P.inherited, exists: true },
  timeline: { phases, summary: timelineSummary, provenance: P.inherited, exists: true },
  risks: { items: [{ risk: 'Contractors decline sessions', likelihood: 'Medium', mitigation: 'Offer 30-minute option' }], provenance: P.genRO, exists: true },
  commitments: { items: [{ commitment: 'RQ-001 status label comprehension', address: 'Think-aloud task, sessions 1–8' }], provenance: P.system, exists: true },
  participantApproach: null,
  compensation: null,
  budget: null,
};
