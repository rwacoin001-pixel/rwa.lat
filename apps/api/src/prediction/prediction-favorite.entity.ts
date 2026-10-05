import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 用户收藏的预测事件（事件页标题右上角的星标）。
 * 纯加法：只新增一张表与索引，不涉及投注/派彩/费率/结算任何逻辑。
 */
@Entity({ schema: 'app', name: 'prediction_favorites' })
@Index('prediction_favorites_user_event_uq', ['userId', 'eventId'], { unique: true })
export class PredictionFavorite {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  /** 外部事件 id（字符串，来自 Polymarket 的事件 id；不建外键 ✗） */
  @Column({ name: 'event_id', type: 'text' })
  eventId!: string

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
