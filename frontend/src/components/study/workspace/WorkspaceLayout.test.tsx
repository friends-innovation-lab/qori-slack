/**
 * CC-3: WorkspaceLayout tests — drawer behavior, focus management.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { WorkspaceLayout } from './WorkspaceLayout';

// Mock useMediaQuery to control responsive behavior
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
  WORKSPACE_BREAKPOINTS: {
    isLgOrBelow: '(max-width: 1180px)',
    isMdOrBelow: '(max-width: 980px)',
    isSmOrBelow: '(max-width: 767px)',
  },
}));

// Mock SideNav
vi.mock('@/components/shell/SideNav', () => ({
  SideNav: () => <nav data-testid="sidenav">SideNav</nav>,
}));

import { useMediaQuery } from '@/hooks/useMediaQuery';
const mockUseMediaQuery = vi.mocked(useMediaQuery);

function renderLayout(props: {
  navOpen?: boolean;
  onNavClose?: () => void;
}) {
  const defaultProps = {
    nav: <div data-testid="lifecycle-rail">Lifecycle</div>,
    header: <header data-testid="artifact-header">Header</header>,
    rail: <aside data-testid="context-rail">Rail</aside>,
    navOpen: false,
    onNavClose: vi.fn(),
    children: <div data-testid="document">Document content</div>,
  };

  return render(
    <MemoryRouter>
      <WorkspaceLayout {...defaultProps} {...props} />
    </MemoryRouter>,
  );
}

describe('WorkspaceLayout', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(false); // Default: not drawer viewport
  });

  it('renders all layout slots', () => {
    renderLayout({});
    expect(screen.getByTestId('lifecycle-rail')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-header')).toBeInTheDocument();
    expect(screen.getByTestId('context-rail')).toBeInTheDocument();
    expect(screen.getByTestId('document')).toBeInTheDocument();
  });

  it('does not render SideNav in nav region at desktop viewport', () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderLayout({});
    expect(screen.queryByTestId('sidenav')).not.toBeInTheDocument();
  });

  describe('drawer behavior (≤980px)', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true); // Drawer viewport
    });

    it('renders SideNav inside drawer at ≤980px', () => {
      renderLayout({ navOpen: true });
      expect(screen.getByTestId('sidenav')).toBeInTheDocument();
    });

    it('drawer has dialog role when open at ≤980px', () => {
      renderLayout({ navOpen: true });
      const drawer = document.getElementById('workspace-nav');
      expect(drawer).toHaveAttribute('role', 'dialog');
      expect(drawer).toHaveAttribute('aria-modal', 'true');
      expect(drawer).toHaveAttribute('aria-label', 'Study navigation');
    });

    it('drawer does not have dialog role when closed', () => {
      renderLayout({ navOpen: false });
      const drawer = document.getElementById('workspace-nav');
      expect(drawer).not.toHaveAttribute('role');
    });

    it('Escape closes drawer and calls onNavClose', () => {
      const onNavClose = vi.fn();
      renderLayout({ navOpen: true, onNavClose });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onNavClose).toHaveBeenCalled();
    });

    it('scrim click closes drawer', () => {
      const onNavClose = vi.fn();
      const { container } = renderLayout({ navOpen: true, onNavClose });

      // Find scrim by class
      const scrim = container.querySelector('[class*="scrimOpen"]');
      expect(scrim).toBeInTheDocument();

      fireEvent.click(scrim!);
      expect(onNavClose).toHaveBeenCalled();
    });

    it('scrim is not visible when drawer is closed', () => {
      const { container } = renderLayout({ navOpen: false });
      const scrim = container.querySelector('[class*="scrimOpen"]');
      expect(scrim).not.toBeInTheDocument();
    });
  });

  describe('at desktop viewport (>980px)', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(false);
    });

    it('nav region does not have dialog role', () => {
      renderLayout({ navOpen: true });
      const navRegion = document.getElementById('workspace-nav');
      expect(navRegion).not.toHaveAttribute('role');
    });

    it('Escape does not trigger onNavClose', () => {
      const onNavClose = vi.fn();
      renderLayout({ navOpen: true, onNavClose });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onNavClose).not.toHaveBeenCalled();
    });
  });
});
