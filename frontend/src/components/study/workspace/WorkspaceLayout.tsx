/**
 * WorkspaceLayout — Three-region layout for workspace routes.
 * Slots: nav (LifecycleRail), header (ArtifactHeader), canvas (document), rail (ContextRail).
 *
 * At ≤980px, the nav region becomes a drawer with scrim, focus trap, and Escape handling.
 * The SideNav inverse variant is rendered inside the drawer alongside the lifecycle panel.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useMediaQuery, WORKSPACE_BREAKPOINTS } from '@/hooks/useMediaQuery';
import { SideNav } from '@/components/shell/SideNav';
import styles from './WorkspaceLayout.module.css';

interface WorkspaceLayoutProps {
  /** LifecycleRail inverse variant */
  nav: ReactNode;
  /** ArtifactHeader */
  header: ReactNode;
  /** ContextRail (optional) */
  rail?: ReactNode;
  /** Whether the nav drawer is open (state owned by page) */
  navOpen: boolean;
  /** Close the nav drawer */
  onNavClose: () => void;
  /** Document content */
  children: ReactNode;
}

export function WorkspaceLayout({
  nav,
  header,
  rail,
  navOpen,
  onNavClose,
  children,
}: WorkspaceLayoutProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const isDrawerViewport = useMediaQuery(WORKSPACE_BREAKPOINTS.isMdOrBelow);

  // Focus management and Escape handling for drawer
  useEffect(() => {
    if (!(isDrawerViewport && navOpen)) return;

    // Focus first focusable element in drawer
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onNavClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerViewport, navOpen, onNavClose]);

  // Drawer props only apply at ≤980px AND when open (per COMPONENT_MAPPING §3.18)
  const drawerProps = isDrawerViewport && navOpen
    ? {
        role: 'dialog' as const,
        'aria-modal': true,
        'aria-label': 'Study navigation',
      }
    : {};

  return (
    <div className={styles.workspace}>
      <div
        id="workspace-nav"
        ref={drawerRef}
        className={`${styles.navRegion} ${navOpen ? styles.navRegionOpen : ''}`}
        {...drawerProps}
      >
        {/* At drawer viewport, render SideNav inside the drawer */}
        {isDrawerViewport && (
          <SideNav
            variant="inverse"
            collapsed={false}
            mobileOpen={false}
            onToggleCollapse={() => {}}
            onMobileClose={() => {}}
          />
        )}
        {nav}
      </div>

      {/* Scrim for drawer */}
      <div
        className={`${styles.scrim} ${isDrawerViewport && navOpen ? styles.scrimOpen : ''}`}
        onClick={onNavClose}
        aria-hidden="true"
      />

      <div className={styles.column}>
        {header}
        <div className={styles.body}>
          <div className={styles.canvas}>{children}</div>
          {rail}
        </div>
      </div>
    </div>
  );
}
