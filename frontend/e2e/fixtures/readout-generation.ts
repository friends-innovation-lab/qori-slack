/**
 * Readout Generation Fixtures — DR-6b-5f-A E2E Testing
 *
 * Provides deterministic mock data and API responses for readout generation:
 * - Test readout with draft content
 * - Eligible evidence for generation
 * - Generation status polling states
 * - Generation history versions
 * - Failure and conflict scenarios
 *
 * All data is isolated test data using controlled API responses.
 * No real AI requests are made.
 */

import { Page, Route } from '@playwright/test';
import { TEST_ACTOR, TEST_PROJECT, TEST_STUDY } from './auth';

// ─── Test Readout Data ──────────────────────────────────────────

export const TEST_READOUT = {
  publicId: 'e2e-readout-001',
  displayId: 'RO-0001',
  title: 'E2E Test Readout',
  question: 'What patterns emerge from the desk research evidence?',
  approvedAt: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  currentGenerationRequestId: null,
  draft: {
    contentVersion: 1,
    content: {
      summary: null,
      findings: [],
      limitations: [],
      implications: [],
    },
    findingsChecked: [],
    implicationsReviewed: [],
    lastEditedAt: '2026-10-20T00:00:00.000Z',
  },
};

export const APPROVED_READOUT = {
  ...TEST_READOUT,
  publicId: 'e2e-approved-readout-001',
  displayId: 'RO-0002',
  title: 'E2E Approved Readout',
  approvedAt: '2026-10-22T00:00:00.000Z',
  latestApproval: {
    approvalNumber: 1,
    approvedAt: '2026-10-22T00:00:00.000Z',
    approvedByDisplayName: TEST_ACTOR.actor.display_name,
  },
  draft: {
    contentVersion: 2,
    content: {
      summary: { text: 'Approved summary', citations: [] },
      findings: [{ id: 'f1', text: 'Approved finding', citations: [{ displayId: 'IN-0001' }] }],
      limitations: [],
      implications: [{ id: 'i1', kind: 'priority', text: 'Approved implication', basedOnFindings: ['f1'] }],
    },
    findingsChecked: ['f1'],
    implicationsReviewed: ['i1'],
    lastEditedAt: '2026-10-22T00:00:00.000Z',
  },
};

// ─── Test Eligible Evidence ─────────────────────────────────────

export const TEST_ELIGIBLE_EVIDENCE = [
  {
    constructPublicId: 'e2e-construct-001',
    revisionPublicId: 'e2e-revision-001',
    revisionNumber: 1,
    displayId: 'IN-0001',
    wording: 'Users prefer clear navigation labels over icons',
    sourceLabel: 'Test Document 1.pdf',
    isSuperseded: false,
  },
  {
    constructPublicId: 'e2e-construct-002',
    revisionPublicId: 'e2e-revision-002',
    revisionNumber: 1,
    displayId: 'IN-0002',
    wording: 'Mobile users abandon tasks that take more than 3 steps',
    sourceLabel: 'Survey Results Q3.xlsx',
    isSuperseded: false,
  },
  {
    constructPublicId: 'e2e-construct-003',
    revisionPublicId: 'e2e-revision-003',
    revisionNumber: 2,
    displayId: 'IN-0003',
    wording: 'Accessibility features improve overall usability',
    sourceLabel: 'Stakeholder Interview.docx',
    isSuperseded: false,
  },
];

// ─── Test Generation Versions ───────────────────────────────────

export const TEST_GENERATION_VERSIONS = [
  {
    versionId: 1,
    generationRequestId: 'gen-req-001',
    generationStatus: 'completed' as const,
    createdAt: '2026-10-20T10:00:00.000Z',
    completedAt: '2026-10-20T10:05:00.000Z',
    hasContent: true,
    requestedByDisplayName: TEST_ACTOR.actor.display_name,
  },
];

export const COMPLETED_VERSION_CONTENT = {
  versionId: 1,
  generationRequestId: 'gen-req-001',
  generationStatus: 'completed',
  hasContent: true,
  content: {
    summary: { text: 'Generated summary from evidence', citations: [{ displayId: 'IN-0001' }] },
    findings: [
      {
        id: 'F1',
        text: 'Navigation clarity is critical for user success',
        citations: [{ displayId: 'IN-0001' }, { displayId: 'IN-0003' }],
      },
      {
        id: 'F2',
        text: 'Task complexity directly impacts mobile abandonment',
        citations: [{ displayId: 'IN-0002' }],
      },
    ],
    limitations: [
      { id: 'L1', text: 'Limited sample size in survey data' },
    ],
    implications: [
      { id: 'I1', kind: 'priority', text: 'Prioritize navigation redesign', basedOnFindings: ['F1'] },
      { id: 'I2', kind: 'question', text: 'What is the optimal step count for mobile?', basedOnFindings: ['F2'] },
    ],
  },
  evidenceSnapshot: TEST_ELIGIBLE_EVIDENCE.map(e => ({
    constructPublicId: e.constructPublicId,
    revisionPublicId: e.revisionPublicId,
    revisionNumber: e.revisionNumber,
    displayId: e.displayId,
  })),
};

// ─── Generation Status States ───────────────────────────────────

export const GENERATION_STATUS_PENDING = {
  status: 'pending' as const,
  attemptCount: 0,
  versionId: 2,
  generationRequestId: 'gen-req-002',
};

export const GENERATION_STATUS_GENERATING = {
  status: 'generating' as const,
  attemptCount: 1,
  versionId: 2,
  generationRequestId: 'gen-req-002',
};

