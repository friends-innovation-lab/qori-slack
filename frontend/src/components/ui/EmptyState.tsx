/**
 * EmptyState — Heading, one-sentence explanation, primary action.
 * No decorative illustrations. Every empty state names the prerequisite step and links it.
 */

import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  heading: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ heading, description, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{heading}</h2>
      <p className={styles.description}>{description}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
