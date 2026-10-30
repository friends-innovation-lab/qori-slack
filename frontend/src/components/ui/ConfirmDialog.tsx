/**
 * ConfirmDialog — DISC-WEB-1C-2b
 *
 * Modal confirmation dialog for destructive or significant actions.
 * Uses native dialog element for accessibility (focus trap, escape key).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Dialog title */
  title: string;
  /** Dialog content */
  children: ReactNode;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Confirm button loading state */
  confirmLoading?: boolean;
  /** Confirm button disabled state */
  confirmDisabled?: boolean;
  /** Variant for confirm button */
  confirmVariant?: 'primary' | 'danger';
  /** Called when confirm clicked */
  onConfirm: () => void;
  /** Called when cancel clicked or dialog dismissed */
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmLoading = false,
  confirmDisabled = false,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open/close dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      // showModal may not be available in jsdom (testing environment)
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  // Handle escape key and backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    const handleClick = (e: MouseEvent) => {
      // Close on backdrop click (click on dialog element itself, not content)
      if (e.target === dialog) {
        onCancel();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onCancel]);

  // Don't render content when not open (better for testing and performance)
  if (!open) {
    return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="dialog-title" />;
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="dialog-title">
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id="dialog-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        <footer className={styles.footer}>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={confirmLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={confirmDisabled || confirmLoading}
            loading={confirmLoading}
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
