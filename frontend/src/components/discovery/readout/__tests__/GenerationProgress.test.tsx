/**
 * GenerationProgress Tests — DR-6b-5d-B
 *
 * Tests for generation progress display component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationProgress } from '../GenerationProgress';

describe('GenerationProgress', () => {
  describe('status display', () => {
    it('shows "Generation queued..." for pending status', () => {
      render(<GenerationProgress status="pending" />);

      expect(screen.getByText('Generation queued...')).toBeInTheDocument();
    });

    it('shows "Generating readout content..." for generating status', () => {
      render(<GenerationProgress status="generating" />);

      expect(screen.getByText('Generating readout content...')).toBeInTheDocument();
    });

    it('shows hint about navigating away', () => {
      render(<GenerationProgress status="generating" />);

      expect(
        screen.getByText(/you can navigate away and return later/i),
      ).toBeInTheDocument();
    });
  });

  describe('polling error', () => {
    it('shows polling error message when pollingError is true', () => {
      render(<GenerationProgress status="generating" pollingError />);

      expect(screen.getByText(/unable to check generation status/i)).toBeInTheDocument();
    });

    it('shows retry button when onRetryPolling is provided', () => {
      const mockRetry = vi.fn();
      render(
        <GenerationProgress status="generating" pollingError onRetryPolling={mockRetry} />,
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockRetry).toHaveBeenCalled();
    });

    it('does not show retry button when onRetryPolling is not provided', () => {
      render(<GenerationProgress status="generating" pollingError />);

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });
  });
});
