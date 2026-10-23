/**
 * GenerationProgress — Progress indicator during readout generation
 *
 * DR-6b-5d-B: Initial generation UI
 * - Shows pending/generating status without ETA
 * - Polling indicator
 * - Clean status message
 */

import { Loader2 } from 'lucide-react';
import type { GenerationStatus } from '@/api/readouts';
import styles from './readout.module.css';

interface GenerationProgressProps {
  status: GenerationStatus;
  /** True if polling encountered an error (distinct from generation failure) */
  pollingError?: boolean;
  onRetryPolling?: () => void;
}

export function GenerationProgress({
  status,
  pollingError = false,
  onRetryPolling,
}: GenerationProgressProps) {
  // Polling error is distinct from terminal generation failure
  if (pollingError) {
    return (
      <div className={styles.generationProgress}>
        <div className={styles.progressPollingError}>
          <span>Unable to check generation status.</span>
          {onRetryPolling && (
            <button
              type="button"
              className={styles.retryLink}
              onClick={onRetryPolling}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const statusMessage = getStatusMessage(status);

  return (
    <div className={styles.generationProgress}>
      <div className={styles.progressIndicator}>
        <Loader2 size={24} className={styles.progressSpinner} />
      </div>
      <div className={styles.progressContent}>
        <p className={styles.progressStatus}>{statusMessage}</p>
        <p className={styles.progressHint}>
          This may take a few moments. You can navigate away and return later.
        </p>
      </div>
    </div>
  );
}

function getStatusMessage(status: GenerationStatus): string {
  switch (status) {
    case 'pending':
      return 'Generation queued...';
    case 'generating':
      return 'Generating readout content...';
    default:
      return 'Processing...';
  }
}

export type { GenerationProgressProps };
