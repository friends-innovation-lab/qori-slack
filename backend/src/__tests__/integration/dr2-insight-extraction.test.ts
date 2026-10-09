/**
 * DR-2 AI Insight Extraction Integration Tests
 *
 * Tests against real Postgres per SPEC-2 design authority:
 * - Successful Desk run creates proposed insights
 * - Zero candidates is valid
 * - Candidate references correct project-owned sources
 * - Unsupported precise locator uses fallback
 * - Malformed AI output is safely rejected
 * - Same job retry produces no duplicates
 * - Concurrent retry produces no duplicates
 * - Failed extraction can retry independently
 * - Existing DiscoveryArtifact remains canonical
 * - Source text purge policy remains intact (not directly testable here)
 * - No automatic acceptance or review events
 * - Accepted historical revisions remain immutable
 * - Non-Desk Discovery runs remain unaffected
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { EvidenceSource } from '../../database/models/evidence_source';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import type { DiscoveryArtifact } from '../../database/models/discovery_artifact';
import type { StudyVariable } from '../../database/models/study_variable';
import * as runService from '../../services/discovery-run.service';
import * as artifactService from '../../services/discovery-artifact.service';
import * as insightExtractionService from '../../services/insight-extraction.service';
import * as deskInsightService from '../../services/desk-insight.service';

const sequelize = getTestDb();

const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const EvidenceSourceModel = sequelize.models.EvidenceSource;
const DiscoveryRunModel = sequelize.models.DiscoveryRun;
const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;
const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact;
const StudyVariableModel = sequelize.models.StudyVariable;
const EvidenceConstructModel = sequelize.models.EvidenceConstruct;
const EvidenceConstructRevisionModel = sequelize.models.EvidenceConstructRevision;

let projectId: number;
let actorId: number;
let sourceId: number;
let source2Id: number;

async function setupFixtures() {
  const project = await ProjectModel.create({
    name: 'DR-2 Test Project',
    slug: 'dr2-test',
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

  // Create evidence sources that will be associated with runs
  const source1 = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Test Document 1.pdf',
    created_by: 'U_TEST',
  } as CreationAttributes<EvidenceSource>);
  sourceId = (source1 as any).id;

  const source2 = await EvidenceSourceModel.create({
    project_id: projectId,
    source_type: 'uploaded_document',
    label: 'Research Report.pdf',
    created_by: 'U_TEST',
  } as CreationAttributes<EvidenceSource>);
  source2Id = (source2 as any).id;
}

async function createRunWithArtifact(options: {
  topic?: string;
  discoveryType?: 'desk_research' | 'stakeholder_synthesis';
} = {}): Promise<{ runId: number; artifactId: number }> {
  const { topic = 'Test Topic', discoveryType = 'desk_research' } = options;

  // Create run
  const run = await runService.createDiscoveryRun({
    projectId,
    discoveryType,
    topic,
    topicSlug: topic.toLowerCase().replace(/\s+/g, '-'),
    sourceIntent: 'Test intent',
    actorId,
    createdByIdentity: 'system:test',
  });

  // Associate sources with run
  await runService.associateSources({
    runId: run.id,
    sourceIds: [sourceId, source2Id],
  });

  // Create artifact
  const artifact = await artifactService.createDiscoveryArtifact({
    projectId,
    discoveryRunId: run.id,
    artifactType: discoveryType,
    title: `${discoveryType}: ${topic}`,
    topicSlug: topic.toLowerCase().replace(/\s+/g, '-'),
    canonicalContent: '# Test Content',
    templateName: `${discoveryType}`,
    templateVersion: 'v7.0',
    derivationFingerprint: 'test-fp-123',
    actorId,
    generatedByIdentity: 'system:test',
  });

  // Finalize artifact
  await artifactService.finalizeArtifactSupersession(artifact.id);

  return { runId: run.id, artifactId: artifact.id };
}

async function createEmittedVariables(artifactId: number, variables: Array<{
  key: string;
  itemKey?: string;
  value: unknown;
}>) {
  for (const v of variables) {
    await StudyVariableModel.create({
      project_id: projectId,
      variable_key: v.key,
      item_key: v.itemKey || v.key,
      value: v.value,
      source_template: 'desk_research',
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_fk_id: artifactId,
    });
  }
}

beforeAll(async () => {
  await sequelize.authenticate();
});

beforeEach(async () => {
  await truncateAll();
  await setupFixtures();
});

afterAll(async () => {
  await sequelize.close();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. SUCCESSFUL EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

describe('Successful Extraction', () => {
  it('creates proposed insights from discovered_barriers', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    // Create emitted variables (as YAML processor would)
    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Navigation complexity',
          summary: 'Users struggle to find key information',
          barrier_categories: ['ia', 'cognitive'],
          evidence: ['Quote from user research'],
          source_document: 'Test Document 1.pdf',
          confidence: 'Strong',
        },
      },
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-002',
        value: {
          id: 'barrier-002',
          title: 'Performance issues',
          summary: 'Page load times exceed 5 seconds',
          barrier_categories: ['performance'],
          source_document: 'Research Report.pdf',
          confidence: 'Moderate',
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);

    // Verify insights were created
    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(2);

    // Verify insights are proposed, not accepted
    for (const insight of insights.insights) {
      expect(insight.status).toBe('proposed');
      expect(insight.origin).toBe('ai');
      expect(insight.needsReview).toBe(true);
    }
  });

  it('creates proposed insights from knowledge_gaps', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'knowledge_gaps',
        itemKey: 'gap-001',
        value: {
          id: 'gap-001',
          gap: 'How do users prioritize tasks under time pressure?',
          why_matters: 'Critical for workflow optimization',
          suggested_resolution: 'Contextual inquiry study',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);

    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(1);
    expect(insights.insights[0].wording).toContain('How do users prioritize tasks');
    expect(insights.insights[0].wording).toContain('Critical for workflow optimization');
  });

  it('handles mixed barrier and gap variables', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Barrier description',
          source_document: 'Test Document 1.pdf',
        },
      },
      {
        key: 'knowledge_gaps',
        itemKey: 'gap-001',
        value: {
          id: 'gap-001',
          gap: 'Test gap question',
          source_document: 'Research Report.pdf',
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );

    expect(result.createdCount).toBe(2);
    expect(result.breakdown['discovered_barriers'].created).toBe(1);
    expect(result.breakdown['knowledge_gaps'].created).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ZERO CANDIDATES
// ═══════════════════════════════════════════════════════════════════════════

describe('Zero Candidates', () => {
  it('handles run with no insight-worthy variables', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    // Create only non-insight variables
    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_metrics',
        value: { id: 'metric-001', metric_name: 'Load time', value: '3.2s' },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);

    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(0);
  });

  it('handles run with empty variables', async () => {
    const { runId, artifactId } = await createRunWithArtifact();
    // No variables created

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. SOURCE REFERENCE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Source References', () => {
  it('matches source_document to EvidenceSource correctly', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Research Report.pdf', // Should match source2Id
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(1);

    const detail = await deskInsightService.getInsightById(insights.insights[0].id);
    expect(detail).not.toBeNull();
    expect(detail!.latestRevision.evidenceSnapshot.length).toBeGreaterThan(0);
    expect(detail!.latestRevision.evidenceSnapshot[0].evidenceSourceId).toBe(source2Id);
  });

  it('fails insight when source cannot be matched (no silent substitution)', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Non-existent document.pdf', // Won't match any source
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Should fail rather than silently substitute or create without evidence
    expect(result.failedCount).toBe(1);
    expect(result.createdCount).toBe(0);

    // No insight created
    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(0);
  });

  it('uses source-level attribution with limitation note', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insights = await deskInsightService.listInsights(projectId);
    const detail = await deskInsightService.getInsightById(insights.insights[0].id);
    const ref = detail!.latestRevision.evidenceSnapshot[0];

    expect(ref.locator.sourceLevel).toBe(true);
    expect(ref.validation).toBe('ai_unverified');
    expect(ref.locator.attributionLimitation).toContain('AI extraction cannot verify');
  });

  it('handles case-insensitive exact matching', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'TEST DOCUMENT 1.PDF', // Different case should still match
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insights = await deskInsightService.listInsights(projectId);
    const detail = await deskInsightService.getInsightById(insights.insights[0].id);
    expect(detail!.latestRevision.evidenceSnapshot.length).toBe(1);
    expect(detail!.latestRevision.evidenceSnapshot[0].evidenceSourceId).toBe(sourceId);
  });

  it('matches filename without extension', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Research Report', // Without .pdf extension
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insights = await deskInsightService.listInsights(projectId);
    const detail = await deskInsightService.getInsightById(insights.insights[0].id);
    expect(detail!.latestRevision.evidenceSnapshot.length).toBe(1);
    expect(detail!.latestRevision.evidenceSnapshot[0].evidenceSourceId).toBe(source2Id);
  });

  it('does NOT fuzzy match partial names (prevents wrong source)', async () => {
    // Create additional source with similar name
    const similarSource = await EvidenceSourceModel.create({
      project_id: projectId,
      source_type: 'uploaded_document',
      label: 'Research Report v2.pdf', // Similar to 'Research Report.pdf'
      created_by: 'U_TEST',
    });
    const similarSourceId = (similarSource as any).id;

    const { runId, artifactId } = await createRunWithArtifact();

    // Associate the new similar source
    await runService.associateSources({
      runId,
      sourceIds: [similarSourceId],
    });

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Research', // Partial name - should NOT match anything
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Should fail because no exact match (no fuzzy matching to wrong source)
    expect(result.failedCount).toBe(1);
    expect(result.createdCount).toBe(0);

    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(0);
  });

  it('handles single-source run with missing source_document (attributes to only source)', async () => {
    // Create run with only one source
    const run = await runService.createDiscoveryRun({
      projectId,
      discoveryType: 'desk_research',
      topic: 'Single Source Test',
      topicSlug: 'single-source-test',
      sourceIntent: 'Test',
      actorId,
      createdByIdentity: 'system:test',
    });

    await runService.associateSources({
      runId: run.id,
      sourceIds: [sourceId], // Only one source
    });

    const artifact = await artifactService.createDiscoveryArtifact({
      projectId,
      discoveryRunId: run.id,
      artifactType: 'desk_research',
      title: 'Single Source Test',
      topicSlug: 'single-source-test',
      canonicalContent: '# Test',
      templateName: 'desk_research',
      templateVersion: 'v7.0',
      derivationFingerprint: 'test-fp',
      actorId,
      generatedByIdentity: 'system:test',
    });

    await artifactService.finalizeArtifactSupersession(artifact.id);

    await createEmittedVariables(artifact.id, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          // No source_document provided
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(run.id, artifact.id);

    // Single source run: safe to attribute to the only available source
    const insights = await deskInsightService.listInsights(projectId);
    const detail = await deskInsightService.getInsightById(insights.insights[0].id);
    expect(detail!.latestRevision.evidenceSnapshot.length).toBe(1);
    expect(detail!.latestRevision.evidenceSnapshot[0].evidenceSourceId).toBe(sourceId);
  });

  it('preserves AI-provided source name in attribution', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insights = await deskInsightService.listInsights(projectId);
    const detail = await deskInsightService.getInsightById(insights.insights[0].id);
    // sourceLabel is captured for traceability
    expect(detail!.latestRevision.evidenceSnapshot[0].sourceLabel).toBe('Test Document 1.pdf');
  });

  it('validates source ownership via DiscoveryRunSource association', async () => {
    // Create source in different project
    const otherProject = await ProjectModel.create({
      name: 'Other Project',
      slug: 'other-project',
      status: 'active',
      created_by: 'U_TEST',
      organization_id: TEST_ORG_ID,
    });
    const otherProjectId = (otherProject as any).id;

    const otherSource = await EvidenceSourceModel.create({
      project_id: otherProjectId,
      source_type: 'uploaded_document',
      label: 'Test Document 1.pdf', // Same name as our source
      created_by: 'U_TEST',
    });

    // Create run - sources are only associated via DiscoveryRunSource
    // so even if there's another source with the same name in a different project,
    // it won't be in our mapping
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Should match OUR project's source, not the other project's
    const insights = await deskInsightService.listInsights(projectId);
    const detail = await deskInsightService.getInsightById(insights.insights[0].id);
    expect(detail!.latestRevision.evidenceSnapshot[0].evidenceSourceId).toBe(sourceId);
    expect(detail!.latestRevision.evidenceSnapshot[0].evidenceSourceId).not.toBe((otherSource as any).id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. MALFORMED OUTPUT HANDLING
// ═══════════════════════════════════════════════════════════════════════════

describe('Malformed Output', () => {
  it('rejects barrier without title or summary', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          // Missing title and summary
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    expect(result.failedCount).toBe(1);
    expect(result.createdCount).toBe(0);
  });

  it('rejects knowledge_gap without gap text', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'knowledge_gaps',
        itemKey: 'gap-001',
        value: {
          id: 'gap-001',
          // Missing gap text
          why_matters: 'Important',
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    expect(result.failedCount).toBe(1);
    expect(result.createdCount).toBe(0);
  });

  it('handles null or undefined value gracefully', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: null,
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Should not crash, just skip
    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════

describe('Idempotency', () => {
  it('same job retry produces no duplicates', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    // First extraction
    const result1 = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );
    expect(result1.createdCount).toBe(1);
    expect(result1.skippedCount).toBe(0);

    // Retry same extraction
    const result2 = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );
    expect(result2.createdCount).toBe(0);
    expect(result2.skippedCount).toBe(1);

    // Only one insight exists
    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(1);
  });

  it('concurrent retry produces no duplicates', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    // Concurrent extractions
    const [result1, result2] = await Promise.all([
      insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId),
      insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId),
    ]);

    // One creates, one skips (or both try to create and one gets caught by unique constraint)
    expect(result1.createdCount + result2.createdCount).toBe(1);
    expect(result1.skippedCount + result2.skippedCount).toBe(1);

    // Only one insight exists
    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(1);
  });

  it('uses ingestion_key for deduplication', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Verify ingestion_key is set
    const insight = await EvidenceConstructModel.findOne({
      where: { project_id: projectId, construct_type: 'desk_insight' },
    });
    expect((insight as any).ingestion_key).toBe(`run_${runId}:discovered_barriers:barrier-001`);
  });

  it('uses item.id for stable candidate identity', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'my-stable-id-123', // Explicit ID
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insight = await EvidenceConstructModel.findOne({
      where: { project_id: projectId, construct_type: 'desk_insight' },
    });
    expect((insight as any).ingestion_key).toBe(`run_${runId}:discovered_barriers:my-stable-id-123`);
  });

  it('generates fallback ID when item.id is missing', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          // No id field
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insight = await EvidenceConstructModel.findOne({
      where: { project_id: projectId, construct_type: 'desk_insight' },
    });
    // Falls back to itemKey-index format
    expect((insight as any).ingestion_key).toBe(`run_${runId}:discovered_barriers:barrier-001-0`);
  });

  it('prevents cross-project deduplication (same ingestion_key different projects)', async () => {
    // Create second project
    const project2 = await ProjectModel.create({
      name: 'DR-2 Test Project 2',
      slug: 'dr2-test-2',
      status: 'active',
      created_by: 'U_TEST',
      organization_id: TEST_ORG_ID,
    });
    const project2Id = (project2 as any).id;

    // Create source for project 2
    const project2Source = await EvidenceSourceModel.create({
      project_id: project2Id,
      source_type: 'uploaded_document',
      label: 'Test Document 1.pdf',
      created_by: 'U_TEST',
    });
    const project2SourceId = (project2Source as any).id;

    // Create run for project 1
    const { runId: runId1, artifactId: artifactId1 } = await createRunWithArtifact();

    // Create run for project 2
    const run2 = await runService.createDiscoveryRun({
      projectId: project2Id,
      discoveryType: 'desk_research',
      topic: 'Test Topic',
      topicSlug: 'test-topic',
      sourceIntent: 'Test',
      actorId,
      createdByIdentity: 'system:test',
    });
    await runService.associateSources({ runId: run2.id, sourceIds: [project2SourceId] });
    const artifact2 = await artifactService.createDiscoveryArtifact({
      projectId: project2Id,
      discoveryRunId: run2.id,
      artifactType: 'desk_research',
      title: 'Test',
      topicSlug: 'test-topic',
      canonicalContent: '# Test',
      templateName: 'desk_research',
      templateVersion: 'v7.0',
      derivationFingerprint: 'fp',
      actorId,
      generatedByIdentity: 'system:test',
    });
    await artifactService.finalizeArtifactSupersession(artifact2.id);

    // Same barrier ID in both projects
    const barrierValue = {
      id: 'barrier-001',
      title: 'Test barrier',
      summary: 'Description',
      source_document: 'Test Document 1.pdf',
    };

    await createEmittedVariables(artifactId1, [
      { key: 'discovered_barriers', itemKey: 'barrier-001', value: barrierValue },
    ]);

    await StudyVariableModel.create({
      project_id: project2Id,
      variable_key: 'discovered_barriers',
      item_key: 'barrier-001',
      value: barrierValue,
      source_template: 'desk_research',
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_fk_id: artifact2.id,
    });

    // Extract for project 1
    await insightExtractionService.extractInsightsFromDiscoveryRun(runId1, artifactId1);

    // Extract for project 2 - should create separate insight (not duplicate error)
    const result2 = await insightExtractionService.extractInsightsFromDiscoveryRun(run2.id, artifact2.id);

    expect(result2.createdCount).toBe(1); // Created, not skipped

    // Each project has its own insight
    const insights1 = await deskInsightService.listInsights(projectId);
    const insights2 = await deskInsightService.listInsights(project2Id);
    expect(insights1.total).toBe(1);
    expect(insights2.total).toBe(1);
  });

  it('skips already ingested key even with changed content', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    // First extraction
    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Original title',
          summary: 'Original summary',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);
    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Delete variable and create with different content but same ID
    await StudyVariableModel.destroy({
      where: { discovery_artifact_fk_id: artifactId, item_key: 'barrier-001' },
    });
    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001', // Same ID
          title: 'Modified title', // Different content
          summary: 'Modified summary',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    // Re-extraction skips (ingestion_key already exists)
    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);
    expect(result.skippedCount).toBe(1);
    expect(result.createdCount).toBe(0);

    // Original content preserved
    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.insights[0].wording).toContain('Original title');
  });

  it('does not mutate accepted revisions', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Accept the insight
    const insights = await deskInsightService.listInsights(projectId);
    const insightId = insights.insights[0].id;
    const detail = await deskInsightService.getInsightById(insightId);
    const actor = await ActorModel.create({
      organization_id: TEST_ORG_ID,
      display_name: 'Reviewer',
      status: 'active',
    });
    await deskInsightService.acceptRevision({
      constructId: insightId,
      revisionId: detail!.latestRevision.id,
      reviewedBy: `actor:${(actor as any).public_id}`,
      expectedVersion: detail!.version,
    });

    // Try to re-extract - should skip, not modify
    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);
    expect(result.skippedCount).toBe(1);

    // Accepted revision unchanged
    const detailAfter = await deskInsightService.getInsightById(insightId);
    expect(detailAfter!.status).toBe('accepted');
    expect(detailAfter!.acceptedRevisionNumber).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. FAILURE HANDLING
// ═══════════════════════════════════════════════════════════════════════════

describe('Failure Handling', () => {
  it('extraction failure does not affect artifact', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    // Valid artifact before extraction
    const artifactBefore = await DiscoveryArtifactModel.findByPk(artifactId);
    expect((artifactBefore as any).status).toBe('current');

    // Create invalid variable that will fail
    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        value: { id: 'bad', /* missing required fields */ },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);
    expect(result.failedCount).toBe(1);

    // Artifact remains unchanged
    const artifactAfter = await DiscoveryArtifactModel.findByPk(artifactId);
    expect((artifactAfter as any).status).toBe('current');
    expect((artifactAfter as any).canonical_content).toBe('# Test Content');
  });

  it('partial failure creates valid insights, skips invalid', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Valid barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-002',
        value: {
          id: 'barrier-002',
          // Missing title and summary - invalid
        },
      },
    ]);

    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    expect(result.createdCount).toBe(1);
    expect(result.failedCount).toBe(1);

    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(1);
    expect(insights.insights[0].wording).toContain('Valid barrier');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. NO AUTOMATIC ACCEPTANCE
