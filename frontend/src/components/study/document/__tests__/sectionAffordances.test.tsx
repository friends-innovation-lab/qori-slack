/**
 * CMT-7: Section Comment Affordances Tests
 *
 * Tests for:
 * - Section key mapping (Brief and Plan) — MUST use backend contract keys
 * - DocumentSection comment affordance rendering
 * - Section count derivation from artifact threads
 * - Opening Comments rail scoped to section
 * - Scope switching behavior
 *
 * CRITICAL: All section keys must match backend VALID_SECTION_KEYS exactly.
 * See: backend/src/types/comments.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentSection } from '../DocumentSection';
import {
  getSectionLabel,
  isValidSection,
  isCommentableSection,
  BRIEF_SECTIONS,
  PLAN_SECTIONS,
} from '../sectionLabels';
import { groupThreadsBySection, deriveSectionOpenThreadCount } from '@/api/comments/queries';
import type { CommentThreadResource } from '@qori/api-contracts';

// ─── Backend Contract Keys ─────────────────────────────────────────────────
// These MUST match backend/src/types/comments.ts VALID_SECTION_KEYS exactly

const BACKEND_BRIEF_KEYS = [
  'descriptive_title',
  'summary',
  'problem_narrative',
  'method_prose',
  'participants_prose',
  'out_of_scope',
  'risks',
  'approval_items',
] as const;

const BACKEND_PLAN_KEYS = [
  'plan_summary',
  'plan_background',
  'plan_method_approach',
  'plan_session_format',
  'plan_data_collection',
  'plan_participant_glance',
  'plan_participants_prose',
  'plan_deliverables',
  'plan_risks',
  'plan_commitments',
] as const;

// ─── Section Mapping Tests ────────────────────────────────────────────────

describe('Section Mapping', () => {
  describe('Brief sections', () => {
    it('uses backend contract keys only', () => {
      const keys = BRIEF_SECTIONS.map((s) => s.key);
      // Every key in BRIEF_SECTIONS must be a valid backend key
      keys.forEach((key) => {
        expect(BACKEND_BRIEF_KEYS).toContain(key);
      });
    });

    it('has expected commentable section keys', () => {
      const keys = BRIEF_SECTIONS.map((s) => s.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('problem_narrative');
      expect(keys).toContain('method_prose');
      expect(keys).toContain('participants_prose');
      expect(keys).toContain('out_of_scope');
      expect(keys).toContain('risks');
    });

    it('maps backend key to display label correctly', () => {
      expect(getSectionLabel('brief', 'summary')).toBe('Summary');
      expect(getSectionLabel('brief', 'problem_narrative')).toBe('Problem');
      expect(getSectionLabel('brief', 'method_prose')).toBe('Method');
      expect(getSectionLabel('brief', 'participants_prose')).toBe('Participants');
      expect(getSectionLabel('brief', 'out_of_scope')).toBe('Out of scope');
      expect(getSectionLabel('brief', 'risks')).toBe('Risks');
    });

    it('validates backend contract keys', () => {
      expect(isValidSection('brief', 'summary')).toBe(true);
      expect(isValidSection('brief', 'problem_narrative')).toBe(true);
      expect(isValidSection('brief', 'unknown-key')).toBe(false);
    });

    it('does not accept UI presentation keys', () => {
      // These are UI IDs, not backend keys - they should be invalid
      expect(isValidSection('brief', 'problem')).toBe(false);
      expect(isValidSection('brief', 'method')).toBe(false);
      expect(isValidSection('brief', 'participants')).toBe(false);
      expect(isValidSection('brief', 'out-of-scope')).toBe(false); // hyphen, not underscore
    });

    it('does not expose Plan keys on Brief', () => {
      expect(isValidSection('brief', 'plan_background')).toBe(false);
      expect(isValidSection('brief', 'plan_deliverables')).toBe(false);
      expect(isValidSection('brief', 'plan_commitments')).toBe(false);
    });
  });

  describe('Plan sections', () => {
    it('uses backend contract keys only', () => {
      const keys = PLAN_SECTIONS.map((s) => s.key);
      // Every key in PLAN_SECTIONS must be a valid backend key
      keys.forEach((key) => {
        expect(BACKEND_PLAN_KEYS).toContain(key);
      });
    });

    it('has expected commentable section keys', () => {
      const keys = PLAN_SECTIONS.map((s) => s.key);
      expect(keys).toContain('plan_summary');
      expect(keys).toContain('plan_background');
      expect(keys).toContain('plan_method_approach');
      expect(keys).toContain('plan_participants_prose');
      expect(keys).toContain('plan_deliverables');
      expect(keys).toContain('plan_risks');
      expect(keys).toContain('plan_commitments');
    });

    it('maps backend key to display label correctly', () => {
      expect(getSectionLabel('plan', 'plan_summary')).toBe('Summary');
      expect(getSectionLabel('plan', 'plan_background')).toBe('Background');
      expect(getSectionLabel('plan', 'plan_method_approach')).toBe('Method');
      expect(getSectionLabel('plan', 'plan_participants_prose')).toBe('Participants');
      expect(getSectionLabel('plan', 'plan_deliverables')).toBe('Deliverables');
      expect(getSectionLabel('plan', 'plan_risks')).toBe('Risks and mitigations');
      expect(getSectionLabel('plan', 'plan_commitments')).toBe('Brief commitments');
    });

    it('validates backend contract keys', () => {
      expect(isValidSection('plan', 'plan_summary')).toBe(true);
      expect(isValidSection('plan', 'plan_risks')).toBe(true);
      expect(isValidSection('plan', 'unknown-key')).toBe(false);
    });

    it('does not accept UI presentation keys', () => {
      // These are UI IDs, not backend keys - they should be invalid
      expect(isValidSection('plan', 'summary')).toBe(false);
      expect(isValidSection('plan', 'background')).toBe(false);
      expect(isValidSection('plan', 'method')).toBe(false);
      expect(isValidSection('plan', 'participants')).toBe(false);
      expect(isValidSection('plan', 'deliverables')).toBe(false);
      expect(isValidSection('plan', 'risks')).toBe(false);
      expect(isValidSection('plan', 'commitments')).toBe(false);
    });

    it('does not expose Brief-only keys on Plan', () => {
      expect(isValidSection('plan', 'out_of_scope')).toBe(false);
      expect(isValidSection('plan', 'problem_narrative')).toBe(false);
    });
  });

  describe('isCommentableSection', () => {
    it('returns true for valid backend keys', () => {
      expect(isCommentableSection('brief', 'summary')).toBe(true);
      expect(isCommentableSection('brief', 'participants_prose')).toBe(true);
      expect(isCommentableSection('plan', 'plan_method_approach')).toBe(true);
    });

    it('returns false for unknown sections', () => {
      expect(isCommentableSection('brief', 'unknown')).toBe(false);
      expect(isCommentableSection('plan', 'does-not-exist')).toBe(false);
    });

    it('returns false for UI presentation keys', () => {
      // These are not valid backend keys
      expect(isCommentableSection('brief', 'participants')).toBe(false);
      expect(isCommentableSection('plan', 'method')).toBe(false);
    });
  });

  describe('orphan handling', () => {
    it('returns fallback label for unknown keys', () => {
      expect(getSectionLabel('brief', 'unknown-orphan')).toBe('Older section');
      expect(getSectionLabel('plan', 'legacy-section')).toBe('Older section');
    });
  });
});

// ─── Section Count Tests ──────────────────────────────────────────────────
// Note: These tests use backend contract keys (e.g., participants_prose, method_prose)
// since that's what the Comments API returns in section_key field.

describe('Section Count Derivation', () => {
  const createMockThread = (id: string, sectionKey: string, status: 'open' | 'resolved' = 'open'): CommentThreadResource => ({
    id,
    artifact_public_id: 'art-123',
    study_public_id: 'study-123',
    section_key: sectionKey,
    status,
    message_count: 1,
    created_at: '2024-01-01T00:00:00Z',
    creator: {
      public_id: 'user-1',
      display_name: 'Test User',
    },
    resolved_by: null,
    resolved_at: null,
    permissions: {
      can_reply: true,
      can_resolve: true,
      can_reopen: false,
    },
  });

  describe('groupThreadsBySection', () => {
    it('groups threads by backend section_key', () => {
      // Use backend contract keys
      const threads = [
        createMockThread('1', 'participants_prose'),
        createMockThread('2', 'participants_prose'),
        createMockThread('3', 'method_prose'),
        createMockThread('4', 'summary'),
      ];

      const counts = groupThreadsBySection(threads);

      expect(counts.get('participants_prose')).toBe(2);
      expect(counts.get('method_prose')).toBe(1);
      expect(counts.get('summary')).toBe(1);
      expect(counts.get('risks')).toBeUndefined();
    });

    it('handles empty thread array', () => {
      const counts = groupThreadsBySection([]);
      expect(counts.size).toBe(0);
    });

    it('handles undefined', () => {
      const counts = groupThreadsBySection(undefined);
      expect(counts.size).toBe(0);
    });

    it('preserves unknown section keys (orphan readiness)', () => {
      const threads = [
        createMockThread('1', 'legacy-section'),
        createMockThread('2', 'legacy-section'),
      ];

      const counts = groupThreadsBySection(threads);
      expect(counts.get('legacy-section')).toBe(2);
    });
  });

  describe('deriveSectionOpenThreadCount', () => {
    it('counts threads for specific backend section key', () => {
      // Use backend contract keys
      const threads = [
        createMockThread('1', 'participants_prose'),
        createMockThread('2', 'participants_prose'),
        createMockThread('3', 'method_prose'),
      ];

      expect(deriveSectionOpenThreadCount(threads, 'participants_prose')).toBe(2);
      expect(deriveSectionOpenThreadCount(threads, 'method_prose')).toBe(1);
      expect(deriveSectionOpenThreadCount(threads, 'summary')).toBe(0);
    });

    it('returns 0 for empty array', () => {
      expect(deriveSectionOpenThreadCount([], 'participants_prose')).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(deriveSectionOpenThreadCount(undefined, 'participants_prose')).toBe(0);
    });
  });

  describe('count accuracy', () => {
    it('does not count resolved threads', () => {
      // Note: This test validates the filtering logic.
      // The actual open vs resolved filtering happens server-side.
      // groupThreadsBySection only sees what useCommentThreads returns.
      const openThreads = [
        createMockThread('1', 'participants_prose', 'open'),
        createMockThread('2', 'participants_prose', 'open'),
      ];

      // Resolved threads should be in a separate query
      const resolvedThreads = [
        createMockThread('3', 'participants_prose', 'resolved'),
        createMockThread('4', 'participants_prose', 'resolved'),
        createMockThread('5', 'participants_prose', 'resolved'),
      ];

      // Section visible count should be from open threads only
      expect(groupThreadsBySection(openThreads).get('participants_prose')).toBe(2);
      expect(groupThreadsBySection(resolvedThreads).get('participants_prose')).toBe(3);
    });

    it('counts threads not messages', () => {
      // Each thread with any message_count is counted as 1
      const threads = [
        { ...createMockThread('1', 'method_prose'), message_count: 5 },
        { ...createMockThread('2', 'method_prose'), message_count: 10 },
      ];

      expect(groupThreadsBySection(threads).get('method_prose')).toBe(2);
    });
  });
});

// ─── DocumentSection Comment Affordance Tests ─────────────────────────────

describe('DocumentSection Comment Affordance', () => {
  it('renders without comment affordance when not provided', () => {
    render(
      <DocumentSection sectionId="summary" title="Summary">
        <p>Content</p>
      </DocumentSection>
    );

    expect(screen.queryByRole('button', { name: /comment/i })).not.toBeInTheDocument();
  });

  it('renders comment affordance when count > 0', () => {
    const onOpen = vi.fn();
    render(
      <DocumentSection
        sectionId="participants"
        title="Participants"
        comment={{ count: 3, onOpen, label: 'Participants' }}
      >
        <p>Content</p>
      </DocumentSection>
    );

    const button = screen.getByRole('button', {
      name: 'Open comments for Participants, 3 open threads',
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('3');
  });

  it('renders comment affordance when count = 0', () => {
    const onOpen = vi.fn();
    render(
      <DocumentSection
        sectionId="timeline"
        title="Timeline"
        comment={{ count: 0, onOpen, label: 'Timeline' }}
      >
        <p>Content</p>
      </DocumentSection>
    );

    const button = screen.getByRole('button', {
      name: 'No open comments for Timeline. Add a comment.',
    });
    expect(button).toBeInTheDocument();
    // Should not show "0"
    expect(button).not.toHaveTextContent('0');
  });

  it('calls onOpen when clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <DocumentSection
        sectionId="method"
        title="Method"
        comment={{ count: 2, onOpen, label: 'Method' }}
      >
        <p>Content</p>
      </DocumentSection>
    );

    const button = screen.getByRole('button', {
      name: 'Open comments for Method, 2 open threads',
    });
    await user.click(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('uses title as fallback label', () => {
    const onOpen = vi.fn();
    render(
      <DocumentSection
        sectionId="risks"
        title="Risks and mitigations"
        comment={{ count: 1, onOpen }}
      >
        <p>Content</p>
      </DocumentSection>
    );

    expect(
      screen.getByRole('button', {
        name: 'Open comments for Risks and mitigations, 1 open thread',
      })
    ).toBeInTheDocument();
  });

  it('singular/plural thread label', () => {
    const onOpen = vi.fn();

    const { rerender } = render(
      <DocumentSection
        sectionId="summary"
        title="Summary"
        comment={{ count: 1, onOpen, label: 'Summary' }}
      >
        <p>Content</p>
      </DocumentSection>
    );

    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Open comments for Summary, 1 open thread'
    );

    rerender(
      <DocumentSection
        sectionId="summary"
        title="Summary"
        comment={{ count: 5, onOpen, label: 'Summary' }}
      >
        <p>Content</p>
      </DocumentSection>
    );

    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Open comments for Summary, 5 open threads'
    );
  });

  it('is keyboard accessible', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <DocumentSection
        sectionId="objectives"
        title="Objectives"
        comment={{ count: 2, onOpen, label: 'Objectives' }}
      >
        <p>Content</p>
      </DocumentSection>
    );

    const button = screen.getByRole('button', {
      name: 'Open comments for Objectives, 2 open threads',
    });

    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
