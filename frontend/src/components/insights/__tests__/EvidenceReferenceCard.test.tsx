/**
 * EvidenceReferenceCard tests — evidence reference display and locators.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceReferenceCard } from '../EvidenceReferenceCard';
import type { EvidenceReference } from '@qori/api-contracts';

const mockReference: EvidenceReference = {
  evidenceSourceId: 1,
  evidenceSourcePublicId: 'src-001',
  sourceLabel: 'User Research Report.pdf',
  locator: {
    page: '12-15',
    section: 'Executive Summary',
    excerpt: 'Users reported significant difficulty navigating the dashboard.',
  },
  validation: 'verified',
};

describe('EvidenceReferenceCard', () => {
  it('renders source label', () => {
    render(<EvidenceReferenceCard reference={mockReference} />);
    expect(screen.getByText('User Research Report.pdf')).toBeInTheDocument();
  });

  it('renders added date when provided', () => {
    render(<EvidenceReferenceCard reference={mockReference} addedDate="2024-01-15T10:00:00Z" />);
    expect(screen.getByText(/Added Jan 15, 2024/)).toBeInTheDocument();
  });

  it('renders run name when provided', () => {
    render(<EvidenceReferenceCard reference={mockReference} runName="Run #1" />);
    expect(screen.getByText('Run #1')).toBeInTheDocument();
  });

  it('renders locator fields when present', () => {
    render(<EvidenceReferenceCard reference={mockReference} />);
    expect(screen.getByText('Page')).toBeInTheDocument();
    expect(screen.getByText('12-15')).toBeInTheDocument();
    expect(screen.getByText('Section')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  });

  it('renders excerpt block', () => {
    render(<EvidenceReferenceCard reference={mockReference} />);
    expect(screen.getByText(/Users reported significant difficulty/)).toBeInTheDocument();
    expect(screen.getByText('Source excerpt')).toBeInTheDocument();
  });

  it('renders "Not recorded" for missing locator fields', () => {
    const partialRef: EvidenceReference = {
      ...mockReference,
      locator: { page: '5', section: undefined, excerpt: 'Some text' },
    };
    render(<EvidenceReferenceCard reference={partialRef} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });

  it('renders source-level notice when sourceLevel is true', () => {
    const sourceLevel: EvidenceReference = {
      ...mockReference,
      locator: { sourceLevel: true },
    };
    render(<EvidenceReferenceCard reference={sourceLevel} />);
    expect(screen.getByText(/Source-level attribution/)).toBeInTheDocument();
    expect(screen.getByText(/Linked to this source as a whole/)).toBeInTheDocument();
  });

  it('renders source-level notice when locator is empty', () => {
    const emptyLocator: EvidenceReference = {
      ...mockReference,
      locator: {},
    };
    render(<EvidenceReferenceCard reference={emptyLocator} />);
    expect(screen.getByText(/Source-level attribution/)).toBeInTheDocument();
  });

  it('renders attribution limitation when provided', () => {
    const withLimitation: EvidenceReference = {
      ...mockReference,
      locator: {
        sourceLevel: true,
        attributionLimitation: 'PDF text extraction unavailable',
      },
    };
    render(<EvidenceReferenceCard reference={withLimitation} />);
    expect(screen.getByText('PDF text extraction unavailable')).toBeInTheDocument();
  });

  it('renders verified validation badge', () => {
    render(<EvidenceReferenceCard reference={mockReference} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders source attributed validation', () => {
    const sourceAttr: EvidenceReference = {
      ...mockReference,
      validation: 'source_attributed_unverified',
    };
    render(<EvidenceReferenceCard reference={sourceAttr} />);
    expect(screen.getByText('Source attributed')).toBeInTheDocument();
  });

  it('renders AI extracted validation', () => {
    const aiExtracted: EvidenceReference = {
      ...mockReference,
      validation: 'ai_unverified',
    };
    render(<EvidenceReferenceCard reference={aiExtracted} />);
    expect(screen.getByText('AI extracted')).toBeInTheDocument();
  });

  it('renders navigate button when handler provided', async () => {
    const onNavigate = vi.fn();
    render(<EvidenceReferenceCard reference={mockReference} onNavigateToSource={onNavigate} />);

    const button = screen.getByText(/Open source/);
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not render navigate button when handler not provided', () => {
    render(<EvidenceReferenceCard reference={mockReference} />);
    expect(screen.queryByText(/Open source/)).not.toBeInTheDocument();
  });

  it('falls back to source ID when no label', () => {
    const noLabel: EvidenceReference = {
      ...mockReference,
      sourceLabel: undefined,
    };
    render(<EvidenceReferenceCard reference={noLabel} />);
    expect(screen.getByText('Source 1')).toBeInTheDocument();
  });
});
