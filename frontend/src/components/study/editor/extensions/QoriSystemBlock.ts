/**
 * QoriSystemBlock — TipTap atom node for read-only system content.
 * Masthead, facts grid, timeline table, approval checklist.
 * contenteditable=false — these are rendered islands, not editable.
 */

import { Node, mergeAttributes } from '@tiptap/core';

export const QoriSystemBlock = Node.create({
  name: 'qoriSystemBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      blockType: { default: 'system' },
      html: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-qori-system]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-qori-system': HTMLAttributes.blockType,
        contenteditable: 'false',
        class: 'qori-system-block',
      }),
    ];
  },
});
