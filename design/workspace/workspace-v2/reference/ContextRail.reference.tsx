/**
 * DESIGN REFERENCE — NOT PRODUCTION
 * ContextRail (new: frontend/src/components/study/workspace/ContextRail.tsx) and the extended
 * ReviewRail content (frontend/src/components/study/document/ReviewRail.tsx).
 * Review mode maps 1:1 to the production Brief approval model. Mutations are represented by callbacks only.
 * Coaching / Comments are NOT rendered in UX-3A (DDR-05) — the modes[] API simply accepts them later.
 * Spec: WORKSPACE_V2_SPEC.md §10, COMPONENT_MAPPING.md §3.16, §3.19, RESPONSIVE.md.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { X, ClipboardCheck } from 'lucide-react';
import type { BriefApprovalState } from '@qori/artifact-contracts';
import { sampleBriefVm } from './sample-view-models';
import './workspace-v2.reference.css';

type ModeId = 'review' | 'coaching' | 'comments';
interface RailMode { id: ModeId; label: string; count?: number; icon: typeof ClipboardCheck; content: ReactNode }
type Presentation = 'docked' | 'overlay' | 'sheet'; // ≥1181 · 768–1180 · ≤767 (from useMediaQuery)

export function ContextRailReference({ modes, activeMode, onModeChange, presentation, returnFocusTo }: {
  modes: RailMode[]; activeMode: ModeId | null; onModeChange: (m: ModeId | null) => void; presentation: Presentation; returnFocusTo?: React.RefObject<HTMLElement>;
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const open = activeMode !== null;

  useEffect(() => { if (open) tabRefs.current[activeMode!]?.focus(); }, [open]); // focus active tab on open

  const close = () => { onModeChange(null); returnFocusTo?.current?.focus(); };

  useEffect(() => {
    if (!open || presentation === 'docked') return;                   // docked ignores Escape
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, presentation]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = e.key === 'ArrowRight' ? (i + 1) % modes.length : e.key === 'ArrowLeft' ? (i - 1 + modes.length) % modes.length : e.key === 'Home' ? 0 : e.key === 'End' ? modes.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); onModeChange(modes[next].id); tabRefs.current[modes[next].id]?.focus();
  };

  if (!open) {
    if (presentation === 'sheet') return null;                        // ≤767: no strip, header toggle only
    return (
      <div className="strip" aria-label="Document panel (collapsed)" role="group">
        {modes.map((m) => (
          <button key={m.id} type="button" className="iconButton" aria-label={`${m.label} panel`} aria-pressed={false} aria-controls="context-rail" onClick={() => onModeChange(m.id)}>
            <m.icon size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    );
  }

  const current = modes.find((m) => m.id === activeMode)!;
  const shellClass = `rail railOverlayCapable${presentation === 'overlay' ? ' railOverlay' : presentation === 'sheet' ? ' railSheet' : ''}`;
  const dialogProps = presentation === 'sheet' ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Document panel' } : {};

  return (
    <>
      {presentation === 'overlay' && <div className="strip" aria-hidden="true" />}{/* strip stays docked under the overlay */}
      <aside id="context-rail" className={shellClass} aria-label="Document panel" {...dialogProps}>
        <div className="railTabs" role="tablist" aria-label="Panel mode">
          {modes.map((m, i) => (
            <button key={m.id} ref={(el) => { tabRefs.current[m.id] = el; }} type="button" role="tab" id={`rail-tab-${m.id}`}
              aria-selected={m.id === activeMode} aria-controls={`rail-panel-${m.id}`} tabIndex={m.id === activeMode ? 0 : -1}
              className="railTab" onClick={() => onModeChange(m.id)} onKeyDown={(e) => onTabKey(e, i)}>
              {m.label}{m.count != null && <span className="railTabCount">{m.count}</span>}
            </button>
          ))}
          <button type="button" className="iconButton railClose" aria-label="Close panel" onClick={close}><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="railBody" role="tabpanel" id={`rail-panel-${current.id}`} aria-labelledby={`rail-tab-${current.id}`} tabIndex={0}>
          {current.content}
        </div>
      </aside>
    </>
  );
}

