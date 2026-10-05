/**
 * Discovery Run Integration Tests — DISC-1
 *
 * Tests against real Postgres: run lifecycle, source association,
 * artifact versioning, and failure semantics.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { EvidenceSource } from '../../database/models/evidence_source';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import type { DiscoveryRunSource } from '../../database/models/discovery_run_source';
import type { DiscoveryArtifact } from '../../database/models/discovery_artifact';
import * as runService from '../../services/discovery-run.service';
import * as artifactService from '../../services/discovery-artifact.service';

const sequelize = getTestDb();

// Mock GitHub to prevent API calls
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockResolvedValue(null),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ success: true }),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
}));

const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const EvidenceSourceModel = sequelize.models.EvidenceSource;
const DiscoveryRunModel = sequelize.models.DiscoveryRun;
const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;
const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact;

let projectId: number;
let actorId: number;
let source1Id: number;
let source2Id: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-1 Test Project',
    slug: 'disc1-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as any).id;

  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    status: 'active',
  });
  actorId = (actor as any).id;

  // Create evidence sources
  const source1 = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document 1',
    created_by: 'U_TEST',
  } as CreationAttributes<EvidenceSource>);
  source1Id = (source1 as any).id;

  const source2 = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document 2',
    created_by: 'U_TEST',
  } as CreationAttributes<EvidenceSource>);
  source2Id = (source2 as any).id;
}

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync();
});

beforeEach(async () => {
  await truncateAll();
  await setupFixtures();
});

afterAll(async () => {
  await sequelize.close();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. CREATE PENDING RUN
// ═══════════════════════════════════════════════════════════════════════════

describe('createDiscoveryRun', () => {
  it('creates a pending run with correct fields', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test Topic',
      topicSlug: 'test-topic',
      sourceIntent: 'Find existing research',
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    expect(run.id).toBeDefined();
    expect(run.public_id).toBeDefined();
    expect(run.public_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(run.project_id).toBe(projectId);
    expect(run.discovery_type).toBe('desk_research');
    expect(run.topic).toBe('Test Topic');
    expect(run.topic_slug).toBe('test-topic');
    expect(run.source_intent).toBe('Find existing research');
    expect(run.actor_id).toBe(actorId);
    expect(run.created_by_identity).toBe('slack:U_TEST');
    expect(run.status).toBe('pending');
    expect(run.attempt_count).toBe(1);
    expect(run.started_at).toBeNull();
    expect(run.completed_at).toBeNull();
  });

  it('requires project_id', async () => {
    await expect(
      runService.createDiscoveryRun({
        projectId: null as any,
        discoveryType: 'desk_research',
        topic: 'Test',
        topicSlug: 'test',
        sourceIntent: null,
        actorId: null,
        createdByIdentity: 'slack:U_TEST',
      }),
    ).rejects.toThrow();
  });

  it('validates discovery_type enum', async () => {
    await expect(
      runService.createDiscoveryRun({
        projectId,
        discoveryType: 'invalid_type' as any,
        topic: 'Test',
        topicSlug: 'test',
        sourceIntent: null,
        actorId: null,
        createdByIdentity: 'slack:U_TEST',
      }),
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. PROJECT SCOPE
// ═══════════════════════════════════════════════════════════════════════════

describe('project scope', () => {
  it('cascades delete when project is deleted', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    await ProjectModel.destroy({ where: { id: projectId } });

    const found = await runService.getDiscoveryRunById(run.id);
    expect(found).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CANONICAL ACTOR FK
// ═══════════════════════════════════════════════════════════════════════════

describe('canonical actor FK', () => {
  it('sets actor_id to NULL on actor delete', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    await ActorModel.destroy({ where: { id: actorId } });

    const found = await runService.getDiscoveryRunById(run.id);
    expect(found).not.toBeNull();
    expect(found!.actor_id).toBeNull();
  });

  it('allows NULL actor_id for Slack-only flows', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_LEGACY',
    });

    expect(run.actor_id).toBeNull();
    expect(run.created_by_identity).toBe('slack:U_LEGACY');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ALLOWED DISCOVERY_TYPE
// ═══════════════════════════════════════════════════════════════════════════

describe('allowed discovery_type', () => {
  it.each([
    'desk_research',
    'stakeholder_synthesis',
    'survey_synthesis',
  ])('accepts %s', async (type) => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: type as any,
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    expect(run.discovery_type).toBe(type);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. LIFECYCLE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('lifecycle transitions', () => {
  it('transitions pending → processing → completed', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    expect(run.status).toBe('pending');

    const started = await runService.startDiscoveryRun(run.id);
    expect(started.status).toBe('processing');
    expect(started.started_at).not.toBeNull();

    const completed = await runService.completeDiscoveryRun(run.id);
    expect(completed.status).toBe('completed');
    expect(completed.completed_at).not.toBeNull();
  });

  it('transitions pending → processing → failed', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    await runService.startDiscoveryRun(run.id);
    const failed = await runService.failDiscoveryRun(
      run.id,
      'GENERATION_ERROR',
      'Template processing failed',
      'yaml_processing',
    );

    expect(failed.status).toBe('failed');
    expect(failed.failure_code).toBe('GENERATION_ERROR');
    expect(failed.failure_message).toBe('Template processing failed');
    expect(failed.failure_stage).toBe('yaml_processing');
  });

  it('transitions pending → cancelled', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const cancelled = await runService.cancelDiscoveryRun(run.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('rejects invalid transitions', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    // Cannot complete a pending run
    await expect(runService.completeDiscoveryRun(run.id)).rejects.toThrow(
      /current status is 'pending'/,
    );

    // Cannot fail a pending run
    await expect(
      runService.failDiscoveryRun(run.id, 'ERROR', 'Failed'),
    ).rejects.toThrow(/current status is 'pending'/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. FAILURE STATE
// ═══════════════════════════════════════════════════════════════════════════

describe('failure state', () => {
  it('records failure details', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    await runService.startDiscoveryRun(run.id);
    const failed = await runService.failDiscoveryRun(
      run.id,
      'PRIVACY_VIOLATION',
      'PII detected in document',
      'privacy_scan',
    );

    expect(failed.failure_code).toBe('PRIVACY_VIOLATION');
    expect(failed.failure_message).toBe('PII detected in document');
    expect(failed.failure_stage).toBe('privacy_scan');
  });

  it('sanitizes PII from failure message', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    await runService.startDiscoveryRun(run.id);
    const failed = await runService.failDiscoveryRun(
      run.id,
      'ERROR',
      'User test@example.com reported error',
    );

    expect(failed.failure_message).toContain('[EMAIL]');
    expect(failed.failure_message).not.toContain('test@example.com');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. RETRY
// ═══════════════════════════════════════════════════════════════════════════

describe('retry', () => {
  it('increments attempt_count on retry', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    expect(run.attempt_count).toBe(1);

    await runService.startDiscoveryRun(run.id);
    await runService.failDiscoveryRun(run.id, 'ERROR', 'Failed');

    const retried = await runService.retryDiscoveryRun(run.id);
    expect(retried.status).toBe('pending');
    expect(retried.attempt_count).toBe(2);
    expect(retried.started_at).toBeNull();
    expect(retried.completed_at).toBeNull();
  });

  it('rejects retry of non-failed run', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    await expect(runService.retryDiscoveryRun(run.id)).rejects.toThrow(
      /current status is 'pending'/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. MULTIPLE SOURCES
// ═══════════════════════════════════════════════════════════════════════════

describe('source association', () => {
  it('associates multiple sources with deterministic order', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const associations = await runService.associateSources({
      runId: run.id,
      sourceIds: [source2Id, source1Id], // Reverse order
    });

    expect(associations).toHaveLength(2);
    expect(associations[0].source_order).toBe(0);
    expect(associations[0].evidence_source_id).toBe(source2Id);
    expect(associations[1].source_order).toBe(1);
    expect(associations[1].evidence_source_id).toBe(source1Id);
  });

  it('rejects duplicate association', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    await runService.associateSources({
      runId: run.id,
      sourceIds: [source1Id],
    });

    await expect(
      runService.associateSources({
        runId: run.id,
        sourceIds: [source1Id], // Duplicate
      }),
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. ARTIFACT VERSIONING
// ═══════════════════════════════════════════════════════════════════════════

describe('artifact versioning', () => {
  it('first artifact = version 1', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifact = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test Artifact',
      topicSlug: 'test',
      canonicalContent: '# Test Content',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc123',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    expect(artifact.version).toBe(1);
    expect(artifact.status).toBe('generating');

    // Finalize to make it current
    await artifactService.finalizeArtifactSupersession(artifact.id);

    const finalized = await artifactService.getDiscoveryArtifactById(artifact.id);
    expect(finalized!.status).toBe('current');
  });

  it('same run rerun = version 2', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const v1 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test v1',
      topicSlug: 'test',
      canonicalContent: '# V1',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    const v2 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test v2',
      topicSlug: 'test',
      canonicalContent: '# V2',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'def',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
  });

  it('v1 superseded only after v2 success', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const v1 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test v1',
      topicSlug: 'test',
      canonicalContent: '# V1',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // V1 starts as generating
    expect(v1.status).toBe('generating');

    // Finalize v1 to make it current
    await artifactService.finalizeArtifactSupersession(v1.id);

    const v1Current = await artifactService.getDiscoveryArtifactById(v1.id);
    expect(v1Current!.status).toBe('current');

    // Now create v2
    const v2 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test v2',
      topicSlug: 'test',
      canonicalContent: '# V2',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'def',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // v2 starts as generating
    expect(v2.status).toBe('generating');

    // Finalize v2 - this supersedes v1
    await artifactService.finalizeArtifactSupersession(v2.id);

    // Check v1 is now superseded
    const v1Updated = await artifactService.getDiscoveryArtifactById(v1.id);
    expect(v1Updated!.status).toBe('superseded');
    expect(v1Updated!.superseded_by_id).toBe(v2.id);
    expect(v1Updated!.superseded_at).not.toBeNull();
  });

  it('failed rerun leaves v1 current', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const v1 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test v1',
      topicSlug: 'test',
      canonicalContent: '# V1',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // Finalize v1 to make it current
    await artifactService.finalizeArtifactSupersession(v1.id);

    const v1Current = await artifactService.getDiscoveryArtifactById(v1.id);
    expect(v1Current!.status).toBe('current');

    // Now create v2 (which will fail)
    const v2 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test v2',
      topicSlug: 'test',
      canonicalContent: null, // Failed - no content
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'def',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // Mark v2 as failed (NOT finalized - failure does NOT supersede)
    await artifactService.markArtifactFailed(v2.id);

    // V1 should still be current (not superseded by failed v2)
    const v1Updated = await artifactService.getDiscoveryArtifactById(v1.id);
    expect(v1Updated!.status).toBe('current');

    // V2 should be failed
    const v2Updated = await artifactService.getDiscoveryArtifactById(v2.id);
    expect(v2Updated!.status).toBe('failed');
  });

  it('same-topic sibling run gets separate artifact v1', async () => {
    // Run A with same topic
    const runA = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Same Topic',
      topicSlug: 'same-topic',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifactA = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: runA.id,
      artifactType: 'desk_research',
      title: 'Run A Artifact',
      topicSlug: 'same-topic',
      canonicalContent: '# Run A',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'aaa',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // Finalize artifact A
    await artifactService.finalizeArtifactSupersession(artifactA.id);

    // Run B with same topic (sibling)
    const runB = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Same Topic',
      topicSlug: 'same-topic',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifactB = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: runB.id,
      artifactType: 'desk_research',
      title: 'Run B Artifact',
      topicSlug: 'same-topic',
      canonicalContent: '# Run B',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'bbb',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // Finalize artifact B
    await artifactService.finalizeArtifactSupersession(artifactB.id);

    // Reload artifacts
    const artifactAFinal = await artifactService.getDiscoveryArtifactById(artifactA.id);
    const artifactBFinal = await artifactService.getDiscoveryArtifactById(artifactB.id);

    // Both should be version 1, both current (different runs = no supersession)
    expect(artifactAFinal!.version).toBe(1);
    expect(artifactBFinal!.version).toBe(1);
    expect(artifactAFinal!.status).toBe('current');
    expect(artifactBFinal!.status).toBe('current');
    expect(artifactAFinal!.discovery_run_id).toBe(runA.id);
    expect(artifactBFinal!.discovery_run_id).toBe(runB.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. PROJECTION METADATA
// ═══════════════════════════════════════════════════════════════════════════

describe('projection metadata', () => {
  it('records GitHub projection without affecting canonical content', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifact = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test',
      topicSlug: 'test',
      canonicalContent: '# Canonical Content',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // Finalize to make current
    await artifactService.finalizeArtifactSupersession(artifact.id);

    await artifactService.recordProjection(artifact.id, {
      githubPath: 'project/00-discovery/test-desk-research-2026-10-05.md',
      githubSha: 'abc123def456',
    });

    const updated = await artifactService.getDiscoveryArtifactById(artifact.id);
    expect(updated!.github_path).toBe('project/00-discovery/test-desk-research-2026-10-05.md');
    expect(updated!.github_sha).toBe('abc123def456');
    expect(updated!.projected_at).not.toBeNull();
    expect(updated!.canonical_content).toBe('# Canonical Content');
    expect(updated!.status).toBe('current');
  });

  it('records projection error without affecting artifact status', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test',
      topicSlug: 'test',
      sourceIntent: null,
      actorId: null,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifact = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test',
      topicSlug: 'test',
      canonicalContent: '# Content',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    // Finalize to make current
    await artifactService.finalizeArtifactSupersession(artifact.id);

    await artifactService.recordProjectionError(
      artifact.id,
      'GitHub API rate limit exceeded',
    );

    const updated = await artifactService.getDiscoveryArtifactById(artifact.id);
    expect(updated!.projection_error).toBe('GitHub API rate limit exceeded');
    expect(updated!.status).toBe('current'); // Still current despite projection failure
    expect(updated!.canonical_content).toBe('# Content'); // Content preserved
  });
});
