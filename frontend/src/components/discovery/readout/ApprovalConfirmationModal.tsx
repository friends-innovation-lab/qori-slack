/**
 * ApprovalConfirmationModal — Approval dialog with supersession notes
 *
 * DR-6b-4e-F1 Scope B: Approval confirmation dialog
 * - Shows eligibility status with errors list
 * - Collects justification notes for superseded citations
 * - Optional approval note
 * - Handles 409 (concurrent edit) and 422 (ineligible) errors
 */

import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import type {
  ApprovalEligibility,
  SupersededCitation,
  ApproveReadoutRequest,
} from '@/api/readouts';
import styles from './readout.module.css';

interface ApprovalConfirmationModalProps {
  /** Eligibility check result */
  eligibility: ApprovalEligibility;
  /** Current draft content version for approval request */
  expectedVersion: number;
  /** Whether approval is in progress */
  isApproving: boolean;
  /** Error message from failed approval attempt */
  approvalError: string | null;
  /** Callback when user confirms approval */
  onConfirm: (request: ApproveReadoutRequest) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback to refresh eligibility (e.g., after 409) */
  onRefreshEligibility: () => void;
}

export function ApprovalConfirmationModal({
  eligibility,
  expectedVersion,
  isApproving,
  approvalError,
  onConfirm,
  onCancel,
  onRefreshEligibility,
}: ApprovalConfirmationModalProps) {
  // Supersession notes keyed by revisionPublicId
  const [supersessionNotes, setSupersessionNotes] = useState<Record<string, string>>({});
  // Optional approval note
  const [approvalNote, setApprovalNote] = useState('');

  const { eligible, errors, supersededCitations } = eligibility;
  const hasSupersededCitations = supersededCitations.length > 0;

  // Check if all superseded citations have justification notes
  const allSupersessionNotesProvided = supersededCitations.every(
    (citation) => (supersessionNotes[citation.revisionPublicId] || '').trim().length > 0,
  );

  // Can submit if eligible, no blocking errors, and all supersession notes provided
  const canSubmit = eligible && errors.length === 0 && (!hasSupersededCitations || allSupersessionNotesProvided);

  // Handle supersession note change
  const handleSupersessionNoteChange = useCallback(
    (revisionPublicId: string, note: string) => {
      setSupersessionNotes((prev) => ({
        ...prev,
        [revisionPublicId]: note,
      }));
    },
    [],
  );

  // Handle confirm
  const handleConfirm = useCallback(() => {
    const request: ApproveReadoutRequest = {
      expectedVersion,
    };

    // Only include approvalNote if non-empty
    if (approvalNote.trim()) {
      request.approvalNote = approvalNote.trim();
    }

    // Only include supersessionNotes if there are superseded citations
    if (hasSupersededCitations) {
      request.supersessionNotes = supersessionNotes;
    }

    onConfirm(request);
  }, [expectedVersion, approvalNote, hasSupersededCitations, supersessionNotes, onConfirm]);

  // Reset error state and refresh eligibility on mount
  useEffect(() => {
    // Initial eligibility check happens before modal opens
    // This effect could be used for auto-refresh if needed
  }, []);

  return (
    <div className={styles.conflictOverlay}>
      <div
        className={styles.approvalModal}
        role="dialog"
        aria-labelledby="approval-title"
        aria-describedby="approval-description"
      >
        {/* Header */}
        <div className={styles.approvalHeader}>
          <h2 id="approval-title" className={styles.approvalTitle}>
            Approve Readout
          </h2>
        </div>

        {/* Body */}
        <div className={styles.approvalBody}>
          {/* Eligibility Status */}
          <div className={styles.eligibilityStatus}>
            {eligible ? (
              <div className={styles.eligibilitySuccess}>
                <CheckCircle size={20} />
                <span>Readout is eligible for approval</span>
              </div>
            ) : (
              <div className={styles.eligibilityError}>
                <AlertCircle size={20} />
                <span>Readout is not eligible for approval</span>
              </div>
            )}
          </div>

          {/* Blocking Errors */}
          {errors.length > 0 && (
            <div className={styles.eligibilityErrors}>
              <h3 className={styles.eligibilityErrorsTitle}>
                <AlertCircle size={16} />
                Blocking issues ({errors.length})
              </h3>
              <ul className={styles.eligibilityErrorsList}>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Superseded Citations - requires justification */}
          {hasSupersededCitations && (
            <div className={styles.supersessionSection}>
              <h3 className={styles.supersessionTitle}>
                <AlertTriangle size={16} />
                Superseded citations ({supersededCitations.length})
              </h3>
              <p className={styles.supersessionDescription}>
                The following citations reference insight revisions that have been superseded by
                newer accepted versions. Provide justification for continuing to use the older
                revision.
              </p>
              <div className={styles.supersessionList}>
                {supersededCitations.map((citation) => (
                  <SupersededCitationInput
                    key={citation.revisionPublicId}
                    citation={citation}
                    note={supersessionNotes[citation.revisionPublicId] || ''}
                    onNoteChange={(note) =>
                      handleSupersessionNoteChange(citation.revisionPublicId, note)
                    }
                    disabled={isApproving}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Approval Note (optional) */}
          {eligible && (
            <div className={styles.approvalNoteSection}>
              <label htmlFor="approval-note" className={styles.approvalNoteLabel}>
                Approval note (optional)
              </label>
              <textarea
                id="approval-note"
                className={styles.approvalNoteInput}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Add any notes about this approval..."
                disabled={isApproving}
                rows={3}
              />
            </div>
          )}

          {/* Research Brief Handoff Notice (Scope H) */}
          {eligible && (
            <div className={styles.handoffNotice}>
              <Info size={16} />
              <p>
                Approved readouts can be cited in Research Briefs. There is no automatic transfer —
                the Research Brief author manually selects which readouts to include.
              </p>
            </div>
          )}

          {/* Error from approval attempt */}
          {approvalError && (
            <div className={styles.approvalErrorBanner}>
              <AlertCircle size={16} />
              <span>{approvalError}</span>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={onRefreshEligibility}
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.approvalFooter}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isApproving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!canSubmit || isApproving}
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual superseded citation input
 */
interface SupersededCitationInputProps {
  citation: SupersededCitation;
  note: string;
  onNoteChange: (note: string) => void;
  disabled?: boolean;
}

function SupersededCitationInput({
  citation,
  note,
  onNoteChange,
  disabled,
}: SupersededCitationInputProps) {
  const isValid = note.trim().length > 0;

  return (
    <div className={styles.supersededCitation}>
      <div className={styles.supersededCitationHeader}>
        <span className={styles.supersededCitationId}>{citation.displayId}</span>
        <span className={styles.supersededCitationRevision}>v{citation.revisionNumber}</span>
      </div>
      <textarea
        className={`${styles.supersededCitationInput} ${!isValid && !disabled ? styles.supersededCitationInputRequired : ''}`}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Why is the older revision still appropriate? (required)"
        disabled={disabled}
        rows={2}
        aria-label={`Justification for continuing to use ${citation.displayId} v${citation.revisionNumber}`}
        aria-required="true"
      />
      {!isValid && !disabled && (
        <span className={styles.supersededCitationHint}>Justification required</span>
      )}
    </div>
  );
}
