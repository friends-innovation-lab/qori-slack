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

  // Expected labels in order (17 items — DISC-3 added All evidence + Synthesis)
  const expectedLabels = [
    'All evidence',
    'Desk Research',
    'Stakeholders',
    'Surveys',
    'Synthesis',
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

  // DISC-3: These are real routes (Brief, Plan, and Discovery routes)
  const routeLabels = [
    'All evidence',
    'Desk Research',
    'Stakeholders',
    'Surveys',
    'Research Brief',
    'Research Plan',
  ];

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

  it('renders exactly 17 lifecycle labels in correct order', () => {
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

    expect(allItems).toHaveLength(17);
    expect(allItems).toEqual(expectedLabels);
  });

  it('DISC-3: Brief, Plan, and Discovery routes are links', () => {
    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
      />,
    );

    // Check that lifecycle links exist
    const briefLink = screen.getByRole('link', { name: 'Research Brief' });
    const planLink = screen.getByRole('link', { name: 'Research Plan' });
    const allEvidenceLink = screen.getByRole('link', { name: /All evidence/ });
    const deskLink = screen.getByRole('link', { name: /Desk Research/ });
    const stakeholderLink = screen.getByRole('link', { name: /Stakeholders/ });
    const surveyLink = screen.getByRole('link', { name: /Surveys/ });

    expect(briefLink).toBeInTheDocument();
    expect(planLink).toBeInTheDocument();
    expect(allEvidenceLink).toBeInTheDocument();
    expect(deskLink).toBeInTheDocument();
    expect(stakeholderLink).toBeInTheDocument();
    expect(surveyLink).toBeInTheDocument();

    // Verify links point to correct routes
    expect(briefLink).toHaveAttribute('href', `/studies/${studyId}/brief`);
    expect(planLink).toHaveAttribute('href', `/studies/${studyId}/plan`);
    expect(allEvidenceLink).toHaveAttribute('href', `/studies/${studyId}/discovery`);
    expect(deskLink).toHaveAttribute('href', `/studies/${studyId}/discovery?type=desk`);
    expect(stakeholderLink).toHaveAttribute('href', `/studies/${studyId}/discovery?type=stakeholder`);
    expect(surveyLink).toHaveAttribute('href', `/studies/${studyId}/discovery?type=survey`);
  });

  it('11 placeholders are non-interactive and expose "not yet available"', () => {
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

    // Verify "not yet available" text appears for placeholders (11 times — DISC-3: 17 total - 6 routes = 11)
    const notYetTexts = screen.getAllByText(/, not yet available/);
    expect(notYetTexts).toHaveLength(11);
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

    // DISC-3: "Synthesis" is now the first placeholder (Discovery routes are now links)
    const synthesisText = screen.getByText('Synthesis');
    const listItem = synthesisText.closest('li');

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

/**
 * DISC-3: Discovery counts exactness tests.
 *
 * The API returns { data: artifacts } with NO total metadata.
 * Backend limit: default 50, max 100.
 *
 * Exactness rule: We can only prove count is exact if returned items < requested limit.
 * If items === limit, there may be more items, so count should be null (omitted).
 *
 * Design fallback: When count exactness cannot be proven, display nothing.
 * Never display page.length as a definitive project-wide count when API may truncate.
 */
describe('LifecycleRail discovery counts exactness (DISC-3)', () => {
  const minimalNodes: LifecycleNode[] = [
    { stage: 'brief', label: 'Brief', state: 'free', unlock_hint: null, count: 0, is_current: false },
    { stage: 'plan', label: 'Plan', state: 'free', unlock_hint: null, count: 0, is_current: false },
  ];

  const studyHeader = {
    name: 'Test Study',
    backTo: '/projects',
    backLabel: 'All projects',
  };

  it('displays exact counts when exactness is proven (count < limit)', () => {
    // When useDiscoveryCounts returns exact counts (less than query limit),
    // the counts should be displayed
    const exactCounts = {
      desk: 3,
      stakeholder: 2,
      survey: 1,
      needsReview: { desk: false, stakeholder: false, survey: false },
    };

    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
        discoveryCounts={exactCounts}
      />,
    );

    // Individual type counts should be visible
    const deskLink = screen.getByRole('link', { name: /Desk Research/ });
    expect(deskLink).toHaveTextContent('3');

    const stakeholderLink = screen.getByRole('link', { name: /Stakeholders/ });
    expect(stakeholderLink).toHaveTextContent('2');

    const surveyLink = screen.getByRole('link', { name: /Surveys/ });
    expect(surveyLink).toHaveTextContent('1');

    // "All evidence" should show sum
    const allEvidenceLink = screen.getByRole('link', { name: /All evidence/ });
    expect(allEvidenceLink).toHaveTextContent('6');
  });

  it('hides zero counts (shows nothing, not "0")', () => {
    const zeroCounts = {
      desk: 0,
      stakeholder: 5,
      survey: 0,
      needsReview: { desk: false, stakeholder: false, survey: false },
    };

    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
        discoveryCounts={zeroCounts}
      />,
    );

    // Desk and Survey have 0, should not show count badge
    const deskLink = screen.getByRole('link', { name: /Desk Research/ });
    expect(deskLink.querySelector('[class*="nvCount"]')).toBeNull();

    const surveyLink = screen.getByRole('link', { name: /Surveys/ });
    expect(surveyLink.querySelector('[class*="nvCount"]')).toBeNull();

    // Stakeholder has 5, should show
    const stakeholderLink = screen.getByRole('link', { name: /Stakeholders/ });
    expect(stakeholderLink).toHaveTextContent('5');
  });

  it('omits count when exactness cannot be proven (null count)', () => {
    // When count is null (API may have truncated), don't display any count
    const truncatedCounts = {
      desk: null, // Indeterminate - might be 100+ artifacts
      stakeholder: 2,
      survey: 1,
      needsReview: { desk: false, stakeholder: false, survey: false },
    };

    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
        discoveryCounts={truncatedCounts}
      />,
    );

    // Desk count is null, should not show count badge
    const deskLink = screen.getByRole('link', { name: /Desk Research/ });
    expect(deskLink.querySelector('[class*="nvCount"]')).toBeNull();

    // Stakeholder and Survey have exact counts, should show
    const stakeholderLink = screen.getByRole('link', { name: /Stakeholders/ });
    expect(stakeholderLink).toHaveTextContent('2');

    const surveyLink = screen.getByRole('link', { name: /Surveys/ });
    expect(surveyLink).toHaveTextContent('1');
  });

  it('omits "All evidence" sum when ANY type count is null', () => {
    // If we can't prove desk count, we can't prove total either
    // Don't show a misleading partial sum
    const truncatedCounts = {
      desk: null, // Indeterminate
      stakeholder: 2,
      survey: 1,
      needsReview: { desk: false, stakeholder: false, survey: false },
    };

    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
        discoveryCounts={truncatedCounts}
      />,
    );

    // "All evidence" should NOT show any count badge when sum is indeterminate
    const allEvidenceLink = screen.getByRole('link', { name: /All evidence/ });
    expect(allEvidenceLink.querySelector('[class*="nvCount"]')).toBeNull();
  });

  it('does not show false "100" when there may be more artifacts', () => {
    // This test verifies the contract: if the API returned exactly 100 items,
    // useDiscoveryCounts should return null for that type (handled upstream).
    // Here we just verify null is handled correctly.
    const atLimitCounts = {
      desk: null, // API returned 100 desk items — count indeterminate
      stakeholder: null, // API returned 100 stakeholder items — count indeterminate
      survey: null, // API returned 100 survey items — count indeterminate
      needsReview: { desk: false, stakeholder: false, survey: false },
    };

    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
        discoveryCounts={atLimitCounts}
      />,
    );

    // None of the links should have count badges
    const allEvidenceLink = screen.getByRole('link', { name: /All evidence/ });
    const deskLink = screen.getByRole('link', { name: /Desk Research/ });
    const stakeholderLink = screen.getByRole('link', { name: /Stakeholders/ });
    const surveyLink = screen.getByRole('link', { name: /Surveys/ });

    expect(allEvidenceLink.querySelector('[class*="nvCount"]')).toBeNull();
    expect(deskLink.querySelector('[class*="nvCount"]')).toBeNull();
    expect(stakeholderLink.querySelector('[class*="nvCount"]')).toBeNull();
    expect(surveyLink.querySelector('[class*="nvCount"]')).toBeNull();
  });

  it('shows needs-review dot regardless of count exactness', () => {
    // Needs-review is a boolean signal, not affected by count truncation
    const countsWithReview = {
      desk: null, // Count unknown
      stakeholder: 2,
      survey: 0,
      needsReview: {
        desk: true, // Needs review even though count is unknown
        stakeholder: false,
        survey: true,
      },
    };

    renderWithProviders(
      <LifecycleRail
        studyPublicId={studyId}
        nodes={minimalNodes}
        variant="inverse"
        study={studyHeader}
        discoveryCounts={countsWithReview}
      />,
    );

    // Desk needs review — should have dot and sr-only text
    const deskReviewText = screen.getByRole('link', { name: /Desk Research.*needs your review/ });
    expect(deskReviewText).toBeInTheDocument();

    // Survey needs review too
    const surveyReviewText = screen.getByRole('link', { name: /Surveys.*needs your review/ });
    expect(surveyReviewText).toBeInTheDocument();

    // "All evidence" shows dot if any type needs review
    const allEvidenceReviewText = screen.getByRole('link', { name: /All evidence.*needs your review/ });
    expect(allEvidenceReviewText).toBeInTheDocument();
  });
});
