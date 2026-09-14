/**
 * EditToolbar — Sticky formatting toolbar (edit mode only).
 * Bold, Italic, H2, H3, Paragraph, Lists, Quote, Table, Link.
 */

import type { Editor } from '@tiptap/react';
import styles from './editor.module.css';

interface EditToolbarProps {
  editor: Editor | null;
}

export function EditToolbar({ editor }: EditToolbarProps) {
  if (!editor) return null;

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      <button
        className={`${styles.tool} ${editor.isActive('bold') ? styles.toolActive : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
        type="button"
      >
        <strong>B</strong>
      </button>
      <button
        className={`${styles.tool} ${editor.isActive('italic') ? styles.toolActive : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
        type="button"
      >
        <em>I</em>
      </button>
      <span className={styles.toolSep} />
      <button
        className={`${styles.tool} ${editor.isActive('heading', { level: 2 }) ? styles.toolActive : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
        type="button"
      >
        H2
      </button>
      <button
        className={`${styles.tool} ${editor.isActive('heading', { level: 3 }) ? styles.toolActive : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
        type="button"
      >
        H3
      </button>
      <span className={styles.toolSep} />
      <button
        className={`${styles.tool} ${editor.isActive('bulletList') ? styles.toolActive : ''}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
        type="button"
      >
        &bull;
      </button>
      <button
        className={`${styles.tool} ${editor.isActive('orderedList') ? styles.toolActive : ''}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
        type="button"
      >
        1.
      </button>
      <span className={styles.toolSep} />
      <span className={styles.toolHint}>
        Structured blocks keep their IDs &mdash; RQ-003 stays RQ-003
      </span>
    </div>
  );
}
