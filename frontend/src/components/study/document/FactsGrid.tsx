/**
 * FactsGrid — Quick facts system block (method, participants, timeline, etc.)
 *
 * CC-4: Extended to accept QuickFact[] from view model (§3.8).
 * - Filters out items with exists:false
 * - Returns null when no items remain
 */

import type { QuickFact } from '@qori/artifact-contracts';
import styles from './document.module.css';

/** Legacy fact shape (for backward compatibility) */
interface LegacyFact {
  label: string;
  value: string;
  sub?: string;
}

interface FactsGridProps {
  /** QuickFact[] from view model or legacy shape */
  facts: (QuickFact | LegacyFact)[];
}

/** Type guard to check if fact is QuickFact (has exists property) */
function isQuickFact(fact: QuickFact | LegacyFact): fact is QuickFact {
  return 'exists' in fact;
}

export function FactsGrid({ facts }: FactsGridProps) {
  // Filter out items with exists:false (for QuickFact) or empty values (legacy)
  const shown = facts.filter((f) => {
    if (isQuickFact(f)) {
      return f.exists;
    }
    return !!f.value;
  });

  if (shown.length === 0) return null;

  return (
    <>
      <span className={styles.srOnly}>READ-ONLY · SYSTEM</span>
      <dl className={styles.factsGrid}>
        {shown.map((fact) => (
          <div key={fact.label} className={styles.factItem}>
            <dt className={styles.factKey}>{fact.label}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
            {fact.sub && <dd className={styles.factSub}>{fact.sub}</dd>}
          </div>
        ))}
      </dl>
    </>
  );
}
