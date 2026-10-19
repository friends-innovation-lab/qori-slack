/**
 * ReadoutEditorPage — Main page for readout editing and approval
 *
 * DR-6b-4d: Draft editing with all safeguards
 * - Draft editing with all safeguards
 * - 409 conflict recovery
 * - Unsaved changes protection
 * - Title/question read-only
 *
 * DR-6b-4e: Approval UI (implemented)
 * - A. Review and eligibility display
 * - B. Approval confirmation dialog with supersession notes
 * - C. Immutable approved view rendering
 * - D. Draft and approval coexistence with Edit Draft action
 * - E. Approval history with historical snapshot viewing
 * - F. Evidence staleness display
 * - G. Permissions and concurrency handling (403, 409, 422)
 * - H. Research Brief handoff explanation
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { AlertCircle, ArrowLeft, FileEdit, Eye, History } from 'lucide-react';
import {
  useReadoutDetail,
  useSaveDraft,
  useApprovalEligibility,
  useApproveReadout,
  useApprovalHistory,
  isConcurrencyError,
  isApprovalIneligibleError,
  isAuthorizationError,
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
import { ApprovalConfirmationModal } from '@/components/discovery/readout/ApprovalConfirmationModal';
import { ApprovedViewSnapshot } from '@/components/discovery/readout/ApprovedViewSnapshot';
import { ApprovalHistoryPanel } from '@/components/discovery/readout/ApprovalHistoryPanel';
import { ApprovalStatusBanner } from '@/components/discovery/readout/ApprovalStatusBanner';
import styles from '@/components/discovery/readout/readout.module.css';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type ViewMode = 'edit' | 'approved';

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

  // Approval hooks
  const eligibilityQuery = useApprovalEligibility(
    projectPublicId || '',
    studyPublicId || '',
    readoutPublicId || '',
    { enabled: !!projectPublicId && !!studyPublicId && !!readoutPublicId },
  );

  const approveMutation = useApproveReadout({
    projectPublicId: projectPublicId || '',
    studyPublicId: studyPublicId || '',
    readoutPublicId: readoutPublicId || '',
  });

  const historyQuery = useApprovalHistory(
    projectPublicId || '',
    studyPublicId || '',
    readoutPublicId || '',
  );

  // Local state
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [invalidatedFindings, setInvalidatedFindings] = useState<string[]>([]);
  const [invalidatedImplications, setInvalidatedImplications] = useState<string[]>([]);
  const [pendingSaveAndLeave, setPendingSaveAndLeave] = useState(false);

  // Approval UI state
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

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

  // Approval handlers
  const handleOpenApprovalModal = useCallback(() => {
    // Refresh eligibility before showing modal
    eligibilityQuery.refetch();
    setApprovalError(null);
    setShowApprovalModal(true);
  }, [eligibilityQuery]);

  const handleCloseApprovalModal = useCallback(() => {
    setShowApprovalModal(false);
    setApprovalError(null);
  }, []);

  const handleApprove = useCallback(
    async (request: Parameters<typeof approveMutation.mutateAsync>[0]) => {
      setApprovalError(null);

      try {
        await approveMutation.mutateAsync(request);

        // Success - close modal and refresh data
        setShowApprovalModal(false);
        detailQuery.refetch();
        eligibilityQuery.refetch();
        historyQuery.refetch();
      } catch (error) {
        const apiError = error as ReadoutApiError;

        if (isConcurrencyError(apiError)) {
          // 409: Draft was modified - need to save first or refresh
          setApprovalError(
            'The draft was modified since you started. Please close this dialog, review the changes, and try again.',
          );
        } else if (isApprovalIneligibleError(apiError)) {
          // 422: Eligibility check failed - show errors
          const eligibilityErrors = (apiError as { errors?: string[] }).errors || [];
          setApprovalError(
            `Approval blocked: ${eligibilityErrors.join('; ') || 'Readout is not eligible for approval.'}`,
          );
          // Refresh eligibility to show current state
          eligibilityQuery.refetch();
        } else if (isAuthorizationError(apiError)) {
          // 403: Permission denied
          setApprovalError('You do not have permission to approve this readout.');
        } else {
          // Other error
          setApprovalError(apiError.message || 'An error occurred while approving.');
        }
      }
    },
    [approveMutation, detailQuery, eligibilityQuery, historyQuery],
  );

  const handleRefreshEligibility = useCallback(() => {
    eligibilityQuery.refetch();
    setApprovalError(null);
  }, [eligibilityQuery]);

  // View mode handlers
  const handleSwitchToEdit = useCallback(() => {
    setViewMode('edit');
  }, []);

  const handleSwitchToApproved = useCallback(() => {
    setViewMode('approved');
  }, []);

  // History panel handlers
  const handleOpenHistory = useCallback(() => {
    historyQuery.refetch();
    setShowHistoryPanel(true);
  }, [historyQuery]);

  const handleCloseHistory = useCallback(() => {
    setShowHistoryPanel(false);
  }, []);

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
  const hasLatestApproval = readout.latestApproval !== null;
  const canApprove = permissions.canReview && !permissions.isLoading;

  // Eligibility data for approval button state
  const eligibility = eligibilityQuery.data?.data;

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

      {/* Approval Status Banner (Scope F: Staleness) */}
      <ApprovalStatusBanner
        outOfDateSince={readout.outOfDateSince}
        outOfDateReason={readout.outOfDateReason}
        approvedAt={readout.approvedAt}
        approvedVersion={readout.approvedVersion}
        draftContentVersion={readout.draft.contentVersion}
        sourceDraftContentVersion={readout.latestApproval?.sourceDraftContentVersion}
        canEdit={canApprove}
        onViewHistory={hasLatestApproval ? handleOpenHistory : undefined}
        onEditDraft={hasLatestApproval ? handleSwitchToEdit : undefined}
      />

      {/* View Mode Toggle (only when approved) */}
      {hasLatestApproval && (
        <div className={styles.viewModeToggle} style={{ marginBottom: 'var(--space-4)' }}>
          <button
            type="button"
            className={`${styles.viewModeButton} ${viewMode === 'edit' ? styles.viewModeButtonActive : ''}`}
            onClick={handleSwitchToEdit}
          >
            <FileEdit size={14} style={{ marginRight: 'var(--space-1)' }} />
            Edit Draft
          </button>
          <button
            type="button"
            className={`${styles.viewModeButton} ${viewMode === 'approved' ? styles.viewModeButtonActive : ''}`}
            onClick={handleSwitchToApproved}
          >
            <Eye size={14} style={{ marginRight: 'var(--space-1)' }} />
            Approved Version
          </button>
          <button
            type="button"
            className={styles.viewModeButton}
            onClick={handleOpenHistory}
          >
            <History size={14} style={{ marginRight: 'var(--space-1)' }} />
            History
          </button>
        </div>
      )}

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

      {/* Main Content Area */}
      {viewMode === 'edit' ? (
        <>
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
            // Approval props
            canApprove={canApprove}
            eligibility={eligibility}
            isCheckingEligibility={eligibilityQuery.isLoading}
            onApprove={handleOpenApprovalModal}
          />
        </>
      ) : (
        /* Approved View (Scope C: Immutable approved view) */
        hasLatestApproval && (
          <div className={styles.editorContainer}>
            {/* Masthead - Read-only title/question */}
            <div className={styles.masthead}>
              <span className={styles.eyebrow}>Desk readout · {readout.displayId}</span>
              <h1 className={styles.title}>{readout.title}</h1>
              {readout.question && <p className={styles.question}>{readout.question}</p>}
            </div>

            <ApprovedViewSnapshot approval={readout.latestApproval!} />
          </div>
        )
      )}

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

      {/* Approval confirmation modal (Scope B) */}
      {showApprovalModal && eligibility && (
        <ApprovalConfirmationModal
          eligibility={eligibility}
          expectedVersion={editor.serverVersion}
          isApproving={approveMutation.isPending}
          approvalError={approvalError}
          onConfirm={handleApprove}
          onCancel={handleCloseApprovalModal}
          onRefreshEligibility={handleRefreshEligibility}
        />
      )}

      {/* Approval history panel (Scope E) */}
      {showHistoryPanel && (
        <ApprovalHistoryPanel
          approvals={historyQuery.data?.data.approvals ?? []}
          isLoading={historyQuery.isLoading}
          error={historyQuery.error instanceof Error ? historyQuery.error.message : null}
          onClose={handleCloseHistory}
        />
      )}
    </WorkspaceLayout>
  );
}
