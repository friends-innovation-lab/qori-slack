/**
 * WS-1: New Project page accessibility tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { NewProject } from './NewProject';
import { axe } from 'vitest-axe';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/api/mutations/useCreateProject', () => ({
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('NewProject accessibility', () => {
  it('has no serious or critical axe violations', async () => {
    const { container } = renderWithProviders(<NewProject />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });
});
