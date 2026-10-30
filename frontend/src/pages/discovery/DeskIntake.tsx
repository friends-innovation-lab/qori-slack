/**
 * DeskIntake — DISC-3, DISC-WEB-1C
 *
 * NAV-1a: Removed page-level LifecycleRail — now owned by StudyWorkspaceLayout.
 *
 * Desk Research intake form for adding documents to Discovery.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §5.2.
 *
 * DISC-WEB-1C: Two-phase upload flow:
 * 1. Select files and click "Verify files" to upload to extraction endpoint
 * 2. View extraction results (staged files, rejected files)
 * 3. "Start analysis" creates Discovery run (future PR — not wired here)
 *
 * Fields:
 * - Topic: "What topic are you exploring?"
 * - Source intent: "What do you need this source to tell you?"
 * - Files: Drop zone (10 files max, pdf/docx/txt/md — NOT .doc)
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Upload, X, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import {
  useUploadDocuments,
  ERROR_FEATURE_DISABLED,
} from '@/api/mutations/useUploadDocuments';
import type { ExtractedRef, RejectedFile } from '@qori/api-contracts';
import { WorkspaceLayout, useStudyWorkspace } from '@/components/study/workspace';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import styles from './IntakeForm.module.css';
import docStyles from '@/components/study/document/document.module.css';

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

  // Upload mutation (does NOT trigger AI)
  const uploadMutation = useUploadDocuments(projectPublicId);

  // File validation
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

  // Handle file selection
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

  // Remove file
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadState({ phase: 'selecting' });
  }, []);

  // Drag handlers
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

  // Upload files for extraction verification (does NOT create Discovery run)
  const handleVerifyFiles = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get valid files only
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
      // Handle specific error cases
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

  // Reset to file selection
  const handleReset = () => {
    setFiles([]);
    setUploadState({ phase: 'selecting' });
  };

  // Retry upload after transient error
  const handleRetry = () => {
    setUploadState({ phase: 'selecting' });
  };

  // Computed state
  const validFileCount = files.filter((f) => !f.error).length;
  const canVerify =
    validFileCount > 0 &&
    uploadState.phase === 'selecting';
  const isUploading = uploadState.phase === 'uploading';

  // ─── Render ─────────────────────────────────────────────────────────

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
    const hasRefs = refs.length > 0;
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

            {/* Successfully staged files */}
            {hasRefs && (
              <div className={styles.field}>
                <span className={styles.label}>
                  <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                  {' '}Extracted files ({refs.length})
                </span>
                <ul className={styles.fileList} aria-label="Extracted files">
                  {refs.map((ref) => (
                    <li key={ref.refToken} className={styles.fileItem}>
                      <FileText size={16} aria-hidden="true" />
                      <span className={styles.fileName}>{ref.filename}</span>
                      <span className={styles.fileSize}>
                        {(ref.sizeBytes / 1024).toFixed(0)} KB
                      </span>
                      <span className={styles.fileDetail}>
                        {ref.charCount.toLocaleString()} chars
                      </span>
                      <span className={styles.fileDetail} title={`Expires: ${ref.expiresAt}`}>
                        <Clock size={12} aria-hidden="true" />
                        {' '}30 min
                      </span>
                    </li>
                  ))}
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
              {hasRefs && (
                <Button
                  type="button"
                  disabled
                  title="Start analysis will be available in a future update"
                >
                  Start analysis (coming soon)
                </Button>
              )}
            </div>

            {/* Expiration notice */}
            {hasRefs && (
              <Alert variant="info" title="Staged files expire">
                Extracted files are staged for 30 minutes. After that, you will need to
                upload them again.
              </Alert>
            )}
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
