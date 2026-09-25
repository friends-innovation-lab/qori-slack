'use strict';

/**
 * CMT-1: Create comment_thread_events table for Workspace Comments.
 *
 * Events are append-only audit trail for thread lifecycle:
 * - created: Thread was created (with initial message)
 * - resolved: Thread was resolved
 * - reopened: Thread was reopened after resolution
 *
 * Historical resolution events are preserved when a thread is reopened.
 * The current resolution state lives on comment_threads (resolved_by, resolved_at),
 * while the full history lives here.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create comment_thread_events table
    await queryInterface.createTable('comment_thread_events', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      thread_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'comment_threads', key: 'id' },
        onDelete: 'CASCADE',
      },
      event_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Event type: created, resolved, or reopened',
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Actor who performed the action',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 2. Add CHECK constraint for event_type values
    await queryInterface.sequelize.query(`
      ALTER TABLE comment_thread_events
      ADD CONSTRAINT comment_thread_events_type_check
      CHECK (event_type IN ('created', 'resolved', 'reopened'))
    `);

    // 3. Index for thread events in chronological order
    await queryInterface.addIndex('comment_thread_events', ['thread_id', 'created_at'], {
      name: 'comment_thread_events_thread_id_created_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comment_thread_events');
  },
};
