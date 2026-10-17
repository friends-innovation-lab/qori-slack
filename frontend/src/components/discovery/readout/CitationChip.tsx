/**
 * CitationChip — Citation display chip with IN-0001 rN format
 *
 * DR-6b-4d: Per design spec RO5
 * - Tinted background (.cite style)
 * - Shows construct displayId + revision number
 * - Optional remove button for editing
 */

import { X } from 'lucide-react';
import type { Citation } from '@/api/readouts';
import styles from './readout.module.css';

interface CitationChipProps {
  citation: Citation;
  onRemove?: () => void;
  readOnly?: boolean;
}

/**
 * Format citation as "IN-0001 r2"
 */
function formatCitation(citation: Citation): string {
  return `${citation.displayId} r${citation.revisionNumber}`;
}

export function CitationChip({ citation, onRemove, readOnly = false }: CitationChipProps) {
  return (
    <span className={styles.citationChip}>
      {formatCitation(citation)}
      {!readOnly && onRemove && (
        <button
          type="button"
          className={styles.citationChipRemove}
          onClick={onRemove}
          aria-label={`Remove citation ${formatCitation(citation)}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
