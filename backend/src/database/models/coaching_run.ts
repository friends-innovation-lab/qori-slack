/**
 * CoachingRun Model — Coach M1
 *
 * Tracks AI-generated advisory feedback runs for artifacts (Brief, Plan).
 * Each run is bound to a specific artifact + content_version snapshot.
 * Historical runs remain tied to their exact version — immutable provenance.
 *
 * Key design:
 * - content_version snapshots artifact version at run creation
 * - retry_of_run_id enables researcher retry lineage (new run, not mutation)
 * - Operational retry uses attempt_count on same run
 * - Provenance fields are immutable after creation
 */

import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type NonAttribute,
  type HasManyGetAssociationsMixin,
  type BelongsToGetAssociationMixin,
  type Sequelize,
} from 'sequelize';

export type CoachingRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type CoachingReviewScope = 'section' | 'artifact';
export type CoachingFailureCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'RATE_LIMITED'
  | 'INVALID_MODEL_RESPONSE'
  | 'OUTPUT_VALIDATION_FAILED'
  | 'CONTEXT_BUILD_FAILED'
  | 'GENERATION_FAILED'
  | 'MAX_ATTEMPTS_EXCEEDED';

class CoachingRun extends Model<
  InferAttributes<CoachingRun>,
  InferCreationAttributes<CoachingRun>
> {
  declare id: CreationOptional<string>;
  declare study_id: ForeignKey<number>;
  declare artifact_id: ForeignKey<number>;
  declare artifact_type: string;
  declare content_version: number;
  declare selected_section_key: string | null;
  declare review_scope: CoachingReviewScope;
  declare status: CreationOptional<CoachingRunStatus>;
  declare requested_by: ForeignKey<number>;
  declare requested_at: CreationOptional<Date>;
  declare started_at: Date | null;
  declare completed_at: Date | null;
  declare failed_at: Date | null;
  declare retry_of_run_id: string | null;
  declare coaching_contract_version: string;
  declare prompt_template_version: string;
  declare provider: string;
  declare model: string;
  declare generation_config_json: Record<string, unknown> | null;
  declare failure_code: CoachingFailureCode | null;
  declare failure_diagnostic: string | null;
  declare attempt_count: CreationOptional<number>;
  declare claimed_at: Date | null;
  declare heartbeat_at: Date | null;
  declare worker_id: string | null;
  declare last_attempt_at: Date | null;
  declare input_tokens: number | null;
  declare output_tokens: number | null;
  declare total_tokens: number | null;
  declare estimated_cost: number | null;
  declare actual_provider_cost: number | null;
  declare latency_ms: number | null;

  // Association mixins
  declare getItems: HasManyGetAssociationsMixin<import('./coaching_run_item').CoachingRunItem>;
  declare items?: NonAttribute<import('./coaching_run_item').CoachingRunItem[]>;

  declare getContextEntries: HasManyGetAssociationsMixin<import('./coaching_run_context').CoachingRunContext>;
  declare contextEntries?: NonAttribute<import('./coaching_run_context').CoachingRunContext[]>;

  declare getRequester: BelongsToGetAssociationMixin<import('./actor').Actor>;
  declare requester?: NonAttribute<import('./actor').Actor>;

  declare getArtifact: BelongsToGetAssociationMixin<import('./research_artifact').ResearchArtifact>;
  declare artifact?: NonAttribute<import('./research_artifact').ResearchArtifact>;

  declare getStudy: BelongsToGetAssociationMixin<import('./research_study').ResearchStudy>;
  declare study?: NonAttribute<import('./research_study').ResearchStudy>;

  declare getRetryOfRun: BelongsToGetAssociationMixin<CoachingRun>;
  declare retryOfRun?: NonAttribute<CoachingRun>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.ResearchStudy, {
      foreignKey: 'study_id',
      as: 'study',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.ResearchArtifact, {
      foreignKey: 'artifact_id',
      as: 'artifact',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'requested_by',
      as: 'requester',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.CoachingRun, {
      foreignKey: 'retry_of_run_id',
      as: 'retryOfRun',
      onDelete: 'SET NULL',
    });

    if (models.CoachingRunItem) {
      this.hasMany(models.CoachingRunItem, {
        foreignKey: 'run_id',
        as: 'items',
        onDelete: 'CASCADE',
      });
    }

    if (models.CoachingRunContext) {
      this.hasMany(models.CoachingRunContext, {
        foreignKey: 'run_id',
        as: 'contextEntries',
        onDelete: 'CASCADE',
      });
    }
  }
}

export default (sequelize: Sequelize) => {
  CoachingRun.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      study_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'research_studies', key: 'id' },
      },
      artifact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'research_artifacts', key: 'id' },
      },
      artifact_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      content_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      selected_section_key: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      review_scope: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [['section', 'artifact']],
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
          isIn: [['pending', 'running', 'completed', 'failed']],
        },
      },
      requested_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
      },
      requested_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      retry_of_run_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'coaching_runs', key: 'id' },
      },
      coaching_contract_version: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      prompt_template_version: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      model: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      generation_config_json: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      failure_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
          isIn: [[
            'PROVIDER_UNAVAILABLE',
            'PROVIDER_TIMEOUT',
            'RATE_LIMITED',
            'INVALID_MODEL_RESPONSE',
            'OUTPUT_VALIDATION_FAILED',
            'CONTEXT_BUILD_FAILED',
            'GENERATION_FAILED',
            'MAX_ATTEMPTS_EXCEEDED',
          ]],
        },
      },
      failure_diagnostic: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attempt_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      claimed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      heartbeat_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      worker_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      last_attempt_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      input_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      output_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      total_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      estimated_cost: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
        get() {
          const val = this.getDataValue('estimated_cost');
          return val === null ? null : parseFloat(val as unknown as string);
        },
      },
      actual_provider_cost: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
        get() {
          const val = this.getDataValue('actual_provider_cost');
          return val === null ? null : parseFloat(val as unknown as string);
        },
      },
      latency_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: 'coaching_runs',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return CoachingRun;
};

export type { CoachingRun };
