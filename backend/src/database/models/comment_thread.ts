/**
 * CommentThread Model — CMT-1
 *
 * Threads anchor to artifact_id + section_key. They persist across artifact
 * version changes. If a section key becomes orphaned, threads remain but
 * are surfaced as orphaned in the API.
 *
 * Status lifecycle: open -> resolved -> open (reopen)
 */

import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type NonAttribute,
  type HasManyGetAssociationsMixin,
  type BelongsToGetAssociationMixin,
  type Sequelize,
} from 'sequelize';

export type CommentThreadStatus = 'open' | 'resolved';

class CommentThread extends Model<
  InferAttributes<CommentThread>,
  InferCreationAttributes<CommentThread>
> {
  declare id: CreationOptional<string>;
  declare study_id: ForeignKey<number>;
  declare artifact_id: ForeignKey<number>;
  declare section_key: string;
  declare status: CreationOptional<CommentThreadStatus>;
  declare created_by: ForeignKey<number>;
  declare created_at: CreationOptional<Date>;
  declare resolved_by: ForeignKey<number> | null;
  declare resolved_at: Date | null;

  // Association mixins
  declare getMessages: HasManyGetAssociationsMixin<import('./comment_message').CommentMessage>;
  declare messages?: NonAttribute<import('./comment_message').CommentMessage[]>;

  declare getEvents: HasManyGetAssociationsMixin<import('./comment_thread_event').CommentThreadEvent>;
  declare events?: NonAttribute<import('./comment_thread_event').CommentThreadEvent[]>;

  declare getCreator: BelongsToGetAssociationMixin<import('./actor').Actor>;
  declare creator?: NonAttribute<import('./actor').Actor>;

  declare getResolver: BelongsToGetAssociationMixin<import('./actor').Actor>;
  declare resolver?: NonAttribute<import('./actor').Actor>;

  declare getArtifact: BelongsToGetAssociationMixin<import('./research_artifact').ResearchArtifact>;
  declare artifact?: NonAttribute<import('./research_artifact').ResearchArtifact>;

  declare getStudy: BelongsToGetAssociationMixin<import('./research_study').ResearchStudy>;
  declare study?: NonAttribute<import('./research_study').ResearchStudy>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.ResearchStudy, {
      foreignKey: 'study_id',
      as: 'study',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.ResearchArtifact, {
      foreignKey: 'artifact_id',
      as: 'artifact',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'created_by',
      as: 'creator',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'resolved_by',
      as: 'resolver',
      onDelete: 'SET NULL',
    });

    if (models.CommentMessage) {
      this.hasMany(models.CommentMessage, {
        foreignKey: 'thread_id',
        as: 'messages',
        onDelete: 'CASCADE',
      });
    }

    if (models.CommentThreadEvent) {
      this.hasMany(models.CommentThreadEvent, {
        foreignKey: 'thread_id',
        as: 'events',
        onDelete: 'CASCADE',
      });
    }
  }
}

export default (sequelize: Sequelize) => {
  CommentThread.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      study_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'research_studies', key: 'id' },
      },
      artifact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'research_artifacts', key: 'id' },
      },
      section_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'open',
        validate: {
          isIn: [['open', 'resolved']],
        },
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      resolved_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'comment_threads',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return CommentThread;
};

export type { CommentThread };
