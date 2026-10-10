/**
 * InsightDetailPanel tests — panel display and permissions.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightDetailPanel } from '../InsightDetailPanel';
import type { InsightDetail, RevisionDetail } from '@qori/api-contracts';

const mockRevision: RevisionDetail = {
  id: 1,
  publicId: 'rev-001',
  revisionNumber: 1,
  content: { wording: 'Test insight wording' },
  evidenceSnapshot: [
    {
      evidenceSourceId: 1,
      sourceLabel: 'Report.pdf',
      locator: { page: '5' },
      validation: 'verified',
    },
  ],
  origin: 'ai',
  createdBy: 'system:qori',
  createdAt: '2024-01-15T10:00:00Z',
  isAccepted: false,
  isLatest: true,
};

const mockInsight: InsightDetail = {
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
  createdBy: 'system:qori',
  createdAt: '2024-01-15T10:00:00Z',
  withdrawnAt: null,
  version: 1,
  latestRevision: mockRevision,
  acceptedRevision: null,
  revisionCount: 1,
};

describe('InsightDetailPanel', () => {
  it('renders display ID in header', () => {
    render(<InsightDetailPanel insight={mockInsight} />);
    expect(screen.getByText('IN-0001')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<InsightDetailPanel insight={mockInsight} />);
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('renders origin tag', () => {
    render(<InsightDetailPanel insight={mockInsight} />);
    // Origin tag appears in header and revision block
    const originTags = screen.getAllByText('Proposed by Qori');
    expect(originTags.length).toBeGreaterThanOrEqual(1);
  });

  it('renders proposed version for proposed insight', () => {
    render(<InsightDetailPanel insight={mockInsight} />);
    expect(screen.getByText('Proposed Version')).toBeInTheDocument();
    expect(screen.getByText("Qori's interpretation")).toBeInTheDocument();
  });

  it('renders accepted version for accepted insight', () => {
    const acceptedRevision: RevisionDetail = {
      ...mockRevision,
      isAccepted: true,
    };
    const accepted: InsightDetail = {
      ...mockInsight,
      status: 'accepted',
      acceptedRevision,
      acceptedRevisionNumber: 1,
    };
    render(<InsightDetailPanel insight={accepted} />);
    expect(screen.getByText('Accepted Version')).toBeInTheDocument();
    expect(screen.getByText('In use')).toBeInTheDocument();
  });

  it('renders both versions for accepted_with_pending', () => {
    const acceptedRevision: RevisionDetail = {
      ...mockRevision,
      id: 1,
      revisionNumber: 1,
      isAccepted: true,
      isLatest: false,
    };
    const pendingRevision: RevisionDetail = {
      ...mockRevision,
      id: 2,
      revisionNumber: 2,
      content: { wording: 'Updated wording' },
      isAccepted: false,
      isLatest: true,
    };
    const withPending: InsightDetail = {
      ...mockInsight,
      status: 'accepted_with_pending',
      acceptedRevision,
      latestRevision: pendingRevision,
      acceptedRevisionNumber: 1,
      pendingRevisionNumber: 2,
    };
    render(<InsightDetailPanel insight={withPending} />);
    expect(screen.getByText('Accepted Version')).toBeInTheDocument();
    expect(screen.getByText('Pending Revision')).toBeInTheDocument();
    expect(screen.getByText(/Revision r2 pending/)).toBeInTheDocument();
  });

  it('renders eligibility line for accepted insight', () => {
    const accepted: InsightDetail = {
      ...mockInsight,
      status: 'accepted',
      acceptedRevision: { ...mockRevision, isAccepted: true },
    };
    render(<InsightDetailPanel insight={accepted} />);
    expect(screen.getByText('Eligible for synthesis')).toBeInTheDocument();
  });

  it('renders not eligible for proposed insight', () => {
    render(<InsightDetailPanel insight={mockInsight} />);
    expect(screen.getByText('Not yet accepted — not in synthesis scope')).toBeInTheDocument();
  });

  it('renders withdrawn notice for withdrawn insight', () => {
    const withdrawn: InsightDetail = {
      ...mockInsight,
      status: 'withdrawn',
      withdrawnAt: '2024-02-01T10:00:00Z',
      acceptedRevision: { ...mockRevision, isAccepted: true },
    };
    render(<InsightDetailPanel insight={withdrawn} />);
    expect(screen.getByText('Withdrawn — not in synthesis scope')).toBeInTheDocument();
  });

  it('renders action slot when provided and canEdit is true', () => {
    render(
      <InsightDetailPanel
        insight={mockInsight}
        canEdit={true}
        actionSlot={<button>Accept</button>}
      />,
    );
    expect(screen.getByText('Accept')).toBeInTheDocument();
  });

  it('does not render action slot when canEdit is false', () => {
    render(
      <InsightDetailPanel
        insight={mockInsight}
        canEdit={false}
        actionSlot={<button>Accept</button>}
      />,
    );
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
  });

  it('renders read-only notice when canEdit is false', () => {
    render(<InsightDetailPanel insight={mockInsight} canEdit={false} />);
    expect(screen.getByText('You have view-only access to this insight.')).toBeInTheDocument();
  });

  it('renders custom read-only reason', () => {
    render(
      <InsightDetailPanel
        insight={mockInsight}
        canEdit={false}
        readOnlyReason="This insight is locked for review."
      />,
    );
    expect(screen.getByText('This insight is locked for review.')).toBeInTheDocument();
  });

  it('renders evidence references', () => {
    render(<InsightDetailPanel insight={mockInsight} />);
    expect(screen.getByText('Evidence (1)')).toBeInTheDocument();
    expect(screen.getByText('Report.pdf')).toBeInTheDocument();
  });

  it('renders view history button when multiple revisions', () => {
    const withHistory: InsightDetail = {
      ...mockInsight,
      revisionCount: 3,
    };
    const onViewHistory = vi.fn();
    render(<InsightDetailPanel insight={withHistory} onViewHistory={onViewHistory} />);

    expect(screen.getByText('View 3 revisions')).toBeInTheDocument();
  });

  it('handles view history click', async () => {
    const withHistory: InsightDetail = {
      ...mockInsight,
      revisionCount: 3,
    };
    const onViewHistory = vi.fn();
    render(<InsightDetailPanel insight={withHistory} onViewHistory={onViewHistory} />);

    await userEvent.click(screen.getByText('View 3 revisions'));
    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });

  it('does not show history button for single revision', () => {
    render(<InsightDetailPanel insight={mockInsight} onViewHistory={vi.fn()} />);
    expect(screen.queryByText(/View.*revision/)).not.toBeInTheDocument();
  });

  it('renders why line for proposed insight', () => {
    render(
      <InsightDetailPanel
        insight={mockInsight}
        canEdit={true}
        actionSlot={<button>Accept</button>}
      />,
    );
    expect(screen.getByText('Accepting will add this insight to the synthesis scope.')).toBeInTheDocument();
  });

  it('renders why line for accepted insight', () => {
    const accepted: InsightDetail = {
      ...mockInsight,
      status: 'accepted',
      acceptedRevision: { ...mockRevision, isAccepted: true },
    };
    render(
      <InsightDetailPanel
        insight={accepted}
        canEdit={true}
        actionSlot={<button>Edit</button>}
      />,
    );
    expect(screen.getByText('This insight is accepted and in the synthesis scope.')).toBeInTheDocument();
  });
});
