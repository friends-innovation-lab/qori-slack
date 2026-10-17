/**
 * UnsavedChangesModal — Navigation guard modal
 *
 * DR-6b-4d: Implements safeguard #5
 * - Shown when navigating away with unsaved changes
 * - Three options: Save and leave, Leave without saving, Stay
 */

import styles from './readout.module.css';

interface UnsavedChangesModalProps {
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onStay: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesModal({
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onStay,
  isSaving = false,
}: UnsavedChangesModalProps) {
  return (
    <div className={styles.conflictOverlay}>
      <div className={styles.unsavedModal} role="alertdialog" aria-labelledby="unsaved-title">
        <div className={styles.discardHeader}>
          <h3 id="unsaved-title" className={styles.discardTitle}>
            Unsaved changes
          </h3>
        </div>
        <div className={styles.discardBody}>
          <p className={styles.discardDescription}>
            You have unsaved changes that will be lost if you leave this page.
          </p>
        </div>
        <div className={styles.discardFooter}>
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={onStay}
            disabled={isSaving}
          >
            Stay on page
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onLeaveWithoutSaving}
            disabled={isSaving}
          >
            Leave without saving
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSaveAndLeave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save and leave'}
          </button>
        </div>
      </div>
    </div>
  );
}
