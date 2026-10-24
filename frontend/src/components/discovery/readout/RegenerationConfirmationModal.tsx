/**
 * RegenerationConfirmationModal — Confirmation dialog for regeneration
 *
 * DR-6b-5e-B-3: Controlled regeneration
 * - Explains that regeneration creates a new historical version
 * - Warns that content may replace current draft if CAS permits
 * - Notes that review checkmarks may be reset
 * - Requires explicit confirmation
 */

import { useRef, useEffect } from 'react';
import { AlertTriangle, X, Sparkles } from 'lucide-react';
import styles from './readout.module.css';

interface RegenerationConfirmationModalProps {
  /** Number of selected evidence items */
  selectedCount: number;
  /** Whether regeneration is in progress */
  isRegenerating: boolean;
  /** Callback when user confirms regeneration */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

export function RegenerationConfirmationModal({
  selectedCount,
  isRegenerating,
  onConfirm,
  onCancel,
}: RegenerationConfirmationModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Capture previously focused element and focus cancel button
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    cancelButtonRef.current?.focus();

    return () => {
      // Restore focus on unmount
      if (previouslyFocusedRef.current && document.body.contains(previouslyFocusedRef.current)) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isRegenerating) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isRegenerating]);

  return (
    <div className={styles.modalOverlay} role="presentation">
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="regeneration-modal-title"
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="regeneration-modal-title" className={styles.modalTitle}>
            <AlertTriangle size={20} className={styles.warningIcon} aria-hidden="true" />
            Confirm Regeneration
          </h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onCancel}
            disabled={isRegenerating}
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <p className={styles.regenerationWarning}>
            You are about to regenerate this readout with <strong>{selectedCount}</strong> selected
            evidence item{selectedCount === 1 ? '' : 's'}.
          </p>

          <div className={styles.regenerationNotes}>
            <h3 className={styles.regenerationNotesTitle}>What happens when you regenerate:</h3>
            <ul className={styles.regenerationNotesList}>
              <li>
                A new generation version will be created and added to the Generation History.
              </li>
              <li>
                If the server&apos;s CAS conditions permit, the generated content may replace
                your current draft content.
              </li>
              <li>
                Your existing review checkmarks (findings checked, implications reviewed) may
                be reset when new content is applied.
              </li>
              <li>
                The previous draft content will be preserved in the Generation History for
                reference.
              </li>
            </ul>
          </div>

          <p className={styles.regenerationConfirmText}>
            Are you sure you want to proceed with regeneration?
          </p>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            ref={cancelButtonRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isRegenerating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isRegenerating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <Sparkles size={16} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
