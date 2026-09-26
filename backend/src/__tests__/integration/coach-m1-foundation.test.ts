/**
 * Coach M1: Coaching Foundation Integration Tests
 *
 * Tests for:
 * - Migrations / Models: constraints, FKs, status values, review scope, indexes
 * - Run creation: authorization, section validation, concurrency enforcement
 * - Lifecycle: pending -> running -> completed/failed transitions
 * - Researcher retry: creates NEW run with lineage
 * - Operational retry: same run, increment attempt_count
 * - History visibility: all collaborators can read
 * - Version binding: content_version captured at creation
 * - Immutability: completed/failed runs cannot be modified
 * - Canonical isolation: coaching does not modify artifacts/comments
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { ApplicationContext } from '../../types/application-context';
import type { CoachingRun } from '../../database/models/coaching_run';
import type { CoachingRunItem } from '../../database/models/coaching_run_item';
import type { CoachingRunReference } from '../../database/models/coaching_run_reference';
import type { CoachingRunContext } from '../../database/models/coaching_run_context';
import * as coachingService from '../../application/coaching.app-service';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testStudyId: number;
let testArtifactId: number;
let testArtifactPublicId: string;
let testActorId: number;
let otherActorId: number;
let nonMemberActorId: number;

/**
 * Create a minimal ApplicationContext for testing.
 */
function createTestContext(actorId: number): ApplicationContext {
  return {
    actor: {
      id: actorId,
      publicId: `actor-${actorId}`,
      organizationId: TEST_ORG_ID,
      displayName: `Test Actor ${actorId}`,
    },
    organization: {
      id: TEST_ORG_ID,
      publicId: 'test-org',
      slug: 'test-org',
      name: 'Test Organization',
    },
    authenticationProvider: 'local_test',
    correlationId: `test-${Date.now()}`,
  };
}

