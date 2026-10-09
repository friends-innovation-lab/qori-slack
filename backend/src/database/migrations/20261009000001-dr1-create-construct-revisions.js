'use strict';

/**
 * Migration: DR-1 — Create evidence_construct_revisions table
 *
 * Immutable revision history for EvidenceConstruct.
 * Per SPEC-2 design authority:
 * - Each edit creates a new proposed revision
 * - Save never implies acceptance (D3)
 * - Revisions store immutable content and evidence snapshots
 * - Revision numbers are construct-unique, never reused
 *
 * Identity:
 *   id        — internal PK
 *   public_id — durable UUID for external references
 *
 * Immutability:
 *   - content and evidence_snapshot are never modified after creation
 *   - Revisions are never deleted (historical audit trail)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('evidence_construct_revisions', {
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

      // Revision identity
      revision_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Construct-unique revision number (r1, r2, ...)',
      },

      // Immutable content
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Immutable structured content: { wording, ... }',
      },

      // Immutable evidence snapshot
      evidence_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Immutable array of evidence references with locators',
      },

      // Origin tracking
      origin: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'ai | researcher — who created this revision',
      },

      // Discovery run provenance (for AI-generated revisions)
      discovery_run_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Source Discovery run for AI-generated revisions',
      },

      // Creator
      created_by: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Actor identity who created the revision',
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Unique constraint: one revision number per construct
    await queryInterface.addIndex('evidence_construct_revisions', ['construct_id', 'revision_number'], {
      name: 'uq_construct_revision_number',
      unique: true,
    });

    // Index for finding latest revision
    await queryInterface.addIndex('evidence_construct_revisions', ['construct_id', 'created_at'], {
      name: 'idx_construct_revisions_construct_created',
    });

    // Index for public_id lookup
    await queryInterface.addIndex('evidence_construct_revisions', ['public_id'], {
      name: 'idx_construct_revisions_public_id',
      unique: true,
    });

    // Domain value check for origin
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_construct_revisions
      ADD CONSTRAINT chk_revision_origin
      CHECK (origin IN ('ai', 'researcher'))
    `);

    // Now add the FK constraints to evidence_constructs for revision pointers
    // These are deferred to allow the revisions table to exist first
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_constructs
      ADD CONSTRAINT fk_constructs_latest_revision
      FOREIGN KEY (latest_revision_id)
      REFERENCES evidence_construct_revisions(id)
      ON DELETE SET NULL
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_constructs
      ADD CONSTRAINT fk_constructs_accepted_revision
      FOREIGN KEY (accepted_revision_id)
      REFERENCES evidence_construct_revisions(id)
      ON DELETE SET NULL
    `);

    console.log('Created evidence_construct_revisions table with FK constraints');
  },

  async down(queryInterface) {
    // Remove FK constraints from evidence_constructs first
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_constructs
      DROP CONSTRAINT IF EXISTS fk_constructs_accepted_revision
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_constructs
      DROP CONSTRAINT IF EXISTS fk_constructs_latest_revision
    `);

    await queryInterface.dropTable('evidence_construct_revisions');
    console.log('Dropped evidence_construct_revisions table');
  },
};
