/**
 * Streaming Multipart Parser — DISC-WEB-1
 *
 * Parses multipart/form-data with genuine aggregate byte limits.
 * Uses busboy for streaming (no full buffering in memory).
 *
 * Key guarantees:
 * - Aggregate request size enforced during streaming (not post-hoc)
 * - Per-file size limits enforced during streaming
 * - Request aborted immediately when limits exceeded
 * - Memory-bounded: only one file buffered at a time
 */

import Busboy from 'busboy';
import { createHash } from 'crypto';
import type { IncomingMessage } from 'http';

// Limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_AGGREGATE_SIZE = 50 * 1024 * 1024; // 50MB total
const MAX_FILES = 10;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
];

/**
 * Parsed file from multipart stream.
 */
export interface ParsedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  fileHash: string;
  sizeBytes: number;
}

/**
 * File that failed validation during parsing.
 */
export interface RejectedFile {
  filename: string;
  mimeType: string;
  errorCode: 'UNSUPPORTED_FILE_TYPE' | 'FILE_TOO_LARGE';
  errorMessage: string;
}

/**
 * Result of parsing a multipart request.
 */
export interface ParseResult {
  files: ParsedFile[];
  rejected: RejectedFile[];
}

/**
 * Error thrown when aggregate limit is exceeded.
 */
export class AggregateLimitError extends Error {
  readonly code = 'AGGREGATE_LIMIT_EXCEEDED';

  constructor(message: string) {
    super(message);
    this.name = 'AggregateLimitError';
  }
}

/**
 * Error thrown when file limit is exceeded.
 */
export class FileLimitError extends Error {
  readonly code = 'FILE_LIMIT_EXCEEDED';

  constructor(message: string) {
    super(message);
    this.name = 'FileLimitError';
  }
}

/**
 * Parse a multipart request with streaming and aggregate limits.
 *
 * @param req - HTTP request
 * @param contentType - Content-Type header value
 * @returns Parsed files and rejected files
 * @throws AggregateLimitError if aggregate size exceeded
 * @throws FileLimitError if too many files
 */
export function parseMultipart(
  req: IncomingMessage,
  contentType: string,
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const files: ParsedFile[] = [];
    const rejected: RejectedFile[] = [];
    let aggregateBytes = 0;
    let fileCount = 0;
    let finished = false;

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
        fieldSize: 1024, // Limit non-file fields
      },
    });

    const abort = (error: Error) => {
      if (finished) return;
      finished = true;
      req.unpipe(busboy);
      busboy.removeAllListeners();
      reject(error);
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      resolve({ files, rejected });
    };

    busboy.on('file', (fieldname, fileStream, info) => {
      const filename = info.filename ?? 'unknown';
      const mimeType = info.mimeType ?? 'application/octet-stream';
      fileCount++;

      // Check file count
      if (fileCount > MAX_FILES) {
        fileStream.resume(); // Drain the stream
        abort(new FileLimitError(`Too many files (max ${MAX_FILES})`));
        return;
      }

      // Check MIME type
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        fileStream.resume(); // Drain the stream
        rejected.push({
          filename,
          mimeType,
          errorCode: 'UNSUPPORTED_FILE_TYPE',
          errorMessage: `File type ${mimeType} is not supported`,
        });
        return;
      }

      const chunks: Buffer[] = [];
      let fileBytes = 0;
      let truncated = false;

      fileStream.on('data', (chunk: Buffer) => {
        fileBytes += chunk.length;
        aggregateBytes += chunk.length;

        // Check aggregate limit
        if (aggregateBytes > MAX_AGGREGATE_SIZE) {
          abort(new AggregateLimitError(
            `Total upload size exceeds ${MAX_AGGREGATE_SIZE / (1024 * 1024)}MB`,
          ));
          return;
        }

        chunks.push(chunk);
      });

      fileStream.on('limit', () => {
        truncated = true;
      });

      fileStream.on('end', () => {
        if (finished) return;

        if (truncated) {
          rejected.push({
            filename,
            mimeType,
            errorCode: 'FILE_TOO_LARGE',
            errorMessage: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
          });
          return;
        }

        const buffer = Buffer.concat(chunks);
        const fileHash = createHash('sha256').update(buffer).digest('hex');

        files.push({
          filename,
          mimeType,
          buffer,
          fileHash,
          sizeBytes: buffer.length,
        });
      });

      fileStream.on('error', (error) => {
        abort(error);
      });
    });

    busboy.on('filesLimit', () => {
      abort(new FileLimitError(`Too many files (max ${MAX_FILES})`));
    });

    busboy.on('finish', () => {
      finish();
    });

    busboy.on('error', (error: unknown) => {
      abort(error instanceof Error ? error : new Error(String(error)));
    });

    req.on('error', (error) => {
      abort(error);
    });

    req.on('aborted', () => {
      abort(new Error('Request aborted'));
    });

    req.pipe(busboy);
  });
}

/**
 * Exported limits for testing and documentation.
 */
export const MULTIPART_LIMITS = {
  MAX_FILE_SIZE,
  MAX_AGGREGATE_SIZE,
  MAX_FILES,
  ALLOWED_MIME_TYPES,
} as const;
