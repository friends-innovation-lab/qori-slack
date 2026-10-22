/**
 * Readout Generation Executor — DR-6b-5b
 *
 * Server-side AI generation for Desk Research Readouts.
 *
 * Execution flow:
 * 1. Accept claimed generation request
 * 2. Load persisted evidence snapshot from version record
 * 3. Resolve pinned accepted insight revisions
 * 4. Assemble AI prompt from revision content
 * 5. Generate via model provider
 * 6. Validate output strictly against evidence snapshot
 * 7. Complete via completeGenerationWithFencing()
 *
 * Key constraints:
 * - Never use completeJob() — always completeGenerationWithFencing()
 * - No model calls inside database transactions
 * - Distinguish transient vs permanent failures
 * - Preserve researcher's draft on generation failure
 * - Generated content begins unchecked/unreviewed
 */

import { Op } from 'sequelize';
import sequelize from '../database';
import { createModel, getModelName } from '../helpers/modelProvider';
import { validateGeneratedOutput, type ValidationResult } from './readout-generation-validator.service';
import { completeGenerationWithFencing } from './desk-readout.service';
import { updateHeartbeat, NotOwnerError } from './readout-generation-claim.service';
import type { DraftContent } from '../database/models/desk_research_readout_draft';
import type { EvidenceSetEntry, DeskResearchReadoutVersion } from '../database/models/desk_research_readout_version';

const {
  DeskResearchReadout,
  DeskResearchReadoutVersion: VersionModel,
  ResearchStudy,
  Project,
  EvidenceConstruct,
  EvidenceConstructRevision,
} = sequelize.models;

// ─── Configuration ─────────────────────────────────────────────────

const GENERATION_TEMPERATURE = parseFloat(process.env.READOUT_GEN_TEMPERATURE || '0.3');
const GENERATION_MAX_TOKENS = parseInt(process.env.READOUT_GEN_MAX_TOKENS || '8192', 10);

// ─── Error Types ───────────────────────────────────────────────────

export type FailureCategory =
  | 'TRANSIENT_PROVIDER'     // Retry eligible: API timeout, rate limit
  | 'VALIDATION_FAILED'      // Invalid model output
  | 'EVIDENCE_RESOLUTION'    // Evidence snapshot cannot be resolved
  | 'AUTHORIZATION_FAILED'   // Worker no longer owns the claim
  | 'SUPERSEDED'             // Request was superseded during generation
  | 'HUMAN_EDIT_CONFLICT'    // Draft was edited during generation (preserved, not failed)
  | 'UNKNOWN';               // Unexpected error

export interface ExecutionFailure {
  category: FailureCategory;
  code: string;
  message: string;
  retryEligible: boolean;
  details?: string;
}

export interface ExecutionResult {
  success: boolean;
  versionId: number;
  content?: DraftContent;
  applied?: boolean;
  conflictDetected?: boolean;
  failure?: ExecutionFailure;
}

// ─── Evidence Resolution ───────────────────────────────────────────

interface ResolvedEvidence {
  displayId: string;
  constructPublicId: string;
  revisionPublicId: string;
  wording: string;
  source: string | null;
}

interface EvidenceResolutionResult {
  success: boolean;
  evidence?: ResolvedEvidence[];
  error?: string;
}

/**
 * Resolve evidence snapshot to full revision content.
 *
 * Only resolves revisions that are STILL accepted and not withdrawn.
 * Returns error if any revision cannot be resolved.
 */
