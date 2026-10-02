/**
 * CommentDraftContext — Workspace-level Comment draft session state.
 *
 * M4B: Preserves transient Comment work across rail mode switching.
 *
 * This context survives:
 * - CommentsRail unmount/remount (mode switching)
 * - Comments ↔ Coaching rail switching
 * - Same-artifact reference navigation
 *
 * It does NOT persist:
 * - Across cross-artifact navigation (with confirmation)
 * - Across browser refresh
 * - To backend storage
 *
 * ISOLATION INVARIANT:
 * Draft state MUST NEVER:
 * - Enter artifact save payload
 * - Increment artifact_version
 * - Trigger GitHub sync
 * - Change approval status
 * - Create a Comment before explicit submit
 * - Invoke Coaching
 * - Become canonical research state
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Reply draft keyed by thread ID */
export interface ReplyDraft {
  threadId: string;
  body: string;
}

/** Edit draft keyed by message ID */
export interface EditDraft {
  messageId: string;
  threadId: string;
  body: string;
  /** Original body for conflict detection */
  originalBody: string;
}

/** New thread draft */
export interface NewThreadDraft {
  sectionKey: string;
  body: string;
}

/** Complete draft session state */
export interface CommentDraftSession {
  /** Artifact this session belongs to */
  artifactPublicId: string;
  /** Current scope */
  scope: { mode: 'all' } | { mode: 'section'; sectionKey: string };
  /** Selected/expanded thread ID */
  selectedThreadId: string | null;
  /** New thread draft (only one at a time) */
  newThreadDraft: NewThreadDraft | null;
  /** Reply drafts by thread ID */
  replyDrafts: Map<string, string>;
  /** Edit drafts by message ID */
  editDrafts: Map<string, EditDraft>;
  /** Whether create form is showing */
  showCreateForm: boolean;
  /** Whether showing resolved threads */
  showResolved: boolean;
  /** Originating section key for scope switching */
  originatingSectionKey: string | null;
}

/** Context value with state and actions */
export interface CommentDraftContextValue {
  /** Current session state */
  session: CommentDraftSession | null;
  /** Whether there's any unsaved draft work */
  hasDirtyDraft: boolean;

  // ─── Session Lifecycle ───────────────────────────────────────────────────
  /** Initialize session for an artifact */
  initSession: (artifactPublicId: string) => void;
  /** Clear session (on artifact change or explicit discard) */
  clearSession: () => void;

  // ─── New Thread Draft ────────────────────────────────────────────────────
  /** Set new thread draft */
  setNewThreadDraft: (sectionKey: string, body: string) => void;
  /** Clear new thread draft (on successful submit) */
  clearNewThreadDraft: () => void;
  /** Toggle create form visibility */
  setShowCreateForm: (show: boolean) => void;

  // ─── Reply Draft ─────────────────────────────────────────────────────────
  /** Set reply draft for a thread */
  setReplyDraft: (threadId: string, body: string) => void;
  /** Get reply draft for a thread */
  getReplyDraft: (threadId: string) => string;
  /** Clear reply draft (on successful submit) */
  clearReplyDraft: (threadId: string) => void;

  // ─── Edit Draft ──────────────────────────────────────────────────────────
  /** Start editing a message */
  startEdit: (messageId: string, threadId: string, body: string) => void;
  /** Update edit draft */
  setEditDraft: (messageId: string, body: string) => void;
  /** Get edit draft for a message */
  getEditDraft: (messageId: string) => EditDraft | undefined;
  /** Clear edit draft (on successful submit or cancel) */
  clearEditDraft: (messageId: string) => void;
  /** Check if a message is being edited */
  isEditing: (messageId: string) => boolean;

  // ─── Thread Selection ────────────────────────────────────────────────────
  /** Set selected/expanded thread */
  setSelectedThread: (threadId: string | null) => void;

  // ─── Scope ───────────────────────────────────────────────────────────────
  /** Set scope */
  setScope: (scope: { mode: 'all' } | { mode: 'section'; sectionKey: string }) => void;
  /** Set originating section key */
  setOriginatingSectionKey: (sectionKey: string | null) => void;
  /** Toggle show resolved */
  setShowResolved: (show: boolean) => void;
}

// ─── Default State ───────────────────────────────────────────────────────────

