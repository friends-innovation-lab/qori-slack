/**
 * Insight Extraction Service — DR-2
 *
 * Extracts candidate insights from emitted Discovery variables and persists
 * them as proposed desk_insight revisions via the DR-1 canonical service.
 *
 * Per SPEC-2 design authority:
 * - AI must never automatically accept a revision (proposed only)
 * - No review event or accepted pointer is created
 * - Extraction failure does not fail the Discovery run
 * - Idempotent: retries produce no duplicate insights
 *
 * Insight-worthy variables:
 * - discovered_barriers: Obstacles that blocked/degraded task completion
 * - knowledge_gaps: Questions the research problem requires but source cannot answer
 *
 * Evidence references use source-level attribution with attribution_limitation
 * flag since we cannot verify page/section/excerpt locators from AI extraction.
 */

import sequelize from '../database';
import { Op } from 'sequelize';
import type { EvidenceReference, EvidenceLocator } from '../database/models/evidence_construct_revision';
import * as deskInsightService from './desk-insight.service';

const { StudyVariable, DiscoveryArtifact, DiscoveryRunSource, EvidenceSource, DiscoveryRun } = sequelize.models;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Variables that should be extracted as insights
 */
const INSIGHT_VARIABLE_KEYS = ['discovered_barriers', 'knowledge_gaps'] as const;
type InsightVariableKey = typeof INSIGHT_VARIABLE_KEYS[number];

export interface ExtractionConfig {
  /** Only extract these variable types (default: all insight-worthy) */
  variableKeys?: InsightVariableKey[];
  /** Log detailed extraction progress */
  verbose?: boolean;
}

export interface ExtractionResult {
  /** Whether extraction completed without fatal errors */
  success: boolean;
  /** Total insights created (new) */
  createdCount: number;
  /** Total insights skipped (already existed via ingestion key) */
  skippedCount: number;
  /** Insights that failed validation */
  failedCount: number;
  /** Per-variable breakdown */
  breakdown: Record<string, { created: number; skipped: number; failed: number }>;
  /** Error if extraction failed */
  error?: string;
}

interface DiscoveredBarrier {
  id: string;
  title: string;
  summary: string;
  barrier_categories?: string[];
  magnitude?: string;
  evidence?: string[];
  affected_population?: string;
  source_document: string;
  confidence?: string;
}

interface KnowledgeGap {
  id: string;
  gap: string;
  why_matters?: string;
  suggested_resolution?: string;
  source_document?: string;
}

