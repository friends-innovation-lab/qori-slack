/**
 * DiscoveryArtifact Model — DISC-1
 *
 * Canonical identity and content for Discovery artifacts.
 * Per locked decision D: GitHub is NOT canonical — this table owns truth.
 *
 * Versioning invariant (locked decision C):
 *   - Same DiscoveryRun retry produces v2, v3, etc.
 *   - Same topic sibling runs each start at v1
 *   - Exactly one current artifact per run
 *   - Failed retry does NOT supersede current
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
  type Sequelize,
} from 'sequelize';
import { randomUUID } from 'crypto';
import type { Project } from './project';
import type { DiscoveryRun } from './discovery_run';
import type { Actor } from './actor';

export type DiscoveryArtifactType =
  | 'desk_research'
  | 'stakeholder_synthesis'
  | 'survey_synthesis'
  | 'cross_source_synthesis';

export type DiscoveryArtifactStatus = 'generating' | 'current' | 'superseded' | 'failed';

class DiscoveryArtifact extends Model<
  InferAttributes<DiscoveryArtifact>,
  InferCreationAttributes<DiscoveryArtifact>
> {
  // Identity
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;

  // Scope
  declare project_id: ForeignKey<number>;
  declare discovery_run_id: ForeignKey<number> | null;

  // Artifact type and identity
  declare artifact_type: DiscoveryArtifactType;
  declare title: string;
  declare topic_slug: string;
  declare version: CreationOptional<number>;

  // Status
  declare status: CreationOptional<DiscoveryArtifactStatus>;

  // Canonical content (GitHub is NOT canonical per locked decision D)
  declare canonical_content: string | null;

  // Lineage
  declare superseded_by_id: ForeignKey<number> | null;
  declare superseded_at: Date | null;

  // Generation metadata
  declare template_name: string;
  declare template_version: string | null;
  declare derivation_fingerprint: string | null;

  // Projection metadata (NOT canonical)
  declare github_path: string | null;
  declare github_sha: string | null;
  declare projected_at: Date | null;
  declare projection_error: string | null;

  // Actor
  declare actor_id: ForeignKey<number> | null;
  declare generated_by_identity: string;

  // Timestamps
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Association mixins
  declare getProject: BelongsToGetAssociationMixin<Project>;
  declare project?: NonAttribute<Project>;
  declare getDiscoveryRun: BelongsToGetAssociationMixin<DiscoveryRun>;
  declare discoveryRun?: NonAttribute<DiscoveryRun>;
  declare getActor: BelongsToGetAssociationMixin<Actor>;
  declare actor?: NonAttribute<Actor>;
  declare getSupersededBy: BelongsToGetAssociationMixin<DiscoveryArtifact>;
  declare supersededBy?: NonAttribute<DiscoveryArtifact>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.DiscoveryRun, {
      foreignKey: 'discovery_run_id',
      as: 'discoveryRun',
      onDelete: 'SET NULL',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'actor_id',
      as: 'actor',
      onDelete: 'SET NULL',
    });

    this.belongsTo(models.DiscoveryArtifact, {
      foreignKey: 'superseded_by_id',
      as: 'supersededBy',
      onDelete: 'SET NULL',
    });
  }
}

export default (sequelize: Sequelize) => {
  DiscoveryArtifact.init(
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
      discovery_run_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
      },
      artifact_type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
          isIn: [[
            'desk_research', 'stakeholder_synthesis',
            'survey_synthesis', 'cross_source_synthesis',
          ]],
        },
      },
      title: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      topic_slug: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: { min: 1 },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'generating',
        validate: {
          isIn: [['generating', 'current', 'superseded', 'failed']],
        },
      },
      canonical_content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      superseded_by_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'discovery_artifacts', key: 'id' },
      },
      superseded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      template_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      template_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      derivation_fingerprint: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      github_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      github_sha: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      projected_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      projection_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      actor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
      },
      generated_by_identity: {
        type: DataTypes.STRING(100),
        allowNull: false,
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
    },
    {
      tableName: 'discovery_artifacts',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return DiscoveryArtifact;
};

export type { DiscoveryArtifact };
