/**
 * KindLabel — Implication kind badge (Q/G/P/H)
 *
 * DR-6b-4d: Per design spec section 3
 * - Question (Q): brand-text
 * - Gap (G): brand-text
 * - Priority (P): brand-text
 * - Hypothesis (H): text-meta with dashed underline
 */

import type { ImplicationKind } from '@/api/readouts';
import styles from './readout.module.css';

interface KindLabelProps {
  kind: ImplicationKind;
}

const KIND_LABELS: Record<ImplicationKind, string> = {
  question: 'Research question',
  gap: 'Knowledge gap',
  priority: 'Priority',
  hypothesis: 'Hypothesis',
};

const KIND_CLASSES: Record<ImplicationKind, string> = {
  question: styles.kindQuestion,
  gap: styles.kindGap,
  priority: styles.kindPriority,
  hypothesis: styles.kindHypothesis,
};

export function KindLabel({ kind }: KindLabelProps) {
  return (
    <span className={`${styles.kindLabel} ${KIND_CLASSES[kind]}`}>
      {KIND_LABELS[kind]}
    </span>
  );
}
