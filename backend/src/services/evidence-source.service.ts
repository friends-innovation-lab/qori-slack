/**
 * Evidence Source Service — DISC-1
 *
 * Creates EvidenceSource records for uploaded documents.
 * Per ADR 0029: EvidenceSource represents evidence-bearing inputs.
 */

import sequelize from '../database';
import type { Transaction } from 'sequelize';
import type { EvidenceSource, SourceType, ArtifactRef } from '../database/models/evidence_source';
import type { CreationAttributes } from 'sequelize';
import { createHash } from 'crypto';

const EvidenceSourceModel = sequelize.models.EvidenceSource as typeof EvidenceSource;

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateEvidenceSourceInput {
  projectId: number;
  studyId?: number | null;
  sourceType: SourceType;
  label: string;
  createdBy: string;
  artifactRef?: ArtifactRef | null;
  metadata?: Record<string, unknown> | null;
}

export interface DocumentSourceInput {
  projectId: number;
  documentName: string;
  documentContent: string;
  documentType: string;
  documentSize: number;
  createdBy: string;
  slackFileId?: string;
}

export interface DiscoverySourceInput {
  projectId: number;
  filename: string;
  extractedText: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  sourceMetadata?: {
    slackFileId?: string;
    uploadSessionId?: string;
    source: 'slack' | 'rest' | 'test';
  };
  createdBy: string;
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export class EvidenceSourceNotFoundError extends Error {
  constructor(sourceId: number | string) {
    super(`Evidence source not found: ${sourceId}`);
    this.name = 'EvidenceSourceNotFoundError';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute content hash for deduplication.
 */
export function computeDocumentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 32);
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a generic EvidenceSource.
 */
export async function createEvidenceSource(
  input: CreateEvidenceSourceInput,
  transaction?: Transaction,
): Promise<EvidenceSource> {
  const source = await EvidenceSourceModel.create(
    {
      project_id: input.projectId,
      study_id: input.studyId ?? null,
      source_type: input.sourceType,
      label: input.label,
      artifact_ref: input.artifactRef ?? null,
      metadata: input.metadata ?? null,
      created_by: input.createdBy,
    } as CreationAttributes<EvidenceSource>,
    { transaction },
  );

  return source;
}

/**
 * Create EvidenceSource for an uploaded document (desk research, stakeholder interview).
 *
 * Per DISC-1: Documents get canonical EvidenceSource identity.
 */
export async function createDocumentSource(
  input: DocumentSourceInput,
  transaction?: Transaction,
): Promise<EvidenceSource> {
  const contentHash = computeDocumentHash(input.documentContent);

  // Determine source type based on document type
  const sourceType: SourceType = input.documentType.includes('transcript')
    ? 'stakeholder_interview'
    : 'uploaded_document';

  const source = await EvidenceSourceModel.create(
    {
      project_id: input.projectId,
      study_id: null, // Discovery is project-scoped
      source_type: sourceType,
      label: input.documentName,
      artifact_ref: {
        filename: input.documentName,
        content_hash: contentHash,
        slack_file_id: input.slackFileId,
        mime_type: input.documentType,
        size_bytes: input.documentSize,
      },
      metadata: {
        content_length: input.documentContent.length,
        upload_source: 'slack',
      },
      created_by: input.createdBy,
    } as CreationAttributes<EvidenceSource>,
    { transaction },
  );

  return source;
}

/**
 * Create multiple EvidenceSource records for documents.
 * Returns array of created sources in same order as input documents.
 */
export async function createDocumentSources(
  projectId: number,
  documents: Array<{
    name: string;
    content: string;
    type: string;
    size: number;
    slackFileId?: string;
  }>,
  createdBy: string,
  transaction?: Transaction,
): Promise<EvidenceSource[]> {
  const sources: EvidenceSource[] = [];

  for (const doc of documents) {
    const source = await createDocumentSource(
      {
        projectId,
        documentName: doc.name,
        documentContent: doc.content,
        documentType: doc.type,
        documentSize: doc.size,
        createdBy,
        slackFileId: doc.slackFileId,
      },
      transaction,
    );
    sources.push(source);
  }

  return sources;
}

/**
 * Create EvidenceSource for a prepared discovery source (DISC-2).
 *
 * Stores extracted text in metadata for worker access.
 * This is a temporary solution until proper content storage is implemented.
 */
export async function createDiscoverySource(
  input: DiscoverySourceInput,
  transaction?: Transaction,
): Promise<EvidenceSource> {
  // Determine source type based on metadata
  const sourceType: SourceType = input.sourceMetadata?.source === 'slack'
    ? 'uploaded_document'
    : 'uploaded_document';

  const source = await EvidenceSourceModel.create(
    {
      project_id: input.projectId,
      study_id: null, // Discovery is project-scoped
      source_type: sourceType,
      label: input.filename,
      artifact_ref: {
        filename: input.filename,
        content_hash: input.contentHash,
        slack_file_id: input.sourceMetadata?.slackFileId,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
      },
      metadata: {
        // DISC-2: Store extracted text for worker access
        extracted_text: input.extractedText,
        content_length: input.extractedText.length,
        upload_source: input.sourceMetadata?.source || 'rest',
        upload_session_id: input.sourceMetadata?.uploadSessionId,
      },
      created_by: input.createdBy,
    } as CreationAttributes<EvidenceSource>,
    { transaction },
  );

  return source;
}

/**
 * Create multiple EvidenceSource records for prepared discovery sources (DISC-2).
 */
export async function createDiscoverySources(
  projectId: number,
  sources: Array<{
    filename: string;
    extractedText: string;
    contentHash: string;
    mimeType: string;
    sizeBytes: number;
    metadata?: {
      slackFileId?: string;
      uploadSessionId?: string;
      source: 'slack' | 'rest' | 'test';
    };
  }>,
  createdBy: string,
  transaction?: Transaction,
): Promise<EvidenceSource[]> {
  const results: EvidenceSource[] = [];

  for (const source of sources) {
    const created = await createDiscoverySource(
      {
        projectId,
        filename: source.filename,
        extractedText: source.extractedText,
        contentHash: source.contentHash,
        mimeType: source.mimeType,
        sizeBytes: source.sizeBytes,
        sourceMetadata: source.metadata,
        createdBy,
      },
      transaction,
    );
    results.push(created);
  }

  return results;
}

/**
 * Get extracted text from EvidenceSource metadata (DISC-2).
 *
 * Returns null if extracted text is not stored in metadata.
 */
export function getExtractedTextFromSource(source: EvidenceSource): string | null {
  const metadata = source.metadata as Record<string, unknown> | null;
  if (!metadata) return null;

  const extractedText = metadata.extracted_text;
  if (typeof extractedText === 'string') {
    return extractedText;
  }

  return null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get EvidenceSource by ID.
 */
export async function getEvidenceSourceById(
  sourceId: number,
  transaction?: Transaction,
): Promise<EvidenceSource | null> {
  return EvidenceSourceModel.findByPk(sourceId, { transaction });
}

/**
 * Get EvidenceSource by public_id.
 */
export async function getEvidenceSourceByPublicId(
  publicId: string,
  transaction?: Transaction,
): Promise<EvidenceSource | null> {
  return EvidenceSourceModel.findOne({
    where: { public_id: publicId },
    transaction,
  });
}

/**
 * List EvidenceSources for a project.
 */
export async function listEvidenceSourcesByProject(
  projectId: number,
  options?: {
    sourceType?: SourceType;
    limit?: number;
    offset?: number;
  },
  transaction?: Transaction,
): Promise<EvidenceSource[]> {
  const where: Record<string, unknown> = { project_id: projectId };

  if (options?.sourceType) {
    where.source_type = options.sourceType;
  }

  return EvidenceSourceModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit,
    offset: options?.offset,
    transaction,
  });
}
