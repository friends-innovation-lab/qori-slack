/**
 * EditToolbar — Sticky formatting toolbar (edit mode only).
 * Bold, Italic, H2, H3, Bullet list, Numbered list + hint.
 *
 * CC-6: Visual integration per WORKSPACE_V2_SPEC §8.6.
 * - Roving tabindex: one tab stop, arrow keys move focus
 * - aria-pressed for toggle states
 * - aria-label for accessible names
 * - disabled via editor.can()
 */

import { useRef, useState, useCallback, type KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/react';
import styles from './editor.module.css';

interface Tool {
  id: string;
  glyph: string;
  label: string;
  isActive: (editor: Editor) => boolean;
  canExecute: (editor: Editor) => boolean;
  execute: (editor: Editor) => void;
}

const TOOLS: (Tool | 'sep')[] = [
  {
    id: 'bold',
    glyph: 'B',
    label: 'Bold',
    isActive: (e) => e.isActive('bold'),
    canExecute: (e) => e.can().chain().focus().toggleBold().run(),
    execute: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic',
    glyph: 'I',
    label: 'Italic',
    isActive: (e) => e.isActive('italic'),
    canExecute: (e) => e.can().chain().focus().toggleItalic().run(),
    execute: (e) => e.chain().focus().toggleItalic().run(),
  },
  'sep',
  {
    id: 'h2',
    glyph: 'H2',
    label: 'Heading 2',
    isActive: (e) => e.isActive('heading', { level: 2 }),
    canExecute: (e) => e.can().chain().focus().toggleHeading({ level: 2 }).run(),
    execute: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    glyph: 'H3',
    label: 'Heading 3',
    isActive: (e) => e.isActive('heading', { level: 3 }),
    canExecute: (e) => e.can().chain().focus().toggleHeading({ level: 3 }).run(),
    execute: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  'sep',
  {
    id: 'bullet',
    glyph: '•',
    label: 'Bullet list',
    isActive: (e) => e.isActive('bulletList'),
    canExecute: (e) => e.can().chain().focus().toggleBulletList().run(),
    execute: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered',
    glyph: '1.',
    label: 'Numbered list',
    isActive: (e) => e.isActive('orderedList'),
    canExecute: (e) => e.can().chain().focus().toggleOrderedList().run(),
    execute: (e) => e.chain().focus().toggleOrderedList().run(),
  },
];

interface EditToolbarProps {
  editor: Editor | null;
}

export function EditToolbar({ editor }: EditToolbarProps) {
  const buttons = TOOLS.filter((t): t is Tool => t !== 'sep');
  const [focusIndex, setFocusIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent, currentIndex: number) => {
      const buttonCount = buttons.length;
      let nextIndex = -1;

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % buttonCount;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + buttonCount) % buttonCount;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = buttonCount - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      setFocusIndex(nextIndex);
      buttonRefs.current[nextIndex]?.focus();
    },
    [buttons.length],
  );

  if (!editor) return null;

  let buttonIndex = -1;

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      {TOOLS.map((tool, i) => {
        if (tool === 'sep') {
          return <span key={`sep-${i}`} className={styles.toolSep} aria-hidden="true" />;
        }

        buttonIndex += 1;
        const idx = buttonIndex;
        const isActive = tool.isActive(editor);
        const canExecute = tool.canExecute(editor);

        return (
          <button
            key={tool.id}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            className={`${styles.tool} ${isActive ? styles.toolActive : ''}`}
            aria-label={tool.label}
            aria-pressed={isActive}
            disabled={!canExecute}
            tabIndex={idx === focusIndex ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onFocus={() => setFocusIndex(idx)}
            onClick={() => tool.execute(editor)}
            style={
              tool.id === 'italic'
                ? { fontStyle: 'italic' }
                : tool.id === 'bold'
                  ? { fontWeight: 700 }
                  : undefined
            }
          >
            {tool.glyph}
          </button>
        );
      })}
      <span className={styles.toolSep} aria-hidden="true" />
      <span className={styles.toolHint}>
        Structured blocks keep their IDs — RQ-003 stays RQ-003
      </span>
    </div>
  );
}
