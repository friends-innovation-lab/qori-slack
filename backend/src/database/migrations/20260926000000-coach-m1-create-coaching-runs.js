'use strict';

/**
 * Coach M1: Create coaching_runs table for AI Coach advisory runs.
 *
 * coaching_runs tracks AI-generated advisory feedback for artifacts (Brief, Plan).
 * Each run is bound to a specific artifact_id + content_version snapshot.
 * Historical runs remain tied to their exact version — they do not float forward.
 *
 * Key design decisions:
 * - UUID primary key (consistent with comment_threads pattern)
 * - content_version snapshots artifact version at run creation (immutable)
 * - retry_of_run_id enables researcher retry lineage (new run, not mutation)
 * - Operational retry uses attempt_count/claimed_at/heartbeat_at on same run
 * - Active-run concurrency enforced via partial unique index
 * - Provenance fields (contract/prompt/provider/model) are immutable after creation
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create coaching_runs table
    await queryInterface.createTable('coaching_runs', {
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
        comment: 'Study containing the artifact being coached',
      },
      artifact_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'research_artifacts', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Artifact being coached (Brief or Plan)',
      },
      artifact_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Artifact type at run creation (brief, plan, etc.)',
      },
      content_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Snapshot of artifact content_version at run creation — immutable',
      },
      selected_section_key: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Section key for section-scoped review (null for artifact-scoped)',
      },
      review_scope: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Review scope: section or artifact',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Run status: pending, running, completed, failed',
      },
      requested_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Actor who requested the coaching run',
      },
      requested_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp when run was requested',
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when run transitioned to running',
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when run completed successfully',
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when run failed',
      },
      retry_of_run_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'coaching_runs', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Researcher retry: points to original run (new run created)',
      },
      coaching_contract_version: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Version of coaching contract used for this run — immutable',
      },
      prompt_template_version: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Version of prompt template used for this run — immutable',
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'AI provider used (e.g., anthropic) — immutable',
      },
      model: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Model used (e.g., claude-sonnet-4-20250514) — immutable',
      },
      generation_config_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Generation config (temperature, max_tokens, etc.) — immutable',
      },
      failure_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Normalized failure code (PROVIDER_UNAVAILABLE, RATE_LIMITED, etc.)',
      },
      failure_diagnostic: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Sanitized diagnostic info — no raw provider payloads/secrets/PII',
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Operational retry count (same run_id, incremented on retry)',
      },
      claimed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when worker claimed this run',
      },
      heartbeat_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last worker heartbeat (for stale detection)',
      },
      worker_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Worker instance ID processing this run',
      },
      last_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of most recent execution attempt',
      },
      input_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Input tokens consumed (admin telemetry)',
      },
      output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Output tokens generated (admin telemetry)',
      },
      total_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Total tokens (admin telemetry)',
      },
      estimated_cost: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
        comment: 'Estimated cost in USD (admin telemetry)',
      },
      actual_provider_cost: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
        comment: 'Actual provider-reported cost in USD (admin telemetry)',
      },
      latency_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'End-to-end latency in milliseconds (admin telemetry)',
      },
    });

    // 2. Add CHECK constraint for status values
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      ADD CONSTRAINT coaching_runs_status_check
      CHECK (status IN ('pending', 'running', 'completed', 'failed'))
    `);

    // 3. Add CHECK constraint for review_scope values
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      ADD CONSTRAINT coaching_runs_review_scope_check
      CHECK (review_scope IN ('section', 'artifact'))
    `);

    // 4. Add CHECK constraint: section_key required for section scope, null for artifact scope
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      ADD CONSTRAINT coaching_runs_section_key_scope_check
      CHECK (
        (review_scope = 'section' AND selected_section_key IS NOT NULL) OR
        (review_scope = 'artifact' AND selected_section_key IS NULL)
      )
    `);

    // 5. Add CHECK constraint for failure_code values
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      ADD CONSTRAINT coaching_runs_failure_code_check
      CHECK (failure_code IS NULL OR failure_code IN (
        'PROVIDER_UNAVAILABLE',
        'PROVIDER_TIMEOUT',
        'RATE_LIMITED',
        'INVALID_MODEL_RESPONSE',
        'OUTPUT_VALIDATION_FAILED',
        'CONTEXT_BUILD_FAILED',
        'GENERATION_FAILED'
      ))
    `);

    // 6. Partial unique index for active-run concurrency
    // Only one pending/running run per (requester, artifact, version, scope, section)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX coaching_runs_active_run_unique_idx
      ON coaching_runs (requested_by, artifact_id, content_version, review_scope, COALESCE(selected_section_key, ''))
      WHERE status IN ('pending', 'running')
    `);

    // 7. Index for artifact + requested_at (list runs for artifact)
    await queryInterface.addIndex('coaching_runs', ['artifact_id', 'requested_at'], {
      name: 'coaching_runs_artifact_id_requested_at_idx',
    });

    // 8. Index for artifact + content_version (version-specific history)
    await queryInterface.addIndex('coaching_runs', ['artifact_id', 'content_version'], {
      name: 'coaching_runs_artifact_id_content_version_idx',
    });

    // 9. Index for artifact + status (filter by status)
    await queryInterface.addIndex('coaching_runs', ['artifact_id', 'status'], {
      name: 'coaching_runs_artifact_id_status_idx',
    });

    // 10. Index for requested_by + status (user's runs)
    await queryInterface.addIndex('coaching_runs', ['requested_by', 'status'], {
      name: 'coaching_runs_requested_by_status_idx',
    });

    // 11. Index for retry_of_run_id (retry lineage)
    await queryInterface.addIndex('coaching_runs', ['retry_of_run_id'], {
      name: 'coaching_runs_retry_of_run_id_idx',
    });

    // 12. Index for status + claimed_at (worker queue)
    await queryInterface.addIndex('coaching_runs', ['status', 'claimed_at'], {
      name: 'coaching_runs_status_claimed_at_idx',
    });

    // 13. Index for study_id (study-level queries)
    await queryInterface.addIndex('coaching_runs', ['study_id'], {
      name: 'coaching_runs_study_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coaching_runs');
  },
};
