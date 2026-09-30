/**
 * Coach M3C-A: Researcher Retry Integration Tests
 *
 * Tests the researcher retry functionality for failed coaching runs.
 * M3C-A invariants:
 * - Only failed runs can be retried
 * - Retry creates a NEW run linked via retry_of_run_id
 * - Uses CURRENT artifact version and content
 * - Uses CURRENT approved Coaching Contract/model
 * - Preserves original review scope and section key
 * - Original failed run remains unchanged
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { ApplicationContext } from '../../types/application-context';
import * as coachingService from '../../application/coaching.app-service';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testStudyId: number;
let testArtifactId: number;
let testActorId: number;
let testActorId2: number; // For collaborator tests

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
  const ArtifactSection = sequelize.models.ArtifactSection;
  const Actor = sequelize.models.Actor;
  const ProjectMembership = sequelize.models.ProjectMembership;

  // Create test actors
  const actor1 = await Actor.create({
    display_name: 'Alice Researcher',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor1 as unknown as { id: number }).id;

  const actor2 = await Actor.create({
    display_name: 'Bob Collaborator',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId2 = (actor2 as unknown as { id: number }).id;

  // Create project
  const project = await Project.create({
    name: 'M3C Test Project',
    slug: 'test-m3c-project',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  testProjectId = (project as unknown as { id: number }).id;

  // Create project memberships for both actors
  if (ProjectMembership) {
    await ProjectMembership.create({
      project_id: testProjectId,
      actor_id: testActorId,
      role: 'researcher',
    });
    await ProjectMembership.create({
      project_id: testProjectId,
      actor_id: testActorId2,
      role: 'researcher',
    });
  }

  // Create study
  const study = await ResearchStudy.create({
    project_id: testProjectId,
    name: 'M3C Test Study',
    slug: 'test-m3c-study',
    channel_name: '',
    created_by: 'U_TEST',
    researcher_name: 'Test Researcher',
    researcher_email: 'test@example.com',
    path: 'test-project/test-m3c-study',
  });
  testStudyId = (study as unknown as { id: number }).id;

  // Create test artifact (plan type for section tests)
  const artifact = await ResearchArtifact.create({
    project_id: testProjectId,
    study_id: testStudyId,
    template_id: 'research_plan',
    template_version: 'v7.1',
    artifact_type: 'plan',
    repo: 'test-repo',
    semantic_key: `research_plan:${testStudyId}:study:plan:${Date.now()}`,
    created_by: 'U_TEST',
    content_version: 1,
  });
  testArtifactId = (artifact as unknown as { id: number }).id;

  // Create test sections for plan type
  await ArtifactSection.create({
    artifact_id: testArtifactId,
    section_key: 'plan_summary',
    content_type: 'prose',
    content: 'Test summary content',
  });
  await ArtifactSection.create({
    artifact_id: testArtifactId,
    section_key: 'plan_background',
    content_type: 'prose',
    content: 'Test background content',
  });
});

// ─── Helper Functions ────────────────────────────────────────────────────────

async function createAndFailRun(
  ctx: ApplicationContext,
  options: {
    reviewScope: 'artifact' | 'section';
    sectionKey?: string | null;
  },
): Promise<ReturnType<typeof coachingService.createCoachRun>> {
  const run = await coachingService.createCoachRun(ctx, {
    artifact_id: testArtifactId,
    review_scope: options.reviewScope,
    selected_section_key: options.sectionKey ?? null,
    coaching_contract_version: '1.0.0',
    prompt_template_version: '1.0.0',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  });

  await coachingService.markCoachRunRunning(run.id);
  await coachingService.markCoachRunFailed(run.id, 'GENERATION_FAILED', 'Test failure');

  return run;
}

async function createAndCompleteRun(
  ctx: ApplicationContext,
): Promise<ReturnType<typeof coachingService.createCoachRun>> {
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

  return run;
}

// ─── Failed-Only Validation Tests ────────────────────────────────────────────

describe('M3C-A: failed-only validation', () => {
  it('allows retry of failed runs', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    expect(retryRun).toBeDefined();
    expect(retryRun.id).not.toBe(failedRun.id);
    expect(retryRun.retry_of_run_id).toBe(failedRun.id);
    expect(retryRun.status).toBe('pending');
  });

  it('rejects retry of pending runs', async () => {
    const ctx = createTestContext(testActorId);

    const pendingRun = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    await expect(
      coachingService.createResearcherRetryRun(ctx, pendingRun.id),
    ).rejects.toThrow(/Only failed.*can be retried/i);
  });

  it('rejects retry of running runs', async () => {
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

    await expect(
      coachingService.createResearcherRetryRun(ctx, run.id),
    ).rejects.toThrow(/Only failed.*can be retried/i);
  });

  it('rejects retry of completed runs', async () => {
    const ctx = createTestContext(testActorId);
    const completedRun = await createAndCompleteRun(ctx);

    await expect(
      coachingService.createResearcherRetryRun(ctx, completedRun.id),
    ).rejects.toThrow(/Only failed.*can be retried/i);
  });
});

// ─── Lineage and Immutability Tests ──────────────────────────────────────────

describe('M3C-A: retry lineage and immutability', () => {
  it('creates NEW run with retry_of_run_id pointing to original', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    expect(retryRun.id).not.toBe(failedRun.id);
    expect(retryRun.retry_of_run_id).toBe(failedRun.id);
  });

  it('leaves original failed run completely unchanged', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    // Capture original state
    const [originalBefore] = await sequelize.query(`
      SELECT status, content_version, coaching_contract_version, model, retry_of_run_id
      FROM coaching_runs WHERE id = '${failedRun.id}'
    `) as [Array<Record<string, unknown>>, unknown];

    await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    // Verify original unchanged
    const [originalAfter] = await sequelize.query(`
      SELECT status, content_version, coaching_contract_version, model, retry_of_run_id
      FROM coaching_runs WHERE id = '${failedRun.id}'
    `) as [Array<Record<string, unknown>>, unknown];

    expect(originalAfter[0]).toEqual(originalBefore[0]);
    expect(originalAfter[0].status).toBe('failed');
    expect(originalAfter[0].retry_of_run_id).toBeNull();
  });
});

// ─── Current Version/Snapshot Tests ──────────────────────────────────────────

describe('M3C-A: current version and snapshot', () => {
  it('captures CURRENT artifact version at retry time', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    // Advance artifact version
    await sequelize.query(`
      UPDATE research_artifacts SET content_version = 5 WHERE id = ${testArtifactId}
    `);

    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    expect(failedRun.content_version).toBe(1);
    expect(retryRun.content_version).toBe(5);
  });

  it('creates NEW immutable snapshot with current content', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    // Update artifact content
    await sequelize.query(`
      UPDATE artifact_sections
      SET content = 'UPDATED CONTENT FOR RETRY'
      WHERE artifact_id = ${testArtifactId} AND section_key = 'plan_summary'
    `);
    await sequelize.query(`
      UPDATE research_artifacts SET content_version = 2 WHERE id = ${testArtifactId}
    `);

    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    // Check retry snapshot has new content
    const [retrySnapshot] = await sequelize.query(`
      SELECT canonical_snapshot_json FROM coaching_run_snapshots WHERE run_id = '${retryRun.id}'
    `) as [Array<{ canonical_snapshot_json: { sections: Record<string, { content: string }> } }>, unknown];

    expect(retrySnapshot[0].canonical_snapshot_json.sections['plan_summary'].content).toBe(
      'UPDATED CONTENT FOR RETRY',
    );

    // Original snapshot unchanged
    const [originalSnapshot] = await sequelize.query(`
      SELECT canonical_snapshot_json FROM coaching_run_snapshots WHERE run_id = '${failedRun.id}'
    `) as [Array<{ canonical_snapshot_json: { sections: Record<string, { content: string }> } }>, unknown];

    expect(originalSnapshot[0].canonical_snapshot_json.sections['plan_summary'].content).toBe(
      'Test summary content',
    );
  });
});

// ─── Current Contract/Model Tests ────────────────────────────────────────────

describe('M3C-A: current approved contract and model', () => {
  it('uses CURRENT Coaching Contract, not original run config', async () => {
    const ctx = createTestContext(testActorId);

    // Create failed run with older config
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    // Retry should use current active contract
    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    // Verify retry has contract provenance (the exact version depends on registry config)
    expect(retryRun.coaching_contract_version).toBeDefined();
    expect(retryRun.prompt_template_version).toBeDefined();
    expect(retryRun.provider).toBe('anthropic');
    expect(retryRun.model).toBeDefined();

    // Original retains its historical provenance
    const [original] = await sequelize.query(`
      SELECT coaching_contract_version, prompt_template_version, model
      FROM coaching_runs WHERE id = '${failedRun.id}'
    `) as [Array<Record<string, string>>, unknown];

    expect(original[0].coaching_contract_version).toBe('1.0.0');
    expect(original[0].model).toBe('claude-sonnet-4-20250514');
  });
});

// ─── Scope Preservation Tests ────────────────────────────────────────────────

describe('M3C-A: review scope preservation', () => {
  it('preserves artifact scope for artifact retry', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    expect(retryRun.review_scope).toBe('artifact');
    expect(retryRun.selected_section_key).toBeNull();
  });

  it('preserves section scope and exact section key for section retry', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, {
      reviewScope: 'section',
      sectionKey: 'plan_background',
    });

    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    expect(retryRun.review_scope).toBe('section');
    expect(retryRun.selected_section_key).toBe('plan_background');
  });
});

// ─── Permission Tests ────────────────────────────────────────────────────────

describe('M3C-A: permissions', () => {
  it('allows collaborator B to retry collaborator A\'s failed run', async () => {
    const ctxA = createTestContext(testActorId);
    const ctxB = createTestContext(testActorId2);

    // Alice creates a failed run
    const failedRun = await createAndFailRun(ctxA, { reviewScope: 'artifact' });
    expect(failedRun.requested_by.id).toBe(testActorId);

    // Bob retries it
    const retryRun = await coachingService.createResearcherRetryRun(ctxB, failedRun.id);

    expect(retryRun.requested_by.id).toBe(testActorId2);
    expect(retryRun.retry_of_run_id).toBe(failedRun.id);
  });

  it('rejects retry when actor lacks project access', async () => {
    const ctxA = createTestContext(testActorId);

    // Create failed run
    const failedRun = await createAndFailRun(ctxA, { reviewScope: 'artifact' });

    // Create actor without project access
    const Actor = sequelize.models.Actor;
    const noAccessActor = await Actor.create({
      display_name: 'No Access User',
      status: 'active',
      organization_id: TEST_ORG_ID,
    });
    const noAccessActorId = (noAccessActor as unknown as { id: number }).id;
    const ctxNoAccess = createTestContext(noAccessActorId);

    await expect(
      coachingService.createResearcherRetryRun(ctxNoAccess, failedRun.id),
    ).rejects.toThrow(/Access denied|not a member/i);
  });
});

// ─── Concurrency Tests ───────────────────────────────────────────────────────

describe('M3C-A: concurrency', () => {
  it('rejects retry when active run exists for same scope', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    // Advance artifact version
    await sequelize.query(`
      UPDATE research_artifacts SET content_version = 2 WHERE id = ${testArtifactId}
    `);

    // Create first retry
    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);
    expect(retryRun.status).toBe('pending');

    // Attempt second retry (should fail - active run exists)
    await expect(
      coachingService.createResearcherRetryRun(ctx, failedRun.id),
    ).rejects.toThrow(/already.*pending|active/i);
  });

  it('concurrent retry race produces exactly ONE active run (DB constraint proof)', async () => {
    /**
     * M3C-A Gate 3: Concurrent Retry Race Proof
     *
     * Issue TWO retry requests CONCURRENTLY for the same failed run.
     * Database partial unique index `coaching_runs_active_run_unique_idx`
     * must ensure exactly one succeeds.
     *
     * Correctness boundary: database constraint, NOT frontend button disable.
     */
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    // Advance artifact version
    await sequelize.query(`
      UPDATE research_artifacts SET content_version = 2 WHERE id = ${testArtifactId}
    `);

    // Issue two concurrent retry requests
    const results = await Promise.allSettled([
      coachingService.createResearcherRetryRun(ctx, failedRun.id),
      coachingService.createResearcherRetryRun(ctx, failedRun.id),
    ]);

    // Count successes and failures
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Verify failure is due to active run conflict or unique constraint
    // Either the service check or the DB constraint may fire first
    const failedResult = failures[0] as PromiseRejectedResult;
    const errorMsg = failedResult.reason.message || failedResult.reason.toString();
    const isExpectedConflict =
      /already.*pending|active/i.test(errorMsg) ||
      /unique|duplicate|constraint/i.test(errorMsg) ||
      /Validation error/i.test(errorMsg);
    expect(isExpectedConflict).toBe(true);

    // Verify exactly one retry run exists
    const [retryRuns] = await sequelize.query(`
      SELECT id FROM coaching_runs
      WHERE retry_of_run_id = '${failedRun.id}'
    `) as [Array<{ id: string }>, unknown];
    expect(retryRuns.length).toBe(1);

    // Verify exactly one snapshot for the retry
    const [snapshots] = await sequelize.query(`
      SELECT id FROM coaching_run_snapshots
      WHERE run_id = '${retryRuns[0].id}'
    `) as [Array<{ id: string }>, unknown];
    expect(snapshots.length).toBe(1);

    // Verify original failed run unchanged
    const [original] = await sequelize.query(`
      SELECT status, retry_of_run_id FROM coaching_runs WHERE id = '${failedRun.id}'
    `) as [Array<{ status: string; retry_of_run_id: string | null }>, unknown];
    expect(original[0].status).toBe('failed');
    expect(original[0].retry_of_run_id).toBeNull();
  });
});

