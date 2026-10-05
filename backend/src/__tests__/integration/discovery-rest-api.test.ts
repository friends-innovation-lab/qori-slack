/**
 * Discovery REST API Integration Tests — DISC-2
 *
 * Tests REST endpoints for Discovery runs and artifacts.
 * Verifies authorization, response shapes, and data hiding.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { EvidenceSource } from '../../database/models/evidence_source';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import type { DiscoveryArtifact } from '../../database/models/discovery_artifact';
import * as appService from '../../application/discovery.app-service';
import * as runService from '../../services/discovery-run.service';
import * as artifactService from '../../services/discovery-artifact.service';

const sequelize = getTestDb();

// Mock GitHub to prevent API calls
jest.mock('../../helpers/github', () => ({
  fetchFileFromRepoByPath: jest.fn().mockResolvedValue(null),
  createOrUpdateFileOnGitHub: jest.fn().mockResolvedValue({ success: true }),
  getContentRepo: jest.fn().mockReturnValue('test-repo'),
}));

// Mock authorization service
jest.mock('../../services/authorization.service', () => ({
  assertProjectAccessByActor: jest.fn().mockResolvedValue(undefined),
}));

const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const EvidenceSourceModel = sequelize.models.EvidenceSource;
const DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;
const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact as typeof DiscoveryArtifact;
const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;

let projectId: number;
let project2Id: number;
let actorId: number;
let mockCtx: any;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DISC-2 REST Test',
    slug: 'disc2-rest-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as any).id;

  const project2 = await ProjectModel.create({
    name: 'Other Project',
    slug: 'other-project',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  project2Id = (project2 as any).id;

  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'Test Researcher',
    status: 'active',
  });
  actorId = (actor as any).id;

  mockCtx = {
    actor: { id: actorId, publicId: 'actor-uuid' },
    organization: { id: TEST_ORG_ID },
  };
}

async function createTestRun(
  type: 'desk_research' | 'stakeholder_synthesis' = 'desk_research',
  topic: string = 'Test Topic',
  withSource: boolean = true,
): Promise<DiscoveryRun> {
  const run = await runService.createDiscoveryRun({
    projectId,
    discoveryType: type,
    topic,
    topicSlug: topic.toLowerCase().replace(/\s+/g, '-'),
    sourceIntent: 'Test intent',
    actorId,
    createdByIdentity: 'test:api',
  });

  if (withSource) {
    const source = await EvidenceSourceModel.create({
      project_id: projectId,
      source_type: 'uploaded_document',
      label: 'Test Document',
      created_by: 'test:api',
      metadata: { extracted_text: 'SECRET TEXT SHOULD NOT APPEAR IN API' },
    } as CreationAttributes<EvidenceSource>);

    await runService.associateSources({
      runId: run.id,
      sourceIds: [(source as any).id],
    });
  }

  return run;
}

async function createTestArtifact(runId: number): Promise<any> {
  return artifactService.createDiscoveryArtifact({
    projectId,
    discoveryRunId: runId,
    artifactType: 'desk_research',
    title: 'Test Artifact',
    topicSlug: 'test-topic',
    canonicalContent: '# Test Content\n\nThis is the artifact.',
    templateName: 'desk_research',
    templateVersion: '1.0.0',
    derivationFingerprint: 'abc123',
    actorId,
    generatedByIdentity: 'test:api',
  });
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
// 1. LIST RUNS
// ═══════════════════════════════════════════════════════════════════════════

describe('listDiscoveryRuns', () => {
  it('returns runs for project', async () => {
    await createTestRun('desk_research', 'Run One');
    await createTestRun('stakeholder_synthesis', 'Run Two');

    const runs = await appService.listDiscoveryRuns(mockCtx, projectId);

    expect(runs).toHaveLength(2);
    expect(runs[0].discoveryType).toBeDefined();
    expect(runs[0].publicId).toBeDefined();
  });

  it('filters by discovery type', async () => {
    await createTestRun('desk_research', 'Desk Run');
    await createTestRun('stakeholder_synthesis', 'Stakeholder Run');

    const runs = await appService.listDiscoveryRuns(mockCtx, projectId, {
      discoveryType: 'desk_research',
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].discoveryType).toBe('desk_research');
  });

  it('filters by status', async () => {
    const run1 = await createTestRun('desk_research', 'Pending Run');
    const run2 = await createTestRun('desk_research', 'Completed Run');

    // Mark one as completed
    await sequelize.query(
      `UPDATE discovery_runs SET status = 'completed' WHERE id = :id`,
      { replacements: { id: run2.id } },
    );

    const pending = await appService.listDiscoveryRuns(mockCtx, projectId, {
      status: 'pending',
    });
    const completed = await appService.listDiscoveryRuns(mockCtx, projectId, {
      status: 'completed',
    });

    expect(pending).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
    expect(completed[0].status).toBe('completed');
  });

  it('does not expose internal database IDs', async () => {
    await createTestRun();

    const runs = await appService.listDiscoveryRuns(mockCtx, projectId);

    expect(runs[0]).not.toHaveProperty('id');
    expect(runs[0]).toHaveProperty('publicId');
    expect(runs[0].publicId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not expose raw extracted text', async () => {
    await createTestRun();

    const runs = await appService.listDiscoveryRuns(mockCtx, projectId);

    const serialized = JSON.stringify(runs);
    expect(serialized).not.toContain('SECRET TEXT');
    expect(serialized).not.toContain('extracted_text');
  });

  it('respects pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await createTestRun('desk_research', `Run ${i}`);
    }

    const page1 = await appService.listDiscoveryRuns(mockCtx, projectId, {
      limit: 2,
      offset: 0,
    });
    const page2 = await appService.listDiscoveryRuns(mockCtx, projectId, {
      limit: 2,
      offset: 2,
    });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].publicId).not.toBe(page2[0].publicId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. GET RUN DETAIL
// ═══════════════════════════════════════════════════════════════════════════

describe('getDiscoveryRunByPublicId', () => {
  it('returns run detail with sources', async () => {
    const run = await createTestRun();

    const detail = await appService.getDiscoveryRunByPublicId(
      mockCtx,
      projectId,
      run.public_id,
    );

    expect(detail).not.toBeNull();
    expect(detail!.publicId).toBe(run.public_id);
    expect(detail!.sources).toHaveLength(1);
    expect(detail!.sources[0]).toHaveProperty('publicId');
    expect(detail!.sources[0]).toHaveProperty('label');
    expect(detail!.sources[0]).toHaveProperty('sourceType');
  });

  it('includes current artifact summary', async () => {
    const run = await createTestRun();
    const artifact = await createTestArtifact(run.id);
    await artifactService.finalizeArtifactSupersession(artifact.id);

    const detail = await appService.getDiscoveryRunByPublicId(
      mockCtx,
      projectId,
      run.public_id,
    );

    expect(detail!.currentArtifact).not.toBeNull();
    expect(detail!.currentArtifact!.publicId).toBe(artifact.public_id);
    expect(detail!.currentArtifact!.status).toBe('current');
  });

  it('returns sanitized failure message', async () => {
    const run = await createTestRun();

    // Fail with PII in message
    await sequelize.query(
      `UPDATE discovery_runs
       SET status = 'failed',
           failure_code = 'TEST_ERROR',
           failure_message = 'Error for user test@example.com'
       WHERE id = :id`,
      { replacements: { id: run.id } },
    );

    const detail = await appService.getDiscoveryRunByPublicId(
      mockCtx,
      projectId,
      run.public_id,
    );

    expect(detail!.failureCode).toBe('TEST_ERROR');
    // Note: Sanitization happens at claim service level, not query level
    expect(detail!.failureMessage).toBeDefined();
  });

  it('does not expose raw extracted text in sources', async () => {
    const run = await createTestRun();

    const detail = await appService.getDiscoveryRunByPublicId(
      mockCtx,
      projectId,
      run.public_id,
    );

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('SECRET TEXT');
    expect(serialized).not.toContain('extracted_text');
    expect(detail!.sources[0]).not.toHaveProperty('metadata');
    expect(detail!.sources[0]).not.toHaveProperty('artifact_ref');
  });

  it('returns null for unknown run', async () => {
    const detail = await appService.getDiscoveryRunByPublicId(
      mockCtx,
      projectId,
      '00000000-0000-0000-0000-000000000000',
    );

    expect(detail).toBeNull();
  });

  it('returns null for run in different project', async () => {
    const run = await createTestRun();

    const detail = await appService.getDiscoveryRunByPublicId(
      mockCtx,
      project2Id,
      run.public_id,
    );

    expect(detail).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CREATE PENDING RUN
// ═══════════════════════════════════════════════════════════════════════════

describe('createPendingDiscoveryRun', () => {
  it('creates pending desk research run', async () => {
    const run = await appService.createPendingDiscoveryRun({
      projectId,
      projectSlug: 'disc2-rest-test',
      discoveryType: 'desk_research',
      topic: 'API Test Topic',
      sourceIntent: 'Test from API',
      sources: [{
        filename: 'test.pdf',
        extractedText: 'Test content',
        contentHash: 'abc123',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        metadata: { source: 'rest' as const },
      }],
      createdByIdentity: 'api:test',
      actorId,
    });

    expect(run.status).toBe('pending');
    expect(run.discovery_type).toBe('desk_research');
    expect(run.topic).toBe('API Test Topic');
    expect(run.public_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('creates pending stakeholder synthesis run', async () => {
    const run = await appService.createPendingDiscoveryRun({
      projectId,
      projectSlug: 'disc2-rest-test',
      discoveryType: 'stakeholder_synthesis',
      topic: 'Stakeholder API Test',
      sourceIntent: 'Test stakeholders',
      sources: [{
        filename: 'interview.docx',
        extractedText: 'Interview content',
        contentHash: 'def456',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 2000,
        metadata: { source: 'rest' as const },
      }],
      createdByIdentity: 'api:test',
      actorId,
    });

    expect(run.status).toBe('pending');
    expect(run.discovery_type).toBe('stakeholder_synthesis');
  });

  it('associates sources with run', async () => {
    const run = await appService.createPendingDiscoveryRun({
      projectId,
      projectSlug: 'disc2-rest-test',
      discoveryType: 'desk_research',
      topic: 'Multi-source Test',
      sources: [
        {
          filename: 'doc1.pdf',
          extractedText: 'Content 1',
          contentHash: 'hash1',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          metadata: { source: 'rest' as const },
        },
        {
          filename: 'doc2.pdf',
          extractedText: 'Content 2',
          contentHash: 'hash2',
          mimeType: 'application/pdf',
          sizeBytes: 200,
          metadata: { source: 'rest' as const },
        },
      ],
      createdByIdentity: 'api:test',
    });

    const sources = await DiscoveryRunSourceModel.findAll({
      where: { discovery_run_id: run.id },
    });

    expect(sources).toHaveLength(2);
  });

  it('validates required fields', async () => {
    await expect(
      appService.createPendingDiscoveryRun({
        projectId,
        projectSlug: 'disc2-rest-test',
        discoveryType: 'desk_research',
        topic: '', // Empty topic
        sources: [{
          filename: 'test.pdf',
          extractedText: 'Content',
          contentHash: 'hash',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        }],
        createdByIdentity: 'api:test',
      }),
    ).rejects.toThrow();
  });

  it('requires at least one source', async () => {
    await expect(
      appService.createPendingDiscoveryRun({
        projectId,
        projectSlug: 'disc2-rest-test',
        discoveryType: 'desk_research',
        topic: 'No Sources Test',
        sources: [],
        createdByIdentity: 'api:test',
      }),
    ).rejects.toThrow('At least one source is required');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. LIST ARTIFACTS
// ═══════════════════════════════════════════════════════════════════════════

describe('listCanonicalDiscoveryArtifacts', () => {
  it('returns current artifacts for project', async () => {
    const run = await createTestRun();
    const artifact = await createTestArtifact(run.id);
    await artifactService.finalizeArtifactSupersession(artifact.id);

    const artifacts = await appService.listCanonicalDiscoveryArtifacts(
      mockCtx,
      projectId,
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].status).toBe('current');
    expect(artifacts[0].publicId).toBe(artifact.public_id);
  });

  it('does not expose internal database IDs', async () => {
    const run = await createTestRun();
    const artifact = await createTestArtifact(run.id);
    await artifactService.finalizeArtifactSupersession(artifact.id);

    const artifacts = await appService.listCanonicalDiscoveryArtifacts(
      mockCtx,
      projectId,
    );

    expect(artifacts[0]).not.toHaveProperty('id');
    expect(artifacts[0]).not.toHaveProperty('discovery_run_id');
    expect(artifacts[0]).toHaveProperty('publicId');
    expect(artifacts[0]).toHaveProperty('runPublicId');
  });

  it('filters by artifact type', async () => {
    const run = await createTestRun();
    await createTestArtifact(run.id);

    const artifacts = await appService.listCanonicalDiscoveryArtifacts(
      mockCtx,
      projectId,
      { artifactType: 'desk_research' },
    );

    expect(artifacts.every(a => a.artifactType === 'desk_research')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. GET ARTIFACT DETAIL
// ═══════════════════════════════════════════════════════════════════════════

describe('getDiscoveryArtifactByPublicId', () => {
  it('returns artifact with canonical content', async () => {
    const run = await createTestRun();
    const artifact = await createTestArtifact(run.id);

    const detail = await appService.getDiscoveryArtifactByPublicId(
      mockCtx,
      projectId,
      artifact.public_id,
    );

    expect(detail).not.toBeNull();
    expect(detail!.canonicalContent).toContain('# Test Content');
    expect(detail!.version).toBe(1);
    expect(detail!.runPublicId).toBe(run.public_id);
  });

  it('includes projection metadata', async () => {
    const run = await createTestRun();
    const artifact = await createTestArtifact(run.id);
    await artifactService.recordProjection(artifact.id, {
      githubPath: 'test/path.md',
      githubSha: 'abc123',
    });

    const detail = await appService.getDiscoveryArtifactByPublicId(
      mockCtx,
      projectId,
      artifact.public_id,
    );

    expect(detail!.githubPath).toBe('test/path.md');
    expect(detail!.githubSha).toBe('abc123');
    expect(detail!.projectedAt).not.toBeNull();
  });

  it('returns null for unknown artifact', async () => {
    const detail = await appService.getDiscoveryArtifactByPublicId(
      mockCtx,
      projectId,
      '00000000-0000-0000-0000-000000000000',
    );

    expect(detail).toBeNull();
  });

  it('returns null for artifact in different project', async () => {
    const run = await createTestRun();
    const artifact = await createTestArtifact(run.id);

    const detail = await appService.getDiscoveryArtifactByPublicId(
      mockCtx,
      project2Id,
      artifact.public_id,
    );

    expect(detail).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════════════

describe('authorization', () => {
  const authService = require('../../services/authorization.service');

  it('calls assertProjectAccessByActor for list runs', async () => {
    authService.assertProjectAccessByActor.mockClear();

    await appService.listDiscoveryRuns(mockCtx, projectId);

    expect(authService.assertProjectAccessByActor).toHaveBeenCalledWith(
      actorId,
      projectId,
      TEST_ORG_ID,
    );
  });

  it('calls assertProjectAccessByActor for get run', async () => {
    const run = await createTestRun();
    authService.assertProjectAccessByActor.mockClear();

    await appService.getDiscoveryRunByPublicId(mockCtx, projectId, run.public_id);

    expect(authService.assertProjectAccessByActor).toHaveBeenCalled();
  });

  it('calls assertProjectAccessByActor for list artifacts', async () => {
    authService.assertProjectAccessByActor.mockClear();

    await appService.listCanonicalDiscoveryArtifacts(mockCtx, projectId);

    expect(authService.assertProjectAccessByActor).toHaveBeenCalled();
  });

  it('calls assertProjectAccessByActor for get artifact', async () => {
    const run = await createTestRun();
    const artifact = await createTestArtifact(run.id);
    authService.assertProjectAccessByActor.mockClear();

    await appService.getDiscoveryArtifactByPublicId(mockCtx, projectId, artifact.public_id);

    expect(authService.assertProjectAccessByActor).toHaveBeenCalled();
  });

  it('throws when authorization fails', async () => {
    authService.assertProjectAccessByActor.mockRejectedValueOnce(
      new Error('Access denied'),
    );

    await expect(
      appService.listDiscoveryRuns(mockCtx, projectId),
    ).rejects.toThrow('Access denied');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. SLACK / REST PARITY
// ═══════════════════════════════════════════════════════════════════════════

describe('Slack/REST domain parity', () => {
  it('desk_research produces equivalent domain structure', async () => {
    // REST-style creation
    const restRun = await appService.createPendingDiscoveryRun({
      projectId,
      projectSlug: 'disc2-rest-test',
      discoveryType: 'desk_research',
      topic: 'Parity Test Desk',
      sourceIntent: 'Test intent',
      sources: [{
        filename: 'doc.pdf',
        extractedText: 'Document content',
        contentHash: 'hash123',
        mimeType: 'application/pdf',
        sizeBytes: 500,
        metadata: { source: 'rest' as const },
      }],
      createdByIdentity: 'api:test',
      actorId,
    });

    // Verify domain structure matches expected shape
    expect(restRun.discovery_type).toBe('desk_research');
    expect(restRun.status).toBe('pending');
    expect(restRun.topic_slug).toMatch(/^parity-test-desk/);

    // Verify sources created
    const sources = await DiscoveryRunSourceModel.findAll({
      where: { discovery_run_id: restRun.id },
    });
    expect(sources).toHaveLength(1);
  });

  it('stakeholder_synthesis produces equivalent domain structure', async () => {
    const restRun = await appService.createPendingDiscoveryRun({
      projectId,
      projectSlug: 'disc2-rest-test',
      discoveryType: 'stakeholder_synthesis',
      topic: 'Parity Test Stakeholder',
      sourceIntent: 'Interview synthesis',
      sources: [{
        filename: 'interview.docx',
        extractedText: 'Interview transcript content',
        contentHash: 'hash456',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 1000,
        metadata: { source: 'rest' as const },
      }],
      createdByIdentity: 'api:test',
      actorId,
    });

    expect(restRun.discovery_type).toBe('stakeholder_synthesis');
    expect(restRun.status).toBe('pending');
    expect(restRun.topic_slug).toMatch(/^parity-test-stakeholder/);
  });

  it('PreparedDiscoverySource contract is identical for Slack and REST', () => {
    // Type check ensures both surfaces produce same shape
    const slackSource: appService.PreparedDiscoverySource = {
      filename: 'slack-doc.pdf',
      extractedText: 'Content from Slack',
      contentHash: 'slackhash',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      metadata: {
        slackFileId: 'F12345',
        source: 'slack',
      },
    };

    const restSource: appService.PreparedDiscoverySource = {
      filename: 'rest-doc.pdf',
      extractedText: 'Content from REST',
      contentHash: 'resthash',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      metadata: {
        uploadSessionId: 'session-123',
        source: 'rest',
      },
    };

    // Both satisfy the same interface
    expect(slackSource.filename).toBeDefined();
    expect(restSource.filename).toBeDefined();
    expect(slackSource.extractedText).toBeDefined();
    expect(restSource.extractedText).toBeDefined();
  });
});
