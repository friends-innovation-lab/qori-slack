/**
 * Readouts Client Tests — DR-6b-4a
 *
 * Unit tests for API client functions using vi.mock.
 * Fixtures derived from backend service response shapes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listReadouts,
  getReadout,
  createReadout,
  saveDraft,
  checkEligibility,
  approveReadout,
  getApprovalHistory,
  getGenerationHistory,
  getEligibleEvidence,
  initiateGeneration,
  getGenerationStatus,
  getVersionContent,
} from '../client';
import type { ReadoutDetail, DraftContent, ApprovalDetail } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/api/client', () => ({
  api: {
    get: (...args: unknown[]) => ({
      json: () => mockGet(...args),
    }),
    post: (...args: unknown[]) => ({
      json: () => mockPost(...args),
    }),
    patch: (...args: unknown[]) => ({
      json: () => mockPatch(...args),
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES (derived from backend mapToReadoutDetail)
// ═══════════════════════════════════════════════════════════════════════════

const mockDraftContent: DraftContent = {
  summary: { text: 'Test summary', citations: [] },
  findings: [
    {
      id: 'f1',
      text: 'Finding one',
      citations: [
        {
          constructPublicId: 'ins-abc',
          revisionPublicId: 'rev-123',
          revisionNumber: 1,
          displayId: 'IN-0001',
        },
      ],
    },
  ],
  limitations: [{ id: 'l1', text: 'Limitation one' }],
  implications: [
    {
      id: 'i1',
      kind: 'question',
      text: 'Research question',
      basedOnFindings: ['f1'],
    },
  ],
};

const mockReadoutSummary = {
  id: 1,
  publicId: 'ro-abc-123',
  displayId: 'RO-0001',
  studyId: 10,
  projectId: 5,
  title: 'Test Readout',
  question: 'What is the user experience?',
  approvedAt: null,
  approvedVersion: null,
  outOfDateSince: null,
  outOfDateReason: null,
  currentGenerationRequestId: null,
  createdAt: '2026-10-15T10:00:00.000Z',
  createdByActorId: 42,
};

const mockDraft = {
  content: mockDraftContent,
  findingsChecked: ['f1'],
  implicationsReviewed: [],
  contentVersion: 1,
  lastEditedAt: '2026-10-15T10:00:00.000Z',
  lastEditedByActorId: null,
};

const mockReadoutDetail: ReadoutDetail = {
  ...mockReadoutSummary,
  draft: mockDraft,
  latestApproval: null,
};

const mockApproval: ApprovalDetail = {
  id: 1,
  approvalNumber: 1,
  sourceDraftContentVersion: 2,
  approvedAt: '2026-10-15T12:00:00.000Z',
  approvedByActorId: 42,
  approvalNote: 'Looks good',
  contentSnapshot: mockDraftContent,
  findingsCheckedSnapshot: ['f1'],
  implicationsReviewedSnapshot: ['i1'],
  evidenceSnapshot: {
    cited_constructs: [
      {
        constructPublicId: 'ins-abc',
        revisionPublicId: 'rev-123',
        revisionNumber: 1,
      },
    ],
  },
  supersessionNotes: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// LIST READOUTS
// ═══════════════════════════════════════════════════════════════════════════

describe('listReadouts', () => {
  it('fetches paginated readouts list', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        readouts: [mockReadoutSummary],
        total: 1,
        limit: 50,
        offset: 0,
      },
    });

    const result = await listReadouts('proj-1', 'study-1');

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts',
      expect.objectContaining({}),
    );
    expect(result.data.readouts).toHaveLength(1);
    expect(result.data.total).toBe(1);
    expect(result.data.readouts[0].displayId).toBe('RO-0001');
  });

  it('passes pagination params', async () => {
    mockGet.mockResolvedValueOnce({
      data: { readouts: [], total: 0, limit: 10, offset: 20 },
    });

    await listReadouts('proj-1', 'study-1', { limit: 10, offset: 20 });

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts',
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
    );
  });

  it('handles empty list', async () => {
    mockGet.mockResolvedValueOnce({
      data: { readouts: [], total: 0, limit: 50, offset: 0 },
    });

    const result = await listReadouts('proj-1', 'study-1');

    expect(result.data.readouts).toEqual([]);
    expect(result.data.total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE READOUT
// ═══════════════════════════════════════════════════════════════════════════

describe('getReadout', () => {
  it('fetches single readout with draft', async () => {
    mockGet.mockResolvedValueOnce({ data: mockReadoutDetail });

    const result = await getReadout('proj-1', 'study-1', 'ro-abc-123');

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123',
    );
    expect(result.data.publicId).toBe('ro-abc-123');
    expect(result.data.draft.contentVersion).toBe(1);
    expect(result.data.draft.content.findings).toHaveLength(1);
    expect(result.data.latestApproval).toBeNull();
  });

  it('includes latest approval when present', async () => {
    const approvedReadout = {
      ...mockReadoutDetail,
      approvedAt: '2026-10-15T12:00:00.000Z',
      approvedVersion: 1,
      latestApproval: mockApproval,
    };

    mockGet.mockResolvedValueOnce({ data: approvedReadout });

    const result = await getReadout('proj-1', 'study-1', 'ro-abc-123');

    expect(result.data.latestApproval).not.toBeNull();
    expect(result.data.latestApproval?.approvalNumber).toBe(1);
    expect(result.data.latestApproval?.approvedByActorId).toBe(42);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CREATE READOUT
// ═══════════════════════════════════════════════════════════════════════════

describe('createReadout', () => {
  it('creates readout and returns detail', async () => {
    mockPost.mockResolvedValueOnce({ data: mockReadoutDetail });

    const result = await createReadout('proj-1', 'study-1', {
      title: 'New Readout',
      question: 'Test question?',
    });

    expect(mockPost).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts',
      { json: { title: 'New Readout', question: 'Test question?' } },
    );
    expect(result.data.publicId).toBe('ro-abc-123');
    expect(result.data.draft.contentVersion).toBe(1);
  });

  it('creates readout without question', async () => {
    mockPost.mockResolvedValueOnce({ data: mockReadoutDetail });

    await createReadout('proj-1', 'study-1', { title: 'New Readout' });

    expect(mockPost).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts',
      { json: { title: 'New Readout' } },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAVE DRAFT
// ═══════════════════════════════════════════════════════════════════════════

describe('saveDraft', () => {
  it('saves draft and returns updated version', async () => {
    const updatedDraft = { ...mockDraft, contentVersion: 2 };

    mockPatch.mockResolvedValueOnce({
      data: {
        draft: updatedDraft,
        invalidatedFindings: [],
        invalidatedImplications: [],
      },
    });

    const result = await saveDraft('proj-1', 'study-1', 'ro-abc-123', {
      expectedVersion: 1,
      content: { summary: { text: 'Updated summary', citations: [] } },
    });

    expect(mockPatch).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/draft',
      {
        json: {
          expectedVersion: 1,
          content: { summary: { text: 'Updated summary', citations: [] } },
        },
      },
    );
    expect(result.data.draft.contentVersion).toBe(2);
  });

  it('includes findingsChecked and implicationsReviewed', async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        draft: mockDraft,
        invalidatedFindings: [],
        invalidatedImplications: [],
      },
    });

    await saveDraft('proj-1', 'study-1', 'ro-abc-123', {
      expectedVersion: 1,
      content: mockDraftContent,
      findingsChecked: ['f1', 'f2'],
      implicationsReviewed: ['i1'],
    });

    expect(mockPatch).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/draft',
      {
        json: {
          expectedVersion: 1,
          content: mockDraftContent,
          findingsChecked: ['f1', 'f2'],
          implicationsReviewed: ['i1'],
        },
      },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════

describe('checkEligibility', () => {
  it('returns eligible status', async () => {
    mockGet.mockResolvedValueOnce({
      data: { eligible: true, errors: [] },
    });

    const result = await checkEligibility('proj-1', 'study-1', 'ro-abc-123');

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/eligibility',
    );
    expect(result.data.eligible).toBe(true);
    expect(result.data.errors).toEqual([]);
  });

  it('returns ineligible with errors', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        eligible: false,
        errors: ['Finding F1 has no citations', 'Implication I1 not reviewed'],
      },
    });

    const result = await checkEligibility('proj-1', 'study-1', 'ro-abc-123');

    expect(result.data.eligible).toBe(false);
    expect(result.data.errors).toHaveLength(2);
    expect(result.data.errors[0]).toContain('F1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// APPROVE READOUT
// ═══════════════════════════════════════════════════════════════════════════

describe('approveReadout', () => {
  it('approves and returns approval detail', async () => {
    mockPost.mockResolvedValueOnce({ data: mockApproval });

    const result = await approveReadout('proj-1', 'study-1', 'ro-abc-123', {
      expectedVersion: 2,
      approvalNote: 'Approved with notes',
    });

    expect(mockPost).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/approve',
      {
        json: {
          expectedVersion: 2,
          approvalNote: 'Approved with notes',
        },
      },
    );
    expect(result.data.approvalNumber).toBe(1);
    expect(result.data.approvedByActorId).toBe(42);
    expect(result.data.contentSnapshot).toBeDefined();
  });

  it('returns nested evidence snapshot with cited_constructs', async () => {
    mockPost.mockResolvedValueOnce({ data: mockApproval });

    const result = await approveReadout('proj-1', 'study-1', 'ro-abc-123', {
      expectedVersion: 2,
    });

    // Verify nested structure matches backend EvidenceSnapshot
    expect(result.data.evidenceSnapshot).toHaveProperty('cited_constructs');
    expect(result.data.evidenceSnapshot.cited_constructs).toHaveLength(1);
    expect(result.data.evidenceSnapshot.cited_constructs[0]).toEqual({
      constructPublicId: 'ins-abc',
      revisionPublicId: 'rev-123',
      revisionNumber: 1,
    });
    // Note: EvidenceSnapshotEntry does NOT include displayId
    expect(result.data.evidenceSnapshot.cited_constructs[0]).not.toHaveProperty(
      'displayId',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL HISTORY
// ═══════════════════════════════════════════════════════════════════════════

describe('getApprovalHistory', () => {
  it('returns approval history array', async () => {
    mockGet.mockResolvedValueOnce({
      data: { approvals: [mockApproval] },
    });

    const result = await getApprovalHistory('proj-1', 'study-1', 'ro-abc-123');

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/approvals',
    );
    expect(result.data.approvals).toHaveLength(1);
    expect(result.data.approvals[0].approvalNumber).toBe(1);
  });

  it('returns empty array when no approvals', async () => {
    mockGet.mockResolvedValueOnce({
      data: { approvals: [] },
    });

    const result = await getApprovalHistory('proj-1', 'study-1', 'ro-abc-123');

    expect(result.data.approvals).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

describe('getGenerationHistory', () => {
  it('returns generation versions array', async () => {
    const mockVersion = {
      id: 1,
      versionNumber: 1,
      generationRequestId: 'gen-req-123',
      generationStatus: 'completed',
      generationStartedAt: '2026-10-15T09:00:00.000Z',
      generationCompletedAt: '2026-10-15T09:05:00.000Z',
      generationError: null,
      draftContentVersionAtStart: 1,
      evidenceSet: [
        {
          constructPublicId: 'ins-abc',
          revisionPublicId: 'rev-123',
          revisionNumber: 1,
          displayId: 'IN-0001',
        },
      ],
      createdAt: '2026-10-15T09:00:00.000Z',
    };

    mockGet.mockResolvedValueOnce({
      data: { versions: [mockVersion] },
    });

    const result = await getGenerationHistory('proj-1', 'study-1', 'ro-abc-123');

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/versions',
    );
    expect(result.data.versions).toHaveLength(1);
    expect(result.data.versions[0].generationStatus).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ELIGIBLE EVIDENCE
// ═══════════════════════════════════════════════════════════════════════════

describe('getEligibleEvidence', () => {
  it('fetches paginated eligible insights', async () => {
    const mockInsight = {
      constructPublicId: 'ins-abc',
      displayId: 'IN-0001',
      wording: 'Test insight wording',
      acceptedRevision: {
        revisionPublicId: 'rev-123',
        revisionNumber: 1,
        acceptedAt: '2026-10-15T08:00:00.000Z',
      },
      source: {
        sourceId: 5,
        sourcePublicId: 'src-xyz',
        sourceType: 'document',
        label: 'Research Report Q3',
      },
    };

    mockGet.mockResolvedValueOnce({
      data: { insights: [mockInsight], total: 1, limit: 50, offset: 0 },
    });

    const result = await getEligibleEvidence('proj-1', 'study-1', 'ro-abc-123');

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/evidence-eligibility',
      expect.objectContaining({}),
    );
    expect(result.data.insights).toHaveLength(1);
    expect(result.data.insights[0].displayId).toBe('IN-0001');
    expect(result.data.insights[0].source?.label).toBe('Research Report Q3');
  });

  it('handles null source attribution', async () => {
    const mockInsightNullSource = {
      constructPublicId: 'ins-def',
      displayId: 'IN-0002',
      wording: 'Insight without source',
      acceptedRevision: {
        revisionPublicId: 'rev-456',
        revisionNumber: 1,
        acceptedAt: '2026-10-15T08:00:00.000Z',
      },
      source: null,
    };

    mockGet.mockResolvedValueOnce({
      data: { insights: [mockInsightNullSource], total: 1, limit: 50, offset: 0 },
    });

    const result = await getEligibleEvidence('proj-1', 'study-1', 'ro-abc-123');

    expect(result.data.insights[0].source).toBeNull();
  });

  it('passes pagination params', async () => {
    mockGet.mockResolvedValueOnce({
      data: { insights: [], total: 0, limit: 25, offset: 10 },
    });

    await getEligibleEvidence('proj-1', 'study-1', 'ro-abc-123', {
      limit: 25,
      offset: 10,
    });

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/evidence-eligibility',
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INITIATE GENERATION (DR-6b-5d-A)
// ═══════════════════════════════════════════════════════════════════════════

describe('initiateGeneration', () => {
  it('initiates generation and returns 202 response', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-abc-123',
        versionId: 5,
        status: 'pending',
        created: true,
      },
    });

    const result = await initiateGeneration('proj-1', 'study-1', 'ro-abc-123', {
      idempotencyKey: 'idem-key-12345678',
      selectedRevisionIds: ['rev-001', 'rev-002'],
    });

    expect(mockPost).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/generate',
      {
        json: {
          idempotencyKey: 'idem-key-12345678',
          selectedRevisionIds: ['rev-001', 'rev-002'],
        },
      },
    );
    expect(result.data.generationRequestId).toBe('gen-req-abc-123');
    expect(result.data.versionId).toBe(5);
    expect(result.data.status).toBe('pending');
    expect(result.data.created).toBe(true);
  });

  it('returns created: false for idempotent hit', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-existing',
        versionId: 3,
        status: 'pending',
        created: false,
      },
    });

    const result = await initiateGeneration('proj-1', 'study-1', 'ro-abc-123', {
      idempotencyKey: 'same-key-12345678',
      selectedRevisionIds: ['rev-001'],
    });

    expect(result.data.created).toBe(false);
  });

  it('propagates backend 400 error for empty selectedRevisionIds', async () => {
    // Backend requires non-empty selectedRevisionIds array
    const mockError = {
      response: {
        status: 400,
        json: () =>
          Promise.resolve({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'selectedRevisionIds must be a non-empty array',
            },
          }),
      },
    };

    mockPost.mockRejectedValueOnce(mockError);

    await expect(
      initiateGeneration('proj-1', 'study-1', 'ro-abc-123', {
        idempotencyKey: 'empty-evidence-key',
        selectedRevisionIds: [],
      }),
    ).rejects.toEqual(mockError);

    expect(mockPost).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/generate',
      {
        json: {
          idempotencyKey: 'empty-evidence-key',
          selectedRevisionIds: [],
        },
      },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET GENERATION STATUS (DR-6b-5d-A)
// ═══════════════════════════════════════════════════════════════════════════

describe('getGenerationStatus', () => {
  it('returns pending status', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-abc-123',
        status: 'pending',
        versionNumber: 5,
        attemptCount: 0,
        retryAfter: null,
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const result = await getGenerationStatus(
      'proj-1',
      'study-1',
      'ro-abc-123',
      'gen-req-abc-123',
    );

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/generate/gen-req-abc-123',
    );
    expect(result.data.status).toBe('pending');
    expect(result.data.hasContent).toBe(false);
  });

  it('returns generating status with start time', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-abc-123',
        status: 'generating',
        versionNumber: 5,
        attemptCount: 1,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const result = await getGenerationStatus(
      'proj-1',
      'study-1',
      'ro-abc-123',
      'gen-req-abc-123',
    );

    expect(result.data.status).toBe('generating');
    expect(result.data.generationStartedAt).toBe('2026-10-15T10:00:00.000Z');
    expect(result.data.attemptCount).toBe(1);
  });

  it('returns completed status with content', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-abc-123',
        status: 'completed',
        versionNumber: 5,
        attemptCount: 1,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: '2026-10-15T10:05:00.000Z',
        generationError: null,
        hasContent: true,
      },
    });

    const result = await getGenerationStatus(
      'proj-1',
      'study-1',
      'ro-abc-123',
      'gen-req-abc-123',
    );

    expect(result.data.status).toBe('completed');
    expect(result.data.hasContent).toBe(true);
    expect(result.data.generationCompletedAt).toBe('2026-10-15T10:05:00.000Z');
  });

  it('returns failed status with error', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-abc-123',
        status: 'failed',
        versionNumber: 5,
        attemptCount: 3,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: '2026-10-15T10:01:00.000Z',
        generationError: 'LLM provider timeout',
        hasContent: false,
      },
    });

    const result = await getGenerationStatus(
      'proj-1',
      'study-1',
      'ro-abc-123',
      'gen-req-abc-123',
    );

    expect(result.data.status).toBe('failed');
    expect(result.data.generationError).toBe('LLM provider timeout');
    expect(result.data.attemptCount).toBe(3);
    expect(result.data.hasContent).toBe(false);
  });

  it('returns superseded status', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-old',
        status: 'superseded',
        versionNumber: 3,
        attemptCount: 0,
        retryAfter: null,
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const result = await getGenerationStatus(
      'proj-1',
      'study-1',
      'ro-abc-123',
      'gen-req-old',
    );

    expect(result.data.status).toBe('superseded');
  });

  it('returns retryAfter for transient failures', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-retry',
        status: 'pending',
        versionNumber: 5,
        attemptCount: 2,
        retryAfter: '2026-10-15T10:10:00.000Z',
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const result = await getGenerationStatus(
      'proj-1',
      'study-1',
      'ro-abc-123',
      'gen-req-retry',
    );

    expect(result.data.retryAfter).toBe('2026-10-15T10:10:00.000Z');
    expect(result.data.attemptCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET VERSION CONTENT (DR-6b-5e-B)
// ═══════════════════════════════════════════════════════════════════════════

describe('getVersionContent', () => {
  it('fetches version content with correct endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 42,
        versionNumber: 3,
        generationStatus: 'completed',
        hasContent: true,
        content: mockDraftContent,
        evidenceSet: [
          {
            constructPublicId: 'ins-abc',
            revisionPublicId: 'rev-123',
            revisionNumber: 1,
            displayId: 'IN-0001',
          },
        ],
        draftContentVersionAtStart: 5,
        generationCompletedAt: '2026-10-15T10:05:00.000Z',
      },
    });

    const result = await getVersionContent('proj-1', 'study-1', 'ro-abc-123', 42);

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/versions/42/content',
    );
    expect(result.data.versionId).toBe(42);
    expect(result.data.versionNumber).toBe(3);
    expect(result.data.generationStatus).toBe('completed');
    expect(result.data.hasContent).toBe(true);
    expect(result.data.content).toEqual(mockDraftContent);
    expect(result.data.evidenceSet).toHaveLength(1);
    expect(result.data.draftContentVersionAtStart).toBe(5);
    expect(result.data.generationCompletedAt).toBe('2026-10-15T10:05:00.000Z');
  });

  it('returns null content for failed generation', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 15,
        versionNumber: 2,
        generationStatus: 'failed',
        hasContent: false,
        content: null,
        evidenceSet: [
          {
            constructPublicId: 'ins-xyz',
            revisionPublicId: 'rev-456',
            revisionNumber: 2,
            displayId: 'IN-0002',
          },
        ],
        draftContentVersionAtStart: 3,
        generationCompletedAt: '2026-10-15T09:30:00.000Z',
      },
    });

    const result = await getVersionContent('proj-1', 'study-1', 'ro-abc-123', 15);

    expect(result.data.generationStatus).toBe('failed');
    expect(result.data.hasContent).toBe(false);
    expect(result.data.content).toBeNull();
    // Evidence set is still preserved even if generation failed
    expect(result.data.evidenceSet).toHaveLength(1);
  });

  it('returns null content for superseded generation', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 10,
        versionNumber: 1,
        generationStatus: 'superseded',
        hasContent: false,
        content: null,
        evidenceSet: [],
        draftContentVersionAtStart: 1,
        generationCompletedAt: null,
      },
    });

    const result = await getVersionContent('proj-1', 'study-1', 'ro-abc-123', 10);

    expect(result.data.generationStatus).toBe('superseded');
    expect(result.data.hasContent).toBe(false);
    expect(result.data.content).toBeNull();
    expect(result.data.generationCompletedAt).toBeNull();
  });

  it('preserves pinned evidence identity fields including displayId', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 50,
        versionNumber: 4,
        generationStatus: 'completed',
        hasContent: true,
        content: { summary: { text: 'Summary', citations: [] } },
        evidenceSet: [
          {
            constructPublicId: 'ins-construct-001',
            revisionPublicId: 'rev-revision-001',
            revisionNumber: 5,
            displayId: 'IN-0015',
          },
          {
            constructPublicId: 'ins-construct-002',
            revisionPublicId: 'rev-revision-002',
            revisionNumber: 3,
            displayId: 'IN-0022',
          },
        ],
        draftContentVersionAtStart: 10,
        generationCompletedAt: '2026-10-15T12:00:00.000Z',
      },
    });

    const result = await getVersionContent('proj-1', 'study-1', 'ro-abc-123', 50);

    // Verify evidence snapshot preserves all identity fields
    expect(result.data.evidenceSet).toHaveLength(2);
    expect(result.data.evidenceSet[0]).toEqual({
      constructPublicId: 'ins-construct-001',
      revisionPublicId: 'rev-revision-001',
      revisionNumber: 5,
      displayId: 'IN-0015',
    });
    expect(result.data.evidenceSet[1]).toEqual({
      constructPublicId: 'ins-construct-002',
      revisionPublicId: 'rev-revision-002',
      revisionNumber: 3,
      displayId: 'IN-0022',
    });
  });

  it('handles version without content (pending/generating)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 99,
        versionNumber: 6,
        generationStatus: 'generating',
        hasContent: false,
        content: null,
        evidenceSet: [
          {
            constructPublicId: 'ins-pending',
            revisionPublicId: 'rev-pending',
            revisionNumber: 1,
            displayId: 'IN-0001',
          },
        ],
        draftContentVersionAtStart: 15,
        generationCompletedAt: null,
      },
    });

    const result = await getVersionContent('proj-1', 'study-1', 'ro-abc-123', 99);

    expect(result.data.generationStatus).toBe('generating');
    expect(result.data.hasContent).toBe(false);
    expect(result.data.content).toBeNull();
    // generationCompletedAt is null while still generating
    expect(result.data.generationCompletedAt).toBeNull();
  });

  it('correctly scopes to readout ID for cross-readout isolation', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 1,
        versionNumber: 1,
        generationStatus: 'completed',
        hasContent: true,
        content: {},
        evidenceSet: [],
        draftContentVersionAtStart: 1,
        generationCompletedAt: '2026-10-15T10:00:00.000Z',
      },
    });

    // Different readout ID
    await getVersionContent('proj-1', 'study-1', 'different-readout', 1);

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/different-readout/versions/1/content',
    );
  });
});
