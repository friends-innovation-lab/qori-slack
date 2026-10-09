'use strict';

/**
 * Migration: DR-1 — Create evidence_construct_reviews table
 *
 * Immutable review decision audit trail.
 * Per SPEC-2 design authority:
 * - Accept, reject, withdraw are explicit review actions
 * - Researchers and above may review their own revisions (D2)
 * - Withdrawal reason is required (D6)
 * - Reviews are never deleted or modified
 *
 * Identity:
 *   id        — internal PK
 *   public_id — durable UUID for external references
 *
 * Actions:
 *   - accept: Marks revision as the new accepted revision
 *   - reject: Rejects a proposed revision (preserves prior accepted)
 *   - withdraw: Withdraws insight from synthesis eligibility
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('evidence_construct_reviews', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      public_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        comment: 'Durable external identity',
      },

      // Parent construct
      construct_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'evidence_constructs', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent insight construct',
      },

      // Target revision (NULL only for withdraw action)
      revision_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'evidence_construct_revisions', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Revision being reviewed. NULL for withdraw (applies to construct).',
      },

      // Review action
      action: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'accept | reject | withdraw',
      },

      // Reviewer
      reviewed_by: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Actor identity who performed the review',
      },

      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },

      // Optional comment (required for withdraw per D6, optional for reject)
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Review comment. Required for withdraw (D6), optional for others.',
      },

      // Concurrency: which construct version this review was made against
      expected_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Construct version at time of review (for audit)',
      },
    });

    // Domain value check for action
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_construct_reviews
      ADD CONSTRAINT chk_review_action
      CHECK (action IN ('accept', 'reject', 'withdraw'))
    `);

    // Constraint: withdraw must have a comment (D6)
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_construct_reviews
      ADD CONSTRAINT chk_withdraw_requires_reason
      CHECK (action != 'withdraw' OR comment IS NOT NULL)
    `);

    // Constraint: accept and reject must have a revision_id
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_construct_reviews
      ADD CONSTRAINT chk_revision_required_for_accept_reject
      CHECK (action = 'withdraw' OR revision_id IS NOT NULL)
    `);

    // Index for construct review history
    await queryInterface.addIndex('evidence_construct_reviews', ['construct_id', 'reviewed_at'], {
      name: 'idx_construct_reviews_construct_reviewed',
    });

    // Index for revision review history
    await queryInterface.addIndex('evidence_construct_reviews', ['revision_id'], {
      name: 'idx_construct_reviews_revision',
    });

    // Index for public_id lookup
    await queryInterface.addIndex('evidence_construct_reviews', ['public_id'], {
      name: 'idx_construct_reviews_public_id',
      unique: true,
    });

    console.log('Created evidence_construct_reviews table with review constraints');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('evidence_construct_reviews');
    console.log('Dropped evidence_construct_reviews table');
  },
};
