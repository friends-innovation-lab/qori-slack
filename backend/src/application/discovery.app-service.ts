/**
 * Discovery Application Service — PLAT-3 + DISC-1 + DISC-2
 *
 * Orchestrates discovery research workflows with surface-independent execution.
 *
 * DISC-1 integration:
 * - DiscoveryRun created BEFORE long-running analysis (locked decision A)
 * - EvidenceSource created for each uploaded document
 * - DiscoveryArtifact created with canonical content (locked decision D)
 * - GitHub is projection, not canonical
 *
 * DISC-2 split:
 * - createPendingDiscoveryRun: Creates run + sources, returns immediately
 * - executeDiscoveryRun: Worker execution (claims run, executes, completes)
 * - executeDiscovery: Legacy sync path for Slack (combines both)
 *
 * Slack handler → createPendingDiscoveryRun (or executeDiscovery for sync)
 * REST API → createPendingDiscoveryRun → worker claims → executeDiscoveryRun
 */

import type { ApplicationContext } from '../types/application-context';
import type {
  DiscoveryTypeKey,
  PreparedDiscoverySource,
  CreateDiscoveryRunInput,
  DiscoveryRunSummary,
  DiscoveryRunDetail,
  DiscoveryArtifactSummary,
  DiscoveryArtifactDetail,
  DiscoveryExecutionResult,
  DiscoveryArtifactVariables,
  DiscoveryVariableItem,
  DiscoveryKnowledgeGap,
  DiscoveryKnowledgeGapsResponse,
} from '../types/discovery';
import { VARIABLE_LABELS } from '../types/discovery';
import { format } from 'date-fns';
import { assertProjectAccessByActor } from '../services/authorization.service';
import { getProjectById } from '../services/project.service';
import { loadDiscoveryArtifacts, type DiscoveryArtifact } from '../helpers/discoveryLoader';
import { getConfigRepo, YAML_TEMPLATE_PATH, fetchFileFromRepo, createOrUpdateFileOnGitHub, fetchFileFromRepoByPath } from '../helpers/github';
import { processYamlTemplate, extractAndPersistDiscoveryVariables, type ExtractionOutcome } from '../helpers/yamlProcessor';
import type { EmitSpec } from '../helpers/variableExtractor';
import { parseDocuments, validateDocuments } from '../helpers/documentParser';
import type { VariableContext } from '../helpers/studyVariables';
import yaml from 'js-yaml';
import { authorizeForModel, scanForPii } from '../services/content-governance.service';
import * as runService from '../services/discovery-run.service';
import * as artifactService from '../services/discovery-artifact.service';
import * as evidenceService from '../services/evidence-source.service';
import * as claimService from '../services/discovery-claim.service';
import * as insightExtractionService from '../services/insight-extraction.service';
import { formatMarker } from '../services/discovery-marker.service';
import type { DiscoveryType, DiscoveryRun } from '../database/models/discovery_run';
import type { EvidenceSource } from '../database/models/evidence_source';
import sequelize from '../database';
import { Op } from 'sequelize';

// Re-export types for external consumers
export type { DiscoveryTypeKey, PreparedDiscoverySource, CreateDiscoveryRunInput };

// ─── Legacy Types (preserved for backward compatibility) ─────────

export interface DiscoveryInput {
  /** Project context */
  projectId: number;
  projectSlug: string;

  /** Discovery type */
  discoveryType: DiscoveryTypeKey;

  /** Form fields */
  topic: string;
  description: string | null;

  /** Processed document content (already extracted from files) */
  documents: DocumentInput[];

  /** Actor info */
  createdByActorId: string;

  /** Survey-specific fields */
  surveyName?: string;
  questionFocus?: string;
}

export interface DocumentInput {
  name: string;
  content: string;
  type: string;
  size: number;
  [key: string]: unknown;
}

export interface DiscoveryResult {
  /** URL of the generated artifact on GitHub */
  url: string;
  /** Topic slug used */
  topicSlug: string;
  /** Discovery type label */
  typeLabel: string;
  /** Cascade extraction outcome */
  extractionSuccess: boolean;
  extractionVariableCount: number;
  /** DISC-1: DiscoveryRun public ID */
  runPublicId?: string;
  /** DISC-1: DiscoveryArtifact public ID */
  artifactPublicId?: string;
}

export interface DiscoveryArtifactInfo {
  slug: string;
  type: string;
  label: string;
  date: string;
  icon: string;
  variableCount: number;
}

export interface PrivacyViolation {
  label: string;
  snippet: string;
}

// ─── Constants ──────────────────────────────────────────────────

interface DiscoveryTypeConfig {
  yaml: string;
  type: string;
  fileSlug: string;
  label: string;
}