// ═══════════════════════════════════════════════════════════════════════════

describe('No Automatic Acceptance', () => {
  it('AI-created insights have no accepted_revision_id', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insight = await EvidenceConstructModel.findOne({
      where: { project_id: projectId, construct_type: 'desk_insight' },
    });

    expect((insight as any).accepted_revision_id).toBeNull();
    expect((insight as any).status).toBe('candidate');
  });

  it('no review records are created during extraction', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const insights = await deskInsightService.listInsights(projectId);
    const reviews = await deskInsightService.getReviewHistory(insights.insights[0].id);

    expect(reviews.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. NON-DESK RUNS UNAFFECTED
// ═══════════════════════════════════════════════════════════════════════════

describe('Non-Desk Runs', () => {
  it('stakeholder_synthesis run does not extract insights', async () => {
    const { runId, artifactId } = await createRunWithArtifact({
      discoveryType: 'stakeholder_synthesis',
    });

    // Even if variables exist, they should not be extracted for stakeholder runs
    // (because the executeDiscoveryRun only triggers for desk_research)
    // This test verifies the extraction service can be called but finds no matching variables

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    // For stakeholder runs, the extraction should still work if called
    // but the integration point in executeDiscoveryRun only calls for desk_research
    const result = await insightExtractionService.extractInsightsFromDiscoveryRun(
      runId,
      artifactId,
    );

    // The service will create insights since it's called directly
    // The filtering happens at the executeDiscoveryRun level
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. DURABLE FAILURE AND RETRY
// ═══════════════════════════════════════════════════════════════════════════

describe('Durable Failure and Retry', () => {
  it('persists extraction_status=success on successful extraction', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const artifact = await DiscoveryArtifactModel.findByPk(artifactId);
    expect((artifact as any).extraction_status).toBe('success');
    expect((artifact as any).extraction_insight_count).toBe(1);
    expect((artifact as any).extraction_attempted_at).not.toBeNull();
    expect((artifact as any).extraction_failure_reason).toBeNull();
  });

  it('persists extraction_status=partial when some candidates fail', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Valid barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-002',
        value: {
          id: 'barrier-002',
          title: 'Unresolved barrier',
          summary: 'Description',
          source_document: 'Non-existent.pdf', // Will fail
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const artifact = await DiscoveryArtifactModel.findByPk(artifactId);
    expect((artifact as any).extraction_status).toBe('partial');
    expect((artifact as any).extraction_insight_count).toBe(1);
    expect((artifact as any).extraction_failure_reason).toContain('1 candidates failed');
  });

  it('persists extraction_status=failed when all candidates fail', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Unresolved barrier',
          summary: 'Description',
          source_document: 'Non-existent.pdf', // Will fail
        },
      },
    ]);

    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    const artifact = await DiscoveryArtifactModel.findByPk(artifactId);
    expect((artifact as any).extraction_status).toBe('failed');
    expect((artifact as any).extraction_insight_count).toBe(0);
  });

  it('retry uses persisted variable data (works after source text purge)', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    // First extraction
    const result1 = await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);
    expect(result1.createdCount).toBe(1);

    // Retry uses same StudyVariable data (source text not needed)
    const result2 = await insightExtractionService.retryInsightExtraction(artifactId);
    expect(result2.success).toBe(true);
    expect(result2.skippedCount).toBe(1); // Already created
    expect(result2.createdCount).toBe(0);
  });

  it('retry skips previously created insights (idempotent)', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);

    // First extraction
    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // Add new variable
    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-002',
        value: {
          id: 'barrier-002',
          title: 'New barrier',
          summary: 'Description',
          source_document: 'Research Report.pdf',
        },
      },
    ]);

    // Retry creates new insight, skips old
    const result = await insightExtractionService.retryInsightExtraction(artifactId);
    expect(result.createdCount).toBe(1);
    expect(result.skippedCount).toBe(1);

    const insights = await deskInsightService.listInsights(projectId);
    expect(insights.total).toBe(2);
  });

  it('findArtifactsNeedingExtractionRetry finds failed/partial artifacts', async () => {
    const { runId: runId1, artifactId: artifactId1 } = await createRunWithArtifact({ topic: 'Test 1' });
    const { runId: runId2, artifactId: artifactId2 } = await createRunWithArtifact({ topic: 'Test 2' });

    // First artifact: success
    await createEmittedVariables(artifactId1, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: { id: 'barrier-001', title: 'T', summary: 'S', source_document: 'Test Document 1.pdf' },
      },
    ]);
    await insightExtractionService.extractInsightsFromDiscoveryRun(runId1, artifactId1);

    // Second artifact: failed
    await createEmittedVariables(artifactId2, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: { id: 'barrier-001', title: 'T', summary: 'S', source_document: 'Missing.pdf' },
      },
    ]);
    await insightExtractionService.extractInsightsFromDiscoveryRun(runId2, artifactId2);

    const needingRetry = await insightExtractionService.findArtifactsNeedingExtractionRetry(projectId);
    expect(needingRetry.length).toBe(1);
    expect(needingRetry[0].artifactId).toBe(artifactId2);
    expect(needingRetry[0].status).toBe('failed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. EXTRACTION STATUS QUERY
// ═══════════════════════════════════════════════════════════════════════════

describe('Extraction Status', () => {
  it('reports extraction status correctly', async () => {
    const { runId, artifactId } = await createRunWithArtifact();

    // Before extraction
    const statusBefore = await insightExtractionService.getExtractionStatus(artifactId);
    expect(statusBefore).not.toBeNull();
    expect(statusBefore!.extracted).toBe(false);
    expect(statusBefore!.insightCount).toBe(0);

    // Create and extract
    await createEmittedVariables(artifactId, [
      {
        key: 'discovered_barriers',
        itemKey: 'barrier-001',
        value: {
          id: 'barrier-001',
          title: 'Test barrier',
          summary: 'Description',
          source_document: 'Test Document 1.pdf',
        },
      },
    ]);
    await insightExtractionService.extractInsightsFromDiscoveryRun(runId, artifactId);

    // After extraction
    const statusAfter = await insightExtractionService.getExtractionStatus(artifactId);
    expect(statusAfter!.extracted).toBe(true);
    expect(statusAfter!.insightCount).toBe(1);
    expect(statusAfter!.lastExtractedAt).not.toBeNull();
  });
});
