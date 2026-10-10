/**
 * InsightStatusBadge tests — status and origin display.
 */

import { describe, it, expect } from 'vitest';
import { screen, render } from '@testing-library/react';
import { InsightStatusBadge, OriginTag, InUseBadge } from '../InsightStatusBadge';

describe('InsightStatusBadge', () => {
  it('renders proposed status', () => {
    render(<InsightStatusBadge status="proposed" />);
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('renders accepted status', () => {
    render(<InsightStatusBadge status="accepted" />);
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('renders accepted_with_pending as "Accepted"', () => {
    render(<InsightStatusBadge status="accepted_with_pending" />);
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('renders rejected status', () => {
    render(<InsightStatusBadge status="rejected" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders withdrawn status', () => {
    render(<InsightStatusBadge status="withdrawn" />);
    expect(screen.getByText('Withdrawn')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<InsightStatusBadge status="proposed" className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('OriginTag', () => {
  it('renders AI origin with sparkles', () => {
    render(<OriginTag origin="ai" />);
    expect(screen.getByText('Proposed by Qori')).toBeInTheDocument();
  });

  it('renders researcher origin with pencil', () => {
    render(<OriginTag origin="researcher" />);
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<OriginTag origin="ai" className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('InUseBadge', () => {
  it('renders "In use" text', () => {
    render(<InUseBadge />);
    expect(screen.getByText('In use')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<InUseBadge className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
