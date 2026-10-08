/**
 * NAV-1a: StudyWorkspaceLayout tests — Persistent shell verification.
 *
 * Tests the single-owner shell architecture:
 * - One LifecycleRail renders for all study routes
 * - Navigation between routes does NOT remount the rail
 * - Brief status is derived from context, not hardcoded
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudyWorkspaceLayout } from '../StudyWorkspaceLayout';
import { useStudyWorkspace } from '../StudyWorkspaceContext';

// Mock API queries
const mockUseStudy = vi.fn();
const mockUseStudyBrief = vi.fn();
const mockUseDiscoveryCounts = vi.fn();

vi.mock('@/api/queries/useStudy', () => ({
  useStudy: () => mockUseStudy(),
  useStudyBrief: () => mockUseStudyBrief(),
}));

vi.mock('@/api/queries/useDiscovery', () => ({
  useDiscoveryCounts: () => mockUseDiscoveryCounts(),
}));

// Test data
const mockStudy = {
  public_id: 'study-1',
  name: 'Test Study',
  project_public_id: 'proj-1',
  status: 'active',
  brief_status: 'approved',
};

function setupMocks(overrides: {
  study?: typeof mockStudy | null;
  studyLoading?: boolean;
  studyError?: Error | null;
  briefStatus?: string | null;
} = {}) {
  mockUseStudy.mockReturnValue({
    data: 'study' in overrides ? overrides.study : mockStudy,
    isLoading: overrides.studyLoading ?? false,
    error: overrides.studyError ?? null,
  });

  mockUseStudyBrief.mockReturnValue({
    data: {
      brief_status: overrides.briefStatus ?? 'approved',
    },
    isLoading: false,
    error: null,
  });

  mockUseDiscoveryCounts.mockReturnValue({
    data: { desk: 2, stakeholder: 1, survey: 0, needsReview: 0 },
    isLoading: false,
    error: null,
  });
}

// Child component that displays route info and provides navigation
function TestChild({ label }: { label: string }) {
  const workspace = useStudyWorkspace();
  const navigate = useNavigate();

  return (
    <div data-testid={`child-${label}`}>
      <span data-testid="study-name">{workspace.studyName}</span>
      <span data-testid="brief-status">{workspace.briefStatus}</span>
      <button onClick={() => navigate('/studies/study-1/brief')}>Go Brief</button>
      <button onClick={() => navigate('/studies/study-1/plan')}>Go Plan</button>
      <button onClick={() => navigate('/studies/study-1/discovery')}>Go Discovery</button>
    </div>
  );
}

function renderWithRouter(initialPath = '/studies/study-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="studies/:studyPublicId" element={<StudyWorkspaceLayout />}>
            <Route index element={<TestChild label="overview" />} />
            <Route path="brief" element={<TestChild label="brief" />} />
            <Route path="plan" element={<TestChild label="plan" />} />
            <Route path="discovery" element={<TestChild label="discovery" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NAV-1a: StudyWorkspaceLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Single Rail Ownership', () => {
    it('renders exactly one LifecycleRail', () => {
      setupMocks();
      renderWithRouter();

      // LifecycleRail has aria-label="Study lifecycle"
      const rails = screen.queryAllByLabelText('Study lifecycle');
      expect(rails).toHaveLength(1);
    });

    it('renders lifecycle rail at study root', () => {
      setupMocks();
      renderWithRouter('/studies/study-1');

      expect(screen.getByLabelText('Study lifecycle')).toBeInTheDocument();
      expect(screen.getByTestId('child-overview')).toBeInTheDocument();
    });

    it('renders lifecycle rail at brief route', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/brief');

      expect(screen.getByLabelText('Study lifecycle')).toBeInTheDocument();
      expect(screen.getByTestId('child-brief')).toBeInTheDocument();
    });

    it('renders lifecycle rail at plan route', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/plan');

      expect(screen.getByLabelText('Study lifecycle')).toBeInTheDocument();
      expect(screen.getByTestId('child-plan')).toBeInTheDocument();
    });

    it('renders lifecycle rail at discovery route', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/discovery');

      expect(screen.getByLabelText('Study lifecycle')).toBeInTheDocument();
      expect(screen.getByTestId('child-discovery')).toBeInTheDocument();
    });
  });

  describe('Persistent Shell (Mount Identity)', () => {
    it('lifecycle rail persists across Brief → Plan → Discovery navigation', async () => {
      setupMocks();
      renderWithRouter('/studies/study-1/brief');

      // Get rail element reference
      const initialRail = screen.getByLabelText('Study lifecycle');
      const initialRailParent = initialRail.parentElement;

      // Navigate to Plan
      await act(async () => {
        screen.getByText('Go Plan').click();
      });

      // Verify same rail element
      const planRail = screen.getByLabelText('Study lifecycle');
      expect(planRail.parentElement).toBe(initialRailParent);
      expect(screen.getByTestId('child-plan')).toBeInTheDocument();

      // Navigate to Discovery
      await act(async () => {
        screen.getByText('Go Discovery').click();
      });

      // Verify same rail element
      const discoveryRail = screen.getByLabelText('Study lifecycle');
      expect(discoveryRail.parentElement).toBe(initialRailParent);
      expect(screen.getByTestId('child-discovery')).toBeInTheDocument();

      // Still exactly one rail
      expect(screen.queryAllByLabelText('Study lifecycle')).toHaveLength(1);
    });
  });

  describe('Brief Status Derivation', () => {
    it('derives briefStatus from brief query', () => {
      setupMocks({ briefStatus: 'pending_approval' });
      renderWithRouter();

      expect(screen.getByTestId('brief-status')).toHaveTextContent('pending_approval');
    });

    it('falls back to study.brief_status when brief query is null', () => {
      mockUseStudy.mockReturnValue({
        data: { ...mockStudy, brief_status: 'approved' },
        isLoading: false,
        error: null,
      });
      mockUseStudyBrief.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });
      mockUseDiscoveryCounts.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      renderWithRouter();

      expect(screen.getByTestId('brief-status')).toHaveTextContent('approved');
    });

    it('briefStatus is null when both sources are null', () => {
      mockUseStudy.mockReturnValue({
        data: { ...mockStudy, brief_status: null },
        isLoading: false,
        error: null,
      });
      mockUseStudyBrief.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });
      mockUseDiscoveryCounts.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      renderWithRouter();

      // null renders as empty string
      expect(screen.getByTestId('brief-status')).toHaveTextContent('');
    });
  });

  describe('Context Provision', () => {
    it('provides studyPublicId to children', () => {
      setupMocks();
      renderWithRouter();

      // Child can access study name from context
      expect(screen.getByTestId('study-name')).toHaveTextContent('Test Study');
    });

    it('context updates are available across routes', async () => {
      setupMocks({ briefStatus: 'approved' });
      renderWithRouter('/studies/study-1/brief');

      expect(screen.getByTestId('brief-status')).toHaveTextContent('approved');

      // Navigate to plan
      await act(async () => {
        screen.getByText('Go Plan').click();
      });

      // Same context value available
      expect(screen.getByTestId('brief-status')).toHaveTextContent('approved');
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading skeleton while study loads', () => {
      setupMocks({ studyLoading: true });
      renderWithRouter();

      // Should not render lifecycle rail during loading
      expect(screen.queryByLabelText('Study lifecycle')).not.toBeInTheDocument();
    });

    it('shows error state when study fails to load', () => {
      setupMocks({ studyError: new Error('Network error'), study: null });
      renderWithRouter();

      // ErrorState displays the error message
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  /**
   * NAV-1a Full Lifecycle Rail Regression Tests
   *
   * These tests ensure ALL lifecycle groups render on every study route.
   * The rail must show the complete lifecycle, not be truncated.
   */
  describe('Full Lifecycle Rail (NAV-1a Regression)', () => {
    it('renders all lifecycle group headings on /brief', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/brief');

      // All 5 group headings must be present
      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Fieldwork')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Outputs')).toBeInTheDocument();
    });

    it('renders all lifecycle group headings on /plan', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/plan');

      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Fieldwork')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Outputs')).toBeInTheDocument();
    });

    it('renders all lifecycle group headings on /discovery', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/discovery');

      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Fieldwork')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Outputs')).toBeInTheDocument();
    });

    it('renders representative lifecycle items from all groups', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/brief');

      // Discovery group items (NAV-1b: renamed "All evidence" to "Overview")
      expect(screen.getByText('Overview')).toBeInTheDocument();

      // Planning group items
      expect(screen.getByText('Research Brief')).toBeInTheDocument();
      expect(screen.getByText('Research Plan')).toBeInTheDocument();

      // Fieldwork group items
      expect(screen.getByText('Outreach')).toBeInTheDocument();

      // Analysis group items
      expect(screen.getByText('Session Analysis')).toBeInTheDocument();

      // Outputs group items
      expect(screen.getByText('Design Opportunities')).toBeInTheDocument();
    });

    it('Research Brief is current on /brief route', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/brief');

      const briefLink = screen.getByRole('link', { name: /Research Brief/i });
      // NavLink adds active class via className function - check class contains nvOn
      expect(briefLink.className).toMatch(/nvOn/);
    });

    it('Research Plan is current on /plan route', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/plan');

      const planLink = screen.getByRole('link', { name: /Research Plan/i });
      expect(planLink.className).toMatch(/nvOn/);
    });

    it('Overview is current on /discovery route (NAV-1b)', () => {
      setupMocks();
      renderWithRouter('/studies/study-1/discovery');

      const discoveryLink = screen.getByRole('link', { name: /Overview/i });
      expect(discoveryLink.className).toMatch(/nvOn/);
    });

    it('exactly one LifecycleRail on all routes', async () => {
      setupMocks();

      // Check Brief route
      const { unmount: unmount1 } = renderWithRouter('/studies/study-1/brief');
      expect(screen.queryAllByLabelText('Study lifecycle')).toHaveLength(1);
      unmount1();

      // Check Plan route
      const { unmount: unmount2 } = renderWithRouter('/studies/study-1/plan');
      expect(screen.queryAllByLabelText('Study lifecycle')).toHaveLength(1);
      unmount2();

      // Check Discovery route
      renderWithRouter('/studies/study-1/discovery');
      expect(screen.queryAllByLabelText('Study lifecycle')).toHaveLength(1);
    });
  });
});
