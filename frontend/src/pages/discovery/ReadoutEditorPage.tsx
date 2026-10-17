/**
 * ReadoutEditorPage — Main page for editing readout drafts
 *
 * DR-6b-4d: Implements all authorized scope
 * - Draft editing with all safeguards
 * - 409 conflict recovery
 * - Unsaved changes protection
 * - Title/question read-only
 *
 * NOT YET IMPLEMENTED (deferred):
 * - Approve action (DR-6b-4e)
 * - New readout creation
 * - AI generation
 * - Research Brief integration
 * - Staleness integration
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import {
  useReadoutDetail,
  useSaveDraft,
  isConcurrencyError,
  type ReadoutApiError,
} from '@/api/readouts';
import { useStudyWorkspace, WorkspaceLayout } from '@/components/study/workspace';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { useReadoutEditor } from '@/hooks/useReadoutEditor';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { DeskTabs } from '@/components/discovery';
import { ReadoutEditor } from '@/components/discovery/readout/ReadoutEditor';
import { ConflictComparisonView } from '@/components/discovery/readout/ConflictComparisonView';
import { UnsavedChangesModal } from '@/components/discovery/readout/UnsavedChangesModal';
import styles from '@/components/discovery/readout/readout.module.css';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export function ReadoutEditorPage() {
  const { studyPublicId, readoutPublicId } = useParams<{
    studyPublicId: string;
    readoutPublicId: string;
  }>();

  const { projectPublicId } = useStudyWorkspace();
  const permissions = useProjectPermissions(projectPublicId);

  // Fetch readout detail
  const detailQuery = useReadoutDetail(
    projectPublicId,
    studyPublicId!,
    readoutPublicId!,
  );

  // Editor state hook with all safeguards
  const editor = useReadoutEditor(
    {
      projectPublicId: projectPublicId || '',
      studyPublicId: studyPublicId || '',
      readoutPublicId: readoutPublicId || '',
    },
    detailQuery.data?.data.draft,
  );

  // Save mutation
  const saveMutation = useSaveDraft({
    projectPublicId: projectPublicId || '',
    studyPublicId: studyPublicId || '',
    readoutPublicId: readoutPublicId || '',
  });

  // Local state
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [invalidatedFindings, setInvalidatedFindings] = useState<string[]>([]);
  const [invalidatedImplications, setInvalidatedImplications] = useState<string[]>([]);
  const [pendingSaveAndLeave, setPendingSaveAndLeave] = useState(false);

  // Unsaved changes guard
  const unsavedGuard = useUnsavedChangesGuard(editor.isDirty);

  // Update save state when dirty changes
  useEffect(() => {
    if (editor.isDirty && saveState === 'saved') {
      setSaveState('dirty');
    }
  }, [editor.isDirty, saveState]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!editor.isInitialized) return;

    setSaveState('saving');
    setInvalidatedFindings([]);
    setInvalidatedImplications([]);

    const { content, findingsChecked, implicationsReviewed } = editor.getContentForSave();

    try {
      const result = await saveMutation.mutateAsync({
        expectedVersion: editor.serverVersion,
        content,
        findingsChecked,
        implicationsReviewed,
      });

      editor.onSaveSuccess(result.data);
      setSaveState('saved');
      setSavedAt(result.data.draft.lastEditedAt);
      setInvalidatedFindings(result.data.invalidatedFindings);
      setInvalidatedImplications(result.data.invalidatedImplications);

      // If this was a save-and-leave, proceed with navigation
      if (pendingSaveAndLeave) {
        setPendingSaveAndLeave(false);
        unsavedGuard.proceed();
      }
    } catch (error) {
      // Error is already parsed by useSaveDraft hook
      const apiError = error as ReadoutApiError;
      if (isConcurrencyError(apiError)) {
        // Handle 409 conflict
        editor.onConflict(apiError.currentVersion, content);

        // Fetch current server state for comparison
        const freshData = await detailQuery.refetch();
        if (freshData.data?.data.draft) {
          editor.setServerStateForComparison(freshData.data.data.draft);
        }

        setSaveState('error');
      } else {
        setSaveState('error');
      }
      setPendingSaveAndLeave(false);
    }
  }, [editor, saveMutation, detailQuery, pendingSaveAndLeave, unsavedGuard]);

  // Handle conflict resolution
  const handleReconcile = useCallback(() => {
    // User has reviewed the comparison and wants to edit their content
    // Keep their content in the editor with the updated server version
    if (editor.conflictState) {
      editor.resolveConflict({
        content: editor.conflictState.submittedContent,
        findingsChecked: editor.conflictState.submittedFindingsChecked,
        implicationsReviewed: editor.conflictState.submittedImplicationsReviewed,
      });
    }
    setSaveState('dirty');
  }, [editor]);

  const handleDiscard = useCallback(() => {
    editor.discardChanges();
    setSaveState('saved');
    setSavedAt(undefined);
  }, [editor]);

  const handleContinueEditing = useCallback(() => {
    editor.continueEditing();
    setSaveState('dirty');
  }, [editor]);

  // Navigation guard handlers
  const handleSaveAndLeave = useCallback(async () => {
    setPendingSaveAndLeave(true);
    handleSave();
  }, [handleSave]);

  const handleLeaveWithoutSaving = useCallback(() => {
    unsavedGuard.proceed();
  }, [unsavedGuard]);

  const handleStay = useCallback(() => {
    unsavedGuard.cancel();
    setPendingSaveAndLeave(false);
  }, [unsavedGuard]);

  // Render states
  if (!projectPublicId || !studyPublicId || !readoutPublicId) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <div className={styles.errorState}>
          <AlertCircle size={32} className={styles.errorIcon} />
          <h2 className={styles.errorTitle}>Missing parameters</h2>
          <p className={styles.errorDescription}>
            Required route parameters are missing.
          </p>
        </div>
      </WorkspaceLayout>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <DeskTabs studyPublicId={studyPublicId} activeTab="readouts" />
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>Loading readout...</p>
        </div>
      </WorkspaceLayout>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
        <DeskTabs studyPublicId={studyPublicId} activeTab="readouts" />
        <div className={styles.errorState} role="alert">
          <AlertCircle size={32} className={styles.errorIcon} />
          <h2 className={styles.errorTitle}>Failed to load readout</h2>
          <p className={styles.errorDescription}>
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'An error occurred while loading the readout.'}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => detailQuery.refetch()}
          >
            Try again
          </button>
        </div>
      </WorkspaceLayout>
    );
  }

  const readout = detailQuery.data.data;
  const readOnly = !permissions.canReview || permissions.isLoading;

  return (
    <WorkspaceLayout header={<div className={styles.headerSpacer} />}>
      <DeskTabs studyPublicId={studyPublicId} activeTab="readouts" />

      {/* Back link */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link
          to={`/studies/${studyPublicId}/discovery/desk/readouts`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--color-text-muted)',
            textDecoration: 'none',
            fontSize: 'var(--type-ui-size)',
          }}
        >
          <ArrowLeft size={16} />
          Back to readouts
        </Link>
      </div>

      {/* Read-only notice */}
      {readOnly && (
        <div
          style={{
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--type-ui-size)',
            color: 'var(--color-text-muted)',
          }}
        >
          {permissions.isLoading
            ? 'Loading permissions...'
            : permissions.readOnlyReason || 'You have view-only access to this readout.'}
        </div>
      )}

      {/* Editor */}
      <ReadoutEditor
        title={readout.title}
        question={readout.question}
        displayId={readout.displayId}
        editorState={editor.editorState}
        isDirty={editor.isDirty}
        saveState={saveState}
        savedAt={savedAt}
        invalidatedFindings={invalidatedFindings}
        invalidatedImplications={invalidatedImplications}
        readOnly={readOnly}
        projectPublicId={projectPublicId}
        studyPublicId={studyPublicId}
        readoutPublicId={readoutPublicId}
        onContentChange={editor.updateContent}
        onToggleFindingChecked={editor.toggleFindingChecked}
        onToggleImplicationReviewed={editor.toggleImplicationReviewed}
        onSave={handleSave}
      />

      {/* Conflict comparison view */}
      {editor.conflictState && (
        <ConflictComparisonView
          conflict={editor.conflictState}
          onReconcile={handleReconcile}
          onDiscard={handleDiscard}
          onContinueEditing={handleContinueEditing}
        />
      )}

      {/* Unsaved changes modal */}
      {unsavedGuard.isBlocked && !editor.conflictState && (
        <UnsavedChangesModal
          onSaveAndLeave={handleSaveAndLeave}
          onLeaveWithoutSaving={handleLeaveWithoutSaving}
          onStay={handleStay}
          isSaving={saveState === 'saving'}
        />
      )}
    </WorkspaceLayout>
  );
}
