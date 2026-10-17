/**
 * FindingLink — Based-on finding link (F1, F2, etc.)
 *
 * DR-6b-4d: Per design spec RO4c
 * - Outlined border (.flink style)
 * - Visually distinct from citation chips
 * - For document-internal finding references
 */

import styles from './readout.module.css';

interface FindingLinkProps {
  index: number;
  onClick?: () => void;
}

export function FindingLink({ index, onClick }: FindingLinkProps) {
  return (
    <button
      type="button"
      className={styles.findingLink}
      onClick={onClick}
      aria-label={`Based on finding F${index + 1}`}
    >
      F{index + 1}
    </button>
  );
}
