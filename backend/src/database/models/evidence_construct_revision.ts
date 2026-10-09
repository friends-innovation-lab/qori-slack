/**
 * EvidenceConstructRevision Model
 *
 * Per SPEC-2 / DR-1: Immutable revision history for EvidenceConstruct.
 *
 * Each edit creates a new proposed revision. Save never implies acceptance (D3).
 * Revisions store immutable content and evidence snapshots.
 * Revision numbers are construct-unique, never reused.
 *
 * Identity (ADR 0030):
 *   id        — internal relational PK
 *   public_id — durable UUID for external references
 *
 * Evidence Snapshot Structure:
 *   Array of evidence references, each containing:
 *   - evidenceSourceId: FK to EvidenceSource
 *   - locator: { page?, section?, excerpt?, sourceLevel? }
 *   - validation: 'verified' | 'source_attributed_unverified'
 *   - capturedContentHash?: SHA for content verification
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

export type RevisionOrigin = 'ai' | 'researcher';

export interface EvidenceLocator {
  /** Page number or range (e.g., "12", "12-15") */
  page?: string;
  /** Section identifier (e.g., "3.2", "Introduction") */
  section?: string;
  /** Verbatim excerpt from source */
  excerpt?: string;
  /** True if referencing source as a whole (no specific locator) */
  sourceLevel?: boolean;
  /** DR-2: Explanation of why precise locator is unavailable */
  attributionLimitation?: string;
  /** DR-2: AI-extracted context (evidence quotes) that couldn't be verified */
  aiExtractedContext?: string;
}

export interface EvidenceReference {
  /** FK to EvidenceSource.id */
  evidenceSourceId: number;
  /** Public ID of the EvidenceSource for external references */
  evidenceSourcePublicId?: string;
  /** Locator within the source */
  locator: EvidenceLocator;
  /** Validation status */
  validation: 'verified' | 'source_attributed_unverified' | 'ai_unverified';
  /** SHA hash of captured content for verification */
  capturedContentHash?: string;
  /** Human-readable source label at time of capture */
  sourceLabel?: string;
}

export interface RevisionContent {
  /** The insight wording/text */
  wording: string;
  /** Additional structured content */
  [key: string]: unknown;
}

class EvidenceConstructRevision extends Model<
  InferAttributes<EvidenceConstructRevision>,
  InferCreationAttributes<EvidenceConstructRevision>
> {
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;
  declare construct_id: number;
  declare revision_number: number;
  declare content: RevisionContent;
  declare evidence_snapshot: EvidenceReference[];
  declare origin: RevisionOrigin;
  declare discovery_run_id: number | null;
  declare created_by: string;
  declare created_at: CreationOptional<Date>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.EvidenceConstruct, {
      foreignKey: 'construct_id',
      as: 'construct',
      onDelete: 'CASCADE',
    });

    if (models.DiscoveryRun) {
      this.belongsTo(models.DiscoveryRun, {
        foreignKey: 'discovery_run_id',
        as: 'discoveryRun',
        onDelete: 'SET NULL',
      });
    }

    if (models.EvidenceConstructReview) {
      this.hasMany(models.EvidenceConstructReview, {
        foreignKey: 'revision_id',
        as: 'reviews',
      });
    }
  }
}

export default (sequelize: Sequelize) => {
  EvidenceConstructRevision.init(
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
      revision_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      content: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      evidence_snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      origin: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [['ai', 'researcher']],
        },
      },
      discovery_run_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'evidence_construct_revisions',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return EvidenceConstructRevision;
};

export type { EvidenceConstructRevision };
