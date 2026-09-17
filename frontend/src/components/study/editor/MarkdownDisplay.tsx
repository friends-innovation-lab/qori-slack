/**
 * MarkdownDisplay — Safe static rendering of markdown content.
 *
 * Uses @tiptap/markdown to parse markdown to TipTap JSON, then renders
 * using React components. No dangerouslySetInnerHTML.
 *
 * Used for:
 * - View mode prose sections
 * - System content (approval_items)
 * - Any read-only markdown display
 */

import { useMemo, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
import { parseMarkdownForDisplay } from './markdownBridge';

interface MarkdownDisplayProps {
  /** Markdown content to render */
  markdown: string | null;
  /** Additional CSS class */
  className?: string;
}

/**
 * Render a TipTap JSON node to React elements.
 */
function renderNode(node: JSONContent, key: string | number): ReactNode {
  if (!node.type) return null;

  // Handle text nodes with marks
  if (node.type === 'text') {
    let content: ReactNode = node.text || '';
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') {
          content = <strong key={`${key}-bold`}>{content}</strong>;
        } else if (mark.type === 'italic') {
          content = <em key={`${key}-italic`}>{content}</em>;
        } else if (mark.type === 'strike') {
          content = <del key={`${key}-strike`}>{content}</del>;
        } else if (mark.type === 'code') {
          content = <code key={`${key}-code`}>{content}</code>;
        } else if (mark.type === 'link' && mark.attrs?.href) {
          content = (
            <a
              key={`${key}-link`}
              href={mark.attrs.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {content}
            </a>
          );
        } else if (mark.type === 'superscript') {
          content = <sup key={`${key}-sup`}>{content}</sup>;
        } else if (mark.type === 'underline') {
          content = <u key={`${key}-u`}>{content}</u>;
        }
      }
    }
    return content;
  }

  // Render children
  const children = node.content?.map((child, i) => renderNode(child, `${key}-${i}`));

  // Handle different node types
  switch (node.type) {
    case 'doc':
      return <>{children}</>;
    case 'paragraph':
      return <p key={key}>{children}</p>;
    case 'heading': {
      const level = node.attrs?.level || 2;
      if (level === 2) return <h2 key={key}>{children}</h2>;
      if (level === 3) return <h3 key={key}>{children}</h3>;
      return <h2 key={key}>{children}</h2>;
    }
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return <ol key={key}>{children}</ol>;
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'taskList':
      return <ul key={key} className="task-list">{children}</ul>;
    case 'taskItem': {
      const checked = node.attrs?.checked;
      return (
        <li key={key} className="task-item">
          <input type="checkbox" disabled checked={checked} />
          {children}
        </li>
      );
    }
    case 'table':
      return <table key={key}><tbody>{children}</tbody></table>;
    case 'tableRow':
      return <tr key={key}>{children}</tr>;
    case 'tableCell':
      return <td key={key}>{children}</td>;
    case 'tableHeader':
      return <th key={key}>{children}</th>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'codeBlock':
      return <pre key={key}><code>{node.content?.map(c => c.text).join('')}</code></pre>;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'hardBreak':
      return <br key={key} />;
    default:
      // For unknown nodes, just render children
      return <>{children}</>;
  }
}

/**
 * Render markdown content as React elements.
 *
 * Uses @tiptap/markdown to parse markdown to TipTap JSON,
 * then renders using safe React components.
 */
export function MarkdownDisplay({ markdown, className }: MarkdownDisplayProps) {
  const content = useMemo(() => {
    if (!markdown) return null;

    try {
      // Parse markdown to TipTap JSON
      const json = parseMarkdownForDisplay(markdown);

      // Render to React elements
      return renderNode(json, 'root');
    } catch (error) {
      console.error('[MarkdownDisplay] Failed to render markdown:', error);
      return <p>{markdown}</p>;
    }
  }, [markdown]);

  if (!markdown) return null;

  return <div className={className}>{content}</div>;
}
