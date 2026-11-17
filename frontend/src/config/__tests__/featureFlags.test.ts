/**
 * Feature Flags Tests — DISC-WEB-2
 *
 * Tests for the feature flag module.
 *
 * Note: VITE_ENABLE_RESEARCHER_CONTROLLED is evaluated at build time.
 * These tests verify the runtime behavior and test utilities.
 * Environment variable behavior is verified via integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isLiveRunCreationEnabled,
  isResearcherControlledExecutionEnabled,
  isAnyRunCreationEnabled,
  __testSetFlags,
  __testResetFlags,
} from '../featureFlags';

describe('featureFlags', () => {
  afterEach(() => {
    __testResetFlags();
  });

  describe('default state (env var unset in test environment)', () => {
    beforeEach(() => {
      __testResetFlags();
    });

    it('isLiveRunCreationEnabled returns false by default', () => {
      expect(isLiveRunCreationEnabled()).toBe(false);
    });

    it('isResearcherControlledExecutionEnabled returns false when env var is unset', () => {
      // In test environment, VITE_ENABLE_RESEARCHER_CONTROLLED is not set
      // so the default should be false
      expect(isResearcherControlledExecutionEnabled()).toBe(false);
    });

    it('isAnyRunCreationEnabled returns false when both flags are disabled', () => {
      expect(isAnyRunCreationEnabled()).toBe(false);
    });
  });

  describe('__testSetFlags', () => {
    it('enables researcher-controlled execution', () => {
      __testSetFlags({ researcherControlledExecution: true });
      expect(isResearcherControlledExecutionEnabled()).toBe(true);
      expect(isAnyRunCreationEnabled()).toBe(true);
    });

    it('enables live run creation', () => {
      __testSetFlags({ liveRunCreation: true });
      expect(isLiveRunCreationEnabled()).toBe(true);
      expect(isAnyRunCreationEnabled()).toBe(true);
    });

    it('enables both flags independently', () => {
      __testSetFlags({ liveRunCreation: true, researcherControlledExecution: true });
      expect(isLiveRunCreationEnabled()).toBe(true);
      expect(isResearcherControlledExecutionEnabled()).toBe(true);
      expect(isAnyRunCreationEnabled()).toBe(true);
    });

    it('can disable flags after enabling', () => {
      __testSetFlags({ researcherControlledExecution: true });
      expect(isResearcherControlledExecutionEnabled()).toBe(true);

      __testSetFlags({ researcherControlledExecution: false });
      expect(isResearcherControlledExecutionEnabled()).toBe(false);
    });

    it('does not affect other flags when setting one', () => {
      __testSetFlags({ liveRunCreation: true });
      expect(isLiveRunCreationEnabled()).toBe(true);
      expect(isResearcherControlledExecutionEnabled()).toBe(false);

      __testSetFlags({ researcherControlledExecution: true });
      expect(isLiveRunCreationEnabled()).toBe(true);
      expect(isResearcherControlledExecutionEnabled()).toBe(true);
    });
  });

  describe('__testResetFlags', () => {
    it('resets live run creation to false', () => {
      __testSetFlags({ liveRunCreation: true });
      expect(isLiveRunCreationEnabled()).toBe(true);

      __testResetFlags();
      expect(isLiveRunCreationEnabled()).toBe(false);
    });

    it('resets researcher-controlled to env var default (false in test env)', () => {
      __testSetFlags({ researcherControlledExecution: true });
      expect(isResearcherControlledExecutionEnabled()).toBe(true);

      __testResetFlags();
      // In test environment, env var is unset, so default is false
      expect(isResearcherControlledExecutionEnabled()).toBe(false);
    });

    it('resets both flags', () => {
      __testSetFlags({ liveRunCreation: true, researcherControlledExecution: true });
      expect(isAnyRunCreationEnabled()).toBe(true);

      __testResetFlags();
      expect(isAnyRunCreationEnabled()).toBe(false);
    });
  });

  describe('isAnyRunCreationEnabled combinations', () => {
    it('returns true when only researcher-controlled is enabled', () => {
      __testSetFlags({ researcherControlledExecution: true, liveRunCreation: false });
      expect(isAnyRunCreationEnabled()).toBe(true);
    });

    it('returns true when only live run is enabled', () => {
      __testSetFlags({ researcherControlledExecution: false, liveRunCreation: true });
      expect(isAnyRunCreationEnabled()).toBe(true);
    });

    it('returns true when both are enabled', () => {
      __testSetFlags({ researcherControlledExecution: true, liveRunCreation: true });
      expect(isAnyRunCreationEnabled()).toBe(true);
    });

    it('returns false when both are disabled', () => {
      __testSetFlags({ researcherControlledExecution: false, liveRunCreation: false });
      expect(isAnyRunCreationEnabled()).toBe(false);
    });
  });
});
