/**
 * CollapsibleSection — <details> wrapper for system metadata sections.
 */

import type { ReactNode } from 'react';
import styles from './document.module.css';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
}

export function CollapsibleSection({ title, children }: CollapsibleSectionProps) {
  return (
    <details className={styles.collapsible}>
      <summary>{title}</summary>
      <div className={styles.collapsibleInner}>{children}</div>
    </details>
  );
}
