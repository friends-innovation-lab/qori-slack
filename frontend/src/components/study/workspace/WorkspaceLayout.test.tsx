/**
 * CC-3/CC-8: WorkspaceLayout tests — drawer and sheet modal behavior, focus management.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { WorkspaceLayout } from './WorkspaceLayout';
import { WORKSPACE_BREAKPOINTS } from '@/hooks/useMediaQuery';

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

/**
 * Helper to mock viewport breakpoints.
 * @param viewport - 'desktop' (≥1181), 'overlay' (981-1180), 'drawer' (768-980), 'sheet' (≤767)
 */
function mockViewport(viewport: 'desktop' | 'overlay' | 'drawer' | 'sheet') {
  mockUseMediaQuery.mockImplementation((query: string) => {
    switch (viewport) {
      case 'desktop':
        // All breakpoints false (≥1181)
        return false;
      case 'overlay':
        // Only isLgOrBelow true (981-1180)
        return query === WORKSPACE_BREAKPOINTS.isLgOrBelow;
      case 'drawer':
        // isLgOrBelow and isMdOrBelow true (768-980)
        return query === WORKSPACE_BREAKPOINTS.isLgOrBelow ||
               query === WORKSPACE_BREAKPOINTS.isMdOrBelow;
      case 'sheet':
        // All breakpoints true (≤767)
        return true;
    }
  });
}

function renderLayout(props: {
  navOpen?: boolean;
  railOpen?: boolean;
  onNavClose?: () => void;
}) {
  const defaultProps = {
    nav: <div data-testid="lifecycle-rail">Lifecycle</div>,
    header: <header data-testid="artifact-header">Header</header>,
    rail: <aside data-testid="context-rail">Rail</aside>,
    navOpen: false,
    railOpen: false,
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
    mockViewport('desktop'); // Default: desktop viewport
  });

  it('renders all layout slots', () => {
    renderLayout({});
    expect(screen.getByTestId('lifecycle-rail')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-header')).toBeInTheDocument();
    expect(screen.getByTestId('context-rail')).toBeInTheDocument();
    expect(screen.getByTestId('document')).toBeInTheDocument();
  });

  it('does not render SideNav in nav region at desktop viewport', () => {
    mockViewport('desktop');
    renderLayout({});
    expect(screen.queryByTestId('sidenav')).not.toBeInTheDocument();
  });

  describe('drawer behavior (≤980px)', () => {
    beforeEach(() => {
      mockViewport('drawer');
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

    it('CC-8: column has inert when drawer is open', () => {
      const { container } = renderLayout({ navOpen: true });
      const column = container.querySelector('[class*="column"]');
      expect(column).toHaveAttribute('inert');
    });

    it('CC-8: column does not have inert when drawer is closed', () => {
      const { container } = renderLayout({ navOpen: false });
      const column = container.querySelector('[class*="column"]');
      expect(column).not.toHaveAttribute('inert');
    });
  });

  describe('at desktop viewport (>980px)', () => {
    beforeEach(() => {
      mockViewport('desktop');
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

  // CC-8: Sheet modal inert behavior tests
  describe('sheet modal behavior (≤767px)', () => {
    beforeEach(() => {
      mockViewport('sheet');
    });

    it('CC-8: column has inert when rail is open at sheet viewport', () => {
      const { container } = renderLayout({ railOpen: true });
      const column = container.querySelector('[class*="column"]');
      expect(column).toHaveAttribute('inert');
    });

    it('CC-8: column does not have inert when rail is closed at sheet viewport', () => {
      const { container } = renderLayout({ railOpen: false });
      const column = container.querySelector('[class*="column"]');
      expect(column).not.toHaveAttribute('inert');
    });

    it('CC-8: rail is NOT inside the inert column at sheet viewport', () => {
      const { container } = renderLayout({ railOpen: true });
      const column = container.querySelector('[class*="column"]');
      const rail = screen.getByTestId('context-rail');

      // Rail should not be a descendant of the inert column
      expect(column?.contains(rail)).toBe(false);
    });

    it('CC-8: rail remains in DOM at sheet viewport when open', () => {
      renderLayout({ railOpen: true });
      expect(screen.getByTestId('context-rail')).toBeInTheDocument();
    });

    it('CC-8: inert removed when rail closes', () => {
      const { container, rerender } = render(
        <MemoryRouter>
          <WorkspaceLayout
            nav={<div>Nav</div>}
            header={<header>Header</header>}
            rail={<aside data-testid="context-rail">Rail</aside>}
            railOpen={true}
            navOpen={false}
            onNavClose={vi.fn()}
          >
            <div>Document</div>
          </WorkspaceLayout>
        </MemoryRouter>
      );

      // First verify inert is set
      let column = container.querySelector('[class*="column"]');
      expect(column).toHaveAttribute('inert');

      // Now close the rail
      rerender(
        <MemoryRouter>
          <WorkspaceLayout
            nav={<div>Nav</div>}
            header={<header>Header</header>}
            rail={<aside data-testid="context-rail">Rail</aside>}
            railOpen={false}
            navOpen={false}
            onNavClose={vi.fn()}
          >
            <div>Document</div>
          </WorkspaceLayout>
        </MemoryRouter>
      );

      column = container.querySelector('[class*="column"]');
      expect(column).not.toHaveAttribute('inert');
    });
  });

  describe('overlay behavior (768-1180px)', () => {
    beforeEach(() => {
      mockViewport('overlay');
    });

    it('CC-8: column does NOT have inert when rail is open at overlay viewport', () => {
      const { container } = renderLayout({ railOpen: true });
      const column = container.querySelector('[class*="column"]');
      expect(column).not.toHaveAttribute('inert');
    });

    it('CC-8: rail is inside body at overlay viewport', () => {
      const { container } = renderLayout({ railOpen: true });
      const body = container.querySelector('[class*="body"]');
      const rail = screen.getByTestId('context-rail');

      // Rail should be inside body for flex layout
      expect(body?.contains(rail)).toBe(true);
    });
  });

  describe('docked behavior (≥1181px)', () => {
    beforeEach(() => {
      mockViewport('desktop');
    });

    it('CC-8: column does NOT have inert when rail is open at desktop viewport', () => {
      const { container } = renderLayout({ railOpen: true });
      const column = container.querySelector('[class*="column"]');
      expect(column).not.toHaveAttribute('inert');
    });

    it('CC-8: rail is inside body at desktop viewport', () => {
      const { container } = renderLayout({ railOpen: true });
      const body = container.querySelector('[class*="body"]');
      const rail = screen.getByTestId('context-rail');

      // Rail should be inside body for flex layout
      expect(body?.contains(rail)).toBe(true);
    });
  });

  describe('modal collision', () => {
    beforeEach(() => {
      mockViewport('sheet');
    });

    it('CC-8: column has inert when BOTH drawer and sheet are open', () => {
      const { container } = renderLayout({ navOpen: true, railOpen: true });
      const column = container.querySelector('[class*="column"]');
      expect(column).toHaveAttribute('inert');
    });
  });
});