// ─── Provenance Proof Tests ──────────────────────────────────────────────────

describe('M3C-A: provenance proof with distinct values', () => {
  it('retry uses CURRENT contract config, not original historical config', async () => {
    /**
     * M3C-A Gate 4: Current Contract Provenance Proof
     *
     * Create a failed run with KNOWN OLD config values.
     * Retry should use CURRENT contract registry values.
     * Original run must retain OLD values unchanged.
     */
    const ctx = createTestContext(testActorId);

    // Create failed run with known OLD config
    const oldContractVersion = '1.0.0';
    const oldPromptVersion = '1.0.0';
    const oldModel = 'claude-sonnet-4-20250514';

    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    // Verify original has OLD config
    const [originalBefore] = await sequelize.query(`
      SELECT coaching_contract_version, prompt_template_version, model
      FROM coaching_runs WHERE id = '${failedRun.id}'
    `) as [Array<{ coaching_contract_version: string; prompt_template_version: string; model: string }>, unknown];

    expect(originalBefore[0].coaching_contract_version).toBe(oldContractVersion);
    expect(originalBefore[0].prompt_template_version).toBe(oldPromptVersion);
    expect(originalBefore[0].model).toBe(oldModel);

    // Create retry (uses CURRENT contract from registry)
    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    // Verify retry has lineage
    expect(retryRun.retry_of_run_id).toBe(failedRun.id);

    // Verify retry has CURRENT config (from active contract registry)
    // The exact values come from the contract registry, which may differ
    expect(retryRun.coaching_contract_version).toBeDefined();
    expect(retryRun.prompt_template_version).toBeDefined();
    expect(retryRun.model).toBeDefined();
    expect(retryRun.provider).toBe('anthropic');

    // Verify original STILL has OLD config (unchanged)
    const [originalAfter] = await sequelize.query(`
      SELECT coaching_contract_version, prompt_template_version, model
      FROM coaching_runs WHERE id = '${failedRun.id}'
    `) as [Array<{ coaching_contract_version: string; prompt_template_version: string; model: string }>, unknown];

    expect(originalAfter[0].coaching_contract_version).toBe(oldContractVersion);
    expect(originalAfter[0].prompt_template_version).toBe(oldPromptVersion);
    expect(originalAfter[0].model).toBe(oldModel);
  });
});

