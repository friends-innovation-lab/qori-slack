/**
 * MarkdownDisplay tests — Verifies markdown rendering including GFM tables.
 *
 * GFM tables must render with Qori editorial table styling:
 * - .tableScroll wrapper for overflow containment
 * - .docTable class for styling
 * - .stackedTable class for responsive behavior
 * - data-label attributes for mobile stacking
 * - Proper thead/tbody structure
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownDisplay } from './MarkdownDisplay';

describe('MarkdownDisplay', () => {
  describe('basic markdown', () => {
    it('renders null for null/empty markdown', () => {
      const { container } = render(<MarkdownDisplay markdown={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders paragraphs', () => {
      render(<MarkdownDisplay markdown="Hello world" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders bold text', () => {
      render(<MarkdownDisplay markdown="**bold text**" />);
      expect(screen.getByText('bold text').tagName).toBe('STRONG');
    });

    it('renders italic text', () => {
      render(<MarkdownDisplay markdown="*italic text*" />);
      expect(screen.getByText('italic text').tagName).toBe('EM');
    });

    it('renders bullet lists', () => {
      render(<MarkdownDisplay markdown={`- item 1
- item 2`} />);
      expect(screen.getByText('item 1')).toBeInTheDocument();
      expect(screen.getByText('item 2')).toBeInTheDocument();
    });

    it('renders ordered lists', () => {
      render(<MarkdownDisplay markdown={`1. first
2. second`} />);
      expect(screen.getByText('first')).toBeInTheDocument();
      expect(screen.getByText('second')).toBeInTheDocument();
    });
  });

  describe('GFM tables', () => {
    const gfmTable = `| Segment | Count | Rationale |
|---|---|---|
| Veterans | 4 | Primary group |
| Caregivers | 4 | Secondary group |`;

    it('renders GFM table with tableScroll wrapper', () => {
      const { container } = render(<MarkdownDisplay markdown={gfmTable} />);
      const wrapper = container.querySelector('[class*="tableScroll"]');
      expect(wrapper).toBeInTheDocument();
    });

    it('renders GFM table with docTable class', () => {
      const { container } = render(<MarkdownDisplay markdown={gfmTable} />);
      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();
      expect(table?.className).toMatch(/docTable/);
    });

    it('renders GFM table with stackedTable class for responsive', () => {
      const { container } = render(<MarkdownDisplay markdown={gfmTable} />);
      const table = container.querySelector('table');
      expect(table?.className).toMatch(/stackedTable/);
    });

    it('renders proper thead structure', () => {
      const { container } = render(<MarkdownDisplay markdown={gfmTable} />);
      const thead = container.querySelector('thead');
      expect(thead).toBeInTheDocument();
      const headerCells = thead?.querySelectorAll('th');
      expect(headerCells?.length).toBe(3);
      expect(headerCells?.[0]?.textContent).toBe('Segment');
      expect(headerCells?.[1]?.textContent).toBe('Count');
      expect(headerCells?.[2]?.textContent).toBe('Rationale');
    });

    it('renders proper tbody structure', () => {
      const { container } = render(<MarkdownDisplay markdown={gfmTable} />);
      const tbody = container.querySelector('tbody');
      expect(tbody).toBeInTheDocument();
      const bodyRows = tbody?.querySelectorAll('tr');
      expect(bodyRows?.length).toBe(2);
    });

    it('renders body cells with data-label attributes', () => {
      const { container } = render(<MarkdownDisplay markdown={gfmTable} />);
      const tbody = container.querySelector('tbody');
      const cells = tbody?.querySelectorAll('td');

      // First row cells
      expect(cells?.[0]?.getAttribute('data-label')).toBe('Segment');
      expect(cells?.[1]?.getAttribute('data-label')).toBe('Count');
      expect(cells?.[2]?.getAttribute('data-label')).toBe('Rationale');

      // Second row cells
      expect(cells?.[3]?.getAttribute('data-label')).toBe('Segment');
      expect(cells?.[4]?.getAttribute('data-label')).toBe('Count');
      expect(cells?.[5]?.getAttribute('data-label')).toBe('Rationale');
    });

    it('renders cell content correctly', () => {
      render(<MarkdownDisplay markdown={gfmTable} />);
      expect(screen.getByText('Veterans')).toBeInTheDocument();
      expect(screen.getByText('Caregivers')).toBeInTheDocument();
      expect(screen.getByText('Primary group')).toBeInTheDocument();
      expect(screen.getByText('Secondary group')).toBeInTheDocument();
    });

    it('handles single-row table gracefully', () => {
      // Single row table with just headers - edge case
      const singleRowTable = `| Header1 | Header2 |
|---|---|`;
      const { container } = render(<MarkdownDisplay markdown={singleRowTable} />);
      // Should render something, even if not a full table
      // GFM requires at least header row + separator
      expect(container.textContent).toContain('Header1');
    });
  });

  describe('mixed content', () => {
    it('renders prose paragraph after table', () => {
      const markdown = `| Col1 | Col2 |
|---|---|
| A | B |

This is a paragraph after the table.`;

      render(<MarkdownDisplay markdown={markdown} />);
      expect(screen.getByText('This is a paragraph after the table.')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('renders prose paragraph before table', () => {
      const markdown = `This is a paragraph before the table.

| Col1 | Col2 |
|---|---|
| X | Y |`;

      render(<MarkdownDisplay markdown={markdown} />);
      expect(screen.getByText('This is a paragraph before the table.')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
    });
  });
});
