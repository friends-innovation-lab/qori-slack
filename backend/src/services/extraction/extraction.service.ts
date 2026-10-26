/**
 * Extraction Service — DISC-WEB-1
 *
 * Orchestrates document extraction with subprocess isolation.
 *
 * Key guarantees:
 * - Memory isolation: Workers run with --max-old-space-size=256
 * - Hard timeout: Workers are SIGKILL'd after 30s
 * - Bounded concurrency: 1 concurrent by default, bounded queue (overload rejected)
 * - Streaming input: File bytes are streamed, not buffered in main process
 *
 * LIMITATION: Total process memory (RSS) cannot be bounded in Node without
 * external cgroup enforcement. Railway containers provide this via memory limits.
 * If Railway memory limit is not configured, large files could still cause OOM
 * at the container level. This is reported as a security limitation.
 *
 * NOTE: Railway memory limit configuration has NOT been verified for this feature.
 * Before production rollout, confirm Railway memory limits are set appropriately
 * for the extraction worker subprocess memory consumption.
 */

import { fork, type ChildProcess } from 'child_process';
import { createHash } from 'crypto';
import path from 'path';
import type {
  ExtractRequest,
  WorkerResponse,
  ExtractionErrorCode,
} from './extraction-worker';

// Worker configuration
const WORKER_SCRIPT = path.join(__dirname, 'extraction-worker.js');
const WORKER_TIMEOUT_MS = 30_000; // 30 seconds
const WORKER_HEAP_SIZE_MB = 256;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Conservative concurrency defaults for initial rollout
// Only 1 active worker at a time, bounded queue of 5
// These can be increased via environment variables after resource validation
const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_MAX_QUEUED = 5;
const MAX_CONCURRENT = parseInt(process.env.EXTRACTION_MAX_CONCURRENT ?? '', 10) || DEFAULT_MAX_CONCURRENT;
const MAX_QUEUED = parseInt(process.env.EXTRACTION_MAX_QUEUED ?? '', 10) || DEFAULT_MAX_QUEUED;

/**
 * Bounded semaphore with queue limit.
 * Rejects with overload error when queue is full.
 */
class BoundedSemaphore {
  private permits: number;
  private waiting: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private readonly maxQueued: number;

  constructor(permits: number, maxQueued: number) {
    this.permits = permits;
    this.maxQueued = maxQueued;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Check queue limit
    if (this.waiting.length >= this.maxQueued) {
      throw new ExtractionOverloadError(
        `Extraction service overloaded (${this.waiting.length} queued, max ${this.maxQueued})`,
      );
    }

    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject });
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next?.resolve();
    } else {
      this.permits++;
    }
  }

  get available(): number {
    return this.permits;
  }

  get queueLength(): number {
    return this.waiting.length;
  }
}

/**
 * Error thrown when extraction service is overloaded.
 */
export class ExtractionOverloadError extends Error {
  readonly code = 'EXTRACTION_OVERLOADED';

  constructor(message: string) {
    super(message);
    this.name = 'ExtractionOverloadError';
  }
}

// Global semaphore (1 concurrent by default, queue of 5)
const globalSemaphore = new BoundedSemaphore(MAX_CONCURRENT, MAX_QUEUED);

/**
 * Extraction result with computed hashes.
 */
export interface ExtractionResult {
  success: true;
  text: string;
  fileHash: string;
  contentHash: string;
  charCount: number;
}

export interface ExtractionError {
  success: false;
  errorCode: ExtractionErrorCode;
  errorMessage: string;
}

export type ExtractionOutcome = ExtractionResult | ExtractionError;

/**
 * Compute SHA-256 hash of file bytes.
 */
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Extract content from a file buffer with subprocess isolation.
 *
 * @param buffer - File bytes
 * @param mimeType - MIME type of the file
 * @param filename - Original filename (for error messages)
 * @param _projectId - Project ID (reserved for future per-project limits)
 * @returns Extraction result or error
 * @throws ExtractionOverloadError if queue is full
 */
