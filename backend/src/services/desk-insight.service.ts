/**
 * Desk Insight Service — DR-1
 *
 * Per SPEC-2 design authority:
 * - Insights belong to the project, not individual studies (D1)
 * - Researchers and above may self-accept (D2)
 * - Save and Accept are separate actions (D3)
 * - Withdrawal reason required (D6)
 * - Display IDs use IN-0001 format (D7)
 * - Protect sources cited by accepted revisions (D9)
 *
 * This service handles:
 * - Manual insight creation with source attribution
 * - Revision management (create, accept, reject)
 * - Withdrawal with required reason
 * - Optimistic concurrency control
 * - Project-unique display ID allocation
 * - Synthesis eligibility queries
 */

import sequelize from '../database';
import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';
import type {
  EvidenceReference,
  RevisionContent,
  RevisionOrigin,
} from '../database/models/evidence_construct_revision';
import type { ReviewAction } from '../database/models/evidence_construct_review';

const { EvidenceConstruct, EvidenceConstructRevision, EvidenceConstructReview, EvidenceSource, EvidenceRelationship } =
  sequelize.models;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateInsightInput {
  projectId: number;
  wording: string;
  evidenceReferences: EvidenceReference[];
  createdBy: string;
  origin?: RevisionOrigin;
  discoveryRunId?: number;
  /** DR-2: Idempotency key for AI-extracted insights. Format: {run_id}:{variable_key}:{item_id} */
  ingestionKey?: string;
}

export interface CreateRevisionInput {
  constructId: number;
  wording: string;
  evidenceReferences: EvidenceReference[];
  createdBy: string;
  expectedVersion: number;
}

export interface ReviewInput {
  constructId: number;
  revisionId?: number;
  action: ReviewAction;
  reviewedBy: string;
  comment?: string;
  expectedVersion: number;
}

// Simplified input types for specific review actions
export interface AcceptRevisionInput {
  constructId: number;
  revisionId: number;
  reviewedBy: string;
  comment?: string;
  expectedVersion: number;
}

export interface RejectRevisionInput {
  constructId: number;
  revisionId: number;
  reviewedBy: string;
  comment?: string;
  expectedVersion: number;
}

export interface WithdrawInsightInput {
  constructId: number;
  reviewedBy: string;
  comment: string; // Required per D6
  expectedVersion: number;
}

export interface InsightSummary {
  id: number;
  publicId: string;
  displayId: string;
  projectId: number;
  wording: string;
  status: 'proposed' | 'accepted' | 'accepted_with_pending' | 'rejected' | 'withdrawn';
  latestRevisionNumber: number;
  acceptedRevisionNumber: number | null;
  pendingRevisionNumber: number | null;
  origin: RevisionOrigin;
  needsReview: boolean;
  createdBy: string;
  createdAt: Date;
  withdrawnAt: Date | null;
  version: number;
}

export interface InsightDetail extends InsightSummary {
  latestRevision: RevisionDetail;
  acceptedRevision: RevisionDetail | null;
  revisionCount: number;
}

