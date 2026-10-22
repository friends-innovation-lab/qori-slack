/**
 * DeskResearchReadoutVersion Model
 *
 * Per DR-6b: Immutable generation history with worker claim infrastructure.
 *
 * Each AI generation creates a new version row.
 * Content is immutable once generation_status = 'completed'.
 *
 * Generation lifecycle:
 *   pending → generating → completed | failed | superseded
 *
 * Worker claim lifecycle (DR-6b-5a):
 *   pending (unclaimed) → pending (claimed) → generating → completed | failed
 *   - Worker claims via FOR UPDATE SKIP LOCKED
 *   - Heartbeat extends lease
 *   - Stale claims (heartbeat_at too old) can be recovered
 *   - Bounded retries via attempt_count
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

  // Idempotency (DR-6b-5a)
  declare idempotency_key: string | null;
  declare requested_by_actor_id: ForeignKey<number> | null;

  // Worker claim (DR-6b-5a)
  declare worker_id: string | null;
  declare claimed_at: Date | null;
  declare heartbeat_at: Date | null;

  // Retry tracking (DR-6b-5a, DR-6b-5b)
  declare attempt_count: CreationOptional<number>;
  declare last_error_code: string | null;
  declare retry_after: Date | null; // DR-6b-5b: Bounded backoff for transient failures

  // Timestamps
  declare created_at: CreationOptional<Date>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.DeskResearchReadout, {
      foreignKey: 'readout_id',
      as: 'readout',
      onDelete: 'CASCADE',
    });
    this.belongsTo(models.Actor, {
      foreignKey: 'requested_by_actor_id',
      as: 'requestedBy',
      onDelete: 'SET NULL',
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
      // Idempotency (DR-6b-5a)
      idempotency_key: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      requested_by_actor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // Worker claim (DR-6b-5a)
      worker_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      claimed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      heartbeat_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Retry tracking (DR-6b-5a, DR-6b-5b)
      attempt_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_error_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      retry_after: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Earliest time this pending job can be claimed (bounded retry backoff)',
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
