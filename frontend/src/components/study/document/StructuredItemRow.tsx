/**
 * StructuredItemRow — A single objective, question, or barrier row with stable ID.
 */

import { IdTag } from './IdTag';
import styles from './document.module.css';

interface StructuredItemRowProps {
  id: string;
  text: string;
  source?: string | null;
  priority?: string | null;
}

const priorityClass: Record<string, string> = {
  Primary: styles.priorityPrimary,
  Secondary: styles.prioritySecondary,
  Exploratory: styles.priorityExploratory,
};

export function StructuredItemRow({ id, text, source, priority }: StructuredItemRowProps) {
  return (
    <div className={styles.itemRow}>
      <IdTag id={id} />
      <span className={styles.itemText}>
        {text}
        {source && <em className={styles.itemSource}> — {source}</em>}
      </span>
      {priority && (
        <span className={`${styles.priorityBadge} ${priorityClass[priority] || styles.priorityExploratory}`}>
          {priority}
        </span>
      )}
    </div>
  );
}
