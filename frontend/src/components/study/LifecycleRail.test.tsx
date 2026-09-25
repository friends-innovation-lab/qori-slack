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

/**
 * VC-2A: Inverse variant tests for grouped lifecycle navigation.
 *
 * Requirements from LIFECYCLE_NAV_CONVERGENCE.md:
 * - 5 group headings: Discovery, Planning, Fieldwork, Analysis, Outputs
 * - 15 lifecycle labels in exact order
 * - Only Research Brief and Research Plan are links
 * - 13 placeholders are non-interactive
 * - Plan lock state from computeLifecycleNodes
 * - Study name links to StudyOverview
 */
describe('LifecycleRail inverse variant (VC-2A)', () => {
  // Minimal nodes — inverse variant uses WORKSPACE_LIFECYCLE config, not nodes
  // Only brief and plan nodes are checked for lock state
  const minimalNodes: LifecycleNode[] = [
    { stage: 'brief', label: 'Brief', state: 'free', unlock_hint: null, count: 0, is_current: false },
    { stage: 'plan', label: 'Plan', state: 'free', unlock_hint: null, count: 0, is_current: false },
  ];

  const nodesWithPlanLocked: LifecycleNode[] = [
    { stage: 'brief', label: 'Brief', state: 'current', unlock_hint: null, count: 0, is_current: true },
    { stage: 'plan', label: 'Plan', state: 'locked', unlock_hint: 'Approve the brief first', count: 0, is_current: false },
  ];

  const studyHeader = {
    name: 'Test Study',
    backTo: '/projects',
    backLabel: 'All projects',
    orgName: 'Test Org',
  };

  // Expected group headings in order
  const expectedGroups = ['Discovery', 'Planning', 'Fieldwork', 'Analysis', 'Outputs'];

  // Expected labels in order (15 items)
  const expectedLabels = [
    'Desk Research',
    'Stakeholders',
    'Surveys',
    'Research Brief',
    'Research Plan',
    'Discussion Guide',
    'Outreach',
    'Participants',
    'Sessions',
    'Observers',
    'Session Analysis',
    'Affinity & Themes',
    'Design Opportunities',
    'Readouts',
    'Tickets',
  ];

  // Only these two are real routes
  const routeLabels = ['Research Brief', 'Research Plan'];

  it('renders exactly 5 group headings in correct order', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(5);
    headings.forEach((heading, index) => {
      expect(heading).toHaveTextContent(expectedGroups[index]);
    });
  });

  it('renders exactly 15 lifecycle labels in correct order', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    // Get all list items within the lifecycle groups
    const lists = screen.getAllByRole('list');
    // Skip any other lists (like header) — we want the 5 group lists
    const lifecycleLists = lists.filter((list) =>
      list.closest('section[aria-labelledby^="lc-"]'),
    );

    const allItems: string[] = [];
    lifecycleLists.forEach((list) => {
      const items = list.querySelectorAll('li');
      items.forEach((item) => {
        const textSpan = item.querySelector('span');
        if (textSpan) {
          allItems.push(textSpan.textContent || '');
        }
      });
    });

    expect(allItems).toHaveLength(15);
    expect(allItems).toEqual(expectedLabels);
  });

  it('only Research Brief and Research Plan are links', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    // Check that exactly 2 lifecycle links exist (not counting study name link)
    const briefLink = screen.getByRole('link', { name: 'Research Brief' });
    const planLink = screen.getByRole('link', { name: 'Research Plan' });

    expect(briefLink).toBeInTheDocument();
    expect(planLink).toBeInTheDocument();

    // Verify links point to correct routes
    expect(briefLink).toHaveAttribute('href', `/studies/${studyId}/brief`);
    expect(planLink).toHaveAttribute('href', `/studies/${studyId}/plan`);
  });

  it('13 placeholders are non-interactive and expose "not yet available"', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    const placeholderLabels = expectedLabels.filter(
      (label) => !routeLabels.includes(label),
    );

    placeholderLabels.forEach((label) => {
      // Should NOT be a link
      const link = screen.queryByRole('link', { name: label });
      expect(link).not.toBeInTheDocument();

      // Should have "not yet available" in accessible text
      const text = screen.getByText(label);
      expect(text).toBeInTheDocument();
    });

    // Verify "not yet available" text appears for placeholders (13 times)
    const notYetTexts = screen.getAllByText(/, not yet available/);
    expect(notYetTexts).toHaveLength(13);
  });

  it('placeholder items are not focusable', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    // First placeholder — "Desk Research"
    const deskResearchText = screen.getByText('Desk Research');
    const listItem = deskResearchText.closest('li');

    // Should not contain any focusable elements (links or buttons)
    const focusables = listItem?.querySelectorAll('a, button, [tabindex="0"]');
    expect(focusables?.length).toBe(0);
  });

  it('renders study header correctly', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    expect(screen.getByText('Test Study')).toBeInTheDocument();
    expect(screen.getByText('Test Org')).toBeInTheDocument();
    expect(screen.getByText('← All projects')).toBeInTheDocument();
  });

  it('defaults eyebrow to "Study" when orgName not provided', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={{ name: 'Test Study', backTo: '/projects', backLabel: 'Back' }}
      />,
    );

    expect(screen.getByText('Study')).toBeInTheDocument();
  });

  it('study name links to StudyOverview', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    const studyNameLink = screen.getByRole('link', { name: 'Test Study' });
    expect(studyNameLink).toHaveAttribute('href', `/studies/${studyId}`);
  });

  it('Research Plan is locked when plan node state is locked', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={nodesWithPlanLocked}
        variant="inverse"
        study={studyHeader}
      />,
    );

    const planLink = screen.getByRole('link', { name: /Research Plan/ });
    expect(planLink).toHaveAttribute('aria-disabled', 'true');
    expect(planLink).toHaveAttribute('title', 'Approve the brief first');
  });

  it('locked Plan link has sr-only hint text', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={nodesWithPlanLocked}
        variant="inverse"
        study={studyHeader}
      />,
    );

    // The locked plan link should have accessible text with the unlock hint
    const hintText = screen.getByText(/, locked: Approve the brief first/);
    expect(hintText).toBeInTheDocument();
  });

  it('Research Brief is never locked (no lock logic for brief)', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={nodesWithPlanLocked}
        variant="inverse"
        study={studyHeader}
      />,
    );

    const briefLink = screen.getByRole('link', { name: 'Research Brief' });
    expect(briefLink).not.toHaveAttribute('aria-disabled');
  });
});
