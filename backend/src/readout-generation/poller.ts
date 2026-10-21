/**
 * Readout Generation Poller — DR-6b-5b
 *
 * Background worker for Desk Research Readout AI generation.
 * Pattern follows Discovery poller (DISC-2) for consistency.
 *
 * Lifecycle:
 * 1. Poll for pending generation jobs
 * 2. Claim atomically via FOR UPDATE SKIP LOCKED
 * 3. Execute generation with heartbeat
 * 4. Complete or fail via fencing
 * 5. Loop
 *
 * Key constraints:
 * - Never call completeJob() — always use completeGenerationWithFencing()
 * - No model calls inside database transactions
 * - Bounded retries via attempt_count
 * - Graceful shutdown releases claims
 * - Single concurrent AI request per poller instance
 */

import { randomUUID } from 'crypto';
import * as claimService from '../services/readout-generation-claim.service';
import { executeGeneration, type ExecutionResult } from '../services/readout-generation-executor.service';
import { failJob, releaseForRetry, getAttemptCount } from '../services/readout-generation-claim.service';

// ─── Configuration ─────────────────────────────────────────────────

const POLL_INTERVAL_MS = parseInt(
  process.env.READOUT_GEN_POLL_INTERVAL_MS || '3000',
  10,
);

const HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.READOUT_GEN_HEARTBEAT_INTERVAL_MS || '15000',
  10,
);

const POLLER_ENABLED = process.env.READOUT_GEN_POLLER_ENABLED !== 'false' &&
  process.env.NODE_ENV !== 'test';

// ─── State ─────────────────────────────────────────────────────────

let isRunning = false;
let isShuttingDown = false;
let pollTimeout: NodeJS.Timeout | null = null;
let currentWorkerId: string | null = null;
let currentVersionId: number | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ─── Lifecycle ─────────────────────────────────────────────────────

/**
 * Start the Readout Generation poller.
 */
export function startReadoutGenerationPoller(): void {
  if (!POLLER_ENABLED) {
    console.log('[DR-6b-5b] Readout generation poller disabled (NODE_ENV=test or READOUT_GEN_POLLER_ENABLED=false)');
    return;
  }

  if (isRunning) {
    console.warn('[DR-6b-5b] Readout generation poller already running');
    return;
  }

  currentWorkerId = `readout-gen-${randomUUID()}`;
  isRunning = true;
  isShuttingDown = false;

  console.log(`[DR-6b-5b] Readout generation poller started (workerId=${currentWorkerId})`);
  console.log(`[DR-6b-5b] Poll interval: ${POLL_INTERVAL_MS}ms, Heartbeat: ${HEARTBEAT_INTERVAL_MS}ms`);

  // Start poll loop
  schedulePoll();
}

/**
 * Stop the Readout Generation poller gracefully.
 *
 * Releases current claim if any, allowing another worker to pick it up.
 */
export async function stopReadoutGenerationPoller(): Promise<void> {
  if (!isRunning) {
    return;
  }

  console.log('[DR-6b-5b] Readout generation poller shutting down...');
  isShuttingDown = true;

  // Clear poll timeout
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }

  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Release current claim if any
  if (currentVersionId && currentWorkerId) {
    try {
      const released = await claimService.releaseClaim(currentVersionId, currentWorkerId);
      if (released) {
        console.log(`[DR-6b-5b] Released claim on version ${currentVersionId}`);
      }
    } catch (error) {
      console.error('[DR-6b-5b] Error releasing claim during shutdown:', error);
    }
  }

  currentVersionId = null;
  isRunning = false;
  console.log('[DR-6b-5b] Readout generation poller stopped');
}

// ─── Poll Loop ─────────────────────────────────────────────────────

function schedulePoll(): void {
  if (isShuttingDown || !isRunning) {
    return;
  }

  pollTimeout = setTimeout(pollCycle, POLL_INTERVAL_MS);
}

async function pollCycle(): Promise<void> {
  if (isShuttingDown || !isRunning || !currentWorkerId) {
    return;
  }

  try {
    // Priority 1: Fail jobs that exceeded max attempts
    await claimService.failExceededAttemptJobs(currentWorkerId);

    // Priority 2: Recover stale jobs
    const staleVersion = await claimService.recoverStaleJob(currentWorkerId);
    if (staleVersion) {
      console.log(`[DR-6b-5b] Recovered stale version ${staleVersion.id} (attempt ${staleVersion.attempt_count})`);
      await executeClaimedVersion(staleVersion.id);
      schedulePoll();
      return;
    }

    // Priority 3: Claim pending job
    const pendingVersion = await claimService.claimNextPendingJob(currentWorkerId);
    if (pendingVersion) {
      console.log(`[DR-6b-5b] Claimed pending version ${pendingVersion.id}`);
      await executeClaimedVersion(pendingVersion.id);
      schedulePoll();
      return;
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DR-6b-5b] Poll cycle error:', message);
  }

  // Schedule next poll
  schedulePoll();
}