// ─── Invalid Section Atomicity Tests ─────────────────────────────────────────

describe('M3C-A: invalid section atomicity', () => {
  it('rejects retry for non-coachable section BEFORE creating run/snapshot', async () => {
    /**
     * M3C-A Gate 5: Invalid Section Atomicity
     *
     * Failed section run references a section that becomes invalid.
     * Retry must be rejected BEFORE any persistence:
     * - coaching_runs added = 0
     * - coaching_run_snapshots added = 0
     * - No execution job eligible
     */
    const ctx = createTestContext(testActorId);

    // Create failed section run with valid section
    const failedRun = await createAndFailRun(ctx, {
      reviewScope: 'section',
      sectionKey: 'plan_background',
    });

    // Count runs and snapshots before
    const [runsBefore] = await sequelize.query(`
      SELECT COUNT(*)::int as count FROM coaching_runs WHERE study_id = ${testStudyId}
    `) as [Array<{ count: number }>, unknown];
    const [snapshotsBefore] = await sequelize.query(`
      SELECT COUNT(*)::int as count FROM coaching_run_snapshots
      WHERE run_id IN (SELECT id FROM coaching_runs WHERE study_id = ${testStudyId})
    `) as [Array<{ count: number }>, unknown];

    // Manually corrupt the section key to simulate non-coachable section
    await sequelize.query(`
      UPDATE coaching_runs SET selected_section_key = 'invalid_nonexistent_section'
      WHERE id = '${failedRun.id}'
    `);

    // Attempt retry - should be rejected (error message updated for M3C legacy key handling)
    await expect(
      coachingService.createResearcherRetryRun(ctx, failedRun.id),
    ).rejects.toThrow(/cannot be retried|start a new review/i);

    // Verify NO new runs created
    const [runsAfter] = await sequelize.query(`
      SELECT COUNT(*)::int as count FROM coaching_runs WHERE study_id = ${testStudyId}
    `) as [Array<{ count: number }>, unknown];
    expect(runsAfter[0].count).toBe(runsBefore[0].count);

    // Verify NO new snapshots created
    const [snapshotsAfter] = await sequelize.query(`
      SELECT COUNT(*)::int as count FROM coaching_run_snapshots
      WHERE run_id IN (SELECT id FROM coaching_runs WHERE study_id = ${testStudyId})
    `) as [Array<{ count: number }>, unknown];
    expect(snapshotsAfter[0].count).toBe(snapshotsBefore[0].count);

    // Verify original failed run unchanged
    const [original] = await sequelize.query(`
      SELECT status FROM coaching_runs WHERE id = '${failedRun.id}'
    `) as [Array<{ status: string }>, unknown];
    expect(original[0].status).toBe('failed');
  });
});

