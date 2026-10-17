/**
 * ImplicationBlock — Editable implication with kind label, based-on, and review checkbox
 *
 * DR-6b-4d: Per design spec sections 3-4
 * - Kind label (Q/G/P/H)
 * - Editable text
 * - Based-on findings links
 * - "Reviewed" checkbox
 * - Visual indicator when invalidated
 */

import { AlertTriangle } from 'lucide-react';
import type { Implication, ImplicationKind, Finding } from '@/api/readouts';
import { KindLabel } from './KindLabel';
import { FindingLink } from './FindingLink';
import styles from './readout.module.css';

interface ImplicationBlockProps {
  implication: Implication;
  index: number;
  findings: Finding[];
  isReviewed: boolean;
  isInvalidated: boolean;
  readOnly?: boolean;
  onTextChange: (text: string) => void;
  onKindChange: (kind: ImplicationKind) => void;
  onToggleReviewed: () => void;
  onToggleFinding: (findingId: string) => void;
}

const KIND_OPTIONS: { value: ImplicationKind; label: string }[] = [
  { value: 'question', label: 'Research question' },
  { value: 'gap', label: 'Knowledge gap' },
  { value: 'priority', label: 'Priority' },
  { value: 'hypothesis', label: 'Hypothesis' },
];

export function ImplicationBlock({
  implication,
  index,
  findings,
  isReviewed,
  isInvalidated,
  readOnly = false,
  onTextChange,
  onKindChange,
  onToggleReviewed,
  onToggleFinding,
}: ImplicationBlockProps) {
  const blockClass = isInvalidated
    ? `${styles.narrativeBlock} ${styles.narrativeBlockInvalidated}`
    : styles.narrativeBlock;

  // Get finding indices for display
  const linkedFindingIndices = implication.basedOnFindings.map((findingId) => {
    const idx = findings.findIndex((f) => f.id === findingId);
    return { id: findingId, index: idx };
  }).filter((f) => f.index >= 0);

  const hasNoLinkedFindings = implication.basedOnFindings.length === 0;

  return (
    <div className={blockClass} data-testid={`implication-block-${implication.id}`}>
      <div className={styles.narrativeHeader}>
        <span className={styles.narrativeId}>I{index + 1}</span>
        <div className={styles.narrativeKind}>
          {readOnly ? (
            <KindLabel kind={implication.kind} />
          ) : (
            <select
              value={implication.kind}
              onChange={(e) => onKindChange(e.target.value as ImplicationKind)}
              aria-label={`Implication I${index + 1} kind`}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--type-label-size)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <textarea
        className={`${styles.textArea} ${readOnly ? styles.textAreaReadOnly : ''}`}
        value={implication.text}
        onChange={(e) => onTextChange(e.target.value)}
        readOnly={readOnly}
        placeholder="Enter implication text..."
        aria-label={`Implication I${index + 1} text`}
      />

      <div className={styles.basedOnRow}>
        <span className={styles.basedOnLabel}>Based on:</span>
        {linkedFindingIndices.map(({ id, index: findingIndex }) => (
          <FindingLink
            key={id}
            index={findingIndex}
            onClick={() => !readOnly && onToggleFinding(id)}
          />
        ))}
        {!readOnly && findings.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onToggleFinding(e.target.value);
              }
            }}
            aria-label="Add finding link"
            style={{
              padding: 'var(--space-1) var(--space-2)',
              fontSize: 'var(--type-label-size)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-brand)',
            }}
          >
            <option value="">+ Link finding</option>
            {findings
              .filter((f) => !implication.basedOnFindings.includes(f.id))
              .map((f) => {
                const originalIndex = findings.findIndex((finding) => finding.id === f.id);
                return (
                  <option key={f.id} value={f.id}>
                    F{originalIndex + 1}
                  </option>
                );
              })}
          </select>
        )}
      </div>

      {hasNoLinkedFindings && (
        <div className={styles.invalidatedWarning}>
          <AlertTriangle size={14} />
          <span>Implication must link to at least one finding for approval</span>
        </div>
      )}

      <div className={styles.reviewCheckbox}>
        <input
          type="checkbox"
          id={`implication-reviewed-${implication.id}`}
          className={styles.reviewCheckboxInput}
          checked={isReviewed}
          onChange={onToggleReviewed}
          disabled={readOnly}
          aria-describedby={isInvalidated ? `implication-invalidated-${implication.id}` : undefined}
        />
        <label
          htmlFor={`implication-reviewed-${implication.id}`}
          className={`${styles.reviewCheckboxLabel} ${isReviewed ? styles.reviewCheckboxLabelChecked : ''}`}
        >
          Reviewed
        </label>
      </div>

      {isInvalidated && (
        <div
          id={`implication-invalidated-${implication.id}`}
          className={styles.invalidatedWarning}
          role="alert"
        >
          <AlertTriangle size={14} />
          <span>Content changed — please re-review this implication</span>
        </div>
      )}
    </div>
  );
}
