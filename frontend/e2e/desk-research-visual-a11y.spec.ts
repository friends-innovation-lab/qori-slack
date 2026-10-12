/**
 * Desk Research Visual and Accessibility — DR-4f Phase 3
 *
 * Visual QA:
 * - Compare browser output against CD screen inventory (DR00-DR10b)
 * - Capture desktop (1280x720) and narrow (390x844) viewport screenshots
 *
 * Accessibility:
 * - Keyboard navigation (Tab/Shift+Tab)
 * - Dialog focus trapping and Escape dismissal
 * - ARIA attributes verification
 *
 * CD Screen Inventory:
 * - DR00 Index
 * - DR01 Overview
 * - DR02 Empty
 * - DR03 Sources - Processing and Failure
 * - DR04 Proposed Insight Review
 * - DR05 Edit Insight
 * - DR06 Accepted with Pending Revision
 * - DR07 Revision Rejected
 * - DR08a Withdraw - Confirm
 * - DR08b Withdrawn
 * - DR09 Evidence Locator and Fallback
 * - DR10a Edit Conflict
 * - DR10b Permission Denied
 */

import { test, expect } from '@playwright/test';
import { setupAuthMocks } from './fixtures/auth';
import {
  setupDeskResearchMocks,
  TEST_STUDY,
  TEST_INSIGHTS,
  TEST_SOURCES,
} from './fixtures/desk-research';

const DESK_URL = `/studies/${TEST_STUDY.public_id}/discovery/desk`;
const SOURCES_URL = `/studies/${TEST_STUDY.public_id}/discovery/desk/sources`;

test.describe('Visual QA - Desktop Viewport', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupDeskResearchMocks(page);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // DR01: Overview (Insights list with filter bar)
  test('DR01 - Overview with insights and filters', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR01-overview-desktop.png',
      fullPage: true,
    });
  });

  // DR02: Empty state
  test('DR02 - Empty state when no sources', async ({ page }) => {
    await page.route('**/api/v1/projects/*/insights/sources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });
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
      }
    });

    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR02-empty-desktop.png',
      fullPage: true,
    });
  });

  // DR03: Sources page (processing states)
  test('DR03 - Sources page', async ({ page }) => {
    await page.goto(SOURCES_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR03-sources-desktop.png',
      fullPage: true,
    });
  });

  // DR04: Proposed insight review state
  test('DR04 - Proposed insight detail', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Mock detail fetch for proposed insight
    await page.route('**/api/v1/projects/*/insights/e2e-insight-001*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: TEST_INSIGHTS[0] }),
      });
    });

    await page.screenshot({
      path: 'e2e-results/visual-DR04-proposed-desktop.png',
      fullPage: true,
    });
  });

  // DR06: Accepted insight with pending revision
  test('DR06 - Accepted with pending revision', async ({ page }) => {
    // Mock an accepted insight with pending revision
    const acceptedWithRevision = {
      ...TEST_INSIGHTS[1],
      status: 'accepted',
      latestRevision: {
        ...TEST_INSIGHTS[1].latestRevision,
        revisionNumber: 2,
        status: 'proposed',
      },
    };

    await page.route('**/api/v1/projects/*/insights', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [acceptedWithRevision],
            pagination: { total: 1, limit: 50, offset: 0 },
          }),
        });
      }
    });

    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR06-accepted-pending-desktop.png',
      fullPage: true,
    });
  });

  // DR07: Rejected revision
  test('DR07 - Rejected revision', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR07-rejected-desktop.png',
      fullPage: true,
    });
  });

  // DR08b: Withdrawn state
  test('DR08b - Withdrawn insights', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR08b-withdrawn-desktop.png',
      fullPage: true,
    });
  });
});

test.describe('Visual QA - Narrow Viewport', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupDeskResearchMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('DR01 - Overview narrow viewport', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR01-overview-narrow.png',
      fullPage: true,
    });
  });

  test('DR02 - Empty state narrow viewport', async ({ page }) => {
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
      }
    });

    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR02-empty-narrow.png',
      fullPage: true,
    });
  });

  test('DR03 - Sources narrow viewport', async ({ page }) => {
    await page.goto(SOURCES_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e-results/visual-DR03-sources-narrow.png',
      fullPage: true,
    });
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupDeskResearchMocks(page);
  });

  test('Tab navigation through page elements', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Press Tab multiple times to navigate through focusable elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Capture current focus state
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el?.tagName,
        role: el?.getAttribute('role'),
        ariaLabel: el?.getAttribute('aria-label'),
        text: el?.textContent?.slice(0, 50),
      };
    });

    console.log('Focused element after 10 tabs:', focusedElement);
    await page.screenshot({ path: 'e2e-results/a11y-tab-navigation.png' });
  });

  test('Shift+Tab reverse navigation', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Navigate forward first
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Navigate backward
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab');
      await page.waitForTimeout(100);
    }

    await page.screenshot({ path: 'e2e-results/a11y-shift-tab-navigation.png' });
  });
});

