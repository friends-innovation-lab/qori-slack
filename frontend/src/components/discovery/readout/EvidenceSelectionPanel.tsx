/**
 * EvidenceSelectionPanel — Evidence selection for readout generation
 *
 * DR-6b-5d-B: Initial generation UI
 * DR-6b-5e-B-3: Regeneration preselection
 *
 * - Loads eligible accepted insight revisions
 * - Initial generation: all eligible revisions pre-selected by default
 * - Regeneration: preselects only historical revisions that remain eligible
 * - Allows individual selection/deselection
 * - Preserves user selection across refetches
 * - Submits exact acceptedRevision.revisionPublicId values
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { useEligibleEvidence, type EligibleInsight } from '@/api/readouts';
import styles from './readout.module.css';

/**
 * Selection initialization mode:
 * - 'all': Select all eligible evidence (default, for initial generation)
 * - 'provided': Use provided selectedRevisionIds intersected with eligible (for regeneration)
 */
export type SelectionInitMode = 'all' | 'provided';

interface EvidenceSelectionPanelProps {
  projectPublicId: string;
  studyPublicId: string;
  readoutPublicId: string;
  selectedRevisionIds: string[];
  onSelectionChange: (revisionIds: string[]) => void;
  disabled?: boolean;
  /**
   * How to initialize the selection when evidence first loads:
   * - 'all': Select all eligible evidence (default, for initial generation)
   * - 'provided': Use provided selectedRevisionIds intersected with eligible (for regeneration)
   */
  initialSelectionMode?: SelectionInitMode;
}

