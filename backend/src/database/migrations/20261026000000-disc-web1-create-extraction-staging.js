'use strict';

/**
 * Migration: DISC-WEB-1 — Create extraction_staging table
 *
 * Server-bound extraction references for Workspace document upload.
 * Refs are project-scoped, actor-owned, single-use, and time-limited (30 min TTL).
 *
 * Lifecycle: ready → consumed | expired | failed
 * - ready: Valid, awaiting consumption by run creation
 * - consumed: Successfully used to create a Discovery run
 * - expired: TTL exceeded without consumption
 * - failed: Extraction failed (preserved for debugging)
 *
 * CASCADE BEHAVIOR (Audit Compliance):
 *
 * project_id ON DELETE CASCADE:
 *   - Acceptable: Project deletion is a major destructive operation
 *   - Staging is temporary; permanent evidence lives in evidence_sources
 *   - Project deletion already cascades evidence_sources (per existing convention)
 *
 * actor_id ON DELETE CASCADE:
 *   - Acceptable: Actor hard-delete is rare (user removal from system)
 *   - Actors are typically soft-deleted (status change), not hard-deleted
 *   - Staging refs are actor-owned upload sessions, not audit records
 *   - Permanent evidence is NOT linked to uploading actor (linked to run/project)
 *
 * consumed_by_run_id ON DELETE SET NULL:
 *   - Correct: Run deletion should not delete staging rows
 *   - Staging may be needed for debugging even after run deletion
 *   - FK becomes NULL, row remains for audit trail until cleanup
 *
 * EVIDENCE PRESERVATION:
 *   - Staging rows are TEMPORARY holding area
 *   - Permanent evidence lives in evidence_sources table
 *   - No FK from staging to evidence_sources (data is COPIED, not referenced)
 *   - Deleting staging cannot cascade to permanent evidence
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('extraction_staging', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ref_token: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true, // Implicit unique index created by constraint
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        comment: 'Single-use reference token for consumption by run creation',
      },

      // Scope (FK naming per repository convention)
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Project scope — ref only usable in this project',
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Actor ownership — only this actor can consume the ref',
      },

      // File metadata
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      file_size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      // Dual hashes (server-computed, immutable)
      file_hash: {
        type: Sequelize.CHAR(64),
        allowNull: false,
        comment: 'SHA-256 of original file bytes',
      },
      content_hash: {
        type: Sequelize.CHAR(64),
        allowNull: false,
        comment: 'SHA-256 of extracted text UTF-8 bytes',
      },

      // Extracted content
      extracted_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      char_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      // Lifecycle
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'ready',
        comment: 'ready | consumed | expired | failed',
      },
      consumed_by_run_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'FK to discovery run that consumed this ref',
      },

      // Error tracking (for failed extractions)
      error_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Error code for failed extractions',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error details for failed extractions',
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP + INTERVAL '30 minutes'"),
      },
      consumed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Domain value check for status
    await queryInterface.sequelize.query(`
      ALTER TABLE extraction_staging
      ADD CONSTRAINT chk_extraction_staging_status
      CHECK (status IN ('ready', 'consumed', 'expired', 'failed'))
    `);

    // Expiry must be after creation
    await queryInterface.sequelize.query(`
      ALTER TABLE extraction_staging
      ADD CONSTRAINT chk_extraction_staging_expiry
      CHECK (expires_at > created_at)
    `);

    // Indexes for common queries
    // Note: ref_token already has unique index from column constraint
    await queryInterface.addIndex('extraction_staging', ['project_id', 'status'], {
      name: 'idx_extraction_staging_project_status',
    });
    await queryInterface.addIndex('extraction_staging', ['actor_id'], {
      name: 'idx_extraction_staging_actor',
    });
    await queryInterface.addIndex('extraction_staging', ['expires_at'], {
      name: 'idx_extraction_staging_expires',
      where: { status: 'ready' },
    });
    await queryInterface.addIndex('extraction_staging', ['consumed_by_run_id'], {
      name: 'idx_extraction_staging_consumed_run',
      where: { consumed_by_run_id: { [Sequelize.Op.ne]: null } },
    });

    console.log('Created extraction_staging table for DISC-WEB-1');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('extraction_staging');
    console.log('Dropped extraction_staging table');
  },
};
