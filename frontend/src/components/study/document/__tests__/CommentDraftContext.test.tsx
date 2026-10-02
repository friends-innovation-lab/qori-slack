/**
 * CommentDraftContext Tests — M4B Draft Lifecycle Verification
 *
 * LOCKED CONTRACT:
 * - Draft state survives rail mode switching (CommentsRail unmount/remount)
 * - Draft state survives same-artifact navigation
 * - Cross-artifact navigation prompts confirmation if dirty
 * - Draft state NEVER enters artifact save payload
 *
 * M4B: Comprehensive draft lifecycle tests per spec.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  CommentDraftProvider,
  useCommentDraft,
  useCommentDraftGuard,
} from '../CommentDraftContext';

// ─── Test Utilities ───────────────────────────────────────────────────────────

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CommentDraftProvider>{children}</CommentDraftProvider>;
  };
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('CommentDraftContext', () => {
  describe('Session Lifecycle', () => {
    it('initializes session for artifact', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      expect(result.current.session).toBeNull();

      act(() => {
        result.current.initSession('artifact-1');
      });

      expect(result.current.session).not.toBeNull();
      expect(result.current.session?.artifactPublicId).toBe('artifact-1');
    });

    it('preserves session on re-init for same artifact', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setNewThreadDraft('summary', 'Draft text');
      });

      const sessionBefore = result.current.session;

      act(() => {
        result.current.initSession('artifact-1');
      });

      // Session should be preserved (same reference)
      expect(result.current.session).toBe(sessionBefore);
      expect(result.current.session?.newThreadDraft?.body).toBe('Draft text');
    });

    it('clears session on init for different artifact', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setNewThreadDraft('summary', 'Draft text');
      });

      act(() => {
        result.current.initSession('artifact-2');
      });

      expect(result.current.session?.artifactPublicId).toBe('artifact-2');
      expect(result.current.session?.newThreadDraft).toBeNull();
    });

    it('clears session completely on clearSession', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setNewThreadDraft('summary', 'Draft text');
      });

      act(() => {
        result.current.clearSession();
      });

      expect(result.current.session).toBeNull();
    });
  });

  describe('New Thread Draft', () => {
    it('sets and retrieves new thread draft', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setNewThreadDraft('summary', 'Test comment');
      });

      expect(result.current.session?.newThreadDraft).toEqual({
        sectionKey: 'summary',
        body: 'Test comment',
      });
    });

    it('clears new thread draft', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setNewThreadDraft('summary', 'Test comment');
      });

      act(() => {
        result.current.clearNewThreadDraft();
      });

      expect(result.current.session?.newThreadDraft).toBeNull();
      expect(result.current.session?.showCreateForm).toBe(false);
    });
  });

  describe('Reply Draft', () => {
    it('sets and retrieves reply draft', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setReplyDraft('thread-1', 'Reply text');
      });

      expect(result.current.getReplyDraft('thread-1')).toBe('Reply text');
    });

    it('returns empty string for non-existent reply draft', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
      });

      expect(result.current.getReplyDraft('non-existent')).toBe('');
    });

    it('clears reply draft', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setReplyDraft('thread-1', 'Reply text');
      });

      act(() => {
        result.current.clearReplyDraft('thread-1');
      });

      expect(result.current.getReplyDraft('thread-1')).toBe('');
    });

    it('supports multiple concurrent reply drafts', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setReplyDraft('thread-1', 'Reply 1');
        result.current.setReplyDraft('thread-2', 'Reply 2');
        result.current.setReplyDraft('thread-3', 'Reply 3');
      });

      expect(result.current.getReplyDraft('thread-1')).toBe('Reply 1');
      expect(result.current.getReplyDraft('thread-2')).toBe('Reply 2');
      expect(result.current.getReplyDraft('thread-3')).toBe('Reply 3');
    });
  });

  describe('Edit Draft', () => {
    it('starts edit with original body captured', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.startEdit('msg-1', 'thread-1', 'Original text');
      });

      const draft = result.current.getEditDraft('msg-1');
      expect(draft).toEqual({
        messageId: 'msg-1',
        threadId: 'thread-1',
        body: 'Original text',
        originalBody: 'Original text',
      });
    });

    it('updates edit draft body', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.startEdit('msg-1', 'thread-1', 'Original text');
      });

      act(() => {
        result.current.setEditDraft('msg-1', 'Modified text');
      });

      const draft = result.current.getEditDraft('msg-1');
      expect(draft?.body).toBe('Modified text');
      expect(draft?.originalBody).toBe('Original text');
    });

    it('clears edit draft', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.startEdit('msg-1', 'thread-1', 'Original text');
      });

      act(() => {
        result.current.clearEditDraft('msg-1');
      });

      expect(result.current.getEditDraft('msg-1')).toBeUndefined();
    });

    it('isEditing returns correct value', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
      });

      expect(result.current.isEditing('msg-1')).toBe(false);

      act(() => {
        result.current.startEdit('msg-1', 'thread-1', 'Original text');
      });

      expect(result.current.isEditing('msg-1')).toBe(true);
      expect(result.current.isEditing('msg-2')).toBe(false);
    });
  });

  describe('hasDirtyDraft', () => {
    it('returns false when no session', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasDirtyDraft).toBe(false);
    });

    it('returns false when session has no drafts', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
      });

      expect(result.current.hasDirtyDraft).toBe(false);
    });

    it('returns true when new thread draft has content', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setNewThreadDraft('summary', 'Draft text');
      });

      expect(result.current.hasDirtyDraft).toBe(true);
    });

    it('returns false when new thread draft is empty', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setNewThreadDraft('summary', '   ');
      });

      expect(result.current.hasDirtyDraft).toBe(false);
    });

    it('returns true when reply draft has content', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setReplyDraft('thread-1', 'Reply text');
      });

      expect(result.current.hasDirtyDraft).toBe(true);
    });

    it('returns true when edit draft differs from original', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.startEdit('msg-1', 'thread-1', 'Original text');
        result.current.setEditDraft('msg-1', 'Modified text');
      });

      expect(result.current.hasDirtyDraft).toBe(true);
    });

    it('returns false when edit draft matches original', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.startEdit('msg-1', 'thread-1', 'Original text');
      });

      // Draft body matches original body
      expect(result.current.hasDirtyDraft).toBe(false);
    });
  });

  describe('Thread Selection', () => {
    it('sets selected thread', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setSelectedThread('thread-1');
      });

      expect(result.current.session?.selectedThreadId).toBe('thread-1');
    });

    it('clears selected thread', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setSelectedThread('thread-1');
      });

      act(() => {
        result.current.setSelectedThread(null);
      });

      expect(result.current.session?.selectedThreadId).toBeNull();
    });
  });

  describe('Scope', () => {
    it('sets scope to all', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setScope({ mode: 'all' });
      });

      expect(result.current.session?.scope).toEqual({ mode: 'all' });
    });

    it('sets scope to section and updates originating section', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setScope({ mode: 'section', sectionKey: 'summary' });
      });

      expect(result.current.session?.scope).toEqual({
        mode: 'section',
        sectionKey: 'summary',
      });
      expect(result.current.session?.originatingSectionKey).toBe('summary');
    });

    it('preserves originating section when switching to all', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
        result.current.setScope({ mode: 'section', sectionKey: 'summary' });
      });

      act(() => {
        result.current.setScope({ mode: 'all' });
      });

      expect(result.current.session?.scope).toEqual({ mode: 'all' });
      expect(result.current.session?.originatingSectionKey).toBe('summary');
    });
  });

  describe('Show Resolved', () => {
    it('toggles show resolved', () => {
      const { result } = renderHook(() => useCommentDraft(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.initSession('artifact-1');
      });

      expect(result.current.session?.showResolved).toBe(false);

      act(() => {
        result.current.setShowResolved(true);
      });

      expect(result.current.session?.showResolved).toBe(true);
    });
  });
});

describe('useCommentDraftGuard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns hasDirtyDraft status', () => {
    const { result } = renderHook(
      () => ({
        draft: useCommentDraft(),
        guard: useCommentDraftGuard(),
      }),
      { wrapper: createWrapper() },
    );

    expect(result.current.guard.hasDirtyDraft).toBe(false);

    act(() => {
      result.current.draft.initSession('artifact-1');
      result.current.draft.setNewThreadDraft('summary', 'Draft text');
    });

    expect(result.current.guard.hasDirtyDraft).toBe(true);
  });

  it('confirmNavigation returns true when no dirty draft', () => {
    const { result } = renderHook(
      () => ({
        draft: useCommentDraft(),
        guard: useCommentDraftGuard(),
      }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.draft.initSession('artifact-1');
    });

    let confirmed = false;
    act(() => {
      confirmed = result.current.guard.confirmNavigation();
    });

    expect(confirmed).toBe(true);
  });

  it('confirmNavigation shows dialog and clears session on confirm', () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(
      () => ({
        draft: useCommentDraft(),
        guard: useCommentDraftGuard(),
      }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.draft.initSession('artifact-1');
      result.current.draft.setNewThreadDraft('summary', 'Draft text');
    });

    let confirmed = false;
    act(() => {
      confirmed = result.current.guard.confirmNavigation();
    });

    expect(confirmMock).toHaveBeenCalledWith(
      'You have unsaved comment text. Discard and continue?',
    );
    expect(confirmed).toBe(true);
    expect(result.current.draft.session).toBeNull();
  });

  it('confirmNavigation preserves session on cancel', () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(
      () => ({
        draft: useCommentDraft(),
        guard: useCommentDraftGuard(),
      }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.draft.initSession('artifact-1');
      result.current.draft.setNewThreadDraft('summary', 'Draft text');
    });

    let confirmed = false;
    act(() => {
      confirmed = result.current.guard.confirmNavigation();
    });

    expect(confirmMock).toHaveBeenCalled();
    expect(confirmed).toBe(false);
    expect(result.current.draft.session).not.toBeNull();
    expect(result.current.draft.session?.newThreadDraft?.body).toBe('Draft text');
  });
});

describe('M4B Draft Lifecycle Contract', () => {
  it('INVARIANT: Draft state survives re-init for same artifact (simulates rail remount)', () => {
    const { result } = renderHook(() => useCommentDraft(), {
      wrapper: createWrapper(),
    });

    // Initial render - set draft
    act(() => {
      result.current.initSession('artifact-1');
      result.current.setReplyDraft('thread-1', 'Draft reply');
      result.current.setSelectedThread('thread-1');
    });

    // Simulate CommentsRail remount calling initSession again
    // In real app: CommentsRail calls initSession(artifactPublicId) on mount
    // If same artifact, session is preserved
    act(() => {
      result.current.initSession('artifact-1');
    });

    // Draft should be preserved (same artifact)
    expect(result.current.session?.artifactPublicId).toBe('artifact-1');
    expect(result.current.getReplyDraft('thread-1')).toBe('Draft reply');
    expect(result.current.session?.selectedThreadId).toBe('thread-1');
  });

  it('INVARIANT: hasDirtyDraft correctly identifies unsaved work', () => {
    const { result } = renderHook(() => useCommentDraft(), {
      wrapper: createWrapper(),
    });

    // Start clean
    act(() => {
      result.current.initSession('artifact-1');
    });
    expect(result.current.hasDirtyDraft).toBe(false);

    // Add new thread draft
    act(() => {
      result.current.setNewThreadDraft('summary', 'Draft');
    });
    expect(result.current.hasDirtyDraft).toBe(true);

    // Clear it
    act(() => {
      result.current.clearNewThreadDraft();
    });
    expect(result.current.hasDirtyDraft).toBe(false);

    // Add reply draft
    act(() => {
      result.current.setReplyDraft('thread-1', 'Reply');
    });
    expect(result.current.hasDirtyDraft).toBe(true);

    // Clear it
    act(() => {
      result.current.clearReplyDraft('thread-1');
    });
    expect(result.current.hasDirtyDraft).toBe(false);

    // Start edit and modify
    act(() => {
      result.current.startEdit('msg-1', 'thread-1', 'Original');
      result.current.setEditDraft('msg-1', 'Modified');
    });
    expect(result.current.hasDirtyDraft).toBe(true);
  });

  it('INVARIANT: Multiple draft types can coexist', () => {
    const { result } = renderHook(() => useCommentDraft(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.initSession('artifact-1');
      result.current.setNewThreadDraft('summary', 'New thread');
      result.current.setReplyDraft('thread-1', 'Reply 1');
      result.current.setReplyDraft('thread-2', 'Reply 2');
      result.current.startEdit('msg-1', 'thread-1', 'Original');
      result.current.setEditDraft('msg-1', 'Modified');
    });

    expect(result.current.session?.newThreadDraft?.body).toBe('New thread');
    expect(result.current.getReplyDraft('thread-1')).toBe('Reply 1');
    expect(result.current.getReplyDraft('thread-2')).toBe('Reply 2');
    expect(result.current.getEditDraft('msg-1')?.body).toBe('Modified');
    expect(result.current.hasDirtyDraft).toBe(true);
  });
});
