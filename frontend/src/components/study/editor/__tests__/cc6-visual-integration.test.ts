/**
 * CC-6 Visual Integration Tests
 *
 * Tests per IMPLEMENTATION_PHASES.md:
 * - Structured item's ID isn't in editor.getText()
 * - System block has no opacity < 1 (via class assertion)
 */

import { describe, it, expect } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { QoriSection } from '../extensions/QoriSection';
import { QoriStructuredItem } from '../extensions/QoriStructuredItem';
import { QoriSystemBlock } from '../extensions/QoriSystemBlock';

/**
 * Create a TipTap editor with the extensions needed for visual integration tests.
 */
function createEditor(content: JSONContent): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Markdown.configure({ markedOptions: { gfm: true } }),
      QoriSection,
      QoriStructuredItem,
      QoriSystemBlock,
    ],
    content,
  });
}

describe('CC-6 Visual Integration', () => {
  describe('QoriStructuredItem', () => {
    it('stable ID is NOT in editor.getText()', () => {
      // Create a document with a structured item that has a stable ID
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'qoriStructuredItem',
            attrs: {
              stableId: 'RQ-003',
              kind: 'objective',
            },
            content: [{ type: 'text', text: 'Understand user workflow friction' }],
          },
        ],
      };

      const editor = createEditor(doc);

      // getText() should return ONLY the text content, not the ID
      const textContent = editor.getText();

      // The text content SHOULD be present
      expect(textContent).toContain('Understand user workflow friction');

      // The stable ID should NOT be in the text content
      // (it's rendered via CSS ::before { content: attr(data-qori-item) })
      expect(textContent).not.toContain('RQ-003');

      editor.destroy();
    });

    it('multiple structured items have no IDs in getText()', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'qoriStructuredItem',
            attrs: { stableId: 'OBJ-001', kind: 'objective' },
            content: [{ type: 'text', text: 'First objective' }],
          },
          {
            type: 'qoriStructuredItem',
            attrs: { stableId: 'OBJ-002', kind: 'objective' },
            content: [{ type: 'text', text: 'Second objective' }],
          },
          {
            type: 'qoriStructuredItem',
            attrs: { stableId: 'RQ-001', kind: 'question' },
            content: [{ type: 'text', text: 'Research question' }],
          },
        ],
      };

      const editor = createEditor(doc);
      const textContent = editor.getText();

      // Text content should be present
      expect(textContent).toContain('First objective');
      expect(textContent).toContain('Second objective');
      expect(textContent).toContain('Research question');

      // No IDs should be in text content
      expect(textContent).not.toContain('OBJ-001');
      expect(textContent).not.toContain('OBJ-002');
      expect(textContent).not.toContain('RQ-001');

      editor.destroy();
    });

    it('renders with data-qori-item attribute for CSS ID display', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'qoriStructuredItem',
            attrs: { stableId: 'RQ-003', kind: 'objective' },
            content: [{ type: 'text', text: 'Test content' }],
          },
        ],
      };

      const editor = createEditor(doc);
      const html = editor.getHTML();

      // The HTML should have the data attribute for CSS ::before content
      expect(html).toContain('data-qori-item="RQ-003"');
      expect(html).toContain('class="qori-structured-item"');

      editor.destroy();
    });
  });

  describe('QoriSystemBlock', () => {
    it('renders with qori-system-block class (CC-6 opacity fix PF-13)', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'qoriSystemBlock',
            attrs: {
              blockType: 'masthead',
              html: '<div>System content</div>',
            },
          },
        ],
      };

      const editor = createEditor(doc);
      const html = editor.getHTML();

      // The HTML should have the system block class
      // CSS for this class has explicit opacity: 1 (fixes PF-13)
      expect(html).toContain('class="qori-system-block"');
      expect(html).toContain('data-qori-system="masthead"');

      // Atom nodes are contenteditable=false
      expect(html).toContain('contenteditable="false"');

      editor.destroy();
    });

    it('system block content is not editable (atom node)', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'qoriSystemBlock',
            attrs: { blockType: 'facts', html: '<p>Facts content</p>' },
          },
        ],
      };

      const editor = createEditor(doc);
      const json = editor.getJSON();

      // Verify the system block is in the document
      const systemBlock = json.content?.find((n: any) => n.type === 'qoriSystemBlock');
      expect(systemBlock).toBeDefined();
      expect(systemBlock?.attrs?.blockType).toBe('facts');

      editor.destroy();
    });
  });

  describe('CSS class verification', () => {
    /**
     * This test documents the CSS contract for CC-6 visual integration.
     * The actual CSS values are in editor.module.css:
     * - .qori-system-block { opacity: 1; } (CC-6 PF-13 fix)
     * - .qori-structured-item::before { content: attr(data-qori-item); }
     *
     * We verify the classes are applied; CSS correctness is verified by inspection.
     */
    it('documents CSS class contract for opacity and ID rendering', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'qoriSystemBlock',
            attrs: { blockType: 'system', html: '' },
          },
          {
            type: 'qoriStructuredItem',
            attrs: { stableId: 'TEST-001', kind: 'objective' },
            content: [{ type: 'text', text: 'Test' }],
          },
        ],
      };

      const editor = createEditor(doc);
      const html = editor.getHTML();

      // System block class present (CSS sets opacity: 1)
      expect(html).toContain('qori-system-block');

      // Structured item class and data attribute present
      // (CSS renders ID via ::before { content: attr(data-qori-item) })
      expect(html).toContain('qori-structured-item');
      expect(html).toContain('data-qori-item="TEST-001"');

      editor.destroy();
    });
  });
});
