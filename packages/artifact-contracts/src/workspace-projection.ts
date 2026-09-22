/**
 * Workspace Projection — Phase 4
 *
 * Transforms canonical artifact state into normalized view models for React.
 *
 * Architecture:
 *   canonical artifact state
 *   → Workspace projection adapter
 *   → normalized document view model
 *   → React components
 *
 * React components should no longer need to understand raw storage layout.
 * All derivation logic (Quick Facts, timeline summaries, participant counts)
 * is centralized here.
 *
 * Authority and editability are explicitly exposed — React does not re-decide.
 */

import { BRIEF_CONTRACT } from './brief.contract';
import { PLAN_CONTRACT } from './plan.contract';
import type { ArtifactFieldDefinition } from './types';

// ─── Authority / Editability ───────────────────────────────────────

/**
 * Authority indicates the source of truth for a field.
 * React should display this (e.g., "READ-ONLY · SYSTEM") and not re-decide.
 */
export type FieldAuthority = 'generated' | 'inherited' | 'system' | 'canonical' | 'computed' | 'user_input' | 'unsupported';

/**
 * Provenance metadata for a projected field.
 * React can render badges like "GENERATED · EDITABLE" without custom logic.
 */
export interface FieldProvenance {
  /** Source of truth for this field */
  authority: FieldAuthority;
  /** Whether the field can be edited in Workspace */
  editable: boolean;
  /** Display label for provenance badge */
  label: string;
}

// ─── Quick Facts ───────────────────────────────────────────────────

/**
 * A single Quick Fact for the summary grid.
 *
 * Quick Facts are concise, scannable values.
 * Long prose should NEVER become a Quick Fact.
 */
export interface QuickFact {
  /** Display label (e.g., "Method", "Participants") */
  label: string;
  /** Primary value (concise, scannable) */
  value: string;
  /** Optional secondary detail */
  sub?: string;
  /** Whether this fact exists (for conditional rendering) */
  exists: boolean;
}

// ─── Structured Items (with IDs) ───────────────────────────────────

/**
 * Research objective with stable ID.
 */
export interface ObjectiveItem {
  id: string;
  objective: string;
}

/**
 * Research question with stable ID and priority.
 */
export interface QuestionItem {
  id: string;
  question: string;
  priority?: string | null;
}

/**
 * Target barrier with stable ID and source.
 */
export interface BarrierItem {
  id: string;
  barrier: string;
  source?: string | null;
}

/**
 * Participant segment with count.
 */
export interface ParticipantSegment {
  segment: string;
  count: number | string;
  rationale: string;
}

/**
 * Timeline phase with dates.
 */
export interface TimelinePhase {
  phase: string;
  dates: string;
  duration?: string;
}

/**
 * Risk with mitigation (Brief schema: source, Plan schema: likelihood).
 */
export interface BriefRisk {
  risk: string;
  source: string;
  mitigation: string;
}

export interface PlanRisk {
  risk: string;
  likelihood: string;
  mitigation: string;
}

/**
 * Brief commitment operationalization (Plan only).
 */
export interface BriefCommitment {
  commitment: string;
  address: string;
}

/**
 * Deliverable item (Plan only).
 */
export interface DeliverableItem {
  id?: string;
  deliverable_name: string;
  format?: string;
  addresses_objective?: string;
}

/**
 * Discovery source (Brief only).
 */
export interface DiscoverySource {
  prefix: string;
  source: string;
  type: string;
  findings: string;
}

// ─── Prose Sections ────────────────────────────────────────────────

/**
 * A prose section with provenance metadata.
 */
export interface ProseSection {
  /** Section key (matches artifact_sections.section_key) */
  sectionKey: string;
  /** Markdown content */
  content: string | null;
  /** Provenance metadata */
  provenance: FieldProvenance;
  /** Whether section has content */
  exists: boolean;
}

// ─── Approval State ────────────────────────────────────────────────

/**
 * Brief approval lifecycle state.
 */
export type BriefApprovalStatus = 'pending_approval' | 'changes_requested' | 'approved' | null;

export interface BriefApprovalState {
  status: BriefApprovalStatus;
  isPendingApproval: boolean;
  isChangesRequested: boolean;
  isApproved: boolean;
  reviewerName?: string | null;
  reviewerDisplayName?: string | null;
  changeFeedback?: string | null;
  approvedAt?: string | null;
}

