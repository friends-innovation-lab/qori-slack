/**
 * DeskResearchReadoutVersion Model
 *
 * Per DR-6b: Immutable generation history.
 *
 * Each AI generation creates a new version row.
 * Content is immutable once generation_status = 'completed'.
 *
 * Generation lifecycle:
 *   pending → generating → completed | failed | superseded
 *
 * Human edit detection:
 *   draft_content_version_at_start captures the draft version when generation
 *   was initiated. On completion, if draft version has changed, human edits
 *   are preserved and generation result is stored but not applied.
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
import type { DraftContent } from './desk_research_readout_draft';

export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'superseded';

export interface EvidenceSetEntry {
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
  displayId: string;
}

class DeskResearchReadoutVersion extends Model<
  InferAttributes<DeskResearchReadoutVersion>,
  InferCreationAttributes<DeskResearchReadoutVersion>
> {
  declare id: CreationOptional<number>;
  declare readout_id: ForeignKey<number>;

  // Version identity
  declare version_number: number;

  // Generation tracking
  declare generation_request_id: string;
  declare generation_status: CreationOptional<GenerationStatus>;
  declare generation_started_at: Date | null;
  declare generation_completed_at: Date | null;
  declare generation_error: string | null;

  // Human edit detection
  declare draft_content_version_at_start: number;

  // Generated content (immutable once completed)
  declare content: DraftContent | null;

  // Evidence set
  declare evidence_set: EvidenceSetEntry[];

  // Timestamps
  declare created_at: CreationOptional<Date>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.DeskResearchReadout, {
      foreignKey: 'readout_id',
      as: 'readout',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  DeskResearchReadoutVersion.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      readout_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      version_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      generation_request_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      generation_status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
          isIn: [['pending', 'generating', 'completed', 'failed', 'superseded']],
        },
      },
      generation_started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      generation_completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      generation_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      draft_content_version_at_start: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      content: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      evidence_set: {
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
      tableName: 'desk_research_readout_versions',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return DeskResearchReadoutVersion;
};

export type { DeskResearchReadoutVersion };
