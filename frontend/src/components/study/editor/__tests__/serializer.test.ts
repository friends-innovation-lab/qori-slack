/**
 * Serializer tests — verify TipTap state serialization to PATCH payloads.
 *
 * Regression coverage for TipTap prose persistence fix:
 * 1. User edits Summary
 * 2. serializeBrief() produces a non-empty sections payload
 * 3. PATCH sends the Summary change
 * 4. backend persists artifact_sections.summary
 * 5. content_version increments
 * 6. GET /brief returns the edited Summary
 * 7. refresh-equivalent hydration preserves the edit
 */

import { describe, it, expect } from 'vitest';
import type { Editor } from '@tiptap/react';
import { serializeBrief } from '../serializer';

// Mock editor with getJSON method
function createMockEditor(json: any): Editor {
  return {
    getJSON: () => json,
  } as unknown as Editor;
}

describe('serializeBrief', () => {
  it('extracts prose content from qoriSection nodes', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'summary', provenance: 'generated' },
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'This is the summary content.' }] },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.sections).toHaveProperty('summary');
    expect(result.sections.summary).toContain('This is the summary content.');
  });

  it('extracts multiple prose sections', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'summary', provenance: 'generated' },
          content: [
            { type: 'heading', attrs: { level: 2 } },
            { type: 'paragraph', content: [{ type: 'text', text: 'Summary content.' }] },
          ],
        },
        {
          type: 'qoriSection',
          attrs: { sectionId: 'method_prose', provenance: 'generated' },
          content: [
            { type: 'heading', attrs: { level: 2 } },
            { type: 'paragraph', content: [{ type: 'text', text: 'Method content.' }] },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.sections).toHaveProperty('summary');
    expect(result.sections).toHaveProperty('method_prose');
  });

  it('skips system and inherited sections', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'timeline', provenance: 'system' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'System content.' }] },
          ],
        },
        {
          type: 'qoriSection',
          attrs: { sectionId: 'objectives', provenance: 'inherited' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Inherited content.' }] },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.sections).not.toHaveProperty('timeline');
    expect(result.sections).not.toHaveProperty('objectives');
  });

  it('preserves text formatting (bold, italic)', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'summary', provenance: 'generated' },
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'This is ', marks: [] },
                { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' and ', marks: [] },
                { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
                { type: 'text', text: '.', marks: [] },
              ],
            },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.sections.summary).toContain('<strong>bold</strong>');
    expect(result.sections.summary).toContain('<em>italic</em>');
  });

  it('handles lists correctly', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'summary', provenance: 'generated' },
          content: [
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.sections.summary).toContain('<ul>');
    expect(result.sections.summary).toContain('<li>');
    expect(result.sections.summary).toContain('Item 1');
    expect(result.sections.summary).toContain('Item 2');
  });

  it('returns empty sections object when no editable sections', () => {
    const editor = createMockEditor({
      content: [],
    });

    const result = serializeBrief(editor);

    expect(result.sections).toEqual({});
    expect(result.structured).toEqual({});
  });

  it('escapes HTML special characters in text', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'summary', provenance: 'generated' },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'The formula is x < y && y > z' }],
            },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.sections.summary).toContain('&lt;');
    expect(result.sections.summary).toContain('&gt;');
    expect(result.sections.summary).toContain('&amp;&amp;');
  });

  it('extracts structured items from sections', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'objectives', provenance: 'generated' },
          content: [
            {
              type: 'qoriStructuredItem',
              attrs: { kind: 'objective', stableId: 'OBJ-001' },
              content: [{ type: 'text', text: 'First objective' }],
            },
            {
              type: 'qoriStructuredItem',
              attrs: { kind: 'objective', stableId: 'OBJ-002' },
              content: [{ type: 'text', text: 'Second objective' }],
            },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.structured.research_objectives).toHaveLength(2);
    expect(result.structured.research_objectives![0]).toEqual({
      id: 'OBJ-001',
      objective: 'First objective',
    });
  });

  it('extracts research questions with priority', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'questions', provenance: 'generated' },
          content: [
            {
              type: 'qoriStructuredItem',
              attrs: { kind: 'question', stableId: 'RQ-001', priority: 'Primary' },
              content: [{ type: 'text', text: 'What is the main question?' }],
            },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.structured.research_questions).toHaveLength(1);
    expect(result.structured.research_questions![0]).toEqual({
      id: 'RQ-001',
      question: 'What is the main question?',
      priority: 'Primary',
    });
  });

  it('extracts barriers with source', () => {
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'barriers', provenance: 'generated' },
          content: [
            {
              type: 'qoriStructuredItem',
              attrs: { kind: 'barrier', stableId: 'TB-001', source: 'User research' },
              content: [{ type: 'text', text: 'Confusing navigation' }],
            },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    expect(result.structured.target_barriers).toHaveLength(1);
    expect(result.structured.target_barriers![0]).toEqual({
      id: 'TB-001',
      barrier: 'Confusing navigation',
      source: 'User research',
    });
  });
});

describe('serializeBrief regression: Summary edit produces non-empty payload', () => {
  it('produces non-empty sections.summary when Summary section is edited', () => {
    // Simulates the exact scenario from the bug:
    // User edits Summary → serializeBrief() → PATCH payload should have summary
    const editor = createMockEditor({
      content: [
        {
          type: 'qoriSection',
          attrs: { sectionId: 'summary', provenance: 'generated' },
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Updated summary content after user edit.' }] },
          ],
        },
      ],
    });

    const result = serializeBrief(editor);

    // Critical assertion: sections must be non-empty
    expect(Object.keys(result.sections).length).toBeGreaterThan(0);
    expect(result.sections.summary).toBeDefined();
    expect(result.sections.summary).toContain('Updated summary content after user edit.');
  });
});
