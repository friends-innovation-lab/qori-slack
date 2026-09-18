/**
 * ProvenanceTag — Section-level provenance indicator.
 * Shows who owns the content: canonical, generated, system, inherited.
 * Format matches design: "GENERATED · EDITABLE" or "SYSTEM · READ-ONLY"
 */

import styles from './document.module.css';

type Provenance = 'canonical' | 'generated' | 'system' | 'inherited';

// Design uses compound labels like "GENERATED + CANONICAL" for mixed provenance
type CompoundProvenance = Provenance | 'generated+canonical';

const baseLabels: Record<CompoundProvenance, string> = {
  canonical: 'CANONICAL',
  generated: 'GENERATED',
  'generated+canonical': 'GENERATED + CANONICAL',
  system: 'SYSTEM',
  inherited: 'INHERITED',
};

const classMap: Record<CompoundProvenance, string> = {
  canonical: styles.provCanonical,
  generated: styles.provGenerated,
  'generated+canonical': styles.provGenerated,
  system: styles.provSystem,
  inherited: styles.provInherited,
};

interface ProvenanceTagProps {
  provenance: Provenance | CompoundProvenance;
  editable?: boolean;
}

export function ProvenanceTag({ provenance, editable }: ProvenanceTagProps) {
  const label = baseLabels[provenance as CompoundProvenance] || baseLabels[provenance as Provenance];
  const suffix = editable === false ? ' · READ-ONLY' : editable ? ' · EDITABLE' : '';
  const finalClass = classMap[provenance as CompoundProvenance] || classMap[provenance as Provenance];

  return (
    <span className={`${styles.provTag} ${finalClass}`}>
      {label}{suffix}
    </span>
  );
}
