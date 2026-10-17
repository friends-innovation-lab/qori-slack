/**
 * useReadoutEditor — Local state management for readout draft editing
 *
 * DR-6b-4d: Implements safeguards #1, #2, #3, #4, #9
 *
 * Key behaviors:
 * - Scopes state to (projectPublicId, studyPublicId, readoutPublicId)
 * - Tracks edit sequence to prevent overwriting newer local edits with older server response
 * - Preserves content and review-state arrays on 409 conflicts
 * - Clears stale Checked/Reviewed states on affected items after save
 * - Prevents background refetches from overwriting unsaved work
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { DraftContent, DraftDetail, SaveDraftResponse } from '@/api/readouts';

export interface EditorState {
  /** Local content being edited */
  content: DraftContent;
  /** IDs of findings marked as checked */
  findingsChecked: string[];
  /** IDs of implications marked as reviewed */
  implicationsReviewed: string[];
}

export interface ConflictState {
  /** User's submitted content that was rejected */
  submittedContent: DraftContent;
  /** User's submitted findingsChecked */
  submittedFindingsChecked: string[];
  /** User's submitted implicationsReviewed */
  submittedImplicationsReviewed: string[];
  /** Server's current version number */
  serverVersion: number;
  /** Server's current content (fetched after 409) */
  serverContent: DraftContent | null;
  /** Server's current findingsChecked */
  serverFindingsChecked: string[];
  /** Server's current implicationsReviewed */
  serverImplicationsReviewed: string[];
}

export interface UseReadoutEditorResult {
  /** Current editor state */
  editorState: EditorState;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Server's confirmed content version */
  serverVersion: number;
  /** Whether editor is initialized */
  isInitialized: boolean;
  /** Conflict state when 409 occurred */
  conflictState: ConflictState | null;

  /** Update content (marks dirty) */
  updateContent: (content: DraftContent) => void;
  /** Toggle finding checked state */
  toggleFindingChecked: (findingId: string) => void;
  /** Toggle implication reviewed state */
  toggleImplicationReviewed: (implicationId: string) => void;
  /** Get content for save request */
  getContentForSave: () => { content: DraftContent; findingsChecked: string[]; implicationsReviewed: string[] };

  /** Handle successful save response */
  onSaveSuccess: (response: SaveDraftResponse['data']) => void;
  /** Handle 409 conflict - preserves local state, stores conflict info */
  onConflict: (currentVersion: number, submittedContent: DraftContent) => void;
  /** Set server state for conflict comparison (after fetching latest) */
  setServerStateForComparison: (draft: DraftDetail) => void;
  /** Resolve conflict by accepting reconciled content */
  resolveConflict: (reconciledState: EditorState) => void;
  /** Discard local changes and reset to server state */
  discardChanges: () => void;
  /** Clear conflict state and continue editing user's version */
  continueEditing: () => void;
}

interface EditorKey {
  projectPublicId: string;
  studyPublicId: string;
  readoutPublicId: string;
}

/**
 * Hook for managing readout editor state with all DR-6b-4d safeguards.
 */
