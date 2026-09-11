/**
 * ArtifactSection — Editable prose/structured content per artifact section.
 *
 * Stores the canonical editable content for Brief and Plan document sections.
 * Prose is stored as Markdown (not raw editor HTML). Structured sections
 * (risks, segments) are stored as typed JSON.
 *
 * study_variables remains the cascade projection for structured domain values
 * (objectives, questions, barriers). artifact_sections stores artifact body
 * content — a separate concern.
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

export type SectionContentType = 'prose' | 'structured_json';

class ArtifactSection extends Model<
  InferAttributes<ArtifactSection>,
  InferCreationAttributes<ArtifactSection>
> {
  declare id: CreationOptional<number>;
  declare artifact_id: ForeignKey<number>;
  declare section_key: string;
  declare content_type: CreationOptional<SectionContentType>;
  declare content: string | null;
  declare updated_at: CreationOptional<Date>;
  declare updated_by: string | null;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.ResearchArtifact, {
      foreignKey: 'artifact_id',
      as: 'artifact',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  ArtifactSection.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      artifact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'research_artifacts', key: 'id' },
      },
      section_key: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      content_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'prose',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      tableName: 'artifact_sections',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return ArtifactSection;
};

export type { ArtifactSection };
