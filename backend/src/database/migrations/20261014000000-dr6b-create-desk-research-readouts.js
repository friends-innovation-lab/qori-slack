'use strict';

/**
 * Migration: DR-6b — Create desk_research_readouts table
 *
 * Study-specific Desk Research Readouts with project ownership.
 * Per DR-6b canonical contract:
 * - Each readout belongs to one study within a project
 * - Study-scoped RO-0001 display identifiers
 * - Generation request tracking for async AI generation
 * - Out-of-date tracking evaluated against immutable approval snapshots
 *
 * Identity:
 *   id         — internal PK
 *   public_id  — durable UUID for external references
 *   display_id — study-scoped "RO-0001" format
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('desk_research_readouts', {
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

      // Ownership
      study_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'research_studies', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent study (readout owned by one study)',
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent project (denormalized for query efficiency)',
      },

      // Identity
      display_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Study-scoped identifier (RO-0001, RO-0002, ...)',
      },
      display_sequence: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Numeric sequence for display_id generation',
      },

      // Content metadata
      title: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Readout title',
      },
      question: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional guiding research question',
      },

      // Lifecycle
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_by_actor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'RESTRICT',
        comment: 'Actor who created the readout',
      },

      // Approval state (denormalized from latest approval)
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of latest approval (NULL if never approved)',
      },
      approved_version: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Latest approval_number (NULL if never approved)',
      },

      // Staleness tracking (evaluated against immutable approval snapshot)
      out_of_date_since: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When cited evidence became stale (NULL if current)',
      },
      out_of_date_reason: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Reason for staleness: cited_insight_withdrawn | newer_revision_accepted',
      },

      // Generation tracking
      current_generation_request_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Active generation request UUID (NULL if no generation in progress)',
      },
    });

    // Unique constraint: one display_sequence per study
    await queryInterface.addIndex('desk_research_readouts', ['study_id', 'display_sequence'], {
      name: 'uq_readout_study_display_sequence',
      unique: true,
    });

    // Index for study lookup
    await queryInterface.addIndex('desk_research_readouts', ['study_id'], {
      name: 'idx_readouts_study_id',
    });

    // Index for project lookup
    await queryInterface.addIndex('desk_research_readouts', ['project_id'], {
      name: 'idx_readouts_project_id',
    });

    // Index for public_id lookup
    await queryInterface.addIndex('desk_research_readouts', ['public_id'], {
      name: 'idx_readouts_public_id',
      unique: true,
    });

    // Domain check for out_of_date_reason
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readouts
      ADD CONSTRAINT chk_readout_out_of_date_reason
      CHECK (out_of_date_reason IS NULL OR out_of_date_reason IN (
        'cited_insight_withdrawn',
        'newer_revision_accepted'
      ))
    `);

    // Constraint: out_of_date_since and out_of_date_reason must be both NULL or both NOT NULL
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readouts
      ADD CONSTRAINT chk_readout_staleness_consistency
      CHECK (
        (out_of_date_since IS NULL AND out_of_date_reason IS NULL) OR
        (out_of_date_since IS NOT NULL AND out_of_date_reason IS NOT NULL)
      )
    `);

    // Constraint: project_id must match study's project_id (enforced at DB level)
    // This requires a trigger since CHECK constraints can't reference other tables
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION check_readout_study_project_consistency()
      RETURNS TRIGGER AS $$
      DECLARE
        study_project_id INTEGER;
      BEGIN
        SELECT project_id INTO study_project_id
        FROM research_studies
        WHERE id = NEW.study_id;

        IF study_project_id IS NULL THEN
          RAISE EXCEPTION 'Study not found: %', NEW.study_id;
        END IF;

        IF NEW.project_id != study_project_id THEN
          RAISE EXCEPTION 'Readout project_id (%) must match study project_id (%)',
            NEW.project_id, study_project_id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_readout_study_project_consistency
        BEFORE INSERT OR UPDATE ON desk_research_readouts
        FOR EACH ROW
        EXECUTE FUNCTION check_readout_study_project_consistency();
    `);

    console.log('Created desk_research_readouts table with constraints');
  },

  async down(queryInterface) {
    // Drop trigger and function first
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_readout_study_project_consistency ON desk_research_readouts;
      DROP FUNCTION IF EXISTS check_readout_study_project_consistency();
    `);

    await queryInterface.dropTable('desk_research_readouts');
    console.log('Dropped desk_research_readouts table');
  },
};
