/**
 * CoachingRunContext Model — Coach M1
 *
 * Records the context manifest for a coaching run — what artifacts/sections
 * the Coach "saw" when generating advice. This is a provenance record,
 * NOT a content store. The manifest records identity only.
 *
 * context_role distinguishes primary context (the artifact being coached)
 * from supporting context (findings, evidence, personas, etc.).
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

export type CoachingContextRole = 'primary' | 'supporting';

class CoachingRunContext extends Model<
  InferAttributes<CoachingRunContext>,
  InferCreationAttributes<CoachingRunContext>
> {
  declare id: CreationOptional<string>;
  declare run_id: ForeignKey<string>;
  declare object_type: string;
  declare object_id: string;
  declare object_version: number | null;
  declare section_key: string | null;
  declare context_role: CoachingContextRole;
  declare position: number;
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
  CoachingRunContext.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      run_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'coaching_runs', key: 'id' },
      },
      object_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      object_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      object_version: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      section_key: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      context_role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [['primary', 'supporting']],
        },
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'coaching_run_context',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return CoachingRunContext;
};

export type { CoachingRunContext };
