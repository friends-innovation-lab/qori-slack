/**
 * GenerationFailure — Failure display after generation fails
 *
 * DR-6b-5d-B: Initial generation UI
 * - Shows sanitized backend error
 * - Guidance text
 * - No retry button (retry initiation is out of scope for DR-6b-5d-B)
 */

import { AlertCircle } from 'lucide-react';
import styles from './readout.module.css';

interface GenerationFailureProps {
  /** Error message from the backend (sanitized) */
  error: string | null;
}

export function GenerationFailure({ error }: GenerationFailureProps) {
  return (
    <div className={styles.generationFailure}>
      <div className={styles.failureIcon}>
        <AlertCircle size={24} />
      </div>
      <div className={styles.failureContent}>
        <h3 className={styles.failureTitle}>Generation failed</h3>
        <p className={styles.failureMessage}>
          {error || 'An unexpected error occurred during generation.'}
        </p>
        <p className={styles.failureGuidance}>
          You can still edit the readout manually. If this issue persists, please contact
          support.
        </p>
      </div>
    </div>
  );
}

export type { GenerationFailureProps };
