/**
 * DocumentSection — A section of the research document with heading + provenance.
 */

import type { ReactNode } from 'react';
import { ProvenanceTag } from './ProvenanceTag';
import styles from './document.module.css';

interface DocumentSectionProps {
  sectionId: string;
  title: string;
  provenance?: 'canonical' | 'generated' | 'system' | 'inherited';
  editable?: boolean;
  children: ReactNode;
}

export function DocumentSection({
  sectionId,
  title,
  provenance,
  editable,
  children,
}: DocumentSectionProps) {
  return (
    <section className={styles.docSec} data-sec={sectionId}>
      <h2 className={styles.secHeading}>
        {title}
        {provenance && <ProvenanceTag provenance={provenance} editable={editable} />}
      </h2>
      {children}
    </section>
  );
}
