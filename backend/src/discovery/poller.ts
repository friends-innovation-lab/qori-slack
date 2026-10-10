/**
 * Discovery Poller — DISC-2
 *
 * Background worker for Discovery run execution.
 * Pattern matches Coach poller for consistency.
 *
 * Lifecycle:
 * 1. Poll for pending runs (desk_research, stakeholder_synthesis)
 * 2. Claim atomically via FOR UPDATE SKIP LOCKED
 * 3. Execute run
 * 4. Complete or fail
 * 5. Loop
 */

import { randomUUID } from 'crypto';
import * as claimService from '../services/discovery-claim.service';
import * as extractionRetryService from '../services/extraction-retry.service';
import { executeDiscoveryRun, PrivacyError } from '../application/discovery.app-service';

// ─── Configuration ─────────────────────────────────────────────────

const POLL_INTERVAL_MS = parseInt(
  process.env.DISCOVERY_POLL_INTERVAL_MS || '2000',
  10,
);

const HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.DISCOVERY_HEARTBEAT_INTERVAL_MS || '15000',
  10,
);

const POLLER_ENABLED = process.env.DISCOVERY_POLLER_ENABLED !== 'false' &&
  process.env.NODE_ENV !== 'test';

// ─── State ─────────────────────────────────────────────────────────

let isRunning = false;
let isShuttingDown = false;
let pollTimeout: NodeJS.Timeout | null = null;
let currentWorkerId: string | null = null;
let currentRunId: number | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ─── Lifecycle ─────────────────────────────────────────────────────

/**
 * Start the Discovery poller.
 */
export function startDiscoveryPoller(): void {
  if (!POLLER_ENABLED) {
    console.log('[DISC-2] Discovery poller disabled (NODE_ENV=test or DISCOVERY_POLLER_ENABLED=false)');
    return;
  }

  if (isRunning) {
    console.warn('[DISC-2] Discovery poller already running');
    return;
  }

  currentWorkerId = `discovery-${randomUUID()}`;
  isRunning = true;
  isShuttingDown = false;

  console.log(`[DISC-2] Discovery poller started (workerId=${currentWorkerId})`);
  console.log(`[DISC-2] Poll interval: ${POLL_INTERVAL_MS}ms, Heartbeat: ${HEARTBEAT_INTERVAL_MS}ms`);

  // Start poll loop
  schedulePoll();
}

/**
 * Stop the Discovery poller gracefully.
 */
export async function stopDiscoveryPoller(): Promise<void> {
  if (!isRunning) {
    return;
  }

  console.log('[DISC-2] Discovery poller shutting down...');
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
  if (currentRunId && currentWorkerId) {
    try {
      const released = await claimService.releaseClaim(currentRunId, currentWorkerId);
      if (released) {
        console.log(`[DISC-2] Released claim on run ${currentRunId}`);
      }
    } catch (error) {
      console.error('[DISC-2] Error releasing claim during shutdown:', error);
    }
  }

  currentRunId = null;
  isRunning = false;
  console.log('[DISC-2] Discovery poller stopped');
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
    // Priority 1: Recover stale runs and expired extraction claims
    await claimService.failExceededAttemptRuns(currentWorkerId);
    await extractionRetryService.recoverExpiredClaims();
    const staleRun = await claimService.recoverStaleRun(currentWorkerId);

    if (staleRun) {
      console.log(`[DISC-2] Recovered stale run ${staleRun.id} (attempt ${staleRun.attempt_count})`);
      await executeClaimedRun(staleRun.id);
      schedulePoll();
      return;
    }

    // Priority 2: Claim pending run
    const pendingRun = await claimService.claimNextPendingRun(currentWorkerId);

    if (pendingRun) {
      console.log(`[DISC-2] Claimed pending run ${pendingRun.id} (${pendingRun.discovery_type}: ${pendingRun.topic})`);
      await executeClaimedRun(pendingRun.id);
      schedulePoll();
      return;
    }

    // Priority 3: Retry failed/partial extractions
    const retryableArtifact = await extractionRetryService.claimNextRetryableArtifact(currentWorkerId);

    if (retryableArtifact) {
      console.log(`[DISC-2] Claimed extraction retry for artifact ${retryableArtifact.publicId} (attempt ${retryableArtifact.attemptCount + 1})`);
      const retryResult = await extractionRetryService.executeExtractionRetry(retryableArtifact, currentWorkerId);

      if (retryResult.success) {
        console.log(`[DISC-2] Extraction retry succeeded: ${retryResult.createdCount} insights created, ${retryResult.skippedCount} skipped`);
      } else {
        console.log(`[DISC-2] Extraction retry ${retryResult.status}: ${retryResult.error || 'unknown'}`);
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DISC-2] Poll cycle error:', message);
  }

  // Schedule next poll
  schedulePoll();
}

async function executeClaimedRun(runId: number): Promise<void> {
  if (!currentWorkerId || isShuttingDown) {
    return;
  }

  currentRunId = runId;

  // Start heartbeat
  heartbeatInterval = setInterval(async () => {
    if (currentRunId && currentWorkerId) {
      try {
        await claimService.updateHeartbeat(currentRunId, currentWorkerId);
      } catch (error) {
        console.warn(`[DISC-2] Heartbeat failed for run ${currentRunId}:`, error);
        // Don't stop execution - let the run continue
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const result = await executeDiscoveryRun(runId, currentWorkerId);
    console.log(`[DISC-2] Run ${runId} completed → artifact ${result.artifactPublicId}`);

  } catch (error) {
    if (error instanceof PrivacyError) {
      console.warn(`[DISC-2] Run ${runId} failed: Privacy violation`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DISC-2] Run ${runId} failed:`, message);
    }
    // Run is already marked as failed by executeDiscoveryRun
  }

  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  currentRunId = null;
}

// ─── Status ────────────────────────────────────────────────────────

export function getPollerStatus(): {
  running: boolean;
  shuttingDown: boolean;
  workerId: string | null;
  currentRunId: number | null;
} {
  return {
    running: isRunning,
    shuttingDown: isShuttingDown,
    workerId: currentWorkerId,
    currentRunId,
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
