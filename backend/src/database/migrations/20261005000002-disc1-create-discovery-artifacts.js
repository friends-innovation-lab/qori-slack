'use strict';

/**
 * Migration: DISC-1 — Create discovery_artifacts table
 *
 * Canonical identity and content for Discovery artifacts.
 * Per locked decision D: GitHub is NOT canonical. This table owns truth.
 *
 * Versioning invariant (locked decision C):
 *   - Same DiscoveryRun retry produces v2, v3, etc.
 *   - Same topic sibling runs each start at v1
 *   - Exactly one current artifact per run/type
 *   - Failed retry does NOT supersede current
 *
 * Content storage:
 *   - canonical_content: Full Markdown text (canonical research truth)
 *   - GitHub path/sha are projection metadata only
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('discovery_artifacts', {
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

      // Scope
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      discovery_run_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'NULL for historical/imported artifacts without run lineage',
      },

      // Artifact type
      artifact_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        comment: 'desk_research | stakeholder_synthesis | survey_synthesis | cross_source_synthesis',
      },

      // Identity
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Human-readable title',
      },
      topic_slug: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'URL-safe slug (matches run topic_slug)',
      },

      // Version (per locked decision C)
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Version within this run (increments on retry/regeneration)',
      },

      // Status
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'generating',
        comment: 'generating | current | superseded | failed',
      },

      // Canonical content (locked decision D: GitHub is NOT canonical)
      canonical_content: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Canonical Markdown content — NULL for failed artifacts',
      },

      // Lineage
      superseded_by_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'discovery_artifacts', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'FK to artifact that superseded this one',
      },
      superseded_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Generation metadata
      template_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'YAML template name (e.g., desk_research)',
      },
      template_version: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Template version at generation time',
      },
      derivation_fingerprint: {
        type: Sequelize.STRING(64),
        allowNull: true,
        comment: 'Content hash of inputs for deduplication',
      },

      // Projection metadata (NOT canonical)
      github_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'GitHub path where artifact was projected',
      },
      github_sha: {
        type: Sequelize.STRING(64),
        allowNull: true,
        comment: 'GitHub commit SHA of projection',
      },
      projected_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When artifact was projected to GitHub',
      },
      projection_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if projection failed (does not affect canonical status)',
      },

      // Actor
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
        onDelete: 'SET NULL',
      },
      generated_by_identity: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Raw identity string for audit',
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
    });

    // Domain value check for artifact_type
    await queryInterface.sequelize.query(`
      ALTER TABLE discovery_artifacts
      ADD CONSTRAINT chk_discovery_artifacts_type
      CHECK (artifact_type IN (
        'desk_research', 'stakeholder_synthesis', 'survey_synthesis', 'cross_source_synthesis'
      ))
    `);

    // Domain value check for status
    await queryInterface.sequelize.query(`
      ALTER TABLE discovery_artifacts
      ADD CONSTRAINT chk_discovery_artifacts_status
      CHECK (status IN ('generating', 'current', 'superseded', 'failed'))
    `);

    // Version must be positive
    await queryInterface.sequelize.query(`
      ALTER TABLE discovery_artifacts
      ADD CONSTRAINT chk_discovery_artifacts_version_positive
      CHECK (version > 0)
    `);

    // Partial unique index: only one current artifact per run
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_discovery_artifacts_run_current
      ON discovery_artifacts (discovery_run_id)
      WHERE status = 'current' AND discovery_run_id IS NOT NULL
    `);

    // Indexes
    await queryInterface.addIndex('discovery_artifacts', ['project_id'], {
      name: 'idx_discovery_artifacts_project',
    });
    await queryInterface.addIndex('discovery_artifacts', ['discovery_run_id'], {
      name: 'idx_discovery_artifacts_run',
    });
    await queryInterface.addIndex('discovery_artifacts', ['status'], {
      name: 'idx_discovery_artifacts_status',
    });
    await queryInterface.addIndex('discovery_artifacts', ['artifact_type'], {
      name: 'idx_discovery_artifacts_type',
    });
    await queryInterface.addIndex('discovery_artifacts', ['public_id'], {
      name: 'idx_discovery_artifacts_public_id',
      unique: true,
    });
    await queryInterface.addIndex('discovery_artifacts', ['topic_slug'], {
      name: 'idx_discovery_artifacts_topic_slug',
    });
    await queryInterface.addIndex('discovery_artifacts', ['project_id', 'artifact_type', 'status'], {
      name: 'idx_discovery_artifacts_project_type_status',
    });

    console.log('Created discovery_artifacts table with canonical content storage');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('discovery_artifacts');
    console.log('Dropped discovery_artifacts table');
  },
};
