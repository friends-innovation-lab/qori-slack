/**
 * RegenerationConfirmationModal Tests — DR-6b-5e-B-3
 *
 * Unit tests for the regeneration confirmation dialog component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegenerationConfirmationModal } from '../RegenerationConfirmationModal';

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('RegenerationConfirmationModal', () => {
  const defaultProps = {
    selectedCount: 3,
    isRegenerating: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('content display', () => {
    it('displays the selected evidence count', () => {
      render(<RegenerationConfirmationModal {...defaultProps} selectedCount={5} />);

      expect(screen.getByText(/5/)).toBeInTheDocument();
      expect(screen.getByText(/selected evidence items/)).toBeInTheDocument();
    });

    it('uses singular form for single evidence item', () => {
      render(<RegenerationConfirmationModal {...defaultProps} selectedCount={1} />);

      // Text is split across elements (strong tag around the number)
      expect(screen.getByText(/selected evidence item\./)).toBeInTheDocument();
    });

    it('displays the confirmation title', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Confirm Regeneration')).toBeInTheDocument();
    });

    it('displays the required warning notes', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      // Required notes about regeneration effects
      expect(screen.getByText(/new generation version will be created/i)).toBeInTheDocument();
      // "Generation History" appears in multiple list items, so check for at least one
      expect(screen.getAllByText(/Generation History/)).toHaveLength(2);
      expect(screen.getByText(/CAS conditions permit/i)).toBeInTheDocument();
      expect(screen.getByText(/review checkmarks.*may.*be reset/i)).toBeInTheDocument();
      expect(screen.getByText(/previous draft content will be preserved/i)).toBeInTheDocument();
    });

    it('asks for explicit confirmation', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/Are you sure you want to proceed/i)).toBeInTheDocument();
    });
  });

  describe('button states', () => {
    it('shows Regenerate button when not regenerating', () => {
      render(<RegenerationConfirmationModal {...defaultProps} isRegenerating={false} />);

      expect(screen.getByRole('button', { name: /^Regenerate$/i })).toBeInTheDocument();
    });

    it('shows Regenerating... button when regenerating', () => {
      render(<RegenerationConfirmationModal {...defaultProps} isRegenerating={true} />);

      expect(screen.getByRole('button', { name: /Regenerating\.\.\./i })).toBeInTheDocument();
    });

    it('disables both buttons during regeneration', () => {
      render(<RegenerationConfirmationModal {...defaultProps} isRegenerating={true} />);

      expect(screen.getByRole('button', { name: /Regenerating/i })).toBeDisabled();
      // Use getByText to find the visible Cancel button (not the close X with aria-label)
      expect(screen.getByText('Cancel').closest('button')).toBeDisabled();
    });

    it('enables both buttons when not regenerating', () => {
      render(<RegenerationConfirmationModal {...defaultProps} isRegenerating={false} />);

      expect(screen.getByRole('button', { name: /Regenerate/i })).not.toBeDisabled();
      // Use getByText to find the visible Cancel button (not the close X with aria-label)
      expect(screen.getByText('Cancel').closest('button')).not.toBeDisabled();
    });
  });

  describe('callbacks', () => {
    it('calls onConfirm when Regenerate is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(<RegenerationConfirmationModal {...defaultProps} onConfirm={onConfirm} />);

      await user.click(screen.getByRole('button', { name: /^Regenerate$/i }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<RegenerationConfirmationModal {...defaultProps} onCancel={onCancel} />);

      // Use getByText to find the visible Cancel button (not the close X with aria-label)
      const cancelButton = screen.getByText('Cancel').closest('button') as HTMLButtonElement;
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when close button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<RegenerationConfirmationModal {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByLabelText(/Cancel/i));

      expect(onCancel).toHaveBeenCalled();
    });

    it('does not call onCancel on Escape when regenerating', () => {
      const onCancel = vi.fn();
      render(<RegenerationConfirmationModal {...defaultProps} isRegenerating={true} onCancel={onCancel} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel on Escape when not regenerating', () => {
      const onCancel = vi.fn();
      render(<RegenerationConfirmationModal {...defaultProps} isRegenerating={false} onCancel={onCancel} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('focus management', () => {
    it('focuses cancel button on mount', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      // Use getByText to find the visible Cancel button (not the close X with aria-label)
      expect(screen.getByText('Cancel').closest('button')).toHaveFocus();
    });
  });

  describe('accessibility', () => {
    it('has dialog role', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has modal attribute', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has accessible title', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'regeneration-modal-title');
      expect(screen.getByText('Confirm Regeneration')).toHaveAttribute('id', 'regeneration-modal-title');
    });

    it('has warning icon with aria-hidden', () => {
      render(<RegenerationConfirmationModal {...defaultProps} />);

      // The warning icon should not be announced by screen readers
      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });
});
