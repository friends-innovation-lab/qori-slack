/**
 * DeskIntake Researcher Controlled Execution Tests — DISC-WEB-2
 *
 * Tests for the researcher-controlled execution path:
 * - Safety gate verification (flags are false by default)
 * - Successful creation and navigation
 * - Double-click / replay (idempotency)
 * - Expired sourceRefs (410)
 * - Feature disabled response (503)
 * - Active session conflict (409)
 * - Authorization denied (403)
 * - Network error handling
 *
 * Uses the centralized feature flags module (@/config/featureFlags) which
 * provides __testSetFlags() and __testResetFlags() for proper test isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { DeskIntake } from '../DeskIntake';
import {
  isLiveRunCreationEnabled,
  isResearcherControlledExecutionEnabled,
  __testSetFlags,
  __testResetFlags,
} from '@/config/featureFlags';

// ─── Module Mocks ─────────────────────────────────────────────────────

// Track ALL mutation calls
const uploadMutateAsyncMock = vi.fn();
const createRunMutateAsyncMock = vi.fn();
const createResearcherRunMutateAsyncMock = vi.fn();

// Mock the workspace context
vi.mock('@/components/study/workspace', () => ({
  WorkspaceLayout: ({ children, header }: { children: React.ReactNode; header: React.ReactNode }) => (
    <div>
      <div data-testid="workspace-header">{header}</div>
      <div data-testid="workspace-content">{children}</div>
    </div>
  ),
  useStudyWorkspace: () => ({
    studyPublicId: 'study-123',
    projectPublicId: 'proj-456',
  }),
}));

// Mock useUploadDocuments
vi.mock('@/api/mutations/useUploadDocuments', () => ({
  useUploadDocuments: () => ({
    mutateAsync: uploadMutateAsyncMock,
    isLoading: false,
  }),
  ERROR_FEATURE_DISABLED: 'FEATURE_DISABLED',
}));

// Mock useCreateDiscoveryRun
vi.mock('@/api/mutations/useCreateDiscoveryRun', () => ({
  useCreateDiscoveryRun: () => ({
    mutateAsync: createRunMutateAsyncMock,
    isLoading: false,
  }),
  ERROR_FEATURE_DISABLED: 'FEATURE_DISABLED',
  ERROR_IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  ERROR_SOURCE_REF_UNAVAILABLE: 'SOURCE_REF_UNAVAILABLE',
}));

// Mock useCreateResearcherControlledRun
vi.mock('@/api/mutations/useCreateResearcherControlledRun', () => ({
  useCreateResearcherControlledRun: () => ({
    mutateAsync: createResearcherRunMutateAsyncMock,
    isLoading: false,
  }),
  ERROR_RESEARCHER_EXECUTION_DISABLED: 'RESEARCHER_EXECUTION_DISABLED',
  ERROR_RESEARCHER_SESSION_ACTIVE: 'RESEARCHER_SESSION_ACTIVE',
  ERROR_IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  ERROR_SOURCE_REF_UNAVAILABLE: 'SOURCE_REF_UNAVAILABLE',
  ERROR_AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
}));

// Mock useNavigate
const navigateMock = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

function getFutureExpiry(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

/**
 * Click the confirm button inside the confirmation dialog.
 * Uses within() to scope to the dialog element.
 */
async function clickDialogConfirm(user: ReturnType<typeof userEvent.setup>) {
  const dialog = screen.getByRole('dialog');
  const confirmButton = within(dialog).getByRole('button', { name: /Start analysis/i });
  await user.click(confirmButton);
}

function mockSuccessfulUpload() {
  uploadMutateAsyncMock.mockResolvedValue({
    success: true,
    response: {
      data: {
        refs: [
          {
            refToken: 'ref-123',
            filename: 'test.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            charCount: 500,
            fileHash: 'abc',
            contentHash: 'def',
            expiresAt: getFutureExpiry(),
          },
        ],
        rejected: [],
      },
      meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
    },
  });
}

