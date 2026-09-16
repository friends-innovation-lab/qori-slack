/**
 * QoriSection — TipTap block node wrapping a document section.
 * Controls editability based on provenance.
 */

import { Node, mergeAttributes } from '@tiptap/core';

export const QoriSection = Node.create({
  name: 'qoriSection',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: false,

  addAttributes() {
    return {
      sectionId: { default: null },
      provenance: { default: 'generated' }, // canonical | generated | system | inherited
      editable: { default: true },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'section[data-qori-section]',
        getAttrs: (element) => {
          // Extract data attributes from the DOM element
          const el = element as HTMLElement;
          return {
            sectionId: el.getAttribute('data-qori-section'),
            provenance: el.getAttribute('data-provenance') || 'generated',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const isEditable = HTMLAttributes.editable !== false && HTMLAttributes.provenance !== 'system' && HTMLAttributes.provenance !== 'inherited';
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-qori-section': HTMLAttributes.sectionId,
        'data-provenance': HTMLAttributes.provenance,
        contenteditable: isEditable ? undefined : 'false',
      }),
      0,
    ];
  },
});
