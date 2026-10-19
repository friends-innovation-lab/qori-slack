/**
 * ApprovedViewSnapshot — Immutable rendering of approved content
 *
 * DR-6b-4e-F1 Scope C: Immutable approved view rendering
 * - Renders latestApproval.contentSnapshot read-only
 * - Shows findingsCheckedSnapshot and implicationsReviewedSnapshot
 * - Displays approval metadata (approvedAt, approvedByActorId, approvalNote)
 * - No edit capabilities — fully immutable
 */

import { CheckCircle, Clock, Lock, User } from 'lucide-react';
import type { ApprovalDetail, DraftContent } from '@/api/readouts';
import { CitationChip } from './CitationChip';
import { KindLabel } from './KindLabel';
import { FindingLink } from './FindingLink';
import styles from './readout.module.css';

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
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

interface ApprovedViewSnapshotProps {
  /** The approval record with immutable content snapshot */
  approval: ApprovalDetail;
  /** Whether this is a historical view (vs current latest approval) */
  isHistorical?: boolean;
}

export function ApprovedViewSnapshot({ approval, isHistorical = false }: ApprovedViewSnapshotProps) {
  const {
    approvalNumber,
    approvedAt,
    approvedByActorId,
    approvalNote,
    contentSnapshot,
    findingsCheckedSnapshot,
    implicationsReviewedSnapshot,
    supersessionNotes,
  } = approval;

  const findings = contentSnapshot.findings ?? [];
  const limitations = contentSnapshot.limitations ?? [];
  const implications = contentSnapshot.implications ?? [];

  return (
    <div className={styles.approvedSnapshot}>
      {/* Approval Badge */}
      <div className={styles.approvalBadge}>
        <Lock size={16} />
        <span>
          {isHistorical ? `Approval #${approvalNumber}` : `Current Approval (v${approvalNumber})`}
        </span>
      </div>

      {/* Approval Metadata */}
      <div className={styles.approvalMetadata}>
        <div className={styles.approvalMetaItem}>
          <Clock size={14} />
          <span>Approved {formatTimeAgo(approvedAt)}</span>
        </div>
        <div className={styles.approvalMetaItem}>
          <User size={14} />
          <span>Actor #{approvedByActorId}</span>
        </div>
      </div>

      {/* Approval Note */}
      {approvalNote && (
        <div className={styles.approvalNote}>
          <strong>Approval note:</strong> {approvalNote}
        </div>
      )}

      {/* Supersession Notes */}
      {supersessionNotes && Object.keys(supersessionNotes).length > 0 && (
        <div className={styles.supersessionNotesDisplay}>
          <strong>Supersession justifications:</strong>
          <ul className={styles.supersessionNotesList}>
            {Object.entries(supersessionNotes).map(([revisionPublicId, note]) => (
              <li key={revisionPublicId}>
                <code>{revisionPublicId}</code>: {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content Snapshot */}
      <div className={styles.snapshotContent}>
        {/* Summary */}
        <section className={styles.snapshotSection}>
          <h3 className={styles.snapshotSectionTitle}>Summary</h3>
          <div className={styles.snapshotNarrativeBlock}>
            <p className={styles.snapshotText}>
              {contentSnapshot.summary?.text || <em>No summary</em>}
            </p>
            {(contentSnapshot.summary?.citations ?? []).length > 0 && (
              <div className={styles.citationsRow}>
                <span className={styles.citationsLabel}>Citations:</span>
                {contentSnapshot.summary?.citations?.map((citation, index) => (
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
              <SnapshotFinding
                key={finding.id}
                finding={finding}
                index={index}
                isChecked={findingsCheckedSnapshot.includes(finding.id)}
              />
            ))
          )}
        </section>

        {/* Limitations */}
        <section className={styles.snapshotSection}>
          <h3 className={styles.snapshotSectionTitle}>
            Evidence Limitations{' '}
            <span className={styles.sectionCount}>{limitations.length} items</span>
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
                isReviewed={implicationsReviewedSnapshot.includes(implication.id)}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Snapshot finding display (read-only)
 */
interface SnapshotFindingProps {
  finding: DraftContent['findings'] extends (infer T)[] | undefined ? NonNullable<T> : never;
  index: number;
  isChecked: boolean;
}

function SnapshotFinding({ finding, index, isChecked }: SnapshotFindingProps) {
  return (
    <div className={styles.snapshotNarrativeBlock}>
      <div className={styles.narrativeHeader}>
        <span className={styles.narrativeId}>F{index + 1}</span>
        {isChecked && (
          <span className={styles.checkedBadge}>
            <CheckCircle size={14} />
            Checked
          </span>
        )}
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
  isReviewed: boolean;
}

function SnapshotImplication({
  implication,
  index,
  findings,
  isReviewed,
}: SnapshotImplicationProps) {
  return (
    <div className={styles.snapshotNarrativeBlock}>
      <div className={styles.narrativeHeader}>
        <span className={styles.narrativeId}>I{index + 1}</span>
        <div className={styles.narrativeKind}>
          <KindLabel kind={implication.kind} />
          {isReviewed && (
            <span className={styles.reviewedBadge}>
              <CheckCircle size={14} />
              Reviewed
            </span>
          )}
        </div>
      </div>
      <p className={styles.snapshotText}>{implication.text}</p>
      {implication.basedOnFindings.length > 0 && (
        <div className={styles.basedOnRow}>
          <span className={styles.basedOnLabel}>Based on:</span>
          {implication.basedOnFindings.map((findingId) => {
            const findingIndex = findings.findIndex((f) => f.id === findingId);
            if (findingIndex < 0) {
              // Finding not found in snapshot - show ID as fallback
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
