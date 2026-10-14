'use strict';

/**
 * Migration: DR-6b — Create desk_research_readout_approvals table
 *
 * Immutable approval audit trail with full snapshots.
 * Per DR-6b canonical contract:
 * - approval_number is monotonic per readout (for display "Approved v3")
 * - source_draft_content_version is the draft version being approved
 * - UNIQUE(readout_id, source_draft_content_version) prevents duplicate approval
 * - All snapshots are immutable once created
 *
 * Evidence snapshot is used for staleness evaluation:
 * - When cited insight is withdrawn, readout becomes stale
 * - When cited revision is superseded, readout becomes stale
 * - Staleness is evaluated against this snapshot, not the mutable draft
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('desk_research_readout_approvals', {
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

      // Approval identity
      approval_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Monotonic approval number per readout (1, 2, 3, ...)',
      },
      source_draft_content_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Draft content_version being approved (duplicate protection)',
      },

      // Approval metadata
      approved_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When approved',
      },
      approved_by_actor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'RESTRICT',
        comment: 'Actor who approved',
      },
      approval_note: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional approver note',
      },

      // Immutable content snapshot
      content_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Full content at approval time (immutable)',
      },

      // Immutable review state snapshots
      findings_checked_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Findings marked as checked at approval time',
      },
      implications_reviewed_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Implications marked as reviewed at approval time',
      },

      // Immutable evidence snapshot (for staleness evaluation)
      evidence_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Evidence citations at approval time: { cited_constructs: [...] }',
      },

      // Supersession notes (when citing older revisions intentionally)
      supersession_notes: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Justifications for citing superseded revisions: { "IN-0001": "reason" }',
      },
    });

    // Unique constraint: one approval_number per readout
    await queryInterface.addIndex('desk_research_readout_approvals', ['readout_id', 'approval_number'], {
      name: 'uq_approval_readout_number',
      unique: true,
    });

    // Unique constraint: one approval per source draft version (duplicate protection)
    await queryInterface.addIndex('desk_research_readout_approvals', ['readout_id', 'source_draft_content_version'], {
      name: 'uq_approval_source_draft_version',
      unique: true,
    });

    // Index for readout lookup (ordered by time)
    await queryInterface.addIndex('desk_research_readout_approvals', ['readout_id', 'approved_at'], {
      name: 'idx_approvals_readout_time',
    });

    // Constraint: approval_number must be positive
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_approvals
      ADD CONSTRAINT chk_approval_number_positive
      CHECK (approval_number >= 1)
    `);

    // Immutability trigger: block all updates and deletes on approval rows
    // Deletion is only allowed via CASCADE from parent readout/study
    //
    // Detection strategy: pg_trigger_depth() reliably distinguishes CASCADE from direct DELETE.
    // - Direct DELETE: trigger_depth = 1 (we're inside the BEFORE DELETE trigger)
    // - CASCADE DELETE: trigger_depth > 1 (FK cascade machinery adds depth)
    // This is database-enforceable and not timing-dependent like parent-existence checks.
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION protect_approval_immutability()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          RAISE EXCEPTION 'Approval records are immutable and cannot be updated';
        END IF;

        IF TG_OP = 'DELETE' THEN
          -- pg_trigger_depth() = 1 means direct DELETE statement
          -- pg_trigger_depth() > 1 means we're inside FK CASCADE machinery
          IF pg_trigger_depth() = 1 THEN
            RAISE EXCEPTION 'Approval records cannot be directly deleted. Delete the parent study instead.';
          END IF;
        END IF;

        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_protect_approval_immutability_update
        BEFORE UPDATE ON desk_research_readout_approvals
        FOR EACH ROW
        EXECUTE FUNCTION protect_approval_immutability();

      CREATE TRIGGER trg_protect_approval_immutability_delete
        BEFORE DELETE ON desk_research_readout_approvals
        FOR EACH ROW
        EXECUTE FUNCTION protect_approval_immutability();
    `);

    console.log('Created desk_research_readout_approvals table with immutability protections');
  },

  async down(queryInterface) {
    // Drop triggers and function first
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_protect_approval_immutability_delete ON desk_research_readout_approvals;
      DROP TRIGGER IF EXISTS trg_protect_approval_immutability_update ON desk_research_readout_approvals;
      DROP FUNCTION IF EXISTS protect_approval_immutability();
    `);

    await queryInterface.dropTable('desk_research_readout_approvals');
    console.log('Dropped desk_research_readout_approvals table');
  },
};
