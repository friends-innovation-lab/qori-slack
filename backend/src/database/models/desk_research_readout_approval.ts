/**
 * DeskResearchReadoutApproval Model
 *
 * Per DR-6b: Immutable approval audit trail with full snapshots.
 *
 * Once created, approval records cannot be updated or directly deleted.
 * Deletion is only allowed via CASCADE from parent study deletion.
 *
 * Counters:
 *   approval_number — monotonic per readout (for display "Approved v3")
 *   source_draft_content_version — draft version being approved (duplicate protection)
 *
 * Evidence snapshot is used for staleness evaluation:
 *   When cited insight is withdrawn or superseded, readout becomes stale.
 *   Staleness is evaluated against this snapshot, not the mutable draft.
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

export interface EvidenceSnapshotEntry {
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
}

export interface EvidenceSnapshot {
  cited_constructs: EvidenceSnapshotEntry[];
}

class DeskResearchReadoutApproval extends Model<
  InferAttributes<DeskResearchReadoutApproval>,
  InferCreationAttributes<DeskResearchReadoutApproval>
> {
  declare id: CreationOptional<number>;
  declare readout_id: ForeignKey<number>;

  // Approval identity
  declare approval_number: number;
  declare source_draft_content_version: number;

  // Approval metadata
  declare approved_at: CreationOptional<Date>;
  declare approved_by_actor_id: ForeignKey<number>;
  declare approval_note: string | null;

  // Immutable snapshots
  declare content_snapshot: DraftContent;
  declare findings_checked_snapshot: string[];
  declare implications_reviewed_snapshot: string[];
  declare evidence_snapshot: EvidenceSnapshot;

  // Supersession notes
  declare supersession_notes: Record<string, string> | null;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.DeskResearchReadout, {
      foreignKey: 'readout_id',
      as: 'readout',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'approved_by_actor_id',
      as: 'approvedBy',
      onDelete: 'RESTRICT',
    });
  }
}

export default (sequelize: Sequelize) => {
  DeskResearchReadoutApproval.init(
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
      approval_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      source_draft_content_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      approved_by_actor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      approval_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      content_snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      findings_checked_snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      implications_reviewed_snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      evidence_snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      supersession_notes: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: 'desk_research_readout_approvals',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return DeskResearchReadoutApproval;
};

export type { DeskResearchReadoutApproval };
