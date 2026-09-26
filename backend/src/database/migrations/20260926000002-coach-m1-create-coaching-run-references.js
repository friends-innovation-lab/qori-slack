'use strict';

/**
 * Coach M1: Create coaching_run_references table.
 *
 * Stores resolved references from coaching items to Qori entities.
 * These are authoritative Qori identities — NOT model-created arbitrary IDs.
 * Run-scoped REF handles are a Milestone 2 execution concern.
 *
 * Each reference points from a coaching item to a Qori entity (objective,
 * question, barrier, finding, evidence construct, etc.).
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create coaching_run_references table
    await queryInterface.createTable('coaching_run_references', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'coaching_run_items', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent coaching item',
      },
      object_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Type of referenced object (objective, question, barrier, finding, etc.)',
      },
      object_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Stable ID of the referenced object within Qori',
      },
      section_key: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Section key if reference is section-scoped',
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Human-readable label for the reference',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 2. Index for item_id (fetch references for an item)
    await queryInterface.addIndex('coaching_run_references', ['item_id'], {
      name: 'coaching_run_references_item_id_idx',
    });

    // 3. Index for object_type + object_id (find items referencing an object)
    await queryInterface.addIndex('coaching_run_references', ['object_type', 'object_id'], {
      name: 'coaching_run_references_object_type_object_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coaching_run_references');
  },
};
