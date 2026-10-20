/**
 * DR-6b-5a Readout Generation Claim Integration Tests
 *
 * Tests against real Postgres for:
 * 1. Valid generation initiation
 * 2. Empty or invalid evidence selection
 * 3. Cross-project evidence rejection
 * 4. Pending and withdrawn revision rejection
 * 5. Same idempotency key and same payload
 * 6. Same key with different payload
 * 7. Two concurrent initiation requests
 * 8. Supersession of a previous request
 * 9. Two workers claiming concurrently
 * 10. Heartbeat ownership
 * 11. Lease expiration and safe reclaim
 * 12. Bounded retry exhaustion
 * 13. Stale worker completion rejection
 * 14. Duplicate completion behavior
 * 15. Researcher edit during generation
 * 16. Approved snapshot immutability
 * 17. Permission and ownership enforcement
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import * as readoutService from '../../services/desk-readout.service';
import * as claimService from '../../services/readout-generation-claim.service';
import { AuthorizationError } from '../../services/authorization.service';
import type { DraftContent } from '../../database/models/desk_research_readout_draft';
import type { Model } from 'sequelize';

const sequelize = getTestDb();

const ProjectModel = sequelize.models.Project;
const ResearchStudyModel = sequelize.models.ResearchStudy;
const ActorModel = sequelize.models.Actor;
const ProjectMembershipModel = sequelize.models.ProjectMembership;
const EvidenceSourceModel = sequelize.models.EvidenceSource;
const EvidenceConstructModel = sequelize.models.EvidenceConstruct;
const EvidenceConstructRevisionModel = sequelize.models.EvidenceConstructRevision;
const DeskResearchReadoutModel = sequelize.models.DeskResearchReadout;
const DeskResearchReadoutDraftModel = sequelize.models.DeskResearchReadoutDraft;
const DeskResearchReadoutVersionModel = sequelize.models.DeskResearchReadoutVersion;

// ─── Type-safe model accessors ─────────────────────────────────────────────────
// These avoid `as any` by using Sequelize's typed `.get()` method or narrowly
// scoped type assertions. Follows compensation-flow.test.ts pattern (ADR 0014).

type ModelWithId = Model & { get(key: 'id'): number };
type ModelWithPublicId = Model & { get(key: 'public_id'): string };

function getId(model: Model): number {
  return (model as ModelWithId).get('id');
}

function getPublicId(model: Model): string {
  return (model as ModelWithPublicId).get('public_id');
}

// Version field accessor for assertions
interface VersionFields {
  generation_status: string;
  idempotency_key: string | null;
  requested_by_actor_id: number | null;
  attempt_count: number;
  evidence_set: Array<{ constructPublicId: string; revisionPublicId: string; displayId: string }>;
  worker_id: string | null;
  heartbeat_at: Date | null;
  last_error_code: string | null;
  content: DraftContent | null;
}

function getVersionField<K extends keyof VersionFields>(
  model: Model,
  field: K,
): VersionFields[K] {
  return model.get(field) as VersionFields[K];
}

// Readout field accessor
function getReadoutField(model: Model, field: 'current_generation_request_id'): string | null {
  return model.get(field) as string | null;
}

// Error field accessor for typed error objects
interface EvidenceError {
  reason: string;
  revisionPublicId?: string;
}

function getErrorField(err: unknown, field: 'errors'): EvidenceError[] {
  return (err as { errors: EvidenceError[] }).errors;
}

function getErrorRequestId(err: unknown): string {
  return (err as { existingRequestId: string }).existingRequestId;
}

// Test fixtures
let projectId: number;
let project2Id: number;
let studyId: number;
let actorId: number;
let actor2Id: number;
let readoutId: number;

// Evidence fixtures
let insightId: number;
let insightPublicId: string;
let revisionId: number;
let revisionPublicId: string;
let insight2Id: number;
let insight2PublicId: string;
let revision2Id: number;
let revision2PublicId: string;

// Cross-project insight
let otherProjectInsightPublicId: string;
let otherProjectRevisionPublicId: string;

// Withdrawn insight
let withdrawnInsightPublicId: string;
let withdrawnRevisionPublicId: string;

// Pending revision
let pendingRevisionPublicId: string;

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await truncateAll();

  // Create test projects
  const project = await ProjectModel.create({
    organization_id: TEST_ORG_ID,
    name: 'Test Project',
    slug: 'test-project',
    created_by: 'test-user',
    status: 'active',
  });
  projectId = getId(project);

  const project2 = await ProjectModel.create({
    organization_id: TEST_ORG_ID,
    name: 'Other Project',
    slug: 'other-project',
    created_by: 'test-user',
    status: 'active',
  });
  project2Id = getId(project2);

  // Create test study
  const study = await ResearchStudyModel.create({
    project_id: projectId,
    name: 'Test Study',
    methodology: 'desk_research',
    created_by: 'test-user',
    channel_name: 'test-study',
    researcher_name: 'Test Researcher',
    researcher_email: 'test@example.com',
  });
  studyId = getId(study);

  // Create test actors
  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    actor_type: 'human',
  });
  actorId = getId(actor);

  const actor2 = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Other Researcher',
    actor_type: 'human',
  });
  actor2Id = getId(actor2);

  // Create project memberships
  await ProjectMembershipModel.create({
    project_id: projectId,
    actor_id: actorId,
    role: 'researcher',
  });

  await ProjectMembershipModel.create({
    project_id: projectId,
    actor_id: actor2Id,
    role: 'researcher',
  });

  // Create evidence source
  const source = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document',
    created_by: 'test-user',
  });
  const sourceId = getId(source);

  // Create accepted insight 1
  const insight1 = await EvidenceConstructModel.create({
    project_id: projectId,
    construct_type: 'desk_insight',
    display_sequence: 1,
    status: 'accepted',
    created_by: 'test-user',
  });
  insightId = getId(insight1);
  insightPublicId = getPublicId(insight1);

  const revision1 = await EvidenceConstructRevisionModel.create({
    construct_id: insightId,
    revision_number: 1,
    content: { wording: 'Test insight 1' },
    evidence_snapshot: [{ evidenceSourceId: sourceId, locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  });
  revisionId = getId(revision1);
  revisionPublicId = getPublicId(revision1);

  // Mark as accepted
  await insight1.update({
    accepted_revision_id: revisionId,
    latest_revision_id: revisionId,
  });

  // Create accepted insight 2
  const insight2 = await EvidenceConstructModel.create({
    project_id: projectId,
    construct_type: 'desk_insight',
    display_sequence: 2,
    status: 'accepted',
    created_by: 'test-user',
  });
  insight2Id = getId(insight2);
  insight2PublicId = getPublicId(insight2);

  const revision2 = await EvidenceConstructRevisionModel.create({
    construct_id: insight2Id,
    revision_number: 1,
    content: { wording: 'Test insight 2' },
    evidence_snapshot: [{ evidenceSourceId: sourceId, locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  });
  revision2Id = getId(revision2);
  revision2PublicId = getPublicId(revision2);

  await insight2.update({
    accepted_revision_id: revision2Id,
    latest_revision_id: revision2Id,
  });

  // Create cross-project source and insight
  const otherSource = await EvidenceSourceModel.create({
    project_id: project2Id,
    source_type: 'uploaded_document',
    label: 'Other Project Document',
    created_by: 'test-user',
  });

  const otherProjectInsight = await EvidenceConstructModel.create({
    project_id: project2Id,
    construct_type: 'desk_insight',
    display_sequence: 1,
    status: 'accepted',
    created_by: 'test-user',
  });
  otherProjectInsightPublicId = getPublicId(otherProjectInsight);

  const otherProjectRevision = await EvidenceConstructRevisionModel.create({
    construct_id: getId(otherProjectInsight),
    revision_number: 1,
    content: { wording: 'Other project insight' },
    evidence_snapshot: [{ evidenceSourceId: getId(otherSource), locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  });
  otherProjectRevisionPublicId = getPublicId(otherProjectRevision);
  await otherProjectInsight.update({
    accepted_revision_id: getId(otherProjectRevision),
    latest_revision_id: getId(otherProjectRevision),
  });

  // Create withdrawn insight (status is 'accepted' but withdrawn_at is set)
  const withdrawnInsight = await EvidenceConstructModel.create({
    project_id: projectId,
    construct_type: 'desk_insight',
    display_sequence: 3,
    status: 'accepted',
    withdrawn_at: new Date(),
    withdrawn_reason: 'Test withdrawal',
    created_by: 'test-user',
  });
  withdrawnInsightPublicId = getPublicId(withdrawnInsight);

  const withdrawnRevision = await EvidenceConstructRevisionModel.create({
    construct_id: getId(withdrawnInsight),
    revision_number: 1,
    content: { wording: 'Withdrawn insight' },
    evidence_snapshot: [{ evidenceSourceId: sourceId, locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  });
  withdrawnRevisionPublicId = getPublicId(withdrawnRevision);
  await withdrawnInsight.update({
    accepted_revision_id: getId(withdrawnRevision),
    latest_revision_id: getId(withdrawnRevision),
  });

  // Create pending revision (not accepted) on insight1
  const pendingRevision = await EvidenceConstructRevisionModel.create({
    construct_id: insightId,
    revision_number: 2,
    content: { wording: 'Pending revision' },
    evidence_snapshot: [{ evidenceSourceId: sourceId, locator: { sourceLevel: true }, validation: 'verified' }],
    origin: 'researcher',
    created_by: 'test-user',
  });
  pendingRevisionPublicId = getPublicId(pendingRevision);

  // Create readout
  const result = await readoutService.createReadout({
    studyId,
    projectId,
    title: 'Test Readout',
    question: 'What do we know?',
    createdByActorId: actorId,
  });
  readoutId = result.id;
});

// ─── 1. Valid generation initiation ───────────────────────────────────────────

describe('Valid generation initiation', () => {
  test('creates version with pending status and evidence set', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revisionPublicId, revision2PublicId],
      initiatedByActorId: actorId,
    });

    expect(result.created).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.generationRequestId).toBeDefined();

    // Verify version record
    const version = await DeskResearchReadoutVersionModel.findByPk(result.versionId);
    expect(version).not.toBeNull();
    expect(getVersionField(version!, 'generation_status')).toBe('pending');
    expect(getVersionField(version!, 'idempotency_key')).toBe('test-key-12345678');
    expect(getVersionField(version!, 'requested_by_actor_id')).toBe(actorId);
    expect(getVersionField(version!, 'attempt_count')).toBe(0);
    expect(getVersionField(version!, 'evidence_set')).toHaveLength(2);

    // Verify evidence set contains canonical IDs
    const evidenceSet = getVersionField(version!, 'evidence_set');
    expect(evidenceSet[0].constructPublicId).toBe(insightPublicId);
    expect(evidenceSet[0].revisionPublicId).toBe(revisionPublicId);
    expect(evidenceSet[0].displayId).toBe('IN-0001');
  });

  test('updates readout current_generation_request_id', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    const readout = await DeskResearchReadoutModel.findByPk(readoutId);
    expect(getReadoutField(readout!, 'current_generation_request_id')).toBe(result.generationRequestId);
  });
});

// ─── 2. Empty or invalid evidence selection ───────────────────────────────────

describe('Empty or invalid evidence selection', () => {
  test('rejects empty evidence selection', async () => {
    await expect(
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [],
        initiatedByActorId: actorId,
      }),
    ).rejects.toThrow(readoutService.EvidenceSelectionError);
  });

  test('rejects non-existent revision ID', async () => {
    // Use a valid UUID format but one that doesn't exist
    const fakeRevisionId = '00000000-0000-0000-0000-000000000000';
    await expect(
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [fakeRevisionId],
        initiatedByActorId: actorId,
      }),
    ).rejects.toThrow(readoutService.EvidenceSelectionError);
  });

  test('rejects invalid idempotency key (too short)', async () => {
    await expect(
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'short',
        selectedRevisionIds: [revisionPublicId],
        initiatedByActorId: actorId,
      }),
    ).rejects.toThrow(readoutService.ValidationError);
  });
});

// ─── 3. Cross-project evidence rejection ──────────────────────────────────────

describe('Cross-project evidence rejection', () => {
  test('rejects revision from different project', async () => {
    await expect(
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [otherProjectRevisionPublicId],
        initiatedByActorId: actorId,
      }),
    ).rejects.toThrow(readoutService.EvidenceSelectionError);

    try {
      await readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [otherProjectRevisionPublicId],
        initiatedByActorId: actorId,
      });
    } catch (err) {
      expect(getErrorField(err, 'errors')[0].reason).toBe('WRONG_PROJECT');
    }
  });
});

// ─── 4. Pending and withdrawn revision rejection ──────────────────────────────

describe('Pending and withdrawn revision rejection', () => {
  test('rejects withdrawn insight', async () => {
    try {
      await readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [withdrawnRevisionPublicId],
        initiatedByActorId: actorId,
      });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(readoutService.EvidenceSelectionError);
      expect(getErrorField(err, 'errors')[0].reason).toBe('WITHDRAWN');
    }
  });

  test('rejects pending revision (not accepted)', async () => {
    try {
      await readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [pendingRevisionPublicId],
        initiatedByActorId: actorId,
      });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(readoutService.EvidenceSelectionError);
      expect(getErrorField(err, 'errors')[0].reason).toBe('NOT_ACCEPTED');
    }
  });
});

// ─── 5. Same idempotency key and same payload ─────────────────────────────────

describe('Idempotency - same key and same payload', () => {
  test('returns existing request without creating new version', async () => {
    const result1 = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revisionPublicId, revision2PublicId],
      initiatedByActorId: actorId,
    });

    const result2 = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revisionPublicId, revision2PublicId],
      initiatedByActorId: actorId,
    });

    expect(result1.generationRequestId).toBe(result2.generationRequestId);
    expect(result1.versionId).toBe(result2.versionId);
    expect(result2.created).toBe(false);

    // Verify only one version exists
    const versions = await DeskResearchReadoutVersionModel.findAll({
      where: { readout_id: readoutId },
    });
    expect(versions).toHaveLength(1);
  });

  test('handles reordered revision IDs as same payload', async () => {
    const result1 = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revisionPublicId, revision2PublicId],
      initiatedByActorId: actorId,
    });

    // Same revisions, different order
    const result2 = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revision2PublicId, revisionPublicId],
      initiatedByActorId: actorId,
    });

    expect(result1.generationRequestId).toBe(result2.generationRequestId);
    expect(result2.created).toBe(false);
  });
});

// ─── 6. Same key with different payload ───────────────────────────────────────

describe('Idempotency conflict - same key, different payload', () => {
  test('throws IdempotencyConflictError', async () => {
    await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    await expect(
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [revision2PublicId], // Different evidence
        initiatedByActorId: actorId,
      }),
    ).rejects.toThrow(readoutService.IdempotencyConflictError);
  });

  test('includes existing request ID in error', async () => {
    const result1 = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'test-key-12345678',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    try {
      await readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'test-key-12345678',
        selectedRevisionIds: [revision2PublicId],
        initiatedByActorId: actorId,
      });
      fail('Should have thrown');
    } catch (err) {
      expect(getErrorRequestId(err)).toBe(result1.generationRequestId);
    }
  });
});

// ─── 7. Two concurrent initiation requests ────────────────────────────────────

describe('Concurrent initiation requests', () => {
  test('both complete without deadlock', async () => {
    const promises = [
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'concurrent-key-1',
        selectedRevisionIds: [revisionPublicId],
        initiatedByActorId: actorId,
      }),
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'concurrent-key-2',
        selectedRevisionIds: [revision2PublicId],
        initiatedByActorId: actor2Id,
      }),
    ];

    const results = await Promise.all(promises);

    // Both should succeed
    expect(results[0].created).toBe(true);
    expect(results[1].created).toBe(true);

    // One should be superseded by the other
    const versions = await DeskResearchReadoutVersionModel.findAll({
      where: { readout_id: readoutId },
      order: [['version_number', 'ASC']],
    });

    expect(versions).toHaveLength(2);

    // The first one to complete will be superseded by the second
    const statuses = versions.map(v => getVersionField(v, 'generation_status'));
    expect(statuses).toContain('pending');
    // One may be superseded depending on timing
  });
});

// ─── 8. Supersession of a previous request ────────────────────────────────────

describe('Supersession of previous request', () => {
  test('marks existing pending version as superseded', async () => {
    const result1 = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'first-request-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    const result2 = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'second-request-key',
      selectedRevisionIds: [revision2PublicId],
      initiatedByActorId: actorId,
    });

    // First version should be superseded
    const version1 = await DeskResearchReadoutVersionModel.findByPk(result1.versionId);
    expect(getVersionField(version1!, 'generation_status')).toBe('superseded');

    // Second version should be pending
    const version2 = await DeskResearchReadoutVersionModel.findByPk(result2.versionId);
    expect(getVersionField(version2!, 'generation_status')).toBe('pending');
  });
});

// ─── 9. Two workers claiming concurrently ─────────────────────────────────────

describe('Concurrent worker claims', () => {
  test('only one worker claims the job', async () => {
    // Create a pending job
    await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'claim-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    // Two workers try to claim concurrently
    const [claim1, claim2] = await Promise.all([
      claimService.claimNextPendingJob('worker-1'),
      claimService.claimNextPendingJob('worker-2'),
    ]);

    // Only one should succeed
    const successfulClaims = [claim1, claim2].filter(c => c !== null);
    expect(successfulClaims).toHaveLength(1);

    // The successful claim should have correct worker_id
    const claimed = successfulClaims[0]!;
    expect(claimed.worker_id).toMatch(/^worker-[12]$/);
    expect(claimed.generation_status).toBe('generating');
  });
});

// ─── 10. Heartbeat ownership ──────────────────────────────────────────────────

describe('Heartbeat ownership', () => {
  test('owner can update heartbeat', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'heartbeat-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    const claimed = await claimService.claimNextPendingJob('worker-1');
    expect(claimed).not.toBeNull();

    const initialHeartbeat = claimed!.heartbeat_at;

    // Wait a bit
    await new Promise(r => setTimeout(r, 10));

    // Update heartbeat
    await claimService.updateHeartbeat(result.versionId, 'worker-1');

    const version = await DeskResearchReadoutVersionModel.findByPk(result.versionId);
    const newHeartbeat = getVersionField(version!, 'heartbeat_at');
    expect(new Date(newHeartbeat!).getTime()).toBeGreaterThan(
      new Date(initialHeartbeat!).getTime(),
    );
  });

  test('non-owner cannot update heartbeat', async () => {
    await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'heartbeat-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    const claimed = await claimService.claimNextPendingJob('worker-1');
    expect(claimed).not.toBeNull();

    await expect(
      claimService.updateHeartbeat(claimed!.id, 'worker-2'),
    ).rejects.toThrow(claimService.NotOwnerError);
  });
});

// ─── 11. Lease expiration and safe reclaim ────────────────────────────────────

describe('Lease expiration and reclaim', () => {
  test('stale job can be reclaimed by another worker', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'stale-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    // Claim job
    const claimed = await claimService.claimNextPendingJob('worker-1');
    expect(claimed).not.toBeNull();

    // Simulate stale heartbeat by backdating it
    await sequelize.query(
      `UPDATE desk_research_readout_versions
       SET heartbeat_at = NOW() - INTERVAL '5 minutes'
       WHERE id = :versionId`,
      { replacements: { versionId: result.versionId } },
    );

    // Another worker recovers the stale job
    const recovered = await claimService.recoverStaleJob('worker-2');
    expect(recovered).not.toBeNull();
    expect(recovered!.worker_id).toBe('worker-2');
    expect(recovered!.attempt_count).toBe(2); // Incremented
    expect(recovered!.last_error_code).toBe('STALE_RECOVERY');
  });
});

// ─── 12. Bounded retry exhaustion ─────────────────────────────────────────────

describe('Bounded retry exhaustion', () => {
  test('job exceeding max attempts is marked failed', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'retry-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    // Claim and set attempt count near max
    await claimService.claimNextPendingJob('worker-1');

    // Simulate max attempts exceeded
    await sequelize.query(
      `UPDATE desk_research_readout_versions
       SET attempt_count = 3, heartbeat_at = NOW() - INTERVAL '5 minutes'
       WHERE id = :versionId`,
      { replacements: { versionId: result.versionId } },
    );

    // Run failure check
    const failedCount = await claimService.failExceededAttemptJobs('recovery-worker');
    expect(failedCount).toBe(1);

    // Verify job is failed
    const version = await DeskResearchReadoutVersionModel.findByPk(result.versionId);
    expect(getVersionField(version!, 'generation_status')).toBe('failed');
    expect(getVersionField(version!, 'last_error_code')).toBe('MAX_ATTEMPTS_EXCEEDED');
  });
});

// ─── 13. Stale worker completion rejection ────────────────────────────────────

describe('Stale worker completion rejection', () => {
  test('old worker cannot complete after losing ownership', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'fence-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    // Worker 1 claims
    await claimService.claimNextPendingJob('worker-1');

    // Simulate stale and recovery by worker 2
    await sequelize.query(
      `UPDATE desk_research_readout_versions
       SET heartbeat_at = NOW() - INTERVAL '5 minutes'
       WHERE id = :versionId`,
      { replacements: { versionId: result.versionId } },
    );

    await claimService.recoverStaleJob('worker-2');

    // Worker 1 tries to complete - should fail
    await expect(
      claimService.completeJob(result.versionId, 'worker-1', { summary: { text: 'test' } }),
    ).rejects.toThrow(claimService.NotOwnerError);

    // Worker 2 can complete
    const completed = await claimService.completeJob(
      result.versionId,
      'worker-2',
      { summary: { text: 'test', citations: [] }, findings: [], limitations: [], implications: [] },
    );
    expect(completed.generation_status).toBe('completed');
  });
});

// ─── 14. Duplicate completion behavior ────────────────────────────────────────

describe('Duplicate completion behavior', () => {
  test('completeGenerationWithFencing is idempotent for completed jobs', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'dup-complete-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    // Claim
    await claimService.claimNextPendingJob('worker-1');

    const content: DraftContent = {
      summary: { text: 'Summary', citations: [] },
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 1,
          displayId: 'IN-0001',
        }],
      }],
      limitations: [],
      implications: [],
    };

    // Complete first time
    const result1 = await readoutService.completeGenerationWithFencing({
      readoutId,
      generationRequestId: result.generationRequestId,
      content,
      status: 'completed',
      workerId: 'worker-1',
    });

    expect(result1.applied).toBe(true);
    expect(result1.fencingViolation).toBe(false);

    // Complete second time - should be idempotent
    const result2 = await readoutService.completeGenerationWithFencing({
      readoutId,
      generationRequestId: result.generationRequestId,
      content,
      status: 'completed',
      workerId: 'worker-1',
    });

    // Should return without error, indicating already completed
    expect(result2.fencingViolation).toBe(false);
  });
});

// ─── 15. Researcher edit during generation ────────────────────────────────────

describe('Researcher edit during generation', () => {
  test('preserves human edits and stores generated content separately', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'edit-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    // Claim
    await claimService.claimNextPendingJob('worker-1');

    // Researcher edits the draft while generation is in progress
    const editedContent: DraftContent = {
      summary: { text: 'Human edited summary', citations: [] },
      findings: [],
      limitations: [],
      implications: [],
    };

    await readoutService.saveDraft({
      readoutId,
      content: editedContent,
      findingsChecked: [],
      implicationsReviewed: [],
      expectedVersion: 1,
      editedByActorId: actorId,
    });

    // Generation completes with different content
    const generatedContent: DraftContent = {
      summary: { text: 'AI generated summary', citations: [] },
      findings: [{ id: 'f1', text: 'AI finding', citations: [] }],
      limitations: [],
      implications: [],
    };

    const completion = await readoutService.completeGenerationWithFencing({
      readoutId,
      generationRequestId: result.generationRequestId,
      content: generatedContent,
      status: 'completed',
      workerId: 'worker-1',
    });

    expect(completion.applied).toBe(false);
    expect(completion.conflictDetected).toBe(true);

    // Verify draft still has human edits
    const readout = await readoutService.getReadoutById(readoutId, actorId);
    expect(readout).not.toBeNull();
    expect(readout!.draft.content.summary?.text).toBe('Human edited summary');

    // Verify generated content is stored in version history
    const version = await DeskResearchReadoutVersionModel.findByPk(result.versionId);
    const versionContent = getVersionField(version!, 'content');
    expect(versionContent!.summary!.text).toBe('AI generated summary');
  });
});

// ─── 16. Approved snapshot immutability ───────────────────────────────────────

describe('Approved snapshot immutability', () => {
  test('approval creates immutable snapshot', async () => {
    // Initiate and complete generation
    const genResult = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'approval-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    await claimService.claimNextPendingJob('worker-1');

    const content: DraftContent = {
      summary: {
        text: 'Summary',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 1,
          displayId: 'IN-0001',
        }],
      },
      findings: [{
        id: 'f1',
        text: 'Finding',
        citations: [{
          constructPublicId: insightPublicId,
          revisionPublicId,
          revisionNumber: 1,
          displayId: 'IN-0001',
        }],
      }],
      limitations: [],
      implications: [],
    };

    await readoutService.completeGenerationWithFencing({
      readoutId,
      generationRequestId: genResult.generationRequestId,
      content,
      status: 'completed',
      workerId: 'worker-1',
    });

    // Mark findings as checked
    await readoutService.saveDraft({
      readoutId,
      content,
      findingsChecked: ['f1'],
      implicationsReviewed: [],
      expectedVersion: 2,
      editedByActorId: actorId,
    });

    // Approve
    const approval = await readoutService.approveReadout({
      readoutId,
      expectedVersion: 3,
      approvedByActorId: actorId,
      approvalNote: 'Test approval',
    });

    expect(approval.approvalNumber).toBe(1);
    expect(approval.contentSnapshot).toEqual(content);
    expect(approval.findingsCheckedSnapshot).toContain('f1');
  });
});

// ─── 17. Permission and ownership enforcement ─────────────────────────────────

describe('Permission and ownership enforcement', () => {
  test('rejects non-member actor', async () => {
    const outsiderActor = await ActorModel.create({
      organization_id: TEST_ORG_ID,
      display_name: 'Outsider',
      actor_type: 'human',
    });

    await expect(
      readoutService.initiateGenerationV2({
        readoutId,
        idempotencyKey: 'auth-test-key',
        selectedRevisionIds: [revisionPublicId],
        initiatedByActorId: getId(outsiderActor),
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  test('allows admin role', async () => {
    const adminActor = await ActorModel.create({
      organization_id: TEST_ORG_ID,
      display_name: 'Admin',
      actor_type: 'human',
    });

    await ProjectMembershipModel.create({
      project_id: projectId,
      actor_id: getId(adminActor),
      role: 'admin',
    });

    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'admin-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: getId(adminActor),
    });

    expect(result.created).toBe(true);
  });

  test('accepts researcher role', async () => {
    const result = await readoutService.initiateGenerationV2({
      readoutId,
      idempotencyKey: 'researcher-test-key',
      selectedRevisionIds: [revisionPublicId],
      initiatedByActorId: actorId,
    });

    expect(result.created).toBe(true);
  });
});