beforeEach(async () => {
  await truncateAll();

  const Project = sequelize.models.Project;
  const ResearchStudy = sequelize.models.ResearchStudy;
  const ResearchArtifact = sequelize.models.ResearchArtifact;
  const Actor = sequelize.models.Actor;
  const ProjectMembership = sequelize.models.ProjectMembership;

  // Create test actors
  const actor = await Actor.create({
    display_name: 'Test User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;

  const otherActor = await Actor.create({
    display_name: 'Other User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  otherActorId = (otherActor as unknown as { id: number }).id;

  const nonMemberActor = await Actor.create({
    display_name: 'Non-Member User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  nonMemberActorId = (nonMemberActor as unknown as { id: number }).id;

  // Create project
  const project = await Project.create({
    name: 'Test Project',
    slug: 'test-project',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  testProjectId = (project as unknown as { id: number }).id;

  // Create project memberships for test actors (not nonMemberActor)
  if (ProjectMembership) {
    await ProjectMembership.create({
      project_id: testProjectId,
      actor_id: testActorId,
      role: 'researcher',
    });
    await ProjectMembership.create({
      project_id: testProjectId,
      actor_id: otherActorId,
      role: 'researcher',
    });
  }

  // Create study
  const study = await ResearchStudy.create({
    project_id: testProjectId,
    name: 'Test Study',
    slug: 'test-study',
    channel_name: '',
    created_by: 'U_TEST',
    researcher_name: 'Test Researcher',
    researcher_email: 'test@example.com',
    path: 'test-project/test-study',
  });
  testStudyId = (study as unknown as { id: number }).id;

  // Create artifact
  const artifact = await ResearchArtifact.create({
    project_id: testProjectId,
    study_id: testStudyId,
    template_id: 'research_brief',
    template_version: 'v7.1',
    artifact_type: 'brief',
    repo: 'test-repo',
    semantic_key: `research_brief:${testStudyId}:study:brief:${Date.now()}`,
    created_by: 'U_TEST',
    content_version: 1,
  });
  testArtifactId = (artifact as unknown as { id: number }).id;
  testArtifactPublicId = (artifact as unknown as { public_id: string }).public_id;
});

afterAll(() => sequelize.close());

// ─── Model / Migration Tests ───────────────────────────────────────────

describe('CoachingRun model', () => {
  it('has correct status constraint', async () => {
    const CoachingRunModel = sequelize.models.CoachingRun;

    // Valid status
    const validRun = await CoachingRunModel.create({
      study_id: testStudyId,
      artifact_id: testArtifactId,
      artifact_type: 'brief',
      content_version: 1,
      review_scope: 'artifact',
      status: 'pending',
      requested_by: testActorId,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    expect(validRun).toBeDefined();

    // Invalid status should fail
    await expect(
      CoachingRunModel.create({
        study_id: testStudyId,
        artifact_id: testArtifactId,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'artifact',
        status: 'invalid_status' as any,
        requested_by: testActorId,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      })
    ).rejects.toThrow();
  });

  it('has correct review_scope constraint', async () => {
    const CoachingRunModel = sequelize.models.CoachingRun;

    // Valid scope: artifact
    const artifactRun = await CoachingRunModel.create({
      study_id: testStudyId,
      artifact_id: testArtifactId,
      artifact_type: 'brief',
      content_version: 1,
      review_scope: 'artifact',
      status: 'pending',
      requested_by: testActorId,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    expect(artifactRun).toBeDefined();

    // Valid scope: section with section_key
    const sectionRun = await CoachingRunModel.create({
      study_id: testStudyId,
      artifact_id: testArtifactId,
      artifact_type: 'brief',
      content_version: 1,
      review_scope: 'section',
      selected_section_key: 'summary',
      status: 'pending',
      requested_by: testActorId,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    expect(sectionRun).toBeDefined();

    // Invalid scope should fail
    await expect(
      CoachingRunModel.create({
        study_id: testStudyId,
        artifact_id: testArtifactId,
        artifact_type: 'brief',
        content_version: 1,
        review_scope: 'invalid_scope' as any,
        status: 'pending',
        requested_by: testActorId,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      })
    ).rejects.toThrow();
  });

  it('enforces section_key/scope consistency via database constraint', async () => {
    // Section scope without section_key should fail at database level
    await expect(
      sequelize.query(`
        INSERT INTO coaching_runs (
          study_id, artifact_id, artifact_type, content_version,
          review_scope, selected_section_key, status, requested_by,
          coaching_contract_version, prompt_template_version, provider, model
        ) VALUES (
          ${testStudyId}, ${testArtifactId}, 'brief', 1,
          'section', NULL, 'pending', ${testActorId},
          '1.0.0', '1.0.0', 'anthropic', 'claude-sonnet-4-20250514'
        )
      `)
    ).rejects.toThrow();

    // Artifact scope with section_key should fail at database level
    await expect(
      sequelize.query(`
        INSERT INTO coaching_runs (
          study_id, artifact_id, artifact_type, content_version,
          review_scope, selected_section_key, status, requested_by,
          coaching_contract_version, prompt_template_version, provider, model
        ) VALUES (
          ${testStudyId}, ${testArtifactId}, 'brief', 1,
          'artifact', 'summary', 'pending', ${testActorId},
          '1.0.0', '1.0.0', 'anthropic', 'claude-sonnet-4-20250514'
        )
      `)
    ).rejects.toThrow();
  });
});

describe('CoachingRunItem model', () => {
  it('has correct category constraint', async () => {
    const CoachingRunModel = sequelize.models.CoachingRun;
    const CoachingRunItemModel = sequelize.models.CoachingRunItem;

    // Create a run first
    const run = await CoachingRunModel.create({
      study_id: testStudyId,
      artifact_id: testArtifactId,
      artifact_type: 'brief',
      content_version: 1,
      review_scope: 'artifact',
      status: 'pending',
      requested_by: testActorId,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    }) as unknown as { id: string };

    // Valid categories
    for (const category of ['strength', 'issue', 'suggestion', 'question']) {
      const item = await CoachingRunItemModel.create({
        run_id: run.id,
        category,
        position: 0,
        text: `Test ${category} item`,
      });
      expect(item).toBeDefined();
    }

    // Invalid category should fail
    await expect(
      CoachingRunItemModel.create({
        run_id: run.id,
        category: 'invalid_category' as any,
        position: 0,
        text: 'Invalid item',
      })
    ).rejects.toThrow();
  });
});

describe('CoachingRunContext model', () => {
  it('has correct context_role constraint', async () => {
    const CoachingRunModel = sequelize.models.CoachingRun;
    const CoachingRunContextModel = sequelize.models.CoachingRunContext;

    // Create a run first
    const run = await CoachingRunModel.create({
      study_id: testStudyId,
      artifact_id: testArtifactId,
      artifact_type: 'brief',
      content_version: 1,
      review_scope: 'artifact',
      status: 'pending',
      requested_by: testActorId,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    }) as unknown as { id: string };

    // Valid roles
    for (const role of ['primary', 'supporting']) {
      const ctx = await CoachingRunContextModel.create({
        run_id: run.id,
        object_type: 'artifact',
        object_id: testArtifactPublicId,
        context_role: role,
        position: 0,
      });
      expect(ctx).toBeDefined();
    }

    // Invalid role should fail
    await expect(
      CoachingRunContextModel.create({
        run_id: run.id,
        object_type: 'artifact',
        object_id: testArtifactPublicId,
        context_role: 'invalid_role' as any,
        position: 0,
      })
    ).rejects.toThrow();
  });
});

// ─── Authorization Tests ───────────────────────────────────────────────

describe('createCoachRun authorization', () => {
  it('allows project member to create run', async () => {
    const ctx = createTestContext(testActorId);
    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    expect(run).toBeDefined();
    expect(run.status).toBe('pending');
    expect(run.artifact_id).toBe(testArtifactId);
  });

  it('rejects non-member from creating run', async () => {
    const ctx = createTestContext(nonMemberActorId);

    await expect(
      coachingService.createCoachRun(ctx, {
        artifact_id: testArtifactId,
        review_scope: 'artifact',
        selected_section_key: null,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      })
    ).rejects.toThrow(/access denied/i);
  });
});

// ─── Scope Validation Tests ────────────────────────────────────────────

describe('createCoachRun scope validation', () => {
  it('requires section_key for section scope', async () => {
    const ctx = createTestContext(testActorId);

    await expect(
      coachingService.createCoachRun(ctx, {
        artifact_id: testArtifactId,
        review_scope: 'section',
        selected_section_key: null, // Missing!
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      })
    ).rejects.toThrow(/section key is required/i);
  });

  it('rejects section_key for artifact scope', async () => {
    const ctx = createTestContext(testActorId);

    await expect(
      coachingService.createCoachRun(ctx, {
        artifact_id: testArtifactId,
        review_scope: 'artifact',
        selected_section_key: 'summary', // Should be null!
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      })
    ).rejects.toThrow(/section key must be null/i);
  });

  it('validates section_key against artifact type', async () => {
    const ctx = createTestContext(testActorId);

    await expect(
      coachingService.createCoachRun(ctx, {
        artifact_id: testArtifactId,
        review_scope: 'section',
        selected_section_key: 'invalid_section_key',
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      })
    ).rejects.toThrow(/invalid section key/i);
  });

  it('accepts valid Brief section keys', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'section',
      selected_section_key: 'summary',
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    expect(run.selected_section_key).toBe('summary');
    expect(run.review_scope).toBe('section');
  });
});

// ─── Concurrency Tests ─────────────────────────────────────────────────

describe('active run concurrency', () => {
  it('rejects second pending run for same requester/artifact/version/scope', async () => {
    const ctx = createTestContext(testActorId);

    // Create first run
    const run1 = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    expect(run1.status).toBe('pending');

    // Try to create second run
    await expect(
      coachingService.createCoachRun(ctx, {
        artifact_id: testArtifactId,
        review_scope: 'artifact',
        selected_section_key: null,
        coaching_contract_version: '1.0.0',
        prompt_template_version: '1.0.0',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      })
    ).rejects.toThrow(/coaching run is already/i);
  });

  it('allows different section runs concurrently', async () => {
    const ctx = createTestContext(testActorId);

    // Create first run for 'summary' section
    const run1 = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'section',
      selected_section_key: 'summary',
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    // Create second run for 'risks' section
    const run2 = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'section',
      selected_section_key: 'risks',
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    expect(run1.id).not.toBe(run2.id);
  });

  it('allows different collaborators to run concurrently', async () => {
    const ctx1 = createTestContext(testActorId);
    const ctx2 = createTestContext(otherActorId);

    // Actor 1 creates run
    const run1 = await coachingService.createCoachRun(ctx1, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    // Actor 2 creates run (same artifact, different requester)
    const run2 = await coachingService.createCoachRun(ctx2, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    expect(run1.id).not.toBe(run2.id);
  });

  it('allows new run after previous completes', async () => {
    const ctx = createTestContext(testActorId);

    // Create and complete first run
    const run1 = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    await coachingService.markCoachRunRunning(run1.id);
    await coachingService.markCoachRunCompleted(run1.id);

    // Create second run
    const run2 = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    expect(run2.id).not.toBe(run1.id);
    expect(run2.status).toBe('pending');
  });
});

// ─── Lifecycle Tests ───────────────────────────────────────────────────

describe('coaching run lifecycle', () => {
  it('transitions pending -> running -> completed', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    expect(run.status).toBe('pending');

    await coachingService.markCoachRunRunning(run.id, 'worker-1');
    let detail = await coachingService.getCoachRun(ctx, run.id);
    expect(detail.status).toBe('running');
    expect(detail.started_at).not.toBeNull();

    await coachingService.markCoachRunCompleted(run.id);
    detail = await coachingService.getCoachRun(ctx, run.id);
    expect(detail.status).toBe('completed');
    expect(detail.completed_at).not.toBeNull();
  });

  it('transitions pending -> running -> failed', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    await coachingService.markCoachRunRunning(run.id);
    await coachingService.markCoachRunFailed(run.id, 'PROVIDER_TIMEOUT', 'Request timed out');

    const detail = await coachingService.getCoachRun(ctx, run.id);
    expect(detail.status).toBe('failed');
    expect(detail.failed_at).not.toBeNull();
    expect(detail.failure_code).toBe('PROVIDER_TIMEOUT');
    expect(detail.failure_diagnostic).toBe('Request timed out');
  });

  it('rejects invalid transitions', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    // Can't complete from pending
    await expect(
      coachingService.markCoachRunCompleted(run.id)
    ).rejects.toThrow(/cannot mark run as completed from status 'pending'/i);

    // Can't fail from pending
    await expect(
      coachingService.markCoachRunFailed(run.id, 'GENERATION_FAILED')
    ).rejects.toThrow(/cannot mark run as failed from status 'pending'/i);

    // Move to running then complete
    await coachingService.markCoachRunRunning(run.id);
    await coachingService.markCoachRunCompleted(run.id);

    // Can't go back to running
    await expect(
      coachingService.markCoachRunRunning(run.id)
    ).rejects.toThrow(/cannot mark run as running from status 'completed'/i);
  });
});

// ─── Researcher Retry Tests ────────────────────────────────────────────

describe('researcher retry', () => {
  it('creates new run linked to original', async () => {
    const ctx = createTestContext(testActorId);

    // Create and fail original run
    const original = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    await coachingService.markCoachRunRunning(original.id);
    await coachingService.markCoachRunFailed(original.id, 'GENERATION_FAILED');

    // Create retry
    const retry = await coachingService.createResearcherRetryRun(ctx, original.id);

    expect(retry.id).not.toBe(original.id);
    expect(retry.retry_of_run_id).toBe(original.id);
    expect(retry.status).toBe('pending');
  });

  it('cannot retry pending or running runs', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    // Can't retry pending
    await expect(
      coachingService.createResearcherRetryRun(ctx, run.id)
    ).rejects.toThrow(/still pending or running/i);

    // Move to running
    await coachingService.markCoachRunRunning(run.id);

    // Can't retry running
    await expect(
      coachingService.createResearcherRetryRun(ctx, run.id)
    ).rejects.toThrow(/still pending or running/i);
  });

  it('retry can use newer provenance', async () => {
    const ctx = createTestContext(testActorId);

    // Create and complete original
    const original = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    await coachingService.markCoachRunRunning(original.id);
    await coachingService.markCoachRunCompleted(original.id);

    // Retry with newer versions
    const retry = await coachingService.createResearcherRetryRun(ctx, original.id, {
      coaching_contract_version: '2.0.0',
      prompt_template_version: '2.0.0',
      model: 'claude-opus-4-20250514',
    });

    expect(retry.coaching_contract_version).toBe('2.0.0');
    expect(retry.prompt_template_version).toBe('2.0.0');
    expect(retry.model).toBe('claude-opus-4-20250514');
  });
});

// ─── Version Binding Tests ─────────────────────────────────────────────

describe('version binding', () => {
  it('captures content_version at creation', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    expect(run.content_version).toBe(1);
  });

  it('historical runs remain bound to original version', async () => {
    const ctx = createTestContext(testActorId);
    const ResearchArtifact = sequelize.models.ResearchArtifact;

    // Create run
    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    await coachingService.markCoachRunRunning(run.id);
    await coachingService.markCoachRunCompleted(run.id);

    // Update artifact version
    await ResearchArtifact.update(
      { content_version: 2 },
      { where: { id: testArtifactId } }
    );

    // Historical run still has version 1
    const detail = await coachingService.getCoachRun(ctx, run.id);
    expect(detail.content_version).toBe(1);
  });
});

// ─── History Visibility Tests ──────────────────────────────────────────

describe('history visibility', () => {
  it('all collaborators can read history', async () => {
    const ctx1 = createTestContext(testActorId);
    const ctx2 = createTestContext(otherActorId);

    // Actor 1 creates run
    const run = await coachingService.createCoachRun(ctx1, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    // Actor 2 can read it
    const detail = await coachingService.getCoachRun(ctx2, run.id);
    expect(detail.id).toBe(run.id);
    expect(detail.requested_by.id).toBe(testActorId);
  });

  it('non-member cannot read history', async () => {
    const ctx1 = createTestContext(testActorId);
    const ctx2 = createTestContext(nonMemberActorId);

    // Actor 1 creates run
    const run = await coachingService.createCoachRun(ctx1, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    // Non-member cannot read
    await expect(
      coachingService.getCoachRun(ctx2, run.id)
    ).rejects.toThrow(/access denied/i);
  });
});

// ─── Items and Context Recording Tests ─────────────────────────────────

describe('items and context recording', () => {
  it('records coaching items', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    await coachingService.recordCoachRunItems(run.id, [
      { category: 'strength', position: 0, text: 'Good problem statement' },
      { category: 'issue', position: 0, text: 'Missing timeline details' },
      { category: 'suggestion', position: 0, text: 'Add more context' },
    ]);

    const detail = await coachingService.getCoachRun(ctx, run.id);
    expect(detail.items.length).toBe(3);
    expect(detail.items.find(i => i.category === 'strength')).toBeDefined();
    expect(detail.items.find(i => i.category === 'issue')).toBeDefined();
    expect(detail.items.find(i => i.category === 'suggestion')).toBeDefined();
  });

  it('records coaching context', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    await coachingService.recordCoachRunContext(run.id, [
      {
        object_type: 'artifact',
        object_id: testArtifactPublicId,
        object_version: 1,
        section_key: null,
        context_role: 'primary',
        position: 0,
      },
    ]);

    const detail = await coachingService.getCoachRun(ctx, run.id);
    expect(detail.context.length).toBe(1);
    expect(detail.context[0].context_role).toBe('primary');
  });
});

// ─── Usage Recording Tests ─────────────────────────────────────────────

describe('usage recording', () => {
  it('records usage metadata', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    await coachingService.recordCoachUsage(run.id, {
      input_tokens: 1000,
      output_tokens: 500,
      total_tokens: 1500,
      latency_ms: 2500,
    });

    // Verify via direct query (usage is internal, not in public DTO)
    const [results] = await sequelize.query(
      `SELECT input_tokens, output_tokens, total_tokens, latency_ms
       FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      latency_ms: number;
    }>, unknown];

    expect(results[0].input_tokens).toBe(1000);
    expect(results[0].output_tokens).toBe(500);
    expect(results[0].total_tokens).toBe(1500);
    expect(results[0].latency_ms).toBe(2500);
  });
});

// ─── Operational Retry Tests ───────────────────────────────────────────

describe('operational retry', () => {
  it('increments attempt_count on same run', async () => {
    const ctx = createTestContext(testActorId);

    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    // Initial attempt_count is 1
    let [results] = await sequelize.query(
      `SELECT attempt_count FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ attempt_count: number }>, unknown];
    expect(results[0].attempt_count).toBe(1);

    // Increment
    await coachingService.incrementAttemptCount(run.id, 'worker-2');

    [results] = await sequelize.query(
      `SELECT attempt_count FROM coaching_runs WHERE id = '${run.id}'`
    ) as [Array<{ attempt_count: number }>, unknown];
    expect(results[0].attempt_count).toBe(2);
  });
});

// ─── Canonical Isolation Tests ─────────────────────────────────────────

describe('canonical isolation', () => {
  it('coaching operations do not modify artifact content_version', async () => {
    const ctx = createTestContext(testActorId);
    const ResearchArtifact = sequelize.models.ResearchArtifact;

    // Get initial version
    let artifact = await ResearchArtifact.findByPk(testArtifactId) as unknown as { content_version: number };
    const initialVersion = artifact.content_version;

    // Create and complete a coaching run
    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    await coachingService.markCoachRunRunning(run.id);
    await coachingService.recordCoachRunItems(run.id, [
      { category: 'strength', position: 0, text: 'Good' },
    ]);
    await coachingService.markCoachRunCompleted(run.id);

    // Artifact version unchanged
    artifact = await ResearchArtifact.findByPk(testArtifactId) as unknown as { content_version: number };
    expect(artifact.content_version).toBe(initialVersion);
  });

  it('coaching operations do not create comment threads', async () => {
    const ctx = createTestContext(testActorId);
    const CommentThread = sequelize.models.CommentThread;

    // Count initial threads
    const initialCount = await CommentThread.count({ where: { artifact_id: testArtifactId } });

    // Create and complete a coaching run
    const run = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    await coachingService.markCoachRunRunning(run.id);
    await coachingService.markCoachRunCompleted(run.id);

    // No new comment threads
    const finalCount = await CommentThread.count({ where: { artifact_id: testArtifactId } });
    expect(finalCount).toBe(initialCount);
  });
});
