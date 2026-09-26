/**
 * Coach Execution Orchestrator — Coach M2
 *
 * Orchestrates the complete execution lifecycle for a coaching run:
 * claim → resolve contract → build context → provider call → validate → repair → persist
 *
 * Key responsibilities:
 * - Single entry point for run execution
 * - Heartbeat management during long operations
 * - Repair loop for invalid output
 * - Atomic result persistence
 * - Failure normalization
 *
 * Reliability model:
 * - Provider execution: AT-LEAST-ONCE (may be called multiple times on recovery)
 * - Accepted Qori result: EXACTLY-ONCE (ownership check before persistence)
 */

import type { Transaction } from 'sequelize';
import type { CoachingRun, CoachingFailureCode } from '../database/models/coaching_run';
import type { CoachingContract, CitationHandle } from './contracts/types';
import type { CoachGenerationResult, CoachUsageMetadata } from './providers/types';
import type { ValidatedCoachOutput } from './output-validator';
import type { RecordCoachingItemInput, RecordCoachingReferenceInput } from '../application/coaching.app-service';

import sequelize from '../database';
import { getActiveContract } from './contracts/registry';
import { resolveContext, ContextResolutionError } from './context-resolver';
import { validateCoachOutput, formatValidationErrors } from './output-validator';
import { createAnthropicProvider } from './providers/anthropic-adapter';
import {
  validateClaimOwnership,
  markCompleted,
  markFailed,
  updateHeartbeat,
  recordUsage,
} from './claim-service';
import { recordCoachRunItems, recordCoachRunReferences, recordCoachRunContext } from '../application/coaching.app-service';
import { COACH_HEARTBEAT_INTERVAL_MS } from './config';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Execution result.
 */
export interface ExecutionResult {
  success: boolean;
  runId: string;
  status: 'completed' | 'failed' | 'claim_lost';
  failureCode?: CoachingFailureCode;
  diagnostic?: string;
  usage?: Partial<CoachUsageMetadata>;
}

/**
 * Aggregated usage from multiple attempts.
 */
interface AggregatedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost: number;
}

// ─── Execution ──────────────────────────────────────────────────────────

/**
 * Execute a coaching run.
 *
 * This is the main entry point for run execution. It handles:
 * 1. Contract resolution
 * 2. Context building
 * 3. Provider invocation with heartbeat
 * 4. Output validation and repair
 * 5. Atomic result persistence
 *
 * @param run - The claimed coaching run
 * @param workerId - Worker that owns this run
 * @returns Execution result
 */
