/**
 * VersionHistoryPanel — Generation history viewing
 *
 * DR-6b-5e-B-2: Generation history with historical content viewing
 * - Lists all generation versions for a readout
 * - Allows viewing historical content (read-only)
 * - Shows version metadata (status, timestamps)
 * - Supports all generation statuses: completed, failed, superseded, pending, generating
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  History,
  ChevronRight,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import type { GenerationVersion, GenerationStatus, VersionContent } from '@/api/readouts';
import { useVersionContent } from '@/api/readouts';
import { VersionContentView } from './VersionContentView';
import styles from './readout.module.css';

/**
 * Format a date as a human-readable string
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get status display info (icon, label, color class)
 */
function getStatusDisplay(status: GenerationStatus): {
  icon: React.ReactNode;
  label: string;
  className: string;
} {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle size={14} />,
        label: 'Completed',
        className: styles.statusCompleted,
      };
    case 'failed':
      return {
        icon: <XCircle size={14} />,
        label: 'Failed',
        className: styles.statusFailed,
      };
    case 'superseded':
      return {
        icon: <AlertCircle size={14} />,
        label: 'Superseded',
        className: styles.statusSuperseded,
      };
    case 'pending':
      return {
        icon: <Clock size={14} />,
        label: 'Pending',
        className: styles.statusPending,
      };
    case 'generating':
      return {
        icon: <Loader2 size={14} className={styles.spinIcon} />,
        label: 'Generating',
        className: styles.statusGenerating,
      };
    default:
      return {
        icon: <AlertCircle size={14} />,
        label: 'Unknown',
        className: styles.statusPending,
      };
  }
}

interface VersionHistoryPanelProps {
  /** List of generation version records, newest first */
  versions: GenerationVersion[];
  /** Whether the history is loading */
  isLoading?: boolean;
  /** Error loading history */
  error?: string | null;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Project public ID for version content fetching */
  projectPublicId: string;
  /** Study public ID for version content fetching */
  studyPublicId: string;
  /** Readout public ID for version content fetching */
  readoutPublicId: string;
}

export function VersionHistoryPanel({
  versions,
  isLoading,
  error,
  onClose,
  projectPublicId,
  studyPublicId,
  readoutPublicId,
}: VersionHistoryPanelProps) {
  // Selected version for detailed view (null = list view)
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  // Track ref for close button focus management
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  // Find selected version from the list
  const selectedVersion = selectedVersionId !== null
    ? versions.find((v) => v.id === selectedVersionId) ?? null
    : null;

  // Fetch version content when a version is selected
  const {
    data: versionContentData,
    isLoading: isContentLoading,
    error: contentError,
  } = useVersionContent(
    projectPublicId,
    studyPublicId,
    readoutPublicId,
    selectedVersionId,
    { enabled: selectedVersionId !== null },
  );

  const versionContent: VersionContent | null = versionContentData?.data ?? null;

  const handleSelectVersion = useCallback((version: GenerationVersion) => {
    setSelectedVersionId(version.id);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedVersionId(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedVersionId !== null) {
          handleBackToList();
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedVersionId, handleBackToList, handleClose]);

  // Focus management when switching views
  useEffect(() => {
    if (selectedVersionId !== null && backButtonRef.current) {
      backButtonRef.current.focus();
    }
  }, [selectedVersionId]);

  return (
    <div
      className={styles.historyPanel}
      role="dialog"
      aria-label="Generation History"
      aria-modal="true"
    >
      {/* Panel Header */}
      <div className={styles.historyHeader}>
        <div className={styles.historyHeaderLeft}>
          {selectedVersion ? (
            <button
              ref={backButtonRef}
              type="button"
              className={styles.historyBackButton}
              onClick={handleBackToList}
              aria-label="Back to version list"
            >
              <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              Back
            </button>
          ) : (
            <div className={styles.historyTitle}>
              <History size={18} aria-hidden="true" />
              <h2>Generation History</h2>
            </div>
          )}
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.historyCloseButton}
          onClick={handleClose}
          aria-label="Close history panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Panel Body */}
      <div className={styles.historyBody}>
        {isLoading && (
          <div className={styles.historyLoading} role="status" aria-live="polite">
            <div className={styles.loadingSpinner} />
            <p>Loading generation history...</p>
          </div>
        )}

        {error && (
          <div className={styles.historyError} role="alert">
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && !selectedVersion && (
          <VersionList versions={versions} onSelect={handleSelectVersion} />
        )}

        {!isLoading && !error && selectedVersion && (
          <div className={styles.historySnapshotView}>
            <VersionContentViewWrapper
              version={selectedVersion}
              versionContent={versionContent}
              isLoading={isContentLoading}
              error={contentError ? 'Failed to load version content' : null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * List of version summaries
 */
interface VersionListProps {
  versions: GenerationVersion[];
  onSelect: (version: GenerationVersion) => void;
}

function VersionList({ versions, onSelect }: VersionListProps) {
  if (versions.length === 0) {
    return (
      <div className={styles.historyEmpty} role="status">
        <History size={32} aria-hidden="true" />
        <p>No generations yet</p>
        <span>This readout has no generation history.</span>
      </div>
    );
  }

  return (
    <div className={styles.versionList} role="list">
      {versions.map((version, index) => (
        <VersionListItem
          key={version.id}
          version={version}
          isLatest={index === 0}
          onSelect={() => onSelect(version)}
        />
      ))}
    </div>
  );
}

/**
 * Individual version summary item
 */
interface VersionListItemProps {
  version: GenerationVersion;
  isLatest: boolean;
  onSelect: () => void;
}

function VersionListItem({ version, isLatest, onSelect }: VersionListItemProps) {
  const { versionNumber, generationStatus, generationCompletedAt, createdAt } = version;
  const statusDisplay = getStatusDisplay(generationStatus);

  // Determine which timestamp to show
  const displayTimestamp = generationCompletedAt ?? createdAt;

  return (
    <button
      type="button"
      className={styles.versionListItem}
      onClick={onSelect}
      aria-label={`View version ${versionNumber}`}
      role="listitem"
    >
      <div className={styles.versionListItemHeader}>
        <span className={styles.versionListItemNumber}>
          Version {versionNumber}
          {isLatest && <span className={styles.latestBadge}>Latest</span>}
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </div>
      <div className={styles.versionListItemMeta}>
        <span className={`${styles.versionListItemMetaItem} ${statusDisplay.className}`}>
          {statusDisplay.icon}
          {statusDisplay.label}
        </span>
        <span className={styles.versionListItemMetaItem}>
          <Clock size={12} aria-hidden="true" />
          {formatDate(displayTimestamp)}
        </span>
      </div>
      {version.evidenceSet.length > 0 && (
        <div className={styles.versionListItemEvidence}>
          <FileText size={12} aria-hidden="true" />
          <span>{version.evidenceSet.length} evidence items</span>
        </div>
      )}
    </button>
  );
}

/**
 * Wrapper to handle loading/error states for version content
 */
interface VersionContentViewWrapperProps {
  version: GenerationVersion;
  versionContent: VersionContent | null;
  isLoading: boolean;
  error: string | null;
}

function VersionContentViewWrapper({
  version,
  versionContent,
  isLoading,
  error,
}: VersionContentViewWrapperProps) {
  if (isLoading) {
    return (
      <div className={styles.historyLoading} role="status" aria-live="polite">
        <div className={styles.loadingSpinner} />
        <p>Loading version content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.historyError} role="alert">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <VersionContentView
      version={version}
      versionContent={versionContent}
    />
  );
}
