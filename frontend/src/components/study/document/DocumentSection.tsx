/**
 * DocumentSection — A section of the research document with heading + provenance.
 *
 * CC-4: Extended to accept FieldProvenance[] from view model (§3.9).
 * - Lock glyph shown when every entry has editable:false
 * - sourceNote shown when content is inherited
 * - Provenance tag shows view model labels verbatim
 *
 * CMT-7: Added comment affordance for section-level comments.
 * - Shows open thread count when > 0
 * - Shows subtle icon on hover/focus when count = 0
 * - Opens Comments rail scoped to this section
 */

import type { ReactNode } from 'react';
import { Lock, MessageSquare } from 'lucide-react';
import type { FieldProvenance } from '@qori/artifact-contracts';
import { ProvenanceTag } from './ProvenanceTag';
import styles from './document.module.css';

/** Legacy provenance type (removed in CC-5) */
type LegacyProvenance = 'canonical' | 'generated' | 'system' | 'inherited' | 'generated+canonical';

/** CMT-7: Comment affordance props */
export interface SectionCommentProps {
  /** Number of open threads for this section */
  count: number;
  /** Handler to open Comments rail scoped to this section */
  onOpen: () => void;
  /** Section label for accessible naming (falls back to title) */
  label?: string;
}

interface DocumentSectionProps {
  sectionId: string;
  title: string;
  /** View model provenance (preferred) or legacy string */
  provenance?: FieldProvenance | FieldProvenance[] | LegacyProvenance;
  /** Legacy prop - used only with string provenance (removed in CC-5) */
  editable?: boolean;
  /** Source note for inherited content (e.g., "From the approved brief") */
  sourceNote?: ReactNode;
  /** CMT-7: Comment affordance for section-scoped comments */
  comment?: SectionCommentProps;
  children: ReactNode;
}

export function DocumentSection({
  sectionId,
  title,
  provenance,
  editable,
  sourceNote,
  comment,
  children,
}: DocumentSectionProps) {
  const headingId = `sec-${sectionId}-h`;

  // Determine if section is locked (all entries read-only)
  let locked = false;
  if (provenance && typeof provenance === 'object') {
    const list = Array.isArray(provenance) ? provenance : [provenance];
    locked = list.length > 0 && list.every((p) => !p.editable);
  } else if (editable === false) {
    locked = true;
  }

  // CMT-7: Build accessible label for comment affordance
  const commentLabel = comment?.label || title;
  const commentAriaLabel =
    comment && comment.count > 0
      ? `Open comments for ${commentLabel}, ${comment.count} open ${comment.count === 1 ? 'thread' : 'threads'}`
      : `No open comments for ${commentLabel}. Add a comment.`;

  return (
    <section
      className={styles.docSec}
      data-sec={sectionId}
      id={`sec-${sectionId}`}
      aria-labelledby={headingId}
    >
      <div className={styles.secHead}>
        <h2 className={styles.secHeading} id={headingId}>
          {title}
        </h2>
        {locked && (
          <span className={styles.secLock} aria-hidden="true" title="Read-only">
            <Lock size={14} />
          </span>
        )}
        {provenance && (
          <ProvenanceTag provenance={provenance} editable={editable} />
        )}
        {/* CMT-7: Section comment affordance */}
        {comment && (
          <button
            type="button"
            className={`${styles.secComment} ${comment.count > 0 ? styles.secCommentActive : ''}`}
            onClick={comment.onOpen}
            aria-label={commentAriaLabel}
          >
            <MessageSquare size={14} aria-hidden="true" />
            {comment.count > 0 && (
              <span className={styles.secCommentCount}>{comment.count}</span>
            )}
          </button>
        )}
      </div>
      {sourceNote && <p className={styles.secSource}>{sourceNote}</p>}
      {children}
    </section>
  );
}