function createEmptySession(artifactPublicId: string): CommentDraftSession {
  return {
    artifactPublicId,
    scope: { mode: 'all' },
    selectedThreadId: null,
    newThreadDraft: null,
    replyDrafts: new Map(),
    editDrafts: new Map(),
    showCreateForm: false,
    showResolved: false,
    originatingSectionKey: null,
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const CommentDraftContext = createContext<CommentDraftContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface CommentDraftProviderProps {
  children: ReactNode;
}

export function CommentDraftProvider({ children }: CommentDraftProviderProps) {
  const [session, setSession] = useState<CommentDraftSession | null>(null);

  // ─── Derived State ───────────────────────────────────────────────────────

  const hasDirtyDraft = useMemo(() => {
    if (!session) return false;

    // Check new thread draft
    if (session.newThreadDraft && session.newThreadDraft.body.trim()) {
      return true;
    }

    // Check reply drafts
    for (const body of session.replyDrafts.values()) {
      if (body.trim()) return true;
    }

    // Check edit drafts
    for (const edit of session.editDrafts.values()) {
      if (edit.body.trim() && edit.body !== edit.originalBody) return true;
    }

    return false;
  }, [session]);

  // ─── Session Lifecycle ───────────────────────────────────────────────────

  const initSession = useCallback((artifactPublicId: string) => {
    setSession((prev) => {
      // If already initialized for this artifact, preserve state
      if (prev && prev.artifactPublicId === artifactPublicId) {
        return prev;
      }
      // Create new session for different artifact
      return createEmptySession(artifactPublicId);
    });
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, []);

  // ─── New Thread Draft ────────────────────────────────────────────────────

  const setNewThreadDraft = useCallback((sectionKey: string, body: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        newThreadDraft: { sectionKey, body },
      };
    });
  }, []);

  const clearNewThreadDraft = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        newThreadDraft: null,
        showCreateForm: false,
      };
    });
  }, []);

  const setShowCreateForm = useCallback((show: boolean) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        showCreateForm: show,
        // Clear draft when closing form without submit
        newThreadDraft: show ? prev.newThreadDraft : null,
      };
    });
  }, []);

  // ─── Reply Draft ─────────────────────────────────────────────────────────

  const setReplyDraft = useCallback((threadId: string, body: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const newDrafts = new Map(prev.replyDrafts);
      if (body) {
        newDrafts.set(threadId, body);
      } else {
        newDrafts.delete(threadId);
      }
      return {
        ...prev,
        replyDrafts: newDrafts,
      };
    });
  }, []);

  const getReplyDraft = useCallback(
    (threadId: string): string => {
      return session?.replyDrafts.get(threadId) ?? '';
    },
    [session],
  );

  const clearReplyDraft = useCallback((threadId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const newDrafts = new Map(prev.replyDrafts);
      newDrafts.delete(threadId);
      return {
        ...prev,
        replyDrafts: newDrafts,
      };
    });
  }, []);

  // ─── Edit Draft ──────────────────────────────────────────────────────────

  const startEdit = useCallback(
    (messageId: string, threadId: string, body: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        const newDrafts = new Map(prev.editDrafts);
        newDrafts.set(messageId, {
          messageId,
          threadId,
          body,
          originalBody: body,
        });
        return {
          ...prev,
          editDrafts: newDrafts,
        };
      });
    },
    [],
  );

  const setEditDraft = useCallback((messageId: string, body: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const existing = prev.editDrafts.get(messageId);
      if (!existing) return prev;

      const newDrafts = new Map(prev.editDrafts);
      newDrafts.set(messageId, {
        ...existing,
        body,
      });
      return {
        ...prev,
        editDrafts: newDrafts,
      };
    });
  }, []);

  const getEditDraft = useCallback(
    (messageId: string): EditDraft | undefined => {
      return session?.editDrafts.get(messageId);
    },
    [session],
  );

  const clearEditDraft = useCallback((messageId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const newDrafts = new Map(prev.editDrafts);
      newDrafts.delete(messageId);
      return {
        ...prev,
        editDrafts: newDrafts,
      };
    });
  }, []);

  const isEditing = useCallback(
    (messageId: string): boolean => {
      return session?.editDrafts.has(messageId) ?? false;
    },
    [session],
  );

  // ─── Thread Selection ────────────────────────────────────────────────────

  const setSelectedThread = useCallback((threadId: string | null) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedThreadId: threadId,
      };
    });
  }, []);

  // ─── Scope ───────────────────────────────────────────────────────────────

  const setScope = useCallback(
    (scope: { mode: 'all' } | { mode: 'section'; sectionKey: string }) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scope,
          // Update originating section when entering section mode
          originatingSectionKey:
            scope.mode === 'section' ? scope.sectionKey : prev.originatingSectionKey,
        };
      });
    },
    [],
  );

  const setOriginatingSectionKey = useCallback((sectionKey: string | null) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        originatingSectionKey: sectionKey,
      };
    });
  }, []);

  const setShowResolved = useCallback((show: boolean) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        showResolved: show,
      };
    });
  }, []);

  // ─── Context Value ───────────────────────────────────────────────────────

  const value = useMemo<CommentDraftContextValue>(
    () => ({
      session,
      hasDirtyDraft,
      initSession,
      clearSession,
      setNewThreadDraft,
      clearNewThreadDraft,
      setShowCreateForm,
      setReplyDraft,
      getReplyDraft,
      clearReplyDraft,
      startEdit,
      setEditDraft,
      getEditDraft,
      clearEditDraft,
      isEditing,
      setSelectedThread,
      setScope,
      setOriginatingSectionKey,
      setShowResolved,
    }),
    [
      session,
      hasDirtyDraft,
      initSession,
      clearSession,
      setNewThreadDraft,
      clearNewThreadDraft,
      setShowCreateForm,
      setReplyDraft,
      getReplyDraft,
      clearReplyDraft,
      startEdit,
      setEditDraft,
      getEditDraft,
      clearEditDraft,
      isEditing,
      setSelectedThread,
      setScope,
      setOriginatingSectionKey,
      setShowResolved,
    ],
  );

  return (
    <CommentDraftContext.Provider value={value}>
      {children}
    </CommentDraftContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCommentDraft(): CommentDraftContextValue {
  const context = useContext(CommentDraftContext);
  if (!context) {
    throw new Error('useCommentDraft must be used within a CommentDraftProvider');
  }
  return context;
}

/**
 * Hook to check if navigation should be blocked due to dirty drafts.
 * Returns a function that can be called before navigation.
 */
export function useCommentDraftGuard(): {
  hasDirtyDraft: boolean;
  confirmNavigation: () => boolean;
} {
  const { hasDirtyDraft, clearSession } = useCommentDraft();

  const confirmNavigation = useCallback((): boolean => {
    if (!hasDirtyDraft) {
      return true;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      'You have unsaved comment text. Discard and continue?',
    );

    if (confirmed) {
      clearSession();
      return true;
    }

    return false;
  }, [hasDirtyDraft, clearSession]);

  return { hasDirtyDraft, confirmNavigation };
}