const DISCOVERY_TYPES: Record<DiscoveryTypeKey, DiscoveryTypeConfig> = {
  desk_research: {
    yaml: 'desk_research.yaml',
    type: 'desk-research',
    fileSlug: 'desk-research',
    label: 'Desk research',
  },
  stakeholder_synthesis: {
    yaml: 'stakeholder_synthesis.yaml',
    type: 'stakeholder-interviews',
    fileSlug: 'stakeholder-synthesis',
    label: 'Stakeholder synthesis',
  },
  survey_synthesis: {
    yaml: 'survey_synthesis.yaml',
    type: 'survey-synthesis',
    fileSlug: 'survey-synthesis',
    label: 'Survey synthesis',
  },
};

const DISCOVERY_README = `# Discovery Research

Pre-study discovery research that informs briefs and accumulates as organizational memory.

## Contents

Discovery artifacts are stored directly in this folder.

*Generated by Qori*
`;

// ─── Helpers ────────────────────────────────────────────────────

function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function scaffoldDiscoveryFolders(projectSlug: string): Promise<void> {
  const readmePath = `${projectSlug}/00-discovery/README.md`;
  try {
    await fetchFileFromRepoByPath(process.env.GITHUB_REPO!, readmePath);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as Record<string, unknown>)?.status;
    if (status === 404 || message?.includes('Not Found') || message?.includes('Could not fetch file')) {
      await createOrUpdateFileOnGitHub(readmePath, DISCOVERY_README);
    }
  }
}

function computeContentHash(content: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(content).digest('hex').substring(0, 32);
}

// ─── List Discovery Artifacts (Legacy GitHub-based) ─────────────