export async function executeCoachRun(
  run: CoachingRun,
  workerId: string,
): Promise<ExecutionResult> {
  const aggregatedUsage: AggregatedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    latencyMs: 0,
    estimatedCost: 0,
  };

  let heartbeatInterval: NodeJS.Timeout | null = null;
  let heartbeatActive = true;

  try {
    // Start heartbeat
    heartbeatInterval = setInterval(async () => {
      if (heartbeatActive) {
        await updateHeartbeat(run.id, workerId).catch(err => {
          console.warn(`[Coach] Heartbeat failed for run ${run.id}:`, err.message);
        });
      }
    }, COACH_HEARTBEAT_INTERVAL_MS);

    // 1. Get contract
    const contract = getActiveContract(run.artifact_type);
    if (!contract) {
      return await failRun(run.id, workerId, 'CONTEXT_BUILD_FAILED', `No contract for artifact type: ${run.artifact_type}`);
    }

    // 2. Resolve context
    let context;
    try {
      context = await resolveContext(
        run.artifact_id,
        run.content_version,
        run.review_scope,
        run.selected_section_key,
        contract,
      );
    } catch (err) {
      if (err instanceof ContextResolutionError) {
        return await failRun(run.id, workerId, 'CONTEXT_BUILD_FAILED', err.message);
      }
      throw err;
    }

    // 3. Build prompts
    const systemPrompt = contract.getSystemPrompt(run.review_scope, run.selected_section_key);
    let userPrompt = contract.getUserPromptTemplate(run.review_scope, run.selected_section_key);
    userPrompt = userPrompt
      .replace('{{artifact_context}}', context.artifactContext)
      .replace('{{ref_handles}}', context.refHandlesText)
      .replace('{{section_content}}', context.sectionContent || '');

    // 4. Create provider
    const provider = createAnthropicProvider({ tier: contract.modelConfig.tier });

    // 5. Generate with repair loop
    const maxAttempts = 1 + contract.maxRepairAttempts;
    let generationResult: CoachGenerationResult | null = null;
    let validatedOutput: ValidatedCoachOutput | null = null;
    let lastValidationErrors: string[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check claim ownership before each attempt
      const stillOwns = await validateClaimOwnership(run.id, workerId);
      if (!stillOwns) {
        heartbeatActive = false;
        return {
          success: false,
          runId: run.id,
          status: 'claim_lost',
          diagnostic: 'Claim lost during execution',
        };
      }

      // Build idempotency key
      const idempotencyKey = provider.supportsIdempotency()
        ? `coach:${run.id}:attempt:${run.attempt_count}:gen:${attempt}`
        : undefined;

      // Generate
      const currentPrompt = attempt === 0
        ? userPrompt
        : `${contract.getRepairPrompt(lastValidationErrors)}\n\n---\n\nOriginal request:\n\n${userPrompt}`;

      generationResult = await provider.generateReview({
        systemPrompt,
        userPrompt: currentPrompt,
        model: contract.modelConfig.tier,
        temperature: contract.modelConfig.temperature,
        maxTokens: contract.modelConfig.maxOutputTokens,
        timeoutMs: contract.modelConfig.timeoutMs,
        idempotencyKey,
      });

      // Aggregate usage
      if (generationResult.success) {
        aggregatedUsage.inputTokens += generationResult.usage.inputTokens;
        aggregatedUsage.outputTokens += generationResult.usage.outputTokens;
        aggregatedUsage.totalTokens += generationResult.usage.totalTokens;
        aggregatedUsage.latencyMs += generationResult.usage.latencyMs;
        aggregatedUsage.estimatedCost += generationResult.usage.estimatedCost ?? 0;
      } else if (generationResult.usage) {
        aggregatedUsage.latencyMs += generationResult.usage.latencyMs ?? 0;
      }

      // Check for provider failure
      if (!generationResult.success) {
        // Record partial usage
        await recordUsage(run.id, {
          inputTokens: aggregatedUsage.inputTokens,
          outputTokens: aggregatedUsage.outputTokens,
          totalTokens: aggregatedUsage.totalTokens,
          latencyMs: aggregatedUsage.latencyMs,
          estimatedCost: aggregatedUsage.estimatedCost,
        });

        return await failRun(
          run.id,
          workerId,
          generationResult.failureCode,
          generationResult.diagnostic,
        );
      }

      // Validate output
      const validation = validateCoachOutput(
        generationResult.content,
        contract.outputSchema,
        context.citationHandles,
        run.review_scope,
        run.selected_section_key,
      );

      if (validation.valid && validation.output) {
        validatedOutput = validation.output;
        break;
      }

      lastValidationErrors = validation.errors;
      console.warn(`[Coach] Validation failed for run ${run.id}, attempt ${attempt + 1}:`, validation.errors);
    }

    // 6. Check if we have valid output
    if (!validatedOutput) {
      await recordUsage(run.id, {
        inputTokens: aggregatedUsage.inputTokens,
        outputTokens: aggregatedUsage.outputTokens,
        totalTokens: aggregatedUsage.totalTokens,
        latencyMs: aggregatedUsage.latencyMs,
        estimatedCost: aggregatedUsage.estimatedCost,
      });

      return await failRun(
        run.id,
        workerId,
        'OUTPUT_VALIDATION_FAILED',
        `Validation failed after ${maxAttempts} attempts: ${formatValidationErrors(lastValidationErrors)}`,
      );
    }

    // 7. Persist results atomically
    const persistResult = await persistResults(
      run.id,
      workerId,
      validatedOutput,
      context.citationHandles,
      context.manifestEntries,
      aggregatedUsage,
    );

    if (!persistResult.success) {
      return {
        success: false,
        runId: run.id,
        status: 'claim_lost',
        diagnostic: 'Claim lost during result persistence',
        usage: aggregatedUsage,
      };
    }

    return {
      success: true,
      runId: run.id,
      status: 'completed',
      usage: aggregatedUsage,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Coach] Unexpected error executing run ${run.id}:`, message);

    // Try to fail the run
    try {
      return await failRun(run.id, workerId, 'GENERATION_FAILED', message.substring(0, 200));
    } catch {
      // If we can't even fail the run, just return
      return {
        success: false,
        runId: run.id,
        status: 'failed',
        failureCode: 'GENERATION_FAILED',
        diagnostic: message.substring(0, 200),
      };
    }
  } finally {
    // Stop heartbeat
    heartbeatActive = false;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  }
}

/**
 * Persist validated results atomically.
 */
async function persistResults(
  runId: string,
  workerId: string,
  output: ValidatedCoachOutput,
  citationHandles: Map<string, CitationHandle>,
  manifestEntries: Array<{
    object_type: string;
    object_id: string;
    object_version: number | null;
    section_key: string | null;
    context_role: 'primary' | 'supporting';
    position: number;
  }>,
  usage: AggregatedUsage,
): Promise<{ success: boolean }> {
  const transaction = await sequelize.transaction();

  try {
    // Verify claim ownership inside transaction
    const stillOwns = await validateClaimOwnership(runId, workerId);
    if (!stillOwns) {
      await transaction.rollback();
      return { success: false };
    }

    // Persist context manifest
    await recordCoachRunContext(runId, manifestEntries, transaction);

    // Persist items and references
    const categories: Array<{
      key: keyof ValidatedCoachOutput;
      category: 'strength' | 'issue' | 'suggestion' | 'question';
    }> = [
      { key: 'strengths', category: 'strength' },
      { key: 'issues', category: 'issue' },
      { key: 'suggestions', category: 'suggestion' },
      { key: 'questions', category: 'question' },
    ];

    for (const { key, category } of categories) {
      const items = output[key];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Create item
        const itemInput: RecordCoachingItemInput = {
          category,
          position: i + 1,
          text: item.text,
        };

        const [createdItem] = await recordCoachRunItems(runId, [itemInput], transaction);

        // Create references
        if (item.references.length > 0) {
          const refInputs: RecordCoachingReferenceInput[] = item.references
            .map(handle => citationHandles.get(handle))
            .filter((h): h is CitationHandle => h !== undefined)
            .map(h => ({
              object_type: h.objectType,
              object_id: h.objectId,
              section_key: h.sectionKey,
              label: h.label,
            }));

          if (refInputs.length > 0) {
            await recordCoachRunReferences(createdItem.id, refInputs, transaction);
          }
        }
      }
    }

    // Record usage
    await sequelize.query(
      `
      UPDATE coaching_runs
      SET
        input_tokens = :inputTokens,
        output_tokens = :outputTokens,
        total_tokens = :totalTokens,
        latency_ms = :latencyMs,
        estimated_cost = :estimatedCost
      WHERE id = :runId
      `,
      {
        replacements: {
          runId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          latencyMs: usage.latencyMs,
          estimatedCost: usage.estimatedCost,
        },
        transaction,
      }
    );

    // Mark completed (with ownership check)
    const completed = await markCompletedInTransaction(runId, workerId, transaction);
    if (!completed) {
      await transaction.rollback();
      return { success: false };
    }

    await transaction.commit();
    return { success: true };

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Mark completed within a transaction.
 */
async function markCompletedInTransaction(
  runId: string,
  workerId: string,
  transaction: Transaction,
): Promise<boolean> {
  const [, affectedCount] = await sequelize.query(
    `
    UPDATE coaching_runs
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE id = :runId
      AND status = 'running'
      AND worker_id = :workerId
    `,
    {
      replacements: { runId, workerId },
      transaction,
    }
  ) as [unknown, number];

  return affectedCount > 0;
}

/**
 * Fail a run with ownership check.
 */
async function failRun(
  runId: string,
  workerId: string,
  failureCode: CoachingFailureCode,
  diagnostic: string,
): Promise<ExecutionResult> {
  const failed = await markFailed(runId, workerId, failureCode, diagnostic.substring(0, 1000));

  if (!failed) {
    return {
      success: false,
      runId,
      status: 'claim_lost',
      diagnostic: 'Claim lost while trying to mark failed',
    };
  }

  return {
    success: false,
    runId,
    status: 'failed',
    failureCode,
    diagnostic,
  };
}
