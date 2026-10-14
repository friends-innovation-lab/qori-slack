/**
 * Desk Research Readout Service — DR-6b-2
 *
 * Study-scoped readouts that synthesize accepted Desk Research insights
 * from the parent project.
 *
 * Per DR-6b canonical contract:
 * - Readouts belong to one study within a project (D1)
 * - Eligible evidence comes from accepted insights in the same project (D2)
 * - Save and Approve are separate actions (D3)
 * - Optimistic concurrency via content_version (D4)
 * - Review state invalidation on content changes (D5)
 * - Approval requires complete review state (D6)
 * - Display IDs use RO-0001 format, study-scoped (D7)
 *
 * LIMITATION: Approval DELETE immutability is NOT enforced at the database
 * level due to shared application role. This service does not expose any
 * approval deletion operations. See PLAT-X for future role separation.
 */

import sequelize from '../database';
import { Op, Transaction } from 'sequelize';
import { randomUUID } from 'crypto';
import type { DraftContent } from '../database/models/desk_research_readout_draft';
import type {
  EvidenceSnapshot,
  EvidenceSnapshotEntry,
} from '../database/models/desk_research_readout_approval';
import type {
  EvidenceSetEntry,
  GenerationStatus,
} from '../database/models/desk_research_readout_version';
import {
  assertProjectResearcherByActor,
  assertProjectAccessByActor,
  AuthorizationError,
} from './authorization.service';

const {
  DeskResearchReadout,
  DeskResearchReadoutDraft,
  DeskResearchReadoutVersion,
  DeskResearchReadoutApproval,
  ResearchStudy,
  Project,
  Actor,
  EvidenceConstruct,
  EvidenceConstructRevision,
} = sequelize.models;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateReadoutInput {
  studyId: number;
  projectId: number;
  title: string;
  question?: string;
  createdByActorId: number;
}

export interface SaveDraftInput {
  readoutId: number;
  content: DraftContent;
  findingsChecked: string[];
  implicationsReviewed: string[];
  expectedVersion: number;
  editedByActorId: number;
}

export interface ApproveReadoutInput {
  readoutId: number;
  expectedVersion: number;
  approvedByActorId: number;
  approvalNote?: string;
  supersessionNotes?: Record<string, string>;
}

export interface InitiateGenerationInput {
  readoutId: number;
  evidenceSet: EvidenceSetEntry[];
  initiatedByActorId: number;
}

export interface CompleteGenerationInput {
  readoutId: number;
  generationRequestId: string;
  content: DraftContent;
  status: 'completed' | 'failed';
  error?: string;
}

export interface ReadoutSummary {
  id: number;
  publicId: string;
  displayId: string;
  studyId: number;
  projectId: number;
  title: string;
  question: string | null;
  approvedAt: Date | null;
  approvedVersion: number | null;
  outOfDateSince: Date | null;
  outOfDateReason: string | null;
  currentGenerationRequestId: string | null;
  createdAt: Date;
  createdByActorId: number;
}

export interface ReadoutDetail extends ReadoutSummary {
  draft: DraftDetail;
  latestApproval: ApprovalDetail | null;
}

export interface DraftDetail {
  content: DraftContent;
  findingsChecked: string[];
  implicationsReviewed: string[];
  contentVersion: number;
  lastEditedAt: Date;
  lastEditedByActorId: number | null;
}

export interface ApprovalDetail {
  id: number;
  approvalNumber: number;
  sourceDraftContentVersion: number;
  approvedAt: Date;
  approvedByActorId: number;
  approvalNote: string | null;
  contentSnapshot: DraftContent;
  findingsCheckedSnapshot: string[];
  implicationsReviewedSnapshot: string[];
  evidenceSnapshot: EvidenceSnapshot;
  supersessionNotes: Record<string, string> | null;
}

export interface CitationValidationResult {
  valid: boolean;
  validCitations: ValidatedCitation[];
  errors: CitationError[];
}

export interface ValidatedCitation {
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
  displayId: string;
  isSuperseded: boolean;
}

export interface CitationError {
  constructPublicId: string;
  revisionPublicId?: string;
  reason: string;
}

export interface ApprovalEligibility {
  eligible: boolean;
  errors: string[];
}

export interface SaveResult {
  success: boolean;
  draft?: DraftDetail;
  conflict?: {
    currentVersion: number;
    submittedContent: DraftContent;
  };
  invalidatedFindings: string[];
  invalidatedImplications: string[];
}

