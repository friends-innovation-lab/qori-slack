/**
 * ReferenceNavigationGuard Integration Tests — M4B.1
 *
 * Tests the production path for cross-artifact coach reference navigation
 * with comment draft guard integration.
 *
 * Production path:
 * ReferenceLink → navigateToReference() → confirmNavigation() → navigate()
 *
 * LOCKED CONTRACT:
 * - Cross-artifact navigation prompts if dirty draft exists
 * - "Stay" cancels navigation, preserves draft and coach state
 * - "Discard and continue" clears draft, proceeds with navigation
 * - Same-artifact navigation does NOT prompt
 * - Mode switching does NOT prompt
 */

import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceNavigationWrapper } from '../WorkspaceNavigationWrapper';
import { useReferenceNavigation } from '../ReferenceNavigationProvider';
import { useCommentDraft } from '../../document/CommentDraftContext';
import type { CoachRunReferenceResource } from '@qori/api-contracts';

// ─── Test Components ──────────────────────────────────────────────────────────

/**
 * Test component that simulates Plan document with coach reference.
 * Sets up dirty draft and provides reference click action.
 */
function TestPlanDocument() {
  const { navigateToReference, pinnedRun } = useReferenceNavigation();
  const {
    initSession,
    setReplyDraft,
    getReplyDraft,
    session,
  } = useCommentDraft();

  // Initialize session on mount
  useEffect(() => {
    initSession('plan-artifact-1');
  }, [initSession]);

  const handleCrossArtifactClick = () => {
    const reference: CoachRunReferenceResource = {
      id: 'ref-1',
      item_id: 'item-1',
      object_type: 'artifact_section',
      object_id: 'BRIEF-abc123:summary',
      section_key: 'summary', // Brief section from Plan = cross-artifact
      label: 'Summary',
    };

    navigateToReference({
      reference,
      originCoachRunId: 'run-123',
      originArtifact: {
        type: 'plan',
        studyPublicId: 'study-1',
      },
      originSection: null,
      reviewedVersion: 1,
    });
  };

  const handleSameArtifactClick = () => {
    const reference: CoachRunReferenceResource = {
      id: 'ref-2',
      item_id: 'item-2',
      object_type: 'artifact_section',
      object_id: 'PLAN-abc123:plan_summary',
      section_key: 'plan_summary', // Plan section from Plan = same-artifact
      label: 'Summary',
    };

    navigateToReference({
      reference,
      originCoachRunId: 'run-123',
      originArtifact: {
        type: 'plan',
        studyPublicId: 'study-1',
      },
      originSection: null,
      reviewedVersion: 1,
    });
  };

  const handleAddDraft = () => {
    setReplyDraft('thread-1', 'Unsent draft text');
  };

  return (
    <div>
      <h1>Plan Document</h1>
      <div data-testid="artifact-id">{session?.artifactPublicId}</div>
      <div data-testid="draft-content">{getReplyDraft('thread-1')}</div>
      <div data-testid="pinned-run">{pinnedRun?.runId ?? 'none'}</div>
      <button onClick={handleAddDraft}>Add Draft</button>
      <button onClick={handleCrossArtifactClick}>Cross-Artifact Reference</button>
      <button onClick={handleSameArtifactClick}>Same-Artifact Reference</button>
      <div id="sec-plan_summary">Plan Summary Section</div>
    </div>
  );
}

function TestBriefDocument() {
  const { pinnedRun, returnToOrigin } = useReferenceNavigation();
  const { initSession, session, getReplyDraft } = useCommentDraft();

  // Initialize session on mount
  useEffect(() => {
    initSession('brief-artifact-1');
  }, [initSession]);

  return (
    <div>
      <h1>Brief Document</h1>
      <div data-testid="artifact-id">{session?.artifactPublicId}</div>
      <div data-testid="draft-content">{getReplyDraft('thread-1')}</div>
      <div data-testid="pinned-run">{pinnedRun?.runId ?? 'none'}</div>
      {pinnedRun && (
        <button onClick={returnToOrigin}>Return to Origin</button>
      )}
      <div id="sec-summary">Brief Summary Section</div>
    </div>
  );
}

