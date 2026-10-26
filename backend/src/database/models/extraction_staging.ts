/**
 * ExtractionStaging Model — DISC-WEB-1
 *
 * Server-bound extraction references for Workspace document upload.
 * Refs are project-scoped, actor-owned, single-use, and time-limited.
 *
 * Lifecycle: ready → consumed | expired | failed
 *
 * Security invariants:
 * - ref_token is opaque to client (cannot be predicted)
 * - project_id enforces project scope
 * - actor_id enforces ownership
 * - expires_at enforces time limit (30 min default)
 * - Single-use: consumed_by_run_id marks permanent consumption
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
import type { Actor } from './actor';
import type { DiscoveryRun } from './discovery_run';

export type ExtractionStagingStatus = 'ready' | 'consumed' | 'expired' | 'failed';

class ExtractionStaging extends Model<
  InferAttributes<ExtractionStaging>,
  InferCreationAttributes<ExtractionStaging>
> {
  // Identity
  declare id: CreationOptional<number>;
  declare ref_token: CreationOptional<string>;

  // Scope
  declare project_id: ForeignKey<number>;
  declare actor_id: ForeignKey<number>;

  // File metadata
  declare filename: string;
  declare mime_type: string;
  declare file_size_bytes: number;

  // Dual hashes
  declare file_hash: string;
  declare content_hash: string;

  // Extracted content
  declare extracted_text: string;
  declare char_count: number;

  // Lifecycle
  declare status: CreationOptional<ExtractionStagingStatus>;
  declare consumed_by_run_id: ForeignKey<number> | null;

  // Error tracking
  declare error_code: string | null;
  declare error_message: string | null;

  // Timestamps
  declare created_at: CreationOptional<Date>;
  declare expires_at: CreationOptional<Date>;
  declare consumed_at: Date | null;

  // Association mixins
  declare getProject: BelongsToGetAssociationMixin<Project>;
  declare project?: NonAttribute<Project>;
  declare getActor: BelongsToGetAssociationMixin<Actor>;
  declare actor?: NonAttribute<Actor>;
  declare getConsumedByRun: BelongsToGetAssociationMixin<DiscoveryRun>;
  declare consumedByRun?: NonAttribute<DiscoveryRun>;

  /**
   * Check if this staging row is valid for consumption.
   */
  isConsumable(): boolean {
    return this.status === 'ready' && new Date() < this.expires_at;
  }

  static associate(models: Record<string, unknown>) {
    this.belongsTo(models.Project as typeof Project, {
      foreignKey: 'project_id',
      as: 'project',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor as typeof Actor, {
      foreignKey: 'actor_id',
      as: 'actor',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.DiscoveryRun as typeof DiscoveryRun, {
      foreignKey: 'consumed_by_run_id',
      as: 'consumedByRun',
      onDelete: 'SET NULL',
    });
  }
}

export default (sequelize: Sequelize) => {
  ExtractionStaging.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ref_token: {
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
      actor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
      },
      filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      file_size_bytes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      file_hash: {
        type: DataTypes.CHAR(64),
        allowNull: false,
      },
      content_hash: {
        type: DataTypes.CHAR(64),
        allowNull: false,
      },
      extracted_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      char_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ready',
        validate: {
          isIn: [['ready', 'consumed', 'expired', 'failed']],
        },
      },
      consumed_by_run_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
      },
      error_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP + INTERVAL '30 minutes'"),
      },
      consumed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'extraction_staging',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return ExtractionStaging;
};

export type { ExtractionStaging };
