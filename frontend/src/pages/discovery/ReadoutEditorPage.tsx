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
 *
 * DR-6b-5d-B: Initial generation UI
 * - Evidence selection with all eligible pre-selected
 * - Generate action with guards
 * - Status polling and reload recovery
 * - Clean/dirty draft handling on completion
 *
 * DR-6b-5e-B-3: Editor integration and regeneration
 * - Generation History panel integration
 * - Regenerate with confirmation and evidence preselection
 * - READOUT_FINALIZED error handling
 * - Fresh idempotency key per regeneration request
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { AlertCircle, ArrowLeft, FileEdit, Eye, History, CheckCircle, Info, Sparkles, RefreshCw } from 'lucide-react';
import {
  useReadoutDetail,
  useSaveDraft,
  useApprovalEligibility,
  useApproveReadout,
  useApprovalHistory,
  useGenerationHistory,
  useInitiateGeneration,
  useGenerationStatus,
  isTerminalGenerationStatus,
  isConcurrencyError,
  isApprovalIneligibleError,
  isAuthorizationError,
  isReadoutFinalizedError,
  type ReadoutApiError,
  type GenerationStatus,
  type GenerationVersion,
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
import { EvidenceSelectionPanel } from '@/components/discovery/readout/EvidenceSelectionPanel';
import { GenerationProgress } from '@/components/discovery/readout/GenerationProgress';
import { GenerationFailure } from '@/components/discovery/readout/GenerationFailure';
import { VersionHistoryPanel } from '@/components/discovery/readout/VersionHistoryPanel';
import { RegenerationConfirmationModal } from '@/components/discovery/readout/RegenerationConfirmationModal';
import styles from '@/components/discovery/readout/readout.module.css';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type ViewMode = 'edit' | 'approved';

/**
 * Generation UI state machine
 * - idle: No active generation, can show evidence selection if no history
 * - selecting: User is selecting evidence (shown when no generation history exists)
 * - initiating: Generation request in flight
 * - pending: Generation queued on server
 * - generating: Generation in progress
 * - completed: Generation finished successfully
 * - failed: Generation failed
 * - superseded: Generation was superseded by another request
 */
type GenerationUIState =
  | 'idle'
  | 'selecting'
  | 'initiating'
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'superseded';

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

  // Generation hooks (DR-6b-5d-B)
  const generationHistoryQuery = useGenerationHistory(
    projectPublicId || '',
    studyPublicId || '',
    readoutPublicId || '',
  );

  const initiateGenerationMutation = useInitiateGeneration({
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

  // Approval UI state
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Generation UI state (DR-6b-5d-B)
  const [selectedRevisionIds, setSelectedRevisionIds] = useState<string[]>([]);
  const [activeGenerationRequestId, setActiveGenerationRequestId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showEvidenceSelection, setShowEvidenceSelection] = useState(false);
  const [generationCompletedWhileDirty, setGenerationCompletedWhileDirty] = useState(false);

  // Generation history and regeneration (DR-6b-5e-B-3)
  const [showGenerationHistoryPanel, setShowGenerationHistoryPanel] = useState(false);
  const [showRegenerationConfirmation, setShowRegenerationConfirmation] = useState(false);
  const [readoutFinalizedError, setReadoutFinalizedError] = useState<string | null>(null);

  // Stable idempotency key for current submission
  const idempotencyKeyRef = useRef<string | null>(null);

  // Track current readout to detect navigation
  const currentReadoutRef = useRef<string | null>(null);

  // Unsaved changes guard
  const unsavedGuard = useUnsavedChangesGuard(editor.isDirty);

  // Generation status polling
  const generationStatusQuery = useGenerationStatus(
    projectPublicId || '',
    studyPublicId || '',
    readoutPublicId || '',
    activeGenerationRequestId,
    {
      enabled: !!activeGenerationRequestId,
      refetchInterval: 2000,
    },
  );

  // Extract currentGenerationRequestId from server for recovery
  const serverGenerationRequestId = detailQuery.data?.data.currentGenerationRequestId ?? null;

  // Check if readout has any generation history (to determine if we show evidence selection or not)
  const hasGenerationHistory = useMemo(() => {
    const versions = generationHistoryQuery.data?.data.versions ?? [];
    return versions.length > 0;
  }, [generationHistoryQuery.data]);

  // Determine if there's a completed generation (for regeneration guard)
  const hasCompletedGeneration = useMemo(() => {
    const versions = generationHistoryQuery.data?.data.versions ?? [];
    return versions.some((v) => v.generationStatus === 'completed');
  }, [generationHistoryQuery.data]);

  // Get the most recent completed generation version for evidence preselection
  const mostRecentCompletedVersion = useMemo((): GenerationVersion | null => {
    const versions = generationHistoryQuery.data?.data.versions ?? [];
    // Versions are typically returned newest first, find the first completed one
    const completed = versions.find((v) => v.generationStatus === 'completed');
    return completed ?? null;
  }, [generationHistoryQuery.data]);

  // Current generation status from polling
  const currentGenerationStatus = generationStatusQuery.data?.data.status as GenerationStatus | undefined;

  // Compute generation UI state
  const generationUIState = useMemo((): GenerationUIState => {
    // If we're initiating a generation request
    if (initiateGenerationMutation.isPending) {
      return 'initiating';
    }

    // If we have an active request being polled
    if (activeGenerationRequestId && currentGenerationStatus) {
      if (currentGenerationStatus === 'pending') return 'pending';
      if (currentGenerationStatus === 'generating') return 'generating';
      if (currentGenerationStatus === 'completed') return 'completed';
      if (currentGenerationStatus === 'failed') return 'failed';
      if (currentGenerationStatus === 'superseded') return 'superseded';
    }

    // If showing evidence selection
    if (showEvidenceSelection) {
      return 'selecting';
    }

    return 'idle';
  }, [
    initiateGenerationMutation.isPending,
    activeGenerationRequestId,
    currentGenerationStatus,
    showEvidenceSelection,
  ]);

  // Reset state when navigating to a different readout
  useEffect(() => {
    const currentKey = `${projectPublicId}:${studyPublicId}:${readoutPublicId}`;
    if (currentReadoutRef.current !== null && currentReadoutRef.current !== currentKey) {
      // Different readout - reset generation state
      setActiveGenerationRequestId(null);
      setGenerationError(null);
      setShowEvidenceSelection(false);
      setSelectedRevisionIds([]);
      setGenerationCompletedWhileDirty(false);
      idempotencyKeyRef.current = null;
    }
    currentReadoutRef.current = currentKey;
  }, [projectPublicId, studyPublicId, readoutPublicId]);

  // Recovery: On mount/reload, check if there's an active generation to resume polling
  useEffect(() => {
    if (serverGenerationRequestId && !activeGenerationRequestId) {
      // Server has an active generation - start polling it
      setActiveGenerationRequestId(serverGenerationRequestId);
    }
  }, [serverGenerationRequestId, activeGenerationRequestId]);

  // Handle terminal generation states
  useEffect(() => {
    if (!currentGenerationStatus || !activeGenerationRequestId) return;

    if (isTerminalGenerationStatus(currentGenerationStatus)) {
      if (currentGenerationStatus === 'failed') {
        // Capture error message
        const errorMsg = generationStatusQuery.data?.data.generationError ?? null;
        setGenerationError(errorMsg);
      }

      if (currentGenerationStatus === 'completed') {
        // Check if editor is dirty - if so, warn the user
        if (editor.isDirty) {
          setGenerationCompletedWhileDirty(true);
        }
        // Clear generation request ID after handling completion
        // The detail query invalidation will refresh the draft if editor is clean
      }

      if (currentGenerationStatus === 'superseded') {
        // Another request took over - refetch detail to get latest state
        detailQuery.refetch();
      }

      // For terminal states, clear the active request after a short delay
      // to allow the UI to show the final state
      const timer = setTimeout(() => {
        setActiveGenerationRequestId(null);
        idempotencyKeyRef.current = null;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [
    currentGenerationStatus,
    activeGenerationRequestId,
    generationStatusQuery.data,
    editor.isDirty,
    detailQuery,
  ]);

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

      // Clear the dirty completion warning since user has saved
      setGenerationCompletedWhileDirty(false);

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
    setGenerationCompletedWhileDirty(false);
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

        setShowApprovalModal(false);
        detailQuery.refetch();
        eligibilityQuery.refetch();
        historyQuery.refetch();
      } catch (error) {
        const apiError = error as ReadoutApiError;

        if (isConcurrencyError(apiError)) {
          setApprovalError(
            'The draft was modified since you started. Please close this dialog, review the changes, and try again.',
          );
        } else if (isApprovalIneligibleError(apiError)) {
          const eligibilityErrors = (apiError as { errors?: string[] }).errors || [];
          setApprovalError(
            `Approval blocked: ${eligibilityErrors.join('; ') || 'Readout is not eligible for approval.'}`,
          );
          eligibilityQuery.refetch();
        } else if (isAuthorizationError(apiError)) {
          setApprovalError('You do not have permission to approve this readout.');
        } else {
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

  // Generation handlers (DR-6b-5d-B)
  const handleShowEvidenceSelection = useCallback(() => {
    setShowEvidenceSelection(true);
    setGenerationError(null);
  }, []);

  const handleCancelEvidenceSelection = useCallback(() => {
    setShowEvidenceSelection(false);
    setSelectedRevisionIds([]);
  }, []);

  const handleSelectionChange = useCallback((revisionIds: string[]) => {
    setSelectedRevisionIds(revisionIds);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedRevisionIds.length === 0) return;

    // Generate a stable idempotency key for this submission
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = uuidv4();
    }

    setGenerationError(null);
    setReadoutFinalizedError(null);

    try {
      const result = await initiateGenerationMutation.mutateAsync({
        idempotencyKey: idempotencyKeyRef.current,
        selectedRevisionIds,
      });

      // Start polling the new generation request
      setActiveGenerationRequestId(result.data.generationRequestId);
      setShowEvidenceSelection(false);

      // Handle idempotent replay (created: false)
      // This is not an error - just means we're resuming an existing request
      if (!result.data.created) {
        // Already have a request with this key - just poll it
      }
    } catch (error) {
      // Handle generation initiation errors
      const apiError = error as ReadoutApiError;

      // Handle READOUT_FINALIZED error
      if (isReadoutFinalizedError(apiError)) {
        setReadoutFinalizedError(
          apiError.message || 'This readout has been approved and cannot be regenerated.',
        );
        setShowEvidenceSelection(false);
        idempotencyKeyRef.current = null;
        return;
      }

      setGenerationError(apiError.message || 'Failed to start generation.');
      // Clear idempotency key on error so user can retry
      idempotencyKeyRef.current = null;
    }
  }, [selectedRevisionIds, initiateGenerationMutation]);

  const handleRetryPolling = useCallback(() => {
    if (activeGenerationRequestId) {
      generationStatusQuery.refetch();
    }
  }, [activeGenerationRequestId, generationStatusQuery]);

  const handleDismissCompletionWarning = useCallback(() => {
    setGenerationCompletedWhileDirty(false);
  }, []);

  // Generation History Panel handlers (DR-6b-5e-B-3)
  const handleOpenGenerationHistory = useCallback(() => {
    generationHistoryQuery.refetch();
    setShowGenerationHistoryPanel(true);
  }, [generationHistoryQuery]);

  const handleCloseGenerationHistory = useCallback(() => {
    setShowGenerationHistoryPanel(false);
  }, []);

  // Regeneration handlers (DR-6b-5e-B-3)
  const handleShowRegenerationConfirmation = useCallback(() => {
    // Clear any previous finalized error
    setReadoutFinalizedError(null);
    setShowRegenerationConfirmation(true);
    setShowEvidenceSelection(true);
    setGenerationError(null);

    // Generate a fresh idempotency key for this regeneration request
    idempotencyKeyRef.current = uuidv4();

    // Preselect evidence from the most recent completed generation
    if (mostRecentCompletedVersion?.evidenceSet) {
      const historicalRevisionIds = mostRecentCompletedVersion.evidenceSet.map(
        (e) => e.revisionPublicId,
      );
      // The actual preselection will happen after eligible evidence is loaded
      // and we filter out ineligible historical revisions
      setSelectedRevisionIds(historicalRevisionIds);
    }
  }, [mostRecentCompletedVersion]);

  const handleCancelRegeneration = useCallback(() => {
    setShowRegenerationConfirmation(false);
    setShowEvidenceSelection(false);
    setSelectedRevisionIds([]);
    idempotencyKeyRef.current = null;
  }, []);

  const handleConfirmRegeneration = useCallback(async () => {
    if (selectedRevisionIds.length === 0) return;

    // Ensure we have a fresh idempotency key
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = uuidv4();
    }

    setGenerationError(null);
    setReadoutFinalizedError(null);

    try {
      const result = await initiateGenerationMutation.mutateAsync({
        idempotencyKey: idempotencyKeyRef.current,
        selectedRevisionIds,
      });

      // Start polling the new generation request
      setActiveGenerationRequestId(result.data.generationRequestId);
      setShowRegenerationConfirmation(false);
      setShowEvidenceSelection(false);
    } catch (error) {
      const apiError = error as ReadoutApiError;

      // Handle READOUT_FINALIZED error
      if (isReadoutFinalizedError(apiError)) {
        setReadoutFinalizedError(
          apiError.message || 'This readout has been approved and cannot be regenerated.',
        );
        setShowRegenerationConfirmation(false);
        setShowEvidenceSelection(false);
        idempotencyKeyRef.current = null;
        return;
      }

      setGenerationError(apiError.message || 'Failed to start regeneration.');
      // Clear idempotency key on error so user can retry with a new key
      idempotencyKeyRef.current = null;
    }
  }, [selectedRevisionIds, initiateGenerationMutation]);

  // Determine if Generate/Regenerate button should be shown
  const canShowGenerate = useMemo(() => {
    // Must have researcher+ permissions
    if (!permissions.canReview || permissions.isLoading) return false;
    // Must not be approved (approved readouts cannot regenerate)
    // This check will be moved to canInitiateGenerate once we have readout data
    return true;
  }, [permissions]);

  // Determine if generation/regeneration can be initiated
  const canInitiateGenerate = useMemo(() => {
    // All the conditions for showing Generate must be met
    if (!canShowGenerate) return false;
    // Editor must be initialized and clean
    if (!editor.isInitialized || editor.isDirty) return false;
    // No save in progress
    if (saveState === 'saving') return false;
    // No conflict in progress
    if (editor.conflictState !== null) return false;
    // No active generation
    if (activeGenerationRequestId !== null) return false;
    return true;
  }, [
    canShowGenerate,
    editor.isInitialized,
    editor.isDirty,
    saveState,
    editor.conflictState,
    activeGenerationRequestId,
  ]);

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
  // Block approve during active generation (DR-6b-5d-B)
  const canApprove = permissions.canReview && !permissions.isLoading && !activeGenerationRequestId;

  // Eligibility data for approval button state
  const eligibility = eligibilityQuery.data?.data;

  // Determine if we should show the Generate button in toolbar (initial generation)
  const showGenerateButton = canShowGenerate && !hasCompletedGeneration && !hasGenerationHistory && !hasLatestApproval;

  // Determine if we should show the Regenerate button (has completed generation, not approved)
  const showRegenerateButton = canShowGenerate && hasCompletedGeneration && !hasLatestApproval;

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
            Approval History
          </button>
          {hasGenerationHistory && (
            <button
              type="button"
              className={styles.viewModeButton}
              onClick={handleOpenGenerationHistory}
            >
              <Sparkles size={14} style={{ marginRight: 'var(--space-1)' }} />
              Generation History
            </button>
          )}
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

      {/* Generation UI (DR-6b-5d-B, DR-6b-5e-B-3) */}
      {viewMode === 'edit' && (
        <>
          {/* READOUT_FINALIZED Error (DR-6b-5e-B-3) */}
          {readoutFinalizedError && (
            <div className={styles.finalizedError}>
              <div className={styles.finalizedErrorIcon}>
                <AlertCircle size={20} />
              </div>
              <div className={styles.finalizedErrorContent}>
                <strong>Regeneration Unavailable</strong>
                <p>{readoutFinalizedError}</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setReadoutFinalizedError(null)}
                style={{ marginLeft: 'auto', flexShrink: 0 }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Generation Progress */}
          {(generationUIState === 'pending' || generationUIState === 'generating') && (
            <GenerationProgress
              status={currentGenerationStatus!}
              pollingError={generationStatusQuery.isError}
              onRetryPolling={handleRetryPolling}
            />
          )}

          {/* Generation Initiating */}
          {generationUIState === 'initiating' && (
            <GenerationProgress status="pending" />
          )}

          {/* Generation Failure */}
          {generationUIState === 'failed' && (
            <GenerationFailure error={generationError} />
          )}

          {/* Generation Completed Notice */}
          {generationUIState === 'completed' && !generationCompletedWhileDirty && (
            <div className={styles.generationComplete}>
              <div className={styles.completeIcon}>
                <CheckCircle size={24} />
              </div>
              <div className={styles.completeContent}>
                <h3 className={styles.completeTitle}>Generation finished</h3>
                <p className={styles.completeMessage}>
                  Check the current draft before continuing.
                </p>
              </div>
            </div>
          )}

          {/* Dirty Draft Warning (generation completed but editor has unsaved changes) */}
          {generationCompletedWhileDirty && (
            <div className={styles.dirtyDraftWarning}>
              <div className={styles.dirtyDraftIcon}>
                <Info size={20} />
              </div>
              <div className={styles.dirtyDraftContent}>
                <strong>Generation finished with unsaved changes</strong>
                <p>
                  You have unsaved edits. Generated content may not have been applied due to
                  the concurrent edit. Save or discard your changes, then check the draft.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDismissCompletionWarning}
                style={{ marginLeft: 'auto', flexShrink: 0 }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Superseded Notice */}
          {generationUIState === 'superseded' && (
            <div className={styles.supersededNotice}>
              <Info size={16} />
              <span>This generation request was superseded by a newer request.</span>
            </div>
          )}

          {/* Evidence Selection Panel */}
          {showEvidenceSelection && generationUIState === 'selecting' && (
            <>
              <EvidenceSelectionPanel
                projectPublicId={projectPublicId}
                studyPublicId={studyPublicId}
                readoutPublicId={readoutPublicId}
                selectedRevisionIds={selectedRevisionIds}
                onSelectionChange={handleSelectionChange}
                disabled={initiateGenerationMutation.isPending}
                initialSelectionMode={showRegenerationConfirmation ? 'provided' : 'all'}
              />
              <div className={styles.generateToolbar}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelEvidenceSelection}
                  disabled={initiateGenerationMutation.isPending}
                  style={{ marginRight: 'var(--space-2)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary generateButton"
                  onClick={handleGenerate}
                  disabled={
                    selectedRevisionIds.length === 0 ||
                    initiateGenerationMutation.isPending
                  }
                >
                  <Sparkles size={16} />
                  Generate Readout
                </button>
              </div>
            </>
          )}
        </>
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

          {/* Generate Button (shown in empty state or when no generation history) */}
          {showGenerateButton &&
            !showEvidenceSelection &&
            generationUIState === 'idle' &&
            !hasCompletedGeneration && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: 'var(--space-4)',
                  marginTop: 'var(--space-4)',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleShowEvidenceSelection}
                  disabled={!canInitiateGenerate}
                  title={
                    !canInitiateGenerate
                      ? editor.isDirty
                        ? 'Save changes before generating'
                        : !editor.isInitialized
                          ? 'Loading...'
                          : 'Cannot generate at this time'
                      : 'Generate readout content using AI'
                  }
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                  <Sparkles size={16} />
                  Generate with AI
                </button>
              </div>
            )}

          {/* Regenerate Button and Generation History (shown when has completed generation) */}
          {showRegenerateButton &&
            !showEvidenceSelection &&
            !showRegenerationConfirmation &&
            generationUIState === 'idle' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  marginTop: 'var(--space-4)',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  className={styles.generationHistoryButton}
                  onClick={handleOpenGenerationHistory}
                >
                  <History size={16} />
                  Generation History
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleShowRegenerationConfirmation}
                  disabled={!canInitiateGenerate}
                  title={
                    !canInitiateGenerate
                      ? editor.isDirty
                        ? 'Save changes before regenerating'
                        : !editor.isInitialized
                          ? 'Loading...'
                          : 'Cannot regenerate at this time'
                      : 'Regenerate readout content using AI'
                  }
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                  <RefreshCw size={16} />
                  Regenerate
                </button>
              </div>
            )}

          {/* Generation History button when no generation in progress (for viewing only) */}
          {hasGenerationHistory &&
            !showRegenerateButton &&
            !hasLatestApproval &&
            !showEvidenceSelection &&
            generationUIState === 'idle' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: 'var(--space-4)',
                  marginTop: 'var(--space-4)',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  className={styles.generationHistoryButton}
                  onClick={handleOpenGenerationHistory}
                >
                  <History size={16} />
                  Generation History
                </button>
              </div>
            )}
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

      {/* Generation history panel (DR-6b-5e-B-3) */}
      {showGenerationHistoryPanel && (
        <VersionHistoryPanel
          versions={generationHistoryQuery.data?.data.versions ?? []}
          isLoading={generationHistoryQuery.isLoading}
          error={generationHistoryQuery.error instanceof Error ? generationHistoryQuery.error.message : null}
          onClose={handleCloseGenerationHistory}
          projectPublicId={projectPublicId}
          studyPublicId={studyPublicId}
          readoutPublicId={readoutPublicId}
        />
      )}

      {/* Regeneration confirmation modal (DR-6b-5e-B-3) */}
      {showRegenerationConfirmation && (
        <RegenerationConfirmationModal
          selectedCount={selectedRevisionIds.length}
          isRegenerating={initiateGenerationMutation.isPending}
          onConfirm={handleConfirmRegeneration}
          onCancel={handleCancelRegeneration}
        />
      )}
    </WorkspaceLayout>
  );
}
