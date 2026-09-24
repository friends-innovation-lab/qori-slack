/**
 * ContextRail — Tabbed panel shell for document-related tools.
 * Modes: review (Brief approval), coaching, comments (DDR-05: only review in UX-3A).
 * Presentation: docked (≥1181) → overlay (768–1180) → sheet (≤767).
 *
 * Spec: WORKSPACE_V2_SPEC.md §10, RESPONSIVE.md.
 */

import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { X } from 'lucide-react';
import { useMediaQuery, WORKSPACE_BREAKPOINTS } from '@/hooks/useMediaQuery';
import styles from './ContextRail.module.css';

export type RailModeId = 'review' | 'coaching' | 'comments';

export interface RailMode {
  id: RailModeId;
  label: string;
  count?: number;
  icon: React.ComponentType<{ size: number; 'aria-hidden': boolean }>;
  content: ReactNode;
}

type Presentation = 'docked' | 'overlay' | 'sheet';

interface ContextRailProps {
  /** Available modes with their content */
  modes: RailMode[];
  /** Currently active mode (null = collapsed to strip) */
  activeMode: RailModeId | null;
  /** Change active mode (null to close) */
  onModeChange: (mode: RailModeId | null) => void;
  /** Element to return focus to when closing overlay/sheet */
  returnFocusTo?: RefObject<HTMLElement>;
  /** Default open at xl viewport (for Brief review) */
  defaultOpenAt?: 'xl';
}

function getPresentation(
  isLgOrBelow: boolean,
  isSmOrBelow: boolean
): Presentation {
  if (isSmOrBelow) return 'sheet';
  if (isLgOrBelow) return 'overlay';
  return 'docked';
}

export function ContextRail({
  modes,
  activeMode,
  onModeChange,
  returnFocusTo,
}: ContextRailProps) {
  const isLgOrBelow = useMediaQuery(WORKSPACE_BREAKPOINTS.isLgOrBelow);
  const isSmOrBelow = useMediaQuery(WORKSPACE_BREAKPOINTS.isSmOrBelow);
  const presentation = getPresentation(isLgOrBelow, isSmOrBelow);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const open = activeMode !== null;

  // Focus active tab on open
  useEffect(() => {
    if (open && activeMode) {
      tabRefs.current[activeMode]?.focus();
    }
  }, [open, activeMode]);

  const close = useCallback(() => {
    onModeChange(null);
    returnFocusTo?.current?.focus();
  }, [onModeChange, returnFocusTo]);

  // Escape closes overlay and sheet (not docked)
  useEffect(() => {
    if (!open || presentation === 'docked') return;

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, presentation, close]);

  // Arrow key navigation between tabs
  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % modes.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + modes.length) % modes.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = modes.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onModeChange(modes[nextIndex].id);
    tabRefs.current[modes[nextIndex].id]?.focus();
  };

  // Collapsed state: strip or hidden (sheet has no strip)
  if (!open) {
    if (presentation === 'sheet') {
      return null; // ≤767: no strip, header toggle only
    }

    return (
      <div
        className={styles.strip}
        aria-label="Document panel (collapsed)"
        role="group"
      >
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={styles.iconButton}
            aria-label={`${mode.label} panel`}
            aria-pressed={false}
            aria-controls="context-rail"
            onClick={() => onModeChange(mode.id)}
          >
            <mode.icon size={16} aria-hidden={true} />
          </button>
        ))}
      </div>
    );
  }

  // Open state
  const currentMode = modes.find((m) => m.id === activeMode)!;

  const shellClass = `${styles.rail} ${styles.railOverlayCapable} ${
    presentation === 'overlay'
      ? styles.railOverlay
      : presentation === 'sheet'
        ? styles.railSheet
        : ''
  }`;

  const dialogProps =
    presentation === 'sheet'
      ? {
          role: 'dialog' as const,
          'aria-modal': true,
          'aria-label': 'Document panel',
        }
      : {};

  return (
    <>
      {/* Strip stays docked under the overlay */}
      {presentation === 'overlay' && (
        <div className={styles.strip} aria-hidden="true" />
      )}

      <aside
        id="context-rail"
        className={shellClass}
        aria-label="Document panel"
        {...dialogProps}
      >
        <div className={styles.railTabs}>
          <div role="tablist" aria-label="Panel mode" className={styles.railTabList}>
            {modes.map((mode, index) => (
              <button
                key={mode.id}
                ref={(el) => {
                  tabRefs.current[mode.id] = el;
                }}
                type="button"
                role="tab"
                id={`rail-tab-${mode.id}`}
                aria-selected={mode.id === activeMode}
                aria-controls={`rail-panel-${mode.id}`}
                tabIndex={mode.id === activeMode ? 0 : -1}
                className={styles.railTab}
                onClick={() => onModeChange(mode.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
              >
                {mode.label}
                {mode.count != null && (
                  <span className={styles.railTabCount}>{mode.count}</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.railClose}`}
            aria-label="Close panel"
            onClick={close}
          >
            <X size={16} aria-hidden={true} />
          </button>
        </div>

        <div
          className={styles.railBody}
          role="tabpanel"
          id={`rail-panel-${currentMode.id}`}
          aria-labelledby={`rail-tab-${currentMode.id}`}
          tabIndex={0}
        >
          {currentMode.content}
        </div>
      </aside>
    </>
  );
}
