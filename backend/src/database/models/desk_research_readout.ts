/**
 * DeskResearchReadout Model
 *
 * Per DR-6b: Study-specific Desk Research Readouts with project ownership.
 *
 * A readout belongs to one study within a project. Its evidence set may include
 * eligible accepted Desk research insights from any study in the same project.
 *
 * Identity:
 *   id          — internal PK
 *   public_id   — durable UUID for external references
 *   display_id  — study-scoped "RO-0001" format
 *
 * Lifecycle:
 *   - Created with initial generation request
 *   - Draft is edited, findings checked, implications reviewed
 *   - Approved to create immutable snapshot
 *   - May become stale if cited evidence changes
 */

import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type Sequelize,
} from 'sequelize';
import { randomUUID } from 'crypto';

export type OutOfDateReason = 'cited_insight_withdrawn' | 'newer_revision_accepted';

class DeskResearchReadout extends Model<
  InferAttributes<DeskResearchReadout>,
  InferCreationAttributes<DeskResearchReadout>
> {
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;

  // Ownership
  declare study_id: ForeignKey<number>;
  declare project_id: ForeignKey<number>;

  // Identity
  declare display_id: string;
  declare display_sequence: number;

  // Content metadata
  declare title: string;
  declare question: string | null;

  // Lifecycle
  declare created_at: CreationOptional<Date>;
  declare created_by_actor_id: ForeignKey<number>;

  // Approval state (denormalized)
  declare approved_at: Date | null;
  declare approved_version: number | null;

  // Staleness tracking
  declare out_of_date_since: Date | null;
  declare out_of_date_reason: OutOfDateReason | null;

  // Generation tracking
  declare current_generation_request_id: string | null;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.ResearchStudy, {
      foreignKey: 'study_id',
      as: 'study',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'created_by_actor_id',
      as: 'createdBy',
      onDelete: 'RESTRICT',
    });

    if (models.DeskResearchReadoutDraft) {
      this.hasOne(models.DeskResearchReadoutDraft, {
        foreignKey: 'readout_id',
        as: 'draft',
        onDelete: 'CASCADE',
      });
    }

    if (models.DeskResearchReadoutVersion) {
      this.hasMany(models.DeskResearchReadoutVersion, {
        foreignKey: 'readout_id',
        as: 'versions',
        onDelete: 'CASCADE',
      });
    }

    if (models.DeskResearchReadoutApproval) {
      this.hasMany(models.DeskResearchReadoutApproval, {
        foreignKey: 'readout_id',
        as: 'approvals',
        onDelete: 'CASCADE',
      });
    }
  }
}

export default (sequelize: Sequelize) => {
  DeskResearchReadout.init(
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
      study_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      display_id: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      display_sequence: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      title: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      question: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_by_actor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      approved_version: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      out_of_date_since: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      out_of_date_reason: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
          isIn: [['cited_insight_withdrawn', 'newer_revision_accepted']],
        },
      },
      current_generation_request_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'desk_research_readouts',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return DeskResearchReadout;
};

export type { DeskResearchReadout };
