/**
 * Extraction Routes — DISC-WEB-1B-2a, DISC-WEB-1B-2d
 *
 * Protected document extraction endpoint for Workspace uploads.
 *
 * POST /api/v1/projects/:projectId/extraction/documents
 *
 * Security:
 * - Authentication required (JWT or session)
 * - CSRF protection for session-based requests
 * - Project membership required
 * - Researcher+ role required
 * - Feature flag gated (DISC_WEB1_ENABLED)
 *
 * Memory Safety (DISC-WEB-1B-2d):
 * - Upload admission control BEFORE multipart parsing
 * - Maximum 2 concurrent upload requests (configurable)
 * - Finite upload deadline with abort handling
 * - Client disconnect detection
 * - No request body consumed on rejection
 *
 * Authorization and feature-flag checks occur BEFORE multipart parsing
 * to avoid resource consumption for unauthorized requests.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { IncomingMessage } from 'http';
import { requireAuth } from '../../../middleware/auth';
import { requireProjectAccess } from '../../../middleware/auth/requireProjectAccess';
import { hasProjectRoleByActor } from '../../../services/authorization.service';
import {
  parseMultipart,
  extractWithIsolation,
  createStagingRow,
  ExtractionOverloadError,
  AggregateLimitError,
  FileLimitError,
  acquireUploadAdmission,
  UploadBusyError,
  MULTIPART_LIMITS,
  EXTRACTION_LIMITS,
  type ParsedFile,
  type ExtractionOutcome,
} from '../../../services/extraction';
import { ApiErrorCode } from '../../../types/api-errors';
import sequelize from '../../../database';

const router = Router({ mergeParams: true });

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtractedRef {
  refToken: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  charCount: number;
  fileHash: string;
  contentHash: string;
  expiresAt: string;
}

interface RejectedFile {
  filename: string;
  mimeType: string;
  errorCode: string;
  errorMessage: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Legacy .doc MIME type to reject explicitly.
 */
const DOC_MIME_TYPE = 'application/msword';

/**
 * Feature flag environment variable.
 */
const FEATURE_FLAG = 'DISC_WEB1_ENABLED';

// ─── Route Handler ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/projects/:projectId/extraction/documents
 *
 * Upload and extract documents for later use in Discovery runs.
 *
 * Memory safety flow:
 * 1. Authentication and authorization (no body consumption)
 * 2. Acquire upload admission permit (rejects 503 if busy)
 * 3. Set upload deadline timer
 * 4. Register client disconnect handler
 * 5. Parse multipart (consumes body, buffers files)
 * 6. Extract files with worker subprocess
 * 7. Create staging rows in atomic transaction
 * 8. Release admission permit (exactly once, in finally)
 */
