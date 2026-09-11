/**
 * IdTag — Monospace stable ID inline tag (OBJ-001, RQ-001, TB-001).
 * Hover shows tooltip. Future: click opens provenance in review rail.
 */

import styles from './document.module.css';

interface IdTagProps {
  id: string;
}

export function IdTag({ id }: IdTagProps) {
  return (
    <span
      className={styles.idTag}
      title={`${id} — stable canonical ID`}
      data-stable-id={id}
    >
      {id}
    </span>
  );
}
