/**
 * useReadoutEditor Tests — DR-6b-4d Architecture Safeguards
 *
 * Verifies all eight safeguards specified in DR-6b-4d:
 * 1. Project/study/readout state isolation
 * 2. Edits made while Save is in flight
 * 3. HTTP 409 conflict recovery and repeated conflicts
 * 4. Preservation of content and both review-state arrays
 * 5. Checked/Reviewed invalidation after changes
 * 6. Unsaved-changes protection (tested via useUnsavedChangesGuard)
 * 7. Background refreshes not overwriting local edits
 * 8. Incomplete draft saves and citation pinning
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadoutEditor } from '../useReadoutEditor';
import type { DraftDetail, DraftContent } from '@/api/readouts';

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

function createMockDraft(overrides: Partial<DraftDetail> = {}): DraftDetail {
  return {
    content: {
      summary: { text: 'Test summary' },
      findings: [
        { id: 'f1', text: 'Finding 1', citations: [] },
        { id: 'f2', text: 'Finding 2', citations: [] },
      ],
      limitations: [{ id: 'l1', text: 'Limitation 1' }],
      implications: [
        {
          id: 'i1',
          kind: 'question',
          text: 'Implication 1',
          basedOnFindings: ['f1'],
        },
      ],
    },
    findingsChecked: ['f1'],
    implicationsReviewed: ['i1'],
    contentVersion: 1,
    lastEditedAt: '2024-01-01T00:00:00Z',
    lastEditedByActorId: 1,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARD #1: Project/study/readout state isolation
// ═══════════════════════════════════════════════════════════════════════════

describe('Safeguard #1: State Isolation', () => {
  it('resets state when key changes to different readout', () => {
    const draft1 = createMockDraft({ contentVersion: 1 });
    const draft2 = createMockDraft({
      contentVersion: 2,
      content: { summary: { text: 'Different summary' } },
    });

    const { result, rerender } = renderHook(
      ({ key, draft }) => useReadoutEditor(key, draft),
      {
        initialProps: {
          key: { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
          draft: draft1,
        },
      },
    );

    // Initial state from draft1
    expect(result.current.editorState.content.summary?.text).toBe('Test summary');
    expect(result.current.serverVersion).toBe(1);

    // Change to different readout
    rerender({
      key: { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r2' },
      draft: draft2,
    });

    // State should reset and load from draft2
    expect(result.current.editorState.content.summary?.text).toBe('Different summary');
    expect(result.current.serverVersion).toBe(2);
  });

  it('resets state when study changes', () => {
    const draft1 = createMockDraft({ contentVersion: 1 });

    const { result, rerender } = renderHook(
      ({ key, draft }: { key: { projectPublicId: string; studyPublicId: string; readoutPublicId: string }; draft: DraftDetail | undefined }) => useReadoutEditor(key, draft),
      {
        initialProps: {
          key: { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
          draft: draft1 as DraftDetail | undefined,
        },
      },
    );

    // Make local edit
    act(() => {
      result.current.updateContent({ summary: { text: 'Local edit' } });
    });
    expect(result.current.isDirty).toBe(true);

    // Change study
    rerender({
      key: { projectPublicId: 'p1', studyPublicId: 's2', readoutPublicId: 'r1' },
      draft: undefined,
    });

    // State should reset
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isInitialized).toBe(false);
  });

  it('resets state when project changes', () => {
    const draft1 = createMockDraft({ contentVersion: 1 });

    const { result, rerender } = renderHook(
      ({ key, draft }: { key: { projectPublicId: string; studyPublicId: string; readoutPublicId: string }; draft: DraftDetail | undefined }) => useReadoutEditor(key, draft),
      {
        initialProps: {
          key: { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
          draft: draft1 as DraftDetail | undefined,
        },
      },
    );

    // Make local edit
    act(() => {
      result.current.updateContent({ summary: { text: 'Local edit' } });
    });
    expect(result.current.isDirty).toBe(true);

    // Change project
    rerender({
      key: { projectPublicId: 'p2', studyPublicId: 's1', readoutPublicId: 'r1' },
      draft: undefined,
    });

    // State should reset
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isInitialized).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARD #2: Edits made while Save is in flight
// ═══════════════════════════════════════════════════════════════════════════

describe('Safeguard #2: Edits During Save', () => {
  it('preserves edits made during save and keeps dirty flag', () => {
    const draft = createMockDraft({ contentVersion: 1 });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Initial state
    expect(result.current.isInitialized).toBe(true);

    // Simulate user edits before save starts
    act(() => {
      result.current.updateContent({ summary: { text: 'Edit 1' } });
    });

    // Simulate save starting (we'd call getContentForSave here)
    const saveContent = result.current.getContentForSave();
    expect(saveContent.content.summary?.text).toBe('Edit 1');

    // Simulate user making MORE edits while save is in flight
    act(() => {
      result.current.updateContent({ summary: { text: 'Edit 2 during save' } });
    });

    // Simulate save completing with the saved content (Edit 1)
    const saveResponse = {
      draft: {
        content: { summary: { text: 'Edit 1' } },
        findingsChecked: [],
        implicationsReviewed: [],
        contentVersion: 2,
        lastEditedAt: '2024-01-01T00:01:00Z',
        lastEditedByActorId: 1,
      },
      invalidatedFindings: [],
      invalidatedImplications: [],
    };

    act(() => {
      result.current.onSaveSuccess(saveResponse);
    });

    // Edit 2 should be preserved (not overwritten by save response)
    expect(result.current.editorState.content.summary?.text).toBe('Edit 2 during save');
    // Server version should be updated
    expect(result.current.serverVersion).toBe(2);
  });

  it('clears dirty flag when no edits during save', () => {
    const draft = createMockDraft({ contentVersion: 1 });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Make edit - only update summary to keep other arrays matching
    const newContent = {
      ...draft.content,
      summary: { text: 'Saved edit' },
    };
    act(() => {
      result.current.updateContent(newContent);
    });
    expect(result.current.isDirty).toBe(true);

    // Save completes with same content and same review states
    const saveResponse = {
      draft: {
        content: newContent,
        findingsChecked: draft.findingsChecked,
        implicationsReviewed: draft.implicationsReviewed,
        contentVersion: 2,
        lastEditedAt: '2024-01-01T00:01:00Z',
        lastEditedByActorId: 1,
      },
      invalidatedFindings: [],
      invalidatedImplications: [],
    };

    act(() => {
      result.current.onSaveSuccess(saveResponse);
    });

    // Dirty flag should be cleared since content matches
    expect(result.current.isDirty).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARD #3: HTTP 409 conflict recovery and repeated conflicts
// ═══════════════════════════════════════════════════════════════════════════

describe('Safeguard #3: Conflict Recovery', () => {
  it('preserves submitted content on 409 conflict', () => {
    // Start with empty checked/reviewed arrays
    const draft = createMockDraft({
      contentVersion: 1,
      findingsChecked: [],
      implicationsReviewed: [],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Make edits: update content and add checks
    act(() => {
      result.current.updateContent({ summary: { text: 'My edit' } });
      result.current.toggleFindingChecked('f1'); // Add f1 to checked
      result.current.toggleImplicationReviewed('i1'); // Add i1 to reviewed
    });

    // Verify edits were applied
    expect(result.current.editorState.findingsChecked).toContain('f1');
    expect(result.current.editorState.implicationsReviewed).toContain('i1');

    const submittedContent: DraftContent = { summary: { text: 'My edit' } };

    // Simulate 409 conflict
    act(() => {
      result.current.onConflict(3, submittedContent);
    });

    // Conflict state should be set with submitted content and review states preserved
    expect(result.current.conflictState).not.toBeNull();
    expect(result.current.conflictState?.submittedContent.summary?.text).toBe('My edit');
    expect(result.current.conflictState?.serverVersion).toBe(3);
    expect(result.current.conflictState?.submittedFindingsChecked).toContain('f1');
    expect(result.current.conflictState?.submittedImplicationsReviewed).toContain('i1');
  });

  it('stores server state for comparison after fetching', () => {
    const draft = createMockDraft({ contentVersion: 1 });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Trigger conflict
    act(() => {
      result.current.onConflict(3, { summary: { text: 'My edit' } });
    });

    // Simulate fetching fresh server state
    const serverDraft = createMockDraft({
      contentVersion: 3,
      content: { summary: { text: 'Server version' } },
      findingsChecked: ['f2'],
      implicationsReviewed: [],
    });

    act(() => {
      result.current.setServerStateForComparison(serverDraft);
    });

    // Server state should be available for comparison
    expect(result.current.conflictState?.serverContent?.summary?.text).toBe('Server version');
    expect(result.current.conflictState?.serverFindingsChecked).toContain('f2');
    expect(result.current.serverVersion).toBe(3);
  });

  it('allows resolving conflict with reconciled content', () => {
    const draft = createMockDraft({ contentVersion: 1 });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Trigger conflict
    act(() => {
      result.current.onConflict(3, { summary: { text: 'My edit' } });
    });

    expect(result.current.conflictState).not.toBeNull();

    // Resolve with reconciled content
    act(() => {
      result.current.resolveConflict({
        content: { summary: { text: 'Reconciled edit' } },
        findingsChecked: ['f1', 'f2'],
        implicationsReviewed: ['i1'],
      });
    });

    // Conflict should be cleared
    expect(result.current.conflictState).toBeNull();
    // Reconciled content should be in editor
    expect(result.current.editorState.content.summary?.text).toBe('Reconciled edit');
    expect(result.current.editorState.findingsChecked).toEqual(['f1', 'f2']);
    // Should still be dirty
    expect(result.current.isDirty).toBe(true);
  });

  it('allows discarding changes on conflict without server comparison', () => {
    // Test discarding without setServerStateForComparison - falls back to serverDraft
    const draft = createMockDraft({ contentVersion: 1 });

    const { result, rerender } = renderHook(
      ({ d }) =>
        useReadoutEditor(
          { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
          d,
        ),
      { initialProps: { d: draft } },
    );

    // Make edit
    act(() => {
      result.current.updateContent({ summary: { text: 'My edit' } });
    });

    // Trigger conflict
    act(() => {
      result.current.onConflict(3, { summary: { text: 'My edit' } });
    });

    // Simulate server returning updated draft
    const updatedDraft = createMockDraft({
      contentVersion: 3,
      content: { summary: { text: 'Server version' } },
    });
    rerender({ d: updatedDraft });

    // Discard changes - falls back to serverDraft
    act(() => {
      result.current.discardChanges();
    });

    // Conflict should be cleared
    expect(result.current.conflictState).toBeNull();
    // Should not be dirty
    expect(result.current.isDirty).toBe(false);
    // Content should have server version (from serverDraft fallback)
    expect(result.current.editorState.content.summary?.text).toBe('Server version');
  });

  it('allows discarding changes with server comparison state', () => {
    // Test discarding with setServerStateForComparison
    const draft = createMockDraft({ contentVersion: 1 });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Make edit
    act(() => {
      result.current.updateContent({ summary: { text: 'My edit' } });
    });

    // Trigger conflict and set server state in one action
    const serverDraft = createMockDraft({
      contentVersion: 3,
      content: { summary: { text: 'Server version' } },
    });

    act(() => {
      result.current.onConflict(3, { summary: { text: 'My edit' } });
      result.current.setServerStateForComparison(serverDraft);
    });

    // Wait for state to update, then discard
    act(() => {
      result.current.discardChanges();
    });

    // Conflict should be cleared
    expect(result.current.conflictState).toBeNull();
    // Should not be dirty
    expect(result.current.isDirty).toBe(false);
  });

  it('allows continuing to edit user version on conflict', () => {
    const draft = createMockDraft({ contentVersion: 1 });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Make edits first
    const editedContent: DraftContent = {
      summary: { text: 'My edit' },
      findings: draft.content.findings,
    };
    act(() => {
      result.current.updateContent(editedContent);
    });

    // Trigger conflict with the user's edited content
    act(() => {
      result.current.onConflict(3, editedContent);
    });

    expect(result.current.conflictState?.submittedContent.summary?.text).toBe('My edit');

    // Continue editing
    act(() => {
      result.current.continueEditing();
    });

    // Should keep user's submitted content
    expect(result.current.editorState.content.summary?.text).toBe('My edit');
    // Conflict should be cleared
    expect(result.current.conflictState).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARD #4: Preservation of content and review-state arrays
// ═══════════════════════════════════════════════════════════════════════════

describe('Safeguard #4: Content and Review State Preservation', () => {
  it('preserves findingsChecked array on conflict', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      findingsChecked: ['f1'],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Add another checked finding
    act(() => {
      result.current.toggleFindingChecked('f2');
    });

    expect(result.current.editorState.findingsChecked).toContain('f1');
    expect(result.current.editorState.findingsChecked).toContain('f2');

    // Trigger conflict
    act(() => {
      result.current.onConflict(3, result.current.editorState.content);
    });

    // Both findings should be preserved in conflict state
    expect(result.current.conflictState?.submittedFindingsChecked).toContain('f1');
    expect(result.current.conflictState?.submittedFindingsChecked).toContain('f2');
  });

  it('preserves implicationsReviewed array on conflict', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      implicationsReviewed: ['i1'],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Trigger conflict
    act(() => {
      result.current.onConflict(3, result.current.editorState.content);
    });

    // Implication should be preserved
    expect(result.current.conflictState?.submittedImplicationsReviewed).toContain('i1');
  });

  it('toggles finding checked state correctly', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      findingsChecked: ['f1'],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Toggle off f1
    act(() => {
      result.current.toggleFindingChecked('f1');
    });
    expect(result.current.editorState.findingsChecked).not.toContain('f1');

    // Toggle on f2
    act(() => {
      result.current.toggleFindingChecked('f2');
    });
    expect(result.current.editorState.findingsChecked).toContain('f2');
  });

  it('toggles implication reviewed state correctly', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      implicationsReviewed: ['i1'],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Toggle off i1
    act(() => {
      result.current.toggleImplicationReviewed('i1');
    });
    expect(result.current.editorState.implicationsReviewed).not.toContain('i1');

    // Toggle on i2 (assuming it exists)
    act(() => {
      result.current.toggleImplicationReviewed('i2');
    });
    expect(result.current.editorState.implicationsReviewed).toContain('i2');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARD #5: Checked/Reviewed invalidation after changes
// ═══════════════════════════════════════════════════════════════════════════

describe('Safeguard #5: Invalidation After Changes', () => {
  it('clears invalidated findings from checked state', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      findingsChecked: ['f1', 'f2'],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Verify initial state
    expect(result.current.editorState.findingsChecked).toEqual(['f1', 'f2']);

    // Save response with f1 invalidated
    const saveResponse = {
      draft: {
        content: draft.content,
        findingsChecked: ['f2'], // f1 removed
        implicationsReviewed: [],
        contentVersion: 2,
        lastEditedAt: '2024-01-01T00:01:00Z',
        lastEditedByActorId: 1,
      },
      invalidatedFindings: ['f1'],
      invalidatedImplications: [],
    };

    act(() => {
      result.current.onSaveSuccess(saveResponse);
    });

    // f1 should be removed from checked state
    expect(result.current.editorState.findingsChecked).not.toContain('f1');
    expect(result.current.editorState.findingsChecked).toContain('f2');
  });

  it('clears invalidated implications from reviewed state', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      implicationsReviewed: ['i1', 'i2'],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Verify initial state
    expect(result.current.editorState.implicationsReviewed).toEqual(['i1', 'i2']);

    // Save response with i1 invalidated
    const saveResponse = {
      draft: {
        content: draft.content,
        findingsChecked: [],
        implicationsReviewed: ['i2'], // i1 removed
        contentVersion: 2,
        lastEditedAt: '2024-01-01T00:01:00Z',
        lastEditedByActorId: 1,
      },
      invalidatedFindings: [],
      invalidatedImplications: ['i1'],
    };

    act(() => {
      result.current.onSaveSuccess(saveResponse);
    });

    // i1 should be removed from reviewed state
    expect(result.current.editorState.implicationsReviewed).not.toContain('i1');
    expect(result.current.editorState.implicationsReviewed).toContain('i2');
  });

  it('applies invalidations even when user edited during save', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      findingsChecked: ['f1', 'f2'],
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Make edit before save
    act(() => {
      result.current.updateContent({ summary: { text: 'Edit 1' } });
    });

    // Simulate user making MORE edits while save is in flight
    act(() => {
      result.current.updateContent({ summary: { text: 'Edit 2' } });
    });

    // Save completes with invalidation
    const saveResponse = {
      draft: {
        content: { summary: { text: 'Edit 1' } },
        findingsChecked: ['f2'],
        implicationsReviewed: [],
        contentVersion: 2,
        lastEditedAt: '2024-01-01T00:01:00Z',
        lastEditedByActorId: 1,
      },
      invalidatedFindings: ['f1'],
      invalidatedImplications: [],
    };

    act(() => {
      result.current.onSaveSuccess(saveResponse);
    });

    // Edit 2 should be preserved
    expect(result.current.editorState.content.summary?.text).toBe('Edit 2');
    // But invalidation should still be applied
    expect(result.current.editorState.findingsChecked).not.toContain('f1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARD #7: Background refreshes not overwriting local edits
// ═══════════════════════════════════════════════════════════════════════════

describe('Safeguard #7: Background Refresh Protection', () => {
  it('does not overwrite local edits when server draft updates', () => {
    const draft1 = createMockDraft({ contentVersion: 1 });

    const { result, rerender } = renderHook(
      ({ draft }) =>
        useReadoutEditor(
          { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
          draft,
        ),
      { initialProps: { draft: draft1 } },
    );

    // Make local edit
    act(() => {
      result.current.updateContent({ summary: { text: 'Local edit' } });
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.editorState.content.summary?.text).toBe('Local edit');

    // Simulate background refetch returning different content
    const draft2 = createMockDraft({
      contentVersion: 2,
      content: { summary: { text: 'Background refresh content' } },
    });

    rerender({ draft: draft2 });

    // Local edit should be preserved, NOT overwritten
    expect(result.current.editorState.content.summary?.text).toBe('Local edit');
    expect(result.current.isDirty).toBe(true);
  });

  it('does not overwrite during active conflict', () => {
    const draft1 = createMockDraft({ contentVersion: 1 });

    const { result, rerender } = renderHook(
      ({ draft }) =>
        useReadoutEditor(
          { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
          draft,
        ),
      { initialProps: { draft: draft1 } },
    );

    // Trigger conflict
    act(() => {
      result.current.onConflict(3, { summary: { text: 'My conflicted edit' } });
    });

    expect(result.current.conflictState).not.toBeNull();

    // Simulate background refetch
    const draft2 = createMockDraft({
      contentVersion: 3,
      content: { summary: { text: 'Background refresh' } },
    });

    rerender({ draft: draft2 });

    // Conflict state should still be present
    expect(result.current.conflictState).not.toBeNull();
    expect(result.current.conflictState?.submittedContent.summary?.text).toBe(
      'My conflicted edit',
    );
  });

  it('initializes from server when no local edits', () => {
    const { result, rerender } = renderHook(
      ({ draft }) =>
        useReadoutEditor(
          { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
          draft,
        ),
      { initialProps: { draft: undefined as DraftDetail | undefined } },
    );

    // Initially not initialized
    expect(result.current.isInitialized).toBe(false);

    // Server draft arrives
    const draft = createMockDraft({ contentVersion: 1 });
    rerender({ draft });

    // Should initialize from server
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.editorState.content.summary?.text).toBe('Test summary');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARD #8: Incomplete draft saves and citation pinning
// ═══════════════════════════════════════════════════════════════════════════

describe('Safeguard #8: Incomplete Draft Saves', () => {
  it('allows saving content with empty citations', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      content: {
        findings: [{ id: 'f1', text: 'Finding without citations', citations: [] }],
      },
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // getContentForSave should return content even with empty citations
    const saveContent = result.current.getContentForSave();
    expect(saveContent.content.findings?.[0].citations).toEqual([]);
  });

  it('allows saving content with unchecked findings', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      findingsChecked: [], // No findings checked
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // getContentForSave should work without checked findings
    const saveContent = result.current.getContentForSave();
    expect(saveContent.findingsChecked).toEqual([]);
  });

  it('allows saving content with unreviewed implications', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      implicationsReviewed: [], // No implications reviewed
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // getContentForSave should work without reviewed implications
    const saveContent = result.current.getContentForSave();
    expect(saveContent.implicationsReviewed).toEqual([]);
  });

  it('preserves citations through content updates', () => {
    const draft = createMockDraft({
      contentVersion: 1,
      content: {
        findings: [
          {
            id: 'f1',
            text: 'Finding with citation',
            citations: [
              {
                constructPublicId: 'c1',
                revisionPublicId: 'r1',
                revisionNumber: 1,
                displayId: 'IN-0001',
              },
            ],
          },
        ],
      },
    });

    const { result } = renderHook(() =>
      useReadoutEditor(
        { projectPublicId: 'p1', studyPublicId: 's1', readoutPublicId: 'r1' },
        draft,
      ),
    );

    // Update only the text, keeping citations
    const updatedContent: DraftContent = {
      ...result.current.editorState.content,
      findings: [
        {
          id: 'f1',
          text: 'Updated finding text',
          citations: result.current.editorState.content.findings![0].citations,
        },
      ],
    };

    act(() => {
      result.current.updateContent(updatedContent);
    });

    // Citation should be preserved
    expect(result.current.editorState.content.findings?.[0].citations).toHaveLength(1);
    expect(result.current.editorState.content.findings?.[0].citations[0].displayId).toBe(
      'IN-0001',
    );
  });
});
