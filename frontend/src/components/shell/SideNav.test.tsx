/**
 * CC-3: SideNav tests — inverse variant accessible names.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SideNav } from './SideNav';

// Mock auth for SideNav
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    me: {
      actor: { display_name: 'Test User', public_id: 'test-001' },
      organization: { name: 'Test Org', public_id: 'org-001' },
      memberships: [{ role: 'owner' }], // Include admin
    },
    logout: vi.fn(),
  }),
}));

function renderSideNav(props: Partial<Parameters<typeof SideNav>[0]> = {}) {
  const defaultProps = {
    variant: 'default' as const,
    collapsed: false,
    mobileOpen: false,
    onToggleCollapse: vi.fn(),
    onMobileClose: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <SideNav {...defaultProps} {...props} />
    </MemoryRouter>,
  );
}

describe('SideNav', () => {
  it('renders navigation with aria-label', () => {
    renderSideNav();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('renders all nav items in default variant', () => {
    renderSideNav();
    expect(screen.getByRole('link', { name: /Home/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Projects/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Studies/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Search/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ask Qori/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Work Queue/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Admin/ })).toBeInTheDocument();
  });
});

describe('SideNav inverse variant (CC-3)', () => {
  it('renders Qori logo', () => {
    renderSideNav({ variant: 'inverse' });
    expect(screen.getByAltText('Qori')).toBeInTheDocument();
  });

  it('all nav items have accessible names (visually hidden labels)', () => {
    renderSideNav({ variant: 'inverse' });

    // VC-2A: Inverse variant shows only Home, Projects, Studies, Ask Qori, Admin
    // Search and Work Queue are removed from workspace nav
    expect(screen.getByRole('link', { name: /Home/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Projects/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Studies/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ask Qori/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Admin/ })).toBeInTheDocument();

    // Search and Work Queue should NOT be in inverse variant
    expect(screen.queryByRole('link', { name: /Search/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Work Queue/ })).not.toBeInTheDocument();
  });

  it('labels are visually hidden but in DOM', () => {
    renderSideNav({ variant: 'inverse' });

    // The label text should be in the document
    const homeLink = screen.getByRole('link', { name: /Home/ });
    const label = homeLink.querySelector('span');
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent('Home');
  });

  it('renders user menu avatar', () => {
    renderSideNav({ variant: 'inverse' });
    expect(
      screen.getByRole('button', { name: /User menu for Test User/ }),
    ).toBeInTheDocument();
  });

  it('does not render collapse button', () => {
    renderSideNav({ variant: 'inverse' });
    expect(
      screen.queryByRole('button', { name: /Collapse navigation/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Expand navigation/ }),
    ).not.toBeInTheDocument();
  });
});
