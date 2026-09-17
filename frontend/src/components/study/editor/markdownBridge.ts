/**
 * Markdown ↔ TipTap Bridge
 *
 * Provides per-section markdown parsing and serialization using
 * @tiptap/markdown's public MarkdownManager API.
 *
 * Architecture:
 * - Each prose section is stored as canonical markdown
 * - Parse: markdown → TipTap JSON nodes (wrapped in qoriSection)
 * - Serialize: qoriSection children → markdown
 *
 * This preserves Qori section identity while enabling rich TipTap editing.
 */

import { Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';

/**
 * Section provenance types from QoriSection extension.
 */
type SectionProvenance = 'canonical' | 'generated' | 'system' | 'inherited';

/**
 * Cached parsing editor instance.
 * Created lazily and reused for all markdown parsing operations.
 */
let parsingEditor: Editor | null = null;

/**
 * Get or create a parsing editor for markdown conversion.
 * This editor is used only for parse/serialize operations, not rendering.
 *
 * @throws Error if markdown extension is not available
 */
function getParsingEditor(): Editor {
  if (!parsingEditor) {
    parsingEditor = new Editor({
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] } }),
        Markdown.configure({ markedOptions: { gfm: true } }),
        Table.configure({ resizable: false }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: '',
    });
  }

  if (!parsingEditor.markdown) {
    throw new Error('Markdown extension not loaded on parsing editor');
  }

  return parsingEditor;
}

/**
 * Clean up the parsing editor when no longer needed.
 * Call this on app unmount if memory is a concern.
 */
export function destroyParsingEditor(): void {
  if (parsingEditor) {
    parsingEditor.destroy();
    parsingEditor = null;
  }
}

/**
 * Build a qoriSection node containing parsed markdown content.
 *
 * @param editor - TipTap editor instance (must have Markdown extension)
 * @param sectionId - Section key (e.g., 'summary', 'participants_prose')
 * @param markdown - Canonical markdown content
 * @param provenance - Section provenance type
 */
export function buildQoriSectionFromMarkdown(
  editor: Editor,
  sectionId: string,
  markdown: string,
  provenance: SectionProvenance = 'generated',
): JSONContent {
  // Parse markdown to TipTap JSON using MarkdownManager
  const parsed = editor.markdown!.parse(markdown);

  // Extract content nodes (the doc wrapper is not needed)
  const contentNodes = parsed.content || [];

  // Return qoriSection node wrapping the parsed content
  return {
    type: 'qoriSection',
    attrs: {
      sectionId,
      provenance,
      editable: provenance !== 'system' && provenance !== 'inherited',
    },
    content: contentNodes,
  };
}

/**
 * Serialize a qoriSection's content back to canonical markdown.
 *
 * @param editor - TipTap editor instance (must have Markdown extension)
 * @param sectionContent - Array of content nodes from a qoriSection
 */
export function serializeSectionToMarkdown(
  editor: Editor,
  sectionContent: JSONContent[],
): string {
  // Wrap content in doc for serialization
  const docWrapper: JSONContent = {
    type: 'doc',
    content: sectionContent,
  };

  // Serialize to markdown using MarkdownManager
  return editor.markdown!.serialize(docWrapper);
}

/**
 * Extract section content from editor JSON by sectionId.
 *
 * @param editorJson - Full editor document JSON
 * @param sectionId - Section key to find
 */
export function extractSectionContent(
  editorJson: JSONContent,
  sectionId: string,
): JSONContent[] | null {
  if (!editorJson.content) return null;

  const section = editorJson.content.find(
    (node) =>
      node.type === 'qoriSection' &&
      node.attrs?.sectionId === sectionId,
  );

  if (!section?.content) return null;

  // Filter out heading nodes (section titles are not part of prose content)
  return section.content.filter((node) => node.type !== 'heading');
}

/**
 * Build the full editor document from multiple prose sections.
 *
 * Uses an internal parsing editor for markdown conversion.
 * Each section's markdown is parsed and wrapped in a qoriSection node.
 *
 * @param sections - Array of sections with markdown content
 */
export function buildEditorDocument(
  sections: Array<{
    sectionId: string;
    markdown: string;
    provenance?: SectionProvenance;
    title?: string;
  }>,
): JSONContent {
  const editor = getParsingEditor();
  const content: JSONContent[] = [];

  for (const section of sections) {
    if (!section.markdown) continue;

    // Parse section markdown (editor.markdown is guaranteed by getParsingEditor)
    const parsed = editor.markdown!.parse(section.markdown);
    const sectionNodes = parsed.content || [];

    // Optionally prepend section heading
    const nodesWithHeading: JSONContent[] = [];
    if (section.title) {
      nodesWithHeading.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: section.title }],
      });
    }
    nodesWithHeading.push(...sectionNodes);

    // Create qoriSection wrapper
    content.push({
      type: 'qoriSection',
      attrs: {
        sectionId: section.sectionId,
        provenance: section.provenance || 'generated',
        editable: section.provenance !== 'system' && section.provenance !== 'inherited',
      },
      content: nodesWithHeading,
    });
  }

  return {
    type: 'doc',
    content,
  };
}

/**
 * Parse markdown to TipTap JSON for display purposes.
 * Used for system sections (like approval_items) that need rendering
 * but not editing.
 *
 * @param markdown - Markdown string to parse
 * @returns TipTap JSON content
 */
export function parseMarkdownForDisplay(markdown: string): JSONContent {
  const editor = getParsingEditor();
  return editor.markdown!.parse(markdown);
}

/**
 * Serialize all editable sections from editor to markdown payload.
 *
 * @param editor - TipTap editor instance
 * @returns Map of section_key → markdown content
 */
export function serializeAllSections(
  editor: Editor,
): Record<string, string> {
  const doc = editor.getJSON();
  const result: Record<string, string> = {};

  if (!doc.content) return result;

  for (const node of doc.content) {
    if (node.type !== 'qoriSection') continue;

    const sectionId = node.attrs?.sectionId;
    const provenance = node.attrs?.provenance;

    // Skip system/inherited sections (not editable)
    if (!sectionId || provenance === 'system' || provenance === 'inherited') {
      continue;
    }

    // Skip canonical sections (structured items, not prose)
    if (provenance === 'canonical') continue;

    // Extract prose content (skip headings)
    const proseContent = (node.content || []).filter(
      (child) => child.type !== 'heading',
    );

    if (proseContent.length === 0) continue;

    // Serialize to markdown
    const markdown = serializeSectionToMarkdown(editor, proseContent);
    if (markdown.trim()) {
      result[sectionId] = markdown.trim();
    }
  }

  return result;
}
