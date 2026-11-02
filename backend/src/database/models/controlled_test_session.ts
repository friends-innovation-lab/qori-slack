/**
 * ControlledTestSession Model — DISC-WEB-1D-2
 *
 * Tracks AI execution budgets for controlled testing in dev environments.
 * Each session enforces hard limits on requests and tokens for exactly ONE discovery run.
 *
 * Key invariants:
 * - At most one active session at any time (database constraint)
 * - Once a run is bound, the binding is immutable
 * - A cancelled/exhausted/completed session still identifies its bound run
 * - Budget reservation is atomic (service layer handles UPDATE with preconditions)
 *
 * Status transitions:
 *   active → cancelled (manual abort)
 *   active → exhausted (any budget limit reached)
 *   active → completed (run finished successfully)
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
import type { Actor } from './actor';
import type { DiscoveryRun } from './discovery_run';

export type ControlledTestSessionStatus = 'active' | 'cancelled' | 'exhausted' | 'completed';

class ControlledTestSession extends Model<
  InferAttributes<ControlledTestSession>,
  InferCreationAttributes<ControlledTestSession>
> {
  // Identity
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;

  // Status
  declare status: CreationOptional<ControlledTestSessionStatus>;

  // Run binding
  declare discovery_run_id: ForeignKey<number> | null;

  // Budget limits (immutable after creation)
  declare max_requests: number;
  declare max_input_tokens: number;
  declare max_output_tokens: number;

  // Usage tracking
  declare used_requests: CreationOptional<number>;
  declare used_input_tokens: CreationOptional<number>;
  declare used_output_tokens: CreationOptional<number>;

  // Actor
  declare created_by_actor_id: ForeignKey<number> | null;

  // Terminal state metadata
  declare cancellation_reason: string | null;

  // Timestamps
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare cancelled_at: Date | null;
  declare exhausted_at: Date | null;
  declare completed_at: Date | null;

  // Association mixins
  declare getDiscoveryRun: BelongsToGetAssociationMixin<DiscoveryRun>;
  declare discoveryRun?: NonAttribute<DiscoveryRun>;
  declare getCreatedByActor: BelongsToGetAssociationMixin<Actor>;
  declare createdByActor?: NonAttribute<Actor>;

  // Computed helpers (non-persisted)
  get remainingRequests(): NonAttribute<number> {
    return this.max_requests - this.used_requests;
  }

  get remainingInputTokens(): NonAttribute<number> {
    return this.max_input_tokens - this.used_input_tokens;
  }

  get remainingOutputTokens(): NonAttribute<number> {
    return this.max_output_tokens - this.used_output_tokens;
  }

  get isTerminal(): NonAttribute<boolean> {
    return this.status !== 'active';
  }

  static associate(models: Record<string, unknown>) {
    this.belongsTo(models.DiscoveryRun as typeof DiscoveryRun, {
      foreignKey: 'discovery_run_id',
      as: 'discoveryRun',
      onDelete: 'SET NULL',
    });

    this.belongsTo(models.Actor as typeof Actor, {
      foreignKey: 'created_by_actor_id',
      as: 'createdByActor',
      onDelete: 'SET NULL',
    });
  }
}

export default (sequelize: Sequelize) => {
  ControlledTestSession.init(
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
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        validate: {
          isIn: [['active', 'cancelled', 'exhausted', 'completed']],
        },
      },
      discovery_run_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
      },
      max_requests: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      max_input_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      max_output_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      used_requests: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      used_input_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      used_output_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_by_actor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
      },
      cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      exhausted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'controlled_test_sessions',
      underscored: true,
      timestamps: false, // We manage timestamps manually
      sequelize,
    },
  );

  return ControlledTestSession;
};

export type { ControlledTestSession };
