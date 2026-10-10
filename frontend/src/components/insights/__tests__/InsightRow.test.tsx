/**
 * InsightRow tests — list row display and interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightRow, getInsightGroup, groupInsights } from '../InsightRow';
import type { InsightSummary } from '@qori/api-contracts';

const mockInsight: InsightSummary = {
  id: 1,
  publicId: 'abc123',
  displayId: 'IN-0001',
  projectId: 1,
  wording: 'Test insight wording',
  status: 'proposed',
  latestRevisionNumber: 1,
  acceptedRevisionNumber: null,
  pendingRevisionNumber: null,
  origin: 'ai',
  needsReview: true,
  createdBy: 'user:test@example.com',
  createdAt: '2024-01-15T10:00:00Z',
  withdrawnAt: null,
  version: 1,
};

describe('InsightRow', () => {
  it('renders insight display ID', () => {
    render(<InsightRow insight={mockInsight} />);
    expect(screen.getByText('IN-0001')).toBeInTheDocument();
  });

  it('renders insight wording', () => {
    render(<InsightRow insight={mockInsight} />);
    expect(screen.getByText('Test insight wording')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<InsightRow insight={mockInsight} />);
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('renders origin tag', () => {
    render(<InsightRow insight={mockInsight} />);
    expect(screen.getByText('Proposed by Qori')).toBeInTheDocument();
  });

  it('renders source names when provided', () => {
    render(<InsightRow insight={mockInsight} sourceNames={['doc1.pdf', 'doc2.pdf']} />);
    expect(screen.getByText('doc1.pdf, doc2.pdf')).toBeInTheDocument();
  });

  it('applies selected styling', () => {
    const { container } = render(<InsightRow insight={mockInsight} selected />);
    expect(container.querySelector('[aria-selected="true"]')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    render(<InsightRow insight={mockInsight} onClick={onClick} />);
    await userEvent.click(screen.getByRole('row'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('handles Enter key press', () => {
    const onClick = vi.fn();
    render(<InsightRow insight={mockInsight} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('row'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('handles Space key press', () => {
    const onClick = vi.fn();
    render(<InsightRow insight={mockInsight} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('row'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders pending revision block for accepted_with_pending', () => {
    const acceptedInsight: InsightSummary = {
      ...mockInsight,
      status: 'accepted_with_pending',
      acceptedRevisionNumber: 1,
      pendingRevisionNumber: 2,
    };
    render(
      <InsightRow
        insight={acceptedInsight}
        pendingRevision={{
          revisionNumber: 2,
          wording: 'Updated wording',
          editedBy: 'Jane',
        }}
      />,
    );
    expect(screen.getByText(/Revision r2 pending/)).toBeInTheDocument();
    expect(screen.getByText(/Edited by Jane/)).toBeInTheDocument();
    expect(screen.getByText('Updated wording')).toBeInTheDocument();
  });

  it('uses muted wording for proposed insights', () => {
    const { container } = render(<InsightRow insight={mockInsight} />);
    // The proposed class should be applied to wording
    expect(container.querySelector('[class*="insightRowWordingProposed"]')).toBeInTheDocument();
  });
});

describe('getInsightGroup', () => {
  it('maps proposed to proposed', () => {
    expect(getInsightGroup('proposed')).toBe('proposed');
  });

  it('maps accepted to accepted', () => {
    expect(getInsightGroup('accepted')).toBe('accepted');
  });

  it('maps accepted_with_pending to accepted', () => {
    expect(getInsightGroup('accepted_with_pending')).toBe('accepted');
  });

  it('maps rejected to rejected', () => {
    expect(getInsightGroup('rejected')).toBe('rejected');
  });

  it('maps withdrawn to withdrawn', () => {
    expect(getInsightGroup('withdrawn')).toBe('withdrawn');
  });
});

describe('groupInsights', () => {
  it('groups insights by status', () => {
    const insights: InsightSummary[] = [
      { ...mockInsight, id: 1, status: 'proposed' },
      { ...mockInsight, id: 2, status: 'accepted' },
      { ...mockInsight, id: 3, status: 'accepted_with_pending' },
      { ...mockInsight, id: 4, status: 'rejected' },
      { ...mockInsight, id: 5, status: 'withdrawn' },
    ];

    const groups = groupInsights(insights);

    expect(groups.proposed).toHaveLength(1);
    expect(groups.accepted).toHaveLength(2); // accepted + accepted_with_pending
    expect(groups.rejected).toHaveLength(1);
    expect(groups.withdrawn).toHaveLength(1);
  });

  it('returns empty groups when no insights', () => {
    const groups = groupInsights([]);

    expect(groups.proposed).toHaveLength(0);
    expect(groups.accepted).toHaveLength(0);
    expect(groups.rejected).toHaveLength(0);
    expect(groups.withdrawn).toHaveLength(0);
  });
});
