/**
 * Document Extraction API Contracts — DISC-WEB-1C
 *
 * Types for document extraction staging endpoint.
 * Mirrors backend/src/routes/api/v1/extraction.routes.ts response shapes.
 *
 * NOTE: extractedText is intentionally NOT included in the response.
 * Staged content is consumed via refToken in subsequent Discovery run creation.
 */

// ─── Extracted Reference ────────────────────────────────────────────

/**
 * A successfully extracted and staged document reference.
 * Use refToken to consume the staged content in a Discovery run.
 */
export interface ExtractedRef {
  /** Opaque reference token for staged content consumption */
  refToken: string;

  /** Original filename */
  filename: string;

  /** MIME type of original file */
  mimeType: string;

  /** Size of original file in bytes */
  sizeBytes: number;

  /** Character count of extracted text */
  charCount: number;

  /** SHA-256 hash of original file bytes */
  fileHash: string;

  /** SHA-256 hash of extracted text content */
  contentHash: string;

  /** ISO timestamp when staged content expires */
  expiresAt: string;
}

// ─── Rejected File ──────────────────────────────────────────────────

/**
 * A file that failed extraction validation or processing.
 */
export interface RejectedFile {
  /** Original filename */
  filename: string;

  /** MIME type of file */
  mimeType: string;

  /** Error code (e.g., UNSUPPORTED_FILE_TYPE, SCANNED_PDF, ENCRYPTED_PDF) */
  errorCode: string;

  /** Human-readable error message */
  errorMessage: string;
}

// ─── Extraction Response ────────────────────────────────────────────

/**
 * Response from POST /api/v1/projects/:projectId/extraction/documents
 */
export interface ExtractionResponse {
  data: {
    /** Successfully extracted and staged files */
    refs: ExtractedRef[];

    /** Files that failed extraction */
    rejected: RejectedFile[];
  };
  meta: {
    /** Time in milliseconds until staged refs expire */
    expiresInMs: number;

    /** Hint for the endpoint to consume staged refs */
    consumeEndpoint: string;
  };
}

// ─── Error Codes ────────────────────────────────────────────────────

/**
 * Known extraction error codes for frontend handling.
 */
export type ExtractionErrorCode =
  | 'FEATURE_DISABLED'           // 503: Feature flag off
  | 'EXTRACTION_UPLOAD_BUSY'     // 503: Upload admission full
  | 'EXTRACTION_OVERLOADED'      // 503: Worker queue full
  | 'EXTRACTION_UPLOAD_TIMEOUT'  // 408: Upload timed out
  | 'UNSUPPORTED_FILE_TYPE'      // Per-file: Invalid MIME type
  | 'SCANNED_PDF'                // Per-file: PDF has no text layer
  | 'ENCRYPTED_PDF'              // Per-file: Password-protected PDF
  | 'EMPTY_CONTENT'              // Per-file: Insufficient text content
  | 'FILE_TOO_LARGE'             // Per-file: Exceeds size limit
  | 'EXTRACTION_FAILED'          // Per-file: Generic extraction failure
  | 'EXTRACTION_TIMEOUT'         // Per-file: Worker timeout
  | 'EXTRACTION_MEMORY';         // Per-file: Worker OOM

// ─── API Error Response ─────────────────────────────────────────────

/**
 * Error response shape for extraction endpoint failures.
 */
export interface ExtractionErrorResponse {
  error: {
    code: ExtractionErrorCode | string;
    message: string;
  };
}