async function resolveEvidenceSnapshot(
  evidenceSet: EvidenceSetEntry[],
  projectId: number,
): Promise<EvidenceResolutionResult> {
  const evidence: ResolvedEvidence[] = [];

  // Batch load constructs
  const constructPublicIds = [...new Set(evidenceSet.map(e => e.constructPublicId))];
  const constructs = await EvidenceConstruct.findAll({
    where: {
      public_id: { [Op.in]: constructPublicIds },
      project_id: projectId,
      construct_type: 'desk_insight',
      withdrawn_at: null,
    },
    attributes: ['id', 'public_id', 'accepted_revision_id', 'display_sequence'],
  });

  const constructMap = new Map<string, { id: number; acceptedRevisionId: number | null; displaySequence: number }>();
  for (const c of constructs) {
    constructMap.set(c.get('public_id') as string, {
      id: c.get('id') as number,
      acceptedRevisionId: c.get('accepted_revision_id') as number | null,
      displaySequence: c.get('display_sequence') as number,
    });
  }

  // Batch load revisions
  const revisionPublicIds = evidenceSet.map(e => e.revisionPublicId);
  const revisions = await EvidenceConstructRevision.findAll({
    where: { public_id: { [Op.in]: revisionPublicIds } },
    attributes: ['id', 'public_id', 'construct_id', 'revision_number', 'content'],
  });

  const revisionMap = new Map<string, { id: number; constructId: number; content: { wording?: string } | null }>();
  for (const r of revisions) {
    revisionMap.set(r.get('public_id') as string, {
      id: r.get('id') as number,
      constructId: r.get('construct_id') as number,
      content: r.get('content') as { wording?: string } | null,
    });
  }

  // Resolve each evidence entry
  for (const entry of evidenceSet) {
    const construct = constructMap.get(entry.constructPublicId);
    if (!construct) {
      return {
        success: false,
        error: `Construct ${entry.constructPublicId} not found, withdrawn, or wrong project`,
      };
    }

    const revision = revisionMap.get(entry.revisionPublicId);
    if (!revision) {
      return {
        success: false,
        error: `Revision ${entry.revisionPublicId} not found`,
      };
    }

    // Validate revision belongs to construct
    if (revision.constructId !== construct.id) {
      return {
        success: false,
        error: `Revision ${entry.revisionPublicId} does not belong to construct ${entry.constructPublicId}`,
      };
    }

    // Validate revision is still accepted
    if (construct.acceptedRevisionId !== revision.id) {
      return {
        success: false,
        error: `Revision ${entry.revisionPublicId} is no longer accepted`,
      };
    }

    const wording = revision.content?.wording || '';
    if (!wording) {
      return {
        success: false,
        error: `Revision ${entry.revisionPublicId} has no wording content`,
      };
    }

    evidence.push({
      displayId: entry.displayId,
      constructPublicId: entry.constructPublicId,
      revisionPublicId: entry.revisionPublicId,
      wording,
      source: null, // Could be enriched from evidence_snapshot if needed
    });
  }

  return { success: true, evidence };
}

// ─── Prompt Assembly ───────────────────────────────────────────────

interface PromptContext {
  readoutTitle: string;
  readoutQuestion: string | null;
  studyName: string;
  projectName: string;
  evidenceItems: ResolvedEvidence[];
  evidenceCount: number;
  currentDate: string;
}

/**
 * Assemble the generation prompt from context.
 *
 * Uses the structure from desk_research_readout.yaml but inline
 * for executor autonomy (no YAML parsing at runtime).
 */
function assemblePrompt(ctx: PromptContext): string {
  const evidenceSection = ctx.evidenceItems
    .map((item) => {
      const sourceNote = item.source ? ` (Source: ${item.source})` : '';
      return `---\n**[${item.displayId}]**${sourceNote}\n\n${item.wording}`;
    })
    .join('\n');

  const questionSection = ctx.readoutQuestion
    ? `**Research Question:** ${ctx.readoutQuestion}\n`
    : '';

  return `You are generating a **research-planning readout** that will inform a Research Brief.

## Context

**Study:** ${ctx.studyName}
**Project:** ${ctx.projectName}
**Readout Title:** ${ctx.readoutTitle}
${questionSection}**Date:** ${ctx.currentDate}

## Available Evidence

The following ${ctx.evidenceCount} accepted desk research insights are available.
Each has a display ID (e.g., IN-0001) that you MUST use for citations.

${evidenceSection}
---

## Your Task

Generate a structured readout in JSON format with the following sections:

### Required Output Structure

\`\`\`json
{
  "summary": {
    "text": "2-3 sentence synthesis of what this evidence reveals about the research topic",
    "citations": [{"displayId": "IN-0001"}, ...]
  },
  "findings": [
    {
      "id": "F1",
      "text": "Evidence-supported finding statement",
      "citations": [{"displayId": "IN-0001"}, {"displayId": "IN-0002"}]
    }
  ],
  "limitations": [
    {
      "id": "L1",
      "text": "Description of evidence gap or methodological limitation"
    }
  ],
  "implications": [
    {
      "id": "I1",
      "kind": "question|gap|priority|hypothesis",
      "text": "Implication for the Research Brief",
      "basedOnFindings": ["F1", "F2"]
    }
  ]
}
\`\`\`

## Critical Rules

### Evidence and Citations
1. **ONLY cite insights that exist in the evidence above.** Use the exact displayId (e.g., IN-0001).
2. **Every finding MUST have at least one citation.** Do not create findings without evidence.
3. **Never invent, fabricate, or hallucinate insight IDs.** If an ID is not in the evidence list, you cannot cite it.
4. **Never fabricate quotations.** Paraphrase the wording from the insights.

### Findings (3-7 findings)
- Each finding must be directly supported by at least one cited insight
- Finding IDs must be sequential: F1, F2, F3, etc.
- Findings are EVIDENCE-SUPPORTED OBSERVATIONS, not recommendations

### Limitations (1-3 limitations)
- Identify gaps in the available evidence
- Note methodological limitations of the source research
- Limitation IDs must be sequential: L1, L2, L3

### Implications for Research Brief (3-6 implications)

Each implication must:
- Link to at least one finding (basedOnFindings array)
- Have one of these kinds:
  - "question": Suggested research question for primary research
  - "gap": Knowledge gap requiring primary research
  - "priority": Recommended research priority
  - "hypothesis": Testable hypothesis derived from evidence
- Implication IDs must be sequential: I1, I2, I3, etc.

### Distinguishing Content Types

CLEARLY DISTINGUISH:
- **Evidence-supported observations** (findings) — directly from insights
- **AI-generated suggestions** (implications) — your synthesis and recommendations
- **Missing or insufficient evidence** (limitations) — what the evidence doesn't cover

## Output Format

Return ONLY valid JSON matching the structure above. No markdown code fences, no explanatory text.
The output will be validated. Invalid citations or malformed JSON will be rejected.`;
}

