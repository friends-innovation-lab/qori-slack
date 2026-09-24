/**
 * WorkspaceLayout — Three-region layout for workspace routes.
 * Slots: nav (LifecycleRail), header (ArtifactHeader), canvas (document), rail (ContextRail).
 *
 * At ≤980px, the nav region becomes a drawer with scrim, focus trap, and Escape handling.
 * The SideNav inverse variant is rendered inside the drawer alongside the lifecycle panel.
 *
 * CC-8: Added inert handling for modal drawer and sheet per SPEC §12.6.
 * - Nav drawer (≤980px): inert on column when navOpen
 * - ContextRail sheet (≤767px): inert on column when railOpen, rail rendered outside column
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
  /** Whether the ContextRail is open (for sheet modal inert handling) */
  railOpen?: boolean;
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
  railOpen = false,
  navOpen,
  onNavClose,
  children,
}: WorkspaceLayoutProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const isDrawerViewport = useMediaQuery(WORKSPACE_BREAKPOINTS.isMdOrBelow);
  const isSheetViewport = useMediaQuery(WORKSPACE_BREAKPOINTS.isSmOrBelow);

  // CC-8: Determine if any modal surface is open (drawer or sheet)
  const isDrawerModal = isDrawerViewport && navOpen;
  const isSheetModal = isSheetViewport && railOpen;

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

      {/* CC-8: inert when drawer OR sheet modal is open (SPEC §12.6) */}
      <div
        className={styles.column}
        {...((isDrawerModal || isSheetModal) ? { inert: true } : {})}
      >
        {header}
        <div className={styles.body}>
          <div className={styles.canvas}>{children}</div>
          {/* Rail inside body when NOT sheet viewport (for flex layout) */}
          {!isSheetViewport && rail}
        </div>
      </div>

      {/* CC-8: Rail outside column when sheet viewport (to avoid inert) */}
      {isSheetViewport && rail}
    </div>
  );
}