export function EvidenceSelectionPanel({
  projectPublicId,
  studyPublicId,
  readoutPublicId,
  selectedRevisionIds,
  onSelectionChange,
  disabled = false,
  initialSelectionMode = 'all',
}: EvidenceSelectionPanelProps) {
  // Track whether initial selection has been applied
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch eligible evidence
  const evidenceQuery = useEligibleEvidence(
    projectPublicId,
    studyPublicId,
    readoutPublicId,
    { limit: 100, offset: 0 },
  );

  const insights = useMemo(
    () => evidenceQuery.data?.data.insights ?? [],
    [evidenceQuery.data],
  );

  // Get all eligible revision IDs from current fetch
  const eligibleRevisionIds = useMemo(
    () => new Set(insights.map((i) => i.acceptedRevision.revisionPublicId)),
    [insights],
  );

  // Initialize selection based on mode when evidence first loads
  useEffect(() => {
    if (!hasInitialized && insights.length > 0) {
      if (initialSelectionMode === 'all') {
        // Initial generation: select all eligible revisions
        const allRevisionIds = insights.map((i) => i.acceptedRevision.revisionPublicId);
        onSelectionChange(allRevisionIds);
      } else {
        // Regeneration mode ('provided'): intersect provided IDs with eligible
        // Only select historical revisions that are still eligible
        // If none remain eligible, start with empty selection (requires manual selection)
        const eligibleHistoricalIds = selectedRevisionIds.filter((id) =>
          eligibleRevisionIds.has(id),
        );
        onSelectionChange(eligibleHistoricalIds);
      }
      setHasInitialized(true);
    }
  }, [insights, hasInitialized, onSelectionChange, initialSelectionMode, selectedRevisionIds, eligibleRevisionIds]);

  // When evidence refetches (after initialization), reconcile selection:
  // - Keep user's existing selections that are still eligible
  // - Remove selections that became ineligible
  // - Never automatically substitute newer revisions
  useEffect(() => {
    if (!hasInitialized || insights.length === 0) return;

    // Filter out any selected revisions that are no longer eligible
    const reconciledSelection = selectedRevisionIds.filter((id) =>
      eligibleRevisionIds.has(id),
    );

    // Only update if there was a change (to avoid infinite loops)
    if (reconciledSelection.length !== selectedRevisionIds.length) {
      onSelectionChange(reconciledSelection);
    }
  }, [eligibleRevisionIds, selectedRevisionIds, hasInitialized, onSelectionChange]);

  // Toggle individual revision selection
  const handleToggle = useCallback(
    (revisionPublicId: string) => {
      if (disabled) return;

      const isSelected = selectedRevisionIds.includes(revisionPublicId);
      if (isSelected) {
        onSelectionChange(selectedRevisionIds.filter((id) => id !== revisionPublicId));
      } else {
        onSelectionChange([...selectedRevisionIds, revisionPublicId]);
      }
    },
    [selectedRevisionIds, onSelectionChange, disabled],
  );

  // Select/deselect all
  const handleSelectAll = useCallback(() => {
    if (disabled) return;
    const allRevisionIds = insights.map((i) => i.acceptedRevision.revisionPublicId);
    onSelectionChange(allRevisionIds);
  }, [insights, onSelectionChange, disabled]);

  const handleDeselectAll = useCallback(() => {
    if (disabled) return;
    onSelectionChange([]);
  }, [onSelectionChange, disabled]);

  // Loading state
  if (evidenceQuery.isLoading) {
    return (
      <div className={styles.evidencePanel}>
        <div className={styles.evidencePanelHeader}>
          <h3 className={styles.evidencePanelTitle}>Select Evidence</h3>
        </div>
        <div className={styles.evidenceLoading}>
          <Loader2 size={20} className={styles.spinIcon} />
          <span>Loading eligible evidence...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (evidenceQuery.error) {
    return (
      <div className={styles.evidencePanel}>
        <div className={styles.evidencePanelHeader}>
          <h3 className={styles.evidencePanelTitle}>Select Evidence</h3>
        </div>
        <div className={styles.evidenceError}>
          <AlertCircle size={20} />
          <span>
            Failed to load eligible evidence.{' '}
            <button
              type="button"
              className={styles.retryLink}
              onClick={() => evidenceQuery.refetch()}
            >
              Retry
            </button>
          </span>
        </div>
      </div>
    );
  }

  // Empty state
  if (insights.length === 0) {
    return (
      <div className={styles.evidencePanel}>
        <div className={styles.evidencePanelHeader}>
          <h3 className={styles.evidencePanelTitle}>Select Evidence</h3>
        </div>
        <div className={styles.evidenceEmpty}>
          <AlertCircle size={20} />
          <span>No eligible evidence available.</span>
          <p className={styles.evidenceEmptyHint}>
            Accept insights from Desk research to use them as evidence for this readout.
          </p>
        </div>
      </div>
    );
  }

  const selectedCount = selectedRevisionIds.length;
  const totalCount = insights.length;
  const allSelected = selectedCount === totalCount;

  return (
    <div className={styles.evidencePanel}>
      <div className={styles.evidencePanelHeader}>
        <h3 className={styles.evidencePanelTitle}>Select Evidence</h3>
        <span className={styles.evidenceCount}>
          {selectedCount} of {totalCount} selected
        </span>
      </div>

      <div className={styles.evidenceActions}>
        {allSelected ? (
          <button
            type="button"
            className={styles.evidenceActionButton}
            onClick={handleDeselectAll}
            disabled={disabled}
          >
            Deselect all
          </button>
        ) : (
          <button
            type="button"
            className={styles.evidenceActionButton}
            onClick={handleSelectAll}
            disabled={disabled}
          >
            Select all
          </button>
        )}
      </div>

      <div className={styles.evidenceList}>
        {insights.map((insight) => (
          <EvidenceItem
            key={insight.acceptedRevision.revisionPublicId}
            insight={insight}
            isSelected={selectedRevisionIds.includes(
              insight.acceptedRevision.revisionPublicId,
            )}
            onToggle={() => handleToggle(insight.acceptedRevision.revisionPublicId)}
            disabled={disabled}
          />
        ))}
      </div>

      {selectedCount === 0 && (
        <div className={styles.evidenceWarning}>
          <AlertCircle size={14} />
          <span>Select at least one insight to generate the readout.</span>
        </div>
      )}
    </div>
  );
}

interface EvidenceItemProps {
  insight: EligibleInsight;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function EvidenceItem({ insight, isSelected, onToggle, disabled }: EvidenceItemProps) {
  return (
    <label
      className={`${styles.evidenceItem} ${isSelected ? styles.evidenceItemSelected : ''} ${disabled ? styles.evidenceItemDisabled : ''}`}
    >
      <div className={styles.evidenceCheckbox}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          disabled={disabled}
          className={styles.evidenceCheckboxInput}
        />
        <div
          className={`${styles.evidenceCheckboxCustom} ${isSelected ? styles.evidenceCheckboxChecked : ''}`}
        >
          {isSelected && <Check size={12} />}
        </div>
      </div>
      <div className={styles.evidenceItemContent}>
        <div className={styles.evidenceItemHeader}>
          <span className={styles.evidenceItemId}>
            {insight.displayId} r{insight.acceptedRevision.revisionNumber}
          </span>
          {insight.source && (
            <span className={styles.evidenceItemSource}>{insight.source.label}</span>
          )}
        </div>
        <p className={styles.evidenceItemText}>{insight.wording}</p>
      </div>
    </label>
  );
}

export type { EvidenceSelectionPanelProps };
