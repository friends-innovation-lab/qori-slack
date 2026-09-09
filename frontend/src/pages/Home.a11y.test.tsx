/**
 * WS-1: Home page accessibility tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { Home } from './Home';
import { axe } from 'vitest-axe';
import type { HomeResource } from '@qori/api-contracts';

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

const mockUseHome = vi.fn();
vi.mock('@/api/queries/useHome', () => ({
  useHome: () => mockUseHome(),
}));

describe('Home accessibility', () => {
  it('has no serious or critical axe violations (empty state)', async () => {
    const emptyHome: HomeResource = {
      greeting_name: 'Alex',
      queue_preview: [],
      active_studies: [],
      recent_activity: [],
    };
    mockUseHome.mockReturnValue({ data: emptyHome, isLoading: false, error: null });
    const { container } = renderWithProviders(<Home />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });

  it('has no serious or critical axe violations (populated state)', async () => {
    const populatedHome: HomeResource = {
      greeting_name: 'Alex',
      queue_preview: [{
        id: 'q1',
        kind: 'brief_approval',
        statement: 'Brief needs approval',
        study_public_id: 's1',
        study_name: 'Test',
        action_label: 'Review',
        action_route: '/studies/s1/brief',
        created_at: new Date().toISOString(),
        age_category: 'fresh',
      }],
      active_studies: [{
        public_id: 's1',
        name: 'Claims Usability',
        project_name: 'Claims Redesign',
        project_public_id: 'p1',
        status: 'active',
        brief_status: 'approved',
        next_action: 'Create plan',
        next_action_route: '/studies/s1/plan/new',
        updated_at: new Date().toISOString(),
      }],
      recent_activity: [{
        id: '1',
        description: 'Brief approved',
        study_public_id: 's1',
        study_name: 'Claims Usability',
        created_at: new Date().toISOString(),
      }],
    };
    mockUseHome.mockReturnValue({ data: populatedHome, isLoading: false, error: null });
    const { container } = renderWithProviders(<Home />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });
});