function TestApp() {
  return (
    <WorkspaceNavigationWrapper>
      <Routes>
        <Route path="/studies/:studyPublicId/plan" element={<TestPlanDocument />} />
        <Route path="/studies/:studyPublicId/brief" element={<TestBriefDocument />} />
      </Routes>
    </WorkspaceNavigationWrapper>
  );
}

// ─── Test Utilities ───────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderTestApp(initialPath = '/studies/study-1/plan') {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <TestApp />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('M4B.1 Cross-Artifact Navigation Guard', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getConfirmSpy = () => vi.mocked(window.confirm);

  describe('Cross-Artifact with Dirty Draft', () => {
    it('shows confirmation when dirty draft exists', async () => {
      getConfirmSpy().mockReturnValue(false);
      const user = userEvent.setup();
      renderTestApp();

      // Wait for Plan to render
      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });

      // Add draft
      await user.click(screen.getByText('Add Draft'));
      expect(screen.getByTestId('draft-content')).toHaveTextContent('Unsent draft text');

      // Click cross-artifact reference
      await user.click(screen.getByText('Cross-Artifact Reference'));

      // Confirmation should be shown
      expect(getConfirmSpy()).toHaveBeenCalledWith(
        'You have unsaved comment text. Discard and continue?',
      );
    });

    it('Stay: cancels navigation, preserves draft, preserves coach state', async () => {
      getConfirmSpy().mockReturnValue(false); // User chooses Stay
      const user = userEvent.setup();
      renderTestApp();

      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });

      // Add draft
      await user.click(screen.getByText('Add Draft'));

      // Click cross-artifact reference
      await user.click(screen.getByText('Cross-Artifact Reference'));

      // Should still be on Plan
      expect(screen.getByText('Plan Document')).toBeInTheDocument();

      // Draft should be preserved
      expect(screen.getByTestId('draft-content')).toHaveTextContent('Unsent draft text');

      // No pinned run should be set (navigation was cancelled)
      expect(screen.getByTestId('pinned-run')).toHaveTextContent('none');

      // Artifact ID should still be plan
      expect(screen.getByTestId('artifact-id')).toHaveTextContent('plan-artifact-1');
    });

    it('Discard and continue: clears draft, navigates, preserves pinned run', async () => {
      getConfirmSpy().mockReturnValue(true); // User chooses Discard and continue
      const user = userEvent.setup();
      renderTestApp();

      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });

      // Add draft
      await user.click(screen.getByText('Add Draft'));
      expect(screen.getByTestId('draft-content')).toHaveTextContent('Unsent draft text');

      // Click cross-artifact reference
      await user.click(screen.getByText('Cross-Artifact Reference'));

      // Should navigate to Brief
      await waitFor(() => {
        expect(screen.getByText('Brief Document')).toBeInTheDocument();
      });

      // Draft should be cleared (new session for Brief)
      expect(screen.getByTestId('draft-content')).toHaveTextContent('');

      // Pinned run should be preserved
      expect(screen.getByTestId('pinned-run')).toHaveTextContent('run-123');

      // Artifact ID should be brief
      expect(screen.getByTestId('artifact-id')).toHaveTextContent('brief-artifact-1');
    });

    it('Return to origin works after cross-artifact navigation', async () => {
      getConfirmSpy().mockReturnValue(true); // User chooses Discard and continue
      const user = userEvent.setup();
      renderTestApp();

      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });

      // Add draft and navigate
      await user.click(screen.getByText('Add Draft'));
      await user.click(screen.getByText('Cross-Artifact Reference'));

      // Wait for Brief
      await waitFor(() => {
        expect(screen.getByText('Brief Document')).toBeInTheDocument();
      });

      // Return to origin
      await user.click(screen.getByText('Return to Origin'));

      // Should be back on Plan
      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });
    });
  });

  describe('Clean Cross-Artifact Navigation', () => {
    it('no confirmation when no dirty draft', async () => {
      const user = userEvent.setup();
      renderTestApp();

      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });

      // No draft added - directly click cross-artifact reference
      await user.click(screen.getByText('Cross-Artifact Reference'));

      // No confirmation should be shown
      expect(getConfirmSpy()).not.toHaveBeenCalled();

      // Should navigate to Brief
      await waitFor(() => {
        expect(screen.getByText('Brief Document')).toBeInTheDocument();
      });

      // Pinned run should be set
      expect(screen.getByTestId('pinned-run')).toHaveTextContent('run-123');
    });
  });

  describe('Same-Artifact Navigation', () => {
    it('no confirmation for same-artifact reference', async () => {
      const user = userEvent.setup();
      renderTestApp();

      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });

      // Add draft
      await user.click(screen.getByText('Add Draft'));
      expect(screen.getByTestId('draft-content')).toHaveTextContent('Unsent draft text');

      // Click same-artifact reference
      await user.click(screen.getByText('Same-Artifact Reference'));

      // No confirmation should be shown (same-artifact)
      expect(getConfirmSpy()).not.toHaveBeenCalled();

      // Should still be on Plan
      expect(screen.getByText('Plan Document')).toBeInTheDocument();

      // Draft should be preserved
      expect(screen.getByTestId('draft-content')).toHaveTextContent('Unsent draft text');
    });
  });

  describe('No Partial State on Cancel', () => {
    it('no target navigation state created when Stay is chosen', async () => {
      getConfirmSpy().mockReturnValue(false); // User chooses Stay
      const user = userEvent.setup();
      renderTestApp();

      await waitFor(() => {
        expect(screen.getByText('Plan Document')).toBeInTheDocument();
      });

      // Add draft
      await user.click(screen.getByText('Add Draft'));

      // Click cross-artifact reference
      await user.click(screen.getByText('Cross-Artifact Reference'));

      // Pinned run should NOT be set (navigation cancelled before state mutation)
      expect(screen.getByTestId('pinned-run')).toHaveTextContent('none');

      // Still on Plan
      expect(screen.getByText('Plan Document')).toBeInTheDocument();
    });
  });

  describe('M4B.2 New Thread Draft (exact live scenario)', () => {
    it('new thread draft triggers confirmation on cross-artifact nav', async () => {
      getConfirmSpy().mockReturnValue(false);
      const user = userEvent.setup();

      // Test component that uses newThreadDraft (like CreateThreadForm)
      const TestWithNewThreadDraft = () => {
        const { navigateToReference } = useReferenceNavigation();
        const { initSession, setNewThreadDraft, session } = useCommentDraft();

        useEffect(() => {
          initSession('plan-artifact-1');
        }, [initSession]);

        const handleAddDraft = () => {
          // This is exactly what CreateThreadForm does when user types
          setNewThreadDraft('some_section', 'User typed comment text');
        };

        const handleNavigate = () => {
          navigateToReference({
            reference: {
              id: 'ref-1',
              item_id: 'item-1',
              object_type: 'artifact_section',
              object_id: 'BRIEF-abc123:summary',
              section_key: 'summary', // Brief section = cross-artifact
              label: 'Summary',
            },
            originCoachRunId: 'run-123',
            originArtifact: { type: 'plan', studyPublicId: 'study-1' },
            originSection: null,
            reviewedVersion: 1,
          });
        };

        return (
          <div>
            <div data-testid="draft-body">{session?.newThreadDraft?.body ?? ''}</div>
            <button onClick={handleAddDraft}>Add New Thread Draft</button>
            <button onClick={handleNavigate}>Navigate to Brief</button>
          </div>
        );
      };

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/studies/study-1/plan']}>
            <WorkspaceNavigationWrapper>
              <Routes>
                <Route path="/studies/:studyPublicId/plan" element={<TestWithNewThreadDraft />} />
                <Route path="/studies/:studyPublicId/brief" element={<div>Brief</div>} />
              </Routes>
            </WorkspaceNavigationWrapper>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Add new thread draft (like typing in CreateThreadForm)
      await user.click(screen.getByText('Add New Thread Draft'));
      expect(screen.getByTestId('draft-body')).toHaveTextContent('User typed comment text');

      // Navigate to Brief (cross-artifact)
      await user.click(screen.getByText('Navigate to Brief'));

      // Should prompt
      expect(getConfirmSpy()).toHaveBeenCalledWith(
        'You have unsaved comment text. Discard and continue?',
      );
    });
  });

  describe('M4B.2 Section Key Classification', () => {
    // These sections should be CROSS-ARTIFACT (from Plan to Brief)
    const crossArtifactSections = [
      'summary',
      'problem_narrative',
      'method_prose',
      'participants_prose',
      'out_of_scope',
      'risks',
      'research_questions',
      'target_barriers',
    ];

    // These sections are INHERITED (exist on Plan, same-artifact)
    const inheritedSections = ['objectives', 'questions', 'timeline'];

    // Note: Plan native sections (plan_summary, plan_background, etc.) are also
    // same-artifact but start with 'plan_' so are caught by different logic path

    crossArtifactSections.forEach((sectionKey) => {
      it(`'${sectionKey}' from Plan prompts when dirty draft exists`, async () => {
        getConfirmSpy().mockReturnValue(false);
        const user = userEvent.setup();

        // Create test app with dynamic section key
        const TestWithSection = () => {
          const { navigateToReference } = useReferenceNavigation();
          const { initSession, setReplyDraft } = useCommentDraft();

          useEffect(() => {
            initSession('plan-artifact-1');
          }, [initSession]);

          const handleClick = () => {
            navigateToReference({
              reference: {
                id: 'ref-test',
                item_id: 'item-test',
                object_type: 'artifact_section',
                object_id: `BRIEF-abc123:${sectionKey}`,
                section_key: sectionKey,
                label: sectionKey,
              },
              originCoachRunId: 'run-123',
              originArtifact: { type: 'plan', studyPublicId: 'study-1' },
              originSection: null,
              reviewedVersion: 1,
            });
          };

          return (
            <div>
              <button onClick={() => setReplyDraft('t1', 'draft')}>Add Draft</button>
              <button onClick={handleClick}>Navigate</button>
            </div>
          );
        };

        const queryClient = createTestQueryClient();
        render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/studies/study-1/plan']}>
              <WorkspaceNavigationWrapper>
                <Routes>
                  <Route path="/studies/:studyPublicId/plan" element={<TestWithSection />} />
                  <Route path="/studies/:studyPublicId/brief" element={<div>Brief</div>} />
                </Routes>
              </WorkspaceNavigationWrapper>
            </MemoryRouter>
          </QueryClientProvider>,
        );

        await user.click(screen.getByText('Add Draft'));
        await user.click(screen.getByText('Navigate'));

        expect(getConfirmSpy()).toHaveBeenCalled();
      });
    });

    inheritedSections.forEach((sectionKey) => {
      it(`'${sectionKey}' from Plan does NOT prompt (inherited section)`, async () => {
        const user = userEvent.setup();

        const TestWithSection = () => {
          const { navigateToReference } = useReferenceNavigation();
          const { initSession, setReplyDraft } = useCommentDraft();

          useEffect(() => {
            initSession('plan-artifact-1');
          }, [initSession]);

          const handleClick = () => {
            navigateToReference({
              reference: {
                id: 'ref-test',
                item_id: 'item-test',
                object_type: 'artifact_section',
                object_id: `PLAN-abc123:${sectionKey}`,
                section_key: sectionKey,
                label: sectionKey,
              },
              originCoachRunId: 'run-123',
              originArtifact: { type: 'plan', studyPublicId: 'study-1' },
              originSection: null,
              reviewedVersion: 1,
            });
          };

          return (
            <div>
              <button onClick={() => setReplyDraft('t1', 'draft')}>Add Draft</button>
              <button onClick={handleClick}>Navigate</button>
              <div id={`sec-${sectionKey}`}>Section</div>
            </div>
          );
        };

        const queryClient = createTestQueryClient();
        render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/studies/study-1/plan']}>
              <WorkspaceNavigationWrapper>
                <Routes>
                  <Route path="/studies/:studyPublicId/plan" element={<TestWithSection />} />
                </Routes>
              </WorkspaceNavigationWrapper>
            </MemoryRouter>
          </QueryClientProvider>,
        );

        await user.click(screen.getByText('Add Draft'));
        await user.click(screen.getByText('Navigate'));

        // Should NOT prompt - same artifact scroll
        expect(getConfirmSpy()).not.toHaveBeenCalled();
      });
    });
  });
});
