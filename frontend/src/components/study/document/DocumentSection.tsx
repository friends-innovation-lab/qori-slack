/**
 * DocumentSection — A section of the research document with heading + provenance.
 *
 * CC-4: Extended to accept FieldProvenance[] from view model (§3.9).
 * - Lock glyph shown when every entry has editable:false
 * - sourceNote shown when content is inherited
 * - Provenance tag shows view model labels verbatim
 */

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { FieldProvenance } from '@qori/artifact-contracts';
import { ProvenanceTag } from './ProvenanceTag';
import styles from './document.module.css';

/** Legacy provenance type (removed in CC-5) */
type LegacyProvenance = 'canonical' | 'generated' | 'system' | 'inherited' | 'generated+canonical';

interface DocumentSectionProps {
  sectionId: string;
  title: string;
  /** View model provenance (preferred) or legacy string */
  provenance?: FieldProvenance | FieldProvenance[] | LegacyProvenance;
  /** Legacy prop - used only with string provenance (removed in CC-5) */
  editable?: boolean;
  /** Source note for inherited content (e.g., "From the approved brief") */
  sourceNote?: ReactNode;
  children: ReactNode;
}

export function DocumentSection({
  sectionId,
  title,
  provenance,
  editable,
  sourceNote,
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
      </div>
      {sourceNote && <p className={styles.secSource}>{sourceNote}</p>}
      {children}
    </section>
  );
}
