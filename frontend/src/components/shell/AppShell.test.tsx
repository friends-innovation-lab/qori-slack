/**
 * AppShell layout tests — content offset from fixed SideNav.
 * CC-3: workspace variant activation tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AppShell, WORKSPACE_ROUTE_PATTERNS } from './AppShell';

// Mock auth for SideNav
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    me: {
      actor: { display_name: 'Test User', public_id: 'test-001' },
      organization: { name: 'Test Org', public_id: 'org-001' },
      memberships: [],
    },
    logout: vi.fn(),
  }),
}));

function renderShell(children: React.ReactNode = <div>Page content</div>) {
  return render(
    <MemoryRouter>
      <AppShell>{children}</AppShell>
    </MemoryRouter>,
  );
}

function renderShellAtRoute(
  initialPath: string,
  testPatterns: readonly string[] = [],
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <AppShell _testPatterns={testPatterns}>
              <div data-testid="page-content">Content</div>
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell content positioning', () => {
  it('renders main content in a region with role="main"', () => {
    renderShell(<div data-testid="child">Hello</div>);
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('body container has sidebar offset class by default (expanded)', () => {
    renderShell();
    const main = screen.getByRole('main');
    const body = main.parentElement!;
    // Should NOT have the collapsed class when SideNav is expanded
    expect(body.className).not.toContain('bodyCollapsed');
  });

  it('body container gets collapsed class when SideNav is collapsed', () => {
    renderShell();
    // Click the collapse button in the SideNav footer
    const collapseButton = screen.getByLabelText('Collapse navigation');
    fireEvent.click(collapseButton);

    const main = screen.getByRole('main');
    const body = main.parentElement!;
    expect(body.className).toContain('bodyCollapsed');
  });

  it('body container loses collapsed class when SideNav is re-expanded', () => {
    renderShell();
    const collapseButton = screen.getByLabelText('Collapse navigation');
    // Collapse
    fireEvent.click(collapseButton);
    // Expand
    const expandButton = screen.getByLabelText('Expand navigation');
    fireEvent.click(expandButton);

    const main = screen.getByRole('main');
    const body = main.parentElement!;
    expect(body.className).not.toContain('bodyCollapsed');
  });

  it('all children render inside the main region', () => {
    renderShell(
      <>
        <h1 data-testid="heading">Page Title</h1>
        <p data-testid="content">Content</p>
      </>,
    );
    const main = screen.getByRole('main');
    expect(main.querySelector('[data-testid="heading"]')).not.toBeNull();
    expect(main.querySelector('[data-testid="content"]')).not.toBeNull();
  });
});

describe('AppShell workspace variant (CC-3)', () => {
  beforeEach(() => {
    // Clean up any leftover attribute from previous tests
    document.documentElement.removeAttribute('data-qori-surface');
  });

  afterEach(async () => {
    // Clean up after each test
    cleanup();
    // Wait for any pending effects
    await new Promise(resolve => setTimeout(resolve, 0));
    document.documentElement.removeAttribute('data-qori-surface');
  });

  it('WORKSPACE_ROUTE_PATTERNS is empty in CC-3', () => {
    expect(WORKSPACE_ROUTE_PATTERNS).toEqual([]);
  });

  it('renders workspace variant for a matched pattern (injected via _testPatterns)', () => {
    renderShellAtRoute('/studies/st_123/plan', ['/studies/:studyPublicId/plan']);

    // Workspace variant has shellWorkspace class (no body wrapper with TopBar)
    const main = screen.getByRole('main');
    const shell = main.parentElement!;
    expect(shell.className).toContain('shellWorkspace');
  });

  it('renders default variant for non-matched route', () => {
    renderShellAtRoute('/projects', ['/studies/:studyPublicId/plan']);

    // Default variant has the body wrapper
    const main = screen.getByRole('main');
    const body = main.parentElement!;
    // The body wrapper exists (between shell and main) in default variant
    expect(body.className).toContain('body');
    expect(body.className).not.toContain('shellWorkspace');
  });

  it('sets data-qori-surface="workspace" on <html> for matched route', () => {
    renderShellAtRoute('/studies/st_123/plan', ['/studies/:studyPublicId/plan']);

    expect(document.documentElement.getAttribute('data-qori-surface')).toBe(
      'workspace',
    );
  });

  it('does not set data-qori-surface for non-matched route', () => {
    renderShellAtRoute('/projects', ['/studies/:studyPublicId/plan']);

    expect(
      document.documentElement.hasAttribute('data-qori-surface'),
    ).toBe(false);
  });

  it('removes data-qori-surface after component unmounts from workspace route', () => {
    // Test cleanup via unmount (same as next test, validates effect cleanup)
    const { unmount } = renderShellAtRoute('/studies/st_123/plan', [
      '/studies/:studyPublicId/plan',
    ]);

    // Initially on workspace route
    expect(document.documentElement.getAttribute('data-qori-surface')).toBe(
      'workspace',
    );

    // Unmount triggers cleanup
    unmount();

    // Attribute should be removed after cleanup
    expect(
      document.documentElement.hasAttribute('data-qori-surface'),
    ).toBe(false);
  });

  it('removes data-qori-surface on unmount', () => {
    const { unmount } = renderShellAtRoute('/studies/st_123/plan', [
      '/studies/:studyPublicId/plan',
    ]);

    expect(document.documentElement.getAttribute('data-qori-surface')).toBe(
      'workspace',
    );

    unmount();

    expect(
      document.documentElement.hasAttribute('data-qori-surface'),
    ).toBe(false);
  });

  it('workspace variant does not render TopBar', () => {
    renderShellAtRoute('/studies/st_123/plan', ['/studies/:studyPublicId/plan']);

    // TopBar has role="banner", should not be present in workspace variant
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('default variant renders TopBar', () => {
    renderShellAtRoute('/projects', ['/studies/:studyPublicId/plan']);

    // TopBar has role="banner"
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
