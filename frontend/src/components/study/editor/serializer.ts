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

/**
 * Extract prose content from a qoriSection node.
 * Converts TipTap JSON to HTML string for backend storage.
 *
 * Skips heading nodes (section titles) and qoriStructuredItem nodes
 * (those are handled separately). Returns the remaining prose content.
 */
function extractProseFromSection(editor: Editor, sectionId: string): string | null {
  const doc = editor.getJSON() as any;
  if (!doc.content) return null;

  // Find the qoriSection node with matching sectionId
  const sectionNode = doc.content.find(
    (node: any) => node.type === 'qoriSection' && node.attrs?.sectionId === sectionId
  );

  if (!sectionNode || !sectionNode.content) return null;

  // Extract prose content (skip headings and structured items)
  const proseNodes = sectionNode.content.filter((child: any) => {
    // Skip headings (section titles)
    if (child.type === 'heading') return false;
    // Skip structured items (handled separately)
    if (child.type === 'qoriStructuredItem') return false;
    // Skip system blocks
    if (child.type === 'qoriSystemBlock') return false;
    return true;
  });

  if (proseNodes.length === 0) return null;

  // Convert prose nodes to HTML
  const html = proseNodes.map((node: any) => nodeToHtml(node)).join('');
  return html.trim() || null;
}

/**
 * Convert a TipTap JSON node to HTML string.
 * Handles common node types: paragraph, text, bold, italic, link, list.
 */
function nodeToHtml(node: any): string {
  if (!node) return '';

  switch (node.type) {
    case 'text': {
      let text = escapeHtml(node.text || '');
      // Apply marks (bold, italic, link, etc.)
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') {
            text = `<strong>${text}</strong>`;
          } else if (mark.type === 'italic') {
            text = `<em>${text}</em>`;
          } else if (mark.type === 'link' && mark.attrs?.href) {
            text = `<a href="${escapeHtml(mark.attrs.href)}">${text}</a>`;
          } else if (mark.type === 'superscript') {
            text = `<sup>${text}</sup>`;
          }
        }
      }
      return text;
    }

    case 'paragraph': {
      const content = node.content?.map((c: any) => nodeToHtml(c)).join('') || '';
      return `<p>${content}</p>`;
    }

    case 'bulletList': {
      const items = node.content?.map((item: any) => {
        const itemContent = item.content?.map((c: any) => nodeToHtml(c)).join('') || '';
        return `<li>${itemContent}</li>`;
      }).join('') || '';
      return `<ul>${items}</ul>`;
    }

    case 'orderedList': {
      const items = node.content?.map((item: any) => {
        const itemContent = item.content?.map((c: any) => nodeToHtml(c)).join('') || '';
        return `<li>${itemContent}</li>`;
      }).join('') || '';
      return `<ol>${items}</ol>`;
    }

    case 'listItem': {
      const content = node.content?.map((c: any) => nodeToHtml(c)).join('') || '';
      return content; // List items are wrapped by parent
    }

    case 'blockquote': {
      const content = node.content?.map((c: any) => nodeToHtml(c)).join('') || '';
      return `<blockquote>${content}</blockquote>`;
    }

    case 'hardBreak':
      return '<br>';

    default:
      // For unknown node types, try to extract content recursively
      if (node.content) {
        return node.content.map((c: any) => nodeToHtml(c)).join('');
      }
      return '';
  }
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