function mockSuccessfulResearcherRunCreation(publicId = 'run-789', isReplay = false) {
  createResearcherRunMutateAsyncMock.mockResolvedValue({
    success: true,
    response: {
      data: {
        publicId,
        status: 'pending',
        discoveryType: 'desk_research',
        topic: 'Test Topic',
        session: {
          publicId: 'session-456',
          budget: {
            maxRequests: 4,
            maxInputTokens: 40000,
            maxOutputTokens: 16384,
          },
        },
      },
      meta: {
        message: isReplay ? 'Idempotent replay' : 'Created',
        isReplay,
        isControlled: true,
        sessionType: 'researcher',
        pollUrl: `/api/v1/projects/proj-456/discovery/runs/${publicId}`,
        recommendedPollInterval: '2000ms',
      },
    },
    status: isReplay ? 200 : 201,
    isReplay,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('DeskIntake Researcher Controlled Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset flags to production defaults before each test
    __testResetFlags();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Ensure flags are reset after each test
    __testResetFlags();
  });

  // ─── Safety Gates (MUST PASS) ───────────────────────────────────────

  describe('DISC-WEB-2: Safety gates verification', () => {
    it('isResearcherControlledExecutionEnabled returns false by default', () => {
      // This verifies the production default is safe
      expect(isResearcherControlledExecutionEnabled()).toBe(false);
    });

    it('isLiveRunCreationEnabled returns false by default', () => {
      // This verifies the outer safety gate is also off
      expect(isLiveRunCreationEnabled()).toBe(false);
    });

    it('Start Analysis button shows "Coming soon" when flags are false', async () => {
      mockSuccessfulUpload();
      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Upload and verify file
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Start analysis button should be disabled with coming soon message
      const startButton = screen.getByRole('button', { name: /Start analysis/i });
      expect(startButton).toBeDisabled();
      expect(startButton).toHaveAttribute('title', 'Start analysis will be available in a future update');
    });

    it('does NOT call any run creation mutation when flags are false', async () => {
      mockSuccessfulUpload();
      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Upload and verify file
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Neither mutation should have been called
      expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
      expect(createResearcherRunMutateAsyncMock).not.toHaveBeenCalled();
    });
  });

  // ─── Functional Tests ─────────────────────────────────────────────────
  //
  // These tests verify behavior when researcher-controlled execution is enabled.
  // The feature flags module provides __testSetFlags() for proper test isolation.

  describe('DISC-WEB-2: Successful creation', () => {
    beforeEach(() => {
      // Enable researcher-controlled execution for these tests
      __testSetFlags({ researcherControlledExecution: true });
    });
    it('creates researcher-controlled run and navigates to run page', async () => {
      mockSuccessfulUpload();
      mockSuccessfulResearcherRunCreation();

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Upload and verify file
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Click Start analysis (enabled because both flags are true)
      const startButton = screen.getByRole('button', { name: /Start analysis/i });
      expect(startButton).not.toBeDisabled();
      await user.click(startButton);

      // Confirm in dialog
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      // Verify researcher mutation was called (NOT regular run mutation)
      await waitFor(() => {
        expect(createResearcherRunMutateAsyncMock).toHaveBeenCalledTimes(1);
        expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
      });

      // Verify navigation
      expect(navigateMock).toHaveBeenCalledWith('/studies/study-123/discovery/runs/run-789');
    });

    it('passes correct input to researcher-controlled mutation', async () => {
      mockSuccessfulUpload();
      mockSuccessfulResearcherRunCreation();

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Fill in topic
      const topicInput = screen.getByLabelText(/What topic are you exploring/i);
      await user.type(topicInput, 'Test Research Topic');

      // Upload and verify
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Start analysis
      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      await waitFor(() => {
        expect(createResearcherRunMutateAsyncMock).toHaveBeenCalledTimes(1);
      });

      // Verify mutation was called with correct input
      const call = createResearcherRunMutateAsyncMock.mock.calls[0][0];
      expect(call.input).toEqual({
        discoveryType: 'desk_research',
        topic: 'Test Research Topic',
        sourceIntent: null,
        sourceRefs: ['ref-123'],
      });
      expect(call.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('DISC-WEB-2: Double-click / replay', () => {
    beforeEach(() => {
      __testSetFlags({ researcherControlledExecution: true });
    });
    it('handles idempotent replay (200) correctly', async () => {
      mockSuccessfulUpload();
      mockSuccessfulResearcherRunCreation('run-existing', true);

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      // Should still navigate on replay
      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith('/studies/study-123/discovery/runs/run-existing');
      });
    });
  });

  describe('DISC-WEB-2: Error handling', () => {
    beforeEach(() => {
      __testSetFlags({ researcherControlledExecution: true });
    });
    it('handles expired sourceRefs (410)', async () => {
      mockSuccessfulUpload();
      createResearcherRunMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'SOURCE_REF_UNAVAILABLE',
        message: 'Source refs expired or consumed',
        status: 410,
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
        expect(screen.getByText(/Files have expired/)).toBeInTheDocument();
      });

      // Should NOT navigate
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('handles feature disabled (503)', async () => {
      mockSuccessfulUpload();
      createResearcherRunMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'RESEARCHER_EXECUTION_DISABLED',
        message: 'Researcher execution is not available',
        status: 503,
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      // Should show specific error message
      await waitFor(() => {
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
        expect(screen.getByText(/Researcher analysis is not currently available/)).toBeInTheDocument();
      });
    });

    it('handles active session conflict (409)', async () => {
      mockSuccessfulUpload();
      createResearcherRunMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'RESEARCHER_SESSION_ACTIVE',
        message: 'You already have an active researcher session',
        status: 409,
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      // Should show specific error message
      await waitFor(() => {
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
        expect(screen.getByText(/already have an active analysis running/)).toBeInTheDocument();
      });
    });

    it('handles authorization denied (403)', async () => {
      mockSuccessfulUpload();
      createResearcherRunMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'AUTHORIZATION_DENIED',
        message: 'Access denied: not a project member',
        status: 403,
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      // Should show specific error message
      await waitFor(() => {
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
        expect(screen.getByText(/do not have access to this project/)).toBeInTheDocument();
      });
    });

    it('handles network error with retry option', async () => {
      mockSuccessfulUpload();
      createResearcherRunMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      // Should show retry button
      await waitFor(() => {
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('DISC-WEB-2: Never falls back to unbudgeted execution', () => {
    beforeEach(() => {
      __testSetFlags({ researcherControlledExecution: true });
    });
    it('does NOT call regular createDiscoveryRun when researcher path fails', async () => {
      mockSuccessfulUpload();
      createResearcherRunMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'RESEARCHER_EXECUTION_DISABLED',
        message: 'Feature disabled',
        status: 503,
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Start analysis/i }));
      await waitFor(() => {
        expect(screen.getByText('Start AI analysis?')).toBeInTheDocument();
      });
      await clickDialogConfirm(user);

      await waitFor(() => {
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
      });

      // CRITICAL: Regular mutation was NEVER called
      expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
      // Only researcher mutation was called
      expect(createResearcherRunMutateAsyncMock).toHaveBeenCalledTimes(1);
    });
  });
});
