/**
 * QoriStructuredItem — TipTap block node for objectives, questions, barriers.
 * The stable ID is an atomic attribute that cannot be edited or deleted.
 * Only the text content is editable.
 */

import { Node, mergeAttributes } from '@tiptap/core';

export const QoriStructuredItem = Node.create({
  name: 'qoriStructuredItem',
  group: 'block',
  content: 'inline*',
  defining: true,
  draggable: false,

  addAttributes() {
    return {
      stableId: { default: null },
      kind: { default: 'objective' }, // objective | question | barrier | deliverable | risk
      priority: { default: null },
      source: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-qori-item]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-qori-item': HTMLAttributes.stableId,
        'data-kind': HTMLAttributes.kind,
        class: 'qori-structured-item',
      }),
      0,
    ];
  },
});
