/**
 * useSavePipeline — State machine for the save/sync pipeline.
 *
 * States: idle → saving → synced (or save_failed / sync_failed)
 * Drives SaveStateIndicator.
 */

import { useState, useCallback } from 'react';

export type SavePipelineState =
  | 'idle'        // No save in progress, document is clean
  | 'dirty'       // Document has unsaved changes
  | 'saving'      // Canonical save in progress
  | 'synced'      // Canonical saved + GitHub synced
  | 'save_failed' // Canonical save failed
  | 'sync_failed'; // Canonical saved but GitHub sync failed

interface SavePipelineResult {
  state: SavePipelineState;
  error: string | null;
  lastSavedAt: string | null;
  githubSynced: boolean;
  setDirty: () => void;
  startSave: () => void;
  completeSave: (result: { canonical_saved: boolean; github_synced: boolean; github_sync_error?: string; updated_at: string }) => void;
  failSave: (error: string) => void;
  reset: () => void;
}

export function useSavePipeline(): SavePipelineResult {
  const [state, setState] = useState<SavePipelineState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [githubSynced, setGithubSynced] = useState(false);

  const setDirty = useCallback(() => {
    setState('dirty');
  }, []);

  const startSave = useCallback(() => {
    setState('saving');
    setError(null);
  }, []);

  const completeSave = useCallback((result: {
    canonical_saved: boolean;
    github_synced: boolean;
    github_sync_error?: string;
    updated_at: string;
  }) => {
    setLastSavedAt(result.updated_at);
    setGithubSynced(result.github_synced);

    if (!result.canonical_saved) {
      setState('save_failed');
      setError('Canonical save failed');
    } else if (!result.github_synced) {
      setState('sync_failed');
      setError(result.github_sync_error || 'GitHub sync failed');
    } else {
      setState('synced');
      setError(null);
      // Settle to idle after a brief display
      setTimeout(() => setState('idle'), 3000);
    }
  }, []);

  const failSave = useCallback((errorMessage: string) => {
    setState('save_failed');
    setError(errorMessage);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    error,
    lastSavedAt,
    githubSynced,
    setDirty,
    startSave,
    completeSave,
    failSave,
    reset,
  };
}
