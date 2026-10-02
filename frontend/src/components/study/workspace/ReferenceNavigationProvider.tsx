/**
 * ReferenceNavigationProvider — Central coordinator for Coach reference navigation.
 *
 * M3C-B: Enables clickable Coach references that navigate to document sections.
 *
 * Architecture:
 * - Lives at AppShell level (for workspace routes) to persist state across Brief ↔ Plan
 * - Owns pinned coach run state for cross-artifact reference navigation
 * - Owns last-navigation-wins cancellation via generation tokens
 * - CoachingRail delegates reference navigation to this coordinator
 *
 * Responsibilities:
 * - Destination resolution (section_key → DOM target)
 * - Same/cross-artifact determination
 * - Route transition for cross-artifact
 * - Render readiness wait
 * - Scroll + accessible focus + temporary highlight
 * - Pinned originating coach run state
 * - "Return to origin" state
 * - Cleanup on rail close or deliberate navigation
 *
 * NOT responsible for:
 * - Routing table knowledge (uses resolver mapping)
 * - DOM ID knowledge (uses resolver mapping)
 * - Coach run detail fetching (remains in CoachingRail)
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useNavigate, useLocation } from 'react-router';
import type { CoachRunReferenceResource } from '@qori/api-contracts';
import { useCommentDraftGuard } from '../document/CommentDraftContext';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ArtifactType = 'brief' | 'plan';

/** Pinned coach run state for cross-artifact navigation */
export interface PinnedCoachRun {
  /** Run ID to display in destination artifact */
  runId: string;
  /** Origin artifact type */
  originArtifactType: ArtifactType;
  /** Origin study public ID */
  originStudyPublicId: string;
  /** Origin section key if in section context (null = artifact context) */
  originSectionKey: string | null;
  /** Origin section label if in section context */
  originSectionLabel: string | null;
}

/** Reference destination resolution result */
export interface ResolvedDestination {
  /** Target artifact type */
  artifactType: ArtifactType;
  /** Target section key (canonical) */
  sectionKey: string;
  /** DOM element ID for scroll target */
  domElementId: string;
  /** Whether navigation requires artifact switch */
  isCrossArtifact: boolean;
  /** Reviewed content version for provenance display */
  reviewedVersion: number | null;
}

/** Reference navigation request */
export interface NavigateToReferenceParams {
  /** Reference from coach run */
  reference: CoachRunReferenceResource;
  /** Origin coach run ID */
  originCoachRunId: string;
  /** Origin artifact context */
  originArtifact: {
    type: ArtifactType;
    studyPublicId: string;
  };
  /** Origin section context (null = artifact context) */
  originSection: {
    sectionKey: string;
    label: string;
  } | null;
  /** Reviewed content version from run.content_version or context */
  reviewedVersion: number | null;
}

/** Context value */
interface ReferenceNavigationContextValue {
  /** Current pinned coach run (for cross-artifact navigation) */
  pinnedRun: PinnedCoachRun | null;
  /** Navigate to a coach reference */
  navigateToReference: (params: NavigateToReferenceParams) => void;
  /** Return to origin artifact after cross-artifact navigation */
  returnToOrigin: () => void;
  /** Clear pinned run state (called on rail close or deliberate navigation) */
  clearPinnedRun: () => void;
  /** Check if a reference is resolvable to a clickable destination */
  isReferenceClickable: (
    reference: CoachRunReferenceResource,
    currentArtifactType: ArtifactType,
  ) => boolean;
  /** Resolve reference to destination (returns null if not resolvable) */
  resolveDestination: (
    reference: CoachRunReferenceResource,
    currentArtifactType: ArtifactType,
  ) => ResolvedDestination | null;
  /** Get reviewed version for provenance display */
  getReviewedVersionForReference: (
    reference: CoachRunReferenceResource,
    runContentVersion: number,
    contextEntries: Array<{
      object_type: string;
      object_id: string;
      object_version: number | null;
    }>,
  ) => number | null;
  /** Whether reference navigation mode is active */
  isNavigationActive: boolean;
}

