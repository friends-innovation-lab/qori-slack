/**
 * @tiptap/markdown Capability Test
 *
 * Tests what node types @tiptap/markdown 3.31.3 supports:
 * - paragraphs, headings, bold, italic
 * - bullet lists, ordered lists
 * - tables (GFM)
 * - task lists (GFM)
 * - links
 */

import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';

/**
 * Create editor with full Markdown + GFM support
 */
function createMarkdownEditor(markdown: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Markdown.configure({
        markedOptions: { gfm: true },
      }),
    ],
    content: markdown,
    contentType: 'markdown',
  });
}

describe('@tiptap/markdown 3.31.3 capability tests', () => {
  describe('Basic prose nodes', () => {
    it('parses paragraphs', () => {
      const editor = createMarkdownEditor('This is a paragraph.\n\nThis is another.');
      const json = editor.getJSON();

      const paragraphs = json.content?.filter((n: any) => n.type === 'paragraph') || [];
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);

      editor.destroy();
    });

    it('parses headings', () => {
      const editor = createMarkdownEditor('## Heading 2\n\n### Heading 3');
      const json = editor.getJSON();

      const headings = json.content?.filter((n: any) => n.type === 'heading') || [];
      expect(headings).toHaveLength(2);
      expect(headings[0]?.attrs?.level).toBe(2);
      expect(headings[1]?.attrs?.level).toBe(3);

      editor.destroy();
    });

    it('parses bold and italic', () => {
      const editor = createMarkdownEditor('This is **bold** and *italic* text.');
      const json = editor.getJSON();

      const paragraph = json.content?.find((n: any) => n.type === 'paragraph');
      const marks = paragraph?.content?.flatMap((t: any) => t.marks || []) || [];

      expect(marks.some((m: any) => m.type === 'bold')).toBe(true);
      expect(marks.some((m: any) => m.type === 'italic')).toBe(true);

      editor.destroy();
    });

    it('round-trips bold/italic to markdown', () => {
      const input = 'This is **bold** and *italic* text.';
      const editor = createMarkdownEditor(input);
      const output = editor.getMarkdown();

      expect(output).toContain('**bold**');
      expect(output).toContain('*italic*');

      editor.destroy();
    });
  });

  describe('List nodes', () => {
    it('parses bullet lists', () => {
      const editor = createMarkdownEditor('- Item 1\n- Item 2\n- Item 3');
      const json = editor.getJSON();

      const bulletList = json.content?.find((n: any) => n.type === 'bulletList');
      expect(bulletList).toBeDefined();
      expect(bulletList?.content?.length).toBe(3);

      editor.destroy();
    });

    it('parses ordered lists', () => {
      const editor = createMarkdownEditor('1. First\n2. Second\n3. Third');
      const json = editor.getJSON();

      const orderedList = json.content?.find((n: any) => n.type === 'orderedList');
      expect(orderedList).toBeDefined();
      expect(orderedList?.content?.length).toBe(3);

      editor.destroy();
    });

    it('round-trips bullet lists to markdown', () => {
      const input = '- Item 1\n- Item 2';
      const editor = createMarkdownEditor(input);
      const output = editor.getMarkdown();

      expect(output).toMatch(/[-*] Item 1/);
      expect(output).toMatch(/[-*] Item 2/);

      editor.destroy();
    });
  });

  describe('Table nodes (GFM)', () => {
    it('parses markdown tables', () => {
      const markdown = `| Segment | Count | Rationale |
|---|---|---|
| Veterans | 8 | Primary users |
| Caregivers | 4 | Secondary |`;

      const editor = createMarkdownEditor(markdown);
      const json = editor.getJSON();

      console.log('Table JSON:', JSON.stringify(json, null, 2));

      const table = json.content?.find((n: any) => n.type === 'table');
      expect(table).toBeDefined();

      // Should have header row + 2 data rows
      const rows = table?.content?.filter((n: any) => n.type === 'tableRow') || [];
      expect(rows.length).toBeGreaterThanOrEqual(2);

      editor.destroy();
    });

    it('round-trips tables to markdown', () => {
      const input = `| Segment | Count |
|---|---|
| Veterans | 8 |`;

      const editor = createMarkdownEditor(input);
      const output = editor.getMarkdown();

      console.log('Table round-trip output:', output);

      // Should contain table syntax
      expect(output).toContain('|');
      expect(output).toContain('Segment');
      expect(output).toContain('Veterans');

      editor.destroy();
    });
  });

  describe('Task lists (GFM)', () => {
    it('parses task list checkboxes', () => {
      const markdown = `- [ ] Unchecked item
- [x] Checked item`;

      const editor = createMarkdownEditor(markdown);
      const json = editor.getJSON();

      console.log('Task list JSON:', JSON.stringify(json, null, 2));

      const taskList = json.content?.find((n: any) => n.type === 'taskList');
      expect(taskList).toBeDefined();

      const items = taskList?.content?.filter((n: any) => n.type === 'taskItem') as any[] || [];
      expect(items).toHaveLength(2);

      // Check for checked/unchecked state
      expect(items[0]?.attrs?.checked).toBe(false);
      expect(items[1]?.attrs?.checked).toBe(true);

      editor.destroy();
    });

    it('round-trips task lists to markdown', () => {
      const input = `- [ ] Unchecked
- [x] Checked`;

      const editor = createMarkdownEditor(input);
      const output = editor.getMarkdown();

      console.log('Task list round-trip output:', output);

      expect(output).toContain('[ ]');
      expect(output).toContain('[x]');

      editor.destroy();
    });
  });

  describe('Links', () => {
    it('parses links', () => {
      const editor = createMarkdownEditor('Visit [example](https://example.com) for more.');
      const json = editor.getJSON();

      const paragraph = json.content?.find((n: any) => n.type === 'paragraph');
      const linkMark = paragraph?.content?.find((t: any) =>
        t.marks?.some((m: any) => m.type === 'link')
      );

      expect(linkMark).toBeDefined();

      editor.destroy();
    });

    it('round-trips links to markdown', () => {
      const input = 'Visit [example](https://example.com) for more.';
      const editor = createMarkdownEditor(input);
      const output = editor.getMarkdown();

      expect(output).toContain('[example](https://example.com)');

      editor.destroy();
    });
  });

  describe('Combined content round-trip', () => {
    it('handles complex brief content', () => {
      const input = `## Summary

This study investigates **permit status** tracking for Veterans.

## Participants

| Segment | Count | Rationale |
|---|---|---|
| Veterans (18-65) | 8 | Primary users |
| Caregivers | 4 | Secondary support |

## Out of scope

- **Backend performance** — Separate engineering workstream
- **Feature redesign** — This study informs, not performs`;

      const editor = createMarkdownEditor(input);
      const json = editor.getJSON();

      // Verify structure
      const headings = json.content?.filter((n: any) => n.type === 'heading') || [];
      const tables = json.content?.filter((n: any) => n.type === 'table') || [];
      const bulletLists = json.content?.filter((n: any) => n.type === 'bulletList') || [];

      expect(headings.length).toBeGreaterThanOrEqual(2);
      expect(tables).toHaveLength(1);
      expect(bulletLists).toHaveLength(1);

      // Round-trip
      const output = editor.getMarkdown();

      expect(output).toContain('## Summary');
      expect(output).toContain('**permit status**');
      // Table columns may have alignment padding but structure is preserved
      expect(output).toContain('Segment');
      expect(output).toContain('|');
      expect(output).toContain('- **Backend performance**');

      editor.destroy();
    });
  });
});
