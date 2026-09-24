/**
 * useMediaQuery — Subscribe to CSS media query matches.
 * Used by WorkspaceLayout (≤980 drawer) and ContextRail (presentation modes).
 */

import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport matches the given media query string.
 * Updates on resize. Never reads window.innerWidth during render.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    function handleChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

/**
 * Workspace v2 breakpoints (RESPONSIVE.md):
 * - xl = default (≥1181px)
 * - lg = 981–1180px (context rail becomes overlay)
 * - md = 768–980px (lifecycle nav becomes drawer)
 * - sm = ≤767px (narrow/mobile)
 */
export const WORKSPACE_BREAKPOINTS = {
  /** Context rail overlay threshold */
  isLgOrBelow: '(max-width: 1180px)',
  /** Navigation drawer threshold */
  isMdOrBelow: '(max-width: 980px)',
  /** Narrow/mobile threshold */
  isSmOrBelow: '(max-width: 767px)',
} as const;