// ─── Canonical Section Key → DOM ID Mapping ─────────────────────────────────
//
// CRITICAL: This is the ONLY place that maps canonical backend section keys
// to DOM presentation IDs. CoachingRail must NOT know these mappings.
//
// Canonical keys come from artifact contracts and coaching contracts.
// DOM IDs are presentation-layer concerns in DocumentSection.

const BRIEF_SECTION_TO_DOM: Record<string, string> = {
  summary: 'sec-summary',
  problem_narrative: 'sec-problem',
  method_prose: 'sec-method',
  participants_prose: 'sec-participants',
  out_of_scope: 'sec-out-of-scope',
  risks: 'sec-risks',
  // Structured object fallbacks (navigate to containing section)
  objectives: 'sec-objectives',
  research_questions: 'sec-objectives', // Questions live in objectives section
  target_barriers: 'sec-problem', // Barriers live in problem section
};

const PLAN_SECTION_TO_DOM: Record<string, string> = {
  plan_summary: 'sec-summary',
  plan_background: 'sec-background',
  plan_method_approach: 'sec-method',
  plan_participants_prose: 'sec-participants',
  plan_deliverables: 'sec-deliverables',
  plan_risks: 'sec-risks',
  plan_commitments: 'sec-commitments',
  // Inherited sections (read-only from Brief, displayed in Plan)
  objectives: 'sec-objectives',
  questions: 'sec-questions',
  timeline: 'sec-timeline',
};

/**
 * Resolve section_key to DOM element ID.
 * Returns null if section cannot be deterministically targeted.
 */
function resolveSectionToDomId(
  artifactType: ArtifactType,
  sectionKey: string,
): string | null {
  const mapping = artifactType === 'brief' ? BRIEF_SECTION_TO_DOM : PLAN_SECTION_TO_DOM;
  return mapping[sectionKey] ?? null;
}

// NOTE: parseArtifactTypeFromObjectId was removed as currently unused.
// If cross-artifact reference detection from object_id is needed later,
// re-add this function:
// function parseArtifactTypeFromObjectId(objectId: string): ArtifactType | null {...}

// ─── Context ────────────────────────────────────────────────────────────────

