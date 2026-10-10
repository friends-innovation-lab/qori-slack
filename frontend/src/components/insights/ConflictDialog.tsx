/**
 * ConflictDialog — Optimistic concurrency conflict resolution.
 *
 * Per DR10a:
 * - On 409, nothing is written and user's text is kept
 * - Latest vs. theirs shown side by side
 * - Three actions: rebase onto latest, review latest, or discard
 * - A decision conflict reloads the panel with explanation (not retried)
 *
 * This is a controlled component. Resolution wiring handled by parent.
 */

import { useRef, useEffect, useId } from 'react';
import { AlertCircle, GitMerge, Eye, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import styles from './insights.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConflictType = 'edit' | 'decision';

export interface ConflictVersion {
  /** Revision number */
  revisionNumber: number;
  /** Wording text */
  wording: string;
  /** Who made the change */
  author: string;
  /** When the change was made */
  timestamp: string;
}

export type ConflictResolution = 'rebase' | 'review' | 'discard';

interface ConflictDialogProps {
  /** Type of conflict */
  type: ConflictType;
  /** Display ID of the insight */
  insightDisplayId: string;
  /** Whether the dialog is open */
  open: boolean;
  /** User's unsaved version (their changes) */
  userVersion: ConflictVersion;
  /** Latest server version (the conflict) */
  latestVersion: ConflictVersion;
  /** Resolution handler */
  onResolve: (resolution: ConflictResolution) => void;
  /** Close handler (for decision conflicts, just dismiss) */
  onClose: () => void;
  /** Additional class name */
  className?: string;
}

export function ConflictDialog({
  type,
  insightDisplayId,
  open,
  userVersion,
  latestVersion,
  onResolve,
  onClose,
  className,
}: ConflictDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descId = useId();

  // Focus management
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // For decision conflicts, just close; for edit conflicts, treat as review
        if (type === 'decision') {
          onClose();
        } else {
          onResolve('review');
        }
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [open, type, onResolve, onClose]);

  // Prevent body scroll
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

  if (!open) return null;

  // Decision conflict: simpler UI, just an explanation
  if (type === 'decision') {
    return (
      <div className={styles.dialogOverlay} onClick={onClose}>
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          className={`${styles.conflictDialog} ${className || ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.conflictDialogHeader}>
            <AlertCircle size={24} aria-hidden="true" className={styles.conflictDialogIcon} />
            <h2 id={titleId} className={styles.conflictDialogTitle}>
              Decision Conflict
            </h2>
          </div>

          <div id={descId} className={styles.conflictDialogDescription}>
            <p>
              Another user made a review decision on {insightDisplayId} while you were working.
              The insight has been updated to reflect the latest decision.
            </p>
            <p>
              <strong>Latest action:</strong> {latestVersion.author} on {formatDate(latestVersion.timestamp)}
            </p>
          </div>

          <div className={styles.conflictDialogActions}>
            <Button variant="primary" onClick={onClose}>
              OK
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Edit conflict: side-by-side comparison with resolution options
  return (
    <div className={styles.dialogOverlay}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={`${styles.conflictDialog} ${styles.conflictDialogWide} ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.conflictDialogHeader}>
          <AlertCircle size={24} aria-hidden="true" className={styles.conflictDialogIcon} />
          <h2 id={titleId} className={styles.conflictDialogTitle}>
            Edit Conflict on {insightDisplayId}
          </h2>
        </div>

        <div id={descId} className={styles.conflictDialogDescription}>
          <p>
            Someone else edited this insight while you were making changes.
            Your changes have not been saved.
          </p>
        </div>

        {/* Side-by-side comparison */}
        <div className={styles.conflictComparison}>
          {/* User's version */}
          <div className={styles.conflictVersion}>
            <div className={styles.conflictVersionHeader}>
              <strong>Your changes</strong>
              <span className={styles.conflictVersionMeta}>
                r{userVersion.revisionNumber} · Not saved
              </span>
            </div>
            <div className={styles.conflictVersionWording}>
              {userVersion.wording}
            </div>
          </div>

          {/* Latest version */}
          <div className={styles.conflictVersion}>
            <div className={styles.conflictVersionHeader}>
              <strong>Latest version</strong>
              <span className={styles.conflictVersionMeta}>
                r{latestVersion.revisionNumber} · {latestVersion.author} · {formatDate(latestVersion.timestamp)}
              </span>
            </div>
            <div className={styles.conflictVersionWording}>
              {latestVersion.wording}
            </div>
          </div>
        </div>

        {/* Resolution actions */}
        <div className={styles.conflictDialogActions}>
          <Button
            variant="secondary"
            icon={<Trash2 size={16} />}
            onClick={() => onResolve('discard')}
          >
            Discard my changes
          </Button>
          <Button
            variant="secondary"
            icon={<Eye size={16} />}
            onClick={() => onResolve('review')}
          >
            Review latest
          </Button>
          <Button
            variant="primary"
            icon={<GitMerge size={16} />}
            onClick={() => onResolve('rebase')}
          >
            Rebase onto latest
          </Button>
        </div>

        <div className={styles.conflictDialogHint}>
          <strong>Rebase</strong> will open the editor with the latest version, preserving your text in the clipboard.
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
