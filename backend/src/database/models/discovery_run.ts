/**
 * DiscoveryRun Model — DISC-1
 *
 * Durable workflow execution state for Discovery research operations.
 * Created BEFORE long-running analysis begins (per locked decision A).
 *
 * Identity: Integer PK + UUID public_id (per ADR 0030).
 * Actor: Uses actor_id FK (not raw Slack ID).
 *
 * Lifecycle: pending → processing → completed | failed | cancelled
 * Survey stages: schema_review | privacy_review | codebook_review | match_review | synthesis_ready
 */

import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type NonAttribute,
  type BelongsToGetAssociationMixin,
  type HasManyGetAssociationsMixin,
  type Sequelize,
} from 'sequelize';
import { randomUUID } from 'crypto';
import type { Project } from './project';
import type { Actor } from './actor';
import type { DiscoveryRunSource } from './discovery_run_source';
import type { DiscoveryArtifact } from './discovery_artifact';

export type DiscoveryType = 'desk_research' | 'stakeholder_synthesis' | 'survey_synthesis';

export type DiscoveryRunStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type SurveyStage =
  | 'schema_review'
  | 'privacy_review'
  | 'codebook_review'
  | 'match_review'
  | 'synthesis_ready';

class DiscoveryRun extends Model<
  InferAttributes<DiscoveryRun>,
  InferCreationAttributes<DiscoveryRun>
> {
  // Identity
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;

  // Scope
  declare project_id: ForeignKey<number>;

  // Discovery type
  declare discovery_type: DiscoveryType;

  // Research intent
  declare topic: string;
  declare topic_slug: string;
  declare source_intent: string | null;

  // Lifecycle
  declare status: CreationOptional<DiscoveryRunStatus>;
  declare stage: SurveyStage | null;

  // Actor
  declare actor_id: ForeignKey<number> | null;
  declare created_by_identity: string;

  // Failure tracking
  declare failure_code: string | null;
  declare failure_message: string | null;
  declare failure_stage: string | null;
  declare attempt_count: CreationOptional<number>;

  // Timestamps
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare started_at: Date | null;
  declare completed_at: Date | null;

  // Association mixins
  declare getProject: BelongsToGetAssociationMixin<Project>;
  declare project?: NonAttribute<Project>;
  declare getActor: BelongsToGetAssociationMixin<Actor>;
  declare actor?: NonAttribute<Actor>;
  declare getSources: HasManyGetAssociationsMixin<DiscoveryRunSource>;
  declare sources?: NonAttribute<DiscoveryRunSource[]>;
  declare getArtifacts: HasManyGetAssociationsMixin<DiscoveryArtifact>;
  declare artifacts?: NonAttribute<DiscoveryArtifact[]>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'actor_id',
      as: 'actor',
      onDelete: 'SET NULL',
    });

    this.hasMany(models.DiscoveryRunSource, {
      foreignKey: 'discovery_run_id',
      as: 'sources',
      onDelete: 'CASCADE',
    });

    this.hasMany(models.DiscoveryArtifact, {
      foreignKey: 'discovery_run_id',
      as: 'artifacts',
      onDelete: 'SET NULL',
    });
  }
}

export default (sequelize: Sequelize) => {
  DiscoveryRun.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      public_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        defaultValue: () => randomUUID(),
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
      },
      discovery_type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
          isIn: [['desk_research', 'stakeholder_synthesis', 'survey_synthesis']],
        },
      },
      topic: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      topic_slug: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      source_intent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
          isIn: [['pending', 'processing', 'completed', 'failed', 'cancelled']],
        },
      },
      stage: {
        type: DataTypes.STRING(30),
        allowNull: true,
        validate: {
          isIn: [[
            'schema_review', 'privacy_review', 'codebook_review',
            'match_review', 'synthesis_ready', null,
          ]],
        },
      },
      actor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
      },
      created_by_identity: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      failure_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      failure_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      failure_stage: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      attempt_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
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
    },
    {
      tableName: 'discovery_runs',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return DiscoveryRun;
};

export type { DiscoveryRun };
