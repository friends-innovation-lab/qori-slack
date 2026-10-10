/**
 * WithdrawDialog — Confirmation dialog for withdrawing an insight.
 *
 * Per DR08a:
 * - Lists three consequences: no future synthesis, earlier syntheses marked out of date, history kept
 * - Reason is required (per D6)
 * - Shows no "used in N syntheses" count unless API provides one
 * - alertdialog role, max 480px, radius-lg, elevation-lg
 * - Below 767px becomes bottom sheet
 *
 * This is a controlled component. Mutation wiring handled by parent.
 */

import { useState, useRef, useEffect, useId, type ChangeEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import styles from './insights.module.css';

interface WithdrawDialogProps {
  /** Display ID of the insight being withdrawn */
  insightDisplayId: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Confirm handler with reason */
  onConfirm: (reason: string) => void;
  /** Whether confirmation is in progress */
  confirming?: boolean;
  /** Number of syntheses using this insight (optional, only shown if provided) */
  synthesisCount?: number;
  /** Additional class name */
  className?: string;
}

export function WithdrawDialog({
  insightDisplayId,
  open,
  onClose,
  onConfirm,
  confirming = false,
  synthesisCount,
  className,
}: WithdrawDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descId = useId();

  // Focus management
  useEffect(() => {
    if (open) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the dialog
      dialogRef.current?.focus();
    } else {
      // Restore focus
      previousFocusRef.current?.focus();
      // Reset state
      setReason('');
      setError(undefined);
    }
  }, [open]);

  // Trap focus within dialog
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) {
        onClose();
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, confirming, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleReasonChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setReason(e.target.value);
    if (e.target.value.trim()) {
      setError(undefined);
    }
  };

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Reason is required for withdrawal');
      return;
    }
    onConfirm(reason.trim());
  };

  if (!open) return null;

  return (
    <div className={styles.dialogOverlay} onClick={confirming ? undefined : onClose}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={`${styles.withdrawDialog} ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.withdrawDialogHeader}>
          <AlertTriangle size={24} aria-hidden="true" className={styles.withdrawDialogIcon} />
          <h2 id={titleId} className={styles.withdrawDialogTitle}>
            Withdraw {insightDisplayId}?
          </h2>
        </div>

        {/* Description */}
        <div id={descId} className={styles.withdrawDialogDescription}>
          <p>This action will:</p>
          <ul>
            <li>Remove this insight from future synthesis runs</li>
            <li>Mark earlier syntheses citing this insight as out of date</li>
            <li>Keep the full revision history for reference</li>
          </ul>
          {synthesisCount !== undefined && synthesisCount > 0 && (
            <p className={styles.withdrawDialogCount}>
              This insight is currently used in {synthesisCount} {synthesisCount === 1 ? 'synthesis' : 'syntheses'}.
            </p>
          )}
        </div>

        {/* Reason (required per D6) */}
        <div className={styles.withdrawDialogReason}>
          <Textarea
            label="Reason for withdrawal"
            value={reason}
            onChange={handleReasonChange}
            error={error}
            required
            disabled={confirming}
            placeholder="Explain why this insight is being withdrawn..."
            hint="This reason will be recorded in the revision history."
          />
        </div>

        {/* Actions */}
        <div className={styles.withdrawDialogActions}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={confirming}
            disabled={!reason.trim()}
          >
            Withdraw Insight
          </Button>
        </div>
      </div>
    </div>
  );
}
