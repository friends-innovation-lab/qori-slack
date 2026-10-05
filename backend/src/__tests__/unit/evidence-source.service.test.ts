/**
 * Evidence Source Service Unit Tests — DISC-2
 *
 * Tests for createDiscoverySources and getExtractedTextFromSource.
 */

import * as evidenceService from '../../services/evidence-source.service';
import type { EvidenceSource } from '../../database/models/evidence_source';

// Mock sequelize
jest.mock('../../database', () => ({
  models: {
    EvidenceSource: {
      create: jest.fn(),
    },
  },
}));

const mockSequelize = require('../../database');
const mockCreate = mockSequelize.models.EvidenceSource.create as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. computeDocumentHash
// ═══════════════════════════════════════════════════════════════════════════

describe('computeDocumentHash', () => {
  it('returns consistent hash for same content', () => {
    const hash1 = evidenceService.computeDocumentHash('test content');
    const hash2 = evidenceService.computeDocumentHash('test content');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different content', () => {
    const hash1 = evidenceService.computeDocumentHash('content a');
    const hash2 = evidenceService.computeDocumentHash('content b');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 32-character hash', () => {
    const hash = evidenceService.computeDocumentHash('test');
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. getExtractedTextFromSource
// ═══════════════════════════════════════════════════════════════════════════

describe('getExtractedTextFromSource', () => {
  it('returns extracted text from metadata', () => {
    const source = {
      metadata: { extracted_text: 'Hello world' },
    } as unknown as EvidenceSource;

    expect(evidenceService.getExtractedTextFromSource(source)).toBe('Hello world');
  });

  it('returns null when metadata is null', () => {
    const source = {
      metadata: null,
    } as unknown as EvidenceSource;

    expect(evidenceService.getExtractedTextFromSource(source)).toBeNull();
  });

  it('returns null when extracted_text is missing', () => {
    const source = {
      metadata: { other_field: 'value' },
    } as unknown as EvidenceSource;

    expect(evidenceService.getExtractedTextFromSource(source)).toBeNull();
  });

  it('returns null when extracted_text is not a string', () => {
    const source = {
      metadata: { extracted_text: 123 },
    } as unknown as EvidenceSource;

    expect(evidenceService.getExtractedTextFromSource(source)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. createDiscoverySource
// ═══════════════════════════════════════════════════════════════════════════

describe('createDiscoverySource', () => {
  it('creates source with extracted text in metadata', async () => {
    const mockSource = {
      id: 1,
      public_id: 'uuid-1234',
      project_id: 100,
      source_type: 'uploaded_document',
      label: 'test.pdf',
      metadata: { extracted_text: 'Test content' },
    };
    mockCreate.mockResolvedValue(mockSource);

    const result = await evidenceService.createDiscoverySource({
      projectId: 100,
      filename: 'test.pdf',
      extractedText: 'Test content',
      contentHash: 'abc123',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      sourceMetadata: { source: 'rest' },
      createdBy: 'api:actor-123',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 100,
        source_type: 'uploaded_document',
        label: 'test.pdf',
        artifact_ref: expect.objectContaining({
          filename: 'test.pdf',
          content_hash: 'abc123',
          mime_type: 'application/pdf',
          size_bytes: 1024,
        }),
        metadata: expect.objectContaining({
          extracted_text: 'Test content',
          upload_source: 'rest',
        }),
        created_by: 'api:actor-123',
      }),
      expect.anything(),
    );

    expect(result).toEqual(mockSource);
  });

  it('includes Slack file ID when provided', async () => {
    mockCreate.mockResolvedValue({ id: 1 });

    await evidenceService.createDiscoverySource({
      projectId: 100,
      filename: 'doc.pdf',
      extractedText: 'Content',
      contentHash: 'hash',
      mimeType: 'application/pdf',
      sizeBytes: 500,
      sourceMetadata: { slackFileId: 'F12345', source: 'slack' },
      createdBy: 'slack:U_TEST',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_ref: expect.objectContaining({
          slack_file_id: 'F12345',
        }),
        metadata: expect.objectContaining({
          upload_source: 'slack',
        }),
      }),
      expect.anything(),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. createDiscoverySources (bulk)
// ═══════════════════════════════════════════════════════════════════════════

describe('createDiscoverySources', () => {
  it('creates multiple sources in order', async () => {
    mockCreate
      .mockResolvedValueOnce({ id: 1, label: 'doc1.pdf' })
      .mockResolvedValueOnce({ id: 2, label: 'doc2.pdf' });

    const sources = await evidenceService.createDiscoverySources(
      100,
      [
        {
          filename: 'doc1.pdf',
          extractedText: 'Content 1',
          contentHash: 'hash1',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          metadata: { source: 'rest' as const },
        },
        {
          filename: 'doc2.pdf',
          extractedText: 'Content 2',
          contentHash: 'hash2',
          mimeType: 'application/pdf',
          sizeBytes: 200,
          metadata: { source: 'rest' as const },
        },
      ],
      'api:actor',
    );

    expect(sources).toHaveLength(2);
    expect(sources[0].label).toBe('doc1.pdf');
    expect(sources[1].label).toBe('doc2.pdf');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('returns empty array for empty input', async () => {
    const sources = await evidenceService.createDiscoverySources(
      100,
      [],
      'api:actor',
    );

    expect(sources).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
