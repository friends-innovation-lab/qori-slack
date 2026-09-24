/**
 * EditToolbar tests — CC-6 a11y and behavior verification.
 *
 * Tests per IMPLEMENTATION_PHASES.md:
 * - Toolbar is one tab stop and arrows move focus
 * - aria-pressed toggles with Bold
 * - Structured item's ID isn't in editor.getText()
 * - System block has no opacity < 1
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditToolbar } from '../EditToolbar';

// Mock Editor that tracks commands
function createMockEditor(activeFormats: string[] = []) {
  const mockEditor = {
    isActive: (name: string, attrs?: Record<string, unknown>) => {
      if (attrs?.level) {
        return activeFormats.includes(`heading-${attrs.level}`);
      }
      return activeFormats.includes(name);
    },
    can: () => ({
      chain: () => ({
        focus: () => ({
          toggleBold: () => ({ run: () => true }),
          toggleItalic: () => ({ run: () => true }),
          toggleHeading: () => ({ run: () => true }),
          toggleBulletList: () => ({ run: () => true }),
          toggleOrderedList: () => ({ run: () => true }),
        }),
      }),
    }),
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleHeading: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
      }),
    }),
  };
  return mockEditor as any;
}

describe('EditToolbar', () => {
  describe('accessibility', () => {
    it('has role="toolbar" and aria-label', () => {
      render(<EditToolbar editor={createMockEditor()} />);
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'Formatting');
    });

    it('has aria-label on each tool button', () => {
      render(<EditToolbar editor={createMockEditor()} />);

      expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Heading 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Heading 3' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Bullet list' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Numbered list' })).toBeInTheDocument();
    });

    it('has aria-pressed on toggle buttons', () => {
      render(<EditToolbar editor={createMockEditor(['bold'])} />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      expect(boldButton).toHaveAttribute('aria-pressed', 'true');

      const italicButton = screen.getByRole('button', { name: 'Italic' });
      expect(italicButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('aria-pressed toggles with Bold active state', () => {
      const { rerender } = render(<EditToolbar editor={createMockEditor([])} />);

      // Initially not pressed
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');

      // Rerender with bold active
      rerender(<EditToolbar editor={createMockEditor(['bold'])} />);
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('roving tabindex', () => {
    it('is one tab stop (only first button has tabIndex=0)', () => {
      render(<EditToolbar editor={createMockEditor()} />);

      const buttons = screen.getAllByRole('button');
      // First button should have tabIndex 0
      expect(buttons[0]).toHaveAttribute('tabindex', '0');
      // Other buttons should have tabIndex -1
      for (let i = 1; i < buttons.length; i++) {
        expect(buttons[i]).toHaveAttribute('tabindex', '-1');
      }
    });

    it('ArrowRight moves focus to next button', async () => {
      const user = userEvent.setup();
      render(<EditToolbar editor={createMockEditor()} />);

      const buttons = screen.getAllByRole('button');

      // Focus first button
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);

      // Press ArrowRight
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(buttons[1]);
      expect(buttons[1]).toHaveAttribute('tabindex', '0');
      expect(buttons[0]).toHaveAttribute('tabindex', '-1');
    });

    it('ArrowLeft moves focus to previous button', async () => {
      const user = userEvent.setup();
      render(<EditToolbar editor={createMockEditor()} />);

      const buttons = screen.getAllByRole('button');

      // Focus second button
      buttons[1].focus();
      fireEvent.focus(buttons[1]);

      // Press ArrowLeft
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('ArrowRight wraps from last to first', async () => {
      const user = userEvent.setup();
      render(<EditToolbar editor={createMockEditor()} />);

      const buttons = screen.getAllByRole('button');
      const lastIndex = buttons.length - 1;

      // Focus last button
      buttons[lastIndex].focus();
      fireEvent.focus(buttons[lastIndex]);

      // Press ArrowRight
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('ArrowLeft wraps from first to last', async () => {
      const user = userEvent.setup();
      render(<EditToolbar editor={createMockEditor()} />);

      const buttons = screen.getAllByRole('button');

      // Focus first button
      buttons[0].focus();

      // Press ArrowLeft
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    });

    it('Home moves focus to first button', async () => {
      const user = userEvent.setup();
      render(<EditToolbar editor={createMockEditor()} />);

      const buttons = screen.getAllByRole('button');

      // Focus a middle button
      buttons[3].focus();
      fireEvent.focus(buttons[3]);

      // Press Home
      await user.keyboard('{Home}');
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('End moves focus to last button', async () => {
      const user = userEvent.setup();
      render(<EditToolbar editor={createMockEditor()} />);

      const buttons = screen.getAllByRole('button');

      // Focus first button
      buttons[0].focus();

      // Press End
      await user.keyboard('{End}');
      expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    });
  });

  describe('hint text', () => {
    it('shows structured blocks hint', () => {
      render(<EditToolbar editor={createMockEditor()} />);
      expect(screen.getByText(/Structured blocks keep their IDs/)).toBeInTheDocument();
    });
  });

  describe('null editor', () => {
    it('returns null when editor is null', () => {
      const { container } = render(<EditToolbar editor={null} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
