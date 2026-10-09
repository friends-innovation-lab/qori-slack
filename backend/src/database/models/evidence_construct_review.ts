/**
 * EvidenceConstructReview Model
 *
 * Per SPEC-2 / DR-1: Immutable review decision audit trail.
 *
 * Accept, reject, withdraw are explicit review actions.
 * Researchers and above may review their own revisions (D2).
 * Withdrawal reason is required (D6).
 * Reviews are never deleted or modified.
 *
 * Identity (ADR 0030):
 *   id        — internal relational PK
 *   public_id — durable UUID for external references
 *
 * Actions:
 *   - accept: Marks revision as the new accepted revision
 *   - reject: Rejects a proposed revision (preserves prior accepted)
 *   - withdraw: Withdraws insight from synthesis eligibility
 */

import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type Sequelize,
} from 'sequelize';
import { randomUUID } from 'crypto';

export type ReviewAction = 'accept' | 'reject' | 'withdraw';

class EvidenceConstructReview extends Model<
  InferAttributes<EvidenceConstructReview>,
  InferCreationAttributes<EvidenceConstructReview>
> {
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;
  declare construct_id: number;
  declare revision_id: number | null;
  declare action: ReviewAction;
  declare reviewed_by: string;
  declare reviewed_at: CreationOptional<Date>;
  declare comment: string | null;
  declare expected_version: number;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.EvidenceConstruct, {
      foreignKey: 'construct_id',
      as: 'construct',
      onDelete: 'CASCADE',
    });

    if (models.EvidenceConstructRevision) {
      this.belongsTo(models.EvidenceConstructRevision, {
        foreignKey: 'revision_id',
        as: 'revision',
        onDelete: 'SET NULL',
      });
    }
  }
}

export default (sequelize: Sequelize) => {
  EvidenceConstructReview.init(
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
      construct_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      revision_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [['accept', 'reject', 'withdraw']],
        },
      },
      reviewed_by: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expected_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'evidence_construct_reviews',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return EvidenceConstructReview;
};

export type { EvidenceConstructReview };