interface SourceMapping {
  evidenceSourceId: number;
  label: string;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Extract candidate insights from a completed Discovery run.
 *
 * Called after variable extraction completes, before run completion.
 * Failures are logged but do not fail the run.
 */
/**
 * Persist extraction status to artifact for durable retry.
 */
async function updateExtractionStatus(
  artifactId: number,
  status: 'pending' | 'success' | 'partial' | 'failed' | 'not_applicable',
  result: ExtractionResult,
): Promise<void> {
  // Capture failure reason for partial or failed status
  let failureReason: string | null = null;
  if (status === 'failed' || status === 'partial') {
    if (result.error) {
      failureReason = result.error;
    } else if (result.failedCount > 0) {
      failureReason = `${result.failedCount} candidates failed`;
    }
  }

  await DiscoveryArtifact.update(
    {
      extraction_status: status,
      extraction_attempted_at: new Date(),
      extraction_failure_reason: failureReason,
      extraction_insight_count: result.createdCount,
    },
    { where: { id: artifactId } },
  );
}

export async function extractInsightsFromDiscoveryRun(
  runId: number,
  artifactId: number,
  config: ExtractionConfig = {},
): Promise<ExtractionResult> {
  const variableKeys = config.variableKeys ?? [...INSIGHT_VARIABLE_KEYS];
  const verbose = config.verbose ?? false;

  const result: ExtractionResult = {
    success: true,
    createdCount: 0,
    skippedCount: 0,
    failedCount: 0,
    breakdown: {},
  };

  try {
    // Load run and artifact for context
    const run = await DiscoveryRun.findByPk(runId);
    const artifact = await DiscoveryArtifact.findByPk(artifactId);

    if (!run || !artifact) {
      return {
        ...result,
        success: false,
        error: `Run ${runId} or artifact ${artifactId} not found`,
      };
    }

    const projectId = (run as any).project_id;

    // Build source mapping: source_document name → EvidenceSource
    const { exactMap, allSources } = await buildSourceMapping(runId);

    if (verbose) {
      console.log(`[DR-2] Extracting insights from run ${runId}, artifact ${artifactId}`);
      console.log(`[DR-2] Source mapping: ${allSources.length} sources, ${exactMap.size} lookup keys`);
    }

    // Query variables linked to this artifact
    const variables = await StudyVariable.findAll({
      where: {
        discovery_artifact_fk_id: artifactId,
        variable_key: { [Op.in]: variableKeys },
      },
    });

    if (verbose) {
      console.log(`[DR-2] Found ${variables.length} insight-worthy variables`);
    }

    // Group by variable_key for breakdown tracking
    const variablesByKey = new Map<string, any[]>();
    for (const v of variables) {
      const key = (v as any).variable_key;
      if (!variablesByKey.has(key)) {
        variablesByKey.set(key, []);
      }
      variablesByKey.get(key)!.push(v);
    }

    // Process each variable type
    for (const [varKey, vars] of variablesByKey) {
      result.breakdown[varKey] = { created: 0, skipped: 0, failed: 0 };

      for (const variable of vars) {
        const itemResult = await processVariableItem(
          projectId,
          runId,
          varKey as InsightVariableKey,
          variable,
          exactMap,
          allSources,
          verbose,
        );

        if (itemResult === 'created') {
          result.createdCount++;
          result.breakdown[varKey].created++;
        } else if (itemResult === 'skipped') {
          result.skippedCount++;
          result.breakdown[varKey].skipped++;
        } else {
          result.failedCount++;
          result.breakdown[varKey].failed++;
        }
      }
    }

    if (verbose) {
      console.log(`[DR-2] Extraction complete: ${result.createdCount} created, ${result.skippedCount} skipped, ${result.failedCount} failed`);
    }

    // Persist extraction status for durable retry
    const status = result.failedCount > 0
      ? (result.createdCount > 0 ? 'partial' : 'failed')
      : 'success';
    await updateExtractionStatus(artifactId, status, result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[DR-2] Extraction failed: ${errorMessage}`);

    const failedResult = {
      ...result,
      success: false,
      error: errorMessage,
    };

    // Persist failure status
    await updateExtractionStatus(artifactId, 'failed', failedResult);

    return failedResult;
  }
}

/**
 * Source resolution result: either matched to a specific source or unresolved
 */
interface SourceResolution {
  resolved: boolean;
  evidenceSourceId?: number;
  sourceLabel?: string;
  /** Original AI-provided source name for traceability */
  aiProvidedName: string | null;
  /** Why resolution failed (if unresolved) */
  resolutionNote?: string;
}

/**
 * Build a mapping from source document names to EvidenceSource records.
 *
 * Uses EXACT matching only (case-insensitive). No fuzzy matching.
 * The mapping includes both exact filename and filename-without-extension.
 *
 * Source identity is established via DiscoveryRunSource association,
 * ensuring all mapped sources belong to the run's project.
 */
async function buildSourceMapping(runId: number): Promise<{
  exactMap: Map<string, SourceMapping>;
  allSources: SourceMapping[];
}> {
  const runSources = await DiscoveryRunSource.findAll({
    where: { discovery_run_id: runId },
    include: [{ model: EvidenceSource, as: 'evidenceSource' }],
    order: [['source_order', 'ASC']],
  });

  const exactMap = new Map<string, SourceMapping>();
  const allSources: SourceMapping[] = [];

  for (const rs of runSources) {
    const source = (rs as any).evidenceSource;
    if (!source) continue;

    const label = source.label || '';
    const sourceId = source.id;
    const mapping = { evidenceSourceId: sourceId, label };

    allSources.push(mapping);

    // Add exact match (case-insensitive)
    exactMap.set(label.toLowerCase(), mapping);

    // Add without extension (for "document.pdf" → "document" matching)
    const withoutExt = label.replace(/\.[^/.]+$/, '').toLowerCase();
    if (withoutExt !== label.toLowerCase()) {
      exactMap.set(withoutExt, mapping);
    }
  }

  return { exactMap, allSources };
}

/**
 * Resolve source attribution using EXACT matching only.
 *
 * Never silently substitutes another source.
 * If source cannot be matched, returns unresolved attribution
 * with explicit note explaining the limitation.
 */
function resolveSourceAttribution(
  sourceDocument: string | undefined,
  exactMap: Map<string, SourceMapping>,
  allSources: SourceMapping[],
): SourceResolution {
  if (!sourceDocument) {
    // No source name provided by AI
    if (allSources.length === 1) {
      // Single source run: safe to attribute to that source
      return {
        resolved: true,
        evidenceSourceId: allSources[0].evidenceSourceId,
        sourceLabel: allSources[0].label,
        aiProvidedName: null,
        resolutionNote: 'Single source run; attributed to only available source.',
      };
    }
    return {
      resolved: false,
      aiProvidedName: null,
      resolutionNote: 'AI extraction did not provide source_document name.',
    };
  }

  const normalized = sourceDocument.toLowerCase();

  // Try exact match (case-insensitive)
  if (exactMap.has(normalized)) {
    const match = exactMap.get(normalized)!;
    return {
      resolved: true,
      evidenceSourceId: match.evidenceSourceId,
      sourceLabel: match.label,
      aiProvidedName: sourceDocument,
    };
  }

  // Try without extension
  const withoutExt = normalized.replace(/\.[^/.]+$/, '');
  if (exactMap.has(withoutExt)) {
    const match = exactMap.get(withoutExt)!;
    return {
      resolved: true,
      evidenceSourceId: match.evidenceSourceId,
      sourceLabel: match.label,
      aiProvidedName: sourceDocument,
    };
  }

  // NO FUZZY MATCHING: If exact match fails, return unresolved
  // Include all available source names for debugging
  const availableNames = allSources.map(s => s.label).join(', ');
  return {
    resolved: false,
    aiProvidedName: sourceDocument,
    resolutionNote: `AI provided "${sourceDocument}" but no exact match in run sources: [${availableNames}]`,
  };
}

/**
 * Process a single variable item and create insight if valid.
 */
async function processVariableItem(
  projectId: number,
  runId: number,
  variableKey: InsightVariableKey,
  variable: any,
  exactMap: Map<string, SourceMapping>,
  allSources: SourceMapping[],
  verbose: boolean,
): Promise<'created' | 'skipped' | 'failed'> {
  const itemKey = variable.item_key || 'item-0';
  const value = variable.value;

  // Handle both array values (older format) and direct objects
  const items = Array.isArray(value) ? value : [value];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;

    // Build ingestion key
    const itemId = item.id || `${itemKey}-${i}`;
    const ingestionKey = `run_${runId}:${variableKey}:${itemId}`;

    try {
      // Transform to insight input based on variable type
      let wording: string;
      let sourceDocument: string | undefined;

      if (variableKey === 'discovered_barriers') {
        const barrier = item as DiscoveredBarrier;
        if (!barrier.title && !barrier.summary) {
          if (verbose) console.log(`[DR-2] Skipping barrier ${itemId}: no title or summary`);
          return 'failed';
        }
        wording = formatBarrierWording(barrier);
        sourceDocument = barrier.source_document;
      } else if (variableKey === 'knowledge_gaps') {
        const gap = item as KnowledgeGap;
        if (!gap.gap) {
          if (verbose) console.log(`[DR-2] Skipping gap ${itemId}: no gap text`);
          return 'failed';
        }
        wording = formatGapWording(gap);
        sourceDocument = gap.source_document;
      } else {
        continue;
      }

      // Resolve source attribution (exact match only)
      const resolution = resolveSourceAttribution(sourceDocument, exactMap, allSources);

      // Build evidence references based on resolution
      const evidenceReferences = buildEvidenceReferencesFromResolution(
        resolution,
        item,
        variableKey,
      );

      // If source could not be resolved and we have no evidence references,
      // skip this item rather than creating an incomplete insight
      if (evidenceReferences.length === 0) {
        if (verbose) {
          console.log(`[DR-2] Skipping ${itemId}: source attribution unresolved - ${resolution.resolutionNote}`);
        }
        return 'failed';
      }

      // Create insight idempotently
      const createResult = await deskInsightService.createInsightIdempotent({
        projectId,
        wording,
        evidenceReferences,
        createdBy: 'system:dr-2-extraction',
        origin: 'ai',
        discoveryRunId: runId,
        ingestionKey,
      });

      if (createResult.created) {
        if (verbose) {
          console.log(`[DR-2] Created insight ${createResult.insight.displayId} for ${itemId}`);
        }
        return 'created';
      } else {
        if (verbose) {
          console.log(`[DR-2] Skipped ${itemId}: already exists as ${createResult.insight.displayId}`);
        }
        return 'skipped';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DR-2] Failed to create insight for ${itemId}: ${errorMessage}`);
      return 'failed';
    }
  }

