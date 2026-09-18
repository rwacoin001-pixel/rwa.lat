import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm'
import { COMMUNITY_ERROR_CODES } from './community.errors'
import {
  CommunityComment,
  CommunityFollow,
  CommunityLike,
  CommunityPost,
  CommunityProfile,
  CommunityQueueItem,
  CommunityTopic,
} from './community.entities'
import {
  COMMUNITY_COMMENT_BODY_MAX,
  COMMUNITY_POST_BODY_MAX,
  decodeCursor,
  encodeCursor,
  isValidHandle,
  normalizeHandle,
  sanitizeImages,
  sanitizeTopics,
} from './community.util'
import {
  CommunityCommentsQueryDto,
  CommunityFeedQueryDto,
  CommunityFollowDto,
  CommunityLikeDto,
  EnqueueCommunityDto,
  PublishCommunityCommentDto,
  PublishCommunityPostDto,
  PublishDueCommunityQueueDto,
  ReviewCommunityQueueItemDto,
  UpsertCommunityProfileDto,
} from './dto/community.dto'

type QueuePayload = {
  body: string
  images?: string[]
  topics?: string[]
  postId?: string
  parentId?: string
  source?: string
}

const POST_SOURCE_VALUES = new Set(['original', 'rewrite', 'data', 'event', 'user', 'import'])

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name)

  constructor(
    @InjectRepository(CommunityProfile) private readonly profiles: Repository<CommunityProfile>,
    @InjectRepository(CommunityPost) private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityComment) private readonly comments: Repository<CommunityComment>,
    @InjectRepository(CommunityLike) private readonly likes: Repository<CommunityLike>,
    @InjectRepository(CommunityFollow) private readonly follows: Repository<CommunityFollow>,
    @InjectRepository(CommunityTopic) private readonly topics: Repository<CommunityTopic>,
    @InjectRepository(CommunityQueueItem) private readonly queue: Repository<CommunityQueueItem>,
    private readonly dataSource: DataSource,
  ) {}

  // ---- public reads ----

  async getFeed(query: CommunityFeedQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50)
    const sort = query.sort ?? 'latest'
    const qb = this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where("post.state = 'published'")
      .andWhere('post.published_at IS NOT NULL')
    if (query.topic) {
      qb.andWhere('post.topics @> CAST(:topicFilter AS jsonb)', {
        topicFilter: JSON.stringify([query.topic.trim().toLowerCase()]),
      })
    }
    if (sort === 'hot') {
      qb.orderBy('(post.like_count * 3 + post.comment_count * 5 + post.view_count)', 'DESC')
        .addOrderBy('post.published_at', 'DESC')
        .take(limit)
    } else {
      if (query.cursor) {
        const decoded = decodeCursor(query.cursor)
        if (!decoded) throw new BadRequestException(COMMUNITY_ERROR_CODES.CURSOR_INVALID)
        qb.andWhere('(post.published_at, post.id) < (:cursorTs, :cursorId)', {
          cursorTs: decoded.at,
          cursorId: decoded.id,
        })
      }
      qb.orderBy('post.published_at', 'DESC').addOrderBy('post.id', 'DESC').take(limit + 1)
    }
    const rows = await qb.getMany()
    let items = rows
    let nextCursor: string | null = null
    if (sort === 'latest' && rows.length > limit) {
      items = rows.slice(0, limit)
      const last = items[items.length - 1]
      nextCursor = encodeCursor(last.published_at as Date, last.id)
    }
    return { items: items.map((post) => this.shapePost(post)), nextCursor }
  }

  async getPost(id: string) {
    const post = await this.posts.findOne({ where: { id }, relations: { author: true } })
    if (!post || post.state !== 'published') throw new NotFoundException(COMMUNITY_ERROR_CODES.POST_NOT_FOUND)
    void this.posts.increment({ id: post.id }, 'view_count', 1).catch(() => undefined)
    const [comments, commentTotal] = await Promise.all([
      this.comments.find({
        where: { post_id: id, state: 'published' },
        relations: { author: true },
        order: { created_at: 'ASC' },
        take: 20,
      }),
      this.comments.count({ where: { post_id: id, state: 'published' } }),
    ])
    return { post: this.shapePost(post), comments: comments.map((comment) => this.shapeComment(comment)), commentTotal }
  }

  async listComments(postId: string, query: CommunityCommentsQueryDto) {
    const post = await this.posts.findOne({ where: { id: postId } })
    if (!post || post.state !== 'published') throw new NotFoundException(COMMUNITY_ERROR_CODES.POST_NOT_FOUND)
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 50)
    const qb = this.comments
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.post_id = :postId', { postId })
      .andWhere("comment.state = 'published'")
    if (query.before) {
      const decoded = decodeCursor(query.before)
      if (!decoded) throw new BadRequestException(COMMUNITY_ERROR_CODES.CURSOR_INVALID)
      qb.andWhere('(comment.created_at, comment.id) < (:cursorTs, :cursorId)', {
        cursorTs: decoded.at,
        cursorId: decoded.id,
      })
    }
    qb.orderBy('comment.created_at', 'DESC').addOrderBy('comment.id', 'DESC').take(limit + 1)
    const rows = await qb.getMany()
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextBefore = hasMore ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id) : null
    return { items: page.reverse().map((comment) => this.shapeComment(comment)), nextBefore }
  }

  async getProfile(handle: string) {
    const profile = await this.profiles.findOne({ where: { handle: normalizeHandle(handle) } })
    if (!profile || !profile.is_active) throw new NotFoundException(COMMUNITY_ERROR_CODES.PROFILE_NOT_FOUND)
    const [postCount, followerCount, followingCount, recent] = await Promise.all([
      this.posts.count({ where: { profile_id: profile.id, state: 'published' } }),
      this.follows.count({ where: { followee_id: profile.id } }),
      this.follows.count({ where: { follower_id: profile.id } }),
      this.posts.find({
        where: { profile_id: profile.id, state: 'published' },
        order: { published_at: 'DESC' },
        take: 20,
      }),
    ])
    return {
      profile: this.shapeProfile(profile, true),
      stats: { postCount, followerCount, followingCount },
      posts: recent.map((post) => this.shapePost({ ...post, author: profile } as CommunityPost)),
    }
  }

  async listTopics() {
    const topics = await this.topics.find({ order: { sort: 'ASC' } })
    return {
      items: topics.map((topic) => ({
        slug: topic.slug,
        title: topic.title,
        description: topic.description ?? null,
      })),
    }
  }

  // ---- internal (engine / operator) operations ----

  async upsertProfile(dto: UpsertCommunityProfileDto) {
    const handle = normalizeHandle(dto.handle)
    if (!isValidHandle(handle)) throw new BadRequestException(COMMUNITY_ERROR_CODES.PROFILE_HANDLE_INVALID)
    let profile = await this.profiles.findOne({ where: { handle } })
    if (!profile) profile = this.profiles.create({ handle })
    profile.display_name = dto.displayName.trim()
    profile.kind = dto.kind ?? profile.kind ?? 'persona'
    profile.avatar_url = dto.avatarUrl ?? profile.avatar_url ?? null
    profile.bio = dto.bio ?? profile.bio ?? null
    profile.city = dto.city ?? profile.city ?? null
    profile.country_code = dto.countryCode ? dto.countryCode.toUpperCase() : profile.country_code ?? null
    profile.timezone = dto.timezone ?? profile.timezone ?? null
    if (dto.persona) profile.persona = dto.persona
    if (dto.isActive !== undefined) profile.is_active = dto.isActive
    const saved = await this.profiles.save(profile)
    return this.shapeProfile(saved, true)
  }

  async publishPost(dto: PublishCommunityPostDto) {
    const profile = await this.resolveProfile(dto.handle)
    const body = dto.body.trim()
    if (!body || body.length > COMMUNITY_POST_BODY_MAX) throw new BadRequestException(COMMUNITY_ERROR_CODES.BODY_INVALID)
    const topics = sanitizeTopics(dto.topics, await this.topicSlugSet())
    const post = this.posts.create({
      profile_id: profile.id,
      body,
      images: sanitizeImages(dto.images),
      topics,
      source: dto.source && POST_SOURCE_VALUES.has(dto.source) ? dto.source : 'original',
      state: 'published',
      published_at: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
    })
    const saved = await this.posts.save(post)
    return this.shapePost({ ...saved, author: profile } as CommunityPost)
  }

  async publishComment(postId: string, dto: PublishCommunityCommentDto) {
    const profile = await this.resolveProfile(dto.handle)
    const body = dto.body.trim()
    if (!body || body.length > COMMUNITY_COMMENT_BODY_MAX) throw new BadRequestException(COMMUNITY_ERROR_CODES.BODY_INVALID)
    const post = await this.posts.findOne({ where: { id: postId } })
    if (!post || post.state !== 'published') throw new NotFoundException(COMMUNITY_ERROR_CODES.POST_NOT_FOUND)
    await this.assertParentComment(post.id, dto.parentId)
    const comment = this.comments.create({
      post_id: post.id,
      profile_id: profile.id,
      parent_id: dto.parentId ?? null,
      body,
    })
    const saved = await this.comments.save(comment)
    await this.posts.increment({ id: post.id }, 'comment_count', 1)
    return this.shapeComment({ ...saved, author: profile } as CommunityComment)
  }

  async like(dto: CommunityLikeDto) {
    const profile = await this.resolveProfile(dto.handle)
    await this.assertLikeTarget(dto.targetType, dto.targetId)
    try {
      await this.likes.insert({ profile_id: profile.id, target_type: dto.targetType, target_id: dto.targetId })
    } catch (error) {
      if (this.isUniqueViolation(error)) return { created: false }
      throw error
    }
    await this.bumpTargetLikeCount(dto.targetType, dto.targetId, 1)
    return { created: true }
  }

  async unlike(dto: CommunityLikeDto) {
    const profile = await this.resolveProfile(dto.handle)
    const result = await this.likes.delete({ profile_id: profile.id, target_type: dto.targetType, target_id: dto.targetId })
    if (!result.affected) return { removed: false }
    await this.bumpTargetLikeCount(dto.targetType, dto.targetId, -1)
    return { removed: true }
  }

  async follow(dto: CommunityFollowDto) {
    const follower = await this.resolveProfile(dto.follower)
    const followee = await this.resolveProfile(dto.followee)
    if (follower.id === followee.id) throw new BadRequestException(COMMUNITY_ERROR_CODES.FOLLOW_SELF)
    try {
      await this.follows.insert({ follower_id: follower.id, followee_id: followee.id })
    } catch (error) {
      if (this.isUniqueViolation(error)) return { created: false }
      throw error
    }
    return { created: true }
  }

  async enqueue(dto: EnqueueCommunityDto, createdBy: string) {
    const created: string[] = []
    for (const item of dto.items) {
      const profile = await this.resolveProfile(item.profileHandle, false)
      const payload: QueuePayload = {
        body: item.body.trim(),
        images: item.images,
        topics: item.topics,
        postId: item.postId,
        parentId: item.parentId,
        source: item.source,
      }
      if (item.kind === 'comment' && !item.postId) {
        throw new BadRequestException(COMMUNITY_ERROR_CODES.QUEUE_PAYLOAD_INVALID)
      }
      const row = this.queue.create({
        profile_id: profile.id,
        kind: item.kind,
        payload: payload as unknown as Record<string, unknown>,
        source: item.source ?? 'original',
        state: 'draft',
        scheduled_for: item.scheduledFor ? new Date(item.scheduledFor) : null,
        created_by: createdBy,
      })
      const saved = await this.queue.save(row)
      created.push(saved.id)
    }
    return { queued: created.length, ids: created }
  }

  async listQueue(state?: string, limit = 100) {
    const where = state ? { state: state as CommunityQueueItem['state'] } : {}
    const items = await this.queue.find({
      where,
      relations: { profile: true },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    })
    return { items: items.map((item) => this.shapeQueueItem(item)) }
  }

  async reviewQueueItem(id: string, dto: ReviewCommunityQueueItemDto) {
    const item = await this.queue.findOne({ where: { id }, relations: { profile: true } })
    if (!item) throw new NotFoundException(COMMUNITY_ERROR_CODES.QUEUE_ITEM_NOT_FOUND)
    if (item.state !== 'draft' && item.state !== 'approved') {
      throw new BadRequestException(COMMUNITY_ERROR_CODES.QUEUE_STATE_INVALID)
    }
    item.state = dto.action === 'approve' ? 'approved' : 'rejected'
    item.reviewed_by = dto.reviewer
    item.reviewed_at = new Date()
    item.review_note = dto.note ?? null
    if (dto.scheduledFor) item.scheduled_for = new Date(dto.scheduledFor)
    const saved = await this.queue.save(item)
    return this.shapeQueueItem(saved)
  }

  async publishDueQueueItems(dto: PublishDueCommunityQueueDto) {
    const limit = Math.min(Math.max(dto.limit ?? 50, 1), 200)
    const items = await this.queue
      .createQueryBuilder('item')
      .where("item.state = 'approved'")
      .andWhere('(item.scheduled_for IS NULL OR item.scheduled_for <= now())')
      .orderBy('item.scheduled_for', 'ASC', 'NULLS FIRST')
      .addOrderBy('item.created_at', 'ASC')
      .take(limit)
      .getMany()
    let published = 0
    let failed = 0
    const publishedIds: string[] = []
    for (const item of items) {
      const result = await this.publishQueueItem(item)
      if (result.ok) {
        published += 1
        publishedIds.push(result.postId ?? result.commentId ?? item.id)
      } else {
        failed += 1
      }
    }
    return { published, failed, publishedIds }
  }

  async stats() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000)
    const [profiles, posts, comments, queuePending, postsLast24h] = await Promise.all([
      this.profiles.count({ where: { is_active: true } }),
      this.posts.count({ where: { state: 'published' } }),
      this.comments.count({ where: { state: 'published' } }),
      this.queue.count({ where: { state: 'draft' } }),
      this.posts
        .createQueryBuilder('post')
        .where("post.state = 'published'")
        .andWhere('post.published_at >= :dayAgo', { dayAgo })
        .getCount(),
    ])
    return { profiles, posts, comments, queuePending, postsLast24h }
  }

  // ---- internals ----

  private async publishQueueItem(item: CommunityQueueItem): Promise<{ ok: boolean; postId?: string; commentId?: string }> {
    const payload = item.payload as unknown as QueuePayload
    try {
      if (item.kind === 'post') {
        const post = await this.dataSource.transaction(async (manager) => {
          const topics = await this.topicSlugSet(manager)
          const row = manager.create(CommunityPost, {
            profile_id: item.profile_id,
            body: payload.body,
            images: sanitizeImages(payload.images),
            topics: sanitizeTopics(payload.topics, topics),
            source: payload.source ?? item.source ?? 'original',
            state: 'published',
            published_at: item.scheduled_for ?? new Date(),
          })
          return manager.save(row)
        })
        await this.queue.update({ id: item.id }, { state: 'published', result_post_id: post.id, attempts: item.attempts + 1 })
        return { ok: true, postId: post.id }
      }
      const postId = payload.postId as string
      const comment = await this.dataSource.transaction(async (manager) => {
        const post = await manager.findOne(CommunityPost, { where: { id: postId } })
        if (!post || post.state !== 'published') throw new Error(COMMUNITY_ERROR_CODES.POST_NOT_FOUND)
        if (payload.parentId) {
          const parent = await manager.findOne(CommunityComment, { where: { id: payload.parentId } })
          if (!parent || parent.post_id !== post.id) throw new Error(COMMUNITY_ERROR_CODES.COMMENT_PARENT_INVALID)
        }
        const row = manager.create(CommunityComment, {
          post_id: post.id,
          profile_id: item.profile_id,
          parent_id: payload.parentId ?? null,
          body: payload.body,
        })
        const saved = await manager.save(row)
        await manager.increment(CommunityPost, { id: post.id }, 'comment_count', 1)
        return saved
      })
      await this.queue.update({ id: item.id }, { state: 'published', result_comment_id: comment.id, attempts: item.attempts + 1 })
      return { ok: true, commentId: comment.id }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 240) : 'publish failed'
      this.logger.warn(`Queue item ${item.id} publish failed: ${message}`)
      await this.queue.update({ id: item.id }, { state: 'failed', attempts: item.attempts + 1, review_note: message })
      return { ok: false }
    }
  }

  private async resolveProfile(handle: string, requireActive = true): Promise<CommunityProfile> {
    const profile = await this.profiles.findOne({ where: { handle: normalizeHandle(handle) } })
    if (!profile) throw new NotFoundException(COMMUNITY_ERROR_CODES.PROFILE_NOT_FOUND)
    if (requireActive && !profile.is_active) throw new BadRequestException(COMMUNITY_ERROR_CODES.PROFILE_INACTIVE)
    return profile
  }

  private async assertParentComment(postId: string, parentId?: string) {
    if (!parentId) return
    const parent = await this.comments.findOne({ where: { id: parentId } })
    if (!parent || parent.post_id !== postId || parent.state !== 'published') {
      throw new BadRequestException(COMMUNITY_ERROR_CODES.COMMENT_PARENT_INVALID)
    }
  }

  private async assertLikeTarget(targetType: 'post' | 'comment', targetId: string) {
    if (targetType === 'post') {
      const post = await this.posts.findOne({ where: { id: targetId } })
      if (!post || post.state !== 'published') throw new NotFoundException(COMMUNITY_ERROR_CODES.TARGET_NOT_FOUND)
      return
    }
    const comment = await this.comments.findOne({ where: { id: targetId } })
    if (!comment || comment.state !== 'published') throw new NotFoundException(COMMUNITY_ERROR_CODES.TARGET_NOT_FOUND)
  }

  private async bumpTargetLikeCount(targetType: 'post' | 'comment', targetId: string, delta: 1 | -1) {
    if (delta === 1) {
      if (targetType === 'post') await this.posts.increment({ id: targetId }, 'like_count', 1)
      else await this.comments.increment({ id: targetId }, 'like_count', 1)
      return
    }
    const target = targetType === 'post' ? this.posts : this.comments
    await target
      .createQueryBuilder()
      .update()
      .set({ like_count: () => 'GREATEST(like_count - 1, 0)' })
      .where('id = :id', { id: targetId })
      .execute()
  }

  private async topicSlugSet(manager?: EntityManager): Promise<Set<string>> {
    const repo = manager ? manager.getRepository(CommunityTopic) : this.topics
    const rows = await repo.find({ select: { slug: true } })
    return new Set(rows.map((row) => row.slug))
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error as { code?: string }).code === '23505'
  }

  private shapeProfile(profile: CommunityProfile, full = false) {
    return {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.display_name,
      kind: profile.kind,
      avatarUrl: profile.avatar_url ?? null,
      bio: profile.bio ?? null,
      city: profile.city ?? null,
      countryCode: profile.country_code ?? null,
      ...(full ? { timezone: profile.timezone ?? null } : {}),
    }
  }

  private shapePost(post: CommunityPost) {
    return {
      id: post.id,
      body: post.body,
      images: post.images ?? [],
      topics: post.topics ?? [],
      likeCount: post.like_count,
      commentCount: post.comment_count,
      viewCount: post.view_count,
      publishedAt: post.published_at,
      author: post.author ? this.shapeProfile(post.author) : null,
    }
  }

  private shapeComment(comment: CommunityComment) {
    return {
      id: comment.id,
      postId: comment.post_id,
      parentId: comment.parent_id ?? null,
      body: comment.body,
      likeCount: comment.like_count,
      createdAt: comment.created_at,
      author: comment.author ? this.shapeProfile(comment.author) : null,
    }
  }

  private shapeQueueItem(item: CommunityQueueItem) {
    return {
      id: item.id,
      kind: item.kind,
      state: item.state,
      source: item.source,
      scheduledFor: item.scheduled_for ?? null,
      reviewNote: item.review_note ?? null,
      reviewedBy: item.reviewed_by ?? null,
      attempts: item.attempts,
      resultPostId: item.result_post_id ?? null,
      resultCommentId: item.result_comment_id ?? null,
      createdAt: item.created_at,
      profile: item.profile ? this.shapeProfile(item.profile, true) : null,
      payload: item.payload,
    }
  }
}
