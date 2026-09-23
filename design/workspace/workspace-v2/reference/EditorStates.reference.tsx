/**
 * DESIGN REFERENCE — NOT PRODUCTION
 * Visual states for the EXISTING ArtifactEditor / EditToolbar (frontend/src/components/study/editor/).
 * This file does NOT create an editor. The static markup below mirrors exactly what the production
 * TipTap extensions already render (see QoriSection.renderHTML, QoriStructuredItem.renderHTML,
 * QoriSystemBlock.renderHTML) so the CSS in workspace-v2.reference.css → editor.module.css can be verified.
 * No schema, serializer, bridge or pipeline change is implied.
 * Spec: WORKSPACE_V2_SPEC.md §8.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import './workspace-v2.reference.css';

/* ── EditToolbar: production tool set, + aria-pressed, aria-label, roving tabindex ── */
const TOOLS: ({ id: string; glyph: string; label: string } | 'sep')[] = [
  { id: 'bold', glyph: 'B', label: 'Bold' }, { id: 'italic', glyph: 'I', label: 'Italic' }, 'sep',
  { id: 'h2', glyph: 'H2', label: 'Heading 2' }, { id: 'h3', glyph: 'H3', label: 'Heading 3' }, 'sep',
  { id: 'bullet', glyph: '•', label: 'Bullet list' }, { id: 'ordered', glyph: '1.', label: 'Numbered list' },
];

export function EditToolbarReference({ active = ['bold'], disabled = [] }: { active?: string[]; disabled?: string[] }) {
  const buttons = TOOLS.filter((t): t is Exclude<typeof t, 'sep'> => t !== 'sep');
  const [focusIdx, setFocusIdx] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const n = buttons.length;
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return; e.preventDefault(); setFocusIdx(next); refs.current[next]?.focus();
  };
  let b = -1;
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {TOOLS.map((t, i) => {
        if (t === 'sep') return <span key={`s${i}`} className="toolSep" aria-hidden="true" />;
        b += 1; const idx = b;
        return (
          <button key={t.id} ref={(el) => { refs.current[idx] = el; }} type="button" className="tool"
            aria-label={t.label} aria-pressed={active.includes(t.id)} disabled={disabled.includes(t.id)}
            tabIndex={idx === focusIdx ? 0 : -1} onKeyDown={(e) => move(e, idx)} onFocus={() => setFocusIdx(idx)}
            style={t.id === 'italic' ? { fontStyle: 'italic' } : t.id === 'bold' ? { fontWeight: 700 } : undefined}>
            {t.glyph}
          </button>
        );
      })}
      <span className="toolSep" aria-hidden="true" />
      <span className="toolHint">Structured blocks keep their IDs — RQ-003 stays RQ-003</span>
    </div>
  );
}

/**
 * Editor state board. `.editorContent > .ProseMirror` content below is what TipTap already emits.
 * Rows:
 *  1. editable section — default
 *  2. editable section — hover (simulated with inline wash)
 *  3. editable section — focus (`.has-focus`, requires DDR-09 Focus extension)
 *  4. structured items — ID from data-qori-item via ::before, not in text
 *  5. read-only section (contenteditable=false; provenance system/inherited)
 *  6. system block island
 * Document-level dirty state is shown in ArtifactHeader save state, not here (SPEC §8.1).
 */
export function EditorStatesReference() {
  return (
    <div className="docCol">
      <p className="editorContext">{/* DDR-15 copy */}Read-only sections — masthead, quick facts, inherited and system sections, timeline and approval — aren't shown while editing.</p>
      <EditToolbarReference active={['bold']} disabled={[]} />
      <div className="editorContent">
        <div className="ProseMirror" role="textbox" aria-multiline="true" aria-label="Document editor" contentEditable suppressContentEditableWarning>
          {/* 1 default */}
          <section data-qori-section="plan_summary" data-provenance="generated">
            <h2>Summary</h2>
            <p>Residents who apply for building permits can't tell where their application stands.</p>
          </section>
          {/* 2 hover (production: :hover) */}
          <section data-qori-section="plan_background" data-provenance="generated" style={{ background: 'var(--color-brand-wash)' }}>
            <h2>Background</h2>
            <p>The permit desk receives the most calls in the week after submission.</p>
          </section>
          {/* 3 focus — .has-focus added by @tiptap/extensions Focus (decoration only) */}
          <section data-qori-section="plan_method_approach" data-provenance="generated" className="has-focus">
            <h2>Method</h2>
            <p><strong>Approach</strong> — user interviews</p>
            <h3>Session format</h3>
            <p>Remote, 45 minutes, screen share of the current status page.</p>
          </section>
          {/* 4 structured items — ID is an attribute, rendered by CSS only */}
          <section data-qori-section="objectives" data-provenance="canonical">
            <h2>What we'll learn</h2>
            <div data-qori-item="OBJ-001" data-kind="objective" className="qori-structured-item">Identify which status signals residents rely on to decide whether to call</div>
            <div data-qori-item="RQ-001" data-kind="question" className="qori-structured-item">What do residents believe each current status label means?</div>
          </section>
          {/* 5 read-only section — QoriSection sets contenteditable="false" for system/inherited */}
          <section data-qori-section="questions" data-provenance="inherited" contentEditable={false}>
            <h2>Research questions</h2>
            <p>Inherited from the approved brief.</p>
          </section>
          {/* 6 system block island */}
          <div data-qori-system="facts" contentEditable={false} className="qori-system-block">
            <p style={{ margin: 0 }}>Method · user interviews — Participants · 8 residents — Timeline · 6 weeks</p>
          </div>
        </div>
      </div>
    </div>
  );
}