/* ── ReviewRail (extended): consumes vm.approval (BriefApprovalState). Production copy verbatim; checklist keys/labels from BriefDocument ── */
const CHECK_LABELS: Record<string, string> = {
  scope: 'Scope and method are appropriate', timeline: 'Timeline and deadline are feasible',
  participants: 'Participant approach is sound', budget: 'Budget is reasonable',
};

export function ReviewRailReference({ approval, approving, requesting, onApprove, onRequestChanges }: {
  approval: BriefApprovalState; approving?: boolean; requesting?: boolean; onApprove?: () => void; onRequestChanges?: (comment: string) => void;
}) {
  const reviewerName = approval.reviewerDisplayName;
  // allowed presentation-only formatting (SPEC §1.1 rule 6)
  const approvedAt = approval.approvedAt ? new Date(approval.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const changeFeedback = approval.changeFeedback;
  const [checklist, setChecklist] = useState({ scope: false, timeline: false, participants: false, budget: false });
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const allChecked = Object.values(checklist).every(Boolean);
  if (approval.status === null) return null; // after all hooks (Rules of Hooks)

  return (
    <div className="reviewRail">
      <p className="reviewEyebrow">Brief approval</p>
      {approval.isApproved && (<>
        <h2 className="reviewStatus reviewStatusSuccess">Approved</h2>
        <p className="reviewCardText">{reviewerName && <>by {reviewerName} · </>}{approvedAt}. The brief is now the citation source for downstream artifacts; edits after approval flag them stale.</p>
      </>)}
      {approval.isChangesRequested && (<>
        <h2 className="reviewStatus reviewStatusError">Changes requested</h2>
        <p className="reviewCardText">{reviewerName && <>by {reviewerName}.</>}</p>
        {changeFeedback && <blockquote className="reviewFeedback">{changeFeedback}</blockquote>}
      </>)}
      {approval.isPendingApproval && !showForm && (<>
        <h2 className="reviewStatus reviewStatusWarning">Pending approval</h2>
        <p className="reviewCardText">A stakeholder review is required before proceeding to the research plan.</p>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="srOnly">Approval checklist</legend>
          <ul className="reviewChecklist">
            {Object.entries(checklist).map(([key, checked]) => (
              <li key={key}><label className="reviewCheck">
                <input type="checkbox" checked={checked} onChange={(e) => setChecklist((p) => ({ ...p, [key]: e.target.checked }))} />
                <span>{CHECK_LABELS[key]}</span>
              </label></li>
            ))}
          </ul>
        </fieldset>
        <div className="reviewActions">
          <button type="button" className="button primary sm" disabled={!allChecked || approving} aria-describedby={!allChecked ? 'approve-hint' : undefined} onClick={onApprove}>
            {approving ? 'Approving...' : 'Approve'}
          </button>
          <button type="button" className="button secondary sm" onClick={() => setShowForm(true)}>Request changes</button>
        </div>
        {!allChecked && <p id="approve-hint" className="railNote">{/* DDR-15 copy */}Confirm all four checks to approve.</p>}
      </>)}
      {approval.isPendingApproval && showForm && (<>
        <h2 className="reviewStatus reviewStatusWarning">Request changes</h2>
        {/* production <Textarea label="Feedback" …/> */}
        <label className="reviewCheck" style={{ flexDirection: 'column', cursor: 'auto' }}>
          <span style={{ fontWeight: 600 }}>Feedback</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Describe the changes needed..." rows={4} />
        </label>
        <div className="reviewActions">
          <button type="button" className="button secondary sm" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="button" className="button primary sm" disabled={!comment.trim() || requesting} onClick={() => onRequestChanges?.(comment.trim())}>
            {requesting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </>)}
    </div>
  );
}

/* ── Brief wiring example (no data layer) ── */
export function BriefRailExampleReference({ approval = sampleBriefVm.approval, presentation }: { approval?: BriefApprovalState; presentation: Presentation }) {
  const [mode, setMode] = useState<ModeId | null>(presentation === 'docked' ? 'review' : null); // default per SPEC §10.1
  return (
    <ContextRailReference presentation={presentation} activeMode={mode} onModeChange={setMode}
      modes={[{ id: 'review', label: 'Review', icon: ClipboardCheck,
        content: <ReviewRailReference approval={approval} /> }]} />
  );
}
