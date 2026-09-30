import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ schema: 'app', name: 'ai_chat_sessions' })
export class AiChatSession {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null

  @Column({ type: 'text', default: 'New conversation' })
  title!: string

  @Column({ name: 'context_json', type: 'jsonb', default: () => "'{}'" })
  contextJson!: Record<string, unknown>

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null
}
