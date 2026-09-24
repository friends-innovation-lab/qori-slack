/**
 * ArtifactEditor — TipTap editor wrapper for Brief/Plan document editing.
 *
 * TipTap state is presentation/editing only — NOT canonical.
 * Prose sections are stored as markdown; this editor provides rich editing.
 *
 * The Markdown extension enables bidirectional conversion:
 * - Hydration: markdown → TipTap nodes (via markdownBridge)
 * - Serialization: TipTap nodes → markdown (via serializeBrief)
 *
 * CC-6: Visual integration per WORKSPACE_V2_SPEC §8.
 * - Focus extension (DDR-09) adds .has-focus class to the focused section
 * - editorContext line explains what's hidden while editing
 */

import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { Superscript } from '@tiptap/extension-superscript';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Focus } from '@tiptap/extension-focus';
import { QoriSection } from './extensions/QoriSection';
import { QoriStructuredItem } from './extensions/QoriStructuredItem';
import { QoriSystemBlock } from './extensions/QoriSystemBlock';
import { EditToolbar } from './EditToolbar';
import styles from './editor.module.css';

interface ArtifactEditorProps {
  /** Initial content - can be JSON (preferred) or HTML string (legacy) */
  initialContent: JSONContent | string;
  /** Called when content changes (dirty state tracking) */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Reference to get the editor instance for serialization */
  editorRef?: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
}

export function ArtifactEditor({ initialContent, onDirtyChange, editorRef }: ArtifactEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      // Markdown extension for bidirectional markdown ↔ TipTap conversion
      Markdown.configure({
        markedOptions: { gfm: true }, // Enable tables, task lists
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      // Task lists for approval checklists (GFM syntax: - [ ] / - [x])
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Superscript,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      QoriSection,
      QoriStructuredItem,
      QoriSystemBlock,
      // CC-6 (DDR-09): Focus extension for per-section focus indication
      Focus.configure({
        className: 'has-focus',
        mode: 'shallowest', // Only highlight the innermost focused node
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor: e }) => {
      onDirtyChange?.(true);
      // Keep editor ref current
      if (editorRef) editorRef.current = e as any;
    },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Document editor',
      },
    },
  });

  // Set ref on mount
  if (editorRef && editor) {
    editorRef.current = editor as any;
  }

  return (
    <div className={styles.editorWrapper}>
      {/* CC-6 (DDR-15): Context line explaining what's hidden while editing */}
      <p className={styles.editorContext}>
        Read-only sections — masthead, quick facts, inherited and system sections, timeline and approval — aren't shown while editing.
      </p>
      <EditToolbar editor={editor} />
      <div className={styles.editorContent}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
