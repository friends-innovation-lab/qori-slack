/**
 * WS-1: New Project page tests — validation, slug preview, submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { NewProject } from './NewProject';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock create project mutation
const mockMutateAsync = vi.fn();
vi.mock('@/api/mutations/useCreateProject', () => ({
  useCreateProject: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('NewProject page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with required fields', () => {
    renderWithProviders(<NewProject />);
    expect(screen.getByLabelText(/Project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/What problem are you trying to solve/i)).toBeInTheDocument();
  });

  it('shows slug preview as user types name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewProject />);

    await user.type(screen.getByLabelText(/Project name/i), 'Mobile Scheduling');
    expect(screen.getByText('mobile-scheduling')).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewProject />);

    await user.click(screen.getByRole('button', { name: /Create project/i }));

    await waitFor(() => {
      expect(screen.getByText(/Project name is required/i)).toBeInTheDocument();
    });
  });

  it('submits valid form and navigates', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({ public_id: 'proj-uuid-123' });

    renderWithProviders(<NewProject />);

    await user.type(screen.getByLabelText(/Project name/i), 'Test Project');
    await user.type(
      screen.getByLabelText(/What problem are you trying to solve/i),
      'Veterans need better scheduling',
    );
    await user.click(screen.getByRole('button', { name: /Create project/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Project',
          problem_statement: 'Veterans need better scheduling',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-uuid-123');
  });

  it('shows server error when creation fails', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue(new Error('Server error'));

    renderWithProviders(<NewProject />);

    await user.type(screen.getByLabelText(/Project name/i), 'Fail Project');
    await user.type(
      screen.getByLabelText(/What problem are you trying to solve/i),
      'Something',
    );
    await user.click(screen.getByRole('button', { name: /Create project/i }));

    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument();
    });
  });

  it('cancel button navigates home', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewProject />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
