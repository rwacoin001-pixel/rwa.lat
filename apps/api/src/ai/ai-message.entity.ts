import { Column, Entity, PrimaryColumn } from 'typeorm'

export type AiMessageRole = 'user' | 'assistant'

@Entity({ schema: 'app', name: 'ai_chat_messages' })
export class AiChatMessage {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string

  @Column({ type: 'varchar' })
  role!: AiMessageRole

  @Column({ type: 'text' })
  content!: string

  @Column({ name: 'citations_json', type: 'jsonb', nullable: true })
  citationsJson!: Record<string, unknown>[] | null

  @Column({ type: 'boolean', nullable: true })
  helpful!: boolean | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
