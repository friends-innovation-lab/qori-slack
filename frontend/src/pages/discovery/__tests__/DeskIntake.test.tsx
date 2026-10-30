/**
 * DeskIntake Component Tests — DISC-WEB-1C
 *
 * Tests for upload-only verification flow.
 * CRITICAL: Proves zero Discovery run (useCreateDiscoveryRun) calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { DeskIntake } from '../DeskIntake';

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
                expiresAt: '2024-01-01T00:00:00Z',
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
              { refToken: 'ref-1', filename: 'good.txt', mimeType: 'text/plain', sizeBytes: 100, charCount: 80, fileHash: 'a', contentHash: 'b', expiresAt: '2024-01-01T00:00:00Z' },
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
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: '2024-01-01T00:00:00Z' }],
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
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: '2024-01-01T00:00:00Z' }],
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
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: '2024-01-01T00:00:00Z' }],
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
            refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: '2024-01-01T00:00:00Z' }],
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
});
