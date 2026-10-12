/**
 * Desk Research Fixtures — DR-4f E2E Testing
 *
 * Provides deterministic mock data for Desk Research workflows:
 * - Study workspace data
 * - Project data
 * - Insights with various statuses
 * - Evidence sources
 * - Discovery counts
 *
 * All data is isolated test data, never production research data.
 */

import { Page } from '@playwright/test';
import type {
  InsightSummary,
  InsightDetail,
  InsightRevision,
  InsightReview,
  EvidenceSourceSummary,
} from '@qori/api-contracts';
import { TEST_ACTOR, TEST_PROJECT } from './auth';

// ─── Test Study Data ────────────────────────────────────────────

export const TEST_STUDY = {
  public_id: 'e2e-test-study-001',
  project_public_id: 'e2e-test-project-001',
  name: 'E2E Test Study',
  slug: 'e2e-test-study',
  brief_status: 'approved',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

// ─── Test Evidence Sources ──────────────────────────────────────

export const TEST_SOURCES: EvidenceSourceSummary[] = [
  {
    id: 1,
    publicId: 'e2e-source-001',
    label: 'Test Document 1.pdf',
    sourceType: 'uploaded_document',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 2,
    publicId: 'e2e-source-002',
    label: 'Stakeholder Interview Notes.docx',
    sourceType: 'stakeholder_interview',
    createdAt: '2026-10-02T00:00:00.000Z',
  },
  {
    id: 3,
    publicId: 'e2e-source-003',
    label: 'Survey Results Q3 2026.xlsx',
    sourceType: 'survey_dataset',
    createdAt: '2026-10-03T00:00:00.000Z',
  },
];

// ─── Test Insights ──────────────────────────────────────────────

export const TEST_INSIGHTS: InsightSummary[] = [
  {
    publicId: 'e2e-insight-001',
    status: 'proposed',
    wording: 'Users need better navigation between sections',
    version: 1,
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    createdBy: TEST_ACTOR.publicId,
    latestRevision: {
      publicId: 'e2e-revision-001',
      revisionNumber: 1,
      wording: 'Users need better navigation between sections',
      evidenceReferences: [{ sourceId: 1, locator: 'Page 5, Paragraph 2' }],
      createdBy: TEST_ACTOR.publicId,
      createdAt: '2026-10-05T10:00:00.000Z',
    },
  },
  {
    publicId: 'e2e-insight-002',
    status: 'accepted',
    wording: 'Mobile experience significantly impacts engagement',
    version: 2,
    createdAt: '2026-10-04T09:00:00.000Z',
    updatedAt: '2026-10-06T14:00:00.000Z',
    createdBy: TEST_ACTOR.publicId,
    latestRevision: {
      publicId: 'e2e-revision-002',
      revisionNumber: 1,
      wording: 'Mobile experience significantly impacts engagement',
      evidenceReferences: [{ sourceId: 2, locator: 'Interview transcript, Line 45' }],
      createdBy: TEST_ACTOR.publicId,
      createdAt: '2026-10-04T09:00:00.000Z',
    },
  },
  {
    publicId: 'e2e-insight-003',
    status: 'rejected',
    wording: 'Color scheme preference varies by age group',
    version: 1,
    createdAt: '2026-10-03T11:00:00.000Z',
    updatedAt: '2026-10-03T15:00:00.000Z',
    createdBy: TEST_ACTOR.publicId,
    latestRevision: {
      publicId: 'e2e-revision-003',
      revisionNumber: 1,
      wording: 'Color scheme preference varies by age group',
      evidenceReferences: [{ sourceId: 3, locator: 'Row 12, Column D' }],
      createdBy: TEST_ACTOR.publicId,
      createdAt: '2026-10-03T11:00:00.000Z',
    },
  },
  {
    publicId: 'e2e-insight-004',
    status: 'withdrawn',
    wording: 'Performance issues on older devices',
    version: 1,
    createdAt: '2026-10-02T08:00:00.000Z',
    updatedAt: '2026-10-02T16:00:00.000Z',
    createdBy: TEST_ACTOR.publicId,
    latestRevision: {
      publicId: 'e2e-revision-004',
      revisionNumber: 1,
      wording: 'Performance issues on older devices',
      evidenceReferences: [{ sourceId: 1, locator: 'Page 12' }],
      createdBy: TEST_ACTOR.publicId,
      createdAt: '2026-10-02T08:00:00.000Z',
    },
  },
];

// ─── Discovery Counts ───────────────────────────────────────────

export const TEST_DISCOVERY_COUNTS = {
  desk: 2,
  stakeholder: 1,
  survey: 1,
  needsReview: 1,
};

// ─── API Mock Setup ─────────────────────────────────────────────

export async function setupDeskResearchMocks(page: Page): Promise<void> {
  // Mock study data
  await page.route('**/api/v1/studies/*', async (route, request) => {
    const url = request.url();

    // Study brief endpoint
    if (url.includes('/brief')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            brief_status: 'approved',
          },
        }),
      });
      return;
    }

    // Study detail
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: TEST_STUDY,
      }),
    });
  });

  // Mock discovery counts
  await page.route('**/api/v1/projects/*/discovery/counts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: TEST_DISCOVERY_COUNTS,
      }),
    });
  });

  // Mock insights list
  await page.route('**/api/v1/projects/*/insights', async (route, request) => {
    const url = new URL(request.url());

    // Handle specific insight detail requests (has a public ID in path)
    const pathMatch = url.pathname.match(/\/insights\/([a-f0-9-]+)$/);
    if (pathMatch) {
      const insightId = pathMatch[1];
      const insight = TEST_INSIGHTS.find(i => i.publicId === insightId);
      if (insight) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: insight }),
        });
        return;
      }
    }

    // Insights list
    const statusFilter = url.searchParams.get('status');
    let filteredInsights = [...TEST_INSIGHTS];

    if (statusFilter && statusFilter !== 'all') {
      filteredInsights = TEST_INSIGHTS.filter(i => i.status === statusFilter);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filteredInsights,
        pagination: {
          total: filteredInsights.length,
          limit: 50,
          offset: 0,
        },
      }),
    });
  });

  // Mock evidence sources
  await page.route('**/api/v1/projects/*/insights/sources', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: TEST_SOURCES,
      }),
    });
  });

  // Mock needs-review count
  await page.route('**/api/v1/projects/*/insights/needs-review-count', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { count: 1 },
      }),
    });
  });

  // Mock discovery artifacts (for existing runs)
  await page.route('**/api/v1/projects/*/discovery/artifacts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
      }),
    });
  });

  // Mock project permissions
  await page.route('**/api/v1/projects/*/permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          canReview: true,
          canCreate: true,
          canEdit: true,
        },
      }),
    });
  });
}

// ─── Insight Detail Mock ────────────────────────────────────────

export function createInsightDetailMock(insight: InsightSummary): InsightDetail {
  return {
    ...insight,
    revisions: [insight.latestRevision],
    reviews: [],
  };
}