export function useReadoutEditor(
  key: EditorKey,
  serverDraft: DraftDetail | undefined,
): UseReadoutEditorResult {
  // Safeguard #1: Scope state to (project, study, readout)
  const keyString = useMemo(
    () => `${key.projectPublicId}:${key.studyPublicId}:${key.readoutPublicId}`,
    [key.projectPublicId, key.studyPublicId, key.readoutPublicId],
  );

  // Editor state
  const [editorState, setEditorState] = useState<EditorState>({
    content: {},
    findingsChecked: [],
    implicationsReviewed: [],
  });
  const [serverVersion, setServerVersion] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  // Safeguard #2: Track edit sequence to detect edits during in-flight saves
  const editSequence = useRef(0);
  const lastAppliedSequence = useRef(0);

  // Safeguard #9: Track whether we have local edits to prevent background refetch overwrites
  // Using state (not ref) so changes trigger isDirty recomputation
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  // Track current key to detect key changes
  const currentKey = useRef(keyString);

  // Reset state when key changes (different readout)
  useEffect(() => {
    if (currentKey.current !== keyString) {
      currentKey.current = keyString;
      setEditorState({ content: {}, findingsChecked: [], implicationsReviewed: [] });
      setServerVersion(0);
      setIsInitialized(false);
      setConflictState(null);
      setHasLocalEdits(false);
      editSequence.current = 0;
      lastAppliedSequence.current = 0;
    }
  }, [keyString]);

  // Initialize from server ONLY when:
  // 1. Not yet initialized
  // 2. No local edits (safeguard #9)
  // 3. No active conflict
  useEffect(() => {
    if (!serverDraft) return;
    if (hasLocalEdits) return;
    if (conflictState !== null) return;

    setEditorState({
      content: serverDraft.content,
      findingsChecked: serverDraft.findingsChecked,
      implicationsReviewed: serverDraft.implicationsReviewed,
    });
    setServerVersion(serverDraft.contentVersion);
    setIsInitialized(true);
  }, [serverDraft, conflictState, hasLocalEdits]);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!isInitialized) return false;
    return hasLocalEdits;
  }, [isInitialized, hasLocalEdits]);

  // Update content (marks dirty, increments edit sequence)
  const updateContent = useCallback((content: DraftContent) => {
    editSequence.current += 1;
    setHasLocalEdits(true);
    setEditorState((prev) => ({ ...prev, content }));
  }, []);

  // Toggle finding checked state
  const toggleFindingChecked = useCallback((findingId: string) => {
    editSequence.current += 1;
    setHasLocalEdits(true);
    setEditorState((prev) => {
      const isChecked = prev.findingsChecked.includes(findingId);
      return {
        ...prev,
        findingsChecked: isChecked
          ? prev.findingsChecked.filter((id) => id !== findingId)
          : [...prev.findingsChecked, findingId],
      };
    });
  }, []);

  // Toggle implication reviewed state
  const toggleImplicationReviewed = useCallback((implicationId: string) => {
    editSequence.current += 1;
    setHasLocalEdits(true);
    setEditorState((prev) => {
      const isReviewed = prev.implicationsReviewed.includes(implicationId);
      return {
        ...prev,
        implicationsReviewed: isReviewed
          ? prev.implicationsReviewed.filter((id) => id !== implicationId)
          : [...prev.implicationsReviewed, implicationId],
      };
    });
  }, []);

  // Get content for save request
  const getContentForSave = useCallback(() => {
    return {
      content: editorState.content,
      findingsChecked: editorState.findingsChecked,
      implicationsReviewed: editorState.implicationsReviewed,
    };
  }, [editorState]);

  // Handle successful save response
  // Safeguard #2: Only apply if no newer edits occurred during save
  // Safeguard #4: Clear stale Checked/Reviewed on invalidated items
  const onSaveSuccess = useCallback((response: SaveDraftResponse['data']) => {
    const saveSequence = editSequence.current;

    // If user edited during save, keep editor dirty but update server version
    if (saveSequence > lastAppliedSequence.current) {
      // User made edits during save - don't overwrite their content
      // But DO update server version and apply invalidations
      setServerVersion(response.draft.contentVersion);

      // Apply invalidations to current local state
      if (response.invalidatedFindings.length > 0 || response.invalidatedImplications.length > 0) {
        setEditorState((prev) => ({
          ...prev,
          findingsChecked: prev.findingsChecked.filter(
            (id) => !response.invalidatedFindings.includes(id),
          ),
          implicationsReviewed: prev.implicationsReviewed.filter(
            (id) => !response.invalidatedImplications.includes(id),
          ),
        }));
      }

      // Check if there are actually newer edits vs what was just saved
      // If the current content matches what was saved, clear dirty flag
      if (
        JSON.stringify(editorState.content) === JSON.stringify(response.draft.content) &&
        arraysEqual(editorState.findingsChecked, response.draft.findingsChecked) &&
        arraysEqual(editorState.implicationsReviewed, response.draft.implicationsReviewed)
      ) {
        setHasLocalEdits(false);
      }
    } else {
      // No edits during save - apply server response fully
      setEditorState({
        content: response.draft.content,
        findingsChecked: response.draft.findingsChecked,
        implicationsReviewed: response.draft.implicationsReviewed,
      });
      setServerVersion(response.draft.contentVersion);
      setHasLocalEdits(false);
    }

    lastAppliedSequence.current = editSequence.current;
    setConflictState(null);
  }, [editorState]);

  // Handle 409 conflict
  // Safeguard #3: Preserve content, findingsChecked, implicationsReviewed
  const onConflict = useCallback(
    (currentVersion: number, submittedContent: DraftContent) => {
      setConflictState({
        submittedContent,
        submittedFindingsChecked: [...editorState.findingsChecked],
        submittedImplicationsReviewed: [...editorState.implicationsReviewed],
        serverVersion: currentVersion,
        serverContent: null,
        serverFindingsChecked: [],
        serverImplicationsReviewed: [],
      });
    },
    [editorState.findingsChecked, editorState.implicationsReviewed],
  );

  // Set server state for conflict comparison (after fetching latest)
  const setServerStateForComparison = useCallback((draft: DraftDetail) => {
    setConflictState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        serverContent: draft.content,
        serverFindingsChecked: draft.findingsChecked,
        serverImplicationsReviewed: draft.implicationsReviewed,
        serverVersion: draft.contentVersion,
      };
    });
    setServerVersion(draft.contentVersion);
  }, []);

  // Resolve conflict by accepting reconciled content
  // Safeguard #4: Caller is responsible for clearing stale review states
  const resolveConflict = useCallback((reconciledState: EditorState) => {
    editSequence.current += 1;
    setHasLocalEdits(true);
    setEditorState(reconciledState);
    setConflictState(null);
  }, []);

  // Discard local changes and reset to server state
  const discardChanges = useCallback(() => {
    if (conflictState?.serverContent) {
      setEditorState({
        content: conflictState.serverContent,
        findingsChecked: conflictState.serverFindingsChecked,
        implicationsReviewed: conflictState.serverImplicationsReviewed,
      });
    } else if (serverDraft) {
      setEditorState({
        content: serverDraft.content,
        findingsChecked: serverDraft.findingsChecked,
        implicationsReviewed: serverDraft.implicationsReviewed,
      });
    }
    setHasLocalEdits(false);
    editSequence.current += 1;
    lastAppliedSequence.current = editSequence.current;
    setConflictState(null);
  }, [conflictState, serverDraft]);

  // Clear conflict state and continue editing user's version
  const continueEditing = useCallback(() => {
    // Keep user's submitted content as local state
    if (conflictState) {
      setEditorState({
        content: conflictState.submittedContent,
        findingsChecked: conflictState.submittedFindingsChecked,
        implicationsReviewed: conflictState.submittedImplicationsReviewed,
      });
    }
    setConflictState(null);
  }, [conflictState]);

  return {
    editorState,
    isDirty,
    serverVersion,
    isInitialized,
    conflictState,
    updateContent,
    toggleFindingChecked,
    toggleImplicationReviewed,
    getContentForSave,
    onSaveSuccess,
    onConflict,
    setServerStateForComparison,
    resolveConflict,
    discardChanges,
    continueEditing,
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}
