/**
 * ControlledTestReservation Model — DISC-WEB-1D-2 M3 Safety Fix
 *
 * Tracks individual budget reservations within a controlled test session.
 * Each reservation represents a single AI invocation's budget allocation.
 *
 * Key invariants:
 * - Each reservation belongs to exactly one session
 * - Reservations are immutable after creation (reserved tokens never change)
 * - State transitions: reserved → reconciled (one-way, idempotent)
 * - Reconciliation releases unused output allocation exactly once
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
import type { ControlledTestSession } from './controlled_test_session';

export type ControlledTestReservationState = 'reserved' | 'reconciled';

class ControlledTestReservation extends Model<
  InferAttributes<ControlledTestReservation>,
  InferCreationAttributes<ControlledTestReservation>
> {
  // Identity
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;

  // Session binding (immutable)
  declare session_id: ForeignKey<number>;

  // State
  declare state: CreationOptional<ControlledTestReservationState>;

  // Reserved amounts (immutable, set at creation)
  declare reserved_input_tokens: number;
  declare reserved_output_tokens: number;

  // Actual amounts (set during reconciliation)
  declare actual_input_tokens: number | null;
  declare actual_output_tokens: number | null;

  // Purpose/provenance
  declare purpose: string | null;

  // Timestamps
  declare created_at: CreationOptional<Date>;
  declare reconciled_at: Date | null;

  // Association mixins
  declare getSession: BelongsToGetAssociationMixin<ControlledTestSession>;
  declare session?: NonAttribute<ControlledTestSession>;

  // Computed helpers
  get isReconciled(): NonAttribute<boolean> {
    return this.state === 'reconciled';
  }

  get unusedOutputTokens(): NonAttribute<number | null> {
    if (this.actual_output_tokens === null) return null;
    return Math.max(0, this.reserved_output_tokens - this.actual_output_tokens);
  }

  static associate(models: Record<string, unknown>) {
    this.belongsTo(models.ControlledTestSession as typeof ControlledTestSession, {
      foreignKey: 'session_id',
      as: 'session',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  ControlledTestReservation.init(
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
      session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'controlled_test_sessions', key: 'id' },
      },
      state: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'reserved',
        validate: {
          isIn: [['reserved', 'reconciled']],
        },
      },
      reserved_input_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      reserved_output_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      actual_input_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      actual_output_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      purpose: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      reconciled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'controlled_test_reservations',
      underscored: true,
      timestamps: false, // We manage timestamps manually
      sequelize,
    },
  );

  return ControlledTestReservation;
};

export type { ControlledTestReservation };