// ─── Masthead ──────────────────────────────────────────────────────

/**
 * Document masthead (study name, researcher, date, status).
 */
export interface MastheadViewModel {
  studyName: string;
  researcherName?: string | null;
  requestorName?: string | null;
  date?: string | null;
  dateFormatted?: string | null;
  /** Brief status or Plan version indicator */
  statusDisplay?: string | null;
  /** Artifact version (e.g., "Current · v1") */
  versionDisplay?: string | null;
}

// ─── Timeline Summary ──────────────────────────────────────────────

/**
 * Derived timeline summary for Quick Facts.
 */
export interface TimelineSummary {
  /** Total duration (e.g., "6 weeks") */
  duration: string | null;
  /** Date range (e.g., "Sep 28 – Oct 14, 2026") */
  dateRange: string | null;
  /** Start date */
  startDate: string | null;
  /** End date */
  endDate: string | null;
}

// ─── Artifact Metadata ─────────────────────────────────────────────

/**
 * Artifact identity and version info.
 */
export interface ArtifactMetadata {
  publicId?: string | null;
  contentVersion: number;
  templateId?: string | null;
  templateVersion?: string | null;
  createdAt?: string | null;
  model?: string | null;
  path?: string | null;
}

// ─── Brief View Model ──────────────────────────────────────────────

/**
 * Normalized Brief document view model for React.
 *
 * React components render this directly — no additional derivation needed.
 */
export interface BriefViewModel {
  // ─── Identity ───────────────────────────────────────────────────
  /** Artifact metadata */
  artifact: ArtifactMetadata;
  /** Study metadata */
  study: {
    publicId: string;
    name: string;
    createdAt?: string | null;
  };
  /** Masthead display */
  masthead: MastheadViewModel;
  /** GitHub URL if available */
  githubUrl?: string | null;

  // ─── Approval State ─────────────────────────────────────────────
  approval: BriefApprovalState;

  // ─── Quick Facts (summary grid) ─────────────────────────────────
  /** Quick Facts for the summary section */
  quickFacts: {
    method: QuickFact;
    participants: QuickFact;
    timeline: QuickFact;
    decisionDeadline: QuickFact;
    budget: QuickFact;
  };

  // ─── Prose Sections ─────────────────────────────────────────────
  sections: {
    summary: ProseSection;
    problemNarrative: ProseSection;
    methodProse: ProseSection;
    participantsProse: ProseSection;
    outOfScope: ProseSection;
  };

