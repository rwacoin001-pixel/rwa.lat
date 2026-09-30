import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { CommunityMemberService } from '../../src/community/community-member.service'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Member publication with isolated PostgreSQL', () => {
  let db: DataSource, runner: QueryRunner, service: CommunityMemberService, userId: string
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize(); await db.runMigrations()
    const [connected] = await db.query('SELECT current_database() AS name')
    if (!connected.name.endsWith('_test')) throw new Error('Connected database is not isolated')
  })
  beforeEach(async () => {
    runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    userId = randomUUID(); await runner.query('INSERT INTO app.users(id) VALUES($1)', [userId])
    service = new CommunityMemberService({ query: (sql: string, args: unknown[]) => runner.query(sql, args), transaction: (work: any) => work(runner.manager) } as unknown as DataSource)
  })
  afterEach(async () => { await runner.rollbackTransaction(); await runner.release() })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })
  it('publishes as the authenticated member immediately and retries the same intent once', async () => {
    const key = randomUUID(); const input = { body: '公开的隔离测试帖子', topics: ['rwa'] }
    const a = await service.post(userId, key, input); const b = await service.post(userId, key, input)
    expect(b).toEqual({ id: a.id, duplicate: true })
    const [post] = await runner.query('SELECT p.state,p.source,u.user_id FROM app.community_posts p JOIN app.community_profiles u ON u.id=p.profile_id WHERE p.id=$1', [a.id])
    expect(post).toMatchObject({ state: 'published', source: 'user', user_id: userId })
    await expect(service.post(userId, key, { body: '不同内容' })).rejects.toThrow('another publication')
  })
  it('rejects blank writes, missing idempotency and inactive account writes', async () => {
    await expect(service.post(userId, randomUUID(), { body: '  ' })).rejects.toThrow('Invalid post')
    await expect(service.post(userId, undefined, { body: 'content' })).rejects.toThrow('Idempotency-Key')
    await runner.query("UPDATE app.users SET status='suspended' WHERE id=$1", [userId])
    await expect(service.post(userId, randomUUID(), { body: 'content' })).rejects.toThrow('Active account')
  })
  it('deduplicates replies and refuses replies on hidden posts', async () => {
    const post = await service.post(userId, randomUUID(), { body: 'content' }); const key = randomUUID()
    const comment = await service.comment(userId, key, post.id, { body: 'reply' })
    expect(await service.comment(userId, key, post.id, { body: 'reply' })).toMatchObject({ id: comment.id, duplicate: true })
    const [row] = await runner.query('SELECT comment_count FROM app.community_posts WHERE id=$1', [post.id])
    expect(row.comment_count).toBe(1)
    await service.moderate({ targetType: 'post', targetId: post.id, state: 'hidden', reason: 'test moderation' }, randomUUID())
    await expect(service.comment(userId, randomUUID(), post.id, { body: 'reply' })).rejects.toThrow('not public')
  })
  it('keeps like counts stable through repeat set/unset and persists the member state', async () => {
    const post = await service.post(userId, randomUUID(), { body: 'content' })
    expect(await service.like(userId, post.id, true)).toMatchObject({ likeCount: 1 })
    expect(await service.like(userId, post.id, true)).toMatchObject({ likeCount: 1 })
    expect(await service.state(userId, post.id)).toMatchObject({ liked: true })
    expect(await service.like(userId, post.id, false)).toMatchObject({ likeCount: 0 })
    expect(await service.like(userId, post.id, false)).toMatchObject({ likeCount: 0 })
  })
  it('attaches vetted images to posts and replies, allows image-only posts, and sets the avatar', async () => {
    const imageId = randomUUID(); const avatarId = randomUUID()
    const attachable = jest.fn(async (_user: string, ids: string[], purpose: string) => {
      if (purpose === 'avatar' && ids[0] !== avatarId) throw new Error('not an avatar')
      return ids
    })
    const readable = jest.fn(async (ids: string[]) => new Set(ids.filter(id => id !== avatarId)))
    const storage = { attachableCommunityImages: attachable, readableCommunityImageIds: readable }
    const media = new CommunityMemberService({ query: (sql: string, args: unknown[]) => runner.query(sql, args), transaction: (work: any) => work(runner.manager) } as unknown as DataSource, storage as any)
    const post = await media.post(userId, randomUUID(), { body: '', imageIds: [imageId] })
    const [row] = await runner.query('SELECT images FROM app.community_posts WHERE id=$1', [post.id])
    expect(row.images).toEqual([`/v1/community/media/${imageId}`])
    const reply = await media.comment(userId, randomUUID(), post.id, { body: 'with photo', imageIds: [imageId] })
    const [comment] = await runner.query('SELECT images FROM app.community_comments WHERE id=$1', [reply.id])
    expect(comment.images).toEqual([`/v1/community/media/${imageId}`])
    await expect(media.post(userId, randomUUID(), { body: '' })).rejects.toThrow('Invalid post')
    await expect(service.post(userId, randomUUID(), { body: 'x', imageIds: [imageId] })).rejects.toThrow('storage')
    // A freshly uploaded avatar stays hidden until the scan clears it.
    const pending = await media.setAvatar(userId, avatarId)
    expect(pending).toMatchObject({ avatarUrl: null, avatarPending: true })
    const [profile] = await runner.query('SELECT avatar_url FROM app.community_profiles WHERE user_id=$1', [userId])
    expect(profile.avatar_url).toBe(`/v1/community/media/${avatarId}`)
    readable.mockResolvedValueOnce(new Set([avatarId]))
    expect(await media.profile(userId)).toMatchObject({ avatarUrl: `/v1/community/media/${avatarId}`, avatarPending: false })
    expect(await media.setAvatar(userId, null)).toMatchObject({ avatarUrl: null, avatarPending: false })
  })
  it('records moderation reasons and adjusts published reply counts without deleting evidence', async () => {
    const post = await service.post(userId, randomUUID(), { body: 'content' })
    const comment = await service.comment(userId, randomUUID(), post.id, { body: 'reply' })
    const admin = randomUUID()
    await service.moderate({ targetType: 'comment', targetId: comment.id, state: 'hidden', reason: 'test reason' }, admin)
    await service.moderate({ targetType: 'comment', targetId: comment.id, state: 'hidden', reason: 'repeat' }, admin)
    const [row] = await runner.query('SELECT comment_count FROM app.community_posts WHERE id=$1', [post.id]); expect(row.comment_count).toBe(0)
    const [audit] = await runner.query("SELECT metadata FROM app.audit_logs WHERE actor_id=$1 AND action='community.moderate' ORDER BY occurred_at LIMIT 1", [admin]); expect(audit.metadata.reason).toBe('test reason')
    await service.moderate({ targetType: 'comment', targetId: comment.id, state: 'published', reason: 'restore' }, admin)
    const [restored] = await runner.query('SELECT comment_count FROM app.community_posts WHERE id=$1', [post.id]); expect(restored.comment_count).toBe(1)
  })
})
