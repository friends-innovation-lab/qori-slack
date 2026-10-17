/**
 * FindingBlock — Editable finding with citations and review checkbox
 *
 * DR-6b-4d: Per design spec sections 2-3
 * - Editable text
 * - Citations row with chips
 * - "Checked against evidence" checkbox
 * - Visual indicator when invalidated
 */

import { AlertTriangle } from 'lucide-react';
import type { Finding, Citation } from '@/api/readouts';
import { CitationChip } from './CitationChip';
import { AddCitationButton } from './CitationPicker';
import styles from './readout.module.css';

interface FindingBlockProps {
  finding: Finding;
  index: number;
  isChecked: boolean;
  isInvalidated: boolean;
  readOnly?: boolean;
  projectPublicId: string;
  studyPublicId: string;
  readoutPublicId: string;
  onTextChange: (text: string) => void;
  onToggleChecked: () => void;
  onAddCitation: (citation: Citation) => void;
  onRemoveCitation: (citationIndex: number) => void;
}

export function FindingBlock({
  finding,
  index,
  isChecked,
  isInvalidated,
  readOnly = false,
  projectPublicId,
  studyPublicId,
  readoutPublicId,
  onTextChange,
  onToggleChecked,
  onAddCitation,
  onRemoveCitation,
}: FindingBlockProps) {
  const blockClass = isInvalidated
    ? `${styles.narrativeBlock} ${styles.narrativeBlockInvalidated}`
    : styles.narrativeBlock;

  return (
    <div className={blockClass} data-testid={`finding-block-${finding.id}`}>
      <div className={styles.narrativeHeader}>
        <span className={styles.narrativeId}>F{index + 1}</span>
        <span className={`${styles.kindLabel} ${styles.kindQuestion}`}>Evidence-supported</span>
      </div>

      <textarea
        className={`${styles.textArea} ${readOnly ? styles.textAreaReadOnly : ''}`}
        value={finding.text}
        onChange={(e) => onTextChange(e.target.value)}
        readOnly={readOnly}
        placeholder="Enter finding text..."
        aria-label={`Finding F${index + 1} text`}
      />

      <div className={styles.citationsRow}>
        <span className={styles.citationsLabel}>Citations:</span>
        {finding.citations.map((citation, citationIndex) => (
          <CitationChip
            key={`${citation.constructPublicId}-${citation.revisionPublicId}`}
            citation={citation}
            onRemove={() => onRemoveCitation(citationIndex)}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && (
          <AddCitationButton
            projectPublicId={projectPublicId}
            studyPublicId={studyPublicId}
            readoutPublicId={readoutPublicId}
            onAdd={onAddCitation}
            existingCitations={finding.citations}
          />
        )}
      </div>

      {finding.citations.length === 0 && (
        <div className={styles.invalidatedWarning}>
          <AlertTriangle size={14} />
          <span>Finding needs at least one citation for approval</span>
        </div>
      )}

      <div className={styles.reviewCheckbox}>
        <input
          type="checkbox"
          id={`finding-checked-${finding.id}`}
          className={styles.reviewCheckboxInput}
          checked={isChecked}
          onChange={onToggleChecked}
          disabled={readOnly}
          aria-describedby={isInvalidated ? `finding-invalidated-${finding.id}` : undefined}
        />
        <label
          htmlFor={`finding-checked-${finding.id}`}
          className={`${styles.reviewCheckboxLabel} ${isChecked ? styles.reviewCheckboxLabelChecked : ''}`}
        >
          Checked against evidence
        </label>
      </div>

      {isInvalidated && (
        <div
          id={`finding-invalidated-${finding.id}`}
          className={styles.invalidatedWarning}
          role="alert"
        >
          <AlertTriangle size={14} />
          <span>Content changed — please re-check this finding</span>
        </div>
      )}
    </div>
  );
}
