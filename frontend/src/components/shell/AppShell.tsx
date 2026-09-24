/**
 * AppShell — Frame for all screens: skip link, TopBar, SideNav, main, toast region.
 * Manages one overlay at a time. Responsive per design-system.md shell table.
 *
 * Workspace v2 (CC-3): Routes matching WORKSPACE_ROUTE_PATTERNS render the workspace
 * variant (shellWorkspace class, no TopBar, SideNav variant="inverse"). The
 * data-qori-surface="workspace" attribute on <html> activates scoped design tokens.
 */

import { useState, useCallback, useLayoutEffect, type ReactNode } from 'react';
import { useLocation, matchPath } from 'react-router';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import styles from './AppShell.module.css';

/**
 * Routes that use the workspace shell variant.
 * CC-3: empty (shell components built, no routes migrated yet).
 * CC-4: adds '/studies/:studyPublicId/plan'.
 * CC-5: adds '/studies/:studyPublicId/brief'.
 */
export const WORKSPACE_ROUTE_PATTERNS: readonly string[] = [
  '/studies/:studyPublicId/plan',
  '/studies/:studyPublicId/brief',
] as const;

interface AppShellProps {
  children: ReactNode;
  /**
   * Test-only: inject route patterns for testing workspace activation.
   * @internal
   */
  _testPatterns?: readonly string[];
}

/**
 * Check if the current pathname matches any workspace route pattern.
 */
function isWorkspaceRoute(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    matchPath(pattern, pathname) !== null
  );
}

export function AppShell({ children, _testPatterns }: AppShellProps) {
  const location = useLocation();
  const patterns = _testPatterns ?? WORKSPACE_ROUTE_PATTERNS;
  const isWorkspace = isWorkspaceRoute(location.pathname, patterns);

  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Set data-qori-surface="workspace" on <html> for token scoping (DDR-04 = B)
  useLayoutEffect(() => {
    if (!isWorkspace) return;

    document.documentElement.setAttribute('data-qori-surface', 'workspace');
    return () => {
      document.documentElement.removeAttribute('data-qori-surface');
    };
  }, [isWorkspace]);

  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => !prev);
  }, []);

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((prev) => !prev);
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  // Workspace variant: full-height flex, no TopBar, inverse SideNav
  if (isWorkspace) {
    return (
      <div className={styles.shellWorkspace}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <SideNav
          variant="inverse"
          collapsed={false}
          mobileOpen={false}
          onToggleCollapse={() => {}}
          onMobileClose={() => {}}
        />

        <main
          id="main-content"
          className={styles.main}
          role="main"
          tabIndex={-1}
        >
          {children}
        </main>

        {/* Toast region */}
        <div
          className={styles.toastRegion}
          role="status"
          aria-live="polite"
          aria-label="Notifications"
        />
      </div>
    );
  }

  // Default variant (non-workspace routes)
  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <TopBar
        onMenuToggle={toggleMobileNav}
        navCollapsed={navCollapsed}
      />

      <div className={`${styles.body} ${navCollapsed ? styles.bodyCollapsed : ''}`}>
        <SideNav
          collapsed={navCollapsed}
          mobileOpen={mobileNavOpen}
          onToggleCollapse={toggleNav}
          onMobileClose={closeMobileNav}
        />

        <main
          id="main-content"
          className={styles.main}
          role="main"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* Toast region — polite live region for own-action confirmations */}
      <div
        className={styles.toastRegion}
        role="status"
        aria-live="polite"
        aria-label="Notifications"
      />
    </div>
  );
}
