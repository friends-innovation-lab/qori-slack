/**
 * ConflictComparisonView — Side-by-side comparison for 409 conflict resolution
 *
 * DR-6b-4d: Implements safeguards #3, #4
 * - Shows server version vs user's submitted version
 * - Requires explicit reconciliation
 * - Discard requires confirmation
 */

import { useState } from 'react';
import type { ConflictState } from '@/hooks/useReadoutEditor';
import styles from './readout.module.css';

interface ConflictComparisonViewProps {
  conflict: ConflictState;
  onReconcile: () => void;
  onDiscard: () => void;
  onContinueEditing: () => void;
}

export function ConflictComparisonView({
  conflict,
  onReconcile,
  onDiscard,
  onContinueEditing,
}: ConflictComparisonViewProps) {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const serverContent = conflict.serverContent;
  const userContent = conflict.submittedContent;

  const serverFindings = serverContent?.findings ?? [];
  const userFindings = userContent?.findings ?? [];
  const serverImplications = serverContent?.implications ?? [];
  const userImplications = userContent?.implications ?? [];

  if (!serverContent) {
    return (
      <div className={styles.conflictOverlay}>
        <div className={styles.conflictModal}>
          <div className={styles.conflictHeader}>
            <h2 className={styles.conflictTitle}>Loading conflict details...</h2>
          </div>
          <div className={styles.conflictBody}>
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner} />
              <p className={styles.loadingText}>Fetching current server version...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.conflictOverlay}>
      <div className={styles.conflictModal} role="dialog" aria-labelledby="conflict-title">
        <div className={styles.conflictHeader}>
          <h2 id="conflict-title" className={styles.conflictTitle}>
            Save Conflict
          </h2>
        </div>

        <div className={styles.conflictBody}>
          <p className={styles.conflictDescription}>
            Another user modified this draft while you were editing. The server is now at version{' '}
            <strong>{conflict.serverVersion}</strong>. Please review the differences and reconcile
            your changes.
          </p>

          <div className={styles.conflictColumns}>
            <div className={styles.conflictColumn}>
              <h3 className={styles.conflictColumnTitle}>Server Version (v{conflict.serverVersion})</h3>
              <div className={styles.conflictContent}>
                <strong>Summary:</strong>
                <p>{serverContent.summary?.text || '(empty)'}</p>

                <strong>Findings ({serverFindings.length}):</strong>
                {serverFindings.map((f, i) => (
                  <p key={f.id}>
                    F{i + 1}: {f.text.substring(0, 100)}
                    {f.text.length > 100 ? '...' : ''}
                  </p>
                ))}

                <strong>Implications ({serverImplications.length}):</strong>
                {serverImplications.map((imp, i) => (
                  <p key={imp.id}>
                    I{i + 1} [{imp.kind}]: {imp.text.substring(0, 100)}
                    {imp.text.length > 100 ? '...' : ''}
                  </p>
                ))}

                <strong>Checked findings:</strong>
                <p>{conflict.serverFindingsChecked.length} items</p>

                <strong>Reviewed implications:</strong>
                <p>{conflict.serverImplicationsReviewed.length} items</p>
              </div>
            </div>

            <div className={styles.conflictColumn}>
              <h3 className={styles.conflictColumnTitle}>Your Version (not saved)</h3>
              <div className={styles.conflictContent}>
                <strong>Summary:</strong>
                <p>{userContent.summary?.text || '(empty)'}</p>

                <strong>Findings ({userFindings.length}):</strong>
                {userFindings.map((f, i) => (
                  <p key={f.id}>
                    F{i + 1}: {f.text.substring(0, 100)}
                    {f.text.length > 100 ? '...' : ''}
                  </p>
                ))}

                <strong>Implications ({userImplications.length}):</strong>
                {userImplications.map((imp, i) => (
                  <p key={imp.id}>
                    I{i + 1} [{imp.kind}]: {imp.text.substring(0, 100)}
                    {imp.text.length > 100 ? '...' : ''}
                  </p>
                ))}

                <strong>Checked findings:</strong>
                <p>{conflict.submittedFindingsChecked.length} items</p>

                <strong>Reviewed implications:</strong>
                <p>{conflict.submittedImplicationsReviewed.length} items</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.conflictFooter}>
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={onContinueEditing}
          >
            Continue editing my version
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowDiscardConfirm(true)}
          >
            Discard my changes
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onReconcile}
          >
            Edit and retry save
          </button>
        </div>
      </div>

      {showDiscardConfirm && (
        <DiscardConfirmModal
          onConfirm={() => {
            setShowDiscardConfirm(false);
            onDiscard();
          }}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  );
}

interface DiscardConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiscardConfirmModal({ onConfirm, onCancel }: DiscardConfirmModalProps) {
  return (
    <div className={styles.conflictOverlay} style={{ zIndex: 1001 }}>
      <div className={styles.discardModal} role="alertdialog" aria-labelledby="discard-title">
        <div className={styles.discardHeader}>
          <h3 id="discard-title" className={styles.discardTitle}>
            Discard your changes?
          </h3>
        </div>
        <div className={styles.discardBody}>
          <p className={styles.discardDescription}>
            This will permanently discard all your unsaved changes and reset to the server version.
            This action cannot be undone.
          </p>
        </div>
        <div className={styles.discardFooter}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Keep editing
          </button>
          <button type="button" className="btn btn-error" onClick={onConfirm}>
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}
