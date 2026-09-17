/**
 * TipTap Hydration Integration Tests
 *
 * Tests the Markdown ↔ TipTap ↔ Markdown round-trip flow:
 * 1. Parse markdown sections via buildEditorDocument
 * 2. Wrap in qoriSection nodes with sectionId
 * 3. Serialize back to markdown via serializeBrief
 *
 * CRITICAL: These tests use the ACTUAL extensions and the new markdown bridge.
 * They verify the canonical markdown persistence architecture.
 */

import { describe, it, expect } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { QoriSection } from '../extensions/QoriSection';
import { QoriStructuredItem } from '../extensions/QoriStructuredItem';
import { QoriSystemBlock } from '../extensions/QoriSystemBlock';
import { serializeBrief } from '../serializer';
import { buildEditorDocument } from '../markdownBridge';

/**
 * Create a real TipTap editor with production extensions.
 * This mirrors the exact configuration used in ArtifactEditor.tsx.
 */
function createProductionEditor(content: JSONContent | string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Markdown.configure({ markedOptions: { gfm: true } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      QoriSection,
      QoriStructuredItem,
      QoriSystemBlock,
    ],
    content,
  });
}

describe('TipTap Hydration Integration', () => {
  describe('QoriSection parseHTML attribute extraction', () => {
    it('parses data-qori-section attribute into sectionId', () => {
      const html = '<section data-qori-section="summary" data-provenance="generated"><p>Test content</p></section>';
      const editor = createProductionEditor(html);
      const json = editor.getJSON();

      // Find the qoriSection node
      const sectionNode = json.content?.find((n: any) => n.type === 'qoriSection');

      expect(sectionNode).toBeDefined();
      expect(sectionNode?.attrs?.sectionId).toBe('summary');
      expect(sectionNode?.attrs?.provenance).toBe('generated');

      editor.destroy();
    });

    it('parses multiple sections with different sectionIds', () => {
      const html = `
        <section data-qori-section="summary" data-provenance="generated"><p>Summary</p></section>
        <section data-qori-section="method_prose" data-provenance="generated"><p>Method</p></section>
      `;
      const editor = createProductionEditor(html);
      const json = editor.getJSON();

      const sections = json.content?.filter((n: any) => n.type === 'qoriSection') || [];

      expect(sections).toHaveLength(2);
      expect(sections[0]?.attrs?.sectionId).toBe('summary');
      expect(sections[1]?.attrs?.sectionId).toBe('method_prose');

      editor.destroy();
    });
  });

  describe('Markdown → TipTap → Markdown round-trip', () => {
    it('preserves section identity through round-trip', () => {
      // Build document from markdown sections
      const editorContent = buildEditorDocument([
        {
          sectionId: 'summary',
          markdown: 'This is the research summary.',
          provenance: 'generated',
          title: 'Summary',
        },
      ]);

      const editor = createProductionEditor(editorContent);

      // Verify section structure
      const json = editor.getJSON();
      const summarySection = json.content?.find(
        (n: any) => n.type === 'qoriSection' && n.attrs?.sectionId === 'summary'
      );
      expect(summarySection).toBeDefined();
      expect(summarySection?.attrs?.sectionId).toBe('summary');

      // Serialize back to markdown
      const payload = serializeBrief(editor);

      // CRITICAL: Output must be markdown, not HTML
      expect(payload.sections).toHaveProperty('summary');
      expect(payload.sections.summary).toContain('research summary');
      // Must NOT contain HTML tags
      expect(payload.sections.summary).not.toContain('<p>');
      expect(payload.sections.summary).not.toContain('</p>');

      editor.destroy();
    });

    it('preserves multiple sections through round-trip', () => {
      const editorContent = buildEditorDocument([
        {
          sectionId: 'summary',
          markdown: 'Summary text here.',
          provenance: 'generated',
          title: 'Summary',
        },
        {
          sectionId: 'problem_narrative',
          markdown: 'Problem description here.',
          provenance: 'generated',
          title: 'Problem',
        },
        {
          sectionId: 'method_prose',
          markdown: 'Method explanation here.',
          provenance: 'generated',
          title: 'Method',
        },
      ]);

      const editor = createProductionEditor(editorContent);
      const payload = serializeBrief(editor);

      // All sections should be present with markdown content
      expect(Object.keys(payload.sections).length).toBe(3);
      expect(payload.sections.summary).toContain('Summary text');
      expect(payload.sections.problem_narrative).toContain('Problem description');
      expect(payload.sections.method_prose).toContain('Method explanation');

      editor.destroy();
    });

    it('preserves table structure through round-trip', () => {
      const tableMarkdown = `| Segment | Count | Rationale |
|---|---|---|
| Veterans | 8 | Primary users |
| Caregivers | 4 | Secondary |`;

      const editorContent = buildEditorDocument([
        {
          sectionId: 'participants_prose',
          markdown: tableMarkdown,
          provenance: 'generated',
          title: 'Participants',
        },
      ]);

      const editor = createProductionEditor(editorContent);

      // Verify table was parsed
      const json = editor.getJSON();
      const section = json.content?.find(
        (n: any) => n.type === 'qoriSection' && n.attrs?.sectionId === 'participants_prose'
      );
      const hasTable = section?.content?.some((n: any) => n.type === 'table');
      expect(hasTable).toBe(true);

      // Serialize and verify markdown table syntax
      const payload = serializeBrief(editor);
      expect(payload.sections.participants_prose).toContain('|');
      expect(payload.sections.participants_prose).toContain('Segment');
      expect(payload.sections.participants_prose).toContain('Veterans');

      editor.destroy();
    });

    it('preserves bold/bullet list through round-trip', () => {
      const listMarkdown = `- **Backend performance** — Separate engineering workstream
- **Feature redesign** — This study informs, not performs`;

      const editorContent = buildEditorDocument([
        {
          sectionId: 'out_of_scope',
          markdown: listMarkdown,
          provenance: 'generated',
          title: 'Out of scope',
        },
      ]);

      const editor = createProductionEditor(editorContent);

      // Verify list was parsed
      const json = editor.getJSON();
      const section = json.content?.find(
        (n: any) => n.type === 'qoriSection' && n.attrs?.sectionId === 'out_of_scope'
      );
      const hasList = section?.content?.some((n: any) => n.type === 'bulletList');
      expect(hasList).toBe(true);

      // Serialize and verify markdown syntax
      const payload = serializeBrief(editor);
      expect(payload.sections.out_of_scope).toContain('-');
      expect(payload.sections.out_of_scope).toContain('**Backend performance**');

      editor.destroy();
    });
  });

  describe('Canonical invariants', () => {
    it('PATCH payload contains markdown, not HTML', () => {
      const editorContent = buildEditorDocument([
        {
          sectionId: 'summary',
          markdown: 'This has **bold** and *italic* text.',
          provenance: 'generated',
          title: 'Summary',
        },
      ]);

      const editor = createProductionEditor(editorContent);
      const payload = serializeBrief(editor);

      // Must be markdown
      expect(payload.sections.summary).toContain('**bold**');
      expect(payload.sections.summary).toContain('*italic*');

      // Must NOT be HTML
      expect(payload.sections.summary).not.toContain('<strong>');
      expect(payload.sections.summary).not.toContain('<em>');
      expect(payload.sections.summary).not.toContain('<p>');

      editor.destroy();
    });

    it('skips system and inherited sections', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'qoriSection',
            attrs: { sectionId: 'editable', provenance: 'generated' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Editable content' }] }],
          },
          {
            type: 'qoriSection',
            attrs: { sectionId: 'system_block', provenance: 'system' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'System content' }] }],
          },
          {
            type: 'qoriSection',
            attrs: { sectionId: 'inherited_block', provenance: 'inherited' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inherited content' }] }],
          },
        ],
      };

      const editor = createProductionEditor(doc);
      const payload = serializeBrief(editor);

      // Only editable section should be in payload
      expect(payload.sections).toHaveProperty('editable');
      expect(payload.sections).not.toHaveProperty('system_block');
      expect(payload.sections).not.toHaveProperty('inherited_block');

      editor.destroy();
    });
  });

  describe('Persistence regression', () => {
    it('Summary edit → serialize → markdown persisted', () => {
      // Start with initial content
      const editorContent = buildEditorDocument([
        {
          sectionId: 'summary',
          markdown: 'Original summary.',
          provenance: 'generated',
          title: 'Summary',
        },
      ]);

      const editor = createProductionEditor(editorContent);

      // Simulate user edit
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'qoriSection',
            attrs: { sectionId: 'summary', provenance: 'generated' },
            content: [
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Updated summary after edit.' }] },
            ],
          },
        ],
      });

      const payload = serializeBrief(editor);

      expect(payload.sections).toHaveProperty('summary');
      expect(payload.sections.summary).toContain('Updated summary after edit');

      editor.destroy();
    });
  });
});
