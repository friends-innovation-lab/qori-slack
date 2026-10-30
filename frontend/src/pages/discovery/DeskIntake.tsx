/**
 * DeskIntake — DISC-3, DISC-WEB-1C, DISC-WEB-1C-2b
 *
 * NAV-1a: Removed page-level LifecycleRail — now owned by StudyWorkspaceLayout.
 *
 * Desk Research intake form for adding documents to Discovery.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §5.2.
 *
 * DISC-WEB-1C: Two-phase upload flow:
 * 1. Select files and click "Verify files" to upload to extraction endpoint
 * 2. View extraction results (staged files, rejected files)
 * 3. DISC-WEB-1C-2b: "Start analysis" shows confirmation, creates Discovery run
 *
 * SAFETY GATE: Live API calls are disabled via ENABLE_LIVE_RUN_CREATION constant.
 * Tests can mock the API to exercise the full flow.
 *
 * Fields:
 * - Topic: "What topic are you exploring?"
 * - Source intent: "What do you need this source to tell you?"
 * - Files: Drop zone (10 files max, pdf/docx/txt/md — NOT .doc)
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Upload, X, AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import {
  useUploadDocuments,
  ERROR_FEATURE_DISABLED,
} from '@/api/mutations/useUploadDocuments';
import {
  useCreateDiscoveryRun,
  ERROR_IDEMPOTENCY_CONFLICT,
  ERROR_SOURCE_REF_UNAVAILABLE,
  ERROR_FEATURE_DISABLED as RUN_FEATURE_DISABLED,
} from '@/api/mutations/useCreateDiscoveryRun';
import type { ExtractedRef, RejectedFile } from '@qori/api-contracts';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import styles from './IntakeForm.module.css';
import docStyles from '@/components/study/document/document.module.css';

// ─── Safety Gate ─────────────────────────────────────────────────────
//
// DISC-WEB-1C-2b: This constant MUST be false in deployed code.
// When false, the Start Analysis button shows "Coming soon" and no API call is made.
// When true (only in tests with mocked APIs), the full flow is exercised.
//
// DO NOT set this to true without explicit architecture approval.
// This is separate from DISC_WEB1_ENABLED backend flag — double protection.
//
export const ENABLE_LIVE_RUN_CREATION = false;

// ─── Constants ──────────────────────────────────────────────────────

/** Allowed file extensions (NOT .doc — legacy format not supported) */
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'];
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Types ──────────────────────────────────────────────────────────

interface SelectedFile {
  file: File;
  error?: string;
}

/** Upload state machine */
type UploadState =
  | { phase: 'selecting' }
  | { phase: 'uploading' }
  | { phase: 'results'; refs: ExtractedRef[]; rejected: RejectedFile[] }
  | { phase: 'error'; code: string; message: string; transient: boolean }
  | { phase: 'disabled' }; // Feature flag off

/** Run creation state machine */
type RunCreationState =
  | { phase: 'idle' }
  | { phase: 'confirming' }
  | { phase: 'submitting' }
  | { phase: 'success'; runPublicId: string; isReplay: boolean }
  | { phase: 'error'; code: string; message: string; canRetry: boolean };

// ─── Component ──────────────────────────────────────────────────────