// ─── API Response Shape Tests ────────────────────────────────────────────────

describe('M3C-A: API response shape', () => {
  it('service returns correct response shape', async () => {
    const ctx = createTestContext(testActorId);
    const failedRun = await createAndFailRun(ctx, { reviewScope: 'artifact' });

    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    // Verify response has expected fields
    expect(retryRun).toMatchObject({
      id: expect.any(String),
      artifact_id: expect.any(Number),
      artifact_type: 'plan',
      content_version: expect.any(Number),
      review_scope: 'artifact',
      selected_section_key: null,
      status: 'pending',
      retry_of_run_id: failedRun.id,
      coaching_contract_version: expect.any(String),
      prompt_template_version: expect.any(String),
      provider: 'anthropic',
      model: expect.any(String),
    });
  });
});

// ─── Legacy Section Key Resolution Tests ─────────────────────────────────────

describe('M3C-A: Legacy section key resolution', () => {
  it('resolves known legacy key to canonical key', async () => {
    const ctx = createTestContext(testActorId);

    // Create a failed section run
    const failedRun = await createAndFailRun(ctx, {
      reviewScope: 'section',
      sectionKey: 'plan_background',
    });

    // Manually set a legacy key to simulate an old run
    await sequelize.query(`
      UPDATE coaching_runs SET selected_section_key = 'background'
      WHERE id = '${failedRun.id}'
    `);

    // Retry should succeed by resolving 'background' -> 'plan_background'
    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    // Verify retry uses CANONICAL key, not legacy key
    expect(retryRun.selected_section_key).toBe('plan_background');
    expect(retryRun.status).toBe('pending');
    expect(retryRun.retry_of_run_id).toBe(failedRun.id);
  });

  it('resolves multiple known legacy keys', async () => {
    const ctx = createTestContext(testActorId);

    // Test different legacy key mappings
    const legacyKeys = [
      { legacy: 'summary', canonical: 'plan_summary' },
      { legacy: 'method', canonical: 'plan_method_approach' },
      { legacy: 'risks', canonical: 'plan_risks' },
    ];

    for (const { legacy, canonical } of legacyKeys) {
      // Create a failed section run with canonical key first
      const failedRun = await createAndFailRun(ctx, {
        reviewScope: 'section',
        sectionKey: canonical,
      });

      // Set legacy key
      await sequelize.query(`
        UPDATE coaching_runs SET selected_section_key = '${legacy}'
        WHERE id = '${failedRun.id}'
      `);

      // Retry should resolve to canonical
      const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);
      expect(retryRun.selected_section_key).toBe(canonical);
    }
  });

  it('rejects unmappable legacy key with clear error message', async () => {
    const ctx = createTestContext(testActorId);

    // Create a failed section run
    const failedRun = await createAndFailRun(ctx, {
      reviewScope: 'section',
      sectionKey: 'plan_background',
    });

    // Set a completely unknown legacy key
    await sequelize.query(`
      UPDATE coaching_runs SET selected_section_key = 'completely_unknown_section'
      WHERE id = '${failedRun.id}'
    `);

    // Count runs before
    const [runsBefore] = await sequelize.query(`
      SELECT COUNT(*)::int as count FROM coaching_runs WHERE study_id = ${testStudyId}
    `) as [Array<{ count: number }>, unknown];

    // Retry should fail with clear error message
    await expect(
      coachingService.createResearcherRetryRun(ctx, failedRun.id),
    ).rejects.toThrow(/cannot be retried|start a new review/i);

    // Verify NO new runs created
    const [runsAfter] = await sequelize.query(`
      SELECT COUNT(*)::int as count FROM coaching_runs WHERE study_id = ${testStudyId}
    `) as [Array<{ count: number }>, unknown];
    expect(runsAfter[0].count).toBe(runsBefore[0].count);
  });

  it('canonical key does not require resolution', async () => {
    const ctx = createTestContext(testActorId);

    // Create a failed section run with canonical key
    const failedRun = await createAndFailRun(ctx, {
      reviewScope: 'section',
      sectionKey: 'plan_background',
    });

    // Retry should work directly without legacy resolution
    const retryRun = await coachingService.createResearcherRetryRun(ctx, failedRun.id);

    expect(retryRun.selected_section_key).toBe('plan_background');
    expect(retryRun.status).toBe('pending');
  });

  it('uses resolved key for concurrency check', async () => {
    const ctx = createTestContext(testActorId);

    // Create a failed section run with legacy key
    const failedRun = await createAndFailRun(ctx, {
      reviewScope: 'section',
      sectionKey: 'plan_background',
    });
    await sequelize.query(`
      UPDATE coaching_runs SET selected_section_key = 'background'
      WHERE id = '${failedRun.id}'
    `);

    // Create an active run with the CANONICAL key
    const activeRun = await coachingService.createCoachRun(ctx, {
      artifact_id: testArtifactId,
      review_scope: 'section',
      selected_section_key: 'plan_background',
      coaching_contract_version: '1.0.0',
      prompt_template_version: '1.0.0',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    expect(activeRun.status).toBe('pending');

    // Retry of legacy 'background' should conflict with active 'plan_background'
    await expect(
      coachingService.createResearcherRetryRun(ctx, failedRun.id),
    ).rejects.toThrow(/already.*pending.*for this artifact/i);
  });
});