export async function extractWithIsolation(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  _projectId: number,
): Promise<ExtractionOutcome> {
  // Pre-flight checks (before spawning worker)
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `File size ${buffer.length} exceeds maximum ${MAX_FILE_SIZE_BYTES} bytes`,
    };
  }

  // Compute file hash in main process (before sending to worker)
  const fileHash = computeFileHash(buffer);

  // Acquire global semaphore (bounded queue, throws ExtractionOverloadError if queue full)
  await globalSemaphore.acquire();

  try {
    return await runWorker(buffer, mimeType, filename, fileHash);
  } finally {
    globalSemaphore.release();
  }
}

/**
 * Spawn a worker process and run extraction.
 */
async function runWorker(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  fileHash: string,
): Promise<ExtractionOutcome> {
  return new Promise((resolve) => {
    let worker: ChildProcess | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (worker && !worker.killed) {
        worker.kill('SIGKILL');
      }
    };

    const finish = (result: ExtractionOutcome) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    try {
      // Spawn worker with memory limits
      worker = fork(WORKER_SCRIPT, [], {
        execArgv: [
          `--max-old-space-size=${WORKER_HEAP_SIZE_MB}`,
          '--max-semi-space-size=16',
        ],
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        serialization: 'json',
      });

      // Set hard timeout
      timeoutHandle = setTimeout(() => {
        finish({
          success: false,
          errorCode: 'EXTRACTION_TIMEOUT',
          errorMessage: `Extraction timed out after ${WORKER_TIMEOUT_MS}ms`,
        });
      }, WORKER_TIMEOUT_MS);

      // Handle worker messages
      worker.on('message', (message: WorkerResponse | { type: string }) => {
        if ('type' in message && message.type === 'ready') {
          // Worker is ready, send extraction request
          const request: ExtractRequest = {
            type: 'extract',
            buffer: Array.from(buffer), // Serialize for IPC
            mimeType,
            filename,
          };
          worker?.send(request);
          return;
        }

        // Handle extraction result
        const response = message as WorkerResponse;
        if (response.success) {
          finish({
            success: true,
            text: response.text,
            fileHash,
            contentHash: response.contentHash,
            charCount: response.charCount,
          });
        } else {
          finish({
            success: false,
            errorCode: response.errorCode,
            errorMessage: response.errorMessage,
          });
        }
      });

      // Handle worker exit
      worker.on('exit', (code, signal) => {
        if (resolved) return;

        if (code === 134 || signal === 'SIGABRT') {
          finish({
            success: false,
            errorCode: 'EXTRACTION_MEMORY',
            errorMessage: 'Extraction exceeded memory limit',
          });
        } else if (code === 137 || signal === 'SIGKILL') {
          // Already handled by timeout or explicit kill
          finish({
            success: false,
            errorCode: 'EXTRACTION_TIMEOUT',
            errorMessage: 'Extraction was terminated',
          });
        } else if (code !== 0) {
          finish({
            success: false,
            errorCode: 'EXTRACTION_FAILED',
            errorMessage: `Worker exited with code ${code}`,
          });
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        finish({
          success: false,
          errorCode: 'EXTRACTION_FAILED',
          errorMessage: `Worker error: ${error.message}`,
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finish({
        success: false,
        errorCode: 'EXTRACTION_FAILED',
        errorMessage: `Failed to spawn worker: ${message}`,
      });
    }
  });
}

/**
 * Get current concurrency status.
 */
export function getConcurrencyStatus(): {
  globalAvailable: number;
  globalMax: number;
  queueLength: number;
  maxQueued: number;
} {
  return {
    globalAvailable: globalSemaphore.available,
    globalMax: MAX_CONCURRENT,
    queueLength: globalSemaphore.queueLength,
    maxQueued: MAX_QUEUED,
  };
}

/**
 * Constants exported for testing and configuration.
 */
export const EXTRACTION_LIMITS = {
  MAX_FILE_SIZE_BYTES,
  MAX_CONCURRENT,
  MAX_QUEUED,
  WORKER_TIMEOUT_MS,
  WORKER_HEAP_SIZE_MB,
} as const;
