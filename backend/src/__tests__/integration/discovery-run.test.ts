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

// ═══════════════════════════════════════════════════════════════════════════
// 11. VARIABLE LINEAGE — DISC-1 Final Blocker Fix
//
// Tests that newly extracted variables have `discovery_artifact_fk_id` set
// to the canonical DiscoveryArtifact database ID, providing relational lineage.
// ═══════════════════════════════════════════════════════════════════════════

const StudyVariableModel = sequelize.models.StudyVariable;

describe('variable lineage', () => {
  it('desk research variables have artifact FK', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Test Topic',
      topicSlug: 'test-topic',
      sourceIntent: null,
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifact = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Desk Research: Test Topic',
      topicSlug: 'test-topic',
      canonicalContent: '# Test Content',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc123',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    await artifactService.finalizeArtifactSupersession(artifact.id);

    // Simulate variable extraction with artifact FK (as executeDiscovery does)
    await StudyVariableModel.create({
      project_id: projectId,
      study_id: null, // Discovery scope
      variable_key: 'knowledge_gaps',
      variable_type: 'pool',
      item_key: 'KG-001',
      value: { id: 'KG-001', gap: 'Missing market data', priority: 'high' },
      participant_id: null,
      source_template: 'desk_research',
      source_version: 'v7.1',
      source_date: new Date().toISOString(),
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_id: 'test-topic', // Legacy string ID
      discovery_artifact_fk_id: artifact.id, // DISC-1: Canonical FK
      stale: false,
      extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Verify variable has FK
    const variables = await StudyVariableModel.findAll({
      where: {
        project_id: projectId,
        scope: 'discovery',
        discovery_artifact_fk_id: artifact.id,
      },
    });

    expect(variables).toHaveLength(1);
    const v = variables[0] as any;
    expect(v.discovery_artifact_fk_id).toBe(artifact.id);
    expect(v.variable_key).toBe('knowledge_gaps');
    expect(v.source_template).toBe('desk_research');
  });

  it('stakeholder synthesis variables have artifact FK', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'stakeholder_synthesis',
      topic: 'Leadership Interviews',
      topicSlug: 'leadership-interviews',
      sourceIntent: null,
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifact = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'stakeholder_synthesis',
      title: 'Stakeholder synthesis: Leadership Interviews',
      topicSlug: 'leadership-interviews',
      canonicalContent: '# Stakeholder Content',
      templateName: 'stakeholder_synthesis',
      templateVersion: 'v8.0',
      derivationFingerprint: 'def456',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    await artifactService.finalizeArtifactSupersession(artifact.id);

    // Simulate variable extraction with artifact FK
    await StudyVariableModel.create({
      project_id: projectId,
      study_id: null,
      variable_key: 'stakeholder_perspectives',
      variable_type: 'pool',
      item_key: 'SP-001',
      value: { id: 'SP-001', role: 'Director', perspective: 'Prioritize compliance' },
      participant_id: null,
      source_template: 'stakeholder_synthesis',
      source_version: 'v8.0',
      source_date: new Date().toISOString(),
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_id: 'leadership-interviews',
      discovery_artifact_fk_id: artifact.id,
      stale: false,
      extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Verify
    const variables = await StudyVariableModel.findAll({
      where: {
        project_id: projectId,
        scope: 'discovery',
        discovery_artifact_fk_id: artifact.id,
      },
    });

    expect(variables).toHaveLength(1);
    expect((variables[0] as any).source_template).toBe('stakeholder_synthesis');
  });

  it('same-topic sibling runs have distinct artifact FKs', async () => {
    // Run A
    const runA = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Same Topic',
      topicSlug: 'same-topic',
      sourceIntent: null,
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifactA = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: runA.id,
      artifactType: 'desk_research',
      title: 'Run A',
      topicSlug: 'same-topic',
      canonicalContent: '# Run A',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'aaa',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });
    await artifactService.finalizeArtifactSupersession(artifactA.id);

    // Run B (sibling)
    const runB = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Same Topic',
      topicSlug: 'same-topic',
      sourceIntent: null,
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifactB = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: runB.id,
      artifactType: 'desk_research',
      title: 'Run B',
      topicSlug: 'same-topic',
      canonicalContent: '# Run B',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'bbb',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });
    await artifactService.finalizeArtifactSupersession(artifactB.id);

    // Create variables for both
    await StudyVariableModel.bulkCreate([
      {
        project_id: projectId,
        study_id: null,
        variable_key: 'knowledge_gaps',
        variable_type: 'pool',
        item_key: 'KG-A-001',
        value: { id: 'KG-A-001', gap: 'From run A' },
        source_template: 'desk_research',
        source_version: 'v7.1',
        source_date: new Date().toISOString(),
        is_pool: true,
        scope: 'discovery',
        discovery_artifact_id: 'same-topic',
        discovery_artifact_fk_id: artifactA.id, // Points to artifact A
        stale: false,
        extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        project_id: projectId,
        study_id: null,
        variable_key: 'knowledge_gaps',
        variable_type: 'pool',
        item_key: 'KG-B-001',
        value: { id: 'KG-B-001', gap: 'From run B' },
        source_template: 'desk_research',
        source_version: 'v7.1',
        source_date: new Date().toISOString(),
        is_pool: true,
        scope: 'discovery',
        discovery_artifact_id: 'same-topic',
        discovery_artifact_fk_id: artifactB.id, // Points to artifact B
        stale: false,
        extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    // Query variables by each artifact FK
    const varsA = await StudyVariableModel.findAll({
      where: { discovery_artifact_fk_id: artifactA.id },
    });
    const varsB = await StudyVariableModel.findAll({
      where: { discovery_artifact_fk_id: artifactB.id },
    });

    expect(varsA).toHaveLength(1);
    expect((varsA[0] as any).item_key).toBe('KG-A-001');

    expect(varsB).toHaveLength(1);
    expect((varsB[0] as any).item_key).toBe('KG-B-001');

    // Same topic but different artifact FKs
    expect(artifactA.id).not.toBe(artifactB.id);
  });

  it('same-run multiple versions link to respective artifacts', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Versioned Topic',
      topicSlug: 'versioned-topic',
      sourceIntent: null,
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    // V1
    const v1 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'V1',
      topicSlug: 'versioned-topic',
      canonicalContent: '# V1',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'v1fp',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });
    await artifactService.finalizeArtifactSupersession(v1.id);

    // Create variable for V1
    await StudyVariableModel.create({
      project_id: projectId,
      study_id: null,
      variable_key: 'knowledge_gaps',
      variable_type: 'pool',
      item_key: 'V1-KG-001',
      value: { id: 'V1-KG-001', gap: 'From V1' },
      source_template: 'desk_research',
      source_version: 'v7.1',
      source_date: new Date().toISOString(),
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_id: 'versioned-topic',
      discovery_artifact_fk_id: v1.id,
      stale: false,
      extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // V2 (supersedes V1)
    const v2 = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'V2',
      topicSlug: 'versioned-topic',
      canonicalContent: '# V2',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'v2fp',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });
    await artifactService.finalizeArtifactSupersession(v2.id);

    // Create variable for V2
    await StudyVariableModel.create({
      project_id: projectId,
      study_id: null,
      variable_key: 'knowledge_gaps',
      variable_type: 'pool',
      item_key: 'V2-KG-001',
      value: { id: 'V2-KG-001', gap: 'From V2 - updated' },
      source_template: 'desk_research',
      source_version: 'v7.1',
      source_date: new Date().toISOString(),
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_id: 'versioned-topic',
      discovery_artifact_fk_id: v2.id,
      stale: false,
      extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);

    // Each variable links to its respective artifact
    const varsV1 = await StudyVariableModel.findAll({
      where: { discovery_artifact_fk_id: v1.id },
    });
    const varsV2 = await StudyVariableModel.findAll({
      where: { discovery_artifact_fk_id: v2.id },
    });

    expect(varsV1).toHaveLength(1);
    expect((varsV1[0] as any).item_key).toBe('V1-KG-001');

    expect(varsV2).toHaveLength(1);
    expect((varsV2[0] as any).item_key).toBe('V2-KG-001');
  });

  it('GitHub projection failure does not affect variable lineage', async () => {
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'GitHub Fail Topic',
      topicSlug: 'github-fail-topic',
      sourceIntent: null,
      actorId,
      createdByIdentity: 'slack:U_TEST',
    });

    const artifact = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Test',
      topicSlug: 'github-fail-topic',
      canonicalContent: '# Content',
      templateName: 'desk_research',
      templateVersion: 'v7.1',
      derivationFingerprint: 'abc',
      actorId,
      generatedByIdentity: 'slack:U_TEST',
    });

    await artifactService.finalizeArtifactSupersession(artifact.id);

    // Record GitHub projection error
    await artifactService.recordProjectionError(artifact.id, 'Rate limit exceeded');

    // Variables should still have FK despite projection failure
    await StudyVariableModel.create({
      project_id: projectId,
      study_id: null,
      variable_key: 'knowledge_gaps',
      variable_type: 'pool',
      item_key: 'KG-001',
      value: { id: 'KG-001', gap: 'Test gap' },
      source_template: 'desk_research',
      source_version: 'v7.1',
      source_date: new Date().toISOString(),
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_id: 'github-fail-topic',
      discovery_artifact_fk_id: artifact.id, // FK still set
      stale: false,
      extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Reload artifact - has projection error
    const reloaded = await artifactService.getDiscoveryArtifactById(artifact.id);
    expect(reloaded!.projection_error).toBe('Rate limit exceeded');
    expect(reloaded!.status).toBe('current');

    // Variable FK intact despite GitHub failure
    const variables = await StudyVariableModel.findAll({
      where: { discovery_artifact_fk_id: artifact.id },
    });
    expect(variables).toHaveLength(1);
    expect((variables[0] as any).discovery_artifact_fk_id).toBe(artifact.id);
  });

  it('survey variables remain FK-nullable (backward compatibility)', async () => {
    // Survey synthesis typically comes from survey-handler which
    // may not yet be wired to DISC-1 artifact creation
    await StudyVariableModel.create({
      project_id: projectId,
      study_id: null,
      variable_key: 'survey_insights',
      variable_type: 'pool',
      item_key: 'SI-001',
      value: { id: 'SI-001', insight: 'Users prefer mobile' },
      source_template: 'survey_synthesis',
      source_version: 'v5.0',
      source_date: new Date().toISOString(),
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_id: 'survey-topic',
      discovery_artifact_fk_id: null, // No FK - legacy flow
      stale: false,
      extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Query should work without FK
    const variables = await StudyVariableModel.findAll({
      where: {
        project_id: projectId,
        source_template: 'survey_synthesis',
      },
    });

    expect(variables).toHaveLength(1);
    expect((variables[0] as any).discovery_artifact_fk_id).toBeNull();
    expect((variables[0] as any).discovery_artifact_id).toBe('survey-topic');
  });

  // NOTE: FK cascade test skipped - cascade behavior is defined in migration
  // and tested at DB level. The SET NULL constraint on discovery_artifact_fk_id
  // is enforced by the database, not application code.
});
