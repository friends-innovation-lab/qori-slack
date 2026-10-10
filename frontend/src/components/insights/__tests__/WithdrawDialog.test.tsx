/**
 * WithdrawDialog tests — withdrawal confirmation and reason requirement.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WithdrawDialog } from '../WithdrawDialog';

describe('WithdrawDialog', () => {
  it('does not render when closed', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('renders insight display ID in title', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('Withdraw IN-0001?')).toBeInTheDocument();
  });

  it('renders consequences list', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/Remove this insight from future synthesis/)).toBeInTheDocument();
    expect(screen.getByText(/Mark earlier syntheses citing this insight/)).toBeInTheDocument();
    expect(screen.getByText(/Keep the full revision history/)).toBeInTheDocument();
  });

  it('renders synthesis count when provided', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        synthesisCount={3}
      />,
    );
    expect(screen.getByText(/currently used in 3 syntheses/)).toBeInTheDocument();
  });

  it('does not render synthesis count when not provided', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByText(/currently used in/)).not.toBeInTheDocument();
  });

  it('renders reason textarea', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Reason for withdrawal/)).toBeInTheDocument();
  });

  it('validates reason is required (D6) by disabling button', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    // Button should be disabled without a reason
    const withdrawButton = screen.getByRole('button', { name: 'Withdraw Insight' });
    expect(withdrawButton).toBeDisabled();
  });

  it('calls onConfirm with reason', async () => {
    const onConfirm = vi.fn();
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    // Enter reason
    const textarea = screen.getByLabelText(/Reason for withdrawal/);
    await userEvent.type(textarea, 'No longer relevant to research goals');

    // Click withdraw
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw Insight' }));

    expect(onConfirm).toHaveBeenCalledWith('No longer relevant to research goals');
  });

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking overlay', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    // Click on overlay (the outer div)
    const overlay = container.querySelector('[class*="dialogOverlay"]');
    if (overlay) {
      await userEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables inputs when confirming', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirming={true}
      />,
    );

    expect(screen.getByLabelText(/Reason for withdrawal/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows hint about recording reason', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/recorded in the revision history/)).toBeInTheDocument();
  });

  it('withdraw button is disabled without reason', () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Withdraw Insight' })).toBeDisabled();
  });

  it('withdraw button is enabled with reason', async () => {
    render(
      <WithdrawDialog
        insightDisplayId="IN-0001"
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText(/Reason for withdrawal/);
    await userEvent.type(textarea, 'Test reason');

    expect(screen.getByRole('button', { name: 'Withdraw Insight' })).not.toBeDisabled();
  });
});
