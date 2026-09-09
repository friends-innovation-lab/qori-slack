/**
 * WS-1: Home page tests — loading, error, empty, populated states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Home } from './Home';
import type { HomeResource } from '@qori/api-contracts';

// Mock auth
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'authenticated' as const,
    me: {
      actor: { public_id: 'a1', display_name: 'Alex Rivera' },
      organization: { public_id: 'o1', slug: 'org', name: 'Org' },
      authentication_provider: 'session',
      memberships: [],
    },
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock useHome
const mockUseHome = vi.fn();
vi.mock('@/api/queries/useHome', () => ({
  useHome: () => mockUseHome(),
}));

describe('Home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when data is loading', () => {
    mockUseHome.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<Home />);
    expect(screen.getByText(/Hello, Alex/)).toBeInTheDocument();
  });

  it('shows error state on fetch failure', () => {
    mockUseHome.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    renderWithProviders(<Home />);
    expect(screen.getByText(/Could not load your home page/)).toBeInTheDocument();
  });

  it('shows empty state when no studies exist', () => {
    const emptyHome: HomeResource = {
      greeting_name: 'Alex',
      queue_preview: [],
      active_studies: [],
      recent_activity: [],
    };
    mockUseHome.mockReturnValue({ data: emptyHome, isLoading: false, error: null });
    renderWithProviders(<Home />);
    expect(screen.getByText(/No active studies/)).toBeInTheDocument();
  });

  it('shows active studies when data is populated', () => {
    const populatedHome: HomeResource = {
      greeting_name: 'Alex',
      queue_preview: [],
      active_studies: [{
        public_id: 's1',
        name: 'Claims Usability',
        project_name: 'Claims Redesign',
        project_public_id: 'p1',
        status: 'active',
        brief_status: 'approved',
        next_action: 'Create research plan',
        next_action_route: '/studies/s1/plan/new',
        updated_at: new Date().toISOString(),
      }],
      recent_activity: [],
    };
    mockUseHome.mockReturnValue({ data: populatedHome, isLoading: false, error: null });
    renderWithProviders(<Home />);
    expect(screen.getByText('Claims Usability')).toBeInTheDocument();
    expect(screen.getByText('Claims Redesign')).toBeInTheDocument();
  });

  it('shows queue preview when approvals are pending', () => {
    const homeWithQueue: HomeResource = {
      greeting_name: 'Alex',
      queue_preview: [{
        id: 'brief-approval-s2',
        kind: 'brief_approval',
        statement: 'Brief for "Login Flow" needs your approval',
        study_public_id: 's2',
        study_name: 'Login Flow',
        action_label: 'Review',
        action_route: '/studies/s2/brief',
        created_at: new Date().toISOString(),
        age_category: 'fresh',
      }],
      active_studies: [],
      recent_activity: [],
    };
    mockUseHome.mockReturnValue({ data: homeWithQueue, isLoading: false, error: null });
    renderWithProviders(<Home />);
    expect(screen.getByText(/Needs your review/)).toBeInTheDocument();
    expect(screen.getByText(/Brief for "Login Flow"/)).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('shows recent activity when events exist', () => {
    const homeWithActivity: HomeResource = {
      greeting_name: 'Alex',
      queue_preview: [],
      active_studies: [{
        public_id: 's1',
        name: 'Test Study',
        project_name: 'Test Project',
        project_public_id: 'p1',
        status: 'active',
        brief_status: null,
        next_action: 'Create brief',
        next_action_route: '/studies/s1/brief/new',
        updated_at: new Date().toISOString(),
      }],
      recent_activity: [{
        id: '1',
        description: 'approved — Claims Usability',
        study_public_id: 's1',
        study_name: 'Claims Usability',
        created_at: new Date().toISOString(),
      }],
    };
    mockUseHome.mockReturnValue({ data: homeWithActivity, isLoading: false, error: null });
    renderWithProviders(<Home />);
    expect(screen.getByText(/Recent activity/)).toBeInTheDocument();
    expect(screen.getByText(/approved — Claims Usability/)).toBeInTheDocument();
  });

  it('renders "Start research" link', () => {
    mockUseHome.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<Home />);
    const link = screen.getByText('Start research');
    expect(link.closest('a')).toHaveAttribute('href', '/projects/new');
  });
});
