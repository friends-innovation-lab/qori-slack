/**
 * InsightEditor — Presentational editor for insight revisions.
 *
 * Per DR05:
 * - Replaces row in place, brand-wash ground, brand top rule
 * - Serif textarea for wording
 * - Reference list: Page/Section/Excerpt inputs or "source as a whole" checkbox
 * - Add-reference select limited to processed project sources
 * - Save creates proposed revision (never accepts per D3)
 * - Validation: wording required, at least one reference required
 *
 * This is a controlled component. Mutation wiring handled by parent.
 */

import { useState, useId, type ChangeEvent } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import styles from './insights.module.css';
import type { EvidenceLocator } from '@qori/api-contracts';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Available source for adding references */
export interface AvailableSource {
  id: number;
  label: string;
  publicId: string;
}

/** Editor reference (mutable form state) */
export interface EditorReference {
  /** Temporary key for React reconciliation */
  key: string;
  /** Evidence source ID */
  evidenceSourceId: number;
  /** Source label */
  sourceLabel: string;
  /** Locator fields */
  locator: EvidenceLocator;
}

interface InsightEditorProps {
  /** Display ID of the insight being edited */
  insightDisplayId: string;
  /** Initial wording (empty for new insights) */
  initialWording?: string;
  /** Initial references */
  initialReferences?: EditorReference[];
  /** Available sources to add */
  availableSources: AvailableSource[];
  /** Submit handler (wording, references) */
  onSave: (wording: string, references: EditorReference[]) => void;
  /** Cancel handler */
  onCancel: () => void;
  /** Whether save is in progress */
  saving?: boolean;
  /** Validation errors from parent */
  errors?: {
    wording?: string;
    references?: string;
  };
  /** Additional class name */
  className?: string;
}

