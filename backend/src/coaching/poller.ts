/**
 * Coach Poller — Coach M2
 *
 * In-process polling service for Coach run execution.
 * Starts with backend, stops on graceful shutdown.
 *
 * Design:
 * - Single poller per backend instance
 * - SKIP LOCKED ensures concurrent instances don't conflict
 * - No in-memory queue — Postgres is the source of truth
 * - Graceful shutdown allows current work to stop cleanly
 *
 * Poll cycle:
 * 1. Recover stale runs (priority)
 * 2. Claim pending runs
 * 3. Execute claimed run
 * 4. Wait for poll interval
 */

import type { CoachingRun } from '../database/models/coaching_run';
import {
  claimNextPendingRun,
  recoverStaleRun,
} from './claim-service';
import { executeCoachRun } from './execution-orchestrator';
import {
  COACH_POLL_INTERVAL_MS,
  COACH_POLLER_ENABLED,
  generateWorkerId,
} from './config';

// ─── State ──────────────────────────────────────────────────────────────

let isRunning = false;
let isShuttingDown = false;
let pollTimeout: NodeJS.Timeout | null = null;
let currentWorkerId: string | null = null;
let currentRunId: string | null = null;

// ─── Lifecycle ──────────────────────────────────────────────────────────

/**
 * Start the Coach poller.
 *
 * Should be called during backend startup.
 * Does nothing if COACH_POLLER_ENABLED is false (e.g., in tests).
 */
export function startCoachPoller(): void {
  if (!COACH_POLLER_ENABLED) {
    console.log('[Coach Poller] Disabled by configuration');
    return;
  }

  if (isRunning) {
    console.warn('[Coach Poller] Already running');
    return;
  }

  currentWorkerId = generateWorkerId();
  isRunning = true;
  isShuttingDown = false;

  console.log(`[Coach Poller] Starting with worker ID: ${currentWorkerId}`);

  // Start polling
  schedulePoll();
}

/**
 * Stop the Coach poller gracefully.
 *
 * Stops accepting new work. Current execution may continue briefly.
 * Called during backend shutdown.
 */
export function stopCoachPoller(): void {
  if (!isRunning) {
    return;
  }

  console.log('[Coach Poller] Stopping...');
  isShuttingDown = true;

  // Cancel pending poll
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }

  // Note: We don't forcibly abort current execution.
  // The heartbeat will stop and stale recovery will handle it if needed.

  isRunning = false;
  console.log('[Coach Poller] Stopped');
}

/**
 * Check if poller is currently running.
 */
export function isPollerRunning(): boolean {
  return isRunning && !isShuttingDown;
}

/**
 * Get the current worker ID (for testing/debugging).
 */
export function getCurrentWorkerId(): string | null {
  return currentWorkerId;
}

/**
 * Get the currently processing run ID (for testing/debugging).
 */
export function getCurrentRunId(): string | null {
  return currentRunId;
}

// ─── Polling ────────────────────────────────────────────────────────────

/**
 * Schedule the next poll cycle.
 */
function schedulePoll(): void {
  if (isShuttingDown) {
    return;
  }

  pollTimeout = setTimeout(async () => {
    if (isShuttingDown) {
      return;
    }

    try {
      await pollCycle();
    } catch (err) {
      console.error('[Coach Poller] Poll cycle error:', err instanceof Error ? err.message : err);
    }

    // Schedule next poll
    schedulePoll();
  }, COACH_POLL_INTERVAL_MS);
}

/**
 * Execute a single poll cycle.
 */
async function pollCycle(): Promise<void> {
  if (!currentWorkerId) {
    return;
  }

  // Priority 1: Recover stale runs
  const staleResult = await recoverStaleRun(currentWorkerId);
  if (staleResult.claimed && staleResult.run) {
    console.log(`[Coach Poller] Recovered stale run: ${staleResult.run.id}`);
    await processRun(staleResult.run);
    return;
  }

  // Priority 2: Claim pending runs
  const pendingResult = await claimNextPendingRun(currentWorkerId);
  if (pendingResult.claimed && pendingResult.run) {
    console.log(`[Coach Poller] Claimed pending run: ${pendingResult.run.id}`);
    await processRun(pendingResult.run);
    return;
  }

  // No work available
}

/**
 * Process a claimed run.
 */
async function processRun(run: CoachingRun): Promise<void> {
  if (isShuttingDown || !currentWorkerId) {
    console.log(`[Coach Poller] Shutting down, skipping run: ${run.id}`);
    return;
  }

  currentRunId = run.id;

  try {
    console.log(`[Coach Poller] Executing run: ${run.id}`);
    const result = await executeCoachRun(run, currentWorkerId);

    if (result.success) {
      console.log(`[Coach Poller] Run completed: ${run.id}`);
    } else if (result.status === 'claim_lost') {
      console.warn(`[Coach Poller] Claim lost for run: ${run.id}`);
    } else {
      console.warn(`[Coach Poller] Run failed: ${run.id}, code: ${result.failureCode}`);
    }
  } catch (err) {
    console.error(`[Coach Poller] Unexpected error processing run ${run.id}:`, err);
  } finally {
    currentRunId = null;
  }
}

// ─── Exports for Testing ────────────────────────────────────────────────

/**
 * Manually trigger a poll cycle (for testing).
 */
export async function triggerPollCycle(): Promise<void> {
  if (!currentWorkerId) {
    currentWorkerId = generateWorkerId();
  }
  await pollCycle();
}

/**
 * Reset poller state (for testing).
 */
export function resetPollerState(): void {
  isRunning = false;
  isShuttingDown = false;
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  currentWorkerId = null;
  currentRunId = null;
}
