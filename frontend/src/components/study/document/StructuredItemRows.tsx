/**
 * StructuredItemRows — Container for structured item rows (hairline list style).
 * Matches design: border-top on container, border-bottom on each row.
 */

import type { ReactNode } from 'react';
import styles from './document.module.css';

interface StructuredItemRowsProps {
  children: ReactNode;
}

export function StructuredItemRows({ children }: StructuredItemRowsProps) {
  return <div className={styles.itemRows}>{children}</div>;
}
