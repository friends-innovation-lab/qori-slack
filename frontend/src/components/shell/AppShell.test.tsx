/**
 * AppShell layout tests — content offset from fixed SideNav.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppShell } from './AppShell';

// Mock auth for SideNav
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    me: {
      actor: { display_name: 'Test User', public_id: 'test-001' },
      organization: { name: 'Test Org', public_id: 'org-001' },
      memberships: [],
    },
  }),
}));

function renderShell(children: React.ReactNode = <div>Page content</div>) {
  return render(
    <MemoryRouter>
      <AppShell>{children}</AppShell>
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
