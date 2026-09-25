/**
 * CommentThreadEvent Model — CMT-1
 *
 * Events are append-only audit trail for thread lifecycle:
 * - created: Thread was created (with initial message)
 * - resolved: Thread was resolved
 * - reopened: Thread was reopened after resolution
 *
 * Historical resolution events are preserved when a thread is reopened.
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

export type CommentThreadEventType = 'created' | 'resolved' | 'reopened';

class CommentThreadEvent extends Model<
  InferAttributes<CommentThreadEvent>,
  InferCreationAttributes<CommentThreadEvent>
> {
  declare id: CreationOptional<string>;
  declare thread_id: ForeignKey<string>;
  declare event_type: CommentThreadEventType;
  declare actor_id: ForeignKey<number>;
  declare created_at: CreationOptional<Date>;

  // Association mixins
  declare getThread: BelongsToGetAssociationMixin<import('./comment_thread').CommentThread>;
  declare thread?: NonAttribute<import('./comment_thread').CommentThread>;

  declare getActor: BelongsToGetAssociationMixin<import('./actor').Actor>;
  declare actor?: NonAttribute<import('./actor').Actor>;

  static associate(models: Record<string, any>) {
    this.belongsTo(models.CommentThread, {
      foreignKey: 'thread_id',
      as: 'thread',
      onDelete: 'CASCADE',
    });

    this.belongsTo(models.Actor, {
      foreignKey: 'actor_id',
      as: 'actor',
      onDelete: 'CASCADE',
    });
  }
}

export default (sequelize: Sequelize) => {
  CommentThreadEvent.init(
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
      event_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [['created', 'resolved', 'reopened']],
        },
      },
      actor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'comment_thread_events',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return CommentThreadEvent;
};

export type { CommentThreadEvent };