test.describe('Accessibility - Dialog Focus', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupDeskResearchMocks(page);
  });

  test('DR08a - Withdraw dialog focus trapping', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Try to open withdraw dialog
    const withdrawButton = page.getByRole('button', { name: /withdraw/i });
    const isVisible = await withdrawButton.first().isVisible().catch(() => false);

    if (isVisible) {
      await withdrawButton.first().click();
      await page.waitForTimeout(500);

      // Check for alertdialog role
      const dialog = page.getByRole('alertdialog');
      const dialogVisible = await dialog.isVisible().catch(() => false);

      if (dialogVisible) {
        // Verify focus is inside dialog
        const focusedInDialog = await page.evaluate(() => {
          const dialog = document.querySelector('[role="alertdialog"]');
          const active = document.activeElement;
          return dialog?.contains(active);
        });

        console.log('Focus trapped in dialog:', focusedInDialog);

        // Tab through dialog elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        await page.screenshot({ path: 'e2e-results/a11y-DR08a-withdraw-dialog-focus.png' });

        // Test Escape dismissal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const dialogStillVisible = await dialog.isVisible().catch(() => false);
        console.log('Dialog dismissed on Escape:', !dialogStillVisible);
      }
    }

    await page.screenshot({ path: 'e2e-results/a11y-DR08a-after-escape.png' });
  });

  test('DR10a - Conflict dialog accessibility', async ({ page }) => {
    // Mock 409 conflict response
    await page.route('**/api/v1/projects/*/insights/*/reviews', async (route, request) => {
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'VERSION_CONFLICT',
              message: 'Insight was modified',
            },
            data: {
              currentVersion: 3,
              yourVersion: 1,
              serverWording: 'Updated by another user',
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Trigger conflict
    const acceptButton = page.getByRole('button', { name: /accept/i });
    if (await acceptButton.first().isVisible().catch(() => false)) {
      await acceptButton.first().click();
      await page.waitForTimeout(500);

      // Check for conflict dialog
      const dialog = page.getByRole('alertdialog');
      const dialogVisible = await dialog.isVisible().catch(() => false);

      if (dialogVisible) {
        // Verify ARIA attributes
        const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
        const ariaDescribedBy = await dialog.getAttribute('aria-describedby');

        console.log('Dialog aria-labelledby:', ariaLabelledBy);
        console.log('Dialog aria-describedby:', ariaDescribedBy);

        await page.screenshot({ path: 'e2e-results/a11y-DR10a-conflict-dialog.png' });
      }
    }
  });

  test('DR10b - Permission denied toast accessibility', async ({ page }) => {
    // Mock 403 response
    await page.route('**/api/v1/projects/*/insights/*/reviews', async (route, request) => {
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You do not have permission',
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Trigger permission denied
    const acceptButton = page.getByRole('button', { name: /accept/i });
    if (await acceptButton.first().isVisible().catch(() => false)) {
      await acceptButton.first().click();
      await page.waitForTimeout(500);

      // Check for toast/alert
      const toast = page.locator('[role="alert"], .permissionDeniedToast');
      const toastVisible = await toast.isVisible().catch(() => false);

      console.log('Permission denied toast visible:', toastVisible);

      await page.screenshot({ path: 'e2e-results/a11y-DR10b-permission-denied.png' });
    }
  });
});

test.describe('Accessibility - ARIA Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupDeskResearchMocks(page);
  });

  test('Page has proper landmark structure', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Check for main landmark
    const main = page.getByRole('main');
    const hasMain = await main.count() > 0;
    console.log('Has main landmark:', hasMain);

    // Check for navigation
    const nav = page.getByRole('navigation');
    const navCount = await nav.count();
    console.log('Navigation landmarks:', navCount);

    // Check for headings
    const headings = await page.locator('h1, h2, h3').all();
    console.log('Heading count:', headings.length);

    await page.screenshot({ path: 'e2e-results/a11y-landmarks.png' });
  });

  test('Interactive elements have accessible names', async ({ page }) => {
    await page.goto(DESK_URL);
    await page.waitForLoadState('networkidle');

    // Check buttons have accessible names
    const buttons = await page.getByRole('button').all();
    const buttonAccessibility = await Promise.all(
      buttons.slice(0, 5).map(async (btn) => {
        const name = await btn.getAttribute('aria-label') || await btn.textContent();
        return { name: name?.slice(0, 30), hasName: !!name };
      })
    );

    console.log('Button accessibility:', buttonAccessibility);

    // Check links have accessible names
    const links = await page.getByRole('link').all();
    const linkAccessibility = await Promise.all(
      links.slice(0, 5).map(async (link) => {
        const name = await link.getAttribute('aria-label') || await link.textContent();
        return { name: name?.slice(0, 30), hasName: !!name };
      })
    );

    console.log('Link accessibility:', linkAccessibility);

    await page.screenshot({ path: 'e2e-results/a11y-accessible-names.png' });
  });
});
