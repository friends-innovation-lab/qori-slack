/**
 * CC-7: ReviewRail tests — 3 approval statuses, checklist, actions, a11y.
 *
 * Tests verify:
 * - Rendering for pending_approval, approved, and changes_requested
 * - Request-changes form flow
 * - Disabled Approve has aria-describedby hint
 * - Checklist fieldset has a legend
 * - Existing approval behavior preserved
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReviewRail, type ChecklistState } from '../ReviewRail';
import type { BriefApprovalState } from '@qori/artifact-contracts';

// Mock approval states
const pendingApproval: BriefApprovalState = {
  status: 'pending_approval',
  isPendingApproval: true,
  isApproved: false,
  isChangesRequested: false,
  reviewerDisplayName: 'Jane Reviewer',
  approvedAt: null,
  changeFeedback: null,
};

const approvedState: BriefApprovalState = {
  status: 'approved',
  isPendingApproval: false,
  isApproved: true,
  isChangesRequested: false,
  reviewerDisplayName: 'Jane Reviewer',
  approvedAt: '2026-09-20T10:30:00Z',
  changeFeedback: null,
};

const changesRequestedState: BriefApprovalState = {
  status: 'changes_requested',
  isPendingApproval: false,
  isApproved: false,
  isChangesRequested: true,
  reviewerDisplayName: 'Jane Reviewer',
  approvedAt: null,
  changeFeedback: 'Please revise the methodology section to include more detail.',
};

const nullApprovalState: BriefApprovalState = {
  status: null,
  isPendingApproval: false,
  isApproved: false,
  isChangesRequested: false,
  reviewerDisplayName: null,
  approvedAt: null,
  changeFeedback: null,
};

const emptyChecklist: ChecklistState = {
  scope: false,
  timeline: false,
  participants: false,
  budget: false,
};

const fullChecklist: ChecklistState = {
  scope: true,
  timeline: true,
  participants: true,
  budget: true,
};

function renderReviewRail(props: Partial<Parameters<typeof ReviewRail>[0]> = {}) {
  const defaultProps = {
    approval: pendingApproval,
    checklist: emptyChecklist,
    onChecklistChange: vi.fn(),
    onApprove: vi.fn(),
    approving: false,
    onRequestChanges: vi.fn(),
    requesting: false,
  };

  return render(<ReviewRail {...defaultProps} {...props} />);
}

describe('ReviewRail', () => {
  afterEach(() => {
    cleanup();
  });

  describe('null status', () => {
    it('renders nothing when status is null', () => {
      const { container } = renderReviewRail({ approval: nullApprovalState });
      expect(container.firstChild).toBeNull();
    });
  });

  describe('pending_approval status', () => {
    it('renders pending approval heading', () => {
      renderReviewRail({ approval: pendingApproval });
      expect(screen.getByRole('heading', { name: /pending approval/i })).toBeInTheDocument();
    });

    it('renders approval checklist', () => {
      renderReviewRail({ approval: pendingApproval });
      expect(screen.getByText('Scope and method are appropriate')).toBeInTheDocument();
      expect(screen.getByText('Timeline and deadline are feasible')).toBeInTheDocument();
      expect(screen.getByText('Participant approach is sound')).toBeInTheDocument();
      expect(screen.getByText('Budget is reasonable')).toBeInTheDocument();
    });

    it('checklist fieldset has a legend', () => {
      renderReviewRail({ approval: pendingApproval });
      expect(screen.getByText('Approval checklist')).toBeInTheDocument();
    });

    it('calls onChecklistChange when checkbox is toggled', () => {
      const onChecklistChange = vi.fn();
      renderReviewRail({ approval: pendingApproval, onChecklistChange });

      const scopeCheckbox = screen.getByRole('checkbox', { name: /scope and method/i });
      fireEvent.click(scopeCheckbox);

      expect(onChecklistChange).toHaveBeenCalledWith({
        ...emptyChecklist,
        scope: true,
      });
    });

    it('Approve button is disabled when not all checks are completed', () => {
      renderReviewRail({ approval: pendingApproval, checklist: emptyChecklist });
      const approveButton = screen.getByRole('button', { name: /approve/i });
      expect(approveButton).toBeDisabled();
    });

    it('disabled Approve has aria-describedby pointing to hint', () => {
      renderReviewRail({ approval: pendingApproval, checklist: emptyChecklist });
      const approveButton = screen.getByRole('button', { name: /approve/i });
      expect(approveButton).toHaveAttribute('aria-describedby', 'approve-hint');
      expect(screen.getByText('Confirm all four checks to approve.')).toBeInTheDocument();
    });

    it('Approve button is enabled when all checks are completed', () => {
      renderReviewRail({ approval: pendingApproval, checklist: fullChecklist });
      const approveButton = screen.getByRole('button', { name: /approve/i });
      expect(approveButton).not.toBeDisabled();
      expect(approveButton).not.toHaveAttribute('aria-describedby');
    });

    it('calls onApprove when Approve is clicked', () => {
      const onApprove = vi.fn();
      renderReviewRail({ approval: pendingApproval, checklist: fullChecklist, onApprove });

      fireEvent.click(screen.getByRole('button', { name: /approve/i }));
      expect(onApprove).toHaveBeenCalled();
    });

    it('shows approving state on button', () => {
      renderReviewRail({ approval: pendingApproval, checklist: fullChecklist, approving: true });
      expect(screen.getByRole('button', { name: /approving/i })).toBeInTheDocument();
    });
  });

  describe('request changes form', () => {
    it('opens request changes form when button clicked', () => {
      renderReviewRail({ approval: pendingApproval });

      fireEvent.click(screen.getByRole('button', { name: /request changes/i }));

      expect(screen.getByRole('heading', { name: /request changes/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/feedback/i)).toBeInTheDocument();
    });

    it('Submit is disabled when comment is empty', () => {
      renderReviewRail({ approval: pendingApproval });

      fireEvent.click(screen.getByRole('button', { name: /request changes/i }));

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it('calls onRequestChanges with trimmed comment', () => {
      const onRequestChanges = vi.fn();
      renderReviewRail({ approval: pendingApproval, onRequestChanges });

      fireEvent.click(screen.getByRole('button', { name: /request changes/i }));

      const textarea = screen.getByLabelText(/feedback/i);
      fireEvent.change(textarea, { target: { value: '  Please revise the scope  ' } });

      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(onRequestChanges).toHaveBeenCalledWith('Please revise the scope');
    });

    it('Cancel returns to checklist view', () => {
      renderReviewRail({ approval: pendingApproval });

      fireEvent.click(screen.getByRole('button', { name: /request changes/i }));
      expect(screen.queryByText('Scope and method are appropriate')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.getByText('Scope and method are appropriate')).toBeInTheDocument();
    });

    it('shows submitting state on button', () => {
      renderReviewRail({ approval: pendingApproval, requesting: true });

      fireEvent.click(screen.getByRole('button', { name: /request changes/i }));

      const textarea = screen.getByLabelText(/feedback/i);
      fireEvent.change(textarea, { target: { value: 'Some feedback' } });

      expect(screen.getByRole('button', { name: /submitting/i })).toBeInTheDocument();
    });
  });

  describe('approved status', () => {
    it('renders approved heading', () => {
      renderReviewRail({ approval: approvedState });
      expect(screen.getByRole('heading', { name: /approved/i })).toBeInTheDocument();
    });

    it('renders reviewer name and date', () => {
      renderReviewRail({ approval: approvedState });
      expect(screen.getByText(/by Jane Reviewer/)).toBeInTheDocument();
      expect(screen.getByText(/Sep 20, 2026/)).toBeInTheDocument();
    });

    it('renders downstream stale warning', () => {
      renderReviewRail({ approval: approvedState });
      expect(screen.getByText(/citation source for downstream artifacts/)).toBeInTheDocument();
    });

    it('does not render checklist or actions', () => {
      renderReviewRail({ approval: approvedState });
      expect(screen.queryByText('Scope and method are appropriate')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    });
  });

  describe('changes_requested status', () => {
    it('renders changes requested heading', () => {
      renderReviewRail({ approval: changesRequestedState });
      expect(screen.getByRole('heading', { name: /changes requested/i })).toBeInTheDocument();
    });

    it('renders reviewer name', () => {
      renderReviewRail({ approval: changesRequestedState });
      expect(screen.getByText(/by Jane Reviewer/)).toBeInTheDocument();
    });

    it('renders feedback in blockquote', () => {
      renderReviewRail({ approval: changesRequestedState });
      const feedback = screen.getByText(/Please revise the methodology section/);
      expect(feedback.closest('blockquote')).toBeInTheDocument();
    });

    it('does not render checklist or actions', () => {
      renderReviewRail({ approval: changesRequestedState });
      expect(screen.queryByText('Scope and method are appropriate')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('checklist is wrapped in fieldset with legend', () => {
      renderReviewRail({ approval: pendingApproval });
      const legend = screen.getByText('Approval checklist');
      expect(legend.tagName.toLowerCase()).toBe('legend');
      expect(legend.closest('fieldset')).toBeInTheDocument();
    });

    it('status headings are h2', () => {
      renderReviewRail({ approval: pendingApproval });
      const heading = screen.getByRole('heading', { name: /pending approval/i });
      expect(heading.tagName.toLowerCase()).toBe('h2');
    });
  });
});
