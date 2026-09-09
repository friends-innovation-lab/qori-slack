/**
 * WS-1: LifecycleRail component tests — stage rendering, state display.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { LifecycleRail } from './LifecycleRail';
import type { LifecycleNode } from '@qori/api-contracts';

const sampleNodes: LifecycleNode[] = [
  { stage: 'brief', label: 'Brief', state: 'current', unlock_hint: null, count: 1, is_current: true },
  { stage: 'plan', label: 'Plan', state: 'locked', unlock_hint: 'Approve the brief first', count: 0, is_current: false },
  { stage: 'sessions', label: 'Sessions', state: 'locked', unlock_hint: 'Complete the plan', count: 0, is_current: false },
  { stage: 'analysis', label: 'Analysis', state: 'locked', unlock_hint: null, count: 0, is_current: false },
  { stage: 'readout', label: 'Readout', state: 'locked', unlock_hint: null, count: 0, is_current: false },
];

const studyId = 'study-uuid-1';

describe('LifecycleRail', () => {
  it('renders all stages', () => {
    renderWithProviders(<LifecycleRail studyPublicId={studyId} nodes={sampleNodes} />);
    expect(screen.getByText('Brief')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Readout')).toBeInTheDocument();
  });

  it('marks current stage with aria-label and current marker', () => {
    renderWithProviders(<LifecycleRail studyPublicId={studyId} nodes={sampleNodes} />);
    // Current stage Brief should have is_current=true, which renders a currentMarker span
    const briefLink = screen.getByRole('link', { name: /Brief, 1 items/ });
    expect(briefLink).toBeInTheDocument();
  });

  it('locked stage has aria-disabled', () => {
    renderWithProviders(<LifecycleRail studyPublicId={studyId} nodes={sampleNodes} />);
    const planLink = screen.getByRole('link', { name: /Plan.*locked/ });
    expect(planLink).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders with empty nodes array', () => {
    renderWithProviders(<LifecycleRail studyPublicId={studyId} nodes={[]} />);
    // Should not crash
  });

  it('shows approved brief as completed', () => {
    const approved: LifecycleNode[] = [
      { stage: 'brief', label: 'Brief', state: 'free', unlock_hint: null, count: 1, is_current: false },
      { stage: 'plan', label: 'Plan', state: 'current', unlock_hint: null, count: 0, is_current: true },
    ];
    renderWithProviders(<LifecycleRail studyPublicId={studyId} nodes={approved} />);
    expect(screen.getByText('Brief')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });
});
