/**
 * VersionContentView — Read-only rendering of generated version content
 *
 * DR-6b-5e-B-2: Historical content viewing
 * - Renders generation version content read-only
 * - Shows Summary, Findings, Limitations, Implications
 * - Displays pinned evidence with exact persisted identifiers
 * - Handles versions with or without content
 * - Shows appropriate status for non-completed generations
 *
 * IMPORTANT: This is a read-only generated version. Its content may differ
 * from the current draft. Review the current draft before continuing.
 */

import { Clock, FileText, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type {
  GenerationVersion,
  GenerationStatus,
  VersionContent,
  DraftContent,
  VersionEvidenceEntry,
} from '@/api/readouts';
import { CitationChip } from './CitationChip';
import { KindLabel } from './KindLabel';
import { FindingLink } from './FindingLink';
import styles from './readout.module.css';

/**
 * Format a date as a relative time string
 */
function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get status display info
 */
function getStatusInfo(status: GenerationStatus): {
  icon: React.ReactNode;
  label: string;
  description: string;
  className: string;
} {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle size={16} />,
        label: 'Completed',
        description: 'Generation completed successfully.',
        className: styles.versionStatusCompleted,
      };
    case 'failed':
      return {
        icon: <XCircle size={16} />,
        label: 'Failed',
        description: 'Generation encountered an error and did not complete.',
        className: styles.versionStatusFailed,
      };
    case 'superseded':
      return {
        icon: <AlertCircle size={16} />,
        label: 'Superseded',
        description: 'This generation was superseded by a newer generation request.',
        className: styles.versionStatusSuperseded,
      };
    case 'pending':
      return {
        icon: <Clock size={16} />,
        label: 'Pending',
        description: 'Generation is queued and waiting to start.',
        className: styles.versionStatusPending,
      };
    case 'generating':
      return {
        icon: <Loader2 size={16} className={styles.spinIcon} />,
        label: 'Generating',
        description: 'Generation is currently in progress.',
        className: styles.versionStatusGenerating,
      };
    default:
      return {
        icon: <AlertCircle size={16} />,
        label: 'Unknown',
        description: 'Status unknown.',
        className: styles.versionStatusPending,
      };
  }
}

interface VersionContentViewProps {
  /** The generation version record */
  version: GenerationVersion;
  /** The fetched version content (null if not yet loaded or failed generation) */
  versionContent: VersionContent | null;
}