  return 'skipped';
}

/**
 * Format barrier as insight wording
 */
function formatBarrierWording(barrier: DiscoveredBarrier): string {
  const title = barrier.title || 'Untitled barrier';
  const summary = barrier.summary || '';

  if (summary) {
    return `${title}: ${summary}`;
  }
  return title;
}

/**
 * Format knowledge gap as insight wording
 */
function formatGapWording(gap: KnowledgeGap): string {
  const gapText = gap.gap;
  const whyMatters = gap.why_matters;

  if (whyMatters) {
    return `${gapText} (${whyMatters})`;
  }
  return gapText;
}

/**
 * Build evidence references from source resolution.
 *
 * If resolution succeeded: creates a verified source-level attribution.
 * If resolution failed: creates an UNRESOLVED attribution with no source ID.
 *
 * Never silently substitutes another source.
 */
function buildEvidenceReferencesFromResolution(
  resolution: SourceResolution,
  item: DiscoveredBarrier | KnowledgeGap,
  variableKey: InsightVariableKey,
): EvidenceReference[] {
  const references: EvidenceReference[] = [];

  // Extract evidence quotes if available (for barriers)
  let aiExtractedContext: string | undefined;
  const barrier = item as DiscoveredBarrier;
  if (variableKey === 'discovered_barriers' && barrier.evidence && barrier.evidence.length > 0) {
    aiExtractedContext = barrier.evidence.slice(0, 2).join(' | ');
  }

  if (resolution.resolved && resolution.evidenceSourceId !== undefined) {
    // RESOLVED: Exact match found
    references.push({
      evidenceSourceId: resolution.evidenceSourceId,
      sourceLabel: resolution.sourceLabel,
      locator: {
        sourceLevel: true,
        attributionLimitation: 'AI extraction cannot verify page, section, or excerpt precision. Linked to source document as a whole.',
        aiExtractedContext,
      },
      validation: 'ai_unverified',
    });
  } else {
    // UNRESOLVED: No exact match. Create explicit unresolved attribution.
    // We create an insight with an empty evidence array BUT document the
    // AI-provided source name and resolution failure in the insight payload.
    // The desk-insight service will create the insight without evidence references.
    // Frontend/review will show this as "unresolved source attribution".
    //
    // Note: We could also choose to fail here and require manual resolution.
    // Current design: Create insight, flag as needing source resolution.
    console.warn(
      `[DR-2] Unresolved source attribution: ${resolution.resolutionNote}. ` +
      `Insight will be created without evidence reference.`
    );
  }

  return references;
}

