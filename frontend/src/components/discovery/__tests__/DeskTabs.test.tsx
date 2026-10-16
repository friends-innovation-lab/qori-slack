/**
 * DeskTabs Tests — DR-6b-4c
 *
 * Tests for shared tab navigation component.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';
import { DeskTabs } from '../DeskTabs';

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('DeskTabs', () => {
  const defaultProps = {
    studyPublicId: 'study-123',
    activeTab: 'insights' as const,
  };

  it('renders all three tabs', () => {
    renderWithRouter(<DeskTabs {...defaultProps} />);

    expect(screen.getByRole('tab', { name: /insights/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /desk readouts/i })).toBeInTheDocument();
  });

  it('highlights insights tab as active when activeTab is insights', () => {
    renderWithRouter(<DeskTabs {...defaultProps} activeTab="insights" />);

    const insightsTab = screen.getByRole('tab', { name: /insights/i });
    const sourcesTab = screen.getByRole('tab', { name: /sources/i });
    const readoutsTab = screen.getByRole('tab', { name: /desk readouts/i });

    expect(insightsTab).toHaveAttribute('aria-selected', 'true');
    expect(sourcesTab).toHaveAttribute('aria-selected', 'false');
    expect(readoutsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('highlights sources tab as active when activeTab is sources', () => {
    renderWithRouter(<DeskTabs {...defaultProps} activeTab="sources" />);

    const insightsTab = screen.getByRole('tab', { name: /insights/i });
    const sourcesTab = screen.getByRole('tab', { name: /sources/i });
    const readoutsTab = screen.getByRole('tab', { name: /desk readouts/i });

    expect(insightsTab).toHaveAttribute('aria-selected', 'false');
    expect(sourcesTab).toHaveAttribute('aria-selected', 'true');
    expect(readoutsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('highlights readouts tab as active when activeTab is readouts', () => {
    renderWithRouter(<DeskTabs {...defaultProps} activeTab="readouts" />);

    const insightsTab = screen.getByRole('tab', { name: /insights/i });
    const sourcesTab = screen.getByRole('tab', { name: /sources/i });
    const readoutsTab = screen.getByRole('tab', { name: /desk readouts/i });

    expect(insightsTab).toHaveAttribute('aria-selected', 'false');
    expect(sourcesTab).toHaveAttribute('aria-selected', 'false');
    expect(readoutsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('displays count badge when count is greater than zero', () => {
    renderWithRouter(
      <DeskTabs
        {...defaultProps}
        counts={{ insights: 42, sources: 5, readouts: 3 }}
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('omits count badge when count is zero', () => {
    renderWithRouter(
      <DeskTabs
        {...defaultProps}
        counts={{ insights: 0, sources: 0, readouts: 0 }}
      />
    );

    // Tab labels should be present, but no numeric badges
    expect(screen.getByRole('tab', { name: /insights/i })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('omits count badge when count is undefined', () => {
    renderWithRouter(<DeskTabs {...defaultProps} counts={{}} />);

    // Tab labels should be present, but no numeric badges
    expect(screen.getByRole('tab', { name: /insights/i })).toBeInTheDocument();
    // No numeric text content should be present in the tabs
    const tablist = screen.getByRole('tablist');
    expect(tablist.textContent).not.toMatch(/\d+/);
  });

  it('navigates to correct routes based on studyPublicId', () => {
    renderWithRouter(<DeskTabs {...defaultProps} studyPublicId="test-study" />);

    const insightsTab = screen.getByRole('tab', { name: /insights/i });
    const sourcesTab = screen.getByRole('tab', { name: /sources/i });
    const readoutsTab = screen.getByRole('tab', { name: /desk readouts/i });

    expect(insightsTab).toHaveAttribute('href', '/studies/test-study/discovery/desk');
    expect(sourcesTab).toHaveAttribute('href', '/studies/test-study/discovery/desk/sources');
    expect(readoutsTab).toHaveAttribute('href', '/studies/test-study/discovery/desk/readouts');
  });

  it('has proper accessibility attributes', () => {
    renderWithRouter(<DeskTabs {...defaultProps} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-selected');
    });
  });

  it('renders without counts prop', () => {
    renderWithRouter(<DeskTabs {...defaultProps} />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
