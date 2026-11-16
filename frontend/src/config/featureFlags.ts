/**
 * Feature Flags — DISC-WEB-2
 *
 * Centralized feature flag module for testability.
 *
 * These flags are UI-only safety gates. Backend authorization gates
 * (DISC_WEB1_ENABLED, DISC_WEB2_RESEARCHER_ENABLED) remain authoritative.
 *
 * IMPORTANT: Both flags MUST be false in deployed code.
 * DO NOT set to true without explicit architecture approval.
 *
 * To test features with flags enabled:
 * - Mock this module in tests: vi.mock('@/config/featureFlags')
 * - Set the desired flag values in your mock
 */

// ─── Flag Definitions ────────────────────────────────────────────────

/**
 * DISC-WEB-1C-2b: Enable standard run creation via POST /runs.
 *
 * When false: Start Analysis button shows "Coming soon" and no API call is made.
 * When true: Full flow is exercised (tests only).
 *
 * This is separate from DISC_WEB1_ENABLED backend flag — double protection.
 */
let _enableLiveRunCreation = false;

/**
 * DISC-WEB-2: Enable researcher-controlled execution via POST /controlled-runs.
 *
 * When true: Start Analysis uses researcher-controlled path with server-side budget.
 * When false: Falls through to standard path check (ENABLE_LIVE_RUN_CREATION).
 *
 * This flag is INDEPENDENT of ENABLE_LIVE_RUN_CREATION:
 * - Both false: "Coming soon" UI
 * - Researcher true, Live false: Researcher-controlled path only
 * - Researcher false, Live true: Standard path only
 * - Both true: Researcher-controlled path (takes precedence)
 *
 * Backend authorization (DISC_WEB2_RESEARCHER_ENABLED) remains authoritative.
 */
let _enableResearcherControlledExecution = false;

// ─── Getters (for testability) ───────────────────────────────────────

/**
 * Check if live run creation is enabled.
 * Tests can mock this function to return true.
 */
export function isLiveRunCreationEnabled(): boolean {
  return _enableLiveRunCreation;
}

/**
 * Check if researcher-controlled execution is enabled.
 * Tests can mock this function to return true.
 */
export function isResearcherControlledExecutionEnabled(): boolean {
  return _enableResearcherControlledExecution;
}

/**
 * Check if any run creation is enabled (either path).
 * Used for button enable/disable logic.
 */
export function isAnyRunCreationEnabled(): boolean {
  return _enableLiveRunCreation || _enableResearcherControlledExecution;
}

// ─── Test Utilities ──────────────────────────────────────────────────

/**
 * Override flags for testing. ONLY use in test code.
 * @internal
 */
export function __testSetFlags(flags: {
  liveRunCreation?: boolean;
  researcherControlledExecution?: boolean;
}): void {
  if (flags.liveRunCreation !== undefined) {
    _enableLiveRunCreation = flags.liveRunCreation;
  }
  if (flags.researcherControlledExecution !== undefined) {
    _enableResearcherControlledExecution = flags.researcherControlledExecution;
  }
}

/**
 * Reset flags to production defaults. ONLY use in test cleanup.
 * @internal
 */
export function __testResetFlags(): void {
  _enableLiveRunCreation = false;
  _enableResearcherControlledExecution = false;
}
