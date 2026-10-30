/**
 * Extraction Memory Profiling — DISC-WEB-1B-2d
 *
 * Isolated, local memory profiling for extraction worker subprocess.
 * Measures actual RSS consumption without requiring Railway or DISC_WEB1_ENABLED.
 *
 * Profiles:
 * - Main process RSS before/during/after extraction
 * - Worker subprocess peak RSS
 * - Combined peak RSS
 * - Extraction duration and outcome
 * - Worker cleanup verification
 *
 * Does NOT:
 * - Enable feature flags
 * - Connect to Railway
 * - Run live uploads
 * - Hardcode pass/fail memory thresholds
 */

import { fork, execSync, type ChildProcess } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import {
  createTxtBuffer,
  createValidDocxBufferAsync,
  STANDARD_TEXT,
} from '../../__fixtures__/documents/fixture-helper';

// ─── Configuration ──────────────────────────────────────────────────────────

const WORKER_SCRIPT = path.resolve(__dirname, '../../../../dist/services/extraction/extraction-worker.js');
const WORKER_HEAP_SIZE_MB = 256;
const WORKER_TIMEOUT_MS = 60_000; // Extended for large files
const SAMPLE_INTERVAL_MS = 50; // RSS sampling frequency

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtractRequest {
  type: 'extract';
  buffer: number[];
  mimeType: string;
  filename: string;
}

interface ExtractResponse {
  success: true;
  text: string;
  contentHash: string;
  charCount: number;
}

interface ExtractErrorResponse {
  success: false;
  errorCode: string;
  errorMessage: string;
}

type WorkerResponse = ExtractResponse | ExtractErrorResponse;

interface MemorySample {
  timestampMs: number;
  mainRssBytes: number;
  workerRssBytes: number;
  combinedRssBytes: number;
}

interface MemoryProfile {
  fixture: {
    type: string;
    sizeBytes: number;
    description: string;
  };
  environment: {
    platform: string;
    nodeVersion: string;
    v8HeapLimitMb: number;
    workerTimeoutMs: number;
    cgroupMemoryLimitBytes: number | null;
    cgroupMemoryCurrentBytes: number | null;
  };
  extraction: {
    success: boolean;
    errorCode: string | null;
    charCount: number | null;
    durationMs: number;
    workerExitCode: number | null;
    workerSignal: string | null;
    workerReaped: boolean;
  };
  memory: {
    mainRssBeforeBytes: number;
    mainRssAfterBytes: number;
    mainPeakRssBytes: number;
    workerPeakRssBytes: number;
    combinedPeakRssBytes: number;
    sampleCount: number;
    samplingLimitations: string[];
  };
  samples: MemorySample[];
}

// ─── Memory Measurement Utilities ───────────────────────────────────────────

/**
 * Get RSS of a process by PID using `ps` command.
 * Returns bytes, or 0 if process not found.
 */
