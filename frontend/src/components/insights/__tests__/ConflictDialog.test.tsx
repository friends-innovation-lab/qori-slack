/**
 * ConflictDialog tests — concurrency conflict resolution.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictDialog, type ConflictVersion } from '../ConflictDialog';

const mockUserVersion: ConflictVersion = {
  revisionNumber: 2,
  wording: 'My unsaved changes to the insight wording.',
  author: 'user@example.com',
  timestamp: '2024-01-15T10:30:00Z',
};

const mockLatestVersion: ConflictVersion = {
  revisionNumber: 2,
  wording: 'Changes made by someone else.',
  author: 'other@example.com',
  timestamp: '2024-01-15T10:25:00Z',
};

describe('ConflictDialog - Edit Conflict', () => {
  it('does not render when closed', () => {
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={false}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('renders title with insight ID', () => {
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Edit Conflict on IN-0001')).toBeInTheDocument();
  });

  it('renders explanation text', () => {
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Someone else edited this insight/)).toBeInTheDocument();
    expect(screen.getByText(/Your changes have not been saved/)).toBeInTheDocument();
  });

  it('renders side-by-side comparison', () => {
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Your changes')).toBeInTheDocument();
    expect(screen.getByText('Latest version')).toBeInTheDocument();
    expect(screen.getByText(mockUserVersion.wording)).toBeInTheDocument();
    expect(screen.getByText(mockLatestVersion.wording)).toBeInTheDocument();
  });

  it('renders three resolution options', () => {
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Discard my changes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review latest/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rebase onto latest/ })).toBeInTheDocument();
  });

  it('calls onResolve with "discard"', async () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={onResolve}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Discard my changes/ }));
    expect(onResolve).toHaveBeenCalledWith('discard');
  });

  it('calls onResolve with "review"', async () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={onResolve}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Review latest/ }));
    expect(onResolve).toHaveBeenCalledWith('review');
  });

  it('calls onResolve with "rebase"', async () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={onResolve}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Rebase onto latest/ }));
    expect(onResolve).toHaveBeenCalledWith('rebase');
  });

  it('renders rebase hint', () => {
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/open the editor with the latest version/)).toBeInTheDocument();
  });

  it('calls onResolve with "review" on Escape', async () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        type="edit"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={onResolve}
        onClose={vi.fn()}
      />,
    );

    await userEvent.keyboard('{Escape}');
    expect(onResolve).toHaveBeenCalledWith('review');
  });
});

describe('ConflictDialog - Decision Conflict', () => {
  it('renders decision conflict title', () => {
    render(
      <ConflictDialog
        type="decision"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Decision Conflict')).toBeInTheDocument();
  });

  it('renders simpler explanation for decision conflict', () => {
    render(
      <ConflictDialog
        type="decision"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Another user made a review decision/)).toBeInTheDocument();
  });

  it('shows only OK button for decision conflict', () => {
    render(
      <ConflictDialog
        type="decision"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rebase/ })).not.toBeInTheDocument();
  });

  it('calls onClose when OK clicked', async () => {
    const onClose = vi.fn();
    render(
      <ConflictDialog
        type="decision"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape for decision conflict', async () => {
    const onClose = vi.fn();
    render(
      <ConflictDialog
        type="decision"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows latest action info', () => {
    render(
      <ConflictDialog
        type="decision"
        insightDisplayId="IN-0001"
        open={true}
        userVersion={mockUserVersion}
        latestVersion={mockLatestVersion}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Latest action:/)).toBeInTheDocument();
    expect(screen.getByText(/other@example.com/)).toBeInTheDocument();
  });
});
