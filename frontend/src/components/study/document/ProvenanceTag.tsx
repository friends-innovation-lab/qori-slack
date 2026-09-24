/**
 * ProvenanceTag — Section-level provenance indicator.
 * Shows who owns the content: canonical, generated, system, inherited.
 *
 * CC-4: Extended to accept FieldProvenance from view model (§3.10).
 * Renders provenance.label verbatim, deduped and joined with " + ".
 * Legacy string provenance supported until CC-5.
 */

import type { FieldProvenance } from '@qori/artifact-contracts';
import styles from './document.module.css';

/** Legacy provenance type (removed in CC-5) */
type LegacyProvenance = 'canonical' | 'generated' | 'system' | 'inherited' | 'generated+canonical';

/** Map legacy string provenance to display labels (removed in CC-5) */
const legacyLabels: Record<LegacyProvenance, { text: string; editable: boolean }> = {
  canonical: { text: 'CANONICAL', editable: false },
  generated: { text: 'GENERATED', editable: true },
  'generated+canonical': { text: 'GENERATED + CANONICAL', editable: true },
  system: { text: 'READ-ONLY · SYSTEM', editable: false },
  inherited: { text: 'INHERITED · READ-ONLY', editable: false },
};

interface ProvenanceTagProps {
  /** View model provenance (preferred) or legacy string */
  provenance: FieldProvenance | FieldProvenance[] | LegacyProvenance;
  /** Legacy prop - used only with string provenance (removed in CC-5) */
  editable?: boolean;
}

/**
 * Dedupe and join provenance labels (allowed transform per SPEC §9.2).
 */
function provenanceText(list: FieldProvenance[]): string {
  return [...new Set(list.map((p) => p.label))].join(' + ');
}

export function ProvenanceTag({ provenance, editable }: ProvenanceTagProps) {
  // Handle view model provenance (FieldProvenance or array)
  if (typeof provenance === 'object') {
    const list = Array.isArray(provenance) ? provenance : [provenance];
    if (list.length === 0) return null;

    // Render label verbatim from view model
    return (
      <span className={styles.provTag}>
        {provenanceText(list)}
      </span>
    );
  }

  // Legacy string provenance (removed in CC-5)
  const legacy = legacyLabels[provenance as LegacyProvenance];
  if (!legacy) return null;

  const suffix = editable === false ? ' · READ-ONLY' : editable ? ' · EDITABLE' : '';
  // Legacy provenance that already has READ-ONLY in the text shouldn't add suffix
  const text = legacy.text.includes('READ-ONLY') || legacy.text.includes('SYSTEM')
    ? legacy.text
    : `${legacy.text}${suffix}`;

  return (
    <span className={styles.provTag}>
      {text}
    </span>
  );
}
