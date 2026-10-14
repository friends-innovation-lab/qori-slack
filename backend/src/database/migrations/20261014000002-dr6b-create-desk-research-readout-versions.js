'use strict';

/**
 * Migration: DR-6b — Create desk_research_readout_versions table
 *
 * Immutable generation history.
 * Per DR-6b canonical contract:
 * - Each generation creates a new version row
 * - generation_request_id links to the initiating request
 * - draft_content_version_at_start enables human edit detection
 * - Completed content is immutable once generation_status = 'completed'
 *
 * Generation lifecycle:
 * 1. pending: Version row created, job not yet started
 * 2. generating: AI generation in progress
 * 3. completed: Generation succeeded, content populated (immutable)
 * 4. failed: Generation failed, error recorded
 * 5. superseded: A newer regeneration request replaced this one
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('desk_research_readout_versions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // Parent readout
      readout_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'desk_research_readouts', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent readout',
      },

      // Version identity
      version_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Readout-unique version number (1, 2, 3, ...)',
      },

      // Generation tracking
      generation_request_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Unique request ID for this generation',
      },
      generation_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status: pending | generating | completed | failed | superseded',
      },
      generation_started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When generation started',
      },
      generation_completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When generation completed (success or failure)',
      },
      generation_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if generation failed',
      },

      // Draft version at generation start (for human edit detection)
      draft_content_version_at_start: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Draft content_version when generation was initiated',
      },

      // Generated content (NULL until completed, immutable once set)
      content: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Generated content (immutable once completed)',
      },

      // Evidence set at generation time
      evidence_set: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Evidence citations used for this generation',
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Unique constraint: one version_number per readout
    await queryInterface.addIndex('desk_research_readout_versions', ['readout_id', 'version_number'], {
      name: 'uq_readout_version_number',
      unique: true,
    });

    // Unique constraint on generation_request_id
    await queryInterface.addIndex('desk_research_readout_versions', ['generation_request_id'], {
      name: 'uq_readout_version_request_id',
      unique: true,
    });

    // Index for readout lookup
    await queryInterface.addIndex('desk_research_readout_versions', ['readout_id', 'created_at'], {
      name: 'idx_readout_versions_readout_created',
    });

    // Domain check for generation_status
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_versions
      ADD CONSTRAINT chk_version_generation_status
      CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed', 'superseded'))
    `);

    // Constraint: completed versions must have content
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_versions
      ADD CONSTRAINT chk_version_completed_has_content
      CHECK (
        generation_status != 'completed' OR content IS NOT NULL
      )
    `);

    // Constraint: failed versions must have error
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_versions
      ADD CONSTRAINT chk_version_failed_has_error
      CHECK (
        generation_status != 'failed' OR generation_error IS NOT NULL
      )
    `);

    // Immutability trigger: prevent updates to completed version content
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION protect_completed_version_content()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Allow status transitions
        IF OLD.generation_status = 'generating' AND NEW.generation_status IN ('completed', 'failed', 'superseded') THEN
          RETURN NEW;
        END IF;

        -- Block content changes on completed versions
        IF OLD.generation_status = 'completed' AND OLD.content IS DISTINCT FROM NEW.content THEN
          RAISE EXCEPTION 'Cannot modify content of completed version';
        END IF;

        -- Block status regression from completed
        IF OLD.generation_status = 'completed' AND NEW.generation_status != 'completed' THEN
          RAISE EXCEPTION 'Cannot change status of completed version';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_protect_completed_version_content
        BEFORE UPDATE ON desk_research_readout_versions
        FOR EACH ROW
        EXECUTE FUNCTION protect_completed_version_content();
    `);

    console.log('Created desk_research_readout_versions table with immutability protections');
  },

  async down(queryInterface) {
    // Drop trigger and function first
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_protect_completed_version_content ON desk_research_readout_versions;
      DROP FUNCTION IF EXISTS protect_completed_version_content();
    `);

    await queryInterface.dropTable('desk_research_readout_versions');
    console.log('Dropped desk_research_readout_versions table');
  },
};
