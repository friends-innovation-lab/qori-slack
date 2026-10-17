/**
 * useUnsavedChangesGuard — Navigation protection for unsaved changes
 *
 * DR-6b-4d: Implements safeguard #5
 * - React Router blocker for in-app navigation and Back button
 * - beforeunload for browser reload/close
 */

import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router';

export interface UnsavedChangesGuardState {
  /** Whether navigation is currently blocked */
  isBlocked: boolean;
  /** Proceed with navigation (discard changes) */
  proceed: () => void;
  /** Cancel navigation (stay on page) */
  cancel: () => void;
}

/**
 * Guard against navigation when there are unsaved changes.
 *
 * @param isDirty - Whether there are unsaved changes
 * @returns Guard state with proceed/cancel actions
 */
export function useUnsavedChangesGuard(isDirty: boolean): UnsavedChangesGuardState {
  // React Router blocker for in-app navigation and Back button
  const blocker = useBlocker(isDirty);

  // Browser beforeunload for reload/close
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show prompt
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const proceed = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);

  const cancel = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  return {
    isBlocked: blocker.state === 'blocked',
    proceed,
    cancel,
  };
}
