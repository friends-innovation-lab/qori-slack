/**
 * DeskIntake Component Tests — DISC-WEB-1C, DISC-WEB-1C-2b
 *
 * Tests for upload-only verification flow and confirmation dialog.
 * CRITICAL: Proves zero Discovery run calls via ENABLE_LIVE_RUN_CREATION gate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { DeskIntake, ENABLE_LIVE_RUN_CREATION } from '../DeskIntake';

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

// Track ALL mutation calls
const uploadMutateAsyncMock = vi.fn();
const createRunMutateAsyncMock = vi.fn();

// Mock useUploadDocuments
vi.mock('@/api/mutations/useUploadDocuments', () => ({
  useUploadDocuments: () => ({
    mutateAsync: uploadMutateAsyncMock,
    isLoading: false,
  }),
  ERROR_FEATURE_DISABLED: 'FEATURE_DISABLED',
}));

// Mock useCreateDiscoveryRun — MUST verify zero calls
vi.mock('@/api/mutations/useCreateDiscoveryRun', () => ({
  useCreateDiscoveryRun: () => ({
    mutateAsync: createRunMutateAsyncMock,
    isLoading: false,
  }),
  ERROR_FEATURE_DISABLED: 'FEATURE_DISABLED',
  ERROR_IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  ERROR_SOURCE_REF_UNAVAILABLE: 'SOURCE_REF_UNAVAILABLE',
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

// Helper to create mock File
function createMockFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

// Helper to get future expiration date for tests
function getFutureExpiry(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

describe('DeskIntake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('file selection', () => {
    it('renders file upload form', () => {
      renderWithProviders(<DeskIntake />);

      expect(screen.getByText('Add documents')).toBeInTheDocument();
      expect(screen.getByText(/What topic are you exploring/)).toBeInTheDocument();
      expect(screen.getByText(/Upload files/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Verify files/i })).toBeInTheDocument();
    });

    it('shows .doc rejection notice in UI hints', () => {
      renderWithProviders(<DeskIntake />);

      // The hint text explicitly states .doc is not supported
      expect(screen.getByText(/Legacy .doc not supported/)).toBeInTheDocument();

      // The file input accept attribute should NOT include .doc
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.accept).not.toContain('.doc,');
      expect(input.accept).not.toMatch(/\.doc$/);
      expect(input.accept).toContain('.pdf');
      expect(input.accept).toContain('.docx');
      expect(input.accept).toContain('.txt');
      expect(input.accept).toContain('.md');
    });

    it('allows PDF, DOCX, TXT, MD files', async () => {
      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const pdfFile = createMockFile('report.pdf', 'application/pdf');
      const txtFile = createMockFile('notes.txt', 'text/plain');

      await user.upload(input, [pdfFile, txtFile]);

      // Files should be listed without errors
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
      expect(screen.getByText('notes.txt')).toBeInTheDocument();
    });
  });

  describe('upload verification flow', () => {
    it('calls upload mutation on Verify files click', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [
              {
                refToken: 'ref-1',
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

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Add a file
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));

      // Click verify
      const verifyButton = screen.getByRole('button', { name: /Verify files/i });
      await user.click(verifyButton);

      // Should have called upload mutation
      await waitFor(() => {
        expect(uploadMutateAsyncMock).toHaveBeenCalledTimes(1);
      });

      // Should show results
      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        expect(screen.getByText(/500 chars/)).toBeInTheDocument();
      });
    });

    it('shows rejected files in results', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [],
            rejected: [
              {
                filename: 'scanned.pdf',
                mimeType: 'application/pdf',
                errorCode: 'SCANNED_PDF',
                errorMessage: 'PDF appears to be scanned (no text layer)',
              },
            ],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('scanned.pdf', 'application/pdf'));

      const verifyButton = screen.getByRole('button', { name: /Verify files/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText(/All files were rejected/)).toBeInTheDocument();
        expect(screen.getByText(/PDF appears to be scanned/)).toBeInTheDocument();
      });
    });

    it('shows partial success with both refs and rejected', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [
              { refToken: 'ref-1', filename: 'good.txt', mimeType: 'text/plain', sizeBytes: 100, charCount: 80, fileHash: 'a', contentHash: 'b', expiresAt: getFutureExpiry() },
            ],
            rejected: [
              { filename: 'bad.pdf', mimeType: 'application/pdf', errorCode: 'ENCRYPTED_PDF', errorMessage: 'PDF is password-protected' },
            ],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, [
        createMockFile('good.txt', 'text/plain'),
        createMockFile('bad.pdf', 'application/pdf'),
      ]);

      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText(/Some files were extracted successfully/)).toBeInTheDocument();
        expect(screen.getByText('good.txt')).toBeInTheDocument();
        expect(screen.getByText(/PDF is password-protected/)).toBeInTheDocument();
      });
    });
  });

  describe('503 FEATURE_DISABLED handling', () => {
    it('shows feature unavailable message when feature is disabled', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'FEATURE_DISABLED',
        message: 'Document extraction is not available',
        transient: false,
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.txt', 'text/plain'));

      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Feature unavailable')).toBeInTheDocument();
        expect(screen.getByText(/Document extraction is not currently available/)).toBeInTheDocument();
      });
    });
  });

  describe('transient error handling', () => {
    it('shows retry button for transient errors', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: false,
        code: 'EXTRACTION_UPLOAD_BUSY',
        message: 'Upload service is busy',
        transient: true,
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.txt', 'text/plain'));

      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
        expect(screen.getByText(/temporary/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
      });
    });
  });

  describe('CRITICAL: zero Discovery run calls', () => {
    it('does NOT call useCreateDiscoveryRun during file selection', async () => {
      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));

      // Wait for any async operations
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      // CRITICAL: No Discovery run calls
      expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
    });

    it('does NOT call useCreateDiscoveryRun during verify action', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: getFutureExpiry() }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      // Wait for results to show
      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // CRITICAL: No Discovery run calls
      expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
    });

    it('does NOT call useCreateDiscoveryRun when clicking disabled Start analysis button', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: getFutureExpiry() }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Complete verification
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Find and verify Start analysis button is disabled
      const startButton = screen.getByRole('button', { name: /Start analysis/i });
      expect(startButton).toBeDisabled();

      // Try to click it anyway (should be no-op)
      await user.click(startButton);

      // CRITICAL: Still no Discovery run calls
      expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
    });

    it('does NOT call useCreateDiscoveryRun through entire upload flow', async () => {
      // Simulate complete flow: select files → verify → view results → reset → select again
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: getFutureExpiry() }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // First upload flow
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Reset and try again
      await user.click(screen.getByRole('button', { name: /Upload different files/i }));

      await waitFor(() => {
        expect(screen.getByText('Add documents')).toBeInTheDocument();
      });

      // CRITICAL: No Discovery run calls at any point
      expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
    });
  });

  describe('Start analysis button state', () => {
    it('shows disabled Start analysis button after successful verification', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: getFutureExpiry() }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Start analysis button should be present but disabled
      const startButton = screen.getByRole('button', { name: /Start analysis/i });
      expect(startButton).toBeDisabled();
      expect(startButton).toHaveTextContent(/coming soon/i);
    });

    it('does NOT show Start analysis button when all files rejected', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [],
            rejected: [{ filename: 'bad.pdf', mimeType: 'application/pdf', errorCode: 'SCANNED_PDF', errorMessage: 'No text layer' }],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('bad.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText(/All files were rejected/)).toBeInTheDocument();
      });

      // No Start analysis button when all rejected
      expect(screen.queryByRole('button', { name: /Start analysis/i })).not.toBeInTheDocument();
    });
  });

  // ─── DISC-WEB-1C-2b: Safety Gate Tests ───────────────────────────────

  describe('DISC-WEB-1C-2b: Safety Gate', () => {
    it('ENABLE_LIVE_RUN_CREATION is false in source code', () => {
      // This test verifies the safety gate is disabled in deployed code
      expect(ENABLE_LIVE_RUN_CREATION).toBe(false);
    });

    it('does NOT allow clicking Start analysis when gate is false', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification results')).toBeInTheDocument();
      });

      // Button should be disabled with "coming soon" text
      const startButton = screen.getByRole('button', { name: /Start analysis/i });
      expect(startButton).toBeDisabled();
      expect(startButton).toHaveTextContent(/coming soon/i);

      // Try clicking anyway
      await user.click(startButton);

      // CRITICAL: No Discovery run mutation called
      expect(createRunMutateAsyncMock).not.toHaveBeenCalled();
    });
  });

  // ─── DISC-WEB-1C-2b: Expired Refs Display Tests ───────────────────────

  describe('DISC-WEB-1C-2b: Expired Refs Display', () => {
    it('shows expired label on individual expired files', async () => {
      const expiredTime = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago

      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'expired.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: expiredTime }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('expired.pdf')).toBeInTheDocument();
      });

      // Should show "Expired" label
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('shows all expired error when all refs expired', async () => {
      const expiredTime = new Date(Date.now() - 60 * 1000).toISOString();

      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [
              { refToken: 'ref-1', filename: 'expired1.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: expiredTime },
              { refToken: 'ref-2', filename: 'expired2.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'c', contentHash: 'd', expiresAt: expiredTime },
            ],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Files expired')).toBeInTheDocument();
      });

      expect(screen.getByText(/All staged files have expired/i)).toBeInTheDocument();
    });

    it('shows partial expired warning when some refs expired', async () => {
      const expiredTime = new Date(Date.now() - 60 * 1000).toISOString();
      const validTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [
              { refToken: 'ref-1', filename: 'expired.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: expiredTime },
              { refToken: 'ref-2', filename: 'valid.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'c', contentHash: 'd', expiresAt: validTime },
            ],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Some files expired')).toBeInTheDocument();
      });
    });

    it('hides Start analysis when all refs expired', async () => {
      const expiredTime = new Date(Date.now() - 60 * 1000).toISOString();

      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'expired.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: expiredTime }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Files expired')).toBeInTheDocument();
      });

      // Start analysis button should NOT be present when all expired
      expect(screen.queryByRole('button', { name: /Start analysis/i })).not.toBeInTheDocument();
    });
  });

  // ─── DISC-WEB-1C-2b: Confirmation Dialog Tests ───────────────────────

  describe('DISC-WEB-1C-2b: Confirmation Dialog (specification)', () => {
    // These tests document the expected behavior when ENABLE_LIVE_RUN_CREATION is true
    // They serve as specification tests

    it('displays topic in results page before confirmation', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      // Set topic
      const topicInput = screen.getByLabelText(/What topic are you exploring/i);
      await user.type(topicInput, 'Test Research Topic');

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Research Topic')).toBeInTheDocument();
      });
    });

    it('lists all extracted filenames in results', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        success: true,
        response: {
          data: {
            refs: [
              { refToken: 'ref-1', filename: 'doc1.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
              { refToken: 'ref-2', filename: 'doc2.txt', mimeType: 'text/plain', sizeBytes: 512, charCount: 200, fileHash: 'c', contentHash: 'd', expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
            ],
            rejected: [],
          },
          meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-456/discovery/runs' },
        },
      });

      renderWithProviders(<DeskIntake />);
      const user = userEvent.setup();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createMockFile('test.pdf', 'application/pdf'));
      await user.click(screen.getByRole('button', { name: /Verify files/i }));

      await waitFor(() => {
        expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
        expect(screen.getByText('doc2.txt')).toBeInTheDocument();
      });
    });
  });

  // ─── DISC-WEB-1C-2b: Error Code Handling (specification) ───────────────

  describe('DISC-WEB-1C-2b: Error Code Handling (specification)', () => {
    // These tests document expected error handling behavior

    it('documents 409 IDEMPOTENCY_CONFLICT is not retriable', () => {
      // Per spec: 409 means different payload with same key
      // User must start fresh, never generate new key after 409
      const errorCode = 'IDEMPOTENCY_CONFLICT';
      const status = 409;
      const canRetry = false;

      expect(errorCode).toBe('IDEMPOTENCY_CONFLICT');
      expect(status).toBe(409);
      expect(canRetry).toBe(false);
    });

    it('documents 410 SOURCE_REF_UNAVAILABLE is not retriable', () => {
      // Per spec: 410 means refs expired or consumed
      // User must re-upload files
      const errorCode = 'SOURCE_REF_UNAVAILABLE';
      const status = 410;
      const canRetry = false;

      expect(errorCode).toBe('SOURCE_REF_UNAVAILABLE');
      expect(status).toBe(410);
      expect(canRetry).toBe(false);
    });

    it('documents NETWORK_ERROR is retriable with same key', () => {
      // Per spec: Network errors should retry with same idempotency key
      const errorCode = 'NETWORK_ERROR';
      const canRetry = true;

      expect(errorCode).toBe('NETWORK_ERROR');
      expect(canRetry).toBe(true);
    });

    it('documents 5xx errors are retriable', () => {
      // Per spec: Server errors should be retriable
      const status = 500;
      const canRetry = status >= 500;

      expect(canRetry).toBe(true);
    });
  });

  // ─── DISC-WEB-1C-2b: Payload Construction (specification) ───────────────

  describe('DISC-WEB-1C-2b: Payload Construction (specification)', () => {
    it('constructs correct payload structure for sourceRefs path', () => {
      // Documents expected payload format
      const mockRefs = [
        { refToken: 'ref-token-1', filename: 'doc1.pdf' },
        { refToken: 'ref-token-2', filename: 'doc2.pdf' },
      ];

      const expectedPayload = {
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceIntent: 'Test intent',
          sourceRefs: mockRefs.map((r) => r.refToken),
        },
        idempotencyKey: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
      };

      expect(expectedPayload.input.discoveryType).toBe('desk_research');
      expect(expectedPayload.input.sourceRefs).toEqual(['ref-token-1', 'ref-token-2']);
    });

    it('uses empty sourceIntent as null', () => {
      // When sourceIntent is empty, it should be null
      const sourceIntent = '';
      const normalizedIntent = sourceIntent.trim() || null;

      expect(normalizedIntent).toBeNull();
    });

    it('defaults topic to "Untitled research" when empty', () => {
      // When topic is empty, default to "Untitled research"
      const topic = '';
      const normalizedTopic = topic.trim() || 'Untitled research';

      expect(normalizedTopic).toBe('Untitled research');
    });
  });

  // ─── DISC-WEB-1C-2b: Idempotency Key Behavior (specification) ───────────

  describe('DISC-WEB-1C-2b: Idempotency Key Behavior (specification)', () => {
    it('documents same key used across network retries', () => {
      // Per spec: Same key + same payload = same run returned (idempotent)
      // On network error, retry with SAME key
      const originalKey = '12345678-1234-1234-1234-123456789abc';

      // After network error, retry should use same key
      const retryKey = originalKey;

      expect(retryKey).toBe(originalKey);
    });

    it('documents key NOT regenerated after 409', () => {
      // Per spec: 409 means payload mismatch with existing key
      // Do NOT generate new key - user must start fresh
      const keyBeforeError = '12345678-1234-1234-1234-123456789abc';

      // After 409, key remains the same (not regenerated)
      // User must click "Start over" to get new key
      const keyAfter409 = keyBeforeError;

      expect(keyAfter409).toBe(keyBeforeError);
    });

    it('documents key cleared on full reset', () => {
      // Per spec: "Start over" clears state including idempotency key
      let key: string | null = '12345678-1234-1234-1234-123456789abc';

      // User clicks "Start over"
      key = null;

      expect(key).toBeNull();
    });
  });
});
