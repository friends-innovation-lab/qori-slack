/**
 * useSavePipeline tests — save state machine transitions.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSavePipeline } from '../useSavePipeline';

describe('useSavePipeline', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useSavePipeline());
    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('transitions to dirty', () => {
    const { result } = renderHook(() => useSavePipeline());
    act(() => result.current.setDirty());
    expect(result.current.state).toBe('dirty');
  });

  it('transitions to saving', () => {
    const { result } = renderHook(() => useSavePipeline());
    act(() => result.current.startSave());
    expect(result.current.state).toBe('saving');
  });

  it('transitions to synced on success', () => {
    const { result } = renderHook(() => useSavePipeline());
    act(() => result.current.startSave());
    act(() => result.current.completeSave({
      canonical_saved: true,
      github_synced: true,
      updated_at: '2026-09-11T00:00:00Z',
    }));
    expect(result.current.state).toBe('synced');
    expect(result.current.lastSavedAt).toBe('2026-09-11T00:00:00Z');
    expect(result.current.githubSynced).toBe(true);
  });

  it('transitions to save_failed on canonical failure', () => {
    const { result } = renderHook(() => useSavePipeline());
    act(() => result.current.startSave());
    act(() => result.current.completeSave({
      canonical_saved: false,
      github_synced: false,
      updated_at: '',
    }));
    expect(result.current.state).toBe('save_failed');
  });

  it('transitions to sync_failed on projection failure', () => {
    const { result } = renderHook(() => useSavePipeline());
    act(() => result.current.startSave());
    act(() => result.current.completeSave({
      canonical_saved: true,
      github_synced: false,
      github_sync_error: 'GitHub 500',
      updated_at: '2026-09-11T00:00:00Z',
    }));
    expect(result.current.state).toBe('sync_failed');
    expect(result.current.error).toBe('GitHub 500');
    // Canonical state is still saved
    expect(result.current.lastSavedAt).toBe('2026-09-11T00:00:00Z');
  });

  it('failSave sets error', () => {
    const { result } = renderHook(() => useSavePipeline());
    act(() => result.current.failSave('Network error'));
    expect(result.current.state).toBe('save_failed');
    expect(result.current.error).toBe('Network error');
  });

  it('reset returns to idle', () => {
    const { result } = renderHook(() => useSavePipeline());
    act(() => result.current.failSave('Error'));
    act(() => result.current.reset());
    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
