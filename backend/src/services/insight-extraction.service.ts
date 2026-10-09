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
    const sourceMapping = await buildSourceMapping(runId);

    if (verbose) {
      console.log(`[DR-2] Extracting insights from run ${runId}, artifact ${artifactId}`);
      console.log(`[DR-2] Source mapping: ${sourceMapping.size} sources`);
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
          sourceMapping,
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

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[DR-2] Extraction failed: ${errorMessage}`);

    return {
      ...result,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Build a mapping from source document names to EvidenceSource records.
 *
 * Uses fuzzy matching since AI-generated source_document names may not
 * exactly match the original filenames.
 */
async function buildSourceMapping(runId: number): Promise<Map<string, SourceMapping>> {
  const runSources = await DiscoveryRunSource.findAll({
    where: { discovery_run_id: runId },
    include: [{ model: EvidenceSource, as: 'evidenceSource' }],
  });

  const mapping = new Map<string, SourceMapping>();

  for (const rs of runSources) {
    const source = (rs as any).evidenceSource;
    if (!source) continue;

    const label = source.label || '';
    const sourceId = source.id;

    // Add exact match
    mapping.set(label.toLowerCase(), { evidenceSourceId: sourceId, label });

    // Add without extension
    const withoutExt = label.replace(/\.[^/.]+$/, '');
    mapping.set(withoutExt.toLowerCase(), { evidenceSourceId: sourceId, label });

    // Add normalized (remove special chars)
    const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    mapping.set(normalized, { evidenceSourceId: sourceId, label });
  }

  return mapping;
}

/**
 * Find the best matching EvidenceSource for a source_document name.
 */
function findSourceMatch(
  sourceDocument: string | undefined,
  sourceMapping: Map<string, SourceMapping>,
): SourceMapping | null {
  if (!sourceDocument) return null;

  const normalized = sourceDocument.toLowerCase();

  // Try exact match
  if (sourceMapping.has(normalized)) {
    return sourceMapping.get(normalized)!;
  }

  // Try without extension
  const withoutExt = normalized.replace(/\.[^/.]+$/, '');
  if (sourceMapping.has(withoutExt)) {
    return sourceMapping.get(withoutExt)!;
  }

  // Try normalized
  const furtherNormalized = normalized.replace(/[^a-z0-9]/g, ' ').trim();
  if (sourceMapping.has(furtherNormalized)) {
    return sourceMapping.get(furtherNormalized)!;
  }

  // Fuzzy match: find any source that contains the key term
  for (const [key, value] of sourceMapping) {
    if (key.includes(furtherNormalized) || furtherNormalized.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * Process a single variable item and create insight if valid.
 */
async function processVariableItem(
  projectId: number,
  runId: number,
  variableKey: InsightVariableKey,
  variable: any,
  sourceMapping: Map<string, SourceMapping>,
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

      // Build evidence references
      const evidenceReferences = buildEvidenceReferences(
        item,
        sourceDocument,
        sourceMapping,
        variableKey,
      );

      // If no valid source reference, use fallback (still create insight, but flag limitation)
      if (evidenceReferences.length === 0) {
        if (verbose) {
          console.log(`[DR-2] No source match for ${itemId}, using fallback attribution`);
        }
        // Get first available source as fallback
        const firstSource = sourceMapping.values().next().value;
        if (firstSource) {
          evidenceReferences.push(buildFallbackReference(firstSource.evidenceSourceId));
        }
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
 * Build evidence references from extracted variable data
 */
function buildEvidenceReferences(
  item: DiscoveredBarrier | KnowledgeGap,
  sourceDocument: string | undefined,
  sourceMapping: Map<string, SourceMapping>,
  variableKey: InsightVariableKey,
): EvidenceReference[] {
  const references: EvidenceReference[] = [];

  // Try to match source document
  const sourceMatch = findSourceMatch(sourceDocument, sourceMapping);

  if (!sourceMatch) {
    return references;
  }

  // Build locator - source-level since we cannot verify specific locators
  const locator: EvidenceLocator = {
    sourceLevel: true,
    attributionLimitation: 'AI extraction cannot verify page, section, or excerpt precision. Linked to source document as a whole.',
  };

  // Extract evidence quotes if available (for barriers)
  const barrier = item as DiscoveredBarrier;
  if (variableKey === 'discovered_barriers' && barrier.evidence && barrier.evidence.length > 0) {
    // We have evidence quotes but cannot verify their exact location
    // Include first quote as context in the locator
    locator.aiExtractedContext = barrier.evidence.slice(0, 2).join(' | ');
  }

  references.push({
    evidenceSourceId: sourceMatch.evidenceSourceId,
    locator,
    validation: 'ai_unverified',
  });

  return references;
}

/**
 * Build a fallback reference when source cannot be matched
 */
function buildFallbackReference(evidenceSourceId: number): EvidenceReference {
  return {
    evidenceSourceId,
    locator: {
      sourceLevel: true,
      attributionLimitation: 'Source document name could not be matched. Using fallback attribution.',
    },
    validation: 'ai_unverified',
  };
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
