/**
 * DISC-3: DeskIntake form tests.
 *
 * Tests for:
 * - Form rendering with all fields
 * - Basic form validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { DeskIntake } from '../DeskIntake';

// Mock all the API hooks
vi.mock('@/api/queries/useStudy', () => ({
  useStudy: vi.fn(),
}));

vi.mock('@/api/queries/useDiscovery', () => ({
  useDiscoveryCounts: vi.fn(),
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
import { useDiscoveryCounts } from '@/api/queries/useDiscovery';
import { useCreateDiscoveryRun } from '@/api/mutations/useCreateDiscoveryRun';

const mockedUseStudy = vi.mocked(useStudy);
const mockedUseDiscoveryCounts = vi.mocked(useDiscoveryCounts);
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
} = {}) {
  mockedUseStudy.mockReturnValue({
    data: 'study' in overrides ? overrides.study : mockStudy,
    isLoading: overrides.studyLoading ?? false,
    error: overrides.studyError ?? null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useStudy>);

  mockedUseDiscoveryCounts.mockReturnValue({
    data: {
      desk: 0,
      stakeholder: 0,
      survey: 0,
      needsReview: { desk: false, stakeholder: false, survey: false },
    },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useDiscoveryCounts>);

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

describe('DeskIntake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error state', () => {
    it('shows error when study fails to load', () => {
      setupMocks({ studyError: new Error('Network error'), study: null });
      renderWithProviders(<DeskIntake />);

      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  describe('form rendering', () => {
    it('renders page header with eyebrow', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      // "Desk Research" appears in eyebrow and nav - check for heading instead
      expect(screen.getByRole('heading', { name: 'Add documents' })).toBeInTheDocument();
    });

    it('renders topic input field', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      expect(screen.getByLabelText(/What topic are you exploring/i)).toBeInTheDocument();
    });

    it('renders source intent textarea', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      expect(screen.getByLabelText(/What do you need this source to tell you/i)).toBeInTheDocument();
    });

    it('renders file drop zone', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      expect(screen.getByText(/Drag files here or/i)).toBeInTheDocument();
      expect(screen.getByText('browse')).toBeInTheDocument();
    });

    it('renders Cancel and Start analysis buttons', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start analysis' })).toBeInTheDocument();
    });

    it('Start analysis button is disabled initially', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      expect(screen.getByRole('button', { name: 'Start analysis' })).toBeDisabled();
    });
  });

  describe('form validation', () => {
    it('requires topic to enable submit', async () => {
      const user = userEvent.setup();
      setupMocks();
      renderWithProviders(<DeskIntake />);

      // Submit button should be disabled without topic
      const submitButton = screen.getByRole('button', { name: 'Start analysis' });
      expect(submitButton).toBeDisabled();

      // Fill topic
      const topicInput = screen.getByLabelText(/What topic are you exploring/i);
      await user.type(topicInput, 'Test topic');

      // Still disabled because no files
      expect(submitButton).toBeDisabled();
    });
  });

  describe('file drop zone', () => {
    it('shows file type hints', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      expect(screen.getByText(/PDF, DOCX, DOC, TXT, MD/i)).toBeInTheDocument();
    });

    it('shows max file count', () => {
      setupMocks();
      renderWithProviders(<DeskIntake />);

      expect(screen.getByText(/Up to 10 files/i)).toBeInTheDocument();
    });
  });
});