export interface GenerationResult {
  versionId: number;
  generationRequestId: string;
  status: GenerationStatus;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ReadoutNotFoundError extends Error {
  constructor(message = 'Readout not found') {
    super(message);
    this.name = 'ReadoutNotFoundError';
  }
}

export class StudyNotFoundError extends Error {
  constructor(message = 'Study not found') {
    super(message);
    this.name = 'StudyNotFoundError';
  }
}

export class ConcurrencyError extends Error {
  constructor(
    message = 'Concurrent modification detected',
    public currentVersion: number,
    public submittedContent?: DraftContent,
  ) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class CitationValidationError extends Error {
  constructor(
    message: string,
    public errors: CitationError[],
  ) {
    super(message);
    this.name = 'CitationValidationError';
  }
}

export class ApprovalEligibilityError extends Error {
  constructor(
    message: string,
    public errors: string[],
  ) {
    super(message);
    this.name = 'ApprovalEligibilityError';
  }
}

export class ProjectAccessError extends Error {
  constructor(message = 'Citation belongs to a different project') {
    super(message);
    this.name = 'ProjectAccessError';
  }
}

export class GenerationConflictError extends Error {
  constructor(
    message = 'Draft was modified during generation',
    public versionAtStart: number,
    public currentVersion: number,
  ) {
    super(message);
    this.name = 'GenerationConflictError';
  }
}

// ─── Authorization Helpers ────────────────────────────────────────────────────

/**
 * Resolve organizationId from a project.
 * This ensures authorization uses the persisted association, not caller-supplied data.
 */
async function resolveOrganizationFromProject(
  projectId: number,
  transaction?: Transaction,
): Promise<number> {
  const project = await Project.findByPk(projectId, {
    attributes: ['id', 'organization_id'],
    transaction,
  });

  if (!project) {
    throw new ValidationError('Project not found');
  }

  const orgId = (project as any).organization_id;
  if (!orgId) {
    throw new ValidationError('Project has no organization');
  }

  return orgId;
}

/**
 * Resolve projectId and organizationId from a readout.
 * Used by operations that take readoutId as input.
 */
async function resolveProjectFromReadout(
  readoutId: number,
  transaction?: Transaction,
): Promise<{ projectId: number; organizationId: number }> {
  const readout = await DeskResearchReadout.findByPk(readoutId, {
    attributes: ['id', 'project_id'],
    transaction,
  });

  if (!readout) {
    throw new ReadoutNotFoundError();
  }

  const projectId = (readout as any).project_id;
  const organizationId = await resolveOrganizationFromProject(projectId, transaction);

  return { projectId, organizationId };
}

/**
 * Resolve projectId and organizationId from a study.
 * Used by operations that take studyId as input.
 */
async function resolveProjectFromStudy(
  studyId: number,
  transaction?: Transaction,
): Promise<{ projectId: number; organizationId: number }> {
  const study = await ResearchStudy.findByPk(studyId, {
    attributes: ['id', 'project_id'],
    transaction,
  });

  if (!study) {
    throw new StudyNotFoundError();
  }

  const projectId = (study as any).project_id;
  if (!projectId) {
    throw new ValidationError('Study has no project');
  }

  const organizationId = await resolveOrganizationFromProject(projectId, transaction);

  return { projectId, organizationId };
}

// Re-export AuthorizationError for callers
export { AuthorizationError };

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Format display ID from sequence number: RO-0001
 */
function formatDisplayId(sequence: number): string {
  return `RO-${String(sequence).padStart(4, '0')}`;
}

/**
 * Allocate next display sequence for a study (concurrency-safe)
 *
 * Locks the study row to prevent concurrent allocation.
 * This ensures atomicity without using FOR UPDATE on aggregates.
 */
async function allocateDisplaySequence(
  studyId: number,
  transaction: Transaction,
): Promise<number> {
  // Lock the study row to prevent concurrent display_sequence allocation
  await sequelize.query(
    `SELECT id FROM research_studies WHERE id = :studyId FOR UPDATE`,
    {
      replacements: { studyId },
      transaction,
      type: 'SELECT' as any,
    },
  );

  // Now safely compute the next sequence number
  const results = await sequelize.query<{ next_seq: string }>(
    `
    SELECT COALESCE(MAX(display_sequence), 0) + 1 as next_seq
    FROM desk_research_readouts
    WHERE study_id = :studyId
    `,
    {
      replacements: { studyId },
      transaction,
      type: 'SELECT' as any,
    },
  );

  const rows = results as unknown as Array<{ next_seq: string }>;
  return parseInt(rows[0]?.next_seq ?? '1', 10);
}

/**
 * Extract all citations from draft content
 */
function extractCitations(content: DraftContent): Array<{
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
  displayId: string;
}> {
  const citations: Array<{
    constructPublicId: string;
    revisionPublicId: string;
    revisionNumber: number;
    displayId: string;
  }> = [];

  // Summary citations
  if (content.summary?.citations) {
    citations.push(...content.summary.citations);
  }

  // Finding citations
  if (content.findings) {
    for (const finding of content.findings) {
      if (finding.citations) {
        citations.push(...finding.citations);
      }
    }
  }

  // Implication citations (direct citations)
  if (content.implications) {
    for (const impl of content.implications) {
      if (impl.basedOnCitations) {
        citations.push(...impl.basedOnCitations);
      }
    }
  }

  return citations;
}

/**
 * Deduplicate citations by construct+revision
 */
function deduplicateCitations(
  citations: Array<{
    constructPublicId: string;
    revisionPublicId: string;
    revisionNumber: number;
    displayId: string;
  }>,
): Array<{
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
  displayId: string;
}> {
  const seen = new Set<string>();
  const result: typeof citations = [];

  for (const citation of citations) {
    const key = `${citation.constructPublicId}:${citation.revisionPublicId}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(citation);
    }
  }

  return result;
}

/**
 * Compare citations for equality (canonical identity)
 */
function citationsEqual(
  a: { constructPublicId: string; revisionPublicId: string; revisionNumber: number },
  b: { constructPublicId: string; revisionPublicId: string; revisionNumber: number },
): boolean {
  return (
    a.constructPublicId === b.constructPublicId &&
    a.revisionPublicId === b.revisionPublicId &&
    a.revisionNumber === b.revisionNumber
  );
}

/**
 * Compare citation arrays for equality
 */
function citationArraysEqual(
  a: Array<{ constructPublicId: string; revisionPublicId: string; revisionNumber: number }>,
  b: Array<{ constructPublicId: string; revisionPublicId: string; revisionNumber: number }>,
): boolean {
  if (a.length !== b.length) return false;

  const sortedA = [...a].sort((x, y) => x.constructPublicId.localeCompare(y.constructPublicId));
  const sortedB = [...b].sort((x, y) => x.constructPublicId.localeCompare(y.constructPublicId));

  for (let i = 0; i < sortedA.length; i++) {
    if (!citationsEqual(sortedA[i], sortedB[i])) return false;
  }

  return true;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new readout with initial empty draft
 *
 * AUTHORIZATION: Requires researcher role in the project.
 */
export async function createReadout(input: CreateReadoutInput): Promise<ReadoutDetail> {
  const { studyId, projectId, title, question, createdByActorId } = input;

  // Validate title
  if (!title || title.trim().length === 0) {
    throw new ValidationError('Readout title is required');
  }

  // Resolve organization and authorize BEFORE transaction
  const organizationId = await resolveOrganizationFromProject(projectId);
  await assertProjectResearcherByActor(createdByActorId, projectId, organizationId);

  return sequelize.transaction(async (transaction) => {
    // Verify study exists and belongs to project
    const study = await ResearchStudy.findByPk(studyId, {
      attributes: ['id', 'project_id'],
      transaction,
    });

    if (!study) {
      throw new StudyNotFoundError();
    }

    if ((study as any).project_id !== projectId) {
      throw new ValidationError('Study does not belong to the specified project');
    }

    // Allocate study-scoped display sequence
    const displaySequence = await allocateDisplaySequence(studyId, transaction);
    const displayId = formatDisplayId(displaySequence);

    // Create readout
    const readout = await DeskResearchReadout.create(
      {
        study_id: studyId,
        project_id: projectId,
        display_id: displayId,
        display_sequence: displaySequence,
        title: title.trim(),
        question: question?.trim() || null,
        created_by_actor_id: createdByActorId,
      } as any,
      { transaction },
    );

    // Create initial empty draft
    const draft = await DeskResearchReadoutDraft.create(
      {
        readout_id: (readout as any).id,
        content: {},
        findings_checked: [],
        implications_reviewed: [],
        content_version: 1,
        last_edited_by_actor_id: createdByActorId,
      } as any,
      { transaction },
    );

    return mapToReadoutDetail(readout, draft, null);
  });
}

/**
 * Get readout by ID
 *
 * AUTHORIZATION: Requires project membership.
 */
export async function getReadoutById(
  readoutId: number,
  actorId: number,
  transaction?: Transaction,
): Promise<ReadoutDetail | null> {
  // Resolve project and authorize
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId, transaction);
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  const readout = await DeskResearchReadout.findByPk(readoutId, {
    include: [
      {
        model: DeskResearchReadoutDraft,
        as: 'draft',
      },
    ],
    transaction,
  });

  if (!readout) return null;

  // Get latest approval
  const latestApproval = await DeskResearchReadoutApproval.findOne({
    where: { readout_id: readoutId },
    order: [['approval_number', 'DESC']],
    transaction,
  });

  return mapToReadoutDetail(readout, (readout as any).draft, latestApproval);
}

/**
 * Get readout by public ID
 *
 * AUTHORIZATION: Requires project membership.
 */
export async function getReadoutByPublicId(
  publicId: string,
  actorId: number,
  transaction?: Transaction,
): Promise<ReadoutDetail | null> {
  // First find the readout to get projectId
  const readout = await DeskResearchReadout.findOne({
    where: { public_id: publicId },
    include: [
      {
        model: DeskResearchReadoutDraft,
        as: 'draft',
      },
    ],
    transaction,
  });

  if (!readout) return null;

  // Resolve project and authorize
  const projectId = (readout as any).project_id;
  const organizationId = await resolveOrganizationFromProject(projectId, transaction);
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  const latestApproval = await DeskResearchReadoutApproval.findOne({
    where: { readout_id: (readout as any).id },
    order: [['approval_number', 'DESC']],
    transaction,
  });

  return mapToReadoutDetail(readout, (readout as any).draft, latestApproval);
}

/**
 * List readouts for a study
 *
 * AUTHORIZATION: Requires project membership.
 */
export async function listReadoutsByStudy(
  studyId: number,
  actorId: number,
  options?: { limit?: number; offset?: number },
): Promise<{ readouts: ReadoutSummary[]; total: number }> {
  // Resolve project and authorize
  const { projectId, organizationId } = await resolveProjectFromStudy(studyId);
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  const { limit = 50, offset = 0 } = options || {};

  const { rows, count } = await DeskResearchReadout.findAndCountAll({
    where: { study_id: studyId },
    order: [['display_sequence', 'ASC']],
    limit,
    offset,
  });

  return {
    readouts: rows.map(mapToReadoutSummary),
    total: count,
  };
}

/**
 * Save draft with optimistic concurrency and review state invalidation
 *
 * AUTHORIZATION: Requires researcher role in the project.
 */
export async function saveDraft(input: SaveDraftInput): Promise<SaveResult> {
  const {
    readoutId,
    content,
    findingsChecked,
    implicationsReviewed,
    expectedVersion,
    editedByActorId,
  } = input;

  // Resolve project and authorize BEFORE transaction
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId);
  await assertProjectResearcherByActor(editedByActorId, projectId, organizationId);

  return sequelize.transaction(async (transaction) => {
    // Lock and fetch draft
    const draft = await DeskResearchReadoutDraft.findOne({
      where: { readout_id: readoutId },
      lock: true,
      transaction,
    });

    if (!draft) {
      throw new ReadoutNotFoundError('Readout draft not found');
    }

    const currentVersion = (draft as any).content_version;

    // Check optimistic concurrency
    if (currentVersion !== expectedVersion) {
      return {
        success: false,
        conflict: {
          currentVersion,
          submittedContent: content,
        },
        invalidatedFindings: [],
        invalidatedImplications: [],
      };
    }

    // Validate content structure
    validateDraftContent(content);

    // Compute review state invalidations
    const { invalidatedFindings, invalidatedImplications } = computeInvalidations(
      (draft as any).content,
      content,
      findingsChecked,
      implicationsReviewed,
    );

    // Apply invalidations to submitted review state
    const finalFindingsChecked = findingsChecked.filter(
      (id) => !invalidatedFindings.includes(id),
    );
    const finalImplicationsReviewed = implicationsReviewed.filter(
      (id) => !invalidatedImplications.includes(id),
    );

    // Validate no new content arrives pre-checked or pre-reviewed
    validateNoPreCheckedNewContent(
      (draft as any).content,
      content,
      finalFindingsChecked,
      finalImplicationsReviewed,
    );

    // Validate dangling finding references
    validateFindingReferences(content);

    // Update draft
    await (draft as any).update(
      {
        content,
        findings_checked: finalFindingsChecked,
        implications_reviewed: finalImplicationsReviewed,
        content_version: currentVersion + 1,
        last_edited_at: new Date(),
        last_edited_by_actor_id: editedByActorId,
      },
      { transaction },
    );

    await (draft as any).reload({ transaction });

    return {
      success: true,
      draft: {
        content: (draft as any).content,
        findingsChecked: (draft as any).findings_checked,
        implicationsReviewed: (draft as any).implications_reviewed,
        contentVersion: (draft as any).content_version,
        lastEditedAt: (draft as any).last_edited_at,
        lastEditedByActorId: (draft as any).last_edited_by_actor_id,
      },
      invalidatedFindings,
      invalidatedImplications,
    };
  });
}

/**
 * Validate draft content structure
 */
function validateDraftContent(content: DraftContent): void {
  // Validate findings have required fields
  if (content.findings) {
    for (const finding of content.findings) {
      if (!finding.id || typeof finding.id !== 'string') {
        throw new ValidationError('Each finding must have a string id');
      }
      if (!finding.text || typeof finding.text !== 'string') {
        throw new ValidationError('Each finding must have text');
      }
      if (!Array.isArray(finding.citations)) {
        throw new ValidationError('Each finding must have citations array');
      }
    }
  }

  // Validate implications have required fields
  if (content.implications) {
    for (const impl of content.implications) {
      if (!impl.id || typeof impl.id !== 'string') {
        throw new ValidationError('Each implication must have a string id');
      }
      if (!impl.text || typeof impl.text !== 'string') {
        throw new ValidationError('Each implication must have text');
      }
      if (!['question', 'gap', 'priority', 'hypothesis'].includes(impl.kind)) {
        throw new ValidationError('Implication kind must be question, gap, priority, or hypothesis');
      }
      if (!Array.isArray(impl.basedOnFindings)) {
        throw new ValidationError('Each implication must have basedOnFindings array');
      }
    }
  }
}

/**
 * Validate finding references in implications
 */
function validateFindingReferences(content: DraftContent): void {
  if (!content.implications || !content.findings) return;

  const findingIds = new Set(content.findings.map((f) => f.id));

  for (const impl of content.implications) {
    for (const findingId of impl.basedOnFindings) {
      if (!findingIds.has(findingId)) {
        throw new ValidationError(
          `Implication "${impl.id}" references non-existent finding "${findingId}"`,
        );
      }
    }
  }
}

/**
 * Validate no new content arrives pre-checked or pre-reviewed
 */
function validateNoPreCheckedNewContent(
  oldContent: DraftContent,
  newContent: DraftContent,
  findingsChecked: string[],
  implicationsReviewed: string[],
): void {
  const oldFindingIds = new Set((oldContent.findings || []).map((f) => f.id));
  const oldImplicationIds = new Set((oldContent.implications || []).map((i) => i.id));

  // Check for new findings that are pre-checked
  for (const finding of newContent.findings || []) {
    if (!oldFindingIds.has(finding.id) && findingsChecked.includes(finding.id)) {
      throw new ValidationError(
        `New finding "${finding.id}" cannot arrive already marked as Checked`,
      );
    }
  }

  // Check for new implications that are pre-reviewed
  for (const impl of newContent.implications || []) {
    if (!oldImplicationIds.has(impl.id) && implicationsReviewed.includes(impl.id)) {
      throw new ValidationError(
        `New implication "${impl.id}" cannot arrive already marked as Reviewed`,
      );
    }
  }
}

/**
 * Compute which findings and implications need their review state invalidated
 */
function computeInvalidations(
  oldContent: DraftContent,
  newContent: DraftContent,
  findingsChecked: string[],
  implicationsReviewed: string[],
): { invalidatedFindings: string[]; invalidatedImplications: string[] } {
  const invalidatedFindings: string[] = [];
  const invalidatedImplications: string[] = [];

  const oldFindings = new Map((oldContent.findings || []).map((f) => [f.id, f]));
  const oldImplications = new Map((oldContent.implications || []).map((i) => [i.id, i]));

  // Check findings for changes
  for (const newFinding of newContent.findings || []) {
    const oldFinding = oldFindings.get(newFinding.id);

    if (oldFinding && findingsChecked.includes(newFinding.id)) {
      // Check if text changed
      if (oldFinding.text !== newFinding.text) {
        invalidatedFindings.push(newFinding.id);
        continue;
      }

      // Check if citations changed
      if (!citationArraysEqual(oldFinding.citations || [], newFinding.citations || [])) {
        invalidatedFindings.push(newFinding.id);
      }
    }
  }

  // Check implications for changes
  for (const newImpl of newContent.implications || []) {
    const oldImpl = oldImplications.get(newImpl.id);

    if (oldImpl && implicationsReviewed.includes(newImpl.id)) {
      // Check if text changed
      if (oldImpl.text !== newImpl.text) {
        invalidatedImplications.push(newImpl.id);
        continue;
      }

      // Check if kind changed
      if (oldImpl.kind !== newImpl.kind) {
        invalidatedImplications.push(newImpl.id);
        continue;
      }

      // Check if basedOnFindings changed
      const oldBasedOn = [...(oldImpl.basedOnFindings || [])].sort();
      const newBasedOn = [...(newImpl.basedOnFindings || [])].sort();
      if (oldBasedOn.join(',') !== newBasedOn.join(',')) {
        invalidatedImplications.push(newImpl.id);
        continue;
      }

      // Check if direct citations changed
      if (!citationArraysEqual(oldImpl.basedOnCitations || [], newImpl.basedOnCitations || [])) {
        invalidatedImplications.push(newImpl.id);
        continue;
      }

      // Check if any linked finding was invalidated
      for (const findingId of newImpl.basedOnFindings) {
        if (invalidatedFindings.includes(findingId)) {
          invalidatedImplications.push(newImpl.id);
          break;
        }
      }
    }
  }

  return { invalidatedFindings, invalidatedImplications };
}

/**
 * Validate all citations in content against project's accepted insights
 */
export async function validateCitations(
  projectId: number,
  content: DraftContent,
  transaction?: Transaction,
): Promise<CitationValidationResult> {
  const citations = deduplicateCitations(extractCitations(content));

  if (citations.length === 0) {
    return { valid: true, validCitations: [], errors: [] };
  }

  const validCitations: ValidatedCitation[] = [];
  const errors: CitationError[] = [];

  // Batch lookup constructs by public_id
  const constructPublicIds = [...new Set(citations.map((c) => c.constructPublicId))];
  const constructs = await EvidenceConstruct.findAll({
    where: {
      public_id: { [Op.in]: constructPublicIds },
      construct_type: 'desk_insight',
    },
    attributes: [
      'id',
      'public_id',
      'project_id',
      'display_sequence',
      'status',
      'withdrawn_at',
      'accepted_revision_id',
    ],
    transaction,
  });

  const constructMap = new Map(constructs.map((c: any) => [c.public_id, c]));

  // Batch lookup revisions
  const revisionPublicIds = citations.map((c) => c.revisionPublicId);
  const revisions = await EvidenceConstructRevision.findAll({
    where: {
      public_id: { [Op.in]: revisionPublicIds },
    },
    attributes: ['id', 'public_id', 'construct_id', 'revision_number'],
    transaction,
  });

  const revisionMap = new Map(revisions.map((r: any) => [r.public_id, r]));

  // Validate each citation
  for (const citation of citations) {
    const construct = constructMap.get(citation.constructPublicId);

    // Check construct exists
    if (!construct) {
      errors.push({
        constructPublicId: citation.constructPublicId,
        reason: 'Insight not found',
      });
      continue;
    }

    // Check project ownership
    if ((construct as any).project_id !== projectId) {
      errors.push({
        constructPublicId: citation.constructPublicId,
        reason: 'Insight belongs to a different project',
      });
      continue;
    }

    // Check not withdrawn
    if ((construct as any).withdrawn_at) {
      errors.push({
        constructPublicId: citation.constructPublicId,
        reason: 'Insight has been withdrawn',
      });
      continue;
    }

    // Check revision exists
    const revision = revisionMap.get(citation.revisionPublicId);
    if (!revision) {
      errors.push({
        constructPublicId: citation.constructPublicId,
        revisionPublicId: citation.revisionPublicId,
        reason: 'Revision not found',
      });
      continue;
    }

    // Check revision belongs to construct
    if ((revision as any).construct_id !== (construct as any).id) {
      errors.push({
        constructPublicId: citation.constructPublicId,
        revisionPublicId: citation.revisionPublicId,
        reason: 'Revision does not belong to this insight',
      });
      continue;
    }

    // Check revision number matches
    if ((revision as any).revision_number !== citation.revisionNumber) {
      errors.push({
        constructPublicId: citation.constructPublicId,
        revisionPublicId: citation.revisionPublicId,
        reason: `Revision number mismatch: expected ${citation.revisionNumber}, got ${(revision as any).revision_number}`,
      });
      continue;
    }

    // Check if revision is the currently accepted one
    const isAccepted = (construct as any).accepted_revision_id === (revision as any).id;

    if (!isAccepted) {
      // Not the accepted revision - check if superseded or pending
      // A revision is superseded if there's an accepted revision with higher revision number
      // A revision is pending if there's no accepted revision or it has higher number than accepted
      const acceptedRevisionId = (construct as any).accepted_revision_id;

      if (acceptedRevisionId === null) {
        // No accepted revision at all - this is pending
        errors.push({
          constructPublicId: citation.constructPublicId,
          revisionPublicId: citation.revisionPublicId,
          reason: 'Revision is not accepted (insight has no accepted revision)',
        });
        continue;
      }

      // Look up the accepted revision to compare revision numbers
      const acceptedRevision = await EvidenceConstructRevision.findByPk(acceptedRevisionId, {
        attributes: ['revision_number'],
        transaction,
      });

      if (!acceptedRevision) {
        // Shouldn't happen, but handle gracefully
        errors.push({
          constructPublicId: citation.constructPublicId,
          revisionPublicId: citation.revisionPublicId,
          reason: 'Revision is not accepted (accepted revision not found)',
        });
        continue;
      }

      const citedRevisionNumber = (revision as any).revision_number;
      const acceptedRevisionNumber = (acceptedRevision as any).revision_number;

      if (citedRevisionNumber > acceptedRevisionNumber) {
        // Cited revision is newer than accepted - it's pending/proposed
        errors.push({
          constructPublicId: citation.constructPublicId,
          revisionPublicId: citation.revisionPublicId,
          reason: 'Revision is not accepted (pending or rejected)',
        });
        continue;
      }

      // Cited revision is older than accepted - it's superseded (valid but flagged)
      validCitations.push({
        constructPublicId: citation.constructPublicId,
        revisionPublicId: citation.revisionPublicId,
        revisionNumber: citation.revisionNumber,
        displayId: `IN-${((construct as any).display_sequence as number).toString().padStart(4, '0')}`,
        isSuperseded: true,
      });
      continue;
    }

    // Revision is the currently accepted one
    validCitations.push({
      constructPublicId: citation.constructPublicId,
      revisionPublicId: citation.revisionPublicId,
      revisionNumber: citation.revisionNumber,
      displayId: `IN-${((construct as any).display_sequence as number).toString().padStart(4, '0')}`,
      isSuperseded: false,
    });
  }

  return {
    valid: errors.length === 0,
    validCitations,
    errors,
  };
}

/**
 * Check if readout is eligible for approval
 *
 * AUTHORIZATION: Requires project membership.
 */
export async function checkApprovalEligibility(
  readoutId: number,
  actorId: number,
  transaction?: Transaction,
): Promise<ApprovalEligibility> {
  // Resolve project and authorize
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId, transaction);
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  const errors: string[] = [];

  const readout = await DeskResearchReadout.findByPk(readoutId, {
    include: [{ model: DeskResearchReadoutDraft, as: 'draft' }],
    transaction,
  });

  if (!readout) {
    return { eligible: false, errors: ['Readout not found'] };
  }

  const draft = (readout as any).draft;
  const content: DraftContent = draft.content;
  const findingsChecked: string[] = draft.findings_checked;
  const implicationsReviewed: string[] = draft.implications_reviewed;

  // Check at least one finding
  const findings = content.findings || [];
  if (findings.length === 0) {
    errors.push('At least one finding is required');
  }

  // Check each finding has at least one citation
  for (const finding of findings) {
    if (!finding.citations || finding.citations.length === 0) {
      errors.push(`Finding "${finding.id}" must have at least one citation`);
    }
  }

  // Check all findings are checked
  const findingIds = findings.map((f) => f.id);
  const uncheckedFindings = findingIds.filter((id) => !findingsChecked.includes(id));
  if (uncheckedFindings.length > 0) {
    errors.push(`Findings not checked: ${uncheckedFindings.join(', ')}`);
  }

  // Check all implications are reviewed
  const implications = content.implications || [];
  const implicationIds = implications.map((i) => i.id);
  const unreviewedImplications = implicationIds.filter((id) => !implicationsReviewed.includes(id));
  if (unreviewedImplications.length > 0) {
    errors.push(`Implications not reviewed: ${unreviewedImplications.join(', ')}`);
  }

  // Check all implications link to existing findings
  const findingIdSet = new Set(findingIds);
  for (const impl of implications) {
    if (impl.basedOnFindings.length === 0) {
      errors.push(`Implication "${impl.id}" must link to at least one finding`);
    }
    for (const findingId of impl.basedOnFindings) {
      if (!findingIdSet.has(findingId)) {
        errors.push(`Implication "${impl.id}" references non-existent finding "${findingId}"`);
      }
    }
  }

  // Validate citations
  const citationResult = await validateCitations(
    (readout as any).project_id,
    content,
    transaction,
  );

  if (!citationResult.valid) {
    for (const error of citationResult.errors) {
      errors.push(`Citation error (${error.constructPublicId}): ${error.reason}`);
    }
  }

  // Check superseded citations have justifications
  const supersededCitations = citationResult.validCitations.filter((c) => c.isSuperseded);
  // Note: supersession justifications would need to be passed in; for now we flag without justification check
  // This will be enhanced when the UI supports supersession notes

  return {
    eligible: errors.length === 0,
    errors,
  };
}

/**
 * Approve readout with immutable snapshot
 *
 * AUTHORIZATION: Requires researcher role in the project.
 */
export async function approveReadout(input: ApproveReadoutInput): Promise<ApprovalDetail> {
  const { readoutId, expectedVersion, approvedByActorId, approvalNote, supersessionNotes } = input;

  // Resolve project and authorize BEFORE transaction
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId);
  await assertProjectResearcherByActor(approvedByActorId, projectId, organizationId);

  return sequelize.transaction(async (transaction) => {
    // Lock readout first, then fetch draft separately
    // (FOR UPDATE cannot be applied to nullable side of outer join)
    const readout = await DeskResearchReadout.findByPk(readoutId, {
      lock: true,
      transaction,
    });

    if (!readout) {
      throw new ReadoutNotFoundError();
    }

    const draft = await DeskResearchReadoutDraft.findOne({
      where: { readout_id: readoutId },
      lock: true,
      transaction,
    });

    if (!draft) {
      throw new ReadoutNotFoundError();
    }

    const currentVersion = (draft as any).content_version;

    // Check concurrency
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError(
        'Draft was modified since approval was initiated',
        currentVersion,
      );
    }

    // Check eligibility (actor already authorized above, passing for signature compliance)
    const eligibility = await checkApprovalEligibility(readoutId, approvedByActorId, transaction);
    if (!eligibility.eligible) {
      throw new ApprovalEligibilityError('Readout is not eligible for approval', eligibility.errors);
    }

    // Check for duplicate approval of same draft version
    const existingApproval = await DeskResearchReadoutApproval.findOne({
      where: {
        readout_id: readoutId,
        source_draft_content_version: currentVersion,
      },
      transaction,
    });

    if (existingApproval) {
      throw new ValidationError(`Draft version ${currentVersion} has already been approved`);
    }

    // Build evidence snapshot
    const draftContent = (draft as any).content;
    const citations = deduplicateCitations(extractCitations(draftContent));
    const evidenceSnapshot: EvidenceSnapshot = {
      cited_constructs: citations.map((c) => ({
        constructPublicId: c.constructPublicId,
        revisionPublicId: c.revisionPublicId,
        revisionNumber: c.revisionNumber,
      })),
    };

    // Allocate next approval number
    const maxApproval = await DeskResearchReadoutApproval.findOne({
      where: { readout_id: readoutId },
      order: [['approval_number', 'DESC']],
      attributes: ['approval_number'],
      transaction,
    });

    const nextApprovalNumber = maxApproval ? (maxApproval as any).approval_number + 1 : 1;

    // Create approval snapshot
    const approval = await DeskResearchReadoutApproval.create(
      {
        readout_id: readoutId,
        approval_number: nextApprovalNumber,
        source_draft_content_version: currentVersion,
        approved_by_actor_id: approvedByActorId,
        approval_note: approvalNote || null,
        content_snapshot: draftContent,
        findings_checked_snapshot: (draft as any).findings_checked,
        implications_reviewed_snapshot: (draft as any).implications_reviewed,
        evidence_snapshot: evidenceSnapshot,
        supersession_notes: supersessionNotes || null,
      } as any,
      { transaction },
    );

    // Update readout with approval state
    await (readout as any).update(
      {
        approved_at: new Date(),
        approved_version: nextApprovalNumber,
        out_of_date_since: null,
        out_of_date_reason: null,
      },
      { transaction },
    );

    return mapToApprovalDetail(approval);
  });
}

/**
 * Initiate AI generation (service contract only)
 *
 * AUTHORIZATION: Requires researcher role in the project.
 */
export async function initiateGeneration(
  input: InitiateGenerationInput,
): Promise<GenerationResult> {
  const { readoutId, evidenceSet, initiatedByActorId } = input;

  // Resolve project and authorize BEFORE transaction
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId);
  await assertProjectResearcherByActor(initiatedByActorId, projectId, organizationId);

  return sequelize.transaction(async (transaction) => {
    // Lock readout first, then fetch draft separately
    // (FOR UPDATE cannot be applied to nullable side of outer join)
    const readout = await DeskResearchReadout.findByPk(readoutId, {
      lock: true,
      transaction,
    });

    if (!readout) {
      throw new ReadoutNotFoundError();
    }

    const draft = await DeskResearchReadoutDraft.findOne({
      where: { readout_id: readoutId },
      lock: true,
      transaction,
    });

    if (!draft) {
      throw new ReadoutNotFoundError();
    }

    // Check for existing pending generation
    if ((readout as any).current_generation_request_id) {
      // Mark existing pending version as superseded
      await DeskResearchReadoutVersion.update(
        { generation_status: 'superseded' },
        {
          where: {
            readout_id: readoutId,
            generation_status: { [Op.in]: ['pending', 'generating'] },
          },
          transaction,
        },
      );
    }

    // Generate unique request ID
    const generationRequestId = randomUUID();
    const draftVersion = (draft as any).content_version;

    // Allocate next version number
    const maxVersion = await DeskResearchReadoutVersion.findOne({
      where: { readout_id: readoutId },
      order: [['version_number', 'DESC']],
      attributes: ['version_number'],
      transaction,
    });

    const nextVersionNumber = maxVersion ? (maxVersion as any).version_number + 1 : 1;

    // Create version record
    const version = await DeskResearchReadoutVersion.create(
      {
        readout_id: readoutId,
        version_number: nextVersionNumber,
        generation_request_id: generationRequestId,
        generation_status: 'pending',
        draft_content_version_at_start: draftVersion,
        evidence_set: evidenceSet,
      } as any,
      { transaction },
    );

    // Update readout with current generation request
    await (readout as any).update(
      { current_generation_request_id: generationRequestId },
      { transaction },
    );

    return {
      versionId: (version as any).id,
      generationRequestId,
      status: 'pending',
    };
  });
}

/**
 * Complete AI generation (service contract only)
 *
 * This preserves human edits: if the draft was modified since generation started,
 * the generated content is stored but not applied to the draft.
 *
 * AUTHORIZATION: NONE — this is called by trusted internal worker infrastructure,
 * not by user actors. The generation request was already authorized at initiate time.
 * Do NOT add actor-based authorization here.
 */
export async function completeGeneration(
  input: CompleteGenerationInput,
): Promise<{ applied: boolean; conflictDetected: boolean; version: any }> {
  const { readoutId, generationRequestId, content, status, error } = input;

  return sequelize.transaction(async (transaction) => {
    // Find version record
    const version = await DeskResearchReadoutVersion.findOne({
      where: {
        readout_id: readoutId,
        generation_request_id: generationRequestId,
      },
      lock: true,
      transaction,
    });

    if (!version) {
      throw new ValidationError('Generation request not found');
    }

    // Check not already completed
    if (['completed', 'failed', 'superseded'].includes((version as any).generation_status)) {
      throw new ValidationError(`Generation already finished with status: ${(version as any).generation_status}`);
    }

    // Get current draft
    const draft = await DeskResearchReadoutDraft.findOne({
      where: { readout_id: readoutId },
      transaction,
    });

    if (!draft) {
      throw new ReadoutNotFoundError('Draft not found');
    }

    const currentDraftVersion = (draft as any).content_version;
    const versionAtStart = (version as any).draft_content_version_at_start;
    const conflictDetected = currentDraftVersion !== versionAtStart;

    if (status === 'failed') {
      // Mark version as failed, preserve draft
      await (version as any).update(
        {
          generation_status: 'failed',
          generation_completed_at: new Date(),
          generation_error: error || 'Unknown error',
        },
        { transaction },
      );

      // Clear current generation request
      await DeskResearchReadout.update(
        { current_generation_request_id: null },
        { where: { id: readoutId }, transaction },
      );

      return { applied: false, conflictDetected, version };
    }

    // Success case
    if (conflictDetected) {
      // Human edits detected - store content but don't apply
      await (version as any).update(
        {
          generation_status: 'completed',
          generation_completed_at: new Date(),
          content,
        },
        { transaction },
      );

      // Clear current generation request
      await DeskResearchReadout.update(
        { current_generation_request_id: null },
        { where: { id: readoutId }, transaction },
      );

      return { applied: false, conflictDetected: true, version };
    }

    // No conflict - apply to draft
    await (draft as any).update(
      {
        content,
        content_version: currentDraftVersion + 1,
        last_edited_at: new Date(),
        findings_checked: [],
        implications_reviewed: [],
      },
      { transaction },
    );

    await (version as any).update(
      {
        generation_status: 'completed',
        generation_completed_at: new Date(),
        content,
      },
      { transaction },
    );

    // Clear current generation request
    await DeskResearchReadout.update(
      { current_generation_request_id: null },
      { where: { id: readoutId }, transaction },
    );

    return { applied: true, conflictDetected: false, version };
  });
}

/**
 * Check if approved readout is stale (cited evidence has changed)
 *
 * AUTHORIZATION: Requires project membership.
 */
export async function evaluateStaleness(
  readoutId: number,
  actorId: number,
  transaction?: Transaction,
): Promise<{
  isStale: boolean;
  reason: 'cited_insight_withdrawn' | 'newer_revision_accepted' | null;
  staleInsights: string[];
}> {
  // Resolve project and authorize
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId, transaction);
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  // Get latest approval
  const approval = await DeskResearchReadoutApproval.findOne({
    where: { readout_id: readoutId },
    order: [['approval_number', 'DESC']],
    transaction,
  });

  if (!approval) {
    return { isStale: false, reason: null, staleInsights: [] };
  }

  const evidenceSnapshot: EvidenceSnapshot = (approval as any).evidence_snapshot;
  const staleInsights: string[] = [];
  let reason: 'cited_insight_withdrawn' | 'newer_revision_accepted' | null = null;

  // Check each cited construct
  for (const cited of evidenceSnapshot.cited_constructs) {
    const construct = await EvidenceConstruct.findOne({
      where: { public_id: cited.constructPublicId },
      attributes: ['id', 'withdrawn_at', 'accepted_revision_id'],
      transaction,
    });

    if (!construct) continue;

    // Check if withdrawn
    if ((construct as any).withdrawn_at) {
      staleInsights.push(cited.constructPublicId);
      reason = 'cited_insight_withdrawn';
      continue;
    }

    // Check if a newer revision was accepted
    const citedRevision = await EvidenceConstructRevision.findOne({
      where: { public_id: cited.revisionPublicId },
      attributes: ['id', 'revision_number'],
      transaction,
    });

    if (!citedRevision) continue;

    if ((construct as any).accepted_revision_id !== (citedRevision as any).id) {
      // A different revision is now accepted
      staleInsights.push(cited.constructPublicId);
      if (!reason) reason = 'newer_revision_accepted';
    }
  }

  return {
    isStale: staleInsights.length > 0,
    reason,
    staleInsights,
  };
}

/**
 * Get approval history for a readout
 *
 * AUTHORIZATION: Requires project membership.
 */
export async function getApprovalHistory(
  readoutId: number,
  actorId: number,
  transaction?: Transaction,
): Promise<ApprovalDetail[]> {
  // Resolve project and authorize
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId, transaction);
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  const approvals = await DeskResearchReadoutApproval.findAll({
    where: { readout_id: readoutId },
    order: [['approval_number', 'DESC']],
    transaction,
  });

  return approvals.map(mapToApprovalDetail);
}

/**
 * Get generation history for a readout
 *
 * AUTHORIZATION: Requires project membership.
 */
export async function getGenerationHistory(
  readoutId: number,
  actorId: number,
  transaction?: Transaction,
): Promise<any[]> {
  // Resolve project and authorize
  const { projectId, organizationId } = await resolveProjectFromReadout(readoutId, transaction);
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  const versions = await DeskResearchReadoutVersion.findAll({
    where: { readout_id: readoutId },
    order: [['version_number', 'DESC']],
    transaction,
  });

  return versions.map((v: any) => ({
    id: v.id,
    versionNumber: v.version_number,
    generationRequestId: v.generation_request_id,
    generationStatus: v.generation_status,
    generationStartedAt: v.generation_started_at,
    generationCompletedAt: v.generation_completed_at,
    generationError: v.generation_error,
    draftContentVersionAtStart: v.draft_content_version_at_start,
    evidenceSet: v.evidence_set,
    hasContent: v.content !== null,
    createdAt: v.created_at,
  }));
}

// ─── Mapping Functions ────────────────────────────────────────────────────────

function mapToReadoutSummary(readout: any): ReadoutSummary {
  return {
    id: readout.id,
    publicId: readout.public_id,
    displayId: readout.display_id,
    studyId: readout.study_id,
    projectId: readout.project_id,
    title: readout.title,
    question: readout.question,
    approvedAt: readout.approved_at,
    approvedVersion: readout.approved_version,
    outOfDateSince: readout.out_of_date_since,
    outOfDateReason: readout.out_of_date_reason,
    currentGenerationRequestId: readout.current_generation_request_id,
    createdAt: readout.created_at,
    createdByActorId: readout.created_by_actor_id,
  };
}

function mapToReadoutDetail(
  readout: any,
  draft: any,
  latestApproval: any | null,
): ReadoutDetail {
  return {
    ...mapToReadoutSummary(readout),
    draft: {
      content: draft.content,
      findingsChecked: draft.findings_checked,
      implicationsReviewed: draft.implications_reviewed,
      contentVersion: draft.content_version,
      lastEditedAt: draft.last_edited_at,
      lastEditedByActorId: draft.last_edited_by_actor_id,
    },
    latestApproval: latestApproval ? mapToApprovalDetail(latestApproval) : null,
  };
}

function mapToApprovalDetail(approval: any): ApprovalDetail {
  return {
    id: approval.id,
    approvalNumber: approval.approval_number,
    sourceDraftContentVersion: approval.source_draft_content_version,
    approvedAt: approval.approved_at,
    approvedByActorId: approval.approved_by_actor_id,
    approvalNote: approval.approval_note,
    contentSnapshot: approval.content_snapshot,
    findingsCheckedSnapshot: approval.findings_checked_snapshot,
    implicationsReviewedSnapshot: approval.implications_reviewed_snapshot,
    evidenceSnapshot: approval.evidence_snapshot,
    supersessionNotes: approval.supersession_notes,
  };
}

// ─── Evidence Eligibility ─────────────────────────────────────────────────────

/**
 * Eligible insight source attribution (null-safe)
 */
export interface EligibleInsightSource {
  sourceId: number;
  sourcePublicId: string;
  sourceType: string;
  label: string;
}

/**
 * Eligible insight with accepted revision for citation
 */
export interface EligibleInsight {
  constructPublicId: string;
  displayId: string;
  wording: string;
  acceptedRevision: {
    revisionPublicId: string;
    revisionNumber: number;
    acceptedAt: Date;
  };
  source: EligibleInsightSource | null;
}

/**
 * Get eligible evidence (accepted, non-withdrawn desk insights) for a project.
 *
 * Per DR-6b D2: Eligible evidence comes from accepted insights in the same project.
 * Only returns insights where:
 * - construct_type = 'desk_insight'
 * - withdrawn_at IS NULL
 * - accepted_revision_id IS NOT NULL
 *
 * Source attribution is null-safe — returns null when no evidence source exists.
 */
export async function getEligibleEvidence(
  projectId: number,
  actorId: number,
  options?: { limit?: number; offset?: number },
): Promise<{ insights: EligibleInsight[]; total: number }> {
  // Resolve organization from project for authorization
  const organizationId = await resolveOrganizationFromProject(projectId);

  // Verify actor has project access
  await assertProjectAccessByActor(actorId, projectId, organizationId);

  const limit = Math.min(options?.limit ?? 50, 100);
  const offset = options?.offset ?? 0;

  // Query accepted, non-withdrawn desk insights
  const { count, rows: constructs } = await EvidenceConstruct.findAndCountAll({
    where: {
      project_id: projectId,
      construct_type: 'desk_insight',
      withdrawn_at: null,
      accepted_revision_id: { [Op.ne]: null },
    },
    order: [['display_sequence', 'ASC']],
    limit,
    offset,
  });

  if (constructs.length === 0) {
    return { insights: [], total: count };
  }

  // Batch load accepted revisions
  const acceptedRevisionIds = constructs.map((c: any) => c.accepted_revision_id);
  const revisions = await EvidenceConstructRevision.findAll({
    where: { id: { [Op.in]: acceptedRevisionIds } },
  });
  const revisionMap = new Map(revisions.map((r: any) => [r.id, r]));

  // Collect evidence source IDs from revision snapshots
  const sourceIds = new Set<number>();
  for (const revision of revisions) {
    const snapshot = (revision as any).evidence_snapshot as Array<{ evidenceSourceId?: number }> | null;
    if (Array.isArray(snapshot)) {
      for (const ref of snapshot) {
        if (ref.evidenceSourceId) {
          sourceIds.add(ref.evidenceSourceId);
        }
      }
    }
  }

  // Batch load evidence sources (if any)
  const EvidenceSource = sequelize.models.EvidenceSource;
  let sourceMap = new Map<number, any>();
  if (sourceIds.size > 0 && EvidenceSource) {
    const sources = await EvidenceSource.findAll({
      where: { id: { [Op.in]: [...sourceIds] } },
      attributes: ['id', 'public_id', 'source_type', 'label'],
    });
    sourceMap = new Map(sources.map((s: any) => [s.id, s]));
  }

  // Map to output format
  const insights: EligibleInsight[] = [];
  for (const construct of constructs) {
    const c = construct as any;
    const revision = revisionMap.get(c.accepted_revision_id);
    if (!revision) continue;

    const r = revision as any;
    const displayId = formatInsightDisplayId(c.display_sequence);

    // Extract first source from evidence snapshot (null-safe)
    let source: EligibleInsightSource | null = null;
    const snapshot = r.evidence_snapshot as Array<{ evidenceSourceId?: number }> | null;
    if (Array.isArray(snapshot) && snapshot.length > 0 && snapshot[0].evidenceSourceId) {
      const sourceData = sourceMap.get(snapshot[0].evidenceSourceId);
      if (sourceData) {
        source = {
          sourceId: sourceData.id,
          sourcePublicId: sourceData.public_id,
          sourceType: sourceData.source_type,
          label: sourceData.label,
        };
      }
    }

    insights.push({
      constructPublicId: c.public_id,
      displayId,
      wording: r.content?.wording || '',
      acceptedRevision: {
        revisionPublicId: r.public_id,
        revisionNumber: r.revision_number,
        acceptedAt: r.reviewed_at || r.created_at,
      },
      source,
    });
  }

  return { insights, total: count };
}

/**
 * Format insight display ID from sequence number: IN-0001
 */
function formatInsightDisplayId(sequence: number): string {
  return `IN-${String(sequence).padStart(4, '0')}`;
}