async function executeClaimedVersion(versionId: number): Promise<void> {
  if (!currentWorkerId || isShuttingDown) {
    return;
  }

  currentVersionId = versionId;

  // Start heartbeat
  heartbeatInterval = setInterval(async () => {
    if (currentVersionId && currentWorkerId) {
      try {
        await claimService.updateHeartbeat(currentVersionId, currentWorkerId);
      } catch (error) {
        console.warn(`[DR-6b-5b] Heartbeat failed for version ${currentVersionId}:`, error);
        // Don't stop execution — let the run continue
        // If we truly lost ownership, execution will detect it
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // Create heartbeat callback for executor
    const onHeartbeat = async () => {
      if (currentVersionId && currentWorkerId) {
        await claimService.updateHeartbeat(currentVersionId, currentWorkerId);
      }
    };

    const result: ExecutionResult = await executeGeneration(
      versionId,
      currentWorkerId,
      onHeartbeat,
    );

    if (result.success) {
      if (result.applied) {
        console.log(`[DR-6b-5b] Version ${versionId} completed and applied to draft`);
      } else if (result.conflictDetected) {
        console.log(`[DR-6b-5b] Version ${versionId} completed but draft was edited — content stored, not applied`);
      } else {
        console.log(`[DR-6b-5b] Version ${versionId} completed`);
      }
    } else {
      // Execution failed — record failure
      const failure = result.failure!;
      console.error(`[DR-6b-5b] Version ${versionId} failed: [${failure.code}] ${failure.message}`);

      if (failure.retryEligible) {
        // Transient error: release for retry with bounded backoff
        // Get current attempt count to determine if retry is still allowed
        const attemptCount = await getAttemptCount(versionId);

        if (attemptCount < claimService.READOUT_GEN_MAX_ATTEMPTS) {
          try {
            await releaseForRetry(versionId, currentWorkerId, failure.code, attemptCount);
          } catch (releaseError) {
            console.error(`[DR-6b-5b] Failed to release for retry version ${versionId}:`, releaseError);
            // Fall through to failJob as last resort
            try {
              await failJob(versionId, currentWorkerId, failure.code, failure.message);
            } catch (failError) {
              console.error(`[DR-6b-5b] Failed to record failure for version ${versionId}:`, failError);
            }
          }
        } else {
          // Max attempts reached — mark as terminal failure
          console.log(`[DR-6b-5b] Version ${versionId} exceeded max attempts (${attemptCount})`);
          try {
            await failJob(versionId, currentWorkerId, 'MAX_ATTEMPTS_EXCEEDED', failure.message);
          } catch (failError) {
            console.error(`[DR-6b-5b] Failed to record failure for version ${versionId}:`, failError);
          }
        }
      } else {
        // Permanent failure — mark as terminal
        try {
          await failJob(versionId, currentWorkerId, failure.code, failure.message);
        } catch (failError) {
          console.error(`[DR-6b-5b] Failed to record failure for version ${versionId}:`, failError);
        }
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[DR-6b-5b] Version ${versionId} execution error:`, message);

    // Attempt to record failure
    try {
      await failJob(versionId, currentWorkerId, 'EXECUTION_ERROR', message);
    } catch (failError) {
      console.error(`[DR-6b-5b] Failed to record failure for version ${versionId}:`, failError);
    }
  }

  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  currentVersionId = null;
}

// ─── Status ────────────────────────────────────────────────────────

export function getPollerStatus(): {
  running: boolean;
  shuttingDown: boolean;
  workerId: string | null;
  currentVersionId: number | null;
} {
  return {
    running: isRunning,
    shuttingDown: isShuttingDown,
    workerId: currentWorkerId,
    currentVersionId,
  };
}

/**
 * Check if the poller is healthy.
 */
export async function isPollerHealthy(): Promise<boolean> {
  if (!POLLER_ENABLED) {
    return true; // Disabled is healthy
  }

  return isRunning && !isShuttingDown;
}

/**
 * Get poller configuration for diagnostics.
 */
export function getPollerConfig(): {
  enabled: boolean;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  staleTimeoutMs: number;
  maxAttempts: number;
} {
  return {
    enabled: POLLER_ENABLED,
    pollIntervalMs: POLL_INTERVAL_MS,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    staleTimeoutMs: claimService.READOUT_GEN_STALE_TIMEOUT_MS,
    maxAttempts: claimService.READOUT_GEN_MAX_ATTEMPTS,
  };
}
