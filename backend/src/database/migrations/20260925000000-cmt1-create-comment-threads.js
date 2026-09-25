'use strict';

/**
 * CMT-1: Create comment_threads table for Workspace Comments.
 *
 * Threads anchor to artifact_id + section_key (stable section identifier).
 * They persist across artifact version changes. If a section key becomes
 * orphaned (section removed from artifact), threads remain but are surfaced
 * as orphaned in the API.
 *
 * Status lifecycle: open -> resolved -> open (reopen)
 * Resolution snapshot stored on thread; historical resolution/reopen
 * events tracked in comment_thread_events.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create comment_threads table
    await queryInterface.createTable('comment_threads', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      study_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'research_studies', key: 'id' },
        onDelete: 'CASCADE',
      },
      artifact_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'research_artifacts', key: 'id' },
        onDelete: 'CASCADE',
      },
      section_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Stable section identifier from artifact contract (e.g., "summary", "plan_risks")',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'open',
        comment: 'Thread status: open or resolved',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Actor who created the thread',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      resolved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Actor who most recently resolved the thread (cleared on reopen)',
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of most recent resolution (cleared on reopen)',
      },
    });

    // 2. Add CHECK constraint for status values
    await queryInterface.sequelize.query(`
      ALTER TABLE comment_threads
      ADD CONSTRAINT comment_threads_status_check
      CHECK (status IN ('open', 'resolved'))
    `);

    // 3. Index for artifact + status (list open threads for an artifact)
    await queryInterface.addIndex('comment_threads', ['artifact_id', 'status'], {
      name: 'comment_threads_artifact_id_status_idx',
    });

    // 4. Index for artifact + section_key + status (check for existing open thread on section)
    await queryInterface.addIndex('comment_threads', ['artifact_id', 'section_key', 'status'], {
      name: 'comment_threads_artifact_section_status_idx',
    });

    // 5. Index for study_id (list all threads for a study)
    await queryInterface.addIndex('comment_threads', ['study_id'], {
      name: 'comment_threads_study_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comment_threads');
  },
};
