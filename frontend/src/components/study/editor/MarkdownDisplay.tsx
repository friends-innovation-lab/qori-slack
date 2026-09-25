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
 *
 * GFM tables receive Qori editorial table styling (docTable) with responsive
 * stacking behavior matching DocumentTable.
 */

import { useMemo, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
import { parseMarkdownForDisplay } from './markdownBridge';
import docStyles from '@/components/study/document/document.module.css';

interface MarkdownDisplayProps {
  /** Markdown content to render */
  markdown: string | null;
  /** Additional CSS class */
  className?: string;
}

/**
 * Extract text content from a TipTap node (for header labels).
 */
function extractTextContent(node: JSONContent): string {
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  return node.content.map(extractTextContent).join('');
}

/**
 * Check if a row contains only header cells.
 */
function isHeaderRow(row: JSONContent): boolean {
  if (row.type !== 'tableRow' || !row.content) return false;
  return row.content.every((cell) => cell.type === 'tableHeader');
}

/**
 * Extract header labels from the first row of a table (if it's a header row).
 */
function extractHeaderLabels(tableNode: JSONContent): string[] {
  if (!tableNode.content || tableNode.content.length === 0) return [];
  const firstRow = tableNode.content[0];
  if (!isHeaderRow(firstRow)) return [];
  return (firstRow.content || []).map(extractTextContent);
}

/**
 * Render a GFM table with Qori editorial styling.
 * Properly structures thead/tbody and adds data-label for responsive stacking.
 */
function renderTable(tableNode: JSONContent, key: string | number): ReactNode {
  if (!tableNode.content || tableNode.content.length === 0) return null;

  const headerLabels = extractHeaderLabels(tableNode);
  const hasHeaderRow = headerLabels.length > 0;
  const headerRow = hasHeaderRow ? tableNode.content[0] : null;
  const bodyRows = hasHeaderRow ? tableNode.content.slice(1) : tableNode.content;

  // Render header row
  const renderHeaderRow = () => {
    if (!headerRow?.content) return null;
    return (
      <tr key={`${key}-header`}>
        {headerRow.content.map((cell, cellIndex) => (
          <th key={`${key}-th-${cellIndex}`}>
            {cell.content?.map((child, i) => renderNode(child, `${key}-th-${cellIndex}-${i}`))}
          </th>
        ))}
      </tr>
    );
  };

  // Render body rows with data-label for responsive
  const renderBodyRows = () => {
    return bodyRows.map((row, rowIndex) => {
      if (row.type !== 'tableRow' || !row.content) return null;
      return (
        <tr key={`${key}-row-${rowIndex}`}>
          {row.content.map((cell, cellIndex) => {
            const label = headerLabels[cellIndex] || '';
            return (
              <td key={`${key}-td-${rowIndex}-${cellIndex}`} data-label={label}>
                {cell.content?.map((child, i) =>
                  renderNode(child, `${key}-td-${rowIndex}-${cellIndex}-${i}`)
                )}
              </td>
            );
          })}
        </tr>
      );
    });
  };

  const tableClass = `${docStyles.docTable} ${docStyles.stackedTable}`;

  return (
    <div key={key} className={docStyles.tableScroll}>
      <table className={tableClass}>
        {hasHeaderRow && <thead>{renderHeaderRow()}</thead>}
        <tbody>{renderBodyRows()}</tbody>
      </table>
    </div>
  );
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
      // Use specialized table renderer for proper styling and responsive behavior
      return renderTable(node, key);
    case 'tableRow':
      // Handled by renderTable, but keep fallback for direct calls
      return <tr key={key}>{children}</tr>;
    case 'tableCell':
      // Handled by renderTable, but keep fallback for direct calls
      return <td key={key}>{children}</td>;
    case 'tableHeader':
      // Handled by renderTable, but keep fallback for direct calls
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
