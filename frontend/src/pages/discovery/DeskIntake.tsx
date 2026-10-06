/**
 * DeskIntake — DISC-3
 *
 * Desk Research intake form for adding documents to Discovery.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §5.2.
 *
 * Fields:
 * - Topic: "What topic are you exploring?"
 * - Source intent: "What do you need this source to tell you?"
 * - Files: Drop zone (10 files max, pdf/docx/doc/txt/md)
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { FileText, Upload, X, AlertCircle } from 'lucide-react';
import { useStudy } from '@/api/queries/useStudy';
import { useCreateDiscoveryRun } from '@/api/mutations/useCreateDiscoveryRun';
import { WorkspaceLayout } from '@/components/study/workspace/WorkspaceLayout';
import { LifecycleRail, type DiscoveryCounts } from '@/components/study/LifecycleRail';
import { computeLifecycleNodes } from '@/components/study/lifecycle';
import { useDiscoveryCounts } from '@/api/queries/useDiscovery';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import styles from './IntakeForm.module.css';
import docStyles from '@/components/study/document/document.module.css';

/** Allowed file extensions */
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt', 'md'];
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface SelectedFile {
  file: File;
  error?: string;
}

/** Extract text content from a file (placeholder — real impl needs backend) */
async function extractTextFromFile(file: File): Promise<string> {
  // For text files, read directly
  if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    return await file.text();
  }
  // For other types, we'd need server-side extraction
  // For now, return a placeholder
  return `[Content from ${file.name} - extraction pending]`;
}

/** Generate content hash (SHA-256, first 32 chars) */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 32);
}

export function DeskIntake() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const navigate = useNavigate();

  // Form state
  const [topic, setTopic] = useState('');
  const [sourceIntent, setSourceIntent] = useState('');
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for nav drawer
  const [navOpen, setNavOpen] = useState(false);

  // Fetch study to get project_public_id
  const { data: study, isLoading: studyLoading, error: studyError } = useStudy(studyPublicId || '');

  const projectPublicId = study?.project_public_id || '';
  const countsResult = useDiscoveryCounts(projectPublicId, { enabled: !!projectPublicId });

  const createRun = useCreateDiscoveryRun(projectPublicId);

  // Build lifecycle rail counts
  const discoveryCounts: DiscoveryCounts | undefined = countsResult.data
    ? {
        desk: countsResult.data.desk,
        stakeholder: countsResult.data.stakeholder,
        survey: countsResult.data.survey,
        needsReview: countsResult.data.needsReview,
      }
    : undefined;

  const lifecycleNodes = computeLifecycleNodes(null);

  // File validation
  const validateFile = useCallback((file: File): string | undefined => {
    const ext = file.name.split('.').pop()?.toLowerCase();
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
          setError(`Maximum ${MAX_FILES} files allowed`);
          return combined.slice(0, MAX_FILES);
        }
        return combined;
      });
    },
    [validateFile],
  );

  // Remove file
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate topic
    if (!topic.trim()) {
      setError('Topic is required');
      return;
    }

    // Check for files without errors
    const validFiles = files.filter((f) => !f.error);
    if (validFiles.length === 0) {
      setError('At least one valid file is required');
      return;
    }

    setSubmitting(true);

    try {
      // Prepare sources with extracted content
      const sources = await Promise.all(
        validFiles.map(async ({ file }) => {
          const extractedText = await extractTextFromFile(file);
          const contentHash = await hashContent(extractedText);
          return {
            filename: file.name,
            extractedText,
            contentHash,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            metadata: {
              source: 'rest' as const,
            },
          };
        }),
      );

      // Create the run
      const result = await createRun.mutateAsync({
        discoveryType: 'desk_research',
        topic: topic.trim(),
        sourceIntent: sourceIntent.trim() || null,
        sources,
      });

      // Navigate to the run page
      navigate(`/studies/${studyPublicId}/discovery/runs/${result.data.publicId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Discovery run');
      setSubmitting(false);
    }
  };

  // Loading state
  if (studyLoading) {
    return <Skeleton variant="card" count={3} />;
  }

  // Error state
  if (studyError || !study) {
    return <ErrorState message={studyError?.message || 'Could not load study'} />;
  }

  // Study info for lifecycle rail
  const studyInfo = {
    name: study.name,
    backTo: '/',
    backLabel: 'All studies',
  };

  const canSubmit = topic.trim() && files.some((f) => !f.error) && !submitting;

  return (
    <WorkspaceLayout
      nav={
        <LifecycleRail
          variant="inverse"
          studyPublicId={studyPublicId || ''}
          nodes={lifecycleNodes}
          study={studyInfo}
          discoveryCounts={discoveryCounts}
        />
      }
      header={
        <div className={styles.header}>
          <span className={styles.eyebrow}>Desk Research</span>
          <h1 className={styles.title}>Add documents</h1>
          <p className={styles.description}>
            Upload reports, studies, policy documents, or other desk research. Qori will
            analyze them and extract key themes, barriers, and knowledge gaps.
          </p>
        </div>
      }
      navOpen={navOpen}
      onNavClose={() => setNavOpen(false)}
    >
      <div className={docStyles.docWrap}>
        <div className={docStyles.docCol}>
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <Alert variant="error" title="Error">
                {error}
              </Alert>
            )}

            {/* Topic */}
            <div className={styles.field}>
              <Input
                id="topic"
                label="What topic are you exploring?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Accessibility policy compliance"
                required
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
              />
            </div>

            {/* File drop zone */}
            <div className={styles.field}>
              <span className={styles.label}>
                Upload files
                <span className={styles.hint}>
                  Up to {MAX_FILES} files. PDF, DOCX, DOC, TXT, MD.
                </span>
              </span>
              <div
                className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
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
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/studies/${studyPublicId}/discovery`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit} loading={submitting}>
                Start analysis
              </Button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
