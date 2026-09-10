/**
 * AppShell — Frame for all screens: skip link, TopBar, SideNav, main, toast region.
 * Manages one overlay at a time. Responsive per design-system.md shell table.
 */

import { useState, useCallback, type ReactNode } from 'react';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => !prev);
  }, []);

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((prev) => !prev);
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

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
