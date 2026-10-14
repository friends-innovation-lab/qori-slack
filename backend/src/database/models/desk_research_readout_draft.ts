/**
 * DeskResearchReadoutDraft Model
 *
 * Per DR-6b: Mutable working draft content (one per readout).
 *
 * Provides optimistic concurrency via content_version.
 * Review state (findings_checked, implications_reviewed) is managed by service layer.
 *
 * Content structure:
 * {
 *   summary: { text: string, citations: Citation[] },
 *   findings: Finding[],
 *   limitations: Limitation[],
 *   implications: Implication[]
 * }
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

export interface DraftContent {
  summary?: {
    text: string;
    citations?: Array<{
      constructPublicId: string;
      revisionPublicId: string;
      revisionNumber: number;
      displayId: string;
    }>;
  };
  findings?: Array<{
    id: string;
    text: string;
    citations: Array<{
      constructPublicId: string;
      revisionPublicId: string;
      revisionNumber: number;
      displayId: string;
    }>;
  }>;
  limitations?: Array<{
    id: string;
    text: string;
  }>;
  implications?: Array<{
    id: string;
    kind: 'question' | 'gap' | 'priority' | 'hypothesis';
    text: string;
    basedOnFindings: string[];
    basedOnCitations?: Array<{
      constructPublicId: string;
      revisionPublicId: string;
      revisionNumber: number;
      displayId: string;
    }>;
  }>;
}

class DeskResearchReadoutDraft extends Model<
  InferAttributes<DeskResearchReadoutDraft>,
  InferCreationAttributes<DeskResearchReadoutDraft>
> {
  declare id: CreationOptional<number>;
  declare readout_id: ForeignKey<number>;

  // Mutable content
  declare content: DraftContent;

  // Review state
  declare findings_checked: string[];
  declare implications_reviewed: string[];

  // Optimistic concurrency
  declare content_version: CreationOptional<number>;

  // Edit tracking
  declare last_edited_at: CreationOptional<Date>;
  declare last_edited_by_actor_id: ForeignKey<number> | null;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.DeskResearchReadout, {
      foreignKey: 'readout_id',
      as: 'readout',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'last_edited_by_actor_id',
      as: 'lastEditedBy',
      onDelete: 'SET NULL',
    });
  }
}

export default (sequelize: Sequelize) => {
  DeskResearchReadoutDraft.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      readout_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      content: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      findings_checked: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      implications_reviewed: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      content_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      last_edited_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      last_edited_by_actor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: 'desk_research_readout_drafts',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return DeskResearchReadoutDraft;
};

export type { DeskResearchReadoutDraft };
