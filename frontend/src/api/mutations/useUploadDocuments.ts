/**
 * Upload Documents Mutation — DISC-WEB-1C
 *
 * Uploads files to the extraction endpoint for text extraction and staging.
 * Returns staged references and rejected files. Does NOT trigger AI processing.
 *
 * This mutation handles:
 * - multipart/form-data upload
 * - 503 FEATURE_DISABLED detection
 * - 503 EXTRACTION_UPLOAD_BUSY (transient overload)
 * - Partial success (some files extracted, some rejected)
 * - Network and timeout errors
 */

import { useMutation } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { api } from '@/api/client';
import type {
  ExtractionResponse,
  ExtractionErrorResponse,
} from '@qori/api-contracts';

// ─── Types ──────────────────────────────────────────────────────────

export interface UploadDocumentsInput {
  /** Files to upload */
  files: File[];
}

export interface UploadDocumentsResult {
  /** Upload succeeded (may still have rejected files) */
  success: true;
  /** Extraction response data */
  response: ExtractionResponse;
}

export interface UploadDocumentsError {
  /** Upload failed at HTTP level */
  success: false;
  /** Error code from response or derived */
  code: string;
  /** Human-readable message */
  message: string;
  /** HTTP status code (if available) */
  status?: number;
  /** Whether this is a transient error (retry may succeed) */
  transient: boolean;
}

export type UploadDocumentsOutcome = UploadDocumentsResult | UploadDocumentsError;

// ─── Error Codes ────────────────────────────────────────────────────

/** Feature is disabled — do not retry */
export const ERROR_FEATURE_DISABLED = 'FEATURE_DISABLED';

/** Upload admission full — transient, retry later */
export const ERROR_UPLOAD_BUSY = 'EXTRACTION_UPLOAD_BUSY';

/** Worker queue full — transient, retry later */
export const ERROR_OVERLOADED = 'EXTRACTION_OVERLOADED';

/** Upload timed out — transient, retry later */
export const ERROR_UPLOAD_TIMEOUT = 'EXTRACTION_UPLOAD_TIMEOUT';

/** Network error — transient */
export const ERROR_NETWORK = 'NETWORK_ERROR';

/** Unknown error */
export const ERROR_UNKNOWN = 'UNKNOWN_ERROR';

// ─── Mutation ───────────────────────────────────────────────────────

/**
 * Upload documents for extraction.
 *
 * @param projectPublicId - Project public ID
 * @returns Mutation that uploads files and returns extraction results
 *
 * @example
 * ```tsx
 * const upload = useUploadDocuments(projectPublicId);
 *
 * const result = await upload.mutateAsync({ files: selectedFiles });
 * if (result.success) {
 *   // Show extracted refs and rejected files
 *   console.log(result.response.data.refs);
 *   console.log(result.response.data.rejected);
 * } else {
 *   // Handle error
 *   if (result.code === ERROR_FEATURE_DISABLED) {
 *     // Show feature unavailable message
 *   }
 * }
 * ```
 */
export function useUploadDocuments(projectPublicId: string) {
  return useMutation({
    mutationFn: async (input: UploadDocumentsInput): Promise<UploadDocumentsOutcome> => {
      const formData = new FormData();

      // Append files with 'file' field name (matches backend busboy config)
      for (const file of input.files) {
        formData.append('file', file, file.name);
      }

      try {
        const response = await api
          .post(`projects/${projectPublicId}/extraction/documents`, {
            body: formData,
            // Don't set Content-Type — browser sets multipart boundary
            headers: {
              // Remove any JSON content-type that ky might set
              'Content-Type': undefined as unknown as string,
            },
          })
          .json<ExtractionResponse>();

        return {
          success: true,
          response,
        };
      } catch (error) {
        return handleUploadError(error);
      }
    },
  });
}

// ─── Error Handling ─────────────────────────────────────────────────

async function handleUploadError(error: unknown): Promise<UploadDocumentsError> {
  // Handle ky HTTPError
  if (error instanceof HTTPError) {
    const status = error.response.status;

    try {
      const body = (await error.response.json()) as ExtractionErrorResponse;
      const code = body.error?.code || ERROR_UNKNOWN;
      const message = body.error?.message || 'Upload failed';

      // Determine if transient
      const transient = isTransientError(code, status);

      return {
        success: false,
        code,
        message,
        status,
        transient,
      };
    } catch {
      // Failed to parse error response
      return {
        success: false,
        code: ERROR_UNKNOWN,
        message: `Upload failed (${status})`,
        status,
        transient: status >= 500 && status !== 503,
      };
    }
  }

  // Handle network errors (fetch failed)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      success: false,
      code: ERROR_NETWORK,
      message: 'Network error. Please check your connection.',
      transient: true,
    };
  }

  // Handle timeout errors
  if (error instanceof Error && error.name === 'TimeoutError') {
    return {
      success: false,
      code: ERROR_UPLOAD_TIMEOUT,
      message: 'Upload timed out. Please try again.',
      transient: true,
    };
  }

  // Unknown error
  return {
    success: false,
    code: ERROR_UNKNOWN,
    message: error instanceof Error ? error.message : 'Upload failed',
    transient: false,
  };
}

function isTransientError(code: string, status: number): boolean {
  // FEATURE_DISABLED is not transient — feature is off
  if (code === ERROR_FEATURE_DISABLED) {
    return false;
  }

  // These 503 codes are transient
  if (code === ERROR_UPLOAD_BUSY || code === ERROR_OVERLOADED) {
    return true;
  }

  // 408 timeout is transient
  if (status === 408) {
    return true;
  }

  // Other 5xx (except 503 FEATURE_DISABLED) may be transient
  if (status >= 500 && status < 600) {
    return true;
  }

  return false;
}
