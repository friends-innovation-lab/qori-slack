/**
 * Auth Fixtures — DR-4f E2E Testing
 *
 * Provides deterministic test authentication by mocking:
 * - GET /api/v1/auth/session → authenticated status
 * - GET /api/v1/me → test actor profile
 * - GET /api/v1/auth/csrf → CSRF token
 *
 * Test data is isolated and never uses production research data.
 */

import { test as base, Page } from '@playwright/test';
import type { MeResource, SessionStatus } from '@qori/api-contracts';

// ─── Test Actor Data ────────────────────────────────────────────

export const TEST_ACTOR: MeResource = {
  publicId: 'e2e-test-actor-001',
  displayName: 'E2E Test User',
  email: 'e2e-test@qori.test',
  org: {
    publicId: 'e2e-test-org-001',
    name: 'E2E Test Organization',
    slug: 'e2e-test-org',
  },
};

export const TEST_PROJECT = {
  publicId: 'e2e-test-project-001',
  name: 'E2E Test Project',
  slug: 'e2e-test-project',
};

export const TEST_STUDY = {
  publicId: 'e2e-test-study-001',
  name: 'E2E Test Study',
  slug: 'e2e-test-study',
};

// ─── Auth Mocking Setup ─────────────────────────────────────────

export async function setupAuthMocks(page: Page): Promise<void> {
  // Mock session check
  await page.route('**/api/v1/auth/session', async (route) => {
    const response: { data: SessionStatus } = {
      data: { authenticated: true },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  // Mock actor profile
  await page.route('**/api/v1/me', async (route) => {
    const response: { data: MeResource } = {
      data: TEST_ACTOR,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  // Mock CSRF token
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'e2e-test-csrf-token' }),
    });
  });
}

// ─── Extended Test Fixture ──────────────────────────────────────

/**
 * Extended test fixture with pre-configured auth mocks.
 * Use this instead of base `test` for authenticated scenarios.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await setupAuthMocks(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
