/**
 * Serializer — Converts TipTap editor state to Qori-owned PATCH payloads.
 *
 * TipTap JSON/HTML is NOT canonical. This serializer maps edits to:
 * - Markdown prose for artifact_sections
 * - Typed structured arrays for study_variables
 *
 * Stable IDs (OBJ-001, RQ-001, TB-001) are preserved from the
 * qoriStructuredItem nodes — never minted or renumbered client-side.
 */

import type { Editor } from '@tiptap/react';

interface Objective { id: string; objective: string }
interface Question { id: string; question: string; priority: string }
interface Barrier { id: string; barrier: string; source: string }
interface Risk { risk: string; source: string; mitigation: string }

interface SerializedBrief {
  sections: Record<string, string>;
  structured: {
    research_objectives?: Objective[];
    research_questions?: Question[];
    target_barriers?: Barrier[];
    risks?: Risk[];
  };
}

interface SerializedPlan {
  sections: Record<string, string>;
  structured: {
    risks?: Array<{ risk: string; likelihood: string; mitigation: string }>;
  };
}

/**
 * Serialize the TipTap editor state into a Brief PATCH payload.
 * Walks the ProseMirror doc, extracts prose per section and structured items.
 */
export function serializeBrief(editor: Editor): SerializedBrief {
  const doc = editor.getJSON() as any;
  const sections: Record<string, string> = {};
  const objectives: Objective[] = [];
  const questions: Question[] = [];
  const barriers: Barrier[] = [];

  if (doc.content) {
    for (const node of doc.content as any[]) {
      if (node.type === 'qoriSection') {
        const sectionId = node.attrs?.sectionId;
        const provenance = node.attrs?.provenance;

        // Skip system/inherited sections
        if (provenance === 'system' || provenance === 'inherited') continue;

        // Extract structured items from this section
        if (node.content) {
          for (const child of node.content) {
            if (child.type === 'qoriStructuredItem') {
              const kind = child.attrs?.kind;
              const stableId = child.attrs?.stableId;
              const text = extractTextContent(child);

              if (kind === 'objective' && stableId) {
                objectives.push({ id: stableId, objective: text });
              } else if (kind === 'question' && stableId) {
                questions.push({ id: stableId, question: text, priority: child.attrs?.priority || 'Primary' });
              } else if (kind === 'barrier' && stableId) {
                barriers.push({ id: stableId, barrier: text, source: child.attrs?.source || '' });
              }
            }
          }
        }

        // Extract prose content (non-structured-item children)
        if (sectionId && provenance !== 'canonical') {
          const proseHtml = extractProseFromSection(editor, sectionId);
          if (proseHtml) {
            sections[sectionId] = proseHtml;
          }
        }
      }
    }
  }

  return {
    sections,
    structured: {
      ...(objectives.length > 0 ? { research_objectives: objectives } : {}),
      ...(questions.length > 0 ? { research_questions: questions } : {}),
      ...(barriers.length > 0 ? { target_barriers: barriers } : {}),
    },
  };
}

/**
 * Serialize the TipTap editor state into a Plan PATCH payload.
 */
export function serializePlan(editor: Editor): SerializedPlan {
  const doc = editor.getJSON() as any;
  const sections: Record<string, string> = {};

  if (doc.content) {
    for (const node of doc.content as any[]) {
      if (node.type === 'qoriSection') {
        const sectionId = node.attrs?.sectionId;
        const provenance = node.attrs?.provenance;

        if (provenance === 'system' || provenance === 'inherited') continue;

        if (sectionId) {
          const proseHtml = extractProseFromSection(editor, sectionId);
          if (proseHtml) {
            sections[sectionId] = proseHtml;
          }
        }
      }
    }
  }

  return { sections, structured: {} };
}

function extractTextContent(node: any): string {
  if (!node.content) return '';
  return node.content
    .map((child: any) => {
      if (child.type === 'text') return child.text || '';
      if (child.content) return extractTextContent(child);
      return '';
    })
    .join('');
}

function extractProseFromSection(_editor: Editor, _sectionId: string): string | null {
  // For now, return null — prose extraction from TipTap nodes will be
  // implemented when the editor rendering is wired. The serializer
  // architecture is correct; the HTML-to-Markdown conversion happens here.
  return null;
}
