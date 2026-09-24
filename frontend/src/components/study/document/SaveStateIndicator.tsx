/**
 * SaveStateIndicator — "Saved · 9:41 AM" with colored dot.
 *
 * CC-4: Extended with savedAt prop (fixes PF-07).
 * Never formats new Date() - only shows time when savedAt is provided.
 */

import styles from './document.module.css';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface SaveStateIndicatorProps {
  state: SaveState;
  /** Override the default label */
  label?: string;
  /** ISO timestamp for "Saved · {time}" display */
  savedAt?: string;
}

const dotClass: Record<SaveState, string> = {
  saved: styles.saveDot,
  dirty: `${styles.saveDot} ${styles.saveDotDirty}`,
  saving: `${styles.saveDot} ${styles.saveDotSaving}`,
  error: `${styles.saveDot} ${styles.saveDotError}`,
};

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SaveStateIndicator({ state, label, savedAt }: SaveStateIndicatorProps) {
  // Determine display label
  let displayLabel: string;
  if (label) {
    displayLabel = label;
  } else if (state === 'saved') {
    // Only show time if savedAt is provided (fixes PF-07)
    displayLabel = savedAt ? `Saved · ${formatTime(savedAt)}` : 'Saved';
  } else if (state === 'dirty') {
    displayLabel = 'Unsaved changes';
  } else if (state === 'saving') {
    displayLabel = 'Saving...';
  } else {
    displayLabel = 'Save failed — retry';
  }

  return (
    <span className={styles.saveState} aria-live="polite">
      <span className={dotClass[state]} />
      {displayLabel}
    </span>
  );
}