const ReferenceNavigationContext = createContext<ReferenceNavigationContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useReferenceNavigation(): ReferenceNavigationContextValue {
  const ctx = useContext(ReferenceNavigationContext);
  if (!ctx) {
    throw new Error('useReferenceNavigation must be used within ReferenceNavigationProvider');
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

interface ReferenceNavigationProviderProps {
  children: ReactNode;
  /** Current study public ID (extracted from route) */
  studyPublicId: string | null;
  /** Current artifact type (brief or plan) */
  currentArtifactType: ArtifactType | null;
}

export function ReferenceNavigationProvider({
  children,
  studyPublicId,
  currentArtifactType,
}: ReferenceNavigationProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // M4B.1: Draft guard for cross-artifact navigation blocking
  const { confirmNavigation } = useCommentDraftGuard();

  // Pinned coach run state for cross-artifact navigation
  const [pinnedRun, setPinnedRun] = useState<PinnedCoachRun | null>(null);

  // Last-navigation-wins: generation token to invalidate stale navigations
  const navigationGenRef = useRef(0);

  // Track if navigation is in progress (for cross-artifact wait)
  const [isNavigationActive, setIsNavigationActive] = useState(false);

  /**
   * Resolve reference to destination.
   * Returns null if reference cannot be deterministically resolved.
   */
  const resolveDestination = useCallback(
    (
      reference: CoachRunReferenceResource,
      currentArtifact: ArtifactType,
    ): ResolvedDestination | null => {
      // Only support artifact_section references for M3C-B
      if (reference.object_type !== 'artifact_section') {
        return null;
      }

      const sectionKey = reference.section_key;
      if (!sectionKey) {
        return null;
      }

      // Determine target artifact type from reference
      // References from Brief coach point to Brief sections
      // References from Plan coach may point to Brief (inherited) or Plan sections
      let targetArtifactType: ArtifactType = currentArtifact;

      // Check if this is a cross-artifact reference
      // Plan sections start with 'plan_', Brief sections don't
      if (currentArtifact === 'plan') {
        // If section doesn't start with 'plan_' and isn't an inherited section,
        // it might be a Brief reference
        if (
          !sectionKey.startsWith('plan_') &&
          !['objectives', 'questions', 'timeline'].includes(sectionKey)
        ) {
          // This is a Brief section referenced from Plan Coach
          targetArtifactType = 'brief';
        }
      }

      // Resolve DOM element ID
      const domElementId = resolveSectionToDomId(targetArtifactType, sectionKey);
      if (!domElementId) {
        return null;
      }

      const isCrossArtifact = targetArtifactType !== currentArtifact;

      return {
        artifactType: targetArtifactType,
        sectionKey,
        domElementId,
        isCrossArtifact,
        reviewedVersion: null, // Populated by caller
      };
    },
    [],
  );

  /**
   * Check if reference is clickable.
   */
  const isReferenceClickable = useCallback(
    (reference: CoachRunReferenceResource, currentArtifact: ArtifactType): boolean => {
      return resolveDestination(reference, currentArtifact) !== null;
    },
    [resolveDestination],
  );

  /**
   * Get reviewed version for provenance display.
   * Prefers matching context entry object_version over run.content_version.
   */
  const getReviewedVersionForReference = useCallback(
    (
      reference: CoachRunReferenceResource,
      runContentVersion: number,
      contextEntries: Array<{
        object_type: string;
        object_id: string;
        object_version: number | null;
      }>,
    ): number | null => {
      // Try to find matching context entry with version
      const matchingContext = contextEntries.find(
        (entry) =>
          entry.object_type === reference.object_type &&
          entry.object_id === reference.object_id,
      );

      if (matchingContext?.object_version != null) {
        return matchingContext.object_version;
      }

      // Fall back to run content version for same-artifact sections
      return runContentVersion;
    },
    [],
  );

  /**
   * Scroll to target element with highlight.
   * Uses prefers-reduced-motion for scroll behavior.
   */
  const scrollAndHighlight = useCallback(
    (elementId: string, navigationGen: number) => {
      // Check if this navigation is still valid
      if (navigationGen !== navigationGenRef.current) {
        return; // Stale navigation, ignore
      }

      const element = document.getElementById(elementId);
      if (!element) {
        // Target not found, fail quietly
        setIsNavigationActive(false);
        return;
      }

      // Check prefers-reduced-motion
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

      // Scroll into view
      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
        block: 'start',
      });

      // Find heading for focus
      const heading = element.querySelector('h2');
      if (heading) {
        // Make heading focusable if needed
        if (!heading.hasAttribute('tabindex')) {
          heading.setAttribute('tabindex', '-1');
        }
        // Focus without additional scroll
        requestAnimationFrame(() => {
          if (navigationGen !== navigationGenRef.current) return;
          heading.focus({ preventScroll: true });
        });
      }

      // Apply highlight class
      element.classList.add('sectionHighlight');

      // Remove highlight after ~2 seconds
      setTimeout(() => {
        if (navigationGen !== navigationGenRef.current) return;
        element.classList.remove('sectionHighlight');
        setIsNavigationActive(false);
      }, 2000);
    },
    [],
  );

  /**
   * Navigate to a coach reference.
   */
  const navigateToReference = useCallback(
    (params: NavigateToReferenceParams) => {
      // reviewedVersion is available for future provenance enhancements but not yet used
      const { reference, originCoachRunId, originArtifact, originSection, reviewedVersion: _reviewedVersion } = params;

      if (!currentArtifactType || !studyPublicId) {
        return;
      }

      const destination = resolveDestination(reference, currentArtifactType);
      if (!destination) {
        return; // Not resolvable
      }

      // Increment navigation generation (last-navigation-wins)
      navigationGenRef.current += 1;
      const currentGen = navigationGenRef.current;

      setIsNavigationActive(true);

      if (destination.isCrossArtifact) {
        // M4B.1: Check comment draft guard before cross-artifact navigation
        // If user has dirty draft and chooses "Stay", cancel navigation
        // Guard will clear draft session if user chooses "Discard and continue"
        if (!confirmNavigation()) {
          // User chose to stay — cancel navigation, preserve all state
          setIsNavigationActive(false);
          return;
        }

        // Cross-artifact navigation: pin coach run and switch artifact
        setPinnedRun({
          runId: originCoachRunId,
          originArtifactType: originArtifact.type,
          originStudyPublicId: originArtifact.studyPublicId,
          originSectionKey: originSection?.sectionKey ?? null,
          originSectionLabel: originSection?.label ?? null,
        });

        // Navigate to target artifact
        const targetPath = `/studies/${studyPublicId}/${destination.artifactType}`;
        navigate(targetPath);

        // Wait for destination to render, then scroll/highlight
        // Use MutationObserver to detect when target element appears
        const observer = new MutationObserver(() => {
          if (currentGen !== navigationGenRef.current) {
            observer.disconnect();
            return;
          }

          const element = document.getElementById(destination.domElementId);
          if (element) {
            observer.disconnect();
            // Small delay to ensure render is complete
            requestAnimationFrame(() => {
              scrollAndHighlight(destination.domElementId, currentGen);
            });
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        // Timeout fallback (if element never appears, fail quietly)
        setTimeout(() => {
          if (currentGen !== navigationGenRef.current) return;
          observer.disconnect();
          setIsNavigationActive(false);
        }, 5000);
      } else {
        // Same-artifact navigation: scroll and highlight immediately
        scrollAndHighlight(destination.domElementId, currentGen);
      }
    },
    [currentArtifactType, studyPublicId, resolveDestination, navigate, scrollAndHighlight, confirmNavigation],
  );

  /**
   * Return to origin artifact after cross-artifact navigation.
   */
  const returnToOrigin = useCallback(() => {
    if (!pinnedRun) return;

    const targetPath = `/studies/${pinnedRun.originStudyPublicId}/${pinnedRun.originArtifactType}`;
    navigate(targetPath);

    // Keep pinned run state so CoachingRail can restore the run
    // State will be cleared when rail closes or user navigates deliberately
  }, [pinnedRun, navigate]);

  /**
   * Clear pinned run state.
   */
  const clearPinnedRun = useCallback(() => {
    setPinnedRun(null);
    setIsNavigationActive(false);
  }, []);

  // Clear pinned state on deliberate navigation (not reference navigation)
  // This detects when user clicks lifecycle rail, artifact tabs, etc.
  const previousPathnameRef = useRef(location.pathname);
  if (location.pathname !== previousPathnameRef.current) {
    previousPathnameRef.current = location.pathname;
    // If we have a pinned run but navigation wasn't triggered by us,
    // clear the pinned state after a brief delay (allows reference nav to complete)
    if (pinnedRun && !isNavigationActive) {
      // Clear on next tick if still not in navigation mode
      setTimeout(() => {
        if (!isNavigationActive) {
          setPinnedRun(null);
        }
      }, 100);
    }
  }

  const value = useMemo<ReferenceNavigationContextValue>(
    () => ({
      pinnedRun,
      navigateToReference,
      returnToOrigin,
      clearPinnedRun,
      isReferenceClickable,
      resolveDestination,
      getReviewedVersionForReference,
      isNavigationActive,
    }),
    [
      pinnedRun,
      navigateToReference,
      returnToOrigin,
      clearPinnedRun,
      isReferenceClickable,
      resolveDestination,
      getReviewedVersionForReference,
      isNavigationActive,
    ],
  );

  return (
    <ReferenceNavigationContext.Provider value={value}>
      {children}
    </ReferenceNavigationContext.Provider>
  );
}
