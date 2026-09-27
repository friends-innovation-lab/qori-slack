/**
 * CoachingRunSnapshot Model — Coach M2
 *
 * Stores immutable artifact content snapshot at run creation time.
 * This ensures Coach can execute against the exact content the researcher
 * requested, even if the artifact is later edited before execution.
 *
 * Key design:
 * - One immutable snapshot per run (unique run_id)
 * - Captured transactionally with run creation
 * - canonical_snapshot_json contains structured section content
 * - Execution snapshot, not a canonical source of truth
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

/**
 * Schema for canonical_snapshot_json content.
 */
export interface CanonicalSnapshotContent {
  /** Artifact title at snapshot time */
  title: string | null;
  /** Section content keyed by section_key */
  sections: Record<string, {
    content_type: 'prose' | 'structured_json';
    content: string | null;
  }>;
}

class CoachingRunSnapshot extends Model<
  InferAttributes<CoachingRunSnapshot>,
  InferCreationAttributes<CoachingRunSnapshot>
> {
  declare id: CreationOptional<string>;
  declare run_id: ForeignKey<string>;
  declare snapshot_schema_version: CreationOptional<string>;
  declare artifact_type: string;
  declare artifact_id: number;
  declare artifact_public_id: string;
  declare content_version: number;
  declare canonical_snapshot_json: CanonicalSnapshotContent;
  declare created_at: CreationOptional<Date>;

  // Association mixins
  declare getRun: BelongsToGetAssociationMixin<import('./coaching_run').CoachingRun>;
  declare run?: NonAttribute<import('./coaching_run').CoachingRun>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.CoachingRun, {
      foreignKey: 'run_id',
      as: 'run',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  CoachingRunSnapshot.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      run_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'coaching_runs', key: 'id' },
      },
      snapshot_schema_version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '1.0.0',
      },
      artifact_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      artifact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      artifact_public_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      content_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      canonical_snapshot_json: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'coaching_run_snapshots',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return CoachingRunSnapshot;
};

export type { CoachingRunSnapshot };