export async function listDiscoveryArtifacts(
  ctx: ApplicationContext,
  projectId: number,
): Promise<DiscoveryArtifactInfo[]> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const artifacts = await loadDiscoveryArtifacts(projectId);
  return artifacts.map((a: DiscoveryArtifact) => ({
    slug: a.slug,
    type: a.type,
    label: a.label,
    date: a.date,
    icon: a.icon,
    variableCount: a.variableCount,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-2: SPLIT EXECUTION — CREATE PENDING RUN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a pending Discovery run with associated sources.
 *
 * This is the synchronous creation phase:
 * 1. Validate input
 * 2. Create DiscoveryRun (pending)
 * 3. Create EvidenceSources for each prepared source
 * 4. Associate sources with run
 * 5. Return immediately with pending run
 *
 * Worker will claim and execute asynchronously.
 */
export async function createPendingDiscoveryRun(
  input: CreateDiscoveryRunInput,
): Promise<DiscoveryRun> {
  const typeConfig = DISCOVERY_TYPES[input.discoveryType];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${input.discoveryType}`);
  }

  if (!input.topic || !slugifyTopic(input.topic)) {
    throw new Error('Topic must contain alphanumeric characters');
  }

  if (input.sources.length === 0) {
    throw new Error('At least one source is required');
  }

  let topicSlug = slugifyTopic(input.topic);

  // Check for duplicate filename
  const dateIso = format(new Date(), 'yyyy-MM-dd');
  const expectedFilename = `${topicSlug}-${typeConfig.fileSlug}-${dateIso}.md`;
  const expectedPath = `${input.projectSlug}/00-discovery/${expectedFilename}`;
  try {
    await fetchFileFromRepoByPath(process.env.GITHUB_REPO!, expectedPath);
    const timeSuffix = format(new Date(), 'HHmm');
    topicSlug = `${topicSlug}-${timeSuffix}`;
  } catch {
    // File doesn't exist — proceed
  }

  // Create DiscoveryRun (pending)
  const run = await runService.createDiscoveryRun({
    projectId: input.projectId,
    discoveryType: input.discoveryType as DiscoveryType,
    topic: input.topic,
    topicSlug,
    sourceIntent: input.sourceIntent || null,
    actorId: input.actorId || null,
    createdByIdentity: input.createdByIdentity,
  });

  // Create EvidenceSources with extracted text for worker access
  const sources = await evidenceService.createDiscoverySources(
    input.projectId,
    input.sources.map(s => ({
      filename: s.filename,
      extractedText: s.extractedText,
      contentHash: s.contentHash,
      mimeType: s.mimeType,
      sizeBytes: s.sizeBytes,
      metadata: s.metadata,
    })),
    input.createdByIdentity,
  );

  // Associate sources with run
  await runService.associateSources({
    runId: run.id,
    sourceIds: sources.map(s => s.id),
  });

  console.log(
    `[DISC-2] Created pending run ${run.public_id} with ${sources.length} sources`,
  );

  return run;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-2: SPLIT EXECUTION — EXECUTE CLAIMED RUN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute a claimed Discovery run.
 *
 * Called by worker after claiming a pending run.
 * Assumes run is already in 'processing' status with worker ownership.
 *
 * Steps:
 * 1. Load run and sources
 * 2. Privacy gate
 * 3. YAML processing
 * 4. Create DiscoveryArtifact
 * 5. GitHub projection
 * 6. Variable extraction with FK
 * 7. Finalize and complete
 */
export async function executeDiscoveryRun(
  runId: number,
  workerId: string,
): Promise<DiscoveryExecutionResult> {
  // Load run with associations
  const run = await runService.getDiscoveryRunById(runId);
  if (!run) {
    throw new Error(`Discovery run ${runId} not found`);
  }

  // Validate worker ownership
  if (run.worker_id !== workerId) {
    throw new claimService.NotOwnerError(runId, workerId);
  }

  if (run.status !== 'processing') {
    throw new Error(`Run ${runId} is not in processing status (is ${run.status})`);
  }

  const typeConfig = DISCOVERY_TYPES[run.discovery_type as DiscoveryTypeKey];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${run.discovery_type}`);
  }

  // Load associated sources
  const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;
  const EvidenceSourceModel = sequelize.models.EvidenceSource;

  const runSources = await DiscoveryRunSourceModel.findAll({
    where: { discovery_run_id: run.id },
    order: [['source_order', 'ASC']],
  });

  const sourceIds = runSources.map((rs: any) => rs.evidence_source_id);
  const evidenceSources = await EvidenceSourceModel.findAll({
    where: { id: { [Op.in]: sourceIds } },
  }) as EvidenceSource[];

  // Order sources by run source order
  const sourceMap = new Map(evidenceSources.map(s => [s.id, s]));
  const orderedSources = sourceIds.map(id => sourceMap.get(id)).filter(Boolean) as EvidenceSource[];

  if (orderedSources.length === 0) {
    throw new Error(`Run ${runId} has no associated sources`);
  }

  // Load project for context
  const project = await getProjectById(run.project_id);
  if (!project) {
    throw new Error(`Project ${run.project_id} not found`);
  }

  const projectSlug = project.slug;
  const projectProblemStatement = project.problem_statement || null;

  // Scaffold discovery folders
  await scaffoldDiscoveryFolders(projectSlug);

  // Build document content from sources
  // Note: For DISC-2, sources store content hash but not raw content
  // We need to re-extract or have content stored somewhere accessible
  // For now, we'll need the content to be stored in a way the worker can access

  // BLOCKER CHECK: Do sources have accessible content?
  // Current EvidenceSource stores metadata only, not raw content.
  // For initial DISC-2, we'll store extracted_text in metadata.content_preview or similar.
  // This is a limitation documented in DISC-2 spec.

  // For this implementation, we'll read content from a temporary field or require
  // sources to include content. Let me check the EvidenceSource model...

  // Build documents from sources
  // We need to retrieve the extracted text - checking artifact_ref for content info
  const documents: DocumentInput[] = [];
  for (const source of orderedSources) {
    const artifactRef = source.artifact_ref as {
      filename?: string;
      content_hash?: string;
      mime_type?: string;
      size_bytes?: number;
      extracted_text?: string; // DISC-2: Store during creation
    } | null;

    const metadata = source.metadata as {
      content_length?: number;
      extracted_text?: string; // DISC-2: Store during creation
    } | null;

    // Try to get extracted text from metadata or artifact_ref
    const extractedText = metadata?.extracted_text || artifactRef?.extracted_text;

    if (!extractedText) {
      throw new Error(
        `Source ${source.id} has no extracted text available. ` +
        `This indicates a content storage issue - worker cannot access source content.`
      );
    }

    documents.push({
      name: source.label,
      content: extractedText,
      type: artifactRef?.mime_type || 'application/octet-stream',
      size: artifactRef?.size_bytes || 0,
    });
  }

  // Parse documents
  const parsedDocuments = parseDocuments(documents);
  const formattedDocumentContent: string = parsedDocuments.structured_format;

  const MIME_LABELS: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/plain': 'Text',
    'text/markdown': 'Markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/msword': 'Word',
  };

  const documentNames = documents.map(d => d.name);
  const documentTypes = documents.map(d => MIME_LABELS[d.type] || d.type);

  // Privacy gate
  const privacyResult = authorizeForModel(
    formattedDocumentContent,
    'DISCOVERY_UPLOAD',
    { projectId: run.project_id, sourceId: `discovery:${run.discovery_type}:${run.topic_slug}` },
  );

  if (privacyResult.status === 'pending_review') {
    const piiFindings = scanForPii(formattedDocumentContent);
    await claimService.failRun(run.id, workerId, 'PRIVACY_VIOLATION', 'PII detected in documents', 'privacy_scan');
    throw new PrivacyError(
      'Privacy scan detected potential PII in uploaded files',
      piiFindings.map((f: { label: string; snippet: string }) => ({ label: f.label, snippet: f.snippet })),
    );
  }

  if (privacyResult.status === 'denied') {
    await claimService.failRun(run.id, workerId, 'CONTENT_DENIED', privacyResult.reason || 'Unknown', 'content_auth');
    throw new Error(`Content authorization failed: ${privacyResult.reason}`);
  }

  // Build template data
  const contentFingerprint = computeContentHash(privacyResult.modelSafeContent!).substring(0, 16);

  const data: Record<string, unknown> = {
    topic: run.topic,
    effective_topic: run.topic,
    topic_slug: run.topic_slug,
    project_slug: projectSlug,
    project_problem_statement: projectProblemStatement,
    source_intent: run.source_intent,
    description: run.source_intent || run.topic,
    document_content: privacyResult.modelSafeContent!,
    combined_file_content: privacyResult.modelSafeContent!,
    _discovery_type: typeConfig.type,
    selected_study: `discovery-${run.topic_slug}`,
    study_name: run.topic,
    document_count: documents.length,
    document_names: documentNames,
    document_types: documentTypes,
  };

  // Stakeholder-specific fields
  if (run.discovery_type === 'stakeholder_synthesis') {
    data.researcher_contact = run.created_by_identity;
    data.detected_files = documents.map(d => d.name).join('\n- ');
    data.file_list = documents.map(d => d.name);
  }

  // Artifact identity context
  data.__artifactContext = {
    projectId: run.project_id,
    studyId: null,
    artifactType: 'discovery',
    title: `${run.discovery_type.replace(/_/g, ' ')} — ${run.topic}`,
    canonicalUpstreamInputs: [`content:${contentFingerprint}`],
    createdBy: run.created_by_identity,
  };

  // Execute YAML template processing
  let artifact;
  try {
    // Fetch and parse YAML template
    const file = await fetchFileFromRepo(getConfigRepo(), YAML_TEMPLATE_PATH, typeConfig.yaml);
    const yamlConfig = yaml.load(file.content) as {
      id?: string;
      version?: string;
      emits?: EmitSpec[];
    } | null;

    if (!yamlConfig) {
      throw new Error(`Failed to parse YAML template: ${typeConfig.yaml}`);
    }

    const templateVersion = yamlConfig.version || null;
    const emitsSpec: EmitSpec[] = yamlConfig.emits || [];

    // Process YAML with dryRun=true
    const variableContext: VariableContext = {
      projectId: run.project_id,
    };

    // Update heartbeat before long-running AI call
    await claimService.updateHeartbeat(run.id, workerId);

    const dryRunResult = await processYamlTemplate(
      file.content, data, '', '', false, variableContext, undefined, true,
    );

    // Update heartbeat after AI call
    await claimService.updateHeartbeat(run.id, workerId);

    // Create DiscoveryArtifact
    artifact = await artifactService.createDiscoveryArtifact({
      projectId: run.project_id,
      discoveryRunId: run.id,
      artifactType: run.discovery_type as 'desk_research' | 'stakeholder_synthesis' | 'survey_synthesis' | 'cross_source_synthesis',
      title: `${typeConfig.label}: ${run.topic}`,
      topicSlug: run.topic_slug,
      canonicalContent: dryRunResult.outputTemplate || null,
      templateName: typeConfig.yaml.replace('.yaml', ''),
      templateVersion,
      derivationFingerprint: contentFingerprint,
      actorId: run.actor_id,
      generatedByIdentity: run.created_by_identity,
    });

    // GitHub projection
    let githubResult: { path: string; sha: string; url: string };
    try {
      githubResult = await createOrUpdateFileOnGitHub(dryRunResult.path, dryRunResult.content);
      await artifactService.recordProjection(artifact.id, {
        githubPath: githubResult.path,
        githubSha: githubResult.sha,
      });
    } catch (githubError) {
      const githubMsg = githubError instanceof Error ? githubError.message : String(githubError);
      console.warn(`⚠️ GitHub projection failed (non-blocking): ${githubMsg}`);
      await artifactService.recordProjectionError(artifact.id, githubMsg);
      githubResult = {
        path: dryRunResult.path,
        sha: 'projection-failed',
        url: `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/blob/main/${dryRunResult.path}`,
      };
    }

    // Variable extraction with artifact FK
    let extractionSuccess = true;
    let extractionVariableCount = 0;

    if (emitsSpec.length > 0) {
      const extractResult = await extractAndPersistDiscoveryVariables({
        templateId: yamlConfig.id || typeConfig.yaml.replace('.yaml', ''),
        templateVersion: templateVersion || '',
        emitsSpec,
        outputTemplate: dryRunResult.outputTemplate,
        inputValues: data,
        variableContext,
        discoveryArtifactFkId: artifact.id,
      });

      extractionSuccess = extractResult.success;
      extractionVariableCount = extractResult.variableCount || 0;

      if (!extractResult.success) {
        console.warn(`⚠️ Cascade variable extraction failed: ${extractResult.error}`);
      }
    }

    // DR-2: Extract candidate insights from emitted variables
    // Only for desk_research runs — others do not produce insight-worthy variables
    let insightExtractionResult: Awaited<ReturnType<typeof insightExtractionService.extractInsightsFromDiscoveryRun>> | null = null;

    if (run.discovery_type === 'desk_research' && extractionSuccess && extractionVariableCount > 0) {
      try {
        // Update heartbeat before insight extraction
        await claimService.updateHeartbeat(run.id, workerId);

        insightExtractionResult = await insightExtractionService.extractInsightsFromDiscoveryRun(
          run.id,
          artifact.id,
          { verbose: true },
        );

        if (insightExtractionResult.success) {
          console.log(
            `[DR-2] Insight extraction: ${insightExtractionResult.createdCount} created, ` +
            `${insightExtractionResult.skippedCount} skipped, ${insightExtractionResult.failedCount} failed`,
          );
        } else {
          // Extraction failed but we don't fail the run (per DR-2 spec)
          console.warn(`⚠️ [DR-2] Insight extraction failed (non-blocking): ${insightExtractionResult.error}`);
        }
      } catch (insightError) {
        // Catch any unexpected errors — extraction failure must not fail the run
        const errMsg = insightError instanceof Error ? insightError.message : String(insightError);
        console.error(`⚠️ [DR-2] Insight extraction error (non-blocking): ${errMsg}`);
      }
    }

    // Finalize artifact
    await artifactService.finalizeArtifactSupersession(artifact.id);

    // Complete run
    await claimService.completeRun(run.id, workerId);

    console.log(`[DISC-2] Completed run ${run.public_id} → artifact ${artifact.public_id}`);

    return {
      runPublicId: run.public_id,
      artifactPublicId: artifact.public_id,
      topicSlug: run.topic_slug,
      typeLabel: typeConfig.label,
      githubUrl: githubResult.url,
      extractionSuccess,
      extractionVariableCount,
      // DR-2: Insight extraction results
      insightExtractionSuccess: insightExtractionResult?.success,
      insightsCreated: insightExtractionResult?.createdCount,
      insightsSkipped: insightExtractionResult?.skippedCount,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark artifact as failed if it was created
    if (artifact) {
      await artifactService.markArtifactFailed(artifact.id);
    }

    // Fail the run
    await claimService.failRun(
      run.id,
      workerId,
      'GENERATION_ERROR',
      errorMessage.substring(0, 500),
      'yaml_processing',
    );

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY: SYNCHRONOUS EXECUTION (for Slack backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute Discovery synchronously (legacy Slack path).
 *
 * Creates run + sources, then executes immediately in same request.
 * Used by Slack handler for backward compatibility.
 *
 * For REST API, use createPendingDiscoveryRun + worker execution instead.
 */
export async function executeDiscovery(
  ctx: ApplicationContext,
  input: DiscoveryInput,
): Promise<DiscoveryResult> {
  // Authorization
  await assertProjectAccessByActor(ctx.actor.id, input.projectId, ctx.organization.id);

  const typeConfig = DISCOVERY_TYPES[input.discoveryType];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${input.discoveryType}`);
  }

  if (!input.topic || !slugifyTopic(input.topic)) {
    throw new Error('Topic must contain alphanumeric characters');
  }

  if (input.documents.length === 0) {
    throw new Error('At least one document is required');
  }

  // Validate documents
  const validation = validateDocuments(input.documents);
  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  // Convert legacy DocumentInput to PreparedDiscoverySource
  const sources: PreparedDiscoverySource[] = input.documents.map(d => ({
    filename: d.name,
    extractedText: d.content,
    contentHash: computeContentHash(d.content),
    mimeType: d.type,
    sizeBytes: d.size,
    metadata: {
      slackFileId: (d as Record<string, unknown>).slackFileId as string | undefined,
      source: 'slack' as const,
    },
  }));

  // Create pending run
  const run = await createPendingDiscoveryRun({
    projectId: input.projectId,
    projectSlug: input.projectSlug,
    discoveryType: input.discoveryType,
    topic: input.topic,
    sourceIntent: input.description,
    sources,
    createdByIdentity: `slack:${input.createdByActorId}`,
    actorId: ctx.actor.id,
  });

  // NOTE: createPendingDiscoveryRun → createDiscoverySources already stores
  // extracted_text in EvidenceSource metadata. No manual update needed.

  // Claim the run for sync execution
  const syncWorkerId = `sync-${run.public_id}`;
  await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'processing',
      worker_id = :workerId,
      claimed_at = NOW(),
      heartbeat_at = NOW(),
      started_at = COALESCE(started_at, NOW()),
      updated_at = NOW()
    WHERE id = :runId
    `,
    {
      replacements: { workerId: syncWorkerId, runId: run.id },
    },
  );

  // Execute
  try {
    const result = await executeDiscoveryRun(run.id, syncWorkerId);

    return {
      url: result.githubUrl,
      topicSlug: result.topicSlug,
      typeLabel: result.typeLabel,
      extractionSuccess: result.extractionSuccess,
      extractionVariableCount: result.extractionVariableCount,
      runPublicId: result.runPublicId,
      artifactPublicId: result.artifactPublicId,
    };
  } catch (error) {
    // Run is already marked failed by executeDiscoveryRun
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API QUERY METHODS
// ═══════════════════════════════════════════════════════════════════════════

const DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;
const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact;
const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;
const EvidenceSourceModel = sequelize.models.EvidenceSource;

/**
 * List Discovery runs for a project.
 */
export async function listDiscoveryRuns(
  ctx: ApplicationContext,
  projectId: number,
  options?: {
    discoveryType?: DiscoveryTypeKey;
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DiscoveryRunSummary[]> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const where: Record<string, unknown> = { project_id: projectId };

  if (options?.discoveryType) {
    where.discovery_type = options.discoveryType;
  }

  if (options?.status) {
    where.status = options.status;
  }

  const runs = await DiscoveryRunModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit || 50,
    offset: options?.offset || 0,
  });

  // Get source counts
  const runIds = runs.map(r => r.id);
  const sourceCounts = await DiscoveryRunSourceModel.findAll({
    where: { discovery_run_id: { [Op.in]: runIds } },
    attributes: ['discovery_run_id', [sequelize.fn('COUNT', '*'), 'count']],
    group: ['discovery_run_id'],
  }) as unknown as Array<{ discovery_run_id: number; count: string }>;

  const sourceCountMap = new Map(sourceCounts.map(sc => [sc.discovery_run_id, parseInt(sc.count, 10)]));

  // Get current artifacts
  const artifacts = await DiscoveryArtifactModel.findAll({
    where: {
      discovery_run_id: { [Op.in]: runIds },
      status: 'current',
    },
    attributes: ['discovery_run_id', 'public_id'],
  }) as unknown as Array<{ discovery_run_id: number; public_id: string }>;

  const artifactMap = new Map(artifacts.map(a => [a.discovery_run_id, a.public_id]));

  return runs.map(run => ({
    publicId: run.public_id,
    discoveryType: run.discovery_type as DiscoveryTypeKey,
    topic: run.topic,
    topicSlug: run.topic_slug,
    sourceIntent: run.source_intent,
    status: run.status,
    stage: run.stage,
    sourceCount: sourceCountMap.get(run.id) || 0,
    attemptCount: run.attempt_count,
    createdAt: run.created_at.toISOString(),
    startedAt: run.started_at?.toISOString() || null,
    completedAt: run.completed_at?.toISOString() || null,
    createdBy: run.created_by_identity,
    currentArtifactPublicId: artifactMap.get(run.id) || null,
    failureCode: run.failure_code,
    failureMessage: run.failure_message,
    marker: formatMarker(run.discovery_type, run.marker_index),
  }));
}

/**
 * Get Discovery run detail by public ID.
 */
export async function getDiscoveryRunByPublicId(
  ctx: ApplicationContext,
  projectId: number,
  runPublicId: string,
): Promise<DiscoveryRunDetail | null> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const run = await DiscoveryRunModel.findOne({
    where: {
      project_id: projectId,
      public_id: runPublicId,
    },
  });

  if (!run) {
    return null;
  }

  // Get sources
  const runSources = await DiscoveryRunSourceModel.findAll({
    where: { discovery_run_id: run.id },
    order: [['source_order', 'ASC']],
  }) as unknown as Array<{ evidence_source_id: number; source_order: number }>;

  const sourceIds = runSources.map(rs => rs.evidence_source_id);
  const sources = await EvidenceSourceModel.findAll({
    where: { id: { [Op.in]: sourceIds } },
  }) as EvidenceSource[];

  const sourceMap = new Map(sources.map(s => [s.id, s]));
  const orderedSources = runSources.map(rs => {
    const source = sourceMap.get(rs.evidence_source_id);
    return source ? {
      publicId: source.public_id,
      label: source.label,
      sourceType: source.source_type,
      order: rs.source_order,
    } : null;
  }).filter(Boolean) as Array<{ publicId: string; label: string; sourceType: string; order: number }>;

  // Get current artifact
  const artifact = await DiscoveryArtifactModel.findOne({
    where: {
      discovery_run_id: run.id,
      status: 'current',
    },
  }) as any;

  const runMarker = formatMarker(run.discovery_type, run.marker_index);

  const currentArtifact: DiscoveryArtifactSummary | null = artifact ? {
    publicId: artifact.public_id,
    runPublicId: run.public_id,
    artifactType: artifact.artifact_type,
    title: artifact.title,
    topicSlug: artifact.topic_slug,
    version: artifact.version,
    status: artifact.status,
    templateName: artifact.template_name,
    templateVersion: artifact.template_version,
    createdAt: artifact.created_at.toISOString(),
    githubPath: artifact.github_path,
    projectedAt: artifact.projected_at?.toISOString() || null,
    marker: runMarker,
  } : null;

  return {
    publicId: run.public_id,
    discoveryType: run.discovery_type as DiscoveryTypeKey,
    topic: run.topic,
    topicSlug: run.topic_slug,
    sourceIntent: run.source_intent,
    status: run.status,
    stage: run.stage,
    sourceCount: orderedSources.length,
    attemptCount: run.attempt_count,
    createdAt: run.created_at.toISOString(),
    startedAt: run.started_at?.toISOString() || null,
    completedAt: run.completed_at?.toISOString() || null,
    createdBy: run.created_by_identity,
    currentArtifactPublicId: currentArtifact?.publicId || null,
    failureCode: run.failure_code,
    failureMessage: run.failure_message,
    marker: runMarker,
    sources: orderedSources,
    currentArtifact,
  };
}

/**
 * List Discovery artifacts for a project.
 */
export async function listCanonicalDiscoveryArtifacts(
  ctx: ApplicationContext,
  projectId: number,
  options?: {
    artifactType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DiscoveryArtifactSummary[]> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const where: Record<string, unknown> = { project_id: projectId };

  if (options?.artifactType) {
    where.artifact_type = options.artifactType;
  }

  if (options?.status) {
    where.status = options.status;
  } else {
    // Default to current artifacts only
    where.status = 'current';
  }

  const artifacts = await DiscoveryArtifactModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit || 50,
    offset: options?.offset || 0,
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['public_id', 'discovery_type', 'marker_index'],
    }],
  }) as any[];

  return artifacts.map(a => ({
    publicId: a.public_id,
    runPublicId: a.discoveryRun?.public_id || '',
    artifactType: a.artifact_type,
    title: a.title,
    topicSlug: a.topic_slug,
    version: a.version,
    status: a.status,
    templateName: a.template_name,
    templateVersion: a.template_version,
    createdAt: a.created_at.toISOString(),
    githubPath: a.github_path,
    projectedAt: a.projected_at?.toISOString() || null,
    marker: a.discoveryRun
      ? formatMarker(a.discoveryRun.discovery_type, a.discoveryRun.marker_index)
      : null,
  }));
}

