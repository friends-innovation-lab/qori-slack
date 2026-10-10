/**
 * RevisionHistory tests — timeline display and decision lines.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevisionHistory, RevisionHistoryItem } from '../RevisionHistory';
import type { RevisionDetail, ReviewRecord } from '@qori/api-contracts';

const mockRevision: RevisionDetail = {
  id: 1,
  publicId: 'rev-001',
  revisionNumber: 1,
  content: { wording: 'Initial insight wording' },
  evidenceSnapshot: [],
  origin: 'ai',
  createdBy: 'system:qori',
  createdAt: '2024-01-15T10:00:00Z',
  isAccepted: false,
  isLatest: true,
};

const mockReview: ReviewRecord = {
  id: 1,
  action: 'accept',
  revisionId: 1,
  reviewedBy: 'user:jane@example.com',
  comment: null,
  createdAt: '2024-01-16T10:00:00Z',
};

describe('RevisionHistoryItem', () => {
  it('renders revision number', () => {
    render(<RevisionHistoryItem revision={mockRevision} />);
    expect(screen.getByText('r1')).toBeInTheDocument();
  });

  it('renders revision wording', () => {
    render(<RevisionHistoryItem revision={mockRevision} />);
    expect(screen.getByText('Initial insight wording')).toBeInTheDocument();
  });

  it('renders proposed status for non-accepted latest revision', () => {
    render(<RevisionHistoryItem revision={mockRevision} />);
    expect(screen.getByText('Proposed')).toBeInTheDocument();
  });

  it('renders accepted status with In use badge', () => {
    const accepted: RevisionDetail = { ...mockRevision, isAccepted: true };
    render(<RevisionHistoryItem revision={accepted} />);
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('In use')).toBeInTheDocument();
  });

  it('renders rejected status', () => {
    const rejected: RevisionDetail = { ...mockRevision, isLatest: false, isAccepted: false };
    const decisions: ReviewRecord[] = [
      { ...mockReview, action: 'reject' },
    ];
    render(<RevisionHistoryItem revision={rejected} decisions={decisions} />);
    // Both status badge and decision line show "Rejected"
    const rejectedElements = screen.getAllByText('Rejected');
    expect(rejectedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders superseded status', () => {
    const superseded: RevisionDetail = {
      ...mockRevision,
      isLatest: false,
      isAccepted: false,
    };
    render(<RevisionHistoryItem revision={superseded} />);
    expect(screen.getByText('Superseded')).toBeInTheDocument();
  });

  it('renders withdrawn status', () => {
    const withdrawn: RevisionDetail = { ...mockRevision };
    const decisions: ReviewRecord[] = [
      { ...mockReview, action: 'withdraw', revisionId: null },
    ];
    render(<RevisionHistoryItem revision={withdrawn} decisions={decisions} />);
    // Both status badge and decision line show "Withdrawn"
    const withdrawnElements = screen.getAllByText('Withdrawn');
    expect(withdrawnElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders decision lines', () => {
    const accepted: RevisionDetail = { ...mockRevision, isAccepted: true };
    const decisions: ReviewRecord[] = [
      { ...mockReview, action: 'accept', comment: 'Looks good!' },
    ];
    render(<RevisionHistoryItem revision={accepted} decisions={decisions} />);
    // Both status badge and decision line show "Accepted"
    const acceptedElements = screen.getAllByText('Accepted');
    expect(acceptedElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Jane/)).toBeInTheDocument();
    expect(screen.getByText(/Looks good!/)).toBeInTheDocument();
  });

  it('formats actor name from email', () => {
    const decisions: ReviewRecord[] = [
      { ...mockReview, reviewedBy: 'user:john.doe@example.com' },
    ];
    render(<RevisionHistoryItem revision={mockRevision} decisions={decisions} />);
    expect(screen.getByText(/John.doe/)).toBeInTheDocument();
  });

  it('shows "Qori" for system actor', () => {
    const decisions: ReviewRecord[] = [
      { ...mockReview, reviewedBy: 'system:ai' },
    ];
    render(<RevisionHistoryItem revision={mockRevision} decisions={decisions} />);
    expect(screen.getByText(/Qori/)).toBeInTheDocument();
  });

  it('renders View button when handler provided', () => {
    const onView = vi.fn();
    render(<RevisionHistoryItem revision={mockRevision} onView={onView} />);
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  });

  it('does not render View button when no handler', () => {
    render(<RevisionHistoryItem revision={mockRevision} />);
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  });

  it('calls onView when clicked', async () => {
    const onView = vi.fn();
    render(<RevisionHistoryItem revision={mockRevision} onView={onView} />);

    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onView).toHaveBeenCalledTimes(1);
  });
});

describe('RevisionHistory', () => {
  it('renders empty state', () => {
    render(<RevisionHistory revisions={[]} reviews={[]} />);
    expect(screen.getByText('No revision history.')).toBeInTheDocument();
  });

  it('renders revisions sorted newest first', () => {
    const revisions: RevisionDetail[] = [
      { ...mockRevision, id: 1, revisionNumber: 1 },
      { ...mockRevision, id: 2, revisionNumber: 2, content: { wording: 'Second revision' } },
      { ...mockRevision, id: 3, revisionNumber: 3, content: { wording: 'Third revision' } },
    ];
    render(<RevisionHistory revisions={revisions} reviews={[]} />);

    const items = screen.getAllByText(/^r\d$/);
    expect(items[0]).toHaveTextContent('r3');
    expect(items[1]).toHaveTextContent('r2');
    expect(items[2]).toHaveTextContent('r1');
  });

  it('groups decisions by revision', () => {
    const revisions: RevisionDetail[] = [
      { ...mockRevision, id: 1, revisionNumber: 1, isAccepted: true },
    ];
    const reviews: ReviewRecord[] = [
      { ...mockReview, id: 1, action: 'accept', revisionId: 1 },
    ];
    render(<RevisionHistory revisions={revisions} reviews={reviews} />);

    // Both status badge and decision line show "Accepted"
    const acceptedElements = screen.getAllByText('Accepted');
    expect(acceptedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onViewRevision with correct revision', async () => {
    const onViewRevision = vi.fn();
    const revisions: RevisionDetail[] = [
      { ...mockRevision, id: 1, revisionNumber: 1 },
      { ...mockRevision, id: 2, revisionNumber: 2, content: { wording: 'Second' } },
    ];
    render(
      <RevisionHistory
        revisions={revisions}
        reviews={[]}
        onViewRevision={onViewRevision}
      />,
    );

    const viewButtons = screen.getAllByRole('button', { name: 'View' });
    // First button is r2 (newest first)
    await userEvent.click(viewButtons[0]);

    expect(onViewRevision).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it('renders multiple decision lines for same revision', () => {
    const revisions: RevisionDetail[] = [
      { ...mockRevision, id: 1, revisionNumber: 1 },
    ];
    const reviews: ReviewRecord[] = [
      { ...mockReview, id: 1, action: 'reject', comment: 'Needs work' },
      { ...mockReview, id: 2, action: 'accept', comment: 'Better now' },
    ];
    render(<RevisionHistory revisions={revisions} reviews={reviews} />);

    // Decision lines present
    expect(screen.getByText(/Needs work/)).toBeInTheDocument();
    expect(screen.getByText(/Better now/)).toBeInTheDocument();
  });
});
