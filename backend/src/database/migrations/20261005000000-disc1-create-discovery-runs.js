'use strict';

/**
 * Migration: DISC-1 — Create discovery_runs table
 *
 * Durable workflow execution state for Discovery research operations.
 * Per locked decisions: Run identity is created BEFORE long-running analysis.
 *
 * Identity: Integer PK + UUID public_id (per ADR 0030).
 * Actor: Uses actor_id FK to actors table (not raw Slack ID).
 *
 * Lifecycle states:
 *   - pending: Run created, awaiting execution
 *   - processing: Execution in progress
 *   - completed: Successfully finished
 *   - failed: Execution failed (retryable)
 *   - cancelled: Explicitly cancelled by user/system
 *
 * Survey stage values (for multi-step survey workflow):
 *   - schema_review: Awaiting field schema confirmation
 *   - privacy_review: Awaiting privacy disposition
 *   - codebook_review: Awaiting codebook acceptance
 *   - match_review: Awaiting coding assignment review
 *   - synthesis_ready: Ready for synthesis generation
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('discovery_runs', {
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
        comment: 'Durable external identity — stable across retries',
      },

      // Scope
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Discovery is project-scoped, not study-scoped',
      },

      // Discovery type
      discovery_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        comment: 'desk_research | stakeholder_synthesis | survey_synthesis',
      },

      // Research intent
      topic: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Human-readable topic (not unique — sibling runs may share topic)',
      },
      topic_slug: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'URL-safe slug derived from topic',
      },
      source_intent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What researcher needs this source to tell them',
      },

      // Lifecycle
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending | processing | completed | failed | cancelled',
      },
      stage: {
        type: Sequelize.STRING(30),
        allowNull: true,
        comment: 'Survey workflow stage: schema_review | privacy_review | codebook_review | match_review | synthesis_ready',
      },

      // Actor (canonical FK)
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Canonical actor FK — NULL if actor not yet resolved (legacy Slack-only flows)',
      },
      created_by_identity: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Raw identity string for audit (e.g., "slack:U123456") — used when actor_id is NULL',
      },

      // Failure tracking
      failure_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Machine-readable failure code',
      },
      failure_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Sanitized human-readable failure message (no PII)',
      },
      failure_stage: {
        type: Sequelize.STRING(30),
        allowNull: true,
        comment: 'Stage where failure occurred',
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Number of execution attempts (increments on retry)',
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When execution started (pending → processing)',
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When execution completed (processing → completed|failed)',
      },
    });

    // Domain value check for discovery_type
    await queryInterface.sequelize.query(`
      ALTER TABLE discovery_runs
      ADD CONSTRAINT chk_discovery_runs_type
      CHECK (discovery_type IN ('desk_research', 'stakeholder_synthesis', 'survey_synthesis'))
    `);

    // Domain value check for status
    await queryInterface.sequelize.query(`
      ALTER TABLE discovery_runs
      ADD CONSTRAINT chk_discovery_runs_status
      CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
    `);

    // Domain value check for stage (nullable, only for survey)
    await queryInterface.sequelize.query(`
      ALTER TABLE discovery_runs
      ADD CONSTRAINT chk_discovery_runs_stage
      CHECK (stage IS NULL OR stage IN (
        'schema_review', 'privacy_review', 'codebook_review', 'match_review', 'synthesis_ready'
      ))
    `);

    // Indexes
    await queryInterface.addIndex('discovery_runs', ['project_id'], {
      name: 'idx_discovery_runs_project',
    });
    await queryInterface.addIndex('discovery_runs', ['status'], {
      name: 'idx_discovery_runs_status',
    });
    await queryInterface.addIndex('discovery_runs', ['discovery_type'], {
      name: 'idx_discovery_runs_type',
    });
    await queryInterface.addIndex('discovery_runs', ['public_id'], {
      name: 'idx_discovery_runs_public_id',
      unique: true,
    });
    await queryInterface.addIndex('discovery_runs', ['actor_id'], {
      name: 'idx_discovery_runs_actor',
    });
    await queryInterface.addIndex('discovery_runs', ['project_id', 'status'], {
      name: 'idx_discovery_runs_project_status',
    });

    console.log('Created discovery_runs table with lifecycle tracking and actor FK');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('discovery_runs');
    console.log('Dropped discovery_runs table');
  },
};
