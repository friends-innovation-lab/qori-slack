/**
 * GenerationFailure Tests — DR-6b-5d-B
 *
 * Tests for generation failure display component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationFailure } from '../GenerationFailure';

describe('GenerationFailure', () => {
  it('shows failure title', () => {
    render(<GenerationFailure error={null} />);

    expect(screen.getByText('Generation failed')).toBeInTheDocument();
  });

  it('shows provided error message', () => {
    render(<GenerationFailure error="Model rate limit exceeded" />);

    expect(screen.getByText('Model rate limit exceeded')).toBeInTheDocument();
  });

  it('shows default error message when error is null', () => {
    render(<GenerationFailure error={null} />);

    expect(
      screen.getByText('An unexpected error occurred during generation.'),
    ).toBeInTheDocument();
  });

  it('shows guidance about manual editing', () => {
    render(<GenerationFailure error="Test error" />);

    expect(
      screen.getByText(/you can still edit the readout manually/i),
    ).toBeInTheDocument();
  });

  it('does not show retry button (per DR-6b-5d-B scope)', () => {
    render(<GenerationFailure error="Test error" />);

    // There should be no retry button - retry initiation is out of scope
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});
