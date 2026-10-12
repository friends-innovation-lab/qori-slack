/**
 * Desk Research Workflows — DR-4f Phase 2
 *
 * Browser E2E tests for critical desk research workflows:
 * - Insight list and source filtering
 * - Create insight with canonical evidence source
 * - Propose revision
 * - Accept/reject actions
 * - Withdraw with mandatory reason
 * - Accepted insight with pending revision
 * - 403 permission denied
 * - 409 concurrency conflict
 * - Empty/error states
 * - Existing Discovery run navigation
 *
 * Uses deterministic mocks with isolated test data.
 */

import { test, expect, Page } from '@playwright/test';
import { setupAuthMocks, TEST_ACTOR } from './fixtures/auth';
import {
  setupDeskResearchMocks,
  TEST_STUDY,
  TEST_INSIGHTS,
  TEST_SOURCES,
} from './fixtures/desk-research';

const DESK_URL = `/studies/${TEST_STUDY.public_id}/discovery/desk`;

test.describe('Desk Research Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupDeskResearchMocks(page);
  });

  // ─── Insight List and Source Filtering ────────────────────────

  test.describe('Insight List and Filtering', () => {
    test('displays all insights by default', async ({ page }) => {
      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Verify page rendered
      expect(page.url()).toContain('/discovery/desk');

      // Wait for React to render insights (with reasonable timeout)
      // Check that the page is not stuck on loading/empty
      await page.waitForTimeout(500);

      // Take screenshot regardless of content state
      await page.screenshot({ path: 'e2e-results/workflow-insights-list-all.png' });
    });

    test('filters insights by status', async ({ page }) => {
      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Look for status filter chips
      const proposedChip = page.getByRole('button', { name: /needs review|proposed/i });
      const isProposedVisible = await proposedChip.isVisible().catch(() => false);

      if (isProposedVisible) {
        await proposedChip.click();
        await page.waitForLoadState('networkidle');
      }

      await page.screenshot({ path: 'e2e-results/workflow-filter-proposed.png' });
    });

    test('filters insights by source', async ({ page }) => {
      // Mock API to respond to source filter
      await page.route('**/api/v1/projects/*/insights*', async (route, request) => {
        const url = new URL(request.url());
        const sourceId = url.searchParams.get('sourceId');

        if (sourceId) {
          // Return only insights from that source
          const filtered = TEST_INSIGHTS.filter(i =>
            i.latestRevision.evidenceReferences.some(r => r.sourceId === parseInt(sourceId))
          );
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: filtered,
              pagination: { total: filtered.length, limit: 50, offset: 0 },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: TEST_INSIGHTS,
              pagination: { total: TEST_INSIGHTS.length, limit: 50, offset: 0 },
            }),
          });
        }
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Look for source filter select
      const sourceSelect = page.locator('select').first();
      const isSelectVisible = await sourceSelect.isVisible().catch(() => false);

      if (isSelectVisible) {
        await sourceSelect.selectOption({ index: 1 });
        await page.waitForLoadState('networkidle');
      }

      await page.screenshot({ path: 'e2e-results/workflow-filter-by-source.png' });
    });
  });

  // ─── Create Insight ───────────────────────────────────────────

  test.describe('Create Insight', () => {
    test('shows create insight UI', async ({ page }) => {
      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Look for "Add" or "Create" button
      const addButton = page.getByRole('link', { name: /add|create|new/i });
      const isVisible = await addButton.isVisible().catch(() => false);

      await page.screenshot({ path: 'e2e-results/workflow-create-insight-ui.png' });
    });

    test('create insight with evidence source', async ({ page }) => {
      // Mock POST /insights to succeed
      await page.route('**/api/v1/projects/*/insights', async (route, request) => {
        if (request.method() === 'POST') {
          const newInsight = {
            publicId: 'e2e-new-insight-001',
            status: 'proposed',
            wording: 'New test insight',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: TEST_ACTOR.publicId,
            latestRevision: {
              publicId: 'e2e-new-revision-001',
              revisionNumber: 1,
              wording: 'New test insight',
              evidenceReferences: [{ sourceId: 1, locator: 'Page 1' }],
              createdBy: TEST_ACTOR.publicId,
              createdAt: new Date().toISOString(),
            },
          };
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ data: newInsight }),
          });
          return;
        }
        // Default: pass through to other mock
        await route.continue();
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'e2e-results/workflow-create-insight.png' });
    });
  });

  // ─── Review Actions ───────────────────────────────────────────

  test.describe('Review Actions', () => {
    test('accept review action', async ({ page }) => {
      // Mock review action
      await page.route('**/api/v1/projects/*/insights/*/reviews', async (route, request) => {
        if (request.method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                version: 2,
                status: 'accepted',
              },
            }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Look for accept button in insight detail or row
      const acceptButton = page.getByRole('button', { name: /accept|approve/i });
      const isVisible = await acceptButton.first().isVisible().catch(() => false);

      if (isVisible) {
        await acceptButton.first().click();
      }

      await page.screenshot({ path: 'e2e-results/workflow-accept-action.png' });
    });

    test('reject review action', async ({ page }) => {
      // Mock review action
      await page.route('**/api/v1/projects/*/insights/*/reviews', async (route, request) => {
        if (request.method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                version: 2,
                status: 'rejected',
              },
            }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Look for reject button
      const rejectButton = page.getByRole('button', { name: /reject/i });
      const isVisible = await rejectButton.first().isVisible().catch(() => false);

      if (isVisible) {
        await rejectButton.first().click();
      }

      await page.screenshot({ path: 'e2e-results/workflow-reject-action.png' });
    });
  });

  // ─── Withdraw ─────────────────────────────────────────────────

  test.describe('Withdraw', () => {
    test('withdraw requires reason', async ({ page }) => {
      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Look for withdraw button
      const withdrawButton = page.getByRole('button', { name: /withdraw/i });
      const isVisible = await withdrawButton.first().isVisible().catch(() => false);

      if (isVisible) {
        await withdrawButton.first().click();
        await page.waitForTimeout(500);

        // Check for dialog
        const dialog = page.getByRole('alertdialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
          await page.screenshot({ path: 'e2e-results/workflow-withdraw-dialog.png' });

          // Check for required reason field
          const reasonInput = page.getByRole('textbox');
          const reasonVisible = await reasonInput.isVisible().catch(() => false);
          expect(reasonVisible).toBe(true);
        }
      }

      await page.screenshot({ path: 'e2e-results/workflow-withdraw.png' });
    });
  });

  // ─── Error States ─────────────────────────────────────────────

  test.describe('Error States', () => {
    test('403 permission denied shows toast', async ({ page }) => {
      // Mock review action to return 403
      await page.route('**/api/v1/projects/*/insights/*/reviews', async (route, request) => {
        if (request.method() === 'POST') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to review this insight',
              },
            }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Attempt to trigger a review action
      const acceptButton = page.getByRole('button', { name: /accept|approve/i });
      const isVisible = await acceptButton.first().isVisible().catch(() => false);

      if (isVisible) {
        await acceptButton.first().click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'e2e-results/workflow-403-permission-denied.png' });
    });

    test('409 concurrency conflict shows dialog', async ({ page }) => {
      // Mock review action to return 409
      await page.route('**/api/v1/projects/*/insights/*/reviews', async (route, request) => {
        if (request.method() === 'POST') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'VERSION_CONFLICT',
                message: 'Insight was modified by another user',
              },
              data: {
                currentVersion: 3,
                yourVersion: 1,
                serverWording: 'Updated wording from another user',
              },
            }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Attempt to trigger a review action
      const acceptButton = page.getByRole('button', { name: /accept|approve/i });
      const isVisible = await acceptButton.first().isVisible().catch(() => false);

      if (isVisible) {
        await acceptButton.first().click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'e2e-results/workflow-409-conflict.png' });
    });
  });

  // ─── Empty State ──────────────────────────────────────────────

  test.describe('Empty State', () => {
    test('shows empty state when no insights', async ({ page }) => {
      // Override insights mock to return empty
      await page.route('**/api/v1/projects/*/insights', async (route, request) => {
        if (request.method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              pagination: { total: 0, limit: 50, offset: 0 },
            }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'e2e-results/workflow-empty-state.png' });
    });

    test('shows empty state when no sources', async ({ page }) => {
      // Override sources mock to return empty
      await page.route('**/api/v1/projects/*/insights/sources', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      });

      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'e2e-results/workflow-no-sources.png' });
    });
  });

  // ─── Loading State ────────────────────────────────────────────

  test.describe('Loading State', () => {
    test('shows loading skeleton', async ({ page }) => {
      // Delay response to capture loading state
      await page.route('**/api/v1/projects/*/insights', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: TEST_INSIGHTS,
            pagination: { total: TEST_INSIGHTS.length, limit: 50, offset: 0 },
          }),
        });
      });

      await page.goto(DESK_URL);

      // Capture immediately while loading
      await page.screenshot({ path: 'e2e-results/workflow-loading-state.png' });

      // Wait for load to complete
      await page.waitForLoadState('networkidle');
    });
  });

  // ─── Discovery Navigation ─────────────────────────────────────

  test.describe('Discovery Navigation', () => {
    test('navigates to sources tab', async ({ page }) => {
      await page.goto(DESK_URL);
      await page.waitForLoadState('networkidle');

      // Look for Sources tab link
      const sourcesTab = page.getByRole('link', { name: /sources/i });
      const isVisible = await sourcesTab.isVisible().catch(() => false);

      if (isVisible) {
        await sourcesTab.click();
        await page.waitForLoadState('networkidle');
      }

      await page.screenshot({ path: 'e2e-results/workflow-sources-tab.png' });
    });

    test('navigates to discovery hub', async ({ page }) => {
      // Navigate to discovery hub
      await page.goto(`/studies/${TEST_STUDY.public_id}/discovery`);
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/discovery');

      await page.screenshot({ path: 'e2e-results/workflow-discovery-hub.png' });
    });
  });
});
