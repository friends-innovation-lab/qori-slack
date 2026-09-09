/**
 * ErrorState — Plain-language cause + one recovery action.
 */

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  message: string;
  action?: ReactNode;
}

export function ErrorState({ message, action }: ErrorStateProps) {
  return (
    <div className={styles.container} role="alert">
      <AlertTriangle size={24} className={styles.icon} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
