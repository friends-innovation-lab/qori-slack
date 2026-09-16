/**
 * TipTap Hydration Integration Tests
 *
 * These tests verify that buildBriefEditorContent() + production TipTap extensions
 * + production serializer work together correctly.
 *
 * CRITICAL: These tests use the ACTUAL extensions, not mocks.
 * They verify the real HTML → TipTap node → JSON → PATCH payload flow.
 */

import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { QoriSection } from '../extensions/QoriSection';
import { QoriStructuredItem } from '../extensions/QoriStructuredItem';
import { QoriSystemBlock } from '../extensions/QoriSystemBlock';
import { serializeBrief } from '../serializer';

/**
 * Create a real TipTap editor with production extensions.
 * This mirrors the exact configuration used in ArtifactEditor.tsx.
 */
function createProductionEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      QoriSection,
      QoriStructuredItem,
      QoriSystemBlock,
    ],
    content,
  });
}

/**
 * Build Brief editor content exactly as BriefDocument.tsx does.
 * This is a direct copy of the production function for test isolation.
 */
function buildBriefEditorContent(
  prose: Record<string, string | null>,
): string {
  const parts: string[] = [];

  if (prose.summary) {
    parts.push(`<section data-qori-section="summary" data-provenance="generated"><h2>Summary</h2>${prose.summary}</section>`);
  }

  if (prose.problem_narrative) {
    parts.push(`<section data-qori-section="problem_narrative" data-provenance="generated"><h2>Problem</h2>${prose.problem_narrative}</section>`);
  }

  if (prose.method_prose) {
    parts.push(`<section data-qori-section="method_prose" data-provenance="generated"><h2>Method</h2>${prose.method_prose}</section>`);
  }

  return parts.join('\n') || '<p>No content</p>';
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

  describe('End-to-end: buildBriefEditorContent → TipTap → serializeBrief', () => {
    it('produces non-empty sections.summary when Summary is present', () => {
      // Step 1: Build HTML using the production builder
      const html = buildBriefEditorContent({
        summary: '<p>This is the research summary.</p>',
      });

      // Step 2: Create editor with production extensions
      const editor = createProductionEditor(html);

      // Step 3: Verify the JSON structure has sectionId
      const json = editor.getJSON();
      const summarySection = json.content?.find(
        (n: any) => n.type === 'qoriSection' && n.attrs?.sectionId === 'summary'
      );
      expect(summarySection).toBeDefined();
      expect(summarySection?.attrs?.sectionId).toBe('summary');

      // Step 4: Serialize and verify PATCH payload
      const payload = serializeBrief(editor);

      // CRITICAL ASSERTION: sections must contain summary
      expect(payload.sections).toHaveProperty('summary');
      expect(payload.sections.summary).toContain('This is the research summary.');

      editor.destroy();
    });

    it('produces non-empty payload after user edit to Summary', () => {
      const html = buildBriefEditorContent({
        summary: '<p>Original summary content.</p>',
      });

      const editor = createProductionEditor(html);

      // Simulate user edit: select all and replace
      editor.commands.setContent(
        '<section data-qori-section="summary" data-provenance="generated"><h2>Summary</h2><p>Updated summary after user edit.</p></section>'
      );

      const payload = serializeBrief(editor);

      expect(payload.sections).toHaveProperty('summary');
      expect(payload.sections.summary).toContain('Updated summary after user edit.');

      editor.destroy();
    });

    it('serializes multiple editable sections', () => {
      const html = buildBriefEditorContent({
        summary: '<p>Summary text.</p>',
        problem_narrative: '<p>Problem description.</p>',
        method_prose: '<p>Method explanation.</p>',
      });

      const editor = createProductionEditor(html);
      const payload = serializeBrief(editor);

      expect(Object.keys(payload.sections).length).toBeGreaterThanOrEqual(3);
      expect(payload.sections.summary).toContain('Summary text.');
      expect(payload.sections.problem_narrative).toContain('Problem description.');
      expect(payload.sections.method_prose).toContain('Method explanation.');

      editor.destroy();
    });
  });

  describe('Diagnostic: current behavior (before fix)', () => {
    it('DIAGNOSTIC: shows what sectionId value TipTap actually parses', () => {
      const html = '<section data-qori-section="summary" data-provenance="generated"><p>Test</p></section>';
      const editor = createProductionEditor(html);
      const json = editor.getJSON();

      console.log('TipTap JSON structure:', JSON.stringify(json, null, 2));

      const sectionNode = json.content?.find((n: any) => n.type === 'qoriSection');
      console.log('Section node attrs:', sectionNode?.attrs);
      console.log('sectionId value:', sectionNode?.attrs?.sectionId);
      console.log('sectionId is null?', sectionNode?.attrs?.sectionId === null);

      // This test documents the current behavior
      // If sectionId is null, the parseHTML is not extracting attributes
      editor.destroy();
    });
  });
});
