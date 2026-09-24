/**
 * ReviewRail — Review panel content for Brief approval workflow.
 *
 * CC-7: Refactored to accept `approval: BriefApprovalState` from view model.
 * Contains approval checklist, approve/request-changes actions.
 * Rendered inside ContextRail as the Review mode content.
 *
 * Legacy `isOverlay`/`onClose` props removed (ContextRail handles presentation).
 * The "Future: comment threads…" note removed per CC-7 spec.
 *
 * Spec: COMPONENT_MAPPING.md §3.16
 */

import { useState } from 'react';
import type { BriefApprovalState } from '@qori/artifact-contracts';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import styles from './ReviewRail.module.css';

/** Checklist keys and labels — production copy, must not change */
const CHECKLIST_KEYS = ['scope', 'timeline', 'participants', 'budget'] as const;
type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

const CHECKLIST_LABELS: Record<ChecklistKey, string> = {
  scope: 'Scope and method are appropriate',
  timeline: 'Timeline and deadline are feasible',
  participants: 'Participant approach is sound',
  budget: 'Budget is reasonable',
};

export type ChecklistState = Record<ChecklistKey, boolean>;

interface ReviewRailProps {
  /** Approval state from BriefViewModel */
  approval: BriefApprovalState;
  /** Checklist state (controlled) */
  checklist: ChecklistState;
  /** Checklist change handler */
  onChecklistChange: (checklist: ChecklistState) => void;
  /** Approve callback */
  onApprove: () => void;
  /** Whether approval is in progress */
  approving?: boolean;
  /** Request changes callback */
  onRequestChanges: (comment: string) => void;
  /** Whether request changes is in progress */
  requesting?: boolean;
}

/** Format ISO date string to readable format (allowed per SPEC §1.1 rule 6) */
function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ReviewRail({
  approval,
  checklist,
  onChecklistChange,
  onApprove,
  approving = false,
  onRequestChanges,
  requesting = false,
}: ReviewRailProps) {
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [comment, setComment] = useState('');

  // Derive display values from approval state
  const reviewerName = approval.reviewerDisplayName;
  const approvedAt = formatDate(approval.approvedAt);
  const changeFeedback = approval.changeFeedback;
  const allChecked = CHECKLIST_KEYS.every((key) => checklist[key]);

  // Don't render if no approval status
  if (approval.status === null) {
    return null;
  }

  const handleChecklistChange = (key: ChecklistKey, checked: boolean) => {
    onChecklistChange({ ...checklist, [key]: checked });
  };

  const handleSubmitChanges = () => {
    if (!comment.trim()) return;
    onRequestChanges(comment.trim());
    setShowChangesForm(false);
    setComment('');
  };

  const handleCancelChanges = () => {
    setShowChangesForm(false);
    setComment('');
  };

  return (
    <div className={styles.reviewRail}>
      <p className={styles.reviewEyebrow}>Brief approval</p>

      {/* Approved state */}
      {approval.isApproved && (
        <>
          <h2 className={`${styles.reviewStatus} ${styles.reviewStatusSuccess}`}>
            Approved
          </h2>
          <p className={styles.reviewBody}>
            {reviewerName && <>by {reviewerName} · </>}
            {approvedAt}. The brief is now the citation source for downstream
            artifacts; edits after approval flag them stale.
          </p>
        </>
      )}

      {/* Changes requested state */}
      {approval.isChangesRequested && (
        <>
          <h2 className={`${styles.reviewStatus} ${styles.reviewStatusError}`}>
            Changes requested
          </h2>
          <p className={styles.reviewBody}>
            {reviewerName && <>by {reviewerName}.</>}
          </p>
          {changeFeedback && (
            <blockquote className={styles.reviewFeedback}>
              {changeFeedback}
            </blockquote>
          )}
        </>
      )}

      {/* Pending approval state - checklist and actions */}
      {approval.isPendingApproval && !showChangesForm && (
        <>
          <h2 className={`${styles.reviewStatus} ${styles.reviewStatusWarning}`}>
            Pending approval
          </h2>
          <p className={styles.reviewBody}>
            A stakeholder review is required before proceeding to the research
            plan.
          </p>

          <fieldset className={styles.reviewChecklist}>
            <legend className={styles.srOnly}>Approval checklist</legend>
            <ul className={styles.checklistList}>
              {CHECKLIST_KEYS.map((key) => (
                <li key={key}>
                  <label className={styles.checklistItem}>
                    <input
                      type="checkbox"
                      checked={checklist[key]}
                      onChange={(e) => handleChecklistChange(key, e.target.checked)}
                    />
                    <span>{CHECKLIST_LABELS[key]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className={styles.reviewActions}>
            <Button
              onClick={onApprove}
              disabled={!allChecked || approving}
              loading={approving}
              aria-describedby={!allChecked ? 'approve-hint' : undefined}
            >
              {approving ? 'Approving...' : 'Approve'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowChangesForm(true)}
            >
              Request changes
            </Button>
          </div>

          {!allChecked && (
            <p id="approve-hint" className={styles.reviewHint}>
              Confirm all four checks to approve.
            </p>
          )}
        </>
      )}

      {/* Request changes form */}
      {approval.isPendingApproval && showChangesForm && (
        <>
          <h2 className={`${styles.reviewStatus} ${styles.reviewStatusWarning}`}>
            Request changes
          </h2>
          <Textarea
            label="Feedback"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe the changes needed..."
            className={styles.feedbackTextarea}
          />
          <div className={styles.reviewActions}>
            <Button variant="secondary" size="sm" onClick={handleCancelChanges}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitChanges}
              disabled={!comment.trim() || requesting}
              loading={requesting}
            >
              {requesting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