export function DeskIntake() {
  // NAV-1a: Get study data from workspace context (loaded by layout)
  const { studyPublicId, projectPublicId } = useStudyWorkspace();

  const navigate = useNavigate();

  // Form state
  const [topic, setTopic] = useState('');
  const [sourceIntent, setSourceIntent] = useState('');
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'selecting' });

  // Run creation state
  const [runCreationState, setRunCreationState] = useState<RunCreationState>({ phase: 'idle' });
  // Idempotency key: generated once when dialog opens, preserved across retries
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  // Mutations
  const uploadMutation = useUploadDocuments(projectPublicId);
  const createRunMutation = useCreateDiscoveryRun(projectPublicId);

  // ─── File Handling ─────────────────────────────────────────────────

  const validateFile = useCallback((file: File): string | undefined => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    // Reject .doc explicitly
    if (ext === 'doc') {
      return 'Legacy .doc format not supported. Please convert to .docx';
    }

    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size: 10MB';
    }
    return undefined;
  }, []);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validatedFiles: SelectedFile[] = fileArray.map((file) => ({
        file,
        error: validateFile(file),
      }));

      setFiles((prev) => {
        const combined = [...prev, ...validatedFiles];
        if (combined.length > MAX_FILES) {
          return combined.slice(0, MAX_FILES);
        }
        return combined;
      });

      // Reset to selecting phase when files change
      setUploadState({ phase: 'selecting' });
    },
    [validateFile],
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadState({ phase: 'selecting' });
  }, []);

  // ─── Drag Handlers ─────────────────────────────────────────────────

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  // ─── Upload Flow ───────────────────────────────────────────────────

  const handleVerifyFiles = async (e: React.FormEvent) => {
    e.preventDefault();

    const validFiles = files.filter((f) => !f.error).map((f) => f.file);
    if (validFiles.length === 0) {
      setUploadState({
        phase: 'error',
        code: 'NO_VALID_FILES',
        message: 'At least one valid file is required',
        transient: false,
      });
      return;
    }

    setUploadState({ phase: 'uploading' });

    const result = await uploadMutation.mutateAsync({ files: validFiles });

    if (result.success) {
      const { refs, rejected } = result.response.data;
      setUploadState({ phase: 'results', refs, rejected });
    } else {
      if (result.code === ERROR_FEATURE_DISABLED) {
        setUploadState({ phase: 'disabled' });
      } else {
        setUploadState({
          phase: 'error',
          code: result.code,
          message: result.message,
          transient: result.transient,
        });
      }
    }
  };

  const handleReset = () => {
    setFiles([]);
    setUploadState({ phase: 'selecting' });
    setRunCreationState({ phase: 'idle' });
    setIdempotencyKey(null);
  };

  const handleRetry = () => {
    setUploadState({ phase: 'selecting' });
  };

  // ─── Run Creation Flow ─────────────────────────────────────────────

  /**
   * Check if any refs have expired before opening confirmation.
   */
  const checkExpiredRefs = useCallback((): ExtractedRef[] => {
    if (uploadState.phase !== 'results') return [];

    const now = new Date();
    return uploadState.refs.filter((ref) => {
      const expiresAt = new Date(ref.expiresAt);
      return expiresAt <= now;
    });
  }, [uploadState]);

  /**
   * Open confirmation dialog.
   * Generates a new idempotency key if none exists.
   */
  const handleOpenConfirmation = useCallback(() => {
    // Check for expired refs first
    const expired = checkExpiredRefs();
    if (expired.length > 0) {
      setRunCreationState({
        phase: 'error',
        code: 'REFS_EXPIRED_BEFORE_CONFIRM',
        message: `${expired.length} file(s) have expired. Please upload files again.`,
        canRetry: false,
      });
      return;
    }

    // Generate idempotency key once for this submission attempt
    if (!idempotencyKey) {
      setIdempotencyKey(crypto.randomUUID());
    }

    setRunCreationState({ phase: 'confirming' });
  }, [checkExpiredRefs, idempotencyKey]);

  /**
   * Cancel confirmation dialog.
   */
  const handleCancelConfirmation = useCallback(() => {
    setRunCreationState({ phase: 'idle' });
    // Note: We preserve the idempotency key so if user re-opens and confirms,
    // we use the same key (in case they're retrying after a network error).
  }, []);

  /**
   * Confirm and create Discovery run.
   * Uses the existing idempotency key (never generates a new one after 409).
   */
  const handleConfirmSubmit = useCallback(async () => {
    // Safety gate check
    if (!ENABLE_LIVE_RUN_CREATION) {
      // This should never happen in deployed code because the button is disabled
      console.error('[DeskIntake] ENABLE_LIVE_RUN_CREATION is false - submission blocked');
      setRunCreationState({
        phase: 'error',
        code: 'SAFETY_GATE',
        message: 'Live run creation is not enabled. This feature is coming soon.',
        canRetry: false,
      });
      return;
    }

    if (uploadState.phase !== 'results' || !idempotencyKey) {
      return;
    }

    // Check for expired refs again (user may have waited)
    const expired = checkExpiredRefs();
    if (expired.length > 0) {
      setRunCreationState({
        phase: 'error',
        code: 'REFS_EXPIRED',
        message: `${expired.length} file(s) have expired. Please upload files again.`,
        canRetry: false,
      });
      return;
    }

    setRunCreationState({ phase: 'submitting' });

    const sourceRefs = uploadState.refs.map((ref) => ref.refToken);

    const outcome = await createRunMutation.mutateAsync({
      input: {
        discoveryType: 'desk_research',
        topic: topic.trim() || 'Untitled research',
        sourceIntent: sourceIntent.trim() || null,
        sourceRefs,
      },
      idempotencyKey,
    });

    if (outcome.success) {
      setRunCreationState({
        phase: 'success',
        runPublicId: outcome.response.data.publicId,
        isReplay: outcome.isReplay,
      });

      // Navigate to run page
      navigate(`/studies/${studyPublicId}/discovery/runs/${outcome.response.data.publicId}`);
    } else {
      // Handle specific error codes
      let canRetry = false;
      let message = outcome.message;

      switch (outcome.code) {
        case ERROR_IDEMPOTENCY_CONFLICT:
          // 409: Different payload sent with same key. This is a client bug.
          // Do NOT generate a new key — user must start fresh.
          message = 'Request conflict. Please start a new upload.';
          canRetry = false;
          break;

        case ERROR_SOURCE_REF_UNAVAILABLE:
          // 410: Refs expired or consumed. Must re-upload.
          message = 'Files have expired or are no longer available. Please upload files again.';
          canRetry = false;
          break;

        case RUN_FEATURE_DISABLED:
          // 503: Feature flag off
          message = 'Discovery runs are not currently available. Please try again later.';
          canRetry = false;
          break;

        case 'NETWORK_ERROR':
          // Network error: user can retry with same idempotency key
          canRetry = true;
          break;

        default:
          // Other errors: check status
          canRetry = outcome.status === undefined || outcome.status >= 500;
      }

      setRunCreationState({
        phase: 'error',
        code: outcome.code,
        message,
        canRetry,
      });
    }
  }, [
    uploadState,
    idempotencyKey,
    topic,
    sourceIntent,
    checkExpiredRefs,
    createRunMutation,
    navigate,
    studyPublicId,
  ]);

  /**
   * Retry after transient error.
   * Uses the SAME idempotency key (critical for replay protection).
   */
  const handleRetrySubmit = useCallback(() => {
    // Just re-open confirmation with same key
    setRunCreationState({ phase: 'confirming' });
  }, []);

  /**
   * Start fresh after non-retriable error.
   * Clears idempotency key and returns to file selection.
   */
  const handleStartFresh = useCallback(() => {
    handleReset();
  }, []);

  // ─── Computed State ────────────────────────────────────────────────

  const validFileCount = files.filter((f) => !f.error).length;
  const canVerify = validFileCount > 0 && uploadState.phase === 'selecting';
  const isUploading = uploadState.phase === 'uploading';

  // Refs state for confirmation dialog
  const extractedRefs = useMemo(() => {
    if (uploadState.phase !== 'results') return [];
    return uploadState.refs;
  }, [uploadState]);

  const hasRefs = extractedRefs.length > 0;

  // Check if any refs are expired
  const expiredRefCount = useMemo(() => {
    const now = new Date();
    return extractedRefs.filter((ref) => new Date(ref.expiresAt) <= now).length;
  }, [extractedRefs]);

  const allRefsExpired = expiredRefCount === extractedRefs.length && extractedRefs.length > 0;
  const someRefsExpired = expiredRefCount > 0 && expiredRefCount < extractedRefs.length;

  // ─── Render ────────────────────────────────────────────────────────

  // Feature disabled state
  if (uploadState.phase === 'disabled') {
    return (
      <WorkspaceLayout
        header={
          <div className={styles.header}>
            <span className={styles.eyebrow}>Desk Research</span>
            <h1 className={styles.title}>Add documents</h1>
          </div>
        }
      >
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <Alert variant="warning" title="Feature unavailable">
              Document extraction is not currently available. Please try again later or
              contact support if this persists.
            </Alert>
            <div className={styles.actions} style={{ marginTop: '1rem' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/studies/${studyPublicId}/discovery`)}
              >
                Back to Discovery
              </Button>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Results state — show staged files and rejected files
  if (uploadState.phase === 'results') {
    const { refs, rejected } = uploadState;
    const hasRejected = rejected.length > 0;
    const allRejected = refs.length === 0 && rejected.length > 0;

    return (
      <WorkspaceLayout
        header={
          <div className={styles.header}>
            <span className={styles.eyebrow}>Desk Research</span>
            <h1 className={styles.title}>Verification results</h1>
            <p className={styles.description}>
              {allRejected
                ? 'All files were rejected. Please review the errors and try again.'
                : hasRejected
                  ? 'Some files were extracted successfully. Review the results below.'
                  : 'All files were extracted successfully.'}
            </p>
          </div>
        }
      >
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            {/* Topic and source intent (read-only summary) */}
            {topic && (
              <div className={styles.field}>
                <span className={styles.label}>Topic</span>
                <p className={styles.readOnlyValue}>{topic}</p>
              </div>
            )}
            {sourceIntent && (
              <div className={styles.field}>
                <span className={styles.label}>Source intent</span>
                <p className={styles.readOnlyValue}>{sourceIntent}</p>
              </div>
            )}

            {/* Run creation error state */}
            {runCreationState.phase === 'error' && (
              <Alert variant="error" title="Analysis failed">
                {runCreationState.message}
              </Alert>
            )}

            {/* Expired refs warning */}
            {allRefsExpired && (
              <Alert variant="error" title="Files expired">
                All staged files have expired. Please upload files again.
              </Alert>
            )}
            {someRefsExpired && (
              <Alert variant="warning" title="Some files expired">
                {expiredRefCount} file(s) have expired. Please upload files again to include all
                documents.
              </Alert>
            )}

            {/* Successfully staged files */}
            {hasRefs && (
              <div className={styles.field}>
                <span className={styles.label}>
                  <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                  {' '}Extracted files ({refs.length})
                </span>
                <ul className={styles.fileList} aria-label="Extracted files">
                  {refs.map((ref) => {
                    const isExpired = new Date(ref.expiresAt) <= new Date();
                    return (
                      <li
                        key={ref.refToken}
                        className={`${styles.fileItem} ${isExpired ? styles.fileItemError : ''}`}
                      >
                        <FileText size={16} aria-hidden="true" />
                        <span className={styles.fileName}>{ref.filename}</span>
                        <span className={styles.fileSize}>
                          {(ref.sizeBytes / 1024).toFixed(0)} KB
                        </span>
                        <span className={styles.fileDetail}>
                          {ref.charCount.toLocaleString()} chars
                        </span>
                        {isExpired ? (
                          <span className={styles.fileError}>
                            <AlertTriangle size={12} aria-hidden="true" />
                            {' '}Expired
                          </span>
                        ) : (
                          <span className={styles.fileDetail} title={`Expires: ${ref.expiresAt}`}>
                            <Clock size={12} aria-hidden="true" />
                            {' '}30 min
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Rejected files */}
            {hasRejected && (
              <div className={styles.field}>
                <span className={styles.label}>
                  <AlertCircle size={16} style={{ color: 'var(--color-error)' }} />
                  {' '}Rejected files ({rejected.length})
                </span>
                <ul className={styles.fileList} aria-label="Rejected files">
                  {rejected.map((file, index) => (
                    <li
                      key={`${file.filename}-${index}`}
                      className={`${styles.fileItem} ${styles.fileItemError}`}
                    >
                      <FileText size={16} aria-hidden="true" />
                      <span className={styles.fileName}>{file.filename}</span>
                      <span className={styles.fileError}>
                        <AlertCircle size={14} aria-hidden="true" />
                        {file.errorMessage}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={handleReset}>
                Upload different files
              </Button>
              {hasRefs && !allRefsExpired && (
                ENABLE_LIVE_RUN_CREATION ? (
                  <Button
                    type="button"
                    onClick={handleOpenConfirmation}
                    disabled={runCreationState.phase === 'submitting'}
                    loading={runCreationState.phase === 'submitting'}
                  >
                    Start analysis
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled
                    title="Start analysis will be available in a future update"
                  >
                    Start analysis (coming soon)
                  </Button>
                )
              )}
              {runCreationState.phase === 'error' && runCreationState.canRetry && (
                <Button type="button" onClick={handleRetrySubmit}>
                  Retry
                </Button>
              )}
              {runCreationState.phase === 'error' && !runCreationState.canRetry && (
                <Button type="button" onClick={handleStartFresh}>
                  Start over
                </Button>
              )}
            </div>

            {/* Expiration notice */}
            {hasRefs && !allRefsExpired && (
              <Alert variant="info" title="Staged files expire">
                Extracted files are staged for 30 minutes. After that, you will need to
                upload them again.
              </Alert>
            )}

            {/* Confirmation Dialog */}
            <ConfirmDialog
              open={runCreationState.phase === 'confirming'}
              title="Start AI analysis?"
              confirmLabel="Start analysis"
              cancelLabel="Cancel"
              confirmLoading={false}
              onConfirm={handleConfirmSubmit}
              onCancel={handleCancelConfirmation}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {topic && (
                  <div>
                    <strong>Topic:</strong> {topic}
                  </div>
                )}
                <div>
                  <strong>Files:</strong> {extractedRefs.length} document
                  {extractedRefs.length !== 1 ? 's' : ''} ready
                  <ul style={{ margin: 'var(--space-2) 0 0 var(--space-4)', padding: 0 }}>
                    {extractedRefs.map((ref) => (
                      <li key={ref.refToken} style={{ fontSize: '14px', color: 'var(--color-text-meta)' }}>
                        {ref.filename}
                      </li>
                    ))}
                  </ul>
                </div>
                <Alert variant="info" title="">
                  Starting analysis will send these documents for AI processing.
                </Alert>
              </div>
            </ConfirmDialog>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Error state
  if (uploadState.phase === 'error') {
    return (
      <WorkspaceLayout
        header={
          <div className={styles.header}>
            <span className={styles.eyebrow}>Desk Research</span>
            <h1 className={styles.title}>Add documents</h1>
          </div>
        }
      >
        <div className={docStyles.docWrap}>
          <div className={docStyles.docCol}>
            <Alert variant="error" title="Upload failed">
              {uploadState.message}
              {uploadState.transient && ' This may be temporary — please try again.'}
            </Alert>
            <div className={styles.actions} style={{ marginTop: '1rem' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/studies/${studyPublicId}/discovery`)}
              >
                Cancel
              </Button>
              {uploadState.transient && (
                <Button type="button" onClick={handleRetry}>
                  Try again
                </Button>
              )}
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Selection / uploading state (main form)
  return (
    <WorkspaceLayout
      header={
        <div className={styles.header}>
          <span className={styles.eyebrow}>Desk Research</span>
          <h1 className={styles.title}>Add documents</h1>
          <p className={styles.description}>
            Upload reports, studies, policy documents, or other desk research. Qori will
            extract text content for verification before analysis.
          </p>
        </div>
      }
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          <form onSubmit={handleVerifyFiles} className={styles.form}>
            {/* Topic */}
            <div className={styles.field}>
              <Input
                id="topic"
                label="What topic are you exploring?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Accessibility policy compliance"
                disabled={isUploading}
              />
            </div>

            {/* Source intent */}
            <div className={styles.field}>
              <Textarea
                id="sourceIntent"
                label="What do you need this source to tell you?"
                hint="Optional"
                value={sourceIntent}
                onChange={(e) => setSourceIntent(e.target.value)}
                placeholder="e.g., I need to understand current compliance requirements and any gaps in implementation"
                rows={3}
                disabled={isUploading}
              />
            </div>

            {/* File drop zone */}
            <div className={styles.field}>
              <span className={styles.label}>
                Upload files
                <span className={styles.hint}>
                  Up to {MAX_FILES} files. PDF, DOCX, TXT, MD. Legacy .doc not supported.
                </span>
              </span>
              <div
                className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''} ${isUploading ? styles.dropZoneDisabled : ''}`}
                onDragEnter={isUploading ? undefined : handleDrag}
                onDragLeave={isUploading ? undefined : handleDrag}
                onDragOver={isUploading ? undefined : handleDrag}
                onDrop={isUploading ? undefined : handleDrop}
              >
                <Upload size={24} className={styles.dropIcon} aria-hidden="true" />
                <p className={styles.dropText}>
                  Drag files here or{' '}
                  <label className={styles.browseLabel}>
                    browse
                    <input
                      type="file"
                      multiple
                      accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
                      onChange={(e) => e.target.files && handleFiles(e.target.files)}
                      className={styles.fileInput}
                      disabled={isUploading}
                    />
                  </label>
                </p>
              </div>
            </div>

            {/* Selected files */}
            {files.length > 0 && (
              <ul className={styles.fileList} aria-label="Selected files">
                {files.map((item, index) => (
                  <li
                    key={`${item.file.name}-${index}`}
                    className={`${styles.fileItem} ${item.error ? styles.fileItemError : ''}`}
                  >
                    <FileText size={16} aria-hidden="true" />
                    <span className={styles.fileName}>{item.file.name}</span>
                    <span className={styles.fileSize}>
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                    {item.error && (
                      <span className={styles.fileError}>
                        <AlertCircle size={14} aria-hidden="true" />
                        {item.error}
                      </span>
                    )}
                    <button
                      type="button"
                      className={styles.removeFile}
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${item.file.name}`}
                      disabled={isUploading}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* File count warning */}
            {files.length >= MAX_FILES && (
              <Alert variant="warning" title="Maximum files reached">
                You can upload up to {MAX_FILES} files at a time.
              </Alert>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/studies/${studyPublicId}/discovery`)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canVerify} loading={isUploading}>
                {isUploading ? 'Verifying...' : 'Verify files'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
