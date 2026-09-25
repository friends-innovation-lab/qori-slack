/**
 * CollapsibleSection — <details> wrapper for system metadata sections.
 *
 * VC-2B: Chevron + optional summary per COMPONENT_DELTAS §2.
 */

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './document.module.css';

interface CollapsibleSectionProps {
  title: string;
  /** Optional right-aligned summary text */
  summary?: string;
  children: ReactNode;
}

export function CollapsibleSection({ title, summary, children }: CollapsibleSectionProps) {
  return (
    <details className={styles.collapsible}>
      <summary>
        <span className={styles.collapsibleChevron} aria-hidden="true">
          <ChevronRight size={12} />
        </span>
        <span className={styles.collapsibleTitle}>{title}</span>
        {summary && <span className={styles.collapsibleSummary}>{summary}</span>}
      </summary>
      <div className={styles.collapsibleInner}>{children}</div>
    </details>
  );
}
