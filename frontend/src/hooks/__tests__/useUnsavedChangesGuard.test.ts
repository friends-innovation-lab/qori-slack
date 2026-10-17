/**
 * useUnsavedChangesGuard Tests — DR-6b-4d Safeguard #6
 *
 * Verifies unsaved-changes protection for:
 * - In-app navigation blocking (React Router)
 * - Browser back/forward protection
 * - beforeunload handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

// Mock React Router's useBlocker
vi.mock('react-router', () => ({
  useBlocker: vi.fn(),
}));

import { useBlocker } from 'react-router';

describe('Safeguard #6: Unsaved Changes Protection', () => {
  const mockUseBlocker = useBlocker as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock returns no blocker state
    mockUseBlocker.mockReturnValue({
      state: 'unblocked',
      proceed: vi.fn(),
      reset: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Blocker activation', () => {
    it('does not block when isDirty is false', () => {
      renderHook(() => useUnsavedChangesGuard(false));

      // useBlocker should be called with shouldBlock = false
      expect(mockUseBlocker).toHaveBeenCalled();
      const blockerArg = mockUseBlocker.mock.calls[0][0];
      expect(blockerArg).toBe(false);
    });

    it('blocks when isDirty is true', () => {
      renderHook(() => useUnsavedChangesGuard(true));

      // useBlocker should be called with shouldBlock = true
      expect(mockUseBlocker).toHaveBeenCalled();
      const blockerArg = mockUseBlocker.mock.calls[0][0];
      expect(blockerArg).toBe(true);
    });
  });

  describe('Blocker state', () => {
    it('returns isBlocked=false when blocker is unblocked', () => {
      mockUseBlocker.mockReturnValue({
        state: 'unblocked',
        proceed: vi.fn(),
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useUnsavedChangesGuard(true));

      expect(result.current.isBlocked).toBe(false);
    });

    it('returns isBlocked=true when blocker is blocked', () => {
      const mockProceed = vi.fn();
      const mockReset = vi.fn();

      mockUseBlocker.mockReturnValue({
        state: 'blocked',
        proceed: mockProceed,
        reset: mockReset,
      });

      const { result } = renderHook(() => useUnsavedChangesGuard(true));

      expect(result.current.isBlocked).toBe(true);
    });
  });

  describe('Navigation controls', () => {
    it('proceed() calls blocker proceed', () => {
      const mockProceed = vi.fn();
      const mockReset = vi.fn();

      mockUseBlocker.mockReturnValue({
        state: 'blocked',
        proceed: mockProceed,
        reset: mockReset,
      });

      const { result } = renderHook(() => useUnsavedChangesGuard(true));

      act(() => {
        result.current.proceed();
      });

      expect(mockProceed).toHaveBeenCalled();
    });

    it('cancel() calls blocker reset', () => {
      const mockProceed = vi.fn();
      const mockReset = vi.fn();

      mockUseBlocker.mockReturnValue({
        state: 'blocked',
        proceed: mockProceed,
        reset: mockReset,
      });

      const { result } = renderHook(() => useUnsavedChangesGuard(true));

      act(() => {
        result.current.cancel();
      });

      expect(mockReset).toHaveBeenCalled();
    });

    it('proceed() is no-op when not blocked', () => {
      mockUseBlocker.mockReturnValue({
        state: 'unblocked',
        proceed: undefined,
        reset: undefined,
      });

      const { result } = renderHook(() => useUnsavedChangesGuard(true));

      // Should not throw
      expect(() => {
        act(() => {
          result.current.proceed();
        });
      }).not.toThrow();
    });

    it('cancel() is no-op when not blocked', () => {
      mockUseBlocker.mockReturnValue({
        state: 'unblocked',
        proceed: undefined,
        reset: undefined,
      });

      const { result } = renderHook(() => useUnsavedChangesGuard(true));

      // Should not throw
      expect(() => {
        act(() => {
          result.current.cancel();
        });
      }).not.toThrow();
    });
  });

  describe('beforeunload event', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('adds beforeunload listener when isDirty is true', () => {
      renderHook(() => useUnsavedChangesGuard(true));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function),
      );
    });

    it('removes beforeunload listener on unmount', () => {
      const { unmount } = renderHook(() => useUnsavedChangesGuard(true));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function),
      );
    });

    it('beforeunload handler prevents default when isDirty', () => {
      renderHook(() => useUnsavedChangesGuard(true));

      // Get the handler that was registered
      const handler = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'beforeunload',
      )?.[1] as EventListener;

      expect(handler).toBeDefined();

      // Create mock event
      const mockEvent = {
        preventDefault: vi.fn(),
        returnValue: '',
      } as unknown as BeforeUnloadEvent;

      // Call handler
      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      // The hook sets a warning message for legacy browser support
      expect(mockEvent.returnValue).toBe('You have unsaved changes. Are you sure you want to leave?');
    });
  });

  describe('Dynamic isDirty changes', () => {
    it('updates blocker when isDirty changes', () => {
      const { rerender } = renderHook(
        ({ isDirty }) => useUnsavedChangesGuard(isDirty),
        { initialProps: { isDirty: false } },
      );

      // Initially not blocking
      let blockerArg = mockUseBlocker.mock.calls[0][0];
      expect(blockerArg).toBe(false);

      // Change to dirty
      rerender({ isDirty: true });

      // Now should be blocking
      blockerArg = mockUseBlocker.mock.calls[1][0];
      expect(blockerArg).toBe(true);
    });
  });
});
