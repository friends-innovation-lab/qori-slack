/**
 * BriefForm tests — Structured field projection and form behavior.
 *
 * Tests that structured cascade/structured_fields are projected to
 * researcher-readable text without exposing JSON syntax or internal IDs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BriefForm } from './BriefForm';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseStudy = vi.fn();
const mockUseStudyBrief = vi.fn();
const mockSubmitBrief = vi.fn();

vi.mock('@/api/queries/useStudy', () => ({
  useStudy: () => mockUseStudy(),
  useStudyBrief: () => mockUseStudyBrief(),
}));

vi.mock('@/api/mutations/useSubmitBrief', () => ({
  useSubmitBrief: () => ({
    mutateAsync: mockSubmitBrief,
    isPending: false,
  }),
}));

// NAV-1a: Mock workspace context
vi.mock('@/components/study/workspace', async () => {
  const actual = await vi.importActual('@/components/study/workspace');
  return {
    ...actual,
    useStudyWorkspace: () => ({
      studyPublicId: 'study-1',
      projectPublicId: 'p1',
      studyName: 'Test Study',
      briefStatus: null,
      lifecycleNodes: [],
      discoveryCounts: undefined,
      navOpen: false,
      openNav: vi.fn(),
      closeNav: vi.fn(),
      toggleNav: vi.fn(),
      isLoading: false,
      error: null,
    }),
  };
});

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockStudy = {
  public_id: 'study-1',
  name: 'Test Study',
  project_public_id: 'proj-1',
  status: 'active',
};

function makeExistingBrief(overrides: Record<string, unknown> = {}) {
  return {
    study: mockStudy,
    brief_status: 'changes_requested',
    brief_change_feedback: 'Please revise the methodology.',
    cascade_fields: {
      research_objectives: JSON.stringify([
        { id: 'OBJ-001', objective: 'Understand how residents interpret appointment reminders' },
        { id: 'OBJ-002', objective: 'Identify barriers to scheduling compliance' },
      ]),
      research_questions: JSON.stringify([
        { id: 'RQ-001', question: 'What mental models do users have?', priority: 'Primary' },
        { id: 'RQ-002', question: 'How do users recover from errors?', priority: 'Secondary' },
      ]),
      methodology_selection: 'usability_testing',
      participant_approach: '8 Veterans',
      start_date: '2026-11-01',
      budget: '$800',
    },
    structured_fields: {
      research_objectives: [
        { id: 'OBJ-001', objective: 'Understand how residents interpret appointment reminders' },
        { id: 'OBJ-002', objective: 'Identify barriers to scheduling compliance' },
      ],
      research_questions: [
        { id: 'RQ-001', question: 'What mental models do users have?', priority: 'Primary' },
        { id: 'RQ-002', question: 'How do users recover from errors?', priority: 'Secondary' },
      ],
    },
    ...overrides,
  };
}

// ─── Render Helper ───────────────────────────────────────────────────────────

function renderBriefForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/studies/study-1/brief/new']}>
        <Routes>
          <Route path="studies/:studyPublicId/brief/new" element={<BriefForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BriefForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStudy.mockReturnValue({
      data: mockStudy,
      isLoading: false,
      error: null,
    });
  });

  describe('New Brief (no existing brief)', () => {
    it('renders empty problem statement field', () => {
      mockUseStudyBrief.mockReturnValue({ data: null, isLoading: false });
      renderBriefForm();

      const problemField = screen.getByLabelText(/What problem are you solving/i);
      expect(problemField).toHaveValue('');
    });

    it('renders empty learning objectives field', () => {
      mockUseStudyBrief.mockReturnValue({ data: null, isLoading: false });
      renderBriefForm();

      const objectivesField = screen.getByLabelText(/What will this research answer/i);
      expect(objectivesField).toHaveValue('');
    });
  });

  describe('Revision Brief (existing brief with changes_requested)', () => {
    it('renders structured objectives as numbered list WITHOUT JSON syntax', () => {
      mockUseStudyBrief.mockReturnValue({
        data: makeExistingBrief(),
        isLoading: false,
      });
      renderBriefForm();

      const problemField = screen.getByLabelText(/What problem are you solving/i);
      const value = problemField.getAttribute('value') || (problemField as HTMLTextAreaElement).value;

      // Should contain readable text
      expect(value).toContain('Understand how residents interpret');
      expect(value).toContain('Identify barriers to scheduling');

      // Should NOT contain JSON syntax or IDs
      expect(value).not.toContain('[{');
      expect(value).not.toContain('"id":');
      expect(value).not.toContain('OBJ-001');
      expect(value).not.toContain('OBJ-002');
    });

    it('renders structured questions as numbered list WITHOUT JSON syntax', () => {
      mockUseStudyBrief.mockReturnValue({
        data: makeExistingBrief(),
        isLoading: false,
      });
      renderBriefForm();

      const objectivesField = screen.getByLabelText(/What will this research answer/i);
      const value = objectivesField.getAttribute('value') || (objectivesField as HTMLTextAreaElement).value;

      // Should contain readable text
      expect(value).toContain('What mental models do users have');
      expect(value).toContain('How do users recover from errors');

      // Should NOT contain JSON syntax or IDs
      expect(value).not.toContain('[{');
      expect(value).not.toContain('"id":');
      expect(value).not.toContain('RQ-001');
      expect(value).not.toContain('RQ-002');
    });

    it('preserves item ordering in numbered list', () => {
      mockUseStudyBrief.mockReturnValue({
        data: makeExistingBrief(),
        isLoading: false,
      });
      renderBriefForm();

      const problemField = screen.getByLabelText(/What problem are you solving/i);
      const value = (problemField as HTMLTextAreaElement).value;

      // First item should come before second
      const pos1 = value.indexOf('Understand how residents');
      const pos2 = value.indexOf('Identify barriers');
      expect(pos1).toBeLessThan(pos2);
    });

    it('shows revision feedback alert', () => {
      mockUseStudyBrief.mockReturnValue({
        data: makeExistingBrief(),
        isLoading: false,
      });
      renderBriefForm();

      expect(screen.getByText(/Please revise the methodology/i)).toBeInTheDocument();
    });
  });

  describe('Fallback: cascade_fields without structured_fields', () => {
    it('parses cascade JSON and projects to readable text', () => {
      mockUseStudyBrief.mockReturnValue({
        data: makeExistingBrief({
          structured_fields: null, // No pre-parsed fields
        }),
        isLoading: false,
      });
      renderBriefForm();

      const problemField = screen.getByLabelText(/What problem are you solving/i);
      const value = (problemField as HTMLTextAreaElement).value;

      // Should still be readable (parsed from cascade_fields)
      expect(value).toContain('Understand how residents');
      expect(value).not.toContain('[{');
      expect(value).not.toContain('OBJ-');
    });
  });

  describe('Plain prose cascade values', () => {
    it('preserves plain prose (non-JSON) as-is', () => {
      mockUseStudyBrief.mockReturnValue({
        data: makeExistingBrief({
          cascade_fields: {
            research_objectives: 'We want to understand user needs.',
            research_questions: 'How do users complete tasks?',
            methodology_selection: 'usability_testing',
          },
          structured_fields: null,
        }),
        isLoading: false,
      });
      renderBriefForm();

      const problemField = screen.getByLabelText(/What problem are you solving/i);
      expect((problemField as HTMLTextAreaElement).value).toBe('We want to understand user needs.');

      const objectivesField = screen.getByLabelText(/What will this research answer/i);
      expect((objectivesField as HTMLTextAreaElement).value).toBe('How do users complete tasks?');
    });
  });

  describe('Malformed JSON handling', () => {
    it('handles malformed JSON gracefully (returns empty)', () => {
      mockUseStudyBrief.mockReturnValue({
        data: makeExistingBrief({
          cascade_fields: {
            research_objectives: '[{"broken json',
            methodology_selection: 'usability_testing',
          },
          structured_fields: null,
        }),
        isLoading: false,
      });
      renderBriefForm();

      const problemField = screen.getByLabelText(/What problem are you solving/i);
      // Should be empty, not show broken JSON
      expect((problemField as HTMLTextAreaElement).value).toBe('');
    });
  });

  describe('Form layout unchanged', () => {
    it('renders all form sections', () => {
      mockUseStudyBrief.mockReturnValue({ data: null, isLoading: false });
      renderBriefForm();

      // Check for fieldset legends specifically
      const legends = screen.getAllByRole('group');
      const legendTexts = legends.map((g) => g.querySelector('legend')?.textContent);
      expect(legendTexts).toContain('Research Focus');
      expect(legendTexts).toContain('Method');
      expect(legendTexts).toContain('Participants');
      expect(legendTexts).toContain('Timeline & Budget');
    });

    it('renders Generate brief button', () => {
      mockUseStudyBrief.mockReturnValue({ data: null, isLoading: false });
      renderBriefForm();

      expect(screen.getByRole('button', { name: /Generate brief/i })).toBeInTheDocument();
    });
  });
});

describe('useSubmitBrief route contract', () => {
  it('exports useSubmitBrief as a callable function', async () => {
    const useSubmitBriefModule = await import('../api/mutations/useSubmitBrief');
    expect(typeof useSubmitBriefModule.useSubmitBrief).toBe('function');
    // Note: function.length is unreliable with default params; just verify export exists
  });
});
