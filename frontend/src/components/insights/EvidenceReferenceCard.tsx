/**
 * EvidenceReferenceCard — Display for evidence supporting an insight revision.
 *
 * Per DR04/DR09:
 * - File name 13/600 + "Added {date} · {run}"
 * - Locator dl: Page, Section, Excerpt ("Not recorded" when missing)
 * - Source excerpt block: muted surface, roman serif 14/22
 * - Source-level attribution: special notice when no locator
 * - Never invent missing data
 */

import { CheckCircle, AlertCircle, Info, ExternalLink, Filter } from 'lucide-react';
import styles from './insights.module.css';
import type { EvidenceReference, EvidenceLocator } from '@qori/api-contracts';

interface EvidenceReferenceCardProps {
  /** Evidence reference data */
  reference: EvidenceReference;
  /** When the reference was added */
  addedDate?: string;
  /** Discovery run name/ID */
  runName?: string;
  /** Click handler for navigating to source */
  onNavigateToSource?: () => void;
  /** DR-4d: Click handler for filtering by this source */
  onFilterBySource?: () => void;
  /** Additional class name */
  className?: string;
}

export function EvidenceReferenceCard({
  reference,
  addedDate,
  runName,
  onNavigateToSource,
  onFilterBySource,
  className,
}: EvidenceReferenceCardProps) {
  const { locator, validation, sourceLabel } = reference;
  const isSourceLevel = locator.sourceLevel === true || isLocatorEmpty(locator);

  return (
    <div className={`${styles.evidenceRef} ${className || ''}`}>
      {/* Header: source name + meta + navigation */}
      <div className={styles.evidenceRefHeader}>
        <span className={styles.evidenceRefSource}>
          {sourceLabel || `Source ${reference.evidenceSourceId}`}
        </span>
        {(addedDate || runName) && (
          <span className={styles.evidenceRefMeta}>
            {addedDate && `Added ${formatDate(addedDate)}`}
            {addedDate && runName && ' · '}
            {runName}
          </span>
        )}
      </div>

      {/* Validation status */}
      {validation && <ValidationBadge validation={validation} />}

      {/* Source-level attribution notice */}
      {isSourceLevel ? (
        <SourceLevelNotice limitation={locator.attributionLimitation} />
      ) : (
        <>
          {/* Locator fields */}
          <LocatorFields locator={locator} />

          {/* Source excerpt (verbatim from source) */}
          {locator.excerpt && (
            <div className={styles.evidenceExcerpt}>
              <span className={styles.evidenceExcerptLabel}>Source excerpt</span>
              {locator.excerpt}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      {(onNavigateToSource || onFilterBySource) && (
        <div className={styles.evidenceRefActions}>
          {onFilterBySource && (
            <button
              type="button"
              onClick={onFilterBySource}
              className={styles.evidenceRefAction}
            >
              <Filter size={12} aria-hidden="true" />
              Filter by this source
            </button>
          )}
          {onNavigateToSource && (
            <button
              type="button"
              onClick={onNavigateToSource}
              className={styles.evidenceRefAction}
            >
              <ExternalLink size={12} aria-hidden="true" />
              Open source
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface LocatorFieldsProps {
  locator: EvidenceLocator;
}

function LocatorFields({ locator }: LocatorFieldsProps) {
  const hasAnyLocator = locator.page || locator.section || locator.excerpt;

  if (!hasAnyLocator) {
    return null;
  }

  return (
    <dl className={styles.evidenceRefLocator}>
      {/* Page */}
      <dt>Page</dt>
      <dd>
        {locator.page || (
          <span className={styles.evidenceRefNotRecorded}>Not recorded</span>
        )}
      </dd>

      {/* Section */}
      <dt>Section</dt>
      <dd>
        {locator.section || (
          <span className={styles.evidenceRefNotRecorded}>Not recorded</span>
        )}
      </dd>
    </dl>
  );
}

interface SourceLevelNoticeProps {
  limitation?: string;
}

function SourceLevelNotice({ limitation }: SourceLevelNoticeProps) {
  return (
    <div className={styles.evidenceSourceLevel}>
      <Info size={14} aria-hidden="true" />
      <div>
        <strong>Source-level attribution.</strong> Linked to this source as a whole.
        No page, section or excerpt was recorded.
        {limitation && (
          <>
            <br />
            <em>{limitation}</em>
          </>
        )}
      </div>
    </div>
  );
}

interface ValidationBadgeProps {
  validation: NonNullable<EvidenceReference['validation']>;
}

function ValidationBadge({ validation }: ValidationBadgeProps) {
  const isVerified = validation === 'verified';
  const Icon = isVerified ? CheckCircle : AlertCircle;
  const label = getValidationLabel(validation);

  return (
    <span
      className={`${styles.evidenceValidation} ${isVerified ? styles.evidenceValidationVerified : styles.evidenceValidationUnverified}`}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isLocatorEmpty(locator: EvidenceLocator): boolean {
  return !locator.page && !locator.section && !locator.excerpt;
}

function getValidationLabel(validation: NonNullable<EvidenceReference['validation']>): string {
  switch (validation) {
    case 'verified':
      return 'Verified';
    case 'source_attributed_unverified':
      return 'Source attributed';
    case 'ai_unverified':
      return 'AI extracted';
  }
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}