export interface RevisionDetail {
  id: number;
  publicId: string;
  revisionNumber: number;
  content: RevisionContent;
  evidenceSnapshot: EvidenceReference[];
  origin: RevisionOrigin;
  createdBy: string;
  createdAt: Date;
  isAccepted: boolean;
  isLatest: boolean;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class InsightNotFoundError extends Error {
  constructor(message = 'Insight not found') {
    super(message);
    this.name = 'InsightNotFoundError';
  }
}

export class RevisionNotFoundError extends Error {
  constructor(message = 'Revision not found') {
    super(message);
    this.name = 'RevisionNotFoundError';
  }
}

export class ConcurrencyError extends Error {
  constructor(
    message = 'Concurrent modification detected',
    public currentVersion: number,
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

export class ProjectAccessError extends Error {
  constructor(message = 'Evidence source belongs to a different project') {
    super(message);
    this.name = 'ProjectAccessError';
  }
}

export class DuplicateIngestionError extends Error {
  constructor(
    public readonly ingestionKey: string,
    public readonly existingConstructId: number,
    message = 'Insight with this ingestion key already exists',
  ) {
    super(message);
    this.name = 'DuplicateIngestionError';
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Format display ID from sequence number: IN-0001
 */
function formatDisplayId(sequence: number): string {
  return `IN-${String(sequence).padStart(4, '0')}`;
}

/**
 * Allocate next display sequence for a project (concurrency-safe)
 */
async function allocateDisplaySequence(projectId: number, transaction: Transaction): Promise<number> {
  // Lock the project row to prevent concurrent display_sequence allocation.
  // This ensures atomicity without using FOR UPDATE on aggregates (which Postgres disallows).
  await sequelize.query(
    `SELECT id FROM projects WHERE id = :projectId FOR UPDATE`,
    {
      replacements: { projectId },
      transaction,
      type: 'SELECT' as any,
    },
  );

  // Now safely compute the next sequence number
  const results = await sequelize.query<{ next_seq: string }>(
    `
    SELECT COALESCE(MAX(display_sequence), 0) + 1 as next_seq
    FROM evidence_constructs
    WHERE project_id = :projectId
    AND construct_type = 'desk_insight'
    `,
    {
      replacements: { projectId },
      transaction,
      type: 'SELECT' as any,
    },
  );

  const rows = results as unknown as Array<{ next_seq: string }>;
  return parseInt(rows[0]?.next_seq ?? '1', 10);
}

/**
 * Validate that all evidence references belong to the same project
 */
async function validateEvidenceOwnership(
  projectId: number,
  evidenceReferences: EvidenceReference[],
  transaction?: Transaction,
): Promise<void> {
  if (evidenceReferences.length === 0) {
    throw new ValidationError('At least one evidence reference is required');
  }

  const sourceIds = evidenceReferences.map((ref) => ref.evidenceSourceId);
  const sources = await EvidenceSource.findAll({
    where: { id: sourceIds },
    attributes: ['id', 'project_id'],
    transaction,
  });

  if (sources.length !== sourceIds.length) {
    throw new ValidationError('One or more evidence sources not found');
  }

  const wrongProject = sources.find((s: any) => s.project_id !== projectId);
  if (wrongProject) {
    throw new ProjectAccessError();
  }
}

/**
 * Validate evidence locators don't fabricate precision
 */
function validateEvidenceLocators(evidenceReferences: EvidenceReference[]): void {
  for (const ref of evidenceReferences) {
    const { locator } = ref;

    // Source-level references must not have specific locators
    if (locator.sourceLevel) {
      if (locator.page || locator.section || locator.excerpt) {
        throw new ValidationError(
          'Source-level reference cannot have page, section, or excerpt. Use specific locators or source-level, not both.',
        );
      }
    }

    // If validation is "verified", content hash should be present
    if (ref.validation === 'verified' && !ref.capturedContentHash && locator.excerpt) {
      throw new ValidationError(
        'Verified excerpt must include capturedContentHash for verification',
      );
    }
  }
}

/**
 * Derive insight status from revision state
 *
 * The status derivation uses both revision pointers and the EvidenceConstruct.status field.
 * When a revision is rejected, the construct's status is set to 'rejected' which we use
 * to determine if the latest revision is pending or was rejected.
 */
function deriveInsightStatus(construct: any): InsightSummary['status'] {
  if (construct.withdrawn_at) {
    return 'withdrawn';
  }

  if (!construct.accepted_revision_id) {
    // No accepted revision yet
    if (construct.status === 'rejected') {
      return 'rejected';
    }
    return 'proposed';
  }

  // Has accepted revision
  if (construct.accepted_revision_id === construct.latest_revision_id) {
    return 'accepted';
  }

  // Latest differs from accepted - check if latest was rejected
  // When we reject a revision, we set construct.status = 'rejected'
  // If status is 'rejected' but we have an accepted revision, the latest was rejected
  // and the insight is still in 'accepted' state overall
  if (construct.status === 'rejected') {
    return 'accepted';
  }

  // Accepted but latest is different and not rejected (pending revision)
  return 'accepted_with_pending';
}

/**
 * Check if insight needs review (has pending proposed revision)
 */
function needsReview(construct: any): boolean {
  if (construct.withdrawn_at) {
    return false;
  }

  // If no accepted revision, the latest revision needs review
  if (!construct.accepted_revision_id) {
    return construct.status !== 'rejected';
  }

  // If accepted != latest, the latest needs review
  return construct.accepted_revision_id !== construct.latest_revision_id;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new desk insight with initial revision
 */
export async function createInsight(input: CreateInsightInput): Promise<InsightDetail> {
  const { projectId, wording, evidenceReferences, createdBy, origin = 'researcher', discoveryRunId, ingestionKey } = input;

  // Validate
  if (!wording || wording.trim().length === 0) {
    throw new ValidationError('Insight wording is required');
  }
  validateEvidenceLocators(evidenceReferences);

  return sequelize.transaction(async (transaction) => {
    // DR-2: Check for duplicate ingestion key before creating
    if (ingestionKey) {
      const existing = await EvidenceConstruct.findOne({
        where: {
          project_id: projectId,
          ingestion_key: ingestionKey,
        },
        attributes: ['id'],
        transaction,
      });
      if (existing) {
        throw new DuplicateIngestionError(ingestionKey, (existing as any).id);
      }
    }

    // Validate evidence ownership within transaction
    await validateEvidenceOwnership(projectId, evidenceReferences, transaction);

    // Allocate display sequence
    const displaySequence = await allocateDisplaySequence(projectId, transaction);

    // Create construct
    const construct = await EvidenceConstruct.create(
      {
        project_id: projectId,
        study_id: null, // Project-scoped
        construct_type: 'desk_insight',
        label: wording.substring(0, 500),
        payload: { wording },
        derivation_type: origin === 'ai' ? 'model' : 'human',
        status: 'candidate',
        created_by: createdBy,
        display_sequence: displaySequence,
        version: 1,
        ingestion_key: ingestionKey ?? null,
      },
      { transaction },
    );

    // Create initial revision
    const revision = await EvidenceConstructRevision.create(
      {
        construct_id: (construct as any).id,
        revision_number: 1,
        content: { wording },
        evidence_snapshot: evidenceReferences,
        origin,
        discovery_run_id: discoveryRunId ?? null,
        created_by: createdBy,
      },
      { transaction },
    );

    // Update construct with latest_revision_id
    await construct.update(
      { latest_revision_id: (revision as any).id },
      { transaction },
    );

    // Create EvidenceRelationship lineage for each evidence reference
    for (const ref of evidenceReferences) {
      await EvidenceRelationship.create(
        {
          project_id: projectId,
          from_source_id: ref.evidenceSourceId,
          from_construct_id: null,
          to_source_id: null,
          to_construct_id: (construct as any).id,
          relationship_type: 'DERIVED_FROM',
          provenance: {
            revision_id: (revision as any).id,
            locator: ref.locator,
            validation: ref.validation,
          },
        },
        { transaction },
      );
    }

    // Reload with associations
    const reloaded = await EvidenceConstruct.findByPk((construct as any).id, {
      include: [
        { model: EvidenceConstructRevision, as: 'latestRevision' },
        { model: EvidenceConstructRevision, as: 'acceptedRevision' },
        { model: EvidenceConstructRevision, as: 'revisions' },
      ],
      transaction,
    });

    return toInsightDetail(reloaded);
  });
}

/**
 * Create a new proposed revision for an existing insight
 *
 * Note: Save is separate from Accept (D3)
 */
export async function createRevision(input: CreateRevisionInput): Promise<InsightDetail> {
  const { constructId, wording, evidenceReferences, createdBy, expectedVersion } = input;

  // Validate
  if (!wording || wording.trim().length === 0) {
    throw new ValidationError('Insight wording is required');
  }
  validateEvidenceLocators(evidenceReferences);

  return sequelize.transaction(async (transaction) => {
    // Lock the construct row
    const construct = await EvidenceConstruct.findByPk(constructId, {
      lock: true,
      transaction,
    });

    if (!construct || (construct as any).construct_type !== 'desk_insight') {
      throw new InsightNotFoundError();
    }

    // Check version for concurrency
    if ((construct as any).version !== expectedVersion) {
      throw new ConcurrencyError('Insight was modified by another user', (construct as any).version);
    }

    // Cannot edit withdrawn insights
    if ((construct as any).withdrawn_at) {
      throw new ValidationError('Cannot edit withdrawn insight');
    }

    // Validate evidence ownership
    await validateEvidenceOwnership((construct as any).project_id, evidenceReferences, transaction);

    // Get next revision number
    const latestRevision = await EvidenceConstructRevision.findOne({
      where: { construct_id: constructId },
      order: [['revision_number', 'DESC']],
      transaction,
    });
    const nextRevisionNumber = latestRevision ? (latestRevision as any).revision_number + 1 : 1;

    // Create new revision
    const revision = await EvidenceConstructRevision.create(
      {
        construct_id: constructId,
        revision_number: nextRevisionNumber,
        content: { wording },
        evidence_snapshot: evidenceReferences,
        origin: 'researcher',
        created_by: createdBy,
      },
      { transaction },
    );

    // Update construct - reset status to 'candidate' for new pending revision
    await construct.update(
      {
        latest_revision_id: (revision as any).id,
        label: wording.substring(0, 500),
        payload: { wording },
        status: 'candidate', // Reset from 'rejected' if previous was rejected
        version: (construct as any).version + 1,
      },
      { transaction },
    );

    // Create EvidenceRelationship lineage for each evidence reference
    const constructProjectId = (construct as any).project_id;
    for (const ref of evidenceReferences) {
      await EvidenceRelationship.create(
        {
          project_id: constructProjectId,
          from_source_id: ref.evidenceSourceId,
          from_construct_id: null,
          to_source_id: null,
          to_construct_id: (construct as any).id,
          relationship_type: 'DERIVED_FROM',
          provenance: {
            revision_id: (revision as any).id,
            locator: ref.locator,
            validation: ref.validation,
          },
        },
        { transaction },
      );
    }

    // Reload with associations
    const reloaded = await EvidenceConstruct.findByPk(constructId, {
      include: [
        { model: EvidenceConstructRevision, as: 'latestRevision' },
        { model: EvidenceConstructRevision, as: 'acceptedRevision' },
        { model: EvidenceConstructRevision, as: 'revisions' },
      ],
      transaction,
    });

    return toInsightDetail(reloaded);
  });
}

/**
 * Accept a revision
 */
export async function acceptRevision(input: AcceptRevisionInput): Promise<InsightDetail> {
  const { constructId, revisionId, reviewedBy, comment, expectedVersion } = input;

  return sequelize.transaction(async (transaction) => {
    // Lock the construct row
    const construct = await EvidenceConstruct.findByPk(constructId, {
      lock: true,
      transaction,
    });

    if (!construct || (construct as any).construct_type !== 'desk_insight') {
      throw new InsightNotFoundError();
    }

    // Check version for concurrency
    if ((construct as any).version !== expectedVersion) {
      throw new ConcurrencyError('Insight was modified by another user', (construct as any).version);
    }

    // Cannot accept on withdrawn insights
    if ((construct as any).withdrawn_at) {
      throw new ValidationError('Cannot accept revision on withdrawn insight');
    }

    // Verify revision exists and belongs to this construct
    const revision = await EvidenceConstructRevision.findByPk(revisionId, { transaction });
    if (!revision || (revision as any).construct_id !== constructId) {
      throw new RevisionNotFoundError();
    }

    // Verify revision has evidence
    const evidenceSnapshot = (revision as any).evidence_snapshot as EvidenceReference[];
    if (!evidenceSnapshot || evidenceSnapshot.length === 0) {
      throw new ValidationError('Cannot accept revision without evidence references');
    }

    // Create review record
    await EvidenceConstructReview.create(
      {
        construct_id: constructId,
        revision_id: revisionId,
        action: 'accept',
        reviewed_by: reviewedBy,
        comment: comment ?? null,
        expected_version: expectedVersion,
      },
      { transaction },
    );

    // Update construct
    await construct.update(
      {
        accepted_revision_id: revisionId,
        status: 'accepted',
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        version: (construct as any).version + 1,
      },
      { transaction },
    );

    // Reload with associations
    const reloaded = await EvidenceConstruct.findByPk(constructId, {
      include: [
        { model: EvidenceConstructRevision, as: 'latestRevision' },
        { model: EvidenceConstructRevision, as: 'acceptedRevision' },
        { model: EvidenceConstructRevision, as: 'revisions' },
      ],
      transaction,
    });

    return toInsightDetail(reloaded);
  });
}

/**
 * Reject a revision
 */
export async function rejectRevision(input: RejectRevisionInput): Promise<InsightDetail> {
  const { constructId, revisionId, reviewedBy, comment, expectedVersion } = input;

  return sequelize.transaction(async (transaction) => {
    // Lock the construct row
    const construct = await EvidenceConstruct.findByPk(constructId, {
      lock: true,
      transaction,
    });

    if (!construct || (construct as any).construct_type !== 'desk_insight') {
      throw new InsightNotFoundError();
    }

    // Check version for concurrency
    if ((construct as any).version !== expectedVersion) {
      throw new ConcurrencyError('Insight was modified by another user', (construct as any).version);
    }

    // Cannot reject on withdrawn insights
    if ((construct as any).withdrawn_at) {
      throw new ValidationError('Cannot reject revision on withdrawn insight');
    }

    // Verify revision exists and belongs to this construct
    const revision = await EvidenceConstructRevision.findByPk(revisionId, { transaction });
    if (!revision || (revision as any).construct_id !== constructId) {
      throw new RevisionNotFoundError();
    }

    // Create review record
    await EvidenceConstructReview.create(
      {
        construct_id: constructId,
        revision_id: revisionId,
        action: 'reject',
        reviewed_by: reviewedBy,
        comment: comment ?? null,
        expected_version: expectedVersion,
      },
      { transaction },
    );

    // Update construct status when latest revision is rejected
    // This helps deriveInsightStatus distinguish rejected latest from pending latest
    const isLatest = (revision as any).id === (construct as any).latest_revision_id;

    if (isLatest) {
      await construct.update(
        {
          status: 'rejected',
          reviewed_by: reviewedBy,
          reviewed_at: new Date(),
          version: (construct as any).version + 1,
        },
        { transaction },
      );
    } else {
      // Rejecting a non-latest revision, just increment version
      await construct.update(
        { version: (construct as any).version + 1 },
        { transaction },
      );
    }

    // Reload with associations
    const reloaded = await EvidenceConstruct.findByPk(constructId, {
      include: [
        { model: EvidenceConstructRevision, as: 'latestRevision' },
        { model: EvidenceConstructRevision, as: 'acceptedRevision' },
        { model: EvidenceConstructRevision, as: 'revisions' },
      ],
      transaction,
    });

    return toInsightDetail(reloaded);
  });
}

/**
 * Withdraw an insight (requires reason per D6)
 */
export async function withdrawInsight(input: WithdrawInsightInput): Promise<InsightDetail> {
  const { constructId, reviewedBy, comment, expectedVersion } = input;

  // D6: Withdrawal reason required (already enforced by type, but validate anyway)
  if (!comment || comment.trim().length === 0) {
    throw new ValidationError('Withdrawal reason is required');
  }

  return sequelize.transaction(async (transaction) => {
    // Lock the construct row
    const construct = await EvidenceConstruct.findByPk(constructId, {
      lock: true,
      transaction,
    });

    if (!construct || (construct as any).construct_type !== 'desk_insight') {
      throw new InsightNotFoundError();
    }

    // Check version for concurrency
    if ((construct as any).version !== expectedVersion) {
      throw new ConcurrencyError('Insight was modified by another user', (construct as any).version);
    }

    // Cannot withdraw already withdrawn insights
    if ((construct as any).withdrawn_at) {
      throw new ValidationError('Insight is already withdrawn');
    }

    // Must have an accepted revision to withdraw (per design spec)
    if (!(construct as any).accepted_revision_id) {
      throw new ValidationError('Cannot withdraw insight that was never accepted');
    }

    // Create review record
    await EvidenceConstructReview.create(
      {
        construct_id: constructId,
        revision_id: null, // Withdraw applies to construct, not revision
        action: 'withdraw',
        reviewed_by: reviewedBy,
        comment,
        expected_version: expectedVersion,
      },
      { transaction },
    );

    // Update construct
    await construct.update(
      {
        withdrawn_at: new Date(),
        withdrawn_by: reviewedBy,
        withdrawal_reason: comment,
        version: (construct as any).version + 1,
      },
      { transaction },
    );

    // Reload with associations
    const reloaded = await EvidenceConstruct.findByPk(constructId, {
      include: [
        { model: EvidenceConstructRevision, as: 'latestRevision' },
        { model: EvidenceConstructRevision, as: 'acceptedRevision' },
        { model: EvidenceConstructRevision, as: 'revisions' },
      ],
      transaction,
    });

    return toInsightDetail(reloaded);
  });
}

/**
 * List insights for a project
 */
export async function listInsights(
  projectId: number,
  options: {
    status?: 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'all';
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ insights: InsightSummary[]; total: number; needsReviewCount: number }> {
  const { status = 'all', limit = 50, offset = 0 } = options;

  const where: any = {
    project_id: projectId,
    construct_type: 'desk_insight',
  };

  // Filter by derived status
  if (status === 'withdrawn') {
    where.withdrawn_at = { [Op.ne]: null };
  } else if (status !== 'all') {
    where.withdrawn_at = null;
    // Additional filtering done post-query based on derived status
  }

  const { rows, count } = await EvidenceConstruct.findAndCountAll({
    where,
    include: [
      { model: EvidenceConstructRevision, as: 'latestRevision' },
      { model: EvidenceConstructRevision, as: 'acceptedRevision' },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  // Calculate needs review count
  const needsReviewCount = rows.filter((c: any) => needsReview(c)).length;

  // Filter by derived status if needed
  let filteredRows = rows;
  if (status !== 'all' && status !== 'withdrawn') {
    filteredRows = rows.filter((c: any) => {
      const derivedStatus = deriveInsightStatus(c);
      if (status === 'proposed') {
        return derivedStatus === 'proposed';
      }
      if (status === 'accepted') {
        return derivedStatus === 'accepted' || derivedStatus === 'accepted_with_pending';
      }
      if (status === 'rejected') {
        return derivedStatus === 'rejected';
      }
      return true;
    });
  }

  return {
    insights: filteredRows.map(toInsightSummary),
    total: count,
    needsReviewCount,
  };
}

/**
 * Get insight detail by ID
 */
export async function getInsightById(constructId: number): Promise<InsightDetail | null> {
  const construct = await EvidenceConstruct.findOne({
    where: {
      id: constructId,
      construct_type: 'desk_insight',
    },
    include: [
      { model: EvidenceConstructRevision, as: 'latestRevision' },
      { model: EvidenceConstructRevision, as: 'acceptedRevision' },
      { model: EvidenceConstructRevision, as: 'revisions', order: [['revision_number', 'DESC']] },
    ],
  });

  if (!construct) {
    return null;
  }

  return toInsightDetail(construct);
}

/**
 * Get insight detail by public ID
 */
export async function getInsightByPublicId(publicId: string): Promise<InsightDetail | null> {
  const construct = await EvidenceConstruct.findOne({
    where: {
      public_id: publicId,
      construct_type: 'desk_insight',
    },
    include: [
      { model: EvidenceConstructRevision, as: 'latestRevision' },
      { model: EvidenceConstructRevision, as: 'acceptedRevision' },
      { model: EvidenceConstructRevision, as: 'revisions', order: [['revision_number', 'DESC']] },
    ],
  });

  if (!construct) {
    return null;
  }

  return toInsightDetail(construct);
}

/**
 * Get revision history for an insight
 */
export async function getRevisionHistory(constructId: number): Promise<RevisionDetail[]> {
  const construct = await EvidenceConstruct.findByPk(constructId, {
    attributes: ['id', 'latest_revision_id', 'accepted_revision_id'],
  });

  if (!construct) {
    throw new InsightNotFoundError();
  }

  const revisions = await EvidenceConstructRevision.findAll({
    where: { construct_id: constructId },
    order: [['revision_number', 'DESC']],
  });

  return revisions.map((r: any) =>
    toRevisionDetail(r, (construct as any).accepted_revision_id, (construct as any).latest_revision_id),
  );
}

/**
 * Get review history for an insight
 */
export async function getReviewHistory(
  constructId: number,
): Promise<Array<{ action: ReviewAction; reviewedBy: string; reviewedAt: Date; comment: string | null; revisionNumber: number | null }>> {
  const reviews = await EvidenceConstructReview.findAll({
    where: { construct_id: constructId },
    include: [{ model: EvidenceConstructRevision, as: 'revision', attributes: ['revision_number'] }],
    order: [['reviewed_at', 'DESC']],
  });

  return reviews.map((r: any) => ({
    action: r.action,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    comment: r.comment,
    revisionNumber: r.revision?.revision_number ?? null,
  }));
}

/**
 * Get synthesis-eligible accepted revisions for a project
 */
export async function getSynthesisEligibleInsights(projectId: number): Promise<InsightSummary[]> {
  const constructs = await EvidenceConstruct.findAll({
    where: {
      project_id: projectId,
      construct_type: 'desk_insight',
      accepted_revision_id: { [Op.ne]: null },
      withdrawn_at: null,
    },
    include: [
      { model: EvidenceConstructRevision, as: 'latestRevision' },
      { model: EvidenceConstructRevision, as: 'acceptedRevision' },
    ],
    order: [['display_sequence', 'ASC']],
  });

  return constructs.map(toInsightSummary);
}

/**
 * Count insights needing review for a project (for rail badge)
 */
export async function countInsightsNeedingReview(projectId: number): Promise<number> {
  const constructs = await EvidenceConstruct.findAll({
    where: {
      project_id: projectId,
      construct_type: 'desk_insight',
      withdrawn_at: null,
    },
    attributes: ['id', 'accepted_revision_id', 'latest_revision_id', 'status'],
  });

  return constructs.filter((c: any) => needsReview(c)).length;
}

/**
 * DR-2: Find insight by ingestion key for idempotency checks
 */
export async function getInsightByIngestionKey(
  projectId: number,
  ingestionKey: string,
): Promise<InsightDetail | null> {
  const construct = await EvidenceConstruct.findOne({
    where: {
      project_id: projectId,
      construct_type: 'desk_insight',
      ingestion_key: ingestionKey,
    },
    include: [
      { model: EvidenceConstructRevision, as: 'latestRevision' },
      { model: EvidenceConstructRevision, as: 'acceptedRevision' },
      { model: EvidenceConstructRevision, as: 'revisions', order: [['revision_number', 'DESC']] },
    ],
  });

  if (!construct) {
    return null;
  }

  return toInsightDetail(construct);
}

/**
 * DR-2: Create insight if not exists, skip if already ingested
 *
 * Returns { created: true, insight } if new insight was created
 * Returns { created: false, insight } if insight already exists with this ingestion key
 */
export async function createInsightIdempotent(
  input: CreateInsightInput,
): Promise<{ created: boolean; insight: InsightDetail }> {
  const { projectId, ingestionKey } = input;

  if (!ingestionKey) {
    // No ingestion key = always create (non-idempotent path)
    const insight = await createInsight(input);
    return { created: true, insight };
  }

  // Check for existing
  const existing = await getInsightByIngestionKey(projectId, ingestionKey);
  if (existing) {
    return { created: false, insight: existing };
  }

  // Create new - handle potential race condition
  try {
    const insight = await createInsight(input);
    return { created: true, insight };
  } catch (error) {
    // Handle race condition: another worker created the insight concurrently
    // This can manifest as:
    // 1. DuplicateIngestionError from our pre-check
    // 2. UniqueConstraintError from database constraint
    const isDuplicateError =
      error instanceof DuplicateIngestionError ||
      (error instanceof Error && error.name === 'SequelizeUniqueConstraintError');

    if (isDuplicateError) {
      // Wait a bit for the concurrent transaction to commit
      await new Promise(resolve => setTimeout(resolve, 50));
      const insight = await getInsightByIngestionKey(projectId, ingestionKey);
      if (insight) {
        return { created: false, insight };
      }
    }
    throw error;
  }
}

/**
 * Check if a source is cited by any accepted revision (D9: source protection)
 */
export async function isSourceCitedByAcceptedRevision(sourceId: number): Promise<boolean> {
  // Find all accepted revisions that cite this source
  const constructs = await EvidenceConstruct.findAll({
    where: {
      construct_type: 'desk_insight',
      accepted_revision_id: { [Op.ne]: null },
      withdrawn_at: null,
    },
    include: [{ model: EvidenceConstructRevision, as: 'acceptedRevision' }],
  });

  for (const construct of constructs) {
    const revision = (construct as any).acceptedRevision;
    if (!revision) continue;

    const evidenceSnapshot = revision.evidence_snapshot as EvidenceReference[];
    if (evidenceSnapshot.some((ref) => ref.evidenceSourceId === sourceId)) {
      return true;
    }
  }

  return false;
}

// ─── Transformation Helpers ───────────────────────────────────────────────────

function toInsightSummary(construct: any): InsightSummary {
  const latestRevision = construct.latestRevision;
  const acceptedRevision = construct.acceptedRevision;

  return {
    id: construct.id,
    publicId: construct.public_id,
    displayId: formatDisplayId(construct.display_sequence),
    projectId: construct.project_id,
    wording: (construct.payload as any)?.wording ?? construct.label ?? '',
    status: deriveInsightStatus(construct),
    latestRevisionNumber: latestRevision?.revision_number ?? 0,
    acceptedRevisionNumber: acceptedRevision?.revision_number ?? null,
    pendingRevisionNumber:
      latestRevision && acceptedRevision && latestRevision.id !== acceptedRevision.id
        ? latestRevision.revision_number
        : null,
    origin: latestRevision?.origin ?? 'researcher',
    needsReview: needsReview(construct),
    createdBy: construct.created_by,
    createdAt: construct.created_at,
    withdrawnAt: construct.withdrawn_at,
    version: construct.version,
  };
}

function toInsightDetail(construct: any): InsightDetail {
  const summary = toInsightSummary(construct);
  const latestRevision = construct.latestRevision;
  const acceptedRevision = construct.acceptedRevision;
  const revisions = construct.revisions ?? [];

  return {
    ...summary,
    latestRevision: toRevisionDetail(
      latestRevision,
      construct.accepted_revision_id,
      construct.latest_revision_id,
    ),
    acceptedRevision: acceptedRevision
      ? toRevisionDetail(acceptedRevision, construct.accepted_revision_id, construct.latest_revision_id)
      : null,
    revisionCount: revisions.length,
  };
}

function toRevisionDetail(
  revision: any,
  acceptedRevisionId: number | null,
  latestRevisionId: number | null,
): RevisionDetail {
  return {
    id: revision.id,
    publicId: revision.public_id,
    revisionNumber: revision.revision_number,
    content: revision.content,
    evidenceSnapshot: revision.evidence_snapshot,
    origin: revision.origin,
    createdBy: revision.created_by,
    createdAt: revision.created_at,
    isAccepted: revision.id === acceptedRevisionId,
    isLatest: revision.id === latestRevisionId,
  };
}
