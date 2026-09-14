/**
 * ProvenanceTag — Section-level provenance indicator.
 * Shows who owns the content: canonical, generated, system, inherited.
 */

import styles from './document.module.css';

type Provenance = 'canonical' | 'generated' | 'system' | 'inherited';

const labels: Record<Provenance, string> = {
  canonical: 'Canonical',
  generated: 'Generated',
  system: 'System',
  inherited: 'Inherited',
};

const classMap: Record<Provenance, string> = {
  canonical: styles.provCanonical,
  generated: styles.provGenerated,
  system: styles.provSystem,
  inherited: styles.provInherited,
};

interface ProvenanceTagProps {
  provenance: Provenance;
  editable?: boolean;
}

export function ProvenanceTag({ provenance, editable }: ProvenanceTagProps) {
  const suffix = editable === false ? ' · read-only' : editable ? ' · editable' : '';
  return (
    <span className={`${styles.provTag} ${classMap[provenance]}`}>
      {labels[provenance]}{suffix}
    </span>
  );
}
