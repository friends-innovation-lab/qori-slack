/**
 * CommentsRail — Comments panel content for artifact collaboration.
 *
 * CMT-6: Full comments experience inside ContextRail.
 * - Thread list (open by default)
 * - Show resolved toggle
 * - Create thread (with section selector)
 * - Reply to thread
 * - Edit own messages (with conflict handling)
 * - Resolve/reopen threads
 *
 * Rendered inside ContextRail as the Comments mode content.
 * Uses CMT-5 data layer hooks.
 */

import { useState, useCallback, useRef } from 'react';
import { MessageSquare, Check, RotateCcw, Pencil, AlertCircle } from 'lucide-react';
import {
  useCommentThreads,
  useCreateCommentThread,
  useReplyToCommentThread,
  useEditCommentMessage,
  useResolveCommentThread,
  useReopenCommentThread,
  deriveOpenThreadCount,
  isEditConflictError,
  type EditConflictError,
} from '@/api/comments';
import type {
  CommentThreadResource,
  CommentThreadDetailResource,
  CommentMessageResource,
} from '@qori/api-contracts';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import {
  getSectionsForArtifact,
  getSectionLabel,
  type ArtifactType,
} from './sectionLabels';
import styles from './CommentsRail.module.css';

// ─── Types ────────────────────────────────────────────────────────────

export type CommentsRailScope =
  | { mode: 'all' }
  | { mode: 'section'; sectionKey: string };

interface CommentsRailProps {
  /** Artifact public ID for API calls */
  artifactPublicId: string;
  /** Artifact type for section mapping */
  artifactType: ArtifactType;
  /** Current scope (controlled from parent for CMT-7 section opening) */
  scope?: CommentsRailScope;
  /** Scope change handler (for CMT-7 section affordances) */
  onScopeChange?: (scope: CommentsRailScope) => void;
}

// ─── Formatting Utilities ─────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatAuthor(displayName: string | null): string {
  return displayName || 'Unknown';
}

// ─── Thread Item Component ────────────────────────────────────────────

interface ThreadItemProps {
  thread: CommentThreadResource | CommentThreadDetailResource;
  artifactType: ArtifactType;
  artifactPublicId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ThreadItem({
  thread,
  artifactType,
  artifactPublicId,
  isExpanded,
  onToggle,
}: ThreadItemProps) {
  const [replyBody, setReplyBody] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editConflict, setEditConflict] = useState<EditConflictError | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const replyMutation = useReplyToCommentThread();
  const editMutation = useEditCommentMessage();
  const resolveMutation = useResolveCommentThread();
  const reopenMutation = useReopenCommentThread();

  // Type guard for detail resource
  const hasMessages = (t: CommentThreadResource | CommentThreadDetailResource): t is CommentThreadDetailResource =>
    'messages' in t && Array.isArray(t.messages);

  const messages = hasMessages(thread) ? thread.messages : [];
  const firstMessage = messages[0];
  const replies = messages.slice(1);

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    try {
      await replyMutation.mutateAsync({
        threadId: thread.id,
        body: replyBody.trim(),
      });
      setReplyBody('');
      setShowReplyForm(false);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleStartEdit = (message: CommentMessageResource) => {
    setEditingMessageId(message.id);
    setEditBody(message.body);
    setEditConflict(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditBody('');
    setEditConflict(null);
  };

  const handleSaveEdit = async (message: CommentMessageResource) => {
    if (!editBody.trim()) return;
    try {
      await editMutation.mutateAsync({
        messageId: message.id,
        threadId: thread.id,
        body: editBody.trim(),
        expectedUpdatedAt: message.updated_at,
      });
      setEditingMessageId(null);
      setEditBody('');
      setEditConflict(null);
    } catch (err) {
      if (isEditConflictError(err as any)) {
        setEditConflict(err as EditConflictError);
      }
    }
  };

  const handleResolve = async () => {
    try {
      await resolveMutation.mutateAsync({
        threadId: thread.id,
        artifactPublicId,
        sectionKey: thread.section_key,
      });
    } catch {
      // Error handled by mutation state
    }
  };

  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync({
        threadId: thread.id,
        artifactPublicId,
        sectionKey: thread.section_key,
      });
    } catch {
      // Error handled by mutation state
    }
  };

