/**
 * SaveStateIndicator — "Saved · 9:41 AM" with colored dot.
 */

import styles from './document.module.css';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface SaveStateIndicatorProps {
  state: SaveState;
  label?: string;
}

const dotClass: Record<SaveState, string> = {
  saved: styles.saveDot,
  dirty: `${styles.saveDot} ${styles.saveDotDirty}`,
  saving: `${styles.saveDot} ${styles.saveDotSaving}`,
  error: `${styles.saveDot} ${styles.saveDotError}`,
};

export function SaveStateIndicator({ state, label }: SaveStateIndicatorProps) {
  const defaultLabel = state === 'saved'
    ? `Saved · ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : state === 'dirty' ? 'Unsaved changes'
    : state === 'saving' ? 'Saving...'
    : 'Save failed — retry';

  return (
    <span className={styles.saveState} aria-live="polite">
      <span className={dotClass[state]} />
      {label || defaultLabel}
    </span>
  );
}
