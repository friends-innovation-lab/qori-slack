/**
 * DiscoveryRunSource Model — DISC-1
 *
 * Relational join between DiscoveryRun and EvidenceSource.
 * One run may have 1..N sources; one source may participate in multiple runs.
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
import type { DiscoveryRun } from './discovery_run';
import type { EvidenceSource } from './evidence_source';

class DiscoveryRunSource extends Model<
  InferAttributes<DiscoveryRunSource>,
  InferCreationAttributes<DiscoveryRunSource>
> {
  declare id: CreationOptional<number>;
  declare discovery_run_id: ForeignKey<number>;
  declare evidence_source_id: ForeignKey<number>;
  declare source_order: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;

  // Association mixins
  declare getDiscoveryRun: BelongsToGetAssociationMixin<DiscoveryRun>;
  declare discoveryRun?: NonAttribute<DiscoveryRun>;
  declare getEvidenceSource: BelongsToGetAssociationMixin<EvidenceSource>;
  declare evidenceSource?: NonAttribute<EvidenceSource>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.DiscoveryRun, {
      foreignKey: 'discovery_run_id',
      as: 'discoveryRun',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.EvidenceSource, {
      foreignKey: 'evidence_source_id',
      as: 'evidenceSource',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  DiscoveryRunSource.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      discovery_run_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'discovery_runs', key: 'id' },
      },
      evidence_source_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'evidence_sources', key: 'id' },
      },
      source_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'discovery_run_sources',
      underscored: true,
      timestamps: false,
      sequelize,
      indexes: [
        {
          unique: true,
          fields: ['discovery_run_id', 'evidence_source_id'],
          name: 'idx_discovery_run_sources_unique',
        },
      ],
    },
  );

  return DiscoveryRunSource;
};

export type { DiscoveryRunSource };