/**
 * Retry insight extraction for a completed Discovery run.
 *
 * This function allows extraction to be retried even after run completion
 * because it uses persisted StudyVariable data (not source text).
 *
 * Idempotency is preserved: previously created insights are skipped.
 *
 * Use cases:
 * - Retry failed extractions
 * - Retry partial extractions
 * - Re-run after code fixes
 */
export async function retryInsightExtraction(
  artifactId: number,
  config: ExtractionConfig = {},
): Promise<ExtractionResult> {
  const artifact = await DiscoveryArtifact.findByPk(artifactId, {
    include: [{ model: DiscoveryRun, as: 'discoveryRun' }],
  });

  if (!artifact) {
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      breakdown: {},
      error: `Artifact ${artifactId} not found`,
    };
  }

  const run = (artifact as any).discoveryRun;
  if (!run) {
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      breakdown: {},
      error: `No Discovery run associated with artifact ${artifactId}`,
    };
  }

  // Only allow retry for desk_research
  if (run.discovery_type !== 'desk_research') {
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      breakdown: {},
      error: `Insight extraction only applies to desk_research runs, not ${run.discovery_type}`,
    };
  }

  // Run extraction using persisted variable data
  return extractInsightsFromDiscoveryRun(run.id, artifactId, config);
}

/**
 * Find artifacts that need extraction retry.
 */
