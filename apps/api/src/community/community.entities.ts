import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type CommunityProfileKind = 'persona' | 'member' | 'official'
export type CommunityPostState = 'draft' | 'scheduled' | 'published' | 'hidden' | 'removed'
export type CommunityCommentState = 'published' | 'hidden' | 'removed'
export type CommunityLikeTarget = 'post' | 'comment'
export type CommunityQueueKind = 'post' | 'comment'
export type CommunityQueueState = 'draft' | 'approved' | 'rejected' | 'published' | 'failed'

/**
 * A community identity. Personas are operator-run content accounts; members are
 * real users; official covers platform-branded accounts. The full persona
 * archive stays internal — the public shape only exposes presentation fields.
 */
@Entity({ schema: 'app', name: 'community_profiles' })
export class CommunityProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 32 })
  handle!: string

  @Column({ type: 'varchar', length: 64 })
  display_name!: string

  @Column({ type: 'varchar', default: 'persona' })
  kind!: CommunityProfileKind

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar_url?: string | null

  @Column({ type: 'varchar', length: 280, nullable: true })
  bio?: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  city?: string | null

  @Column({ type: 'char', length: 2, nullable: true })
  country_code?: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone?: string | null

  @Column({ type: 'jsonb', nullable: true })
  persona?: Record<string, unknown> | null

  @Column({ type: 'boolean', default: true })
  is_active!: boolean

  @Column({ type: 'uuid', nullable: true })
  user_id?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'community_topics' })
export class CommunityTopic {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 32 })
  slug!: string

  @Column({ type: 'varchar', length: 64 })
  title!: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  description?: string | null

  @Column({ type: 'int', default: 100 })
  sort!: number

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'community_posts' })
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  profile_id!: string

  @ManyToOne(() => CommunityProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  author?: CommunityProfile

  @Column({ type: 'text' })
  body!: string

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images!: string[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  topics!: string[]

  @Column({ type: 'varchar', length: 16, default: 'zh-Hans' })
  lang!: string

  @Column({ type: 'varchar', default: 'original' })
  source!: string

  @Column({ type: 'varchar', default: 'published' })
  state!: CommunityPostState

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_for?: Date | null

  @Column({ type: 'int', default: 0 })
  like_count!: number

  @Column({ type: 'int', default: 0 })
  comment_count!: number

  @Column({ type: 'int', default: 0 })
  view_count!: number

  @Column({ type: 'timestamptz', nullable: true })
  published_at?: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'community_comments' })
export class CommunityComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  post_id!: string

  @Column({ type: 'uuid' })
  profile_id!: string

  @ManyToOne(() => CommunityProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  author?: CommunityProfile

  @Column({ type: 'uuid', nullable: true })
  parent_id?: string | null

  @Column({ type: 'text' })
  body!: string

  @Column({ type: 'varchar', length: 16, default: 'zh-Hans' })
  lang!: string

  @Column({ type: 'int', default: 0 })
  like_count!: number

  @Column({ type: 'varchar', default: 'published' })
  state!: CommunityCommentState

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'community_likes' })
export class CommunityLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  profile_id!: string

  @Column({ type: 'varchar' })
  target_type!: CommunityLikeTarget

  @Column({ type: 'uuid' })
  target_id!: string

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'community_follows' })
export class CommunityFollow {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  follower_id!: string

  @Column({ type: 'uuid' })
  followee_id!: string

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'community_reports' })
export class CommunityReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar' })
  target_type!: 'post' | 'comment' | 'profile'

  @Column({ type: 'uuid' })
  target_id!: string

  @Column({ type: 'uuid', nullable: true })
  profile_id?: string | null

  @Column({ type: 'varchar', length: 280 })
  reason!: string

  @Column({ type: 'varchar', default: 'open' })
  state!: 'open' | 'reviewed' | 'dismissed'

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

/**
 * Content engineered by the operator pipeline (drafts from the content engine).
 * Items move draft -> approved -> published (or rejected/failed); publishing
 * materializes an actual post or comment through the same service path as
 * direct publishes so counters and audits stay consistent.
 */
@Entity({ schema: 'app', name: 'community_content_queue' })
export class CommunityQueueItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  profile_id!: string

  @ManyToOne(() => CommunityProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: CommunityProfile

  @Column({ type: 'varchar' })
  kind!: CommunityQueueKind

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>

  @Column({ type: 'varchar', default: 'engine' })
  source!: string

  @Column({ type: 'varchar', default: 'draft' })
  state!: CommunityQueueState

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_for?: Date | null

  @Column({ type: 'varchar', length: 280, nullable: true })
  review_note?: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  reviewed_by?: string | null

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at?: Date | null

  @Column({ type: 'int', default: 0 })
  attempts!: number

  @Column({ type: 'uuid', nullable: true })
  result_post_id?: string | null

  @Column({ type: 'uuid', nullable: true })
  result_comment_id?: string | null

  @Column({ type: 'varchar', length: 64, default: 'engine' })
  created_by!: string

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

/**
 * Cached translations of community posts/comments. One row per
 * (target, language); generated on demand by the public translate endpoint.
 */
@Entity({ schema: 'app', name: 'community_translations' })
export class CommunityTranslation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 16 })
  target_type!: 'post' | 'comment'

  @Column({ type: 'uuid' })
  target_id!: string

  @Column({ type: 'varchar', length: 16 })
  target_lang!: string

  @Column({ type: 'varchar', length: 16 })
  source_lang!: string

  @Column({ type: 'text' })
  body!: string

  @Column({ type: 'varchar', length: 32, nullable: true })
  provider?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
