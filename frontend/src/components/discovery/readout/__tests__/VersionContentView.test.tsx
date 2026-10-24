/**
 * VersionContentView Tests — DR-6b-5e-B-2
 *
 * Unit tests for the read-only version content display component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionContentView } from '../VersionContentView';
import type { GenerationVersion, VersionContent } from '@/api/readouts';

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

function createVersion(
  overrides: Partial<GenerationVersion> = {},
): GenerationVersion {
  return {
    id: 1,
    versionNumber: 1,
    generationRequestId: 'gen-1',
    generationStatus: 'completed',
    generationStartedAt: '2026-10-20T10:00:00Z',
    generationCompletedAt: '2026-10-20T10:05:00Z',
    generationError: null,
    draftContentVersionAtStart: 1,
    evidenceSet: [
      { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
    ],
    createdAt: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

function createVersionContent(
  overrides: Partial<VersionContent> = {},
): VersionContent {
  return {
    versionId: 1,
    versionNumber: 1,
    generationStatus: 'completed',
    hasContent: true,
    content: {
      summary: { text: 'Test summary text', citations: [] },
      findings: [
        { id: 'f1', text: 'First finding', citations: [] },
      ],
      limitations: [
        { id: 'l1', text: 'First limitation' },
      ],
      implications: [
        { id: 'i1', kind: 'question', text: 'First implication', basedOnFindings: ['f1'] },
      ],
    },
    evidenceSet: [
      { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
    ],
    draftContentVersionAtStart: 1,
    generationCompletedAt: '2026-10-20T10:05:00Z',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('VersionContentView', () => {
  describe('version badge and metadata', () => {
    it('displays version number in badge', () => {
      const version = createVersion({ versionNumber: 3 });
      const content = createVersionContent({ versionNumber: 3 });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Version 3')).toBeInTheDocument();
    });

    it('displays completed status', () => {
      const version = createVersion({ generationStatus: 'completed' });
      const content = createVersionContent({ generationStatus: 'completed' });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays failed status', () => {
      const version = createVersion({ generationStatus: 'failed' });
      const content = createVersionContent({ generationStatus: 'failed', hasContent: false, content: null });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('displays timestamp', () => {
      const version = createVersion();
      const content = createVersionContent();

      render(<VersionContentView version={version} versionContent={content} />);

      // Should show relative time
      expect(screen.getByText(/ago|just now/i)).toBeInTheDocument();
    });
  });

  describe('read-only notice', () => {
    it('displays the exact required read-only notice', () => {
      const version = createVersion();
      const content = createVersionContent();

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText(/This is a read-only generated version/)).toBeInTheDocument();
      expect(screen.getByText(/Its content may differ from the current draft/)).toBeInTheDocument();
      expect(screen.getByText(/Review the current draft before continuing/)).toBeInTheDocument();
    });
  });

  describe('pinned evidence display', () => {
    it('displays evidence section with exact identifiers', () => {
      const version = createVersion({
        evidenceSet: [
          { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
          { constructPublicId: 'c2', revisionPublicId: 'r2', revisionNumber: 3, displayId: 'IN-0042' },
        ],
      });
      const content = createVersionContent();

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Pinned Evidence')).toBeInTheDocument();
      expect(screen.getByText('2 items')).toBeInTheDocument();
      expect(screen.getByText('IN-0001')).toBeInTheDocument();
      expect(screen.getByText('IN-0042')).toBeInTheDocument();
      expect(screen.getByText('r1')).toBeInTheDocument();
      expect(screen.getByText('r3')).toBeInTheDocument();
    });

    it('does not display evidence section when empty', () => {
      const version = createVersion({ evidenceSet: [] });
      const content = createVersionContent();

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.queryByText('Pinned Evidence')).not.toBeInTheDocument();
    });
  });

  describe('content sections', () => {
    it('renders summary section', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          summary: { text: 'This is the summary text' },
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('This is the summary text')).toBeInTheDocument();
    });

    it('renders findings section with items', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          findings: [
            { id: 'f1', text: 'Finding one', citations: [] },
            { id: 'f2', text: 'Finding two', citations: [] },
          ],
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Findings')).toBeInTheDocument();
      expect(screen.getByText('2 items')).toBeInTheDocument();
      expect(screen.getByText('F1')).toBeInTheDocument();
      expect(screen.getByText('F2')).toBeInTheDocument();
      expect(screen.getByText('Finding one')).toBeInTheDocument();
      expect(screen.getByText('Finding two')).toBeInTheDocument();
    });

    it('renders findings with citations', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          findings: [
            {
              id: 'f1',
              text: 'Finding with citation',
              citations: [
                { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
              ],
            },
          ],
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Citations:')).toBeInTheDocument();
      // CitationChip renders "IN-0001 r1" format
      expect(screen.getByText('IN-0001 r1')).toBeInTheDocument();
    });

    it('renders limitations section', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          limitations: [
            { id: 'l1', text: 'Limitation one' },
            { id: 'l2', text: 'Limitation two' },
          ],
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Evidence Limitations')).toBeInTheDocument();
      expect(screen.getByText('L1')).toBeInTheDocument();
      expect(screen.getByText('Limitation one')).toBeInTheDocument();
      expect(screen.getByText('L2')).toBeInTheDocument();
      expect(screen.getByText('Limitation two')).toBeInTheDocument();
    });

    it('renders implications section with kind labels', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          findings: [{ id: 'f1', text: 'Finding', citations: [] }],
          implications: [
            { id: 'i1', kind: 'question', text: 'Question implication', basedOnFindings: ['f1'] },
            { id: 'i2', kind: 'gap', text: 'Gap implication', basedOnFindings: [] },
            { id: 'i3', kind: 'priority', text: 'Priority implication', basedOnFindings: [] },
            { id: 'i4', kind: 'hypothesis', text: 'Hypothesis implication', basedOnFindings: [] },
          ],
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Implications for the Research Brief')).toBeInTheDocument();
      expect(screen.getByText('I1')).toBeInTheDocument();
      expect(screen.getByText('Question implication')).toBeInTheDocument();
      expect(screen.getByText('Research question')).toBeInTheDocument(); // KindLabel for question
      expect(screen.getByText('Knowledge gap')).toBeInTheDocument(); // KindLabel for gap
      expect(screen.getByText('Priority')).toBeInTheDocument(); // KindLabel for priority
      expect(screen.getByText('Hypothesis')).toBeInTheDocument(); // KindLabel for hypothesis
    });

    it('renders based-on finding links', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          findings: [
            { id: 'f1', text: 'Finding one', citations: [] },
            { id: 'f2', text: 'Finding two', citations: [] },
          ],
          implications: [
            { id: 'i1', kind: 'question', text: 'Implication', basedOnFindings: ['f1', 'f2'] },
          ],
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('Based on:')).toBeInTheDocument();
      // FindingLink components should render F1, F2
      const findingLinks = screen.getAllByText(/F[12]/);
      expect(findingLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('shows empty state for each section when empty', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          summary: { text: '' },
          findings: [],
          limitations: [],
          implications: [],
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText('No findings')).toBeInTheDocument();
      expect(screen.getByText('No limitations')).toBeInTheDocument();
      expect(screen.getByText('No implications')).toBeInTheDocument();
    });
  });

  describe('no content states', () => {
    it('shows pending state message', () => {
      const version = createVersion({ generationStatus: 'pending' });
      const content = createVersionContent({
        generationStatus: 'pending',
        hasContent: false,
        content: null,
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText(/has not started yet/)).toBeInTheDocument();
      expect(screen.getByText(/Content will be available once generation completes/)).toBeInTheDocument();
    });

    it('shows generating state message', () => {
      const version = createVersion({ generationStatus: 'generating' });
      const content = createVersionContent({
        generationStatus: 'generating',
        hasContent: false,
        content: null,
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText(/in progress/)).toBeInTheDocument();
    });

    it('shows failed state message', () => {
      const version = createVersion({ generationStatus: 'failed' });
      const content = createVersionContent({
        generationStatus: 'failed',
        hasContent: false,
        content: null,
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText(/failed and did not produce content/)).toBeInTheDocument();
    });

    it('shows superseded state message', () => {
      const version = createVersion({ generationStatus: 'superseded' });
      const content = createVersionContent({
        generationStatus: 'superseded',
        hasContent: false,
        content: null,
      });

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.getByText(/superseded before it completed/)).toBeInTheDocument();
    });

    it('handles null versionContent gracefully', () => {
      const version = createVersion();

      render(<VersionContentView version={version} versionContent={null} />);

      expect(screen.getByText('Version 1')).toBeInTheDocument();
      // When versionContent is null and status is completed, shows "No content is stored"
      expect(screen.getByText(/No content is stored/)).toBeInTheDocument();
    });
  });

  describe('read-only rendering', () => {
    it('does not render any edit controls', () => {
      const version = createVersion();
      const content = createVersionContent();

      render(<VersionContentView version={version} versionContent={content} />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('CitationChips are rendered in read-only mode', () => {
      const version = createVersion();
      const content = createVersionContent({
        content: {
          findings: [
            {
              id: 'f1',
              text: 'Finding',
              citations: [
                { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
              ],
            },
          ],
        },
      });

      render(<VersionContentView version={version} versionContent={content} />);

      // In read-only mode, citation chips should not have remove buttons
      expect(screen.queryByLabelText(/remove/i)).not.toBeInTheDocument();
    });
  });
});
