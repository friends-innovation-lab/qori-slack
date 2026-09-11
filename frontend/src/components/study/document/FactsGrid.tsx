/**
 * FactsGrid — Quick facts system block (method, participants, timeline, etc.)
 */

import styles from './document.module.css';

interface Fact {
  label: string;
  value: string;
  sub?: string;
}

interface FactsGridProps {
  facts: Fact[];
}

export function FactsGrid({ facts }: FactsGridProps) {
  if (facts.length === 0) return null;
  return (
    <div className={styles.systemBlock}>
      <span className={styles.systemLabel}>System</span>
      <div className={styles.factsGrid}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.factItem}>
            <span className={styles.factKey}>{fact.label}</span>
            <span className={styles.factValue}>{fact.value}</span>
            {fact.sub && <span className={styles.factSub}>{fact.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