export function VersionContentView({ version, versionContent }: VersionContentViewProps) {
  const { versionNumber, generationStatus, generationCompletedAt, createdAt, evidenceSet } = version;

  const statusInfo = getStatusInfo(generationStatus);
  const hasContent = versionContent?.hasContent ?? false;
  const content = versionContent?.content ?? null;

  // Determine which timestamp to display
  const displayTimestamp = generationCompletedAt ?? createdAt;

  return (
    <div className={styles.versionSnapshot}>
      {/* Version Badge */}
      <div className={styles.versionBadge}>
        <FileText size={16} aria-hidden="true" />
        <span>Version {versionNumber}</span>
      </div>

      {/* Version Metadata */}
      <div className={styles.versionMetadata}>
        <div className={`${styles.versionMetaItem} ${statusInfo.className}`}>
          {statusInfo.icon}
          <span>{statusInfo.label}</span>
        </div>
        <div className={styles.versionMetaItem}>
          <Clock size={14} aria-hidden="true" />
          <span>{formatTimeAgo(displayTimestamp)}</span>
        </div>
      </div>

      {/* Read-Only Notice */}
      <div className={styles.readOnlyNotice} role="alert">
        <AlertCircle size={14} aria-hidden="true" />
        <p>
          This is a read-only generated version. Its content may differ from the current draft.
          Review the current draft before continuing.
        </p>
      </div>

      {/* Evidence Set */}
      {evidenceSet.length > 0 && (
        <div className={styles.versionEvidenceSection}>
          <h4 className={styles.versionEvidenceTitle}>
            Pinned Evidence <span className={styles.sectionCount}>{evidenceSet.length} items</span>
          </h4>
          <div className={styles.versionEvidenceList}>
            {evidenceSet.map((entry) => (
              <EvidenceEntryChip key={entry.revisionPublicId} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Content or Status-appropriate Empty State */}
      {hasContent && content ? (
        <VersionContentSections content={content} />
      ) : (
        <NoContentState status={generationStatus} statusInfo={statusInfo} />
      )}
    </div>
  );
}

/**
 * Evidence entry chip showing exact persisted identifiers
 */
interface EvidenceEntryChipProps {
  entry: VersionEvidenceEntry;
}

function EvidenceEntryChip({ entry }: EvidenceEntryChipProps) {
  return (
    <div className={styles.versionEvidenceChip}>
      <span className={styles.versionEvidenceId}>{entry.displayId}</span>
      <span className={styles.versionEvidenceRevision}>r{entry.revisionNumber}</span>
    </div>
  );
}

/**
 * Content sections (Summary, Findings, Limitations, Implications)
 */
interface VersionContentSectionsProps {
  content: DraftContent;
}

function VersionContentSections({ content }: VersionContentSectionsProps) {
  const findings = content.findings ?? [];
  const limitations = content.limitations ?? [];
  const implications = content.implications ?? [];

  return (
    <div className={styles.snapshotContent}>
      {/* Summary */}
      <section className={styles.snapshotSection}>
        <h3 className={styles.snapshotSectionTitle}>Summary</h3>
        <div className={styles.snapshotNarrativeBlock}>
          <p className={styles.snapshotText}>
            {content.summary?.text || <em>No summary</em>}
          </p>
          {(content.summary?.citations ?? []).length > 0 && (
            <div className={styles.citationsRow}>
              <span className={styles.citationsLabel}>Citations:</span>
              {content.summary?.citations?.map((citation, index) => (
                <CitationChip
                  key={`${citation.constructPublicId}-${index}`}
                  citation={citation}
                  readOnly
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Findings */}
      <section className={styles.snapshotSection}>
        <h3 className={styles.snapshotSectionTitle}>
          Findings <span className={styles.sectionCount}>{findings.length} items</span>
        </h3>
        {findings.length === 0 ? (
          <p className={styles.snapshotEmpty}>No findings</p>
        ) : (
          findings.map((finding, index) => (
            <SnapshotFinding key={finding.id} finding={finding} index={index} />
          ))
        )}
      </section>

      {/* Limitations */}
      <section className={styles.snapshotSection}>
        <h3 className={styles.snapshotSectionTitle}>
          Evidence Limitations <span className={styles.sectionCount}>{limitations.length} items</span>
        </h3>
        {limitations.length === 0 ? (
          <p className={styles.snapshotEmpty}>No limitations</p>
        ) : (
          limitations.map((limitation, index) => (
            <div key={limitation.id} className={styles.snapshotNarrativeBlock}>
              <div className={styles.narrativeHeader}>
                <span className={styles.narrativeId}>L{index + 1}</span>
              </div>
              <p className={styles.snapshotText}>{limitation.text}</p>
            </div>
          ))
        )}
      </section>

      {/* Implications */}
      <section className={styles.snapshotSection}>
        <h3 className={styles.snapshotSectionTitle}>
          Implications for the Research Brief{' '}
          <span className={styles.sectionCount}>{implications.length} items</span>
        </h3>
        {implications.length === 0 ? (
          <p className={styles.snapshotEmpty}>No implications</p>
        ) : (
          implications.map((implication, index) => (
            <SnapshotImplication
              key={implication.id}
              implication={implication}
              index={index}
              findings={findings}
            />
          ))
        )}
      </section>
    </div>
  );
}

/**
 * Snapshot finding display (read-only)
 */
interface SnapshotFindingProps {
  finding: NonNullable<DraftContent['findings']>[number];
  index: number;
}

function SnapshotFinding({ finding, index }: SnapshotFindingProps) {
  return (
    <div className={styles.snapshotNarrativeBlock}>
      <div className={styles.narrativeHeader}>
        <span className={styles.narrativeId}>F{index + 1}</span>
      </div>
      <p className={styles.snapshotText}>{finding.text}</p>
      {finding.citations.length > 0 && (
        <div className={styles.citationsRow}>
          <span className={styles.citationsLabel}>Citations:</span>
          {finding.citations.map((citation, citationIndex) => (
            <CitationChip
              key={`${citation.constructPublicId}-${citationIndex}`}
              citation={citation}
              readOnly
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Snapshot implication display (read-only)
 */
interface SnapshotImplicationProps {
  implication: NonNullable<DraftContent['implications']>[number];
  index: number;
  findings: NonNullable<DraftContent['findings']>;
}

function SnapshotImplication({ implication, index, findings }: SnapshotImplicationProps) {
  return (
    <div className={styles.snapshotNarrativeBlock}>
      <div className={styles.narrativeHeader}>
        <span className={styles.narrativeId}>I{index + 1}</span>
        <div className={styles.narrativeKind}>
          <KindLabel kind={implication.kind} />
        </div>
      </div>
      <p className={styles.snapshotText}>{implication.text}</p>
      {implication.basedOnFindings.length > 0 && (
        <div className={styles.basedOnRow}>
          <span className={styles.basedOnLabel}>Based on:</span>
          {implication.basedOnFindings.map((findingId) => {
            const findingIndex = findings.findIndex((f) => f.id === findingId);
            if (findingIndex < 0) {
              // Finding not found - show ID as fallback
              return (
                <span key={findingId} className={styles.findingLink}>
                  {findingId.slice(0, 6)}
                </span>
              );
            }
            return <FindingLink key={findingId} index={findingIndex} />;
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Empty state for versions without content
 */
interface NoContentStateProps {
  status: GenerationStatus;
  statusInfo: {
    icon: React.ReactNode;
    description: string;
    className: string;
  };
}

function NoContentState({ status, statusInfo }: NoContentStateProps) {
  // Provide appropriate messaging based on status
  const getMessage = () => {
    switch (status) {
      case 'pending':
        return 'This generation has not started yet. Content will be available once generation completes.';
      case 'generating':
        return 'Generation is currently in progress. Content will be available once generation completes.';
      case 'failed':
        return 'Generation failed and did not produce content.';
      case 'superseded':
        return 'This generation was superseded before it completed. No content was stored.';
      case 'completed':
        return 'No content is stored for this version.';
      default:
        return 'No content available for this version.';
    }
  };

  return (
    <div className={styles.versionNoContent} role="status">
      <div className={`${styles.versionNoContentIcon} ${statusInfo.className}`}>
        {statusInfo.icon}
      </div>
      <p className={styles.versionNoContentMessage}>{getMessage()}</p>
    </div>
  );
}
