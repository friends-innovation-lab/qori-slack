'use strict';

/**
 * Coach M1: Create coaching_run_context table.
 *
 * Records the context manifest for a coaching run — what artifacts/sections
 * the Coach "saw" when generating advice. This is a provenance record,
 * NOT a content store. The manifest records identity only; content lives
 * in the canonical artifact tables.
 *
 * context_role distinguishes primary context (the artifact being coached)
 * from supporting context (findings, evidence, personas, etc. that may
 * inform the advice in future milestones).
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create coaching_run_context table
    await queryInterface.createTable('coaching_run_context', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      run_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'coaching_runs', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent coaching run',
      },
      object_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Type of context object (artifact, finding, persona, etc.)',
      },
      object_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'ID of the context object',
      },
      object_version: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Version of the object at run time (null if unversioned)',
      },
      section_key: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Section key if context is section-scoped',
      },
      context_role: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Role in context: primary (being coached) or supporting',
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Order in context manifest (0-indexed)',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 2. Add CHECK constraint for context_role values
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_run_context
      ADD CONSTRAINT coaching_run_context_context_role_check
      CHECK (context_role IN ('primary', 'supporting'))
    `);

    // 3. Index for run_id + context_role + position (fetch context in order)
    await queryInterface.addIndex('coaching_run_context', ['run_id', 'context_role', 'position'], {
      name: 'coaching_run_context_run_id_role_position_idx',
    });

    // 4. Index for run_id alone (fetch all context for a run)
    await queryInterface.addIndex('coaching_run_context', ['run_id'], {
      name: 'coaching_run_context_run_id_idx',
    });

    // 5. Index for object_type + object_id (find runs that used an object as context)
    await queryInterface.addIndex('coaching_run_context', ['object_type', 'object_id'], {
      name: 'coaching_run_context_object_type_object_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coaching_run_context');
  },
};
