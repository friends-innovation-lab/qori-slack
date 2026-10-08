/**
 * NAV-1c: Study Overview tests — S02 design verification.
 *
 * Tests for:
 * - Needs attention section with study-level items (neutral wording)
 * - Where this study is section with lifecycle statuses
 * - Loading and error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { StudyOverview } from './StudyOverview';
import type { DiscoveryCounts } from '@/components/study/LifecycleRail';

// Mock route params
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-123' }),
    useLocation: () => ({ pathname: '/studies/study-123' }),
  };
});

// Mock workspace context values
const mockWorkspaceContext = {
  studyPublicId: 'study-123',
  projectPublicId: 'proj-456',
  studyName: 'Test Study',
  briefStatus: null as string | null,
  lifecycleNodes: [],
  discoveryCounts: undefined as DiscoveryCounts | undefined,
  activeDiscoveryType: null,
  setActiveDiscoveryType: vi.fn(),
  navOpen: false,
  openNav: vi.fn(),
  closeNav: vi.fn(),
  toggleNav: vi.fn(),
  isLoading: false,
  error: null as Error | null,
};

vi.mock('@/components/study/workspace', async () => {
  const actual = await vi.importActual('@/components/study/workspace');
  return {
    ...actual,
    useStudyWorkspace: () => mockWorkspaceContext,
  };
});

function setWorkspaceContext(overrides: Partial<typeof mockWorkspaceContext>) {
  Object.assign(mockWorkspaceContext, overrides);
}

describe('StudyOverview page (NAV-1c S02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default values
    setWorkspaceContext({
      studyPublicId: 'study-123',
      projectPublicId: 'proj-456',
      studyName: 'Test Study',
      briefStatus: null,
      lifecycleNodes: [],
      discoveryCounts: undefined,
      isLoading: false,
      error: null,
    });
  });

  describe('loading state', () => {
    it('shows skeleton while loading', () => {
      setWorkspaceContext({ isLoading: true });
      renderWithProviders(<StudyOverview />);
      // Should render without crashing during loading
      expect(screen.getByText('Test Study')).toBeInTheDocument();
    });

    it('does not show attention items while loading', () => {
      setWorkspaceContext({ isLoading: true, briefStatus: 'pending_approval' });
      renderWithProviders(<StudyOverview />);
      // Attention section should not render during loading
      expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when study fails to load', () => {
      setWorkspaceContext({
        isLoading: false,
        error: new Error('Network error'),
      });
      renderWithProviders(<StudyOverview />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Could not load study data/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    it('does not show attention items on error', () => {
      setWorkspaceContext({
        isLoading: false,
        error: new Error('Network error'),
        briefStatus: 'pending_approval',
      });
      renderWithProviders(<StudyOverview />);
      // Attention section should not render on error
      expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('renders study name as H1', () => {
      renderWithProviders(<StudyOverview />);

      expect(screen.getByRole('heading', { name: 'Test Study' })).toBeInTheDocument();
    });

    it('renders "Study" eyebrow', () => {
      renderWithProviders(<StudyOverview />);

      expect(screen.getByText('Study')).toBeInTheDocument();
    });
  });

  describe('Needs attention section (neutral wording)', () => {
    it('does not render when no attention items', () => {
      setWorkspaceContext({
        briefStatus: 'approved',
        discoveryCounts: {
          desk: 5,
          stakeholder: 2,
          survey: 0,
          needsReview: { desk: false, stakeholder: false, survey: false },
        },
      });
      renderWithProviders(<StudyOverview />);

      expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('renders brief awaiting approval with neutral wording', () => {
      setWorkspaceContext({ briefStatus: 'pending_approval' });
      renderWithProviders(<StudyOverview />);

      expect(screen.getByText('Needs attention')).toBeInTheDocument();
      // Neutral wording - not "needs your approval"
      expect(screen.getByText('Research brief awaiting approval')).toBeInTheDocument();
      // View action - not "Review" which implies authority
      const row = screen.getByText('Research brief awaiting approval').closest('a');
      expect(row).toHaveAttribute('href', '/studies/study-123/brief');
    });

    it('renders discovery failure with neutral wording', () => {
      setWorkspaceContext({
        discoveryCounts: {
          desk: 3,
          stakeholder: 0,
          survey: 0,
          needsReview: { desk: true, stakeholder: false, survey: false },
        },
      });
      renderWithProviders(<StudyOverview />);

      expect(screen.getByText('Needs attention')).toBeInTheDocument();
      // States fact, not assignment
      expect(screen.getByText('Desk research has failed analysis')).toBeInTheDocument();
      expect(screen.getByText('May need retry or different files')).toBeInTheDocument();
    });

    it('prioritizes brief over discovery items', () => {
      setWorkspaceContext({
        briefStatus: 'pending_approval',
        discoveryCounts: {
          desk: 3,
          stakeholder: 0,
          survey: 0,
          needsReview: { desk: true, stakeholder: false, survey: false },
        },
      });
      renderWithProviders(<StudyOverview />);

      const items = screen.getAllByRole('link', { name: /→/ });
      // First item should be brief
      expect(items[0]).toHaveTextContent('Research brief awaiting approval');
    });
  });

  describe('Where this study is section', () => {
    it('renders all 5 lifecycle groups', () => {
      renderWithProviders(<StudyOverview />);

      expect(screen.getByText('Where this study is')).toBeInTheDocument();
      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Fieldwork')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Outputs')).toBeInTheDocument();
    });

    describe('Discovery status', () => {
      it('shows "No evidence yet" when no counts', () => {
        renderWithProviders(<StudyOverview />);

        expect(screen.getByText('No evidence yet')).toBeInTheDocument();
      });

      it('shows artifact count when evidence exists', () => {
        setWorkspaceContext({
          discoveryCounts: {
            desk: 3,
            stakeholder: 2,
            survey: 0,
            needsReview: { desk: false, stakeholder: false, survey: false },
          },
        });
        renderWithProviders(<StudyOverview />);

        expect(screen.getByText('5 artifacts')).toBeInTheDocument();
      });
    });

    describe('Planning status', () => {
      it('shows "Brief not started" with create action when no brief', () => {
        renderWithProviders(<StudyOverview />);

        expect(screen.getByText('Brief not started')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Create brief/ })).toHaveAttribute(
          'href',
          '/studies/study-123/brief/new'
        );
      });

      it('shows "Brief pending approval" with view action when pending', () => {
        setWorkspaceContext({ briefStatus: 'pending_approval' });
        renderWithProviders(<StudyOverview />);

        expect(screen.getByText('Brief pending approval')).toBeInTheDocument();
        // Neutral action - "View brief" not "Review brief"
        expect(screen.getByRole('link', { name: /View brief/ })).toBeInTheDocument();
      });

      it('shows "Brief approved" with create plan action when approved', () => {
        setWorkspaceContext({ briefStatus: 'approved' });
        renderWithProviders(<StudyOverview />);

        expect(screen.getByText('Brief approved')).toBeInTheDocument();
        expect(screen.getByText('Plan not started')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Create plan/ })).toHaveAttribute(
          'href',
          '/studies/study-123/plan/new'
        );
      });
    });

    describe('Unqueried groups (truthful status)', () => {
      it.each(['Fieldwork', 'Analysis', 'Outputs'])(
        '%s shows neutral status (em dash) since no query exists',
        (groupName) => {
          renderWithProviders(<StudyOverview />);

          // Find the group row and verify status is "—" not "Not started"
          const groupLabel = screen.getByText(groupName);
          const row = groupLabel.closest('[class*="lifecycleRow"]');
          expect(row).toHaveTextContent('—');
        }
      );
    });
  });
});
