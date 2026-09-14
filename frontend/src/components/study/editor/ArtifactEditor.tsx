/**
 * ArtifactEditor — TipTap editor wrapper for Brief/Plan document editing.
 *
 * TipTap state is presentation/editing only — NOT canonical.
 * The serializer converts edits to Qori-owned payloads on save.
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Superscript } from '@tiptap/extension-superscript';
import { Placeholder } from '@tiptap/extension-placeholder';
import { QoriSection } from './extensions/QoriSection';
import { QoriStructuredItem } from './extensions/QoriStructuredItem';
import { QoriSystemBlock } from './extensions/QoriSystemBlock';
import { EditToolbar } from './EditToolbar';
import styles from './editor.module.css';

interface ArtifactEditorProps {
  /** Initial HTML content to load into the editor */
  initialContent: string;
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
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Superscript,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      QoriSection,
      QoriStructuredItem,
      QoriSystemBlock,
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
    <div>
      <EditToolbar editor={editor} />
      <div className={styles.editorContent}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