export const GENERATION_STATUS_COMPLETED = {
  status: 'completed' as const,
  attemptCount: 1,
  versionId: 2,
  generationRequestId: 'gen-req-002',
  content: COMPLETED_VERSION_CONTENT.content,
};

export const GENERATION_STATUS_FAILED = {
  status: 'failed' as const,
  attemptCount: 3,
  versionId: 2,
  generationRequestId: 'gen-req-002',
  error: 'Maximum retry attempts exceeded',
};

// ─── API Mock Setup Functions ───────────────────────────────────

/**
 * Setup basic readout API mocks for generation testing.
 * Returns handle to control generation status for polling tests.
 */
export async function setupReadoutGenerationMocks(
  page: Page,
  options: {
    readout?: typeof TEST_READOUT;
    isApproved?: boolean;
    hasGenerationHistory?: boolean;
  } = {},
): Promise<{
  setGenerationStatus: (status: typeof GENERATION_STATUS_PENDING | typeof GENERATION_STATUS_GENERATING | typeof GENERATION_STATUS_COMPLETED | typeof GENERATION_STATUS_FAILED) => void;
  setReadoutState: (updates: Partial<typeof TEST_READOUT>) => void;
}> {
  const readout = options.isApproved ? APPROVED_READOUT : (options.readout ?? TEST_READOUT);
  let currentGenerationStatus: typeof GENERATION_STATUS_PENDING | null = null;
  let currentReadout = { ...readout };

  // Mock readout detail
  await page.route('**/api/v1/projects/*/studies/*/readouts/*', async (route, request) => {
    const url = request.url();
    const method = request.method();

    // Evidence eligibility endpoint
    if (url.includes('/evidence-eligibility')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: TEST_ELIGIBLE_EVIDENCE,
          pagination: { total: TEST_ELIGIBLE_EVIDENCE.length, limit: 50, offset: 0 },
        }),
      });
      return;
    }

    // Generation history endpoint
    if (url.includes('/versions') && !url.includes('/content')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: options.hasGenerationHistory ? TEST_GENERATION_VERSIONS : [],
        }),
      });
      return;
    }

    // Version content endpoint
    if (url.includes('/versions/') && url.includes('/content')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: COMPLETED_VERSION_CONTENT }),
      });
      return;
    }

    // Approval eligibility
    if (url.includes('/eligibility')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            isEligible: false,
            reasons: [],
            supersededCitations: [],
          },
        }),
      });
      return;
    }

    // Approval history
    if (url.includes('/approvals')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: options.isApproved ? [APPROVED_READOUT.latestApproval] : [],
        }),
      });
      return;
    }

    // POST /generate endpoint
    if (url.includes('/generate') && method === 'POST') {
      // If approved, reject with 422
      if (options.isApproved) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'READOUT_FINALIZED',
              message: 'Cannot regenerate approved readout',
            },
          }),
        });
        return;
      }

      // Otherwise accept generation request
      currentGenerationStatus = GENERATION_STATUS_PENDING;
      currentReadout.currentGenerationRequestId = GENERATION_STATUS_PENDING.generationRequestId;

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            generationRequestId: GENERATION_STATUS_PENDING.generationRequestId,
            versionId: GENERATION_STATUS_PENDING.versionId,
            status: 'pending',
            created: true,
          },
        }),
      });
      return;
    }

    // GET /generate/:id polling endpoint
    if (url.includes('/generate/') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: currentGenerationStatus ?? GENERATION_STATUS_COMPLETED,
        }),
      });
      return;
    }

    // PATCH /draft endpoint
    if (url.includes('/draft') && method === 'PATCH') {
      const body = JSON.parse(await request.postData() ?? '{}');
      // Simulate version bump
      currentReadout.draft = {
        ...currentReadout.draft,
        contentVersion: body.expectedVersion + 1,
        content: body.content,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { version: currentReadout.draft.contentVersion },
        }),
      });
      return;
    }

    // Default: return readout detail
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: currentReadout }),
    });
  });

  return {
    setGenerationStatus: (status) => {
      currentGenerationStatus = status;
    },
    setReadoutState: (updates) => {
      currentReadout = { ...currentReadout, ...updates };
    },
  };
}

/**
 * Setup mocks for conflict scenario testing
 */
export async function setupConflictMocks(page: Page): Promise<void> {
  let draftVersion = 1;

  await page.route('**/api/v1/projects/*/studies/*/readouts/*', async (route, request) => {
    const url = request.url();
    const method = request.method();

    if (url.includes('/draft') && method === 'PATCH') {
      const body = JSON.parse(await request.postData() ?? '{}');

      // Simulate version conflict (draft edited elsewhere during generation)
      if (body.expectedVersion < draftVersion) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'VERSION_CONFLICT',
              message: 'Draft was modified',
            },
            data: {
              serverVersion: draftVersion,
              submittedContent: body.content,
            },
          }),
        });
        return;
      }

      draftVersion++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { version: draftVersion } }),
      });
      return;
    }

    // Default readout detail
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...TEST_READOUT,
          draft: { ...TEST_READOUT.draft, contentVersion: draftVersion },
        },
      }),
    });
  });
}

// ─── URL Helpers ────────────────────────────────────────────────

export function getReadoutEditorUrl(readoutPublicId = TEST_READOUT.publicId): string {
  return `/projects/${TEST_PROJECT.publicId}/studies/${TEST_STUDY.publicId}/discovery/readouts/${readoutPublicId}`;
}
