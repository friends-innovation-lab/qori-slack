/**
 * Extraction Worker — DISC-WEB-1
 *
 * Child process worker for isolated document extraction.
 * Runs with memory limits via Node --max-old-space-size flag.
 *
 * Communication: IPC messages via process.send()/process.on('message')
 * Exit codes:
 *   0   — Success
 *   1   — Extraction error (recoverable)
 *   134 — SIGABRT (memory limit exceeded)
 *   137 — SIGKILL (timeout or OOM kill)
 *
 * SECURITY: This file is spawned as a subprocess. Do not import heavy dependencies.
 */

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createHash } from 'crypto';

// Error codes matching spec
export type ExtractionErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'ENCRYPTED_PDF'
  | 'SCANNED_PDF'
  | 'EMPTY_CONTENT'
  | 'EXTRACTION_TIMEOUT'
  | 'EXTRACTION_MEMORY'
  | 'EXTRACTION_FAILED';

export interface ExtractRequest {
  type: 'extract';
  buffer: number[]; // Serialized Buffer as array for IPC
  mimeType: string;
  filename: string;
}

export interface ExtractResponse {
  success: true;
  text: string;
  contentHash: string;
  charCount: number;
}

export interface ExtractErrorResponse {
  success: false;
  errorCode: ExtractionErrorCode;
  errorMessage: string;
}

export type WorkerResponse = ExtractResponse | ExtractErrorResponse;

// Supported MIME types
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
];

// Minimum extracted text length to consider valid
const MIN_TEXT_LENGTH = 50;

// Maximum extracted text length (2M characters)
const MAX_TEXT_LENGTH = 2_000_000;

/**
 * Compute SHA-256 hash of text content.
 */
function computeContentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Extract text from PDF buffer.
 */
async function extractPdf(buffer: Buffer): Promise<WorkerResponse> {
  try {
    const data = await pdfParse(buffer, {
      // Limit page parsing to prevent DoS
      max: 500, // Max pages
    });

    const text = data.text.trim();

    // Check for empty/scanned PDF
    if (data.numpages === 0) {
      return {
        success: false,
        errorCode: 'EMPTY_CONTENT',
        errorMessage: 'PDF has zero pages',
      };
    }

    if (text.length === 0) {
      return {
        success: false,
        errorCode: 'SCANNED_PDF',
        errorMessage: 'PDF appears to be scanned (no text layer). OCR is not supported.',
      };
    }

    if (text.length < MIN_TEXT_LENGTH) {
      return {
        success: false,
        errorCode: 'EMPTY_CONTENT',
        errorMessage: `PDF has insufficient text (${text.length} characters, minimum ${MIN_TEXT_LENGTH})`,
      };
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return {
        success: false,
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: `Extracted text exceeds maximum (${text.length} > ${MAX_TEXT_LENGTH} characters)`,
      };
    }

    return {
      success: true,
      text,
      contentHash: computeContentHash(text),
      charCount: text.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Detect encrypted PDF
    if (message.includes('encrypted') || message.includes('password')) {
      return {
        success: false,
        errorCode: 'ENCRYPTED_PDF',
        errorMessage: 'PDF is password-protected. Please provide an unencrypted version.',
      };
    }

    return {
      success: false,
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: `PDF extraction failed: ${message}`,
    };
  }
}

/**
 * Extract text from DOCX buffer.
 */
async function extractDocx(buffer: Buffer): Promise<WorkerResponse> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (text.length < MIN_TEXT_LENGTH) {
      return {
        success: false,
        errorCode: 'EMPTY_CONTENT',
        errorMessage: `DOCX has insufficient text (${text.length} characters, minimum ${MIN_TEXT_LENGTH})`,
      };
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return {
        success: false,
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: `Extracted text exceeds maximum (${text.length} > ${MAX_TEXT_LENGTH} characters)`,
      };
    }

    return {
      success: true,
      text,
      contentHash: computeContentHash(text),
      charCount: text.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: `DOCX extraction failed: ${message}`,
    };
  }
}

/**
 * Extract text from plain text or markdown buffer.
 */
function extractPlainText(buffer: Buffer): WorkerResponse {
  try {
    const text = buffer.toString('utf-8').trim();

    if (text.length < MIN_TEXT_LENGTH) {
      return {
        success: false,
        errorCode: 'EMPTY_CONTENT',
        errorMessage: `File has insufficient text (${text.length} characters, minimum ${MIN_TEXT_LENGTH})`,
      };
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return {
        success: false,
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: `Text exceeds maximum (${text.length} > ${MAX_TEXT_LENGTH} characters)`,
      };
    }

    return {
      success: true,
      text,
      contentHash: computeContentHash(text),
      charCount: text.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: `Text extraction failed: ${message}`,
    };
  }
}

/**
 * Main extraction dispatcher.
 */
async function extractFile(buffer: Buffer, mimeType: string): Promise<WorkerResponse> {
  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return {
      success: false,
      errorCode: 'UNSUPPORTED_FILE_TYPE',
      errorMessage: `File type ${mimeType} is not supported. Supported types: PDF, DOCX, TXT, Markdown.`,
    };
  }

  switch (mimeType) {
    case 'application/pdf':
      return extractPdf(buffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocx(buffer);

    case 'text/plain':
    case 'text/markdown':
    case 'text/x-markdown':
      return extractPlainText(buffer);

    default:
      return {
        success: false,
        errorCode: 'UNSUPPORTED_FILE_TYPE',
        errorMessage: `Unhandled file type: ${mimeType}`,
      };
  }
}

// IPC message handler
process.on('message', async (message: ExtractRequest) => {
  if (message.type !== 'extract') {
    process.send?.({
      success: false,
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: `Unknown message type: ${(message as { type?: string }).type}`,
    });
    return;
  }

  try {
    // Reconstruct Buffer from array (IPC serialization)
    const buffer = Buffer.from(message.buffer);
    const result = await extractFile(buffer, message.mimeType);
    process.send?.(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    process.send?.({
      success: false,
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: `Worker error: ${errorMessage}`,
    });
  }
});

// Signal parent we're ready
process.send?.({ type: 'ready' });
