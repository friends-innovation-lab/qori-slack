/**
 * CommentMessage Model — CMT-1
 *
 * Messages belong to threads. The first message is created atomically
 * with the thread (no empty threads). Messages can be edited by their
 * author using optimistic concurrency control (expected_updated_at).
 *
 * No hard delete. Messages are immutable once created except for body edits.
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

class CommentMessage extends Model<
  InferAttributes<CommentMessage>,
  InferCreationAttributes<CommentMessage>
> {
  declare id: CreationOptional<string>;
  declare thread_id: ForeignKey<string>;
  declare author_id: ForeignKey<number>;
  declare body: string;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Association mixins
  declare getThread: BelongsToGetAssociationMixin<import('./comment_thread').CommentThread>;
  declare thread?: NonAttribute<import('./comment_thread').CommentThread>;

  declare getAuthor: BelongsToGetAssociationMixin<import('./actor').Actor>;
  declare author?: NonAttribute<import('./actor').Actor>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.CommentThread, {
      foreignKey: 'thread_id',
      as: 'thread',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'author_id',
      as: 'author',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  CommentMessage.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      thread_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'comment_threads', key: 'id' },
      },
      author_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
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
    },
    {
      tableName: 'comment_messages',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return CommentMessage;
};

export type { CommentMessage };
