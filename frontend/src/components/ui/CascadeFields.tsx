/**
 * CascadeFields — Structured rendering for cascade variable arrays.
 *
 * Parses JSON-serialized cascade fields (objectives, questions, barriers)
 * into readable cards with visible IDs and priority/source metadata.
 */

import styles from './CascadeFields.module.css';

// ─── Types ──────────────────────────────────────────────────────

interface Objective {
  id: string;
  objective: string;
}

interface ResearchQuestion {
  id: string;
  question: string;
  priority?: string | null;
}

interface TargetBarrier {
  id: string;
  barrier: string;
  source?: string | null;
}

// ─── Parser ─────────────────────────────────────────────────────

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback: treat as a plain string (legacy scalar value)
    return [];
  }
}

// ─── Priority badge ─────────────────────────────────────────────

const priorityClass: Record<string, string> = {
  Primary: 'primary',
  Secondary: 'secondary',
  Exploratory: 'exploratory',
};

function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return null;
  const cls = priorityClass[priority] || 'secondary';
  return <span className={`${styles.priority} ${styles[cls]}`}>{priority}</span>;
}

// ─── Objectives ─────────────────────────────────────────────────

export function ObjectivesList({ raw, label = 'Research objectives' }: { raw: string | null; label?: string }) {
  const items = safeParse<Objective>(raw);
  if (items.length === 0 && raw) {
    // Plain string fallback
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>{label}</h3>
        <p className={styles.plainText}>{raw}</p>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{label}</h3>
      <ul className={styles.list} role="list">
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={styles.itemId}>{item.id}</span>
            <span className={styles.itemText}>{item.objective}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Research Questions ─────────────────────────────────────────

export function QuestionsList({ raw, label = 'Research questions' }: { raw: string | null; label?: string }) {
  const items = safeParse<ResearchQuestion>(raw);
  if (items.length === 0 && raw) {
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>{label}</h3>
        <p className={styles.plainText}>{raw}</p>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{label}</h3>
      <ul className={styles.list} role="list">
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={styles.itemId}>{item.id}</span>
            <span className={styles.itemText}>{item.question}</span>
            <PriorityBadge priority={item.priority} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Target Barriers ────────────────────────────────────────────

export function BarriersList({ raw, label = 'Target barriers' }: { raw: string | null; label?: string }) {
  const items = safeParse<TargetBarrier>(raw);
  if (items.length === 0 && raw) {
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>{label}</h3>
        <p className={styles.plainText}>{raw}</p>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{label}</h3>
      <ul className={styles.list} role="list">
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={styles.itemId}>{item.id}</span>
            <span className={styles.itemText}>
              {item.barrier}
              {item.source && (
                <span className={styles.source}> — {item.source}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Scalar field ───────────────────────────────────────────────

export function ScalarField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className={styles.scalar}>
      <dt className={styles.scalarLabel}>{label}</dt>
      <dd className={styles.scalarValue}>{value}</dd>
    </div>
  );
}