  const handleShowReply = () => {
    setShowReplyForm(true);
    setTimeout(() => replyRef.current?.focus(), 0);
  };

  const isEdited = (msg: CommentMessageResource) =>
    msg.updated_at !== msg.created_at;

  return (
    <article className={styles.thread} aria-labelledby={`thread-${thread.id}`}>
      {/* Thread header */}
      <button
        type="button"
        className={styles.threadHeader}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`thread-content-${thread.id}`}
      >
        <span className={styles.threadSection}>
          {getSectionLabel(artifactType, thread.section_key)}
        </span>
        <span className={styles.threadMeta}>
          <span className={styles.threadAuthor}>
            {formatAuthor(thread.creator.display_name)}
          </span>
          <span className={styles.threadTime}>
            {formatTimestamp(thread.created_at)}
          </span>
          {thread.status === 'resolved' && (
            <span className={styles.threadResolved}>Resolved</span>
          )}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div id={`thread-content-${thread.id}`} className={styles.threadContent}>
          {/* Initial message */}
          {firstMessage && (
            <div className={styles.message}>
              {editingMessageId === firstMessage.id ? (
                <div className={styles.editForm}>
                  {editConflict && (
                    <div className={styles.conflictAlert} role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      <span>This comment was updated elsewhere.</span>
                      <button
                        type="button"
                        className={styles.conflictAction}
                        onClick={() => {
                          setEditBody(editConflict.submittedBody);
                          setEditConflict(null);
                        }}
                      >
                        Keep my version
                      </button>
                    </div>
                  )}
                  <Textarea
                    label="Edit message"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className={styles.editTextarea}
                  />
                  <div className={styles.editActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(firstMessage)}
                      disabled={!editBody.trim() || editMutation.isPending}
                      loading={editMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.messageBody}>{firstMessage.body}</p>
                  {isEdited(firstMessage) && (
                    <span className={styles.editedTag}>(edited)</span>
                  )}
                  {firstMessage.permissions.can_edit && (
                    <button
                      type="button"
                      className={styles.inlineAction}
                      onClick={() => handleStartEdit(firstMessage)}
                      aria-label="Edit message"
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Replies */}
          {replies.map((msg) => (
            <div key={msg.id} className={styles.reply}>
              <div className={styles.replyMeta}>
                <span className={styles.replyAuthor}>
                  {formatAuthor(msg.author.display_name)}
                </span>
                <span className={styles.replyTime}>
                  {formatTimestamp(msg.created_at)}
                </span>
              </div>
              {editingMessageId === msg.id ? (
                <div className={styles.editForm}>
                  {editConflict && editConflict.messageId === msg.id && (
                    <div className={styles.conflictAlert} role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      <span>This comment was updated elsewhere.</span>
                      <button
                        type="button"
                        className={styles.conflictAction}
                        onClick={() => {
                          setEditBody(editConflict.submittedBody);
                          setEditConflict(null);
                        }}
                      >
                        Keep my version
                      </button>
                    </div>
                  )}
                  <Textarea
                    label="Edit reply"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className={styles.editTextarea}
                  />
                  <div className={styles.editActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(msg)}
                      disabled={!editBody.trim() || editMutation.isPending}
                      loading={editMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.messageBody}>{msg.body}</p>
                  {isEdited(msg) && (
                    <span className={styles.editedTag}>(edited)</span>
                  )}
                  {msg.permissions.can_edit && (
                    <button
                      type="button"
                      className={styles.inlineAction}
                      onClick={() => handleStartEdit(msg)}
                      aria-label="Edit reply"
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Reply form */}
          {showReplyForm && thread.permissions.can_reply && (
            <div className={styles.replyForm}>
              <Textarea
                ref={replyRef}
                label="Reply"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                className={styles.replyTextarea}
              />
              <div className={styles.replyActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyBody('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyBody.trim() || replyMutation.isPending}
                  loading={replyMutation.isPending}
                >
                  Reply
                </Button>
              </div>
              {replyMutation.isError && (
                <p className={styles.errorText} role="alert">
                  Failed to post reply. Please try again.
                </p>
              )}
            </div>
          )}

          {/* Thread actions */}
          <div className={styles.threadActions}>
            {thread.permissions.can_reply && !showReplyForm && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleShowReply}
              >
                <MessageSquare size={14} aria-hidden="true" />
                Reply
              </button>
            )}
            {thread.permissions.can_resolve && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleResolve}
                disabled={resolveMutation.isPending}
              >
                <Check size={14} aria-hidden="true" />
                {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
              </button>
            )}
            {thread.permissions.can_reopen && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleReopen}
                disabled={reopenMutation.isPending}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {reopenMutation.isPending ? 'Reopening...' : 'Reopen'}
              </button>
            )}
          </div>

          {/* Mutation errors */}
          {resolveMutation.isError && (
            <p className={styles.errorText} role="alert">
              Failed to resolve thread.
            </p>
          )}
          {reopenMutation.isError && (
            <p className={styles.errorText} role="alert">
              Failed to reopen thread.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Create Thread Form ───────────────────────────────────────────────

interface CreateThreadFormProps {
  artifactPublicId: string;
  artifactType: ArtifactType;
  defaultSectionKey?: string;
  onCancel: () => void;
  onSuccess: () => void;
}

function CreateThreadForm({
  artifactPublicId,
  artifactType,
  defaultSectionKey,
  onCancel,
  onSuccess,
}: CreateThreadFormProps) {
  const sections = getSectionsForArtifact(artifactType);
  const [sectionKey, setSectionKey] = useState(defaultSectionKey || '');
  const [body, setBody] = useState('');

  const createMutation = useCreateCommentThread();

  const handleSubmit = async () => {
    if (!sectionKey || !body.trim()) return;
    try {
      await createMutation.mutateAsync({
        artifactPublicId,
        sectionKey,
        body: body.trim(),
      });
      onSuccess();
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div className={styles.createForm}>
      <h3 className={styles.createHeading}>New comment</h3>
      <Select
        label="Section"
        options={sections.map((s) => ({ value: s.key, label: s.label }))}
        value={sectionKey}
        onChange={(e) => setSectionKey(e.target.value)}
        placeholder="Select a section..."
        required
      />
      <Textarea
        label="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your comment..."
        required
      />
      <div className={styles.createActions}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!sectionKey || !body.trim() || createMutation.isPending}
          loading={createMutation.isPending}
        >
          Post
        </Button>
      </div>
      {createMutation.isError && (
        <p className={styles.errorText} role="alert">
          Failed to create comment. Please try again.
        </p>
      )}
    </div>
  );
}

// ─── Main CommentsRail Component ──────────────────────────────────────

export function CommentsRail({
  artifactPublicId,
  artifactType,
  scope = { mode: 'all' },
  onScopeChange,
}: CommentsRailProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  // Query for open threads
  const sectionKey = scope.mode === 'section' ? scope.sectionKey : undefined;
  const openThreadsQuery = useCommentThreads({
    artifactPublicId,
    status: 'open',
    sectionKey,
  });

  // Query for resolved threads (only when toggled)
  const resolvedThreadsQuery = useCommentThreads({
    artifactPublicId,
    status: 'resolved',
    sectionKey,
    enabled: showResolved,
  });

  const openThreads = openThreadsQuery.data?.threads ?? [];
  const resolvedThreads = resolvedThreadsQuery.data?.threads ?? [];
  const openCount = deriveOpenThreadCount(openThreads);

  const handleToggleThread = (threadId: string) => {
    setExpandedThreadId(expandedThreadId === threadId ? null : threadId);
  };

  const handleCreateSuccess = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const handleScopeChange = (mode: 'all' | 'section') => {
    if (mode === 'all') {
      onScopeChange?.({ mode: 'all' });
    }
    // Section mode requires sectionKey from CMT-7
  };

  // Section mode availability (CMT-7 will provide sectionKey)
  const sectionModeAvailable = scope.mode === 'section';

  return (
    <div className={styles.commentsRail}>
      {/* Header */}
      <p className={styles.commentsEyebrow}>Comments</p>

      {/* Scope toggle (disabled for CMT-6 artifact-level opening) */}
      <div className={styles.scopeToggle} role="group" aria-label="Comment scope">
        <button
          type="button"
          className={`${styles.scopeButton} ${scope.mode === 'section' ? styles.scopeActive : ''}`}
          disabled={!sectionModeAvailable}
          aria-pressed={scope.mode === 'section'}
          onClick={() => handleScopeChange('section')}
        >
          This section
        </button>
        <button
          type="button"
          className={`${styles.scopeButton} ${scope.mode === 'all' ? styles.scopeActive : ''}`}
          aria-pressed={scope.mode === 'all'}
          onClick={() => handleScopeChange('all')}
        >
          All comments
        </button>
      </div>

      {/* Open count */}
      {openCount > 0 && (
        <p className={styles.countSummary}>
          {openCount} open {openCount === 1 ? 'thread' : 'threads'}
        </p>
      )}

      {/* Loading state */}
      {openThreadsQuery.isLoading && (
        <p className={styles.loadingText}>Loading comments...</p>
      )}

      {/* Error state */}
      {openThreadsQuery.isError && (
        <div className={styles.errorState} role="alert">
          <p>Could not load comments.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openThreadsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!openThreadsQuery.isLoading &&
        !openThreadsQuery.isError &&
        openThreads.length === 0 && (
          <p className={styles.emptyText}>
            {scope.mode === 'section'
              ? 'No open comments for this section.'
              : 'No open comments.'}
          </p>
        )}

      {/* Thread list */}
      {openThreads.length > 0 && (
        <div className={styles.threadList}>
          {openThreads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              artifactType={artifactType}
              artifactPublicId={artifactPublicId}
              isExpanded={expandedThreadId === thread.id}
              onToggle={() => handleToggleThread(thread.id)}
            />
          ))}
        </div>
      )}

      {/* Show resolved toggle */}
      <label className={styles.resolvedToggle}>
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
        />
        <span>Show resolved</span>
      </label>

      {/* Resolved threads */}
      {showResolved && (
        <div className={styles.resolvedSection}>
          {resolvedThreadsQuery.isLoading && (
            <p className={styles.loadingText}>Loading resolved...</p>
          )}
          {!resolvedThreadsQuery.isLoading && resolvedThreads.length === 0 && (
            <p className={styles.emptyText}>No resolved comments.</p>
          )}
          {resolvedThreads.length > 0 && (
            <div className={styles.threadList}>
              {resolvedThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  artifactType={artifactType}
                  artifactPublicId={artifactPublicId}
                  isExpanded={expandedThreadId === thread.id}
                  onToggle={() => handleToggleThread(thread.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create thread button / form */}
      {!showCreateForm ? (
        <Button
          variant="secondary"
          size="sm"
          className={styles.newThreadButton}
          onClick={() => setShowCreateForm(true)}
        >
          + New comment
        </Button>
      ) : (
        <CreateThreadForm
          artifactPublicId={artifactPublicId}
          artifactType={artifactType}
          defaultSectionKey={scope.mode === 'section' ? scope.sectionKey : undefined}
          onCancel={() => setShowCreateForm(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
