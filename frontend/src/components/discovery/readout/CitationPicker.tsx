/**
 * CitationPicker — Dropdown for selecting eligible evidence citations
 *
 * DR-6b-4d: Shows eligible insights from project for citation
 * - Uses useEligibleEvidence hook
 * - Creates Citation object with construct + revision info
 */

import { useState, useRef, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { useEligibleEvidence } from '@/api/readouts';
import type { Citation, EligibleInsight } from '@/api/readouts';
import styles from './readout.module.css';

interface CitationPickerProps {
  projectPublicId: string;
  studyPublicId: string;
  readoutPublicId: string;
  onSelect: (citation: Citation) => void;
  onClose: () => void;
  excludeIds?: string[];
}

export function CitationPicker({
  projectPublicId,
  studyPublicId,
  readoutPublicId,
  onSelect,
  onClose,
  excludeIds = [],
}: CitationPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const evidenceQuery = useEligibleEvidence(projectPublicId, studyPublicId, readoutPublicId);

  const insights = evidenceQuery.data?.data.insights ?? [];
  const filteredInsights = insights.filter(
    (insight) => !excludeIds.includes(insight.constructPublicId),
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredInsights.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter' && filteredInsights[selectedIndex]) {
        event.preventDefault();
        handleSelect(filteredInsights[selectedIndex]);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredInsights, selectedIndex, onClose]);

  function handleSelect(insight: EligibleInsight) {
    const citation: Citation = {
      constructPublicId: insight.constructPublicId,
      revisionPublicId: insight.acceptedRevision.revisionPublicId,
      revisionNumber: insight.acceptedRevision.revisionNumber,
      displayId: insight.displayId,
    };
    onSelect(citation);
    onClose();
  }

  return (
    <div ref={pickerRef} className={styles.citationPicker} role="listbox">
      <div className={styles.citationPickerHeader}>
        <span className={styles.citationPickerTitle}>Select evidence</span>
        <button
          type="button"
          className={styles.citationPickerClose}
          onClick={onClose}
          aria-label="Close picker"
        >
          <X size={16} />
        </button>
      </div>

      {evidenceQuery.isLoading && (
        <div className={styles.citationPickerEmpty}>
          <Loader2 size={16} className="animate-spin" />
          <span>Loading evidence...</span>
        </div>
      )}

      {evidenceQuery.error && (
        <div className={styles.citationPickerEmpty}>Failed to load evidence</div>
      )}

      {!evidenceQuery.isLoading && filteredInsights.length === 0 && (
        <div className={styles.citationPickerEmpty}>
          {insights.length === 0
            ? 'No eligible evidence available'
            : 'All available evidence already cited'}
        </div>
      )}

      {filteredInsights.map((insight, index) => (
        <button
          key={insight.constructPublicId}
          type="button"
          className={styles.citationPickerItem}
          onClick={() => handleSelect(insight)}
          role="option"
          aria-selected={index === selectedIndex}
          style={{
            background: index === selectedIndex ? 'var(--color-surface-muted)' : undefined,
          }}
        >
          <div className={styles.citationPickerItemId}>
            {insight.displayId} r{insight.acceptedRevision.revisionNumber}
          </div>
          <div className={styles.citationPickerItemText}>{insight.wording}</div>
        </button>
      ))}
    </div>
  );
}

interface AddCitationButtonProps {
  projectPublicId: string;
  studyPublicId: string;
  readoutPublicId: string;
  onAdd: (citation: Citation) => void;
  existingCitations: Citation[];
  disabled?: boolean;
}

export function AddCitationButton({
  projectPublicId,
  studyPublicId,
  readoutPublicId,
  onAdd,
  existingCitations,
  disabled = false,
}: AddCitationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const excludeIds = existingCitations.map((c) => c.constructPublicId);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={styles.addCitationButton}
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        aria-label="Add citation"
      >
        <Plus size={14} />
        <span>Add</span>
      </button>

      {isOpen && (
        <CitationPicker
          projectPublicId={projectPublicId}
          studyPublicId={studyPublicId}
          readoutPublicId={readoutPublicId}
          onSelect={onAdd}
          onClose={() => setIsOpen(false)}
          excludeIds={excludeIds}
        />
      )}
    </div>
  );
}
