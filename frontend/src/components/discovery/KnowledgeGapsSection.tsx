/**
 * KnowledgeGapsSection — DISC-3
 *
 * Hub §4 "What we don't know yet" — Knowledge gaps pooled from Ready artifacts.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §4.1.
 *
 * Each gap is a sentence with its marker. Collapsible past 5 items.
 * Carries label "GENERATED · from source-specific runs".
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DiscoveryKnowledgeGap } from '@qori/api-contracts';
import { DiscoveryMarker } from './DiscoveryMarker';
import { ProvenanceTag } from '@/components/study/document/ProvenanceTag';
import styles from './KnowledgeGapsSection.module.css';

interface KnowledgeGapsSectionProps {
  gaps: DiscoveryKnowledgeGap[];
}

const MAX_VISIBLE = 5;

export function KnowledgeGapsSection({ gaps }: KnowledgeGapsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (gaps.length === 0) {
    return null;
  }

  const displayGaps = expanded ? gaps : gaps.slice(0, MAX_VISIBLE);
  const hasMore = gaps.length > MAX_VISIBLE;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <ProvenanceTag provenance="generated" />
      </div>

      <ul className={styles.list} aria-label="Knowledge gaps">
        {displayGaps.map((gap, index) => (
          <li key={gap.itemId || `gap-${index}`} className={styles.item}>
            <span className={styles.gap}>{gap.gap}</span>
            <DiscoveryMarker
              marker={gap.sourceMarker}
              name={gap.gap}
              type={gap.discoveryType}
            />
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} aria-hidden="true" />
              Show fewer
            </>
          ) : (
            <>
              <ChevronDown size={14} aria-hidden="true" />
              Show all {gaps.length}
            </>
          )}
        </button>
      )}

      <p className={styles.footnote}>
        from source-specific runs
      </p>
    </div>
  );
}