/**
 * Get Discovery artifact detail by public ID.
 */
export async function getDiscoveryArtifactByPublicId(
  ctx: ApplicationContext,
  projectId: number,
  artifactPublicId: string,
): Promise<DiscoveryArtifactDetail | null> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const artifact = await DiscoveryArtifactModel.findOne({
    where: {
      project_id: projectId,
      public_id: artifactPublicId,
    },
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['public_id', 'discovery_type', 'marker_index'],
    }],
  }) as any;

  if (!artifact) {
    return null;
  }

  // Get source count
  const sourceCount = await DiscoveryRunSourceModel.count({
    where: { discovery_run_id: artifact.discovery_run_id },
  });

  // Get supersession info
  let supersededById: string | null = null;
  if (artifact.superseded_by_id) {
    const superseding = await DiscoveryArtifactModel.findByPk(artifact.superseded_by_id, {
      attributes: ['public_id'],
    }) as any;
    supersededById = superseding?.public_id || null;
  }

  const marker = artifact.discoveryRun
    ? formatMarker(artifact.discoveryRun.discovery_type, artifact.discoveryRun.marker_index)
    : null;

  return {
    publicId: artifact.public_id,
    runPublicId: artifact.discoveryRun?.public_id || '',
    artifactType: artifact.artifact_type,
    title: artifact.title,
    topicSlug: artifact.topic_slug,
    version: artifact.version,
    status: artifact.status,
    templateName: artifact.template_name,
    templateVersion: artifact.template_version,
    createdAt: artifact.created_at.toISOString(),
    githubPath: artifact.github_path,
    projectedAt: artifact.projected_at?.toISOString() || null,
    canonicalContent: artifact.canonical_content,
    derivationFingerprint: artifact.derivation_fingerprint,
    githubSha: artifact.github_sha,
    projectionError: artifact.projection_error,
    supersededById,
    supersededAt: artifact.superseded_at?.toISOString() || null,
    sourceCount,
    marker,
    // DR-4a: Extraction status fields
    extractionStatus: artifact.extraction_status || null,
    extractionAttemptedAt: artifact.extraction_attempted_at?.toISOString() || null,
    extractionInsightCount: artifact.extraction_insight_count ?? null,
    extractionFailureReason: artifact.extraction_failure_reason || null,
    extractionPermanentFailure: artifact.extraction_permanent_failure ?? null,
    extractionNextRetryAt: artifact.extraction_next_retry_at?.toISOString() || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-3B: ARTIFACT VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

const StudyVariableModel = sequelize.models.StudyVariable;

const DISCOVERY_TYPE_LABELS: Record<string, string> = {
  desk_research: 'Desk Research',
  stakeholder_synthesis: 'Stakeholder Synthesis',
  survey_synthesis: 'Survey Synthesis',
  cross_source_synthesis: 'Cross-Source Synthesis',
};

/**
 * Get extracted variables for a Discovery artifact.
 *
 * DISC-3B: Queries canonical study_variables via discovery_artifact_fk_id lineage.
 * Does NOT query GitHub or regenerate variables.
 */
export async function getArtifactVariables(
  ctx: ApplicationContext,
  projectId: number,
  artifactPublicId: string,
): Promise<DiscoveryArtifactVariables | null> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  // Get artifact with run for marker
  const artifact = await DiscoveryArtifactModel.findOne({
    where: {
      project_id: projectId,
      public_id: artifactPublicId,
    },
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['discovery_type', 'marker_index'],
    }],
  }) as any;

  if (!artifact) {
    return null;
  }

  // Query variables linked to this artifact
  const variables = await StudyVariableModel.findAll({
    where: {
      discovery_artifact_fk_id: artifact.id,
    },
    order: [['variable_key', 'ASC'], ['item_key', 'ASC']],
  }) as any[];

  // Transform to response format
  const variableItems: DiscoveryVariableItem[] = variables.map(v => ({
    key: v.variable_key,
    label: VARIABLE_LABELS[v.variable_key] || formatVariableLabel(v.variable_key),
    value: v.value,
    variableType: v.variable_type,
    itemId: v.item_key,
    isPool: v.is_pool || false,
    confidence: v.confidence,
  }));

  const marker = artifact.discoveryRun
    ? formatMarker(artifact.discoveryRun.discovery_type, artifact.discoveryRun.marker_index)
    : null;

  // Get latest extraction date
  const latestExtractedAt = variables.length > 0
    ? variables.reduce((latest, v) =>
        v.extracted_at > latest ? v.extracted_at : latest,
        variables[0].extracted_at,
      )
    : null;

  return {
    artifactPublicId: artifact.public_id,
    marker,
    artifactType: artifact.artifact_type,
    typeLabel: DISCOVERY_TYPE_LABELS[artifact.artifact_type] || artifact.artifact_type,
    variables: variableItems,
    variableCount: variableItems.length,
    extractedAt: latestExtractedAt?.toISOString() || null,
  };
}