// ─── Executor ──────────────────────────────────────────────────────

/**
 * Execute AI generation for a claimed readout version.
 *
 * This function:
 * 1. Loads the version and its evidence snapshot
 * 2. Resolves evidence to full revision content
 * 3. Calls the AI model
 * 4. Validates output strictly
 * 5. Completes via completeGenerationWithFencing()
 *
 * Returns ExecutionResult with success/failure details.
 *
 * NOTE: This function does NOT claim the job. It expects the job
 * to already be claimed by the caller (poller).
 */
export async function executeGeneration(
  versionId: number,
  workerId: string,
  onHeartbeat?: () => Promise<void>,
): Promise<ExecutionResult> {
  // Load version record
  const version = await VersionModel.findByPk(versionId);
  if (!version) {
    return {
      success: false,
      versionId,
      failure: {
        category: 'UNKNOWN',
        code: 'VERSION_NOT_FOUND',
        message: `Version ${versionId} not found`,
        retryEligible: false,
      },
    };
  }

  // Verify worker ownership
  const versionWorkerId = version.get('worker_id') as string | null;
  if (versionWorkerId !== workerId) {
    return {
      success: false,
      versionId,
      failure: {
        category: 'AUTHORIZATION_FAILED',
        code: 'NOT_OWNER',
        message: `Worker ${workerId} does not own version ${versionId}`,
        retryEligible: false,
      },
    };
  }

  // Check not already terminal
  const versionStatus = version.get('generation_status') as string;
  if (['completed', 'failed', 'superseded'].includes(versionStatus)) {
    return {
      success: false,
      versionId,
      failure: {
        category: 'SUPERSEDED',
        code: 'ALREADY_TERMINAL',
        message: `Version ${versionId} is already ${versionStatus}`,
        retryEligible: false,
      },
    };
  }

  const evidenceSet = version.get('evidence_set') as EvidenceSetEntry[];
  const readoutId = version.get('readout_id') as number;
  const generationRequestId = version.get('generation_request_id') as string;

  // Load readout and related metadata
  const readout = await DeskResearchReadout.findByPk(readoutId);
  if (!readout) {
    return {
      success: false,
      versionId,
      failure: {
        category: 'EVIDENCE_RESOLUTION',
        code: 'READOUT_NOT_FOUND',
        message: `Readout ${readoutId} not found`,
        retryEligible: false,
      },
    };
  }

  const projectId = readout.get('project_id') as number;
  const studyId = readout.get('study_id') as number;

  // Load study and project names
  const [study, project] = await Promise.all([
    ResearchStudy.findByPk(studyId, { attributes: ['name'] }),
    Project.findByPk(projectId, { attributes: ['name'] }),
  ]);

  const studyName = study?.get('name') as string || 'Unknown Study';
  const projectName = project?.get('name') as string || 'Unknown Project';

  // Resolve evidence snapshot to full revision content
  const resolutionResult = await resolveEvidenceSnapshot(evidenceSet, projectId);
  if (!resolutionResult.success) {
    return {
      success: false,
      versionId,
      failure: {
        category: 'EVIDENCE_RESOLUTION',
        code: 'EVIDENCE_RESOLUTION_FAILED',
        message: resolutionResult.error || 'Failed to resolve evidence',
        retryEligible: false,
      },
    };
  }

  // Heartbeat before long AI call
  if (onHeartbeat) {
    try {
      await onHeartbeat();
    } catch (e) {
      if (e instanceof NotOwnerError) {
        return {
          success: false,
          versionId,
          failure: {
            category: 'AUTHORIZATION_FAILED',
            code: 'CLAIM_LOST_PRE_GENERATION',
            message: 'Lost claim ownership before generation',
            retryEligible: false,
          },
        };
      }
    }
  }

  // Assemble prompt
  const promptContext: PromptContext = {
    readoutTitle: readout.get('title') as string,
    readoutQuestion: readout.get('question') as string | null,
    studyName,
    projectName,
    evidenceItems: resolutionResult.evidence!,
    evidenceCount: resolutionResult.evidence!.length,
    currentDate: new Date().toISOString().split('T')[0],
  };

  const prompt = assemblePrompt(promptContext);

  // Call AI model
  let rawOutput: string;
  try {
    const model = createModel({
      tier: 'sonnet',
      temperature: GENERATION_TEMPERATURE,
      maxTokens: GENERATION_MAX_TOKENS,
      purpose: 'readout-generation',
    });

    const response = await model.invoke(prompt);
    rawOutput = response.content as string;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    // Classify provider errors
    const isTransient = isTransientProviderError(message);

    return {
      success: false,
      versionId,
      failure: {
        category: isTransient ? 'TRANSIENT_PROVIDER' : 'UNKNOWN',
        code: 'PROVIDER_ERROR',
        message: sanitizeProviderError(message),
        retryEligible: isTransient,
      },
    };
  }

  // Heartbeat after AI call
  if (onHeartbeat) {
    try {
      await onHeartbeat();
    } catch (e) {
      if (e instanceof NotOwnerError) {
        return {
          success: false,
          versionId,
          failure: {
            category: 'AUTHORIZATION_FAILED',
            code: 'CLAIM_LOST_POST_GENERATION',
            message: 'Lost claim ownership after generation (content not applied)',
            retryEligible: false,
          },
        };
      }
    }
  }

  // Validate output
  const validationResult: ValidationResult = validateGeneratedOutput(rawOutput, evidenceSet);
  if (!validationResult.valid) {
    const errorSummary = validationResult.errors
      .slice(0, 5)
      .map(e => `[${e.code}] ${e.message}`)
      .join('; ');

    return {
      success: false,
      versionId,
      failure: {
        category: 'VALIDATION_FAILED',
        code: 'OUTPUT_VALIDATION_FAILED',
        message: `Validation failed: ${errorSummary}`,
        retryEligible: false,
        details: JSON.stringify(validationResult.errors),
      },
    };
  }

  const content = validationResult.content!;

  // Complete via fencing (handles conflict detection and draft update)
  try {
    const completionResult = await completeGenerationWithFencing({
      readoutId,
      generationRequestId,
      content,
      status: 'completed',
      workerId,
    });

    if (completionResult.fencingViolation) {
      return {
        success: false,
        versionId,
        failure: {
          category: 'AUTHORIZATION_FAILED',
          code: 'FENCING_VIOLATION',
          message: 'Worker no longer owns this generation request',
          retryEligible: false,
        },
      };
    }

    return {
      success: true,
      versionId,
      content,
      applied: completionResult.applied,
      conflictDetected: completionResult.conflictDetected,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      versionId,
      failure: {
        category: 'UNKNOWN',
        code: 'COMPLETION_ERROR',
        message: sanitizeProviderError(message),
        retryEligible: false,
      },
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Detect transient provider errors eligible for retry.
 */
function isTransientProviderError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('rate limit') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout')
  );
}

/**
 * Sanitize provider error messages for persistence.
 *
 * Removes potentially sensitive content:
 * - API keys
 * - Full prompts
 * - Internal paths
 */
function sanitizeProviderError(message: string): string {
  return message
    // API keys
    .replace(/sk-ant-[a-zA-Z0-9-_]+/g, '[API_KEY]')
    .replace(/sk-[a-zA-Z0-9-_]+/g, '[API_KEY]')
    // Long strings that might be prompts
    .replace(/".{500,}"/g, '"[TRUNCATED]"')
    // File paths
    .replace(/\/Users\/[^\s]+/g, '[PATH]')
    .replace(/\/home\/[^\s]+/g, '[PATH]')
    // Limit length
    .substring(0, 500);
}

/**
 * Get model information for provenance.
 */
export function getGenerationModelInfo(): { tier: string; modelName: string } {
  return {
    tier: 'sonnet',
    modelName: getModelName('sonnet'),
  };
}