export async function findArtifactsNeedingExtractionRetry(
  projectId?: number,
  limit = 100,
): Promise<Array<{ artifactId: number; publicId: string; status: string; failureReason: string | null }>> {
  const where: any = {
    extraction_status: { [Op.in]: ['failed', 'partial'] },
  };

  if (projectId) {
    where.project_id = projectId;
  }

  const artifacts = await DiscoveryArtifact.findAll({
    where,
    attributes: ['id', 'public_id', 'extraction_status', 'extraction_failure_reason'],
    order: [['extraction_attempted_at', 'ASC']],
    limit,
  });

  return artifacts.map((a: any) => ({
    artifactId: a.id,
    publicId: a.public_id,
    status: a.extraction_status,
    failureReason: a.extraction_failure_reason,
  }));
}

/**
 * Get insight extraction status for a Discovery artifact
 */
export async function getExtractionStatus(artifactId: number): Promise<{
  extracted: boolean;
  insightCount: number;
  lastExtractedAt: Date | null;
} | null> {
  const artifact = await DiscoveryArtifact.findByPk(artifactId, {
    include: [{ model: DiscoveryRun, as: 'discoveryRun' }],
  });

  if (!artifact) {
    return null;
  }

  const run = (artifact as any).discoveryRun;
  if (!run) {
    return null;
  }

  // Count insights created from this run
  const { EvidenceConstruct } = sequelize.models;
  const insights = await EvidenceConstruct.findAll({
    where: {
      project_id: run.project_id,
      construct_type: 'desk_insight',
      ingestion_key: { [Op.like]: `run_${run.id}:%` },
    },
    attributes: ['id', 'created_at'],
    order: [['created_at', 'DESC']],
    limit: 1,
  });

  const insightCount = await EvidenceConstruct.count({
    where: {
      project_id: run.project_id,
      construct_type: 'desk_insight',
      ingestion_key: { [Op.like]: `run_${run.id}:%` },
    },
  });

  const lastExtractedAt = insights.length > 0 ? (insights[0] as any).created_at : null;

  return {
    extracted: insightCount > 0,
    insightCount,
    lastExtractedAt,
  };
}
