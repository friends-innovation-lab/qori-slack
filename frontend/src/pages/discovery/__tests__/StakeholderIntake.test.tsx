/**
 * DISC-3: StakeholderIntake form tests.
 *
 * Tests for:
 * - Form rendering with all fields
 * - Context line showing desk research status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { StakeholderIntake } from '../StakeholderIntake';

// Mock all the API hooks
vi.mock('@/api/queries/useStudy', () => ({
  useStudy: vi.fn(),
}));

vi.mock('@/api/queries/useDiscovery', () => ({
  useDiscoveryCounts: vi.fn(),
  useDiscoveryArtifacts: vi.fn(),
}));

vi.mock('@/api/mutations/useCreateDiscoveryRun', () => ({
  useCreateDiscoveryRun: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-123' }),
    useNavigate: () => vi.fn(),
  };
});

import { useStudy } from '@/api/queries/useStudy';
import { useDiscoveryCounts, useDiscoveryArtifacts } from '@/api/queries/useDiscovery';
import { useCreateDiscoveryRun } from '@/api/mutations/useCreateDiscoveryRun';

const mockedUseStudy = vi.mocked(useStudy);
const mockedUseDiscoveryCounts = vi.mocked(useDiscoveryCounts);
const mockedUseDiscoveryArtifacts = vi.mocked(useDiscoveryArtifacts);
const mockedUseCreateDiscoveryRun = vi.mocked(useCreateDiscoveryRun);

const mockStudy = {
  public_id: 'study-123',
  name: 'Test Study',
  project_public_id: 'proj-456',
  status: 'active',
};

function setupMocks(overrides: {
  study?: typeof mockStudy | null;
  studyLoading?: boolean;
  studyError?: Error | null;
  hasDeskResearch?: boolean;
} = {}) {
  mockedUseStudy.mockReturnValue({
    data: 'study' in overrides ? overrides.study : mockStudy,
    isLoading: overrides.studyLoading ?? false,
    error: overrides.studyError ?? null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useStudy>);

  mockedUseDiscoveryCounts.mockReturnValue({
    data: {
      desk: overrides.hasDeskResearch ? 1 : 0,
      stakeholder: 0,
      survey: 0,
      needsReview: { desk: false, stakeholder: false, survey: false },
    },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useDiscoveryCounts>);

  mockedUseDiscoveryArtifacts.mockReturnValue({
    data: overrides.hasDeskResearch
      ? [{ artifactType: 'desk_research', publicId: 'art-1', status: 'current' }]
      : [],
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useDiscoveryArtifacts>);

  const mutateAsync = vi.fn().mockResolvedValue({
    data: { publicId: 'run-new-1' },
  });

  mockedUseCreateDiscoveryRun.mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateDiscoveryRun>);

  return { mutateAsync };
}

describe('StakeholderIntake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('form rendering', () => {
    it('renders page header with Stakeholder Synthesis eyebrow', () => {
      setupMocks();
      renderWithProviders(<StakeholderIntake />);

      expect(screen.getByText('Stakeholder Synthesis')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Add stakeholder material' })).toBeInTheDocument();
    });

    it('shows description about transcripts and notes', () => {
      setupMocks();
      renderWithProviders(<StakeholderIntake />);

      expect(screen.getByText(/interview transcripts/i)).toBeInTheDocument();
    });

    it('renders topic input field', () => {
      setupMocks();
      renderWithProviders(<StakeholderIntake />);

      expect(screen.getByLabelText(/What topic are you exploring/i)).toBeInTheDocument();
    });

    it('renders source intent textarea', () => {
      setupMocks();
      renderWithProviders(<StakeholderIntake />);

      expect(screen.getByLabelText(/What do you need this source to tell you/i)).toBeInTheDocument();
    });

    it('renders "Start synthesis" button', () => {
      setupMocks();
      renderWithProviders(<StakeholderIntake />);

      expect(screen.getByRole('button', { name: 'Start synthesis' })).toBeInTheDocument();
    });
  });

  describe('desk research context line', () => {
    it('shows context line when desk research exists', () => {
      setupMocks({ hasDeskResearch: true });
      renderWithProviders(<StakeholderIntake />);

      expect(screen.getByText(/Desk research in this project is given to Qori as context/i)).toBeInTheDocument();
    });

    it('does not show context line when no desk research exists', () => {
      setupMocks({ hasDeskResearch: false });
      renderWithProviders(<StakeholderIntake />);

      expect(screen.queryByText(/Desk research in this project/i)).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error when study fails to load', () => {
      setupMocks({ studyError: new Error('Network error'), study: null });
      renderWithProviders(<StakeholderIntake />);

      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });
});