  // ─── Structured Data ────────────────────────────────────────────
  /** Research objectives with stable IDs */
  objectives: {
    items: ObjectiveItem[];
    count: number;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Research questions with stable IDs */
  questions: {
    items: QuestionItem[];
    count: number;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Target barriers with stable IDs */
  barriers: {
    items: BarrierItem[];
    count: number;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Participant segments table */
  participantSegments: {
    items: ParticipantSegment[];
    totalCount: number;
    /** Raw approach text for fallback display when no segments/prose */
    approach?: string | null;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Timeline phases table */
  timeline: {
    phases: TimelinePhase[];
    summary: TimelineSummary;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Risks table */
  risks: {
    items: BriefRisk[];
    provenance: FieldProvenance;
    exists: boolean;
  };

  // ─── Optional Sections ──────────────────────────────────────────
  /** Discovery sources (only if real data exists) */
  discoverySources?: {
    items: DiscoverySource[];
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Recruitment sources */
  recruitmentSources?: string | null;
}

// ─── Plan View Model ───────────────────────────────────────────────

/**
 * Normalized Plan document view model for React.
 *
 * React components render this directly — no additional derivation needed.
 */
export interface PlanViewModel {
  // ─── Identity ───────────────────────────────────────────────────
  artifact: ArtifactMetadata;
  study: {
    publicId: string;
    name: string;
    createdAt?: string | null;
  };
  masthead: MastheadViewModel;
  githubUrl?: string | null;

  // ─── Quick Facts (summary grid) ─────────────────────────────────
  /** Quick Facts for the summary section */
  quickFacts: {
    method: QuickFact;
    participants: QuickFact;
    /** Sessions Quick Fact — only if canonical data exists (#377) */
    sessions: QuickFact;
    timeline: QuickFact;
  };

  // ─── Prose Sections ─────────────────────────────────────────────
  sections: {
    summary: ProseSection;
    background: ProseSection;
    methodApproach: ProseSection;
    sessionFormat: ProseSection;
    dataCollection: ProseSection;
    participantsProse: ProseSection;
    deliverables: ProseSection;
  };

  // ─── Inherited Fields (read-only from Brief) ────────────────────
  /** Objectives inherited from approved Brief — read-only */
  objectives: {
    items: ObjectiveItem[];
    count: number;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Questions inherited from approved Brief — read-only */
  questions: {
    items: QuestionItem[];
    count: number;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Barriers inherited from approved Brief */
  barriers: {
    items: BarrierItem[];
    count: number;
    provenance: FieldProvenance;
    exists: boolean;
  };

  // ─── Structured Data ────────────────────────────────────────────
  /** Timeline phases (inherited from Brief) */
  timeline: {
    phases: TimelinePhase[];
    summary: TimelineSummary;
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Risks table (Plan schema: likelihood) */
  risks: {
    items: PlanRisk[];
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Brief commitments operationalization table */
  commitments: {
    items: BriefCommitment[];
    provenance: FieldProvenance;
    exists: boolean;
  };
  /** Deliverables (structured if available) */
  deliverablesTable?: {
    items: DeliverableItem[];
    provenance: FieldProvenance;
    exists: boolean;
  };

  // ─── Optional Fields ────────────────────────────────────────────
  /** Raw participant approach text for fallback display */
  participantApproach?: string | null;
  /** Compensation — only if canonical data exists (#377 unsupported) */
  compensation?: string | null;
  /** Budget inherited from Brief */
  budget?: string | null;
}

// ─── Projection Input Types ────────────────────────────────────────

/**
 * Raw Brief data from API (matches current useStudyBrief response).
 */
export interface BriefProjectionInput {
  // Study
  study: {
    public_id?: string;
    name: string;
    created_at?: string | null;
  };
  // Approval state
  brief_status?: BriefApprovalStatus;
  brief_reviewer_id?: string | null;
  brief_reviewer_display_name?: string | null;
  brief_change_feedback?: string | null;
  brief_approved_at?: string | null;
  brief_url?: string | null;
  // Prose sections (from artifact_sections)
  prose_sections?: Record<string, string | null>;
  // Cascade fields (from study_variables, may be JSON strings)
  cascade_fields: Record<string, string | null | undefined>;
  // Pre-parsed structured fields (optional, from API)
  structured_fields?: {
    research_objectives?: ObjectiveItem[];
    research_questions?: QuestionItem[];
    target_barriers?: BarrierItem[];
    participant_segments?: ParticipantSegment[];
    discovery_sources?: DiscoverySource[];
  };
  // Artifact metadata
  artifact_metadata?: {
    public_id?: string;
    content_version?: number;
    template_id?: string;
    template_version?: string;
    created_at?: string;
    model?: string;
    path?: string;
  };
}

/**
 * Raw Plan data from API (matches current useStudyPlan response).
 */
export interface PlanProjectionInput {
  // Study
  study: {
    public_id?: string;
    name: string;
    created_at?: string | null;
  };
  // URLs
  plan_url?: string | null;
  plan_created_at?: string | null;
  // Prose sections (from artifact_sections)
  prose_sections?: Record<string, string | null>;
  // Inherited context (from Brief via study_variables)
  inherited_context: Record<string, string | null | undefined>;
  // Pre-parsed structured fields (optional)
  structured_fields?: {
    research_objectives?: ObjectiveItem[];
    research_questions?: QuestionItem[];
    target_barriers?: BarrierItem[];
  };
  // Study metadata
  study_metadata?: {
    researcher_name?: string | null;
    created_at?: string | null;
    study_path?: string | null;
  };
  // Artifact metadata
  artifact_metadata?: {
    public_id?: string;
    content_version?: number;
    template_id?: string;
    template_version?: string;
    created_at?: string;
    model?: string;
    path?: string;
  };
  artifact_version?: number;
}

// ─── Utility Functions ─────────────────────────────────────────────

/**
 * Safe JSON parse for arrays.
 */
function safeParse<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Format date for display.
 */
function formatDate(date: string | null | undefined): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Format methodology enum (replace underscores with spaces, title case).
 */
function formatMethodology(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/_/g, ' ');
}

/**
 * Derive timeline summary from phases, with optional fallback start date.
 * When no phases exist, uses fallbackStartDate from cascade_fields.start_date.
 */
function deriveTimelineSummary(
  phases: TimelinePhase[],
  fallbackStartDate?: string | null,
): TimelineSummary {
  if (phases.length === 0) {
    return {
      duration: null,
      dateRange: null,
      startDate: fallbackStartDate || null,
      endDate: null,
    };
  }

  const firstPhase = phases[0];
  const lastPhase = phases[phases.length - 1];

  // Parse dates from "Sep 14 – Sep 25, 2026" format
  const firstDates = firstPhase.dates?.split('–').map(s => s.trim()) || [];
  const lastDates = lastPhase.dates?.split('–').map(s => s.trim()) || [];
  const startDate = firstDates[0] || null;
  const endDate = lastDates[1] || lastDates[0] || null;

  // Calculate total duration from phase durations
  const totalWeeks = phases.reduce((sum, p) => {
    const match = p.duration?.match(/(\d+)\s*week/i);
    return sum + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  // Fallback: estimate from phase count (2 weeks per phase)
  const duration = totalWeeks > 0 ? `${totalWeeks} weeks` : `${phases.length * 2} weeks`;

  const dateRange = startDate && endDate ? `${startDate} – ${endDate}` : null;

  return { duration, dateRange, startDate, endDate };
}

/**
 * Extract participant count from approach text.
 * "8 Veterans who..." → 8
 */
function extractParticipantCount(text: string | null | undefined): number {
  if (!text) return 0;
  const match = text.match(/^(\d+)\s+/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Derive concise participant fact for Quick Facts.
 * "8 Veterans who..." → "8 participants"
 */
function deriveParticipantFact(
  text: string | null | undefined,
  segments: ParticipantSegment[],
): string | null {
  // If we have segments, sum their counts
  if (segments.length > 0) {
    const total = segments.reduce((sum, s) => {
      const n = typeof s.count === 'number' ? s.count : parseInt(String(s.count), 10);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
    if (total > 0) {
      return `${total} participants`;
    }
  }

  // Extract count from prose
  if (text) {
    const match = text.match(/^(\d+)\s+/);
    if (match) {
      return `${match[1]} participants`;
    }
    // Take first phrase before comma/period
    const first = text.split(/[,;.]/).at(0)?.trim();
    if (first && first.length < 50) {
      return first;
    }
  }

  return null;
}

/**
 * Build provenance from contract field definition.
 */
function buildProvenance(field: ArtifactFieldDefinition): FieldProvenance {
  const authority = field.authority === 'cascade' ? 'canonical' : field.authority;

  const labels: Record<FieldAuthority, string> = {
    generated: field.editable ? 'GENERATED · EDITABLE' : 'GENERATED · READ-ONLY',
    inherited: 'INHERITED · READ-ONLY',
    system: 'READ-ONLY · SYSTEM',
    canonical: field.editable ? 'CANONICAL · EDITABLE' : 'CANONICAL · READ-ONLY',
    computed: 'COMPUTED · READ-ONLY',
    user_input: 'USER INPUT · READ-ONLY',
    unsupported: 'UNSUPPORTED',
  };

  return {
    authority,
    editable: field.editable,
    label: labels[authority],
  };
}

/**
 * Find field definition in contract by key.
 */
function findField(contract: typeof BRIEF_CONTRACT | typeof PLAN_CONTRACT, key: string): ArtifactFieldDefinition | undefined {
  return contract.fields.find(f => f.key === key);
}

// ─── Brief Projection ──────────────────────────────────────────────

/**
 * Project Brief API response to normalized view model.
 *
 * React components should render this directly — no derivation needed.
 */
export function projectBriefToWorkspace(input: BriefProjectionInput): BriefViewModel {
  const prose = input.prose_sections || {};
  const cascade = input.cascade_fields;
  const structured = input.structured_fields || {};
  const artifact = input.artifact_metadata || {};

  // Parse structured arrays (use pre-parsed if available)
  const objectives: ObjectiveItem[] = structured.research_objectives ?? safeParse(cascade.research_objectives);
  const questions: QuestionItem[] = structured.research_questions ?? safeParse(cascade.research_questions);
  const barriers: BarrierItem[] = structured.target_barriers ?? safeParse(cascade.target_barriers);
  const participantSegments: ParticipantSegment[] = structured.participant_segments ?? safeParse(cascade.participant_segments);
  const discoverySources: DiscoverySource[] = structured.discovery_sources ?? safeParse(cascade.discovery_sources);
  const timelinePhases: TimelinePhase[] = safeParse(cascade.timeline_phases);
  const risks: BriefRisk[] = prose.risks ? safeParse(prose.risks) : [];

  // Derive timeline summary with fallback to raw start_date
  const timelineSummary = deriveTimelineSummary(timelinePhases, cascade.start_date);

  // Derive participant fact
  const participantFact = deriveParticipantFact(cascade.participant_approach, participantSegments);
  const participantTotalCount = participantSegments.reduce((sum, s) => {
    const n = typeof s.count === 'number' ? s.count : parseInt(String(s.count), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // Approval state
  const approval: BriefApprovalState = {
    status: input.brief_status ?? null,
    isPendingApproval: input.brief_status === 'pending_approval',
    isChangesRequested: input.brief_status === 'changes_requested',
    isApproved: input.brief_status === 'approved',
    reviewerName: input.brief_reviewer_id,
    reviewerDisplayName: input.brief_reviewer_display_name,
    changeFeedback: input.brief_change_feedback,
    approvedAt: input.brief_approved_at,
  };

  // Build Quick Facts
  const methodology = formatMethodology(cascade.methodology_selection);
  const quickFacts = {
    method: {
      label: 'Method',
      value: methodology || '',
      exists: !!methodology,
      // NOTE: session_format and session_duration are unsupported (#377)
    },
    participants: {
      label: 'Participants',
      value: participantFact || '',
      sub: participantSegments.length > 0 ? `${participantSegments.length} segments` : undefined,
      exists: !!participantFact,
    },
    timeline: {
      label: 'Timeline',
      value: timelineSummary.duration || '',
      sub: timelineSummary.dateRange || undefined,
      exists: !!timelineSummary.duration,
    },
    decisionDeadline: {
      label: 'Decision deadline',
      value: cascade.decision_deadline || '',
      sub: cascade.decision_deadline_context || undefined,
      exists: !!cascade.decision_deadline,
    },
    budget: {
      label: 'Budget',
      value: cascade.budget || '',
      sub: cascade.budget_purpose || undefined,
      exists: !!cascade.budget,
    },
  };

  // Build prose sections with provenance
  const buildProseSection = (
    sectionKey: string,
    content: string | null | undefined,
    fieldKey: string,
  ): ProseSection => {
    const field = findField(BRIEF_CONTRACT, fieldKey);
    const provenance = field ? buildProvenance(field) : {
      authority: 'generated' as FieldAuthority,
      editable: true,
      label: 'GENERATED · EDITABLE',
    };
    return {
      sectionKey,
      content: content || null,
      provenance,
      exists: !!content,
    };
  };

  return {
    artifact: {
      publicId: artifact.public_id,
      contentVersion: artifact.content_version || 1,
      templateId: artifact.template_id,
      templateVersion: artifact.template_version,
      createdAt: artifact.created_at,
      model: artifact.model,
      path: artifact.path,
    },
    study: {
      publicId: input.study.public_id || '',
      name: input.study.name,
      createdAt: input.study.created_at,
    },
    masthead: {
      studyName: input.study.name,
      requestorName: cascade.requestor_name,
      date: input.study.created_at,
      dateFormatted: formatDate(input.study.created_at),
      statusDisplay: approval.isApproved
        ? 'Approved'
        : approval.isPendingApproval
          ? 'Pending approval'
          : approval.isChangesRequested
            ? 'Changes requested'
            : null,
    },
    githubUrl: input.brief_url,
    approval,
    quickFacts,
    sections: {
      summary: buildProseSection('summary', prose.summary, 'summary'),
      problemNarrative: buildProseSection('problem_narrative', prose.problem_narrative, 'problem_narrative'),
      methodProse: buildProseSection('method_prose', prose.method_prose, 'method_prose'),
      participantsProse: buildProseSection('participants_prose', prose.participants_prose, 'participants_prose'),
      outOfScope: buildProseSection('out_of_scope', prose.out_of_scope, 'out_of_scope'),
    },
    objectives: {
      items: objectives,
      count: objectives.length,
      provenance: buildProvenance(findField(BRIEF_CONTRACT, 'research_objectives')!),
      exists: objectives.length > 0,
    },
    questions: {
      items: questions,
      count: questions.length,
      provenance: buildProvenance(findField(BRIEF_CONTRACT, 'research_questions')!),
      exists: questions.length > 0,
    },
    barriers: {
      items: barriers,
      count: barriers.length,
      provenance: buildProvenance(findField(BRIEF_CONTRACT, 'target_barriers')!),
      exists: barriers.length > 0,
    },
    participantSegments: {
      items: participantSegments,
      totalCount: participantTotalCount,
      approach: cascade.participant_approach || null,
      provenance: {
        authority: 'generated',
        editable: true,
        label: 'GENERATED · EDITABLE',
      },
      exists: participantSegments.length > 0 || !!cascade.participant_approach,
    },
    timeline: {
      phases: timelinePhases,
      summary: timelineSummary,
      provenance: buildProvenance(findField(BRIEF_CONTRACT, 'timeline_phases')!),
      exists: timelinePhases.length > 0,
    },
    risks: {
      items: risks,
      provenance: buildProvenance(findField(BRIEF_CONTRACT, 'risks')!),
      exists: risks.length > 0,
    },
    discoverySources: discoverySources.length > 0 ? {
      items: discoverySources,
      provenance: {
        authority: 'canonical',
        editable: false,
        label: 'CANONICAL · READ-ONLY',
      },
      exists: true,
    } : undefined,
    recruitmentSources: cascade.recruitment_sources || null,
  };
}

// ─── Plan Projection ───────────────────────────────────────────────

/**
 * Project Plan API response to normalized view model.
 *
 * React components should render this directly — no derivation needed.
 */
export function projectPlanToWorkspace(input: PlanProjectionInput): PlanViewModel {
  const prose = input.prose_sections || {};
  const inherited = input.inherited_context;
  const structured = input.structured_fields || {};
  const meta = input.study_metadata || {};
  const artifact = input.artifact_metadata || {};

  // Parse structured arrays (use pre-parsed if available)
  const objectives: ObjectiveItem[] = structured.research_objectives ?? safeParse(inherited.research_objectives);
  const questions: QuestionItem[] = structured.research_questions ?? safeParse(inherited.research_questions);
  const barriers: BarrierItem[] = structured.target_barriers ?? safeParse(inherited.target_barriers);
  const timelinePhases: TimelinePhase[] = safeParse(inherited.timeline_phases);

  // Parse Plan-specific structured sections
  const risks: PlanRisk[] = prose.plan_risks ? safeParse(prose.plan_risks) : [];
  const commitments: BriefCommitment[] = prose.plan_commitments ? safeParse(prose.plan_commitments) : [];
  const deliverables: DeliverableItem[] = inherited.deliverables ? safeParse(inherited.deliverables) : [];

  // Derive timeline summary with fallback to inherited start_date
  const timelineSummary = deriveTimelineSummary(timelinePhases, inherited.start_date);

  // Derive concise participant fact
  const participantApproach = inherited.participant_approach || '';
  const participantMatch = participantApproach.match(/^(\d+)\s+/);
  const participantsFact = participantMatch
    ? `${participantMatch[1]} participants`
    : participantApproach.split(/[,;.]/).at(0)?.trim() || null;

  // Methodology from inherited context
  const methodology = formatMethodology(inherited.methodology_selection);

  // Session format/duration — unsupported per #377, only show if canonical data exists
  const sessionFormat = inherited.session_format || null;
  const sessionDuration = inherited.session_duration || null;
  const sessionsFact = (sessionDuration || sessionFormat)
    ? { label: 'Sessions', value: sessionDuration || '', sub: sessionFormat || undefined, exists: true }
    : { label: 'Sessions', value: '', exists: false };

  // Build Quick Facts
  const quickFacts = {
    method: {
      label: 'Method',
      value: methodology || '',
      exists: !!methodology,
    },
    participants: {
      label: 'Participants',
      value: participantsFact || '',
      exists: !!participantsFact,
    },
    sessions: sessionsFact,
    timeline: {
      label: 'Timeline',
      value: timelineSummary.duration || 'See timeline',
      sub: timelineSummary.dateRange || undefined,
      exists: !!timelineSummary.duration || timelinePhases.length > 0,
    },
  };

  // Build prose sections with provenance
  const buildProseSection = (
    sectionKey: string,
    content: string | null | undefined,
    fieldKey: string,
  ): ProseSection => {
    const field = findField(PLAN_CONTRACT, fieldKey);
    const provenance = field ? buildProvenance(field) : {
      authority: 'generated' as FieldAuthority,
      editable: true,
      label: 'GENERATED · EDITABLE',
    };
    return {
      sectionKey,
      content: content || null,
      provenance,
      exists: !!content,
    };
  };

  // Artifact version display
  const versionDisplay = artifact.content_version
    ? `Current · v${artifact.content_version}`
    : null;

  return {
    artifact: {
      publicId: artifact.public_id,
      contentVersion: artifact.content_version || input.artifact_version || 1,
      templateId: artifact.template_id,
      templateVersion: artifact.template_version,
      createdAt: artifact.created_at || input.plan_created_at,
      model: artifact.model,
      path: artifact.path || meta.study_path,
    },
    study: {
      publicId: input.study.public_id || '',
      name: input.study.name,
      createdAt: input.study.created_at,
    },
    masthead: {
      studyName: input.study.name,
      researcherName: meta.researcher_name,
      date: meta.created_at || input.study.created_at,
      dateFormatted: formatDate(meta.created_at || input.study.created_at),
      versionDisplay,
    },
    githubUrl: input.plan_url,
    quickFacts,
    sections: {
      summary: buildProseSection('plan_summary', prose.plan_summary, 'plan_summary'),
      background: buildProseSection('plan_background', prose.plan_background, 'plan_background'),
      methodApproach: buildProseSection('plan_method_approach', prose.plan_method_approach, 'plan_method_approach'),
      sessionFormat: buildProseSection('plan_session_format', prose.plan_session_format, 'plan_session_format'),
      dataCollection: buildProseSection('plan_data_collection', prose.plan_data_collection, 'plan_data_collection'),
      participantsProse: buildProseSection('plan_participants_prose', prose.plan_participants_prose, 'plan_participants_prose'),
      deliverables: buildProseSection('plan_deliverables', prose.plan_deliverables, 'plan_deliverables'),
    },
    // Inherited fields are read-only
    objectives: {
      items: objectives,
      count: objectives.length,
      provenance: buildProvenance(findField(PLAN_CONTRACT, 'research_objectives')!),
      exists: objectives.length > 0,
    },
    questions: {
      items: questions,
      count: questions.length,
      provenance: buildProvenance(findField(PLAN_CONTRACT, 'research_questions')!),
      exists: questions.length > 0,
    },
    barriers: {
      items: barriers,
      count: barriers.length,
      provenance: buildProvenance(findField(PLAN_CONTRACT, 'target_barriers')!),
      exists: barriers.length > 0,
    },
    timeline: {
      phases: timelinePhases,
      summary: timelineSummary,
      provenance: buildProvenance(findField(PLAN_CONTRACT, 'timeline_phases')!),
      exists: timelinePhases.length > 0,
    },
    risks: {
      items: risks,
      provenance: buildProvenance(findField(PLAN_CONTRACT, 'plan_risks')!),
      exists: risks.length > 0,
    },
    commitments: {
      items: commitments,
      provenance: {
        authority: 'system',
        editable: false,
        label: 'READ-ONLY · SYSTEM',
      },
      exists: commitments.length > 0,
    },
    deliverablesTable: deliverables.length > 0 ? {
      items: deliverables,
      provenance: {
        authority: 'generated',
        editable: true,
        label: 'GENERATED · EDITABLE',
      },
      exists: true,
    } : undefined,
    // Raw participant approach for fallback display
    participantApproach: participantApproach || null,
    // Compensation unsupported per #377
    compensation: inherited.compensation || null,
    budget: inherited.budget || null,
  };
}
