/**
 * ProjectDetail page tests — project context, studies list, create-study flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ProjectDetail } from './ProjectDetail';
import type { ProjectResource, StudyResource } from '@qori/api-contracts';

// Mock router params
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ projectPublicId: 'p-uuid-1' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock queries
const mockUseProject = vi.fn();
const mockUseProjectStudies = vi.fn();
vi.mock('@/api/queries/useProjects', () => ({
  useProject: () => mockUseProject(),
  useProjectStudies: () => mockUseProjectStudies(),
}));

// Mock mutation
const mockMutateAsync = vi.fn();
vi.mock('@/api/mutations/useCreateStudy', () => ({
  useCreateStudy: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const sampleProject: ProjectResource = {
  public_id: 'p-uuid-1',
  slug: 'city-services',
  name: 'City Services',
  description: 'Service request experience',
  problem_statement: 'Residents cannot track service requests',
  status: 'active',
  organization_public_id: 'o1',
  team_public_id: null,
  created_at: '2026-09-01T00:00:00.000Z',
};

const sampleStudy: StudyResource = {
  public_id: 's-uuid-1',
  name: 'Status Page Usability',
  status: 'active',
  brief_status: 'pending_approval',
  project_public_id: 'p-uuid-1',
  created_at: '2026-09-05T00:00:00.000Z',
};

describe('ProjectDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project name and problem statement', () => {
    mockUseProject.mockReturnValue({ data: sampleProject, isLoading: false, error: null });
    mockUseProjectStudies.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<ProjectDetail />);
    expect(screen.getByRole('heading', { level: 1, name: 'City Services' })).toBeInTheDocument();
    expect(screen.getByText('Residents cannot track service requests')).toBeInTheDocument();
  });

  it('shows error state on project fetch failure', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    mockUseProjectStudies.mockReturnValue({ data: undefined, isLoading: false, error: null });
    renderWithProviders(<ProjectDetail />);
    expect(screen.getByText(/Could not load project/)).toBeInTheDocument();
  });

  it('shows empty-study state with start-study action when no studies exist', () => {
    mockUseProject.mockReturnValue({ data: sampleProject, isLoading: false, error: null });
    mockUseProjectStudies.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<ProjectDetail />);
    expect(screen.getByText(/No studies yet/)).toBeInTheDocument();
    expect(screen.getByText('Start first study')).toBeInTheDocument();
  });

  it('renders existing study and does not show start-first-study', () => {
    mockUseProject.mockReturnValue({ data: sampleProject, isLoading: false, error: null });
    mockUseProjectStudies.mockReturnValue({ data: [sampleStudy], isLoading: false, error: null });
    renderWithProviders(<ProjectDetail />);
    expect(screen.getByText('Status Page Usability')).toBeInTheDocument();
    expect(screen.queryByText('Start first study')).not.toBeInTheDocument();
  });

  it('study card links to /studies/:publicId', () => {
    mockUseProject.mockReturnValue({ data: sampleProject, isLoading: false, error: null });
    mockUseProjectStudies.mockReturnValue({ data: [sampleStudy], isLoading: false, error: null });
    renderWithProviders(<ProjectDetail />);
    const studyLink = screen.getByText('Status Page Usability').closest('a');
    expect(studyLink).toHaveAttribute('href', '/studies/s-uuid-1');
  });

  it('shows loading skeleton when project is loading', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: true, error: null });
    mockUseProjectStudies.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<ProjectDetail />);
    // Should not show error or empty state
    expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No studies/)).not.toBeInTheDocument();
  });

  it('shows "New study" action button in header', () => {
    mockUseProject.mockReturnValue({ data: sampleProject, isLoading: false, error: null });
    mockUseProjectStudies.mockReturnValue({ data: [sampleStudy], isLoading: false, error: null });
    renderWithProviders(<ProjectDetail />);
    expect(screen.getByText('New study')).toBeInTheDocument();
  });

  it('renders study count badge when studies exist', () => {
    mockUseProject.mockReturnValue({ data: sampleProject, isLoading: false, error: null });
    mockUseProjectStudies.mockReturnValue({ data: [sampleStudy], isLoading: false, error: null });
    renderWithProviders(<ProjectDetail />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
