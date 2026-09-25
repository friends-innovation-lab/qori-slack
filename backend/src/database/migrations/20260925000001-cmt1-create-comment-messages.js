'use strict';

/**
 * CMT-1: Create comment_messages table for Workspace Comments.
 *
 * Messages belong to threads. The first message is created atomically
 * with the thread (no empty threads). Messages can be edited by their
 * author using optimistic concurrency control (expected_updated_at).
 *
 * No hard delete. Messages are immutable once created except for body edits.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create comment_messages table
    await queryInterface.createTable('comment_messages', {
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
      author_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Actor who authored the message',
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Message content (plain text or Markdown)',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Used for optimistic concurrency on edits',
      },
    });

    // 2. Index for thread messages in chronological order
    await queryInterface.addIndex('comment_messages', ['thread_id', 'created_at'], {
      name: 'comment_messages_thread_id_created_at_idx',
    });

    // 3. Index for author (e.g., find all messages by an actor)
    await queryInterface.addIndex('comment_messages', ['author_id'], {
      name: 'comment_messages_author_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comment_messages');
  },
};
