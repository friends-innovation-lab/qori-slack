/**
 * CC-3: ContextRail tests — tabs, keyboard navigation, presentation modes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ClipboardCheck, MessageSquare } from 'lucide-react';
import { ContextRail, type RailMode, type RailModeId } from './ContextRail';

// Mock useMediaQuery to control presentation modes
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
  WORKSPACE_BREAKPOINTS: {
    isLgOrBelow: '(max-width: 1180px)',
    isMdOrBelow: '(max-width: 980px)',
    isSmOrBelow: '(max-width: 767px)',
  },
}));

import { useMediaQuery } from '@/hooks/useMediaQuery';
const mockUseMediaQuery = vi.mocked(useMediaQuery);

const testModes: RailMode[] = [
  {
    id: 'review',
    label: 'Review',
    count: 2,
    icon: ClipboardCheck,
    content: <div data-testid="review-content">Review content</div>,
  },
  {
    id: 'comments',
    label: 'Comments',
    count: 5,
    icon: MessageSquare,
    content: <div data-testid="comments-content">Comments content</div>,
  },
];

function renderRail(props: {
  activeMode?: RailModeId | null;
  onModeChange?: (mode: RailModeId | null) => void;
}) {
  const defaultProps = {
    modes: testModes,
    activeMode: null as RailModeId | null,
    onModeChange: vi.fn() as (mode: RailModeId | null) => void,
  };

  return render(<ContextRail {...defaultProps} {...props} />);
}

describe('ContextRail', () => {
  beforeEach(() => {
    // Reset mock completely and set default: docked (xl viewport)
    vi.resetAllMocks();
    mockUseMediaQuery.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe('collapsed state (strip)', () => {
    it('renders strip with icon buttons when closed', () => {
      renderRail({ activeMode: null });
      expect(screen.getByLabelText('Review panel')).toBeInTheDocument();
      expect(screen.getByLabelText('Comments panel')).toBeInTheDocument();
    });

    it('clicking strip button opens that mode', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: null, onModeChange });

      fireEvent.click(screen.getByLabelText('Review panel'));
      expect(onModeChange).toHaveBeenCalledWith('review');
    });
  });

  describe('open state', () => {
    it('renders tab list with active tab', () => {
      renderRail({ activeMode: 'review' });

      const reviewTab = screen.getByRole('tab', { name: /Review/ });
      expect(reviewTab).toHaveAttribute('aria-selected', 'true');

      const commentsTab = screen.getByRole('tab', { name: /Comments/ });
      expect(commentsTab).toHaveAttribute('aria-selected', 'false');
    });

    it('renders active mode content', () => {
      renderRail({ activeMode: 'review' });
      expect(screen.getByTestId('review-content')).toBeInTheDocument();
      expect(screen.queryByTestId('comments-content')).not.toBeInTheDocument();
    });

    it('shows count in tab', () => {
      renderRail({ activeMode: 'review' });
      expect(screen.getByText('2')).toBeInTheDocument(); // Review count
    });

    it('clicking another tab switches mode', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: 'review', onModeChange });

      fireEvent.click(screen.getByRole('tab', { name: /Comments/ }));
      expect(onModeChange).toHaveBeenCalledWith('comments');
    });

    it('close button closes the rail', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: 'review', onModeChange });

      fireEvent.click(screen.getByLabelText('Close panel'));
      expect(onModeChange).toHaveBeenCalledWith(null);
    });
  });

  describe('keyboard navigation', () => {
    it('arrow keys move between tabs', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: 'review', onModeChange });

      const reviewTab = screen.getByRole('tab', { name: /Review/ });
      fireEvent.keyDown(reviewTab, { key: 'ArrowRight' });

      expect(onModeChange).toHaveBeenCalledWith('comments');
    });

    it('ArrowLeft wraps to last tab', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: 'review', onModeChange });

      const reviewTab = screen.getByRole('tab', { name: /Review/ });
      fireEvent.keyDown(reviewTab, { key: 'ArrowLeft' });

      expect(onModeChange).toHaveBeenCalledWith('comments');
    });

    it('Home goes to first tab', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: 'comments', onModeChange });

      const commentsTab = screen.getByRole('tab', { name: /Comments/ });
      fireEvent.keyDown(commentsTab, { key: 'Home' });

      expect(onModeChange).toHaveBeenCalledWith('review');
    });

    it('End goes to last tab', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: 'review', onModeChange });

      const reviewTab = screen.getByRole('tab', { name: /Review/ });
      fireEvent.keyDown(reviewTab, { key: 'End' });

      expect(onModeChange).toHaveBeenCalledWith('comments');
    });
  });

  describe('overlay presentation (lg viewport, 768-1180px)', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockClear();
      // First call: isLgOrBelow = true, Second call: isSmOrBelow = false
      mockUseMediaQuery
        .mockReturnValueOnce(true) // isLgOrBelow
        .mockReturnValueOnce(false); // isSmOrBelow
    });

    it('Escape closes the overlay', () => {
      const onModeChange = vi.fn();
      renderRail({ activeMode: 'review', onModeChange });

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onModeChange).toHaveBeenCalledWith(null);
    });
  });

  describe('sheet presentation (sm viewport, ≤767px)', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockClear();
      mockUseMediaQuery
        .mockReturnValueOnce(true) // isLgOrBelow
        .mockReturnValueOnce(true); // isSmOrBelow
    });

    it('returns null when closed (no strip)', () => {
      const { container } = renderRail({ activeMode: null });
      expect(container.firstChild).toBeNull();
    });

    it('has dialog role when open', () => {
      mockUseMediaQuery
        .mockReturnValueOnce(true) // isLgOrBelow
        .mockReturnValueOnce(true); // isSmOrBelow

      renderRail({ activeMode: 'review' });

      const rail = screen.getByRole('dialog');
      expect(rail).toHaveAttribute('aria-modal', 'true');
      expect(rail).toHaveAttribute('aria-label', 'Document panel');
    });
  });

  describe('docked presentation (xl viewport, ≥1181px)', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockClear();
      // Always return false for both queries = docked presentation
      mockUseMediaQuery.mockReturnValue(false);
    });

    it('does not have dialog role', () => {
      renderRail({ activeMode: 'review' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders as aside with proper label', () => {
      renderRail({ activeMode: 'review' });
      const rail = document.getElementById('context-rail');
      expect(rail).toHaveAttribute('aria-label', 'Document panel');
      expect(rail?.tagName.toLowerCase()).toBe('aside');
    });
  });
});