export function InsightEditor({
  insightDisplayId,
  initialWording = '',
  initialReferences = [],
  availableSources,
  onSave,
  onCancel,
  saving = false,
  errors,
  className,
}: InsightEditorProps) {
  const [wording, setWording] = useState(initialWording);
  const [references, setReferences] = useState<EditorReference[]>(initialReferences);
  const [localErrors, setLocalErrors] = useState<{ wording?: string; references?: string }>({});

  const wordingId = useId();
  const refListId = useId();

  // Sources not already referenced
  const unusedSources = availableSources.filter(
    (source) => !references.some((ref) => ref.evidenceSourceId === source.id),
  );

  const handleWordingChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setWording(e.target.value);
    if (e.target.value.trim()) {
      setLocalErrors((prev) => ({ ...prev, wording: undefined }));
    }
  };

  const handleAddReference = (sourceId: string) => {
    const source = availableSources.find((s) => s.id === Number(sourceId));
    if (!source) return;

    const newRef: EditorReference = {
      key: `${source.id}-${Date.now()}`,
      evidenceSourceId: source.id,
      sourceLabel: source.label,
      locator: {},
    };
    setReferences((prev) => [...prev, newRef]);
    setLocalErrors((prev) => ({ ...prev, references: undefined }));
  };

  const handleRemoveReference = (key: string) => {
    setReferences((prev) => prev.filter((ref) => ref.key !== key));
  };

  const handleLocatorChange = (key: string, field: keyof EvidenceLocator, value: string | boolean) => {
    setReferences((prev) =>
      prev.map((ref) =>
        ref.key === key
          ? { ...ref, locator: { ...ref.locator, [field]: value || undefined } }
          : ref,
      ),
    );
  };

  const handleSourceLevelToggle = (key: string, checked: boolean) => {
    setReferences((prev) =>
      prev.map((ref) =>
        ref.key === key
          ? {
              ...ref,
              locator: checked
                ? { sourceLevel: true }
                : { sourceLevel: false },
            }
          : ref,
      ),
    );
  };

  const validate = (): boolean => {
    const newErrors: { wording?: string; references?: string } = {};

    if (!wording.trim()) {
      newErrors.wording = 'Wording is required';
    }
    if (references.length === 0) {
      newErrors.references = 'At least one evidence reference is required';
    }

    setLocalErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(wording.trim(), references);
    }
  };

  const displayErrors = {
    wording: errors?.wording || localErrors.wording,
    references: errors?.references || localErrors.references,
  };

  return (
    <div className={`${styles.insightEditor} ${className || ''}`}>
      {/* Header */}
      <div className={styles.insightEditorHeader}>
        <span className={styles.insightEditorTitle}>
          {initialWording ? `Edit ${insightDisplayId}` : 'New Insight'}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={styles.insightEditorClose}
          aria-label="Cancel editing"
          disabled={saving}
        >
          <X size={18} />
        </button>
      </div>

      {/* Wording textarea */}
      <div className={styles.insightEditorWording}>
        <Textarea
          id={wordingId}
          label="Insight wording"
          value={wording}
          onChange={handleWordingChange}
          error={displayErrors.wording}
          required
          disabled={saving}
          placeholder="Enter the insight wording..."
        />
      </div>

      {/* Evidence references */}
      <div className={styles.insightEditorReferences}>
        <div
          className={styles.insightEditorReferencesHeader}
          id={refListId}
        >
          Evidence References
          {references.length > 0 && <span> ({references.length})</span>}
        </div>

        {displayErrors.references && (
          <div className={styles.insightEditorError} role="alert">
            {displayErrors.references}
          </div>
        )}

        {/* Reference list */}
        <div
          role="list"
          aria-labelledby={refListId}
          className={styles.insightEditorRefList}
        >
          {references.map((ref) => (
            <ReferenceRow
              key={ref.key}
              reference={ref}
              onRemove={() => handleRemoveReference(ref.key)}
              onLocatorChange={(field, value) => handleLocatorChange(ref.key, field, value)}
              onSourceLevelToggle={(checked) => handleSourceLevelToggle(ref.key, checked)}
              disabled={saving}
            />
          ))}
        </div>

        {/* Add reference */}
        {unusedSources.length > 0 && (
          <div className={styles.insightEditorAddRef}>
            <Select
              label="Add evidence from source"
              options={unusedSources.map((s) => ({ value: String(s.id), label: s.label }))}
              placeholder="Select a source..."
              onChange={(e) => {
                if (e.target.value) {
                  handleAddReference(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={saving}
            />
          </div>
        )}

        {unusedSources.length === 0 && references.length === 0 && (
          <div className={styles.insightEditorEmpty}>
            No sources available. Upload and process sources first.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.insightEditorActions}>
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={saving}
          disabled={references.length === 0 || !wording.trim()}
        >
          {initialWording ? 'Propose Revision' : 'Create Insight'}
        </Button>
      </div>

      {/* Note per D3: Save does not accept */}
      <div className={styles.insightEditorNote}>
        Saving will create a proposed revision for review. It does not automatically accept the insight.
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ReferenceRowProps {
  reference: EditorReference;
  onRemove: () => void;
  onLocatorChange: (field: keyof EvidenceLocator, value: string) => void;
  onSourceLevelToggle: (checked: boolean) => void;
  disabled?: boolean;
}

function ReferenceRow({
  reference,
  onRemove,
  onLocatorChange,
  onSourceLevelToggle,
  disabled,
}: ReferenceRowProps) {
  const isSourceLevel = reference.locator.sourceLevel === true;
  const checkboxId = useId();

  return (
    <div role="listitem" className={styles.insightEditorRefRow}>
      <div className={styles.insightEditorRefRowHeader}>
        <span className={styles.insightEditorRefSource}>{reference.sourceLabel}</span>
        <button
          type="button"
          onClick={onRemove}
          className={styles.insightEditorRefRemove}
          aria-label={`Remove reference to ${reference.sourceLabel}`}
          disabled={disabled}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Source-level toggle */}
      <label className={styles.insightEditorRefSourceLevel}>
        <input
          id={checkboxId}
          type="checkbox"
          checked={isSourceLevel}
          onChange={(e) => onSourceLevelToggle(e.target.checked)}
          disabled={disabled}
        />
        <span>Link to source as a whole (no specific location)</span>
      </label>

      {/* Locator fields (hidden when source-level) */}
      {!isSourceLevel && (
        <div className={styles.insightEditorRefLocator}>
          <Input
            label="Page"
            value={reference.locator.page || ''}
            onChange={(e) => onLocatorChange('page', e.target.value)}
            placeholder="e.g., 12-15"
            disabled={disabled}
          />
          <Input
            label="Section"
            value={reference.locator.section || ''}
            onChange={(e) => onLocatorChange('section', e.target.value)}
            placeholder="e.g., Executive Summary"
            disabled={disabled}
          />
          <Textarea
            label="Excerpt"
            value={reference.locator.excerpt || ''}
            onChange={(e) => onLocatorChange('excerpt', e.target.value)}
            placeholder="Paste verbatim source text..."
            hint="The exact quote from the source. Qori does not auto-fill this field."
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