router.post(
  '/documents',
  requireAuth,
  requireProjectAccess('projectId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Track admission permit for guaranteed release
    let releaseAdmission: (() => void) | null = null;
    let uploadTimedOut = false;
    let clientDisconnected = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
    let processingComplete = false;

    // Cleanup function to abort parsing and release resources
    const abortProcessing = (reason: string) => {
      if (processingComplete) return;
      // Mark as complete to prevent further processing
      processingComplete = true;
      // Clear deadline timer
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
      // Note: We don't release admission here - it's released in finally
      // to ensure it happens after all processing truly stops
    };

    try {
      const ctx = req.ctx!;
      const project = req.resolvedProject!;

      // ─── Feature Flag Check (BEFORE admission) ─────────────────────────
      if (process.env[FEATURE_FLAG] !== 'true') {
        res.status(503).json({
          error: {
            code: 'FEATURE_DISABLED',
            message: 'Document extraction is not available',
          },
        });
        return;
      }

      // ─── Researcher+ Role Check (BEFORE admission) ─────────────────────
      const hasRole = await hasProjectRoleByActor(ctx.actor.id, project.id, 'researcher');
      if (!hasRole) {
        res.status(403).json({
          error: {
            code: ApiErrorCode.AUTHORIZATION_DENIED,
            message: 'Researcher role required for document extraction',
          },
        });
        return;
      }

      // ─── Content-Type Validation (BEFORE admission) ────────────────────
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.startsWith('multipart/form-data')) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Content-Type must be multipart/form-data',
          },
        });
        return;
      }

      // ─── Acquire Upload Admission (BEFORE body consumption) ────────────
      // This is the memory safety gate - rejects immediately if busy
      try {
        releaseAdmission = await acquireUploadAdmission();
      } catch (error) {
        if (error instanceof UploadBusyError) {
          // 503 without consuming any request body
          res.status(503).json({
            error: {
              code: 'EXTRACTION_UPLOAD_BUSY',
              message: 'Upload service is busy. Please try again later.',
            },
          });
          return;
        }
        throw error;
      }

      // ─── Set Upload Deadline ───────────────────────────────────────────
      // Finite timeout for entire upload+extraction flow
      deadlineTimer = setTimeout(() => {
        uploadTimedOut = true;
        abortProcessing('deadline');
        // Destroy the request socket to stop multipart streaming
        if (!res.headersSent) {
          req.destroy(new Error('Upload deadline exceeded'));
        }
      }, EXTRACTION_LIMITS.UPLOAD_TIMEOUT_MS);

      // ─── Register Client Disconnect Handler ────────────────────────────
      // Note: We use socket-level detection instead of req 'close' event
      // because the 'close' event fires when body stream finishes (normal)
      // not just on actual disconnects.
      const socket = req.socket;
      const onSocketClose = () => {
        // Socket closed before response sent = actual disconnect
        if (!res.headersSent && !processingComplete) {
          clientDisconnected = true;
          abortProcessing('disconnect');
        }
      };
      // Only listen if socket exists and is still connected
      if (socket && !socket.destroyed) {
        socket.once('close', onSocketClose);
      }

      // ─── Check for Early Abort ─────────────────────────────────────────
      if (uploadTimedOut || clientDisconnected) {
        // Already aborted before we started parsing
        if (!res.headersSent) {
          res.status(408).json({
            error: {
              code: 'EXTRACTION_UPLOAD_TIMEOUT',
              message: 'Request was aborted before processing started',
            },
          });
        }
        return;
      }

      // ─── Parse Multipart Request ───────────────────────────────────────
      let parseResult;
      try {
        parseResult = await parseMultipart(req as unknown as IncomingMessage, contentType);
      } catch (error) {
        // Check if aborted during parsing
        if (uploadTimedOut) {
          if (!res.headersSent) {
            res.status(408).json({
              error: {
                code: 'EXTRACTION_UPLOAD_TIMEOUT',
                message: 'Upload timed out during file transfer',
              },
            });
          }
          return;
        }
        if (clientDisconnected) {
          // Client disconnected - no response needed
          return;
        }
        if (error instanceof AggregateLimitError) {
          res.status(413).json({
            error: {
              code: 'AGGREGATE_LIMIT_EXCEEDED',
              message: error.message,
            },
          });
          return;
        }
        if (error instanceof FileLimitError) {
          res.status(413).json({
            error: {
              code: 'FILE_LIMIT_EXCEEDED',
              message: error.message,
            },
          });
          return;
        }
        throw error;
      }

      // ─── Check for Abort After Parsing ─────────────────────────────────
      if (uploadTimedOut || clientDisconnected) {
        // Aborted after parsing but before extraction
        // Don't create any staging rows
        return;
      }

      // ─── Validate Files Exist ──────────────────────────────────────────
      if (parseResult.files.length === 0 && parseResult.rejected.length === 0) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'At least one file is required',
          },
        });
        return;
      }

      // ─── Process Files ─────────────────────────────────────────────────
      const extractedRefs: ExtractedRef[] = [];
      const rejectedFiles: RejectedFile[] = [];

      // Add already-rejected files from multipart parsing (unsupported MIME types)
      for (const rejected of parseResult.rejected) {
        rejectedFiles.push({
          filename: rejected.filename,
          mimeType: rejected.mimeType,
          errorCode: rejected.errorCode,
          errorMessage: rejected.errorMessage,
        });
      }

      // Filter out .doc files explicitly (legacy binary format)
      const filesToProcess: ParsedFile[] = [];
      for (const file of parseResult.files) {
        if (file.mimeType === DOC_MIME_TYPE || file.filename.toLowerCase().endsWith('.doc')) {
          rejectedFiles.push({
            filename: file.filename,
            mimeType: file.mimeType,
            errorCode: 'UNSUPPORTED_FILE_TYPE',
            errorMessage: 'Legacy .doc format not supported. Please convert to .docx',
          });
        } else {
          filesToProcess.push(file);
        }
      }

      // If no valid files remain, return early with rejections
      if (filesToProcess.length === 0) {
        res.status(201).json({
          data: {
            refs: [],
            rejected: rejectedFiles,
          },
          meta: {
            expiresInMs: 30 * 60 * 1000, // 30 minutes
            consumeEndpoint: `/api/v1/projects/${project.publicId}/discovery/runs`,
          },
        });
        return;
      }

      // ─── Extract and Stage Files (Atomic Transaction) ─────────────────
      const transaction = await sequelize.transaction();

      try {
        for (const file of filesToProcess) {
          // Check for abort before each extraction
          if (uploadTimedOut || clientDisconnected) {
            await transaction.rollback();
            return;
          }

          // Extract content with subprocess isolation
          let extractionResult: ExtractionOutcome;
          try {
            extractionResult = await extractWithIsolation(
              file.buffer,
              file.mimeType,
              file.filename,
              project.id,
            );
          } catch (error) {
            if (error instanceof ExtractionOverloadError) {
              // Rollback transaction and return 503
              await transaction.rollback();
              res.status(503).json({
                error: {
                  code: 'EXTRACTION_OVERLOADED',
                  message: 'Extraction service is temporarily overloaded. Please try again later.',
                },
              });
              return;
            }
            throw error;
          }

          // Check for abort after extraction
          if (uploadTimedOut || clientDisconnected) {
            await transaction.rollback();
            return;
          }

          if (!extractionResult.success) {
            // Add to rejected list, don't create staging row
            rejectedFiles.push({
              filename: file.filename,
              mimeType: file.mimeType,
              errorCode: extractionResult.errorCode,
              errorMessage: extractionResult.errorMessage,
            });
            continue;
          }

          // Create staging row within transaction
          const stagingRow = await createStagingRow({
            projectId: project.id,
            actorId: ctx.actor.id,
            filename: file.filename,
            mimeType: file.mimeType,
            fileSizeBytes: file.sizeBytes,
            fileHash: extractionResult.fileHash,
            contentHash: extractionResult.contentHash,
            extractedText: extractionResult.text,
            charCount: extractionResult.charCount,
            transaction,
          });

          extractedRefs.push({
            refToken: stagingRow.ref_token,
            filename: stagingRow.filename,
            mimeType: stagingRow.mime_type,
            sizeBytes: stagingRow.file_size_bytes,
            charCount: stagingRow.char_count,
            fileHash: stagingRow.file_hash,
            contentHash: stagingRow.content_hash,
            expiresAt: stagingRow.expires_at.toISOString(),
          });
        }

        // Final abort check before commit
        if (uploadTimedOut || clientDisconnected) {
          await transaction.rollback();
          return;
        }

        // Commit transaction
        await transaction.commit();
      } catch (error) {
        // Rollback on any error - no partial rows left
        await transaction.rollback();
        throw error;
      }

      // Mark processing as complete before response
      processingComplete = true;

      // Clear deadline timer (successful completion)
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }

      // ─── Return Response ───────────────────────────────────────────────
      res.status(201).json({
        data: {
          refs: extractedRefs,
          rejected: rejectedFiles,
        },
        meta: {
          expiresInMs: 30 * 60 * 1000, // 30 minutes
          consumeEndpoint: `/api/v1/projects/${project.publicId}/discovery/runs`,
        },
      });
    } catch (error) {
      // Clear deadline timer on error
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
      next(error);
    } finally {
      // ─── Release Upload Admission (exactly once) ───────────────────────
      // This MUST happen after all processing stops, including:
      // - Multipart parsing complete/aborted
      // - Worker execution complete/aborted
      // - Transaction committed/rolled back
      if (releaseAdmission) {
        releaseAdmission();
        releaseAdmission = null; // Prevent double-release
      }
      // Clear deadline timer if still active
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
    }
  },
);

export default router;
