/**
 * CoachingRunReference Model — Coach M1
 *
 * Stores resolved references from coaching items to Qori entities.
 * These are authoritative Qori identities — NOT model-created arbitrary IDs.
 * References point to objectives, questions, barriers, findings, evidence, etc.
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

class CoachingRunReference extends Model<
  InferAttributes<CoachingRunReference>,
  InferCreationAttributes<CoachingRunReference>
> {
  declare id: CreationOptional<string>;
  declare item_id: ForeignKey<string>;
  declare object_type: string;
  declare object_id: string;
  declare section_key: string | null;
  declare label: string;
  declare created_at: CreationOptional<Date>;

  // Association mixins
  declare getItem: BelongsToGetAssociationMixin<import('./coaching_run_item').CoachingRunItem>;
  declare item?: NonAttribute<import('./coaching_run_item').CoachingRunItem>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.CoachingRunItem, {
      foreignKey: 'item_id',
      as: 'item',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  CoachingRunReference.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'coaching_run_items', key: 'id' },
      },
      object_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      object_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      section_key: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'coaching_run_references',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return CoachingRunReference;
};

export type { CoachingRunReference };