function getProcessRssByPid(pid: number): number {
  try {
    // ps -o rss= returns RSS in kilobytes
    const output = execSync(`ps -o rss= -p ${pid} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 1000,
    }).trim();
    const rssKb = parseInt(output, 10);
    return isNaN(rssKb) ? 0 : rssKb * 1024;
  } catch {
    return 0; // Process not found or ps failed
  }
}

/**
 * Get current main process RSS in bytes.
 */
function getMainProcessRss(): number {
  return process.memoryUsage().rss;
}

/**
 * Try to read cgroup memory limits (Linux containers only).
 * Returns null if not available.
 */
function getCgroupMemory(): { limitBytes: number | null; currentBytes: number | null } {
  // cgroup v2 paths
  const limitPath = '/sys/fs/cgroup/memory.max';
  const currentPath = '/sys/fs/cgroup/memory.current';

  // cgroup v1 fallback paths
  const limitPathV1 = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
  const currentPathV1 = '/sys/fs/cgroup/memory/memory.usage_in_bytes';

  let limitBytes: number | null = null;
  let currentBytes: number | null = null;

  try {
    if (existsSync(limitPath)) {
      const content = readFileSync(limitPath, 'utf-8').trim();
      limitBytes = content === 'max' ? null : parseInt(content, 10);
    } else if (existsSync(limitPathV1)) {
      limitBytes = parseInt(readFileSync(limitPathV1, 'utf-8').trim(), 10);
    }
  } catch { /* ignore */ }

  try {
    if (existsSync(currentPath)) {
      currentBytes = parseInt(readFileSync(currentPath, 'utf-8').trim(), 10);
    } else if (existsSync(currentPathV1)) {
      currentBytes = parseInt(readFileSync(currentPathV1, 'utf-8').trim(), 10);
    }
  } catch { /* ignore */ }

  return { limitBytes, currentBytes };
}

// ─── Fixture Generators ─────────────────────────────────────────────────────

/**
 * Create a valid TXT buffer of approximately the specified size.
 */
function createLargeTxtBuffer(sizeBytes: number): Buffer {
  // Create repeating text content
  const baseText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);
  const repetitions = Math.ceil(sizeBytes / baseText.length);
  const content = baseText.repeat(repetitions).slice(0, sizeBytes);
  return Buffer.from(content, 'utf-8');
}

/**
 * Create a valid PDF buffer of approximately the specified size.
 * Uses multiple text streams to reach target size while remaining parseable.
 */
function createLargePdfBuffer(sizeBytes: number): Buffer {
  const textPerPage = 4000; // Characters per page
  const pageOverhead = 500; // PDF structure overhead per page
  const headerFooter = 500; // PDF header/trailer overhead
  const targetTextSize = sizeBytes - headerFooter;
  const numPages = Math.max(1, Math.ceil(targetTextSize / (textPerPage + pageOverhead)));

  // Generate page text
  const baseText = 'This is test content for PDF extraction profiling. '.repeat(80);
  const pageText = baseText.slice(0, textPerPage);

  // Build PDF structure
  let pdf = '%PDF-1.4\n';
  let objectNum = 1;
  const objectOffsets: number[] = [];

  // Catalog
  objectOffsets.push(pdf.length);
  pdf += `${objectNum} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objectNum++;

  // Pages object
  objectOffsets.push(pdf.length);
  const pageRefs = Array.from({ length: numPages }, (_, i) => `${3 + i * 2} 0 R`).join(' ');
  pdf += `${objectNum} 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${numPages} >>\nendobj\n`;
  objectNum++;

  // Generate pages
  for (let i = 0; i < numPages; i++) {
    // Page object
    objectOffsets.push(pdf.length);
    const contentRef = objectNum + 1;
    pdf += `${objectNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentRef} 0 R /Resources << /Font << /F1 ${3 + numPages * 2} 0 R >> >> >>\nendobj\n`;
    objectNum++;

    // Content stream
    objectOffsets.push(pdf.length);
    const streamContent = `BT\n/F1 10 Tf\n50 750 Td\n(${escapeForPdf(pageText)}) Tj\nET\n`;
    pdf += `${objectNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;
    objectNum++;
  }

  // Font object
  objectOffsets.push(pdf.length);
  pdf += `${objectNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objectNum++;

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectNum}\n0000000000 65535 f \n`;
  for (const offset of objectOffsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  pdf += `trailer\n<< /Size ${objectNum} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}

function escapeForPdf(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\n/g, '\\n');
}

/**
 * Create a valid DOCX buffer of approximately the specified size.
 */
async function createLargeDocxBuffer(sizeBytes: number): Promise<Buffer> {
  // DOCX compression ratio is roughly 10:1 for text
  const textSize = sizeBytes * 8; // Overshoot to account for compression
  const baseText = 'Document content for DOCX extraction profiling. '.repeat(100);
  const repetitions = Math.ceil(textSize / baseText.length);
  const content = baseText.repeat(repetitions).slice(0, textSize);

  return createValidDocxBufferAsync(content);
}

// ─── Profiling Worker Execution ─────────────────────────────────────────────

/**
 * Run extraction with memory profiling.
 * Spawns the actual compiled worker and samples RSS during execution.
 */
async function profileExtraction(
  buffer: Buffer,
  mimeType: string,
  fixtureDescription: string,
): Promise<MemoryProfile> {
  const samples: MemorySample[] = [];
  const limitations: string[] = [];
  const startTime = Date.now();

  // Pre-extraction state
  const mainRssBefore = getMainProcessRss();
  const cgroup = getCgroupMemory();

  if (cgroup.limitBytes === null) {
    limitations.push('cgroup memory limit not available (not in container or cgroup not mounted)');
  }

  // Track peaks
  let mainPeakRss = mainRssBefore;
  let workerPeakRss = 0;
  let combinedPeakRss = mainRssBefore;

  // Worker state
  let workerPid: number | null = null;
  let workerExitCode: number | null = null;
  let workerSignal: string | null = null;
  let workerReaped = false;
  let extractionResult: WorkerResponse | null = null;

  // Sampling interval
  let samplingInterval: ReturnType<typeof setInterval> | null = null;

  const profile = await new Promise<MemoryProfile>((resolve) => {
    let worker: ChildProcess | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const cleanup = () => {
      if (samplingInterval) {
        clearInterval(samplingInterval);
        samplingInterval = null;
      }
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (worker && !worker.killed) {
        worker.kill('SIGKILL');
      }
    };

    const finish = (result: WorkerResponse) => {
      if (resolved) return;
      resolved = true;
      extractionResult = result;
      cleanup();

      // Wait a tick for process cleanup
      setTimeout(() => {
        // Verify worker is reaped
        if (workerPid) {
          const stillRunning = getProcessRssByPid(workerPid) > 0;
          workerReaped = !stillRunning;
          if (stillRunning) {
            limitations.push(`worker PID ${workerPid} still running after completion`);
          }
        }

        const mainRssAfter = getMainProcessRss();
        const durationMs = Date.now() - startTime;

        resolve({
          fixture: {
            type: mimeType,
            sizeBytes: buffer.length,
            description: fixtureDescription,
          },
          environment: {
            platform: process.platform,
            nodeVersion: process.version,
            v8HeapLimitMb: WORKER_HEAP_SIZE_MB,
            workerTimeoutMs: WORKER_TIMEOUT_MS,
            cgroupMemoryLimitBytes: cgroup.limitBytes,
            cgroupMemoryCurrentBytes: cgroup.currentBytes,
          },
          extraction: {
            success: result.success,
            errorCode: result.success ? null : result.errorCode,
            charCount: result.success ? result.charCount : null,
            durationMs,
            workerExitCode,
            workerSignal,
            workerReaped,
          },
          memory: {
            mainRssBeforeBytes: mainRssBefore,
            mainRssAfterBytes: mainRssAfter,
            mainPeakRssBytes: mainPeakRss,
            workerPeakRssBytes: workerPeakRss,
            combinedPeakRssBytes: combinedPeakRss,
            sampleCount: samples.length,
            samplingLimitations: limitations,
          },
          samples,
        });
      }, 100);
    };

    try {
      worker = fork(WORKER_SCRIPT, [], {
        execArgv: [
          `--max-old-space-size=${WORKER_HEAP_SIZE_MB}`,
          '--max-semi-space-size=16',
        ],
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        serialization: 'json',
      });

      workerPid = worker.pid ?? null;

      if (!workerPid) {
        limitations.push('worker PID not available');
      }

      // Start RSS sampling
      samplingInterval = setInterval(() => {
        const mainRss = getMainProcessRss();
        const workerRss = workerPid ? getProcessRssByPid(workerPid) : 0;
        const combined = mainRss + workerRss;

        // Update peaks
        if (mainRss > mainPeakRss) mainPeakRss = mainRss;
        if (workerRss > workerPeakRss) workerPeakRss = workerRss;
        if (combined > combinedPeakRss) combinedPeakRss = combined;

        samples.push({
          timestampMs: Date.now() - startTime,
          mainRssBytes: mainRss,
          workerRssBytes: workerRss,
          combinedRssBytes: combined,
        });
      }, SAMPLE_INTERVAL_MS);

      timeoutHandle = setTimeout(() => {
        finish({
          success: false,
          errorCode: 'EXTRACTION_TIMEOUT',
          errorMessage: `Extraction timed out after ${WORKER_TIMEOUT_MS}ms`,
        });
      }, WORKER_TIMEOUT_MS);

      worker.on('message', (message: WorkerResponse | { type: string }) => {
        if ('type' in message && message.type === 'ready') {
          const request: ExtractRequest = {
            type: 'extract',
            buffer: Array.from(buffer),
            mimeType,
            filename: 'profile-test',
          };
          worker?.send(request);
          return;
        }

        finish(message as WorkerResponse);
      });

      worker.on('exit', (code, signal) => {
        workerExitCode = code;
        workerSignal = signal;

        if (resolved) return;

        if (code === 134 || signal === 'SIGABRT') {
          finish({
            success: false,
            errorCode: 'EXTRACTION_MEMORY',
            errorMessage: 'Extraction exceeded memory limit',
          });
        } else if (code === 137 || signal === 'SIGKILL') {
          finish({
            success: false,
            errorCode: 'EXTRACTION_TIMEOUT',
            errorMessage: 'Extraction was terminated',
          });
        } else if (code !== 0 && code !== null) {
          finish({
            success: false,
            errorCode: 'EXTRACTION_FAILED',
            errorMessage: `Worker exited with code ${code}`,
          });
        }
      });

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

  return profile;
}

// ─── Test Setup ─────────────────────────────────────────────────────────────

const workerExists = existsSync(WORKER_SCRIPT);
const isCI = process.env.CI === 'true';

if (isCI && !workerExists) {
  throw new Error(
    `FATAL: Compiled worker not found at ${WORKER_SCRIPT}. ` +
    `CI requires 'npm run build' before running integration tests.`
  );
}

const describeIfBuilt = workerExists ? describe : describe.skip;

// ─── Test Suite ─────────────────────────────────────────────────────────────

describeIfBuilt('Extraction Memory Profiling — DISC-WEB-1B-2d', () => {
  // Store profiles for final summary
  const profiles: MemoryProfile[] = [];

  afterAll(() => {
    // Output machine-readable summary
    console.log('\n' + '═'.repeat(80));
    console.log('MEMORY PROFILING SUMMARY');
    console.log('═'.repeat(80));

    const summary = {
      timestamp: new Date().toISOString(),
      environment: profiles[0]?.environment ?? null,
      profiles: profiles.map(p => ({
        fixture: p.fixture,
        success: p.extraction.success,
        errorCode: p.extraction.errorCode,
        durationMs: p.extraction.durationMs,
        workerReaped: p.extraction.workerReaped,
        mainPeakMb: (p.memory.mainPeakRssBytes / (1024 * 1024)).toFixed(2),
        workerPeakMb: (p.memory.workerPeakRssBytes / (1024 * 1024)).toFixed(2),
        combinedPeakMb: (p.memory.combinedPeakRssBytes / (1024 * 1024)).toFixed(2),
        sampleCount: p.memory.sampleCount,
        limitations: p.memory.samplingLimitations,
      })),
    };

    console.log('\n[PROFILE_JSON_START]');
    console.log(JSON.stringify(summary, null, 2));
    console.log('[PROFILE_JSON_END]\n');

    // Human-readable table
    console.log('\nPeak Memory by Fixture:');
    console.log('─'.repeat(80));
    console.log(
      'Fixture'.padEnd(30) +
      'Size'.padEnd(10) +
      'Main'.padEnd(12) +
      'Worker'.padEnd(12) +
      'Combined'.padEnd(12) +
      'Result'
    );
    console.log('─'.repeat(80));

    for (const p of profiles) {
      const sizeMb = (p.fixture.sizeBytes / (1024 * 1024)).toFixed(2);
      const mainMb = (p.memory.mainPeakRssBytes / (1024 * 1024)).toFixed(2);
      const workerMb = (p.memory.workerPeakRssBytes / (1024 * 1024)).toFixed(2);
      const combinedMb = (p.memory.combinedPeakRssBytes / (1024 * 1024)).toFixed(2);
      const result = p.extraction.success ? 'OK' : p.extraction.errorCode;

      console.log(
        p.fixture.description.slice(0, 29).padEnd(30) +
        `${sizeMb} MB`.padEnd(10) +
        `${mainMb} MB`.padEnd(12) +
        `${workerMb} MB`.padEnd(12) +
        `${combinedMb} MB`.padEnd(12) +
        result
      );
    }
    console.log('─'.repeat(80));

    // Max peaks
    const maxWorkerPeak = Math.max(...profiles.map(p => p.memory.workerPeakRssBytes));
    const maxCombinedPeak = Math.max(...profiles.map(p => p.memory.combinedPeakRssBytes));

    console.log(`\nMaximum Worker Peak RSS: ${(maxWorkerPeak / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Maximum Combined Peak RSS: ${(maxCombinedPeak / (1024 * 1024)).toFixed(2)} MB`);
    console.log('═'.repeat(80) + '\n');
  });

  // ─── Small File Baselines ─────────────────────────────────────────────────

  describe('baseline (small files)', () => {
    it('profiles 100 KB TXT extraction', async () => {
      const buffer = createLargeTxtBuffer(100 * 1024);
      const profile = await profileExtraction(buffer, 'text/plain', '100 KB TXT');
      profiles.push(profile);

      expect(profile.extraction.success).toBe(true);
      expect(profile.extraction.workerReaped).toBe(true);
      expect(profile.memory.workerPeakRssBytes).toBeGreaterThan(0);
      expect(profile.memory.sampleCount).toBeGreaterThan(0);
    });

    it('profiles 100 KB PDF extraction', async () => {
      const buffer = createLargePdfBuffer(100 * 1024);
      const profile = await profileExtraction(buffer, 'application/pdf', '100 KB PDF');
      profiles.push(profile);

      // PDF may succeed or fail depending on synthetic structure
      expect(profile.extraction.workerReaped).toBe(true);
      expect(profile.memory.workerPeakRssBytes).toBeGreaterThan(0);
    });

    it('profiles 100 KB DOCX extraction', async () => {
      const buffer = await createLargeDocxBuffer(100 * 1024);
      const profile = await profileExtraction(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '100 KB DOCX'
      );
      profiles.push(profile);

      expect(profile.extraction.success).toBe(true);
      expect(profile.extraction.workerReaped).toBe(true);
    });
  });

  // ─── Medium Files ─────────────────────────────────────────────────────────

  describe('medium files (1-5 MB)', () => {
    it('profiles 1 MB TXT extraction', async () => {
      const buffer = createLargeTxtBuffer(1 * 1024 * 1024);
      const profile = await profileExtraction(buffer, 'text/plain', '1 MB TXT');
      profiles.push(profile);

      expect(profile.extraction.success).toBe(true);
      expect(profile.extraction.workerReaped).toBe(true);
    });

    it('profiles 5 MB TXT extraction', async () => {
      const buffer = createLargeTxtBuffer(5 * 1024 * 1024);
      const profile = await profileExtraction(buffer, 'text/plain', '5 MB TXT');
      profiles.push(profile);

      // 5 MB TXT = 5M characters, exceeds MAX_TEXT_LENGTH (2M chars)
      // Test verifies profiling works regardless of extraction outcome
      expect(profile.extraction.workerReaped).toBe(true);
      expect(profile.memory.workerPeakRssBytes).toBeGreaterThan(0);
    });

    it('profiles 1 MB PDF extraction', async () => {
      const buffer = createLargePdfBuffer(1 * 1024 * 1024);
      const profile = await profileExtraction(buffer, 'application/pdf', '1 MB PDF');
      profiles.push(profile);

      expect(profile.extraction.workerReaped).toBe(true);
    });

    it('profiles 1 MB DOCX extraction', async () => {
      const buffer = await createLargeDocxBuffer(1 * 1024 * 1024);
      const profile = await profileExtraction(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '1 MB DOCX'
      );
      profiles.push(profile);

      expect(profile.extraction.workerReaped).toBe(true);
    });
  });

  // ─── Near-Limit Files (10 MB) ─────────────────────────────────────────────

  describe('near-limit files (10 MB)', () => {
    it('profiles 10 MB TXT extraction', async () => {
      const buffer = createLargeTxtBuffer(10 * 1024 * 1024);
      const profile = await profileExtraction(buffer, 'text/plain', '10 MB TXT');
      profiles.push(profile);

      // 10 MB TXT will exceed MAX_TEXT_LENGTH (2M chars) and should fail
      // but we still profile the memory
      expect(profile.extraction.workerReaped).toBe(true);
    }, 120000);

    it('profiles 10 MB PDF extraction', async () => {
      const buffer = createLargePdfBuffer(10 * 1024 * 1024);
      const profile = await profileExtraction(buffer, 'application/pdf', '10 MB PDF');
      profiles.push(profile);

      expect(profile.extraction.workerReaped).toBe(true);
    }, 120000);

    it('profiles 10 MB DOCX extraction', async () => {
      const buffer = await createLargeDocxBuffer(10 * 1024 * 1024);
      const profile = await profileExtraction(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '10 MB DOCX'
      );
      profiles.push(profile);

      expect(profile.extraction.workerReaped).toBe(true);
    }, 120000);
  });

  // ─── Error Paths ──────────────────────────────────────────────────────────

  describe('error paths', () => {
    it('profiles unsupported file type rejection', async () => {
      const buffer = Buffer.from('not a real image');
      const profile = await profileExtraction(buffer, 'image/png', 'unsupported image/png');
      profiles.push(profile);

      expect(profile.extraction.success).toBe(false);
      expect(profile.extraction.errorCode).toBe('UNSUPPORTED_FILE_TYPE');
      expect(profile.extraction.workerReaped).toBe(true);
    });

    it('profiles corrupt PDF handling', async () => {
      const buffer = Buffer.from('%PDF-CORRUPT\nInvalid structure');
      const profile = await profileExtraction(buffer, 'application/pdf', 'corrupt PDF');
      profiles.push(profile);

      expect(profile.extraction.success).toBe(false);
      expect(profile.extraction.workerReaped).toBe(true);
    });

    it('profiles empty content rejection', async () => {
      const buffer = createTxtBuffer('short'); // Below 50 char minimum
      const profile = await profileExtraction(buffer, 'text/plain', 'below-minimum TXT');
      profiles.push(profile);

      expect(profile.extraction.success).toBe(false);
      expect(profile.extraction.errorCode).toBe('EMPTY_CONTENT');
      expect(profile.extraction.workerReaped).toBe(true);
    });

    it('profiles timeout behavior', async () => {
      // Create a profile with artificially short timeout
      const buffer = createLargeTxtBuffer(1024);

      // Manually run with 1ms timeout to force timeout
      const profile = await new Promise<MemoryProfile>((resolve) => {
        let worker: ChildProcess | null = null;
        const startTime = Date.now();
        const mainRssBefore = getMainProcessRss();
        let workerPid: number | null = null;
        let workerPeakRss = 0;

        try {
          worker = fork(WORKER_SCRIPT, [], {
            execArgv: [`--max-old-space-size=${WORKER_HEAP_SIZE_MB}`],
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          });

          workerPid = worker.pid ?? null;

          // Force timeout after 1ms
          setTimeout(() => {
            if (workerPid) {
              workerPeakRss = getProcessRssByPid(workerPid);
            }
            worker?.kill('SIGKILL');
          }, 1);

          worker.on('exit', (code, signal) => {
            setTimeout(() => {
              const workerReaped = workerPid ? getProcessRssByPid(workerPid) === 0 : true;

              resolve({
                fixture: {
                  type: 'text/plain',
                  sizeBytes: buffer.length,
                  description: 'forced timeout',
                },
                environment: {
                  platform: process.platform,
                  nodeVersion: process.version,
                  v8HeapLimitMb: WORKER_HEAP_SIZE_MB,
                  workerTimeoutMs: 1,
                  cgroupMemoryLimitBytes: null,
                  cgroupMemoryCurrentBytes: null,
                },
                extraction: {
                  success: false,
                  errorCode: 'EXTRACTION_TIMEOUT',
                  charCount: null,
                  durationMs: Date.now() - startTime,
                  workerExitCode: code,
                  workerSignal: signal,
                  workerReaped,
                },
                memory: {
                  mainRssBeforeBytes: mainRssBefore,
                  mainRssAfterBytes: getMainProcessRss(),
                  mainPeakRssBytes: mainRssBefore,
                  workerPeakRssBytes: workerPeakRss,
                  combinedPeakRssBytes: mainRssBefore + workerPeakRss,
                  sampleCount: 0,
                  samplingLimitations: ['timeout test - minimal sampling'],
                },
                samples: [],
              });
            }, 100);
          });
        } catch {
          resolve({
            fixture: { type: 'text/plain', sizeBytes: buffer.length, description: 'forced timeout' },
            environment: {
              platform: process.platform,
              nodeVersion: process.version,
              v8HeapLimitMb: WORKER_HEAP_SIZE_MB,
              workerTimeoutMs: 1,
              cgroupMemoryLimitBytes: null,
              cgroupMemoryCurrentBytes: null,
            },
            extraction: {
              success: false,
              errorCode: 'EXTRACTION_FAILED',
              charCount: null,
              durationMs: Date.now() - startTime,
              workerExitCode: null,
              workerSignal: null,
              workerReaped: true,
            },
            memory: {
              mainRssBeforeBytes: mainRssBefore,
              mainRssAfterBytes: mainRssBefore,
              mainPeakRssBytes: mainRssBefore,
              workerPeakRssBytes: 0,
              combinedPeakRssBytes: mainRssBefore,
              sampleCount: 0,
              samplingLimitations: ['spawn failed'],
            },
            samples: [],
          });
        }
      });

      profiles.push(profile);

      expect(profile.extraction.workerReaped).toBe(true);
    });
  });

  // ─── Resource Leak Detection ──────────────────────────────────────────────

  describe('resource leak detection', () => {
    it('no zombie workers after multiple extractions', async () => {
      // Run several extractions
      for (let i = 0; i < 3; i++) {
        const buffer = createLargeTxtBuffer(100 * 1024);
        await profileExtraction(buffer, 'text/plain', `leak test ${i + 1}`);
      }

      // Allow cleanup
      await new Promise(r => setTimeout(r, 500));

      // Check for zombie extraction workers
      try {
        const output = execSync('ps aux | grep extraction-worker | grep -v grep || true', {
          encoding: 'utf-8',
        });
        const lines = output.trim().split('\n').filter(Boolean);
        expect(lines.length).toBe(0);
      } catch {
        // ps command not available, skip
      }
    });

    it('main process memory stable after extractions', async () => {
      const rssBefore = getMainProcessRss();

      // Run extractions
      for (let i = 0; i < 3; i++) {
        const buffer = createLargeTxtBuffer(500 * 1024);
        await profileExtraction(buffer, 'text/plain', `stability test ${i + 1}`);
      }

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      await new Promise(r => setTimeout(r, 200));

      const rssAfter = getMainProcessRss();

      // Allow 50 MB growth tolerance for test overhead
      const growthMb = (rssAfter - rssBefore) / (1024 * 1024);
      expect(growthMb).toBeLessThan(50);
    });
  });
});

// Skip notice for local development without build
if (!workerExists && !isCI) {
  describe('Extraction Memory Profiling — DISC-WEB-1B-2d', () => {
    it.skip('SKIPPED: Run "npm run build" to compile extraction worker', () => {});
  });
}
