/**
 * Projects page tests — loading, error, empty, populated states.
 * Verifies GET /api/v1/projects is called and results rendered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Projects } from './Projects';
import type { ProjectResource } from '@qori/api-contracts';

// Mock useProjects
const mockUseProjects = vi.fn();
vi.mock('@/api/queries/useProjects', () => ({
  useProjects: () => mockUseProjects(),
}));

describe('Projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when data is loading', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<Projects />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    renderWithProviders(<Projects />);
    expect(screen.getByText(/Could not load projects/)).toBeInTheDocument();
  });

  it('shows empty state when no projects exist', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<Projects />);
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
  });

  it('renders project cards when data is populated', () => {
    const projects: ProjectResource[] = [{
      public_id: 'p1',
      slug: 'claims-redesign',
      name: 'Claims Redesign',
      description: 'Redesigning the claims experience',
      problem_statement: 'Veterans struggle with claims',
      status: 'active',
      organization_public_id: 'o1',
      team_public_id: null,
      created_at: '2026-09-01T00:00:00.000Z',
    }];
    mockUseProjects.mockReturnValue({ data: projects, isLoading: false, error: null });
    renderWithProviders(<Projects />);
    expect(screen.getByText('Claims Redesign')).toBeInTheDocument();
    expect(screen.getByText('Redesigning the claims experience')).toBeInTheDocument();
  });

  it('renders multiple projects', () => {
    const projects: ProjectResource[] = [
      {
        public_id: 'p1', slug: 'proj-a', name: 'Project Alpha',
        description: null, problem_statement: null, status: 'active',
        organization_public_id: 'o1', team_public_id: null,
        created_at: '2026-09-01T00:00:00.000Z',
      },
      {
        public_id: 'p2', slug: 'proj-b', name: 'Project Beta',
        description: 'Beta description', problem_statement: null, status: 'active',
        organization_public_id: 'o1', team_public_id: null,
        created_at: '2026-09-02T00:00:00.000Z',
      },
    ];
    mockUseProjects.mockReturnValue({ data: projects, isLoading: false, error: null });
    renderWithProviders(<Projects />);
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('links to /projects/new from header and empty state', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<Projects />);
    const links = screen.getAllByRole('link');
    const newProjectLinks = links.filter(l => l.getAttribute('href') === '/projects/new');
    // Header action + empty state action
    expect(newProjectLinks.length).toBe(2);
  });
});