/**
 * Format a variable key as a human-readable label.
 * Fallback when no explicit mapping exists.
 */
function formatVariableLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-3B: KNOWLEDGE GAPS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get aggregated knowledge gaps across all current Discovery artifacts for a project.
 *
 * DISC-3B: Queries canonical study_variables with variable_key='knowledge_gaps'
 * linked to CURRENT DiscoveryArtifacts. Preserves provenance for each gap.
 */
export async function getKnowledgeGaps(
  ctx: ApplicationContext,
  projectId: number,
): Promise<DiscoveryKnowledgeGapsResponse> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  // Get all current artifacts for the project
  const currentArtifacts = await DiscoveryArtifactModel.findAll({
    where: {
      project_id: projectId,
      status: 'current',
    },
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['discovery_type', 'marker_index'],
    }],
  }) as any[];

  if (currentArtifacts.length === 0) {
    return {
      projectId,
      count: 0,
      gaps: [],
    };
  }

  const artifactIds = currentArtifacts.map(a => a.id);
  const artifactMap = new Map(currentArtifacts.map(a => [a.id, a]));

  // Query knowledge_gaps variables for current artifacts
  const variables = await StudyVariableModel.findAll({
    where: {
      discovery_artifact_fk_id: { [Op.in]: artifactIds },
      variable_key: 'knowledge_gaps',
    },
  }) as any[];

  // Transform to response format with provenance
  const gaps: DiscoveryKnowledgeGap[] = [];

  for (const v of variables) {
    const artifact = artifactMap.get(v.discovery_artifact_fk_id);
    if (!artifact) continue;

    const marker = artifact.discoveryRun
      ? formatMarker(artifact.discoveryRun.discovery_type, artifact.discoveryRun.marker_index)
      : null;

    // Handle both array and singleton values
    const gapValues = Array.isArray(v.value) ? v.value : [v.value];

    for (let i = 0; i < gapValues.length; i++) {
      const gapItem = gapValues[i];
      if (!gapItem) continue;

      // Extract gap text (handle both string and object shapes)
      const gapText = typeof gapItem === 'string'
        ? gapItem
        : (gapItem.gap || gapItem.description || gapItem.text || JSON.stringify(gapItem));

      // Extract item ID if present
      const itemId = typeof gapItem === 'object' && gapItem !== null
        ? (gapItem.id || gapItem.item_id || null)
        : (v.item_key ? `${v.item_key}-${i}` : null);

      gaps.push({
        gap: gapText,
        itemId,
        sourceArtifactPublicId: artifact.public_id,
        sourceMarker: marker,
        discoveryType: artifact.discoveryRun?.discovery_type as DiscoveryTypeKey || 'desk_research',
        sourceVariableKey: 'knowledge_gaps',
        extractedAt: v.extracted_at?.toISOString() || null,
      });
    }
  }

  return {
    projectId,
    count: gaps.length,
    gaps,
  };
}

// ─── Privacy Error ──────────────────────────────────────────────

export class PrivacyError extends Error {
  public readonly findings: PrivacyViolation[];

  constructor(message: string, findings: PrivacyViolation[]) {
    super(message);
    this.name = 'PrivacyError';
    this.findings = findings;
  }
}
