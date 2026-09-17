/**
 * Serializer — Converts TipTap editor state to Qori-owned PATCH payloads.
 *
 * Architecture invariant: artifact_sections.content_type='prose' stores
 * CANONICAL MARKDOWN, not HTML. TipTap is an editing interface only.
 *
 * This serializer:
 * - Extracts prose per qoriSection and serializes to MARKDOWN
 * - Extracts typed structured arrays (OBJ/RQ/TB) with stable IDs
 *
 * Uses @tiptap/markdown's MarkdownManager for serialization.
 */

import type { Editor, JSONContent } from '@tiptap/react';

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
 *
 * Walks the ProseMirror doc, extracts:
 * - Prose per section as MARKDOWN (not HTML)
 * - Structured items with stable IDs
 */
export function serializeBrief(editor: Editor): SerializedBrief {
  const doc = editor.getJSON();
  const sections: Record<string, string> = {};
  const objectives: Objective[] = [];
  const questions: Question[] = [];
  const barriers: Barrier[] = [];

  if (doc.content) {
    for (const node of doc.content) {
      if (node.type === 'qoriSection') {
        const sectionId = node.attrs?.sectionId as string | undefined;
        const provenance = node.attrs?.provenance as string | undefined;

        // Skip system/inherited sections (not editable)
        if (provenance === 'system' || provenance === 'inherited') continue;

        // Extract structured items from this section
        if (node.content) {
          for (const child of node.content) {
            if (child.type === 'qoriStructuredItem' && 'attrs' in child) {
              const attrs = child.attrs as Record<string, unknown>;
              const kind = attrs?.kind as string | undefined;
              const stableId = attrs?.stableId as string | undefined;
              const text = extractTextContent(child);

              if (kind === 'objective' && stableId) {
                objectives.push({ id: stableId, objective: text });
              } else if (kind === 'question' && stableId) {
                questions.push({
                  id: stableId,
                  question: text,
                  priority: (attrs?.priority as string) || 'Primary',
                });
              } else if (kind === 'barrier' && stableId) {
                barriers.push({
                  id: stableId,
                  barrier: text,
                  source: (attrs?.source as string) || '',
                });
              }
            }
          }
        }

        // Extract prose content as MARKDOWN (skip canonical sections)
        if (sectionId && provenance !== 'canonical') {
          const markdown = extractProseAsMarkdown(editor, node);
          if (markdown) {
            sections[sectionId] = markdown;
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
  const doc = editor.getJSON();
  const sections: Record<string, string> = {};

  if (doc.content) {
    for (const node of doc.content) {
      if (node.type === 'qoriSection') {
        const sectionId = node.attrs?.sectionId as string | undefined;
        const provenance = node.attrs?.provenance as string | undefined;

        if (provenance === 'system' || provenance === 'inherited') continue;

        if (sectionId) {
          const markdown = extractProseAsMarkdown(editor, node);
          if (markdown) {
            sections[sectionId] = markdown;
          }
        }
      }
    }
  }

  return { sections, structured: {} };
}

/**
 * Extract text content from a node (for structured items).
 */
function extractTextContent(node: JSONContent): string {
  if (!node.content) return '';
  return node.content
    .map((child) => {
      if (child.type === 'text') return child.text || '';
      if (child.content) return extractTextContent(child);
      return '';
    })
    .join('');
}

/**
 * Extract prose content from a qoriSection node and serialize to MARKDOWN.
 *
 * Skips:
 * - heading nodes (section titles)
 * - qoriStructuredItem nodes (handled separately)
 * - qoriSystemBlock nodes
 *
 * Uses editor.markdown.serialize() for proper markdown output.
 */
function extractProseAsMarkdown(editor: Editor, sectionNode: JSONContent): string | null {
  if (!sectionNode.content) return null;

  // Filter to prose content only
  const proseNodes = sectionNode.content.filter((child) => {
    if (child.type === 'heading') return false;
    if (child.type === 'qoriStructuredItem') return false;
    if (child.type === 'qoriSystemBlock') return false;
    return true;
  });

  if (proseNodes.length === 0) return null;

  // Wrap in doc for serialization
  const docWrapper: JSONContent = {
    type: 'doc',
    content: proseNodes,
  };

  // Serialize to markdown using MarkdownManager
  // editor.markdown is guaranteed when Markdown extension is loaded
  const markdown = editor.markdown!.serialize(docWrapper);
  return markdown.trim() || null;
}
