/**
 * ApprovalSection — Static approval checklist that always renders.
 * Matches design: 4 checkbox items + explanatory paragraph.
 */

import { DocumentSection } from './DocumentSection';
import styles from './document.module.css';

interface ApprovalSectionProps {
  /** Budget amount to display in checklist, if available */
  budget?: string | null;
  /** Whether the brief has been approved */
  isApproved?: boolean;
}

export function ApprovalSection({ budget, isApproved }: ApprovalSectionProps) {
  // The checkmark character varies by approval state
  const checkmark = isApproved ? '☑' : '☐';
  const checkmarkStyle = isApproved ? styles.approvalCheckmark : undefined;

  return (
    <DocumentSection sectionId="approval" title="Approval" provenance="system" editable={false}>
      <div className={styles.systemBlock}>
        <span className={styles.systemLabel}>READ-ONLY · SYSTEM</span>
        <ul className={styles.approvalChecklist}>
          <li className={styles.approvalChecklistItem}>
            <span className={checkmarkStyle}>{checkmark}</span>
            <span>Stakeholder approves scope and method</span>
          </li>
          <li className={styles.approvalChecklistItem}>
            <span className={checkmarkStyle}>{checkmark}</span>
            <span>Stakeholder approves timeline and deadline</span>
          </li>
          <li className={styles.approvalChecklistItem}>
            <span className={checkmarkStyle}>{checkmark}</span>
            <span>Budget confirmed{budget ? ` (${budget} incentives)` : ''}</span>
          </li>
          <li className={styles.approvalChecklistItem}>
            <span className={checkmarkStyle}>{checkmark}</span>
            <span>Recruitment criteria validated with stakeholder</span>
          </li>
        </ul>
        <p className={styles.approvalNote}>
          Once approved, the lead researcher will produce a detailed research plan covering
          session protocols, recruitment mechanics, and analysis approach.
        </p>
      </div>
    </DocumentSection>
  );
}
