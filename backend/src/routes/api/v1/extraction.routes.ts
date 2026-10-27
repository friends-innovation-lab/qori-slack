/**
 * Extraction Routes — DISC-WEB-1B-2a
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
 * Authorization and feature checks happen BEFORE multipart parsing.
 * All staging rows are created within a transaction to ensure atomicity.
 */
router.post(
  '/documents',
  requireAuth,
  requireProjectAccess('projectId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = req.ctx!;
      const project = req.resolvedProject!;

      // ─── Feature Flag Check (BEFORE parsing) ────────────────────────────
      if (process.env[FEATURE_FLAG] !== 'true') {
        res.status(503).json({
          error: {
            code: 'FEATURE_DISABLED',
            message: 'Document extraction is not available',
          },
        });
        return;
      }

      // ─── Researcher+ Role Check (BEFORE parsing) ────────────────────────
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

      // ─── Content-Type Validation ────────────────────────────────────────
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

      // ─── Parse Multipart Request ────────────────────────────────────────
      let parseResult;
      try {
        parseResult = await parseMultipart(req as unknown as IncomingMessage, contentType);
      } catch (error) {
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

      // ─── Validate Files Exist ───────────────────────────────────────────
      if (parseResult.files.length === 0 && parseResult.rejected.length === 0) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'At least one file is required',
          },
        });
        return;
      }

      // ─── Process Files ──────────────────────────────────────────────────
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

      // ─── Extract and Stage Files (Atomic Transaction) ──────────────────
      const transaction = await sequelize.transaction();

      try {
        for (const file of filesToProcess) {
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

        // Commit transaction only if we have at least one successful extraction
        await transaction.commit();
      } catch (error) {
        // Rollback on any error - no partial rows left
        await transaction.rollback();
        throw error;
      }

      // ─── Return Response ────────────────────────────────────────────────
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
      next(error);
    }
  },
);

export default router;
