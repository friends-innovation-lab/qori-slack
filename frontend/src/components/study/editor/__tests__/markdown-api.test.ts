/**
 * Verify @tiptap/markdown public API for per-section parsing/serialization.
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

function createEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: '',
  });
}

describe('MarkdownManager public API verification', () => {
  it('editor.markdown! exists', () => {
    const editor = createEditor();
    expect(editor.markdown!).toBeDefined();
    console.log('editor.markdown!:', editor.markdown!);
    console.log('editor.markdown! keys:', Object.keys(editor.markdown!));
    editor.destroy();
  });

  it('editor.markdown!.parse() converts markdown to JSON', () => {
    const editor = createEditor();

    const markdown = `This is **bold** and *italic*.

- Item 1
- Item 2`;

    const json = editor.markdown!.parse(markdown);
    console.log('Parsed JSON:', JSON.stringify(json, null, 2));

    expect(json).toBeDefined();
    expect(json.type).toBe('doc');
    expect(json.content).toBeDefined();

    editor.destroy();
  });

  it('editor.markdown!.serialize() converts JSON to markdown', () => {
    const editor = createEditor();

    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'world' },
          ],
        },
      ],
    };

    const markdown = editor.markdown!.serialize(json);
    console.log('Serialized markdown:', markdown);

    expect(markdown).toContain('Hello');
    expect(markdown).toContain('**world**');

    editor.destroy();
  });

  it('parse markdown table → JSON', () => {
    const editor = createEditor();

    const markdown = `| Segment | Count |
|---|---|
| Veterans | 8 |`;

    const json = editor.markdown!.parse(markdown);
    console.log('Table JSON:', JSON.stringify(json, null, 2));

    const table = json.content?.find((n: any) => n.type === 'table');
    expect(table).toBeDefined();

    editor.destroy();
  });

  it('serialize table JSON → markdown', () => {
    const editor = createEditor();

    // Parse a table, then serialize it back
    const input = `| A | B |
|---|---|
| 1 | 2 |`;

    const json = editor.markdown!.parse(input);
    const output = editor.markdown!.serialize(json);

    console.log('Table round-trip:', output);

    expect(output).toContain('|');
    expect(output).toContain('A');
    expect(output).toContain('B');

    editor.destroy();
  });

  it('can serialize partial content (not full doc)', () => {
    const editor = createEditor();

    // Test serializing just the content array (section children)
    const sectionContent = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Section content here.' }],
      },
    ];

    // Wrap in doc for serialization
    const docWrapper = {
      type: 'doc',
      content: sectionContent,
    };

    const markdown = editor.markdown!.serialize(docWrapper);
    console.log('Partial content serialized:', markdown);

    expect(markdown).toContain('Section content here.');

    editor.destroy();
  });
});
