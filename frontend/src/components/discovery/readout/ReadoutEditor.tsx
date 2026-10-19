/**
 * ReadoutEditor — Main draft editor component
 *
 * DR-6b-4d: Orchestrates all editing sections
 * - Summary, Findings, Limitations, Implications
 * - Citation selection
 * - Review state management
 * - Save and conflict handling
 *
 * DR-6b-4e: Approval integration
 * - Approve button when eligible
 * - Eligibility status indicator
 */

import { useCallback, useMemo } from 'react';
import { Plus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type {
  DraftContent,
  Finding,
  Limitation,
  Implication,
  ImplicationKind,
  Citation,
  ApprovalEligibility,
} from '@/api/readouts';
import type { EditorState } from '@/hooks/useReadoutEditor';
import { SaveStateIndicator } from '@/components/study/document/SaveStateIndicator';
import { FindingBlock } from './FindingBlock';
import { ImplicationBlock } from './ImplicationBlock';
import { CitationChip } from './CitationChip';
import { AddCitationButton } from './CitationPicker';
import styles from './readout.module.css';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface ReadoutEditorProps {
  title: string;
  question: string | null;
  displayId: string;
  editorState: EditorState;
  isDirty: boolean;
  saveState: SaveState;
  savedAt?: string;
  invalidatedFindings: string[];
  invalidatedImplications: string[];
  readOnly?: boolean;
  projectPublicId: string;
  studyPublicId: string;
  readoutPublicId: string;
  onContentChange: (content: DraftContent) => void;
  onToggleFindingChecked: (findingId: string) => void;
  onToggleImplicationReviewed: (implicationId: string) => void;
  onSave: () => void;
  // Approval props (DR-6b-4e)
  canApprove?: boolean;
  eligibility?: ApprovalEligibility;
  isCheckingEligibility?: boolean;
  onApprove?: () => void;
}

export function ReadoutEditor({
  title,
  question,
  displayId,
  editorState,
  isDirty,
  saveState,
  savedAt,
  invalidatedFindings,
  invalidatedImplications,
  readOnly = false,
  projectPublicId,
  studyPublicId,
  readoutPublicId,
  onContentChange,
  onToggleFindingChecked,
  onToggleImplicationReviewed,
  onSave,
  // Approval props
  canApprove = false,
  eligibility,
  isCheckingEligibility = false,
  onApprove,
}: ReadoutEditorProps) {
  const { content, findingsChecked, implicationsReviewed } = editorState;

  const findings = useMemo(() => content.findings ?? [], [content.findings]);
  const limitations = useMemo(() => content.limitations ?? [], [content.limitations]);
  const implications = useMemo(() => content.implications ?? [], [content.implications]);

  // Summary handlers
  const handleSummaryTextChange = useCallback(
    (text: string) => {
      onContentChange({
        ...content,
        summary: { ...content.summary, text, citations: content.summary?.citations ?? [] },
      });
    },
    [content, onContentChange],
  );

  const handleSummaryAddCitation = useCallback(
    (citation: Citation) => {
      const currentCitations = content.summary?.citations ?? [];
      onContentChange({
        ...content,
        summary: {
          ...content.summary,
          text: content.summary?.text ?? '',
          citations: [...currentCitations, citation],
        },
      });
    },
    [content, onContentChange],
  );

  const handleSummaryRemoveCitation = useCallback(
    (index: number) => {
      const currentCitations = content.summary?.citations ?? [];
      onContentChange({
        ...content,
        summary: {
          ...content.summary,
          text: content.summary?.text ?? '',
          citations: currentCitations.filter((_, i) => i !== index),
        },
      });
    },
    [content, onContentChange],
  );

  // Finding handlers
  const handleFindingTextChange = useCallback(
    (findingId: string, text: string) => {
      onContentChange({
        ...content,
        findings: findings.map((f) => (f.id === findingId ? { ...f, text } : f)),
      });
    },
    [content, findings, onContentChange],
  );

  const handleFindingAddCitation = useCallback(
    (findingId: string, citation: Citation) => {
      onContentChange({
        ...content,
        findings: findings.map((f) =>
          f.id === findingId ? { ...f, citations: [...f.citations, citation] } : f,
        ),
      });
    },
    [content, findings, onContentChange],
  );

  const handleFindingRemoveCitation = useCallback(
    (findingId: string, citationIndex: number) => {
      onContentChange({
        ...content,
        findings: findings.map((f) =>
          f.id === findingId
            ? { ...f, citations: f.citations.filter((_, i) => i !== citationIndex) }
            : f,
        ),
      });
    },
    [content, findings, onContentChange],
  );

  const handleAddFinding = useCallback(() => {
    const newFinding: Finding = {
      id: uuidv4(),
      text: '',
      citations: [],
    };
    onContentChange({
      ...content,
      findings: [...findings, newFinding],
    });
  }, [content, findings, onContentChange]);

  // Limitation handlers
  const handleLimitationTextChange = useCallback(
    (limitationId: string, text: string) => {
      onContentChange({
        ...content,
        limitations: limitations.map((l) => (l.id === limitationId ? { ...l, text } : l)),
      });
    },
    [content, limitations, onContentChange],
  );

  const handleAddLimitation = useCallback(() => {
    const newLimitation: Limitation = {
      id: uuidv4(),
      text: '',
    };
    onContentChange({
      ...content,
      limitations: [...limitations, newLimitation],
    });
  }, [content, limitations, onContentChange]);

  // Implication handlers
  const handleImplicationTextChange = useCallback(
    (implicationId: string, text: string) => {
      onContentChange({
        ...content,
        implications: implications.map((i) => (i.id === implicationId ? { ...i, text } : i)),
      });
    },
    [content, implications, onContentChange],
  );

  const handleImplicationKindChange = useCallback(
    (implicationId: string, kind: ImplicationKind) => {
      onContentChange({
        ...content,
        implications: implications.map((i) => (i.id === implicationId ? { ...i, kind } : i)),
      });
    },
    [content, implications, onContentChange],
  );

  const handleImplicationToggleFinding = useCallback(
    (implicationId: string, findingId: string) => {
      onContentChange({
        ...content,
        implications: implications.map((i) => {
          if (i.id !== implicationId) return i;
          const hasF = i.basedOnFindings.includes(findingId);
          return {
            ...i,
            basedOnFindings: hasF
              ? i.basedOnFindings.filter((f) => f !== findingId)
              : [...i.basedOnFindings, findingId],
          };
        }),
      });
    },
    [content, implications, onContentChange],
  );

  const handleAddImplication = useCallback(() => {
    const newImplication: Implication = {
      id: uuidv4(),
      kind: 'question',
      text: '',
      basedOnFindings: [],
    };
    onContentChange({
      ...content,
      implications: [...implications, newImplication],
    });
  }, [content, implications, onContentChange]);

  return (
    <div className={styles.editorContainer}>
      {/* Masthead - Read-only title/question */}
      <div className={styles.masthead}>
        <span className={styles.eyebrow}>Desk readout · {displayId}</span>
        <h1 className={styles.title}>{title}</h1>
        {question && <p className={styles.question}>{question}</p>}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <SaveStateIndicator state={saveState} savedAt={savedAt} />
          {/* Eligibility indicator */}
          {canApprove && !isDirty && saveState === 'saved' && (
            <span className={styles.eligibilityIndicator}>
              {isCheckingEligibility ? (
                <>
                  <Loader2 size={14} className={styles.spinIcon} />
                  <span>Checking eligibility...</span>
                </>
              ) : eligibility?.eligible ? (
                <>
                  <CheckCircle size={14} className={styles.eligibleIcon} />
                  <span>Ready for approval</span>
                </>
              ) : eligibility ? (
                <>
                  <AlertCircle size={14} className={styles.ineligibleIcon} />
                  <span>Not eligible</span>
                </>
              ) : null}
            </span>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onSave}
            disabled={!isDirty || saveState === 'saving' || readOnly}
          >
            {saveState === 'saving' ? 'Saving...' : 'Save'}
          </button>
          {/* Approve button (DR-6b-4e) */}
          {canApprove && onApprove && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onApprove}
              disabled={isDirty || saveState === 'saving' || !eligibility?.eligible}
              title={
                isDirty
                  ? 'Save changes before approving'
                  : !eligibility?.eligible
                    ? 'Readout is not eligible for approval'
                    : 'Approve this readout'
              }
            >
              Approve
            </button>
          )}
        </div>
      </div>

      {/* Section 1: Summary */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Summary</h2>
        </div>
        <div className={styles.narrativeBlock}>
          <textarea
            className={`${styles.textArea} ${readOnly ? styles.textAreaReadOnly : ''}`}
            value={content.summary?.text ?? ''}
            onChange={(e) => handleSummaryTextChange(e.target.value)}
            readOnly={readOnly}
            placeholder="Enter a summary of the desk research findings..."
            aria-label="Summary text"
          />
          <div className={styles.citationsRow}>
            <span className={styles.citationsLabel}>Citations:</span>
            {(content.summary?.citations ?? []).map((citation, index) => (
              <CitationChip
                key={`${citation.constructPublicId}-${index}`}
                citation={citation}
                onRemove={() => handleSummaryRemoveCitation(index)}
                readOnly={readOnly}
              />
            ))}
            {!readOnly && (
              <AddCitationButton
                projectPublicId={projectPublicId}
                studyPublicId={studyPublicId}
                readoutPublicId={readoutPublicId}
                onAdd={handleSummaryAddCitation}
                existingCitations={content.summary?.citations ?? []}
              />
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Findings */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Findings</h2>
          <span className={styles.sectionCount}>{findings.length} items</span>
        </div>

        {findings.length === 0 ? (
          <div className={styles.emptySection}>
            <p>No findings yet. Add a finding to document evidence-supported observations.</p>
            {!readOnly && (
              <button type="button" className={styles.addItemButton} onClick={handleAddFinding}>
                <Plus size={14} />
                Add finding
              </button>
            )}
          </div>
        ) : (
          <>
            {findings.map((finding, index) => (
              <FindingBlock
                key={finding.id}
                finding={finding}
                index={index}
                isChecked={findingsChecked.includes(finding.id)}
                isInvalidated={invalidatedFindings.includes(finding.id)}
                readOnly={readOnly}
                projectPublicId={projectPublicId}
                studyPublicId={studyPublicId}
                readoutPublicId={readoutPublicId}
                onTextChange={(text) => handleFindingTextChange(finding.id, text)}
                onToggleChecked={() => onToggleFindingChecked(finding.id)}
                onAddCitation={(citation) => handleFindingAddCitation(finding.id, citation)}
                onRemoveCitation={(citationIndex) =>
                  handleFindingRemoveCitation(finding.id, citationIndex)
                }
              />
            ))}
            {!readOnly && (
              <button type="button" className={styles.addItemButton} onClick={handleAddFinding}>
                <Plus size={14} />
                Add finding
              </button>
            )}
          </>
        )}
      </section>

      {/* Section 3: Evidence Limitations */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Evidence Limitations</h2>
          <span className={styles.sectionCount}>{limitations.length} items</span>
        </div>

        {limitations.length === 0 ? (
          <div className={styles.emptySection}>
            <p>No limitations documented. Add any limitations of the evidence sources.</p>
            {!readOnly && (
              <button type="button" className={styles.addItemButton} onClick={handleAddLimitation}>
                <Plus size={14} />
                Add limitation
              </button>
            )}
          </div>
        ) : (
          <>
            {limitations.map((limitation, index) => (
              <div key={limitation.id} className={styles.narrativeBlock}>
                <div className={styles.narrativeHeader}>
                  <span className={styles.narrativeId}>L{index + 1}</span>
                </div>
                <textarea
                  className={`${styles.textArea} ${readOnly ? styles.textAreaReadOnly : ''}`}
                  value={limitation.text}
                  onChange={(e) => handleLimitationTextChange(limitation.id, e.target.value)}
                  readOnly={readOnly}
                  placeholder="Enter limitation..."
                  aria-label={`Limitation L${index + 1} text`}
                />
              </div>
            ))}
            {!readOnly && (
              <button type="button" className={styles.addItemButton} onClick={handleAddLimitation}>
                <Plus size={14} />
                Add limitation
              </button>
            )}
          </>
        )}
      </section>

      {/* Section 4: Implications for the Research Brief */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Implications for the Research Brief</h2>
          <span className={styles.sectionCount}>{implications.length} items</span>
        </div>

        {implications.length === 0 ? (
          <div className={styles.emptySection}>
            <p>
              No implications yet. Add implications to suggest research questions, gaps, priorities,
              or hypotheses.
            </p>
            {!readOnly && (
              <button type="button" className={styles.addItemButton} onClick={handleAddImplication}>
                <Plus size={14} />
                Add implication
              </button>
            )}
          </div>
        ) : (
          <>
            {implications.map((implication, index) => (
              <ImplicationBlock
                key={implication.id}
                implication={implication}
                index={index}
                findings={findings}
                isReviewed={implicationsReviewed.includes(implication.id)}
                isInvalidated={invalidatedImplications.includes(implication.id)}
                readOnly={readOnly}
                onTextChange={(text) => handleImplicationTextChange(implication.id, text)}
                onKindChange={(kind) => handleImplicationKindChange(implication.id, kind)}
                onToggleReviewed={() => onToggleImplicationReviewed(implication.id)}
                onToggleFinding={(findingId) =>
                  handleImplicationToggleFinding(implication.id, findingId)
                }
              />
            ))}
            {!readOnly && (
              <button type="button" className={styles.addItemButton} onClick={handleAddImplication}>
                <Plus size={14} />
                Add implication
              </button>
            )}
          </>
        )}
      </section>

    </div>
  );
}
