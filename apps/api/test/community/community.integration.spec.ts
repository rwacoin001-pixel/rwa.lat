import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('community schema', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    await dataSource.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  async function createProfile(tag: string) {
    const [profile] = await dataSource.query(
      `INSERT INTO app.community_profiles (id, handle, display_name, kind, city, country_code, timezone)
       VALUES ($1, $2, $3, 'persona', 'Vancouver', 'CA', 'America/Vancouver') RETURNING id, handle`,
      [randomUUID(), `t${tag}-${randomUUID().slice(0, 8)}`, `Tester ${tag}`],
    )
    return profile
  }

  async function createPost(profileId: string, overrides: Record<string, unknown> = {}) {
    const state = (overrides.state as string) ?? 'published'
    const publishedAt = overrides.publishedAt === null ? null : (overrides.publishedAt as Date) ?? new Date()
    const topics = JSON.stringify(overrides.topics ?? ['ai-compute'])
    const [post] = await dataSource.query(
      `INSERT INTO app.community_posts (id, profile_id, body, topics, state, published_at)
       VALUES ($1, $2, 'hello community', $3::jsonb, $4, $5) RETURNING id`,
      [randomUUID(), profileId, topics, state, publishedAt],
    )
    return post
  }

  it('seeds the community topics', async () => {
    const rows = (await dataSource.query(`SELECT slug FROM app.community_topics ORDER BY sort`)) as Array<{ slug: string }>
    const slugs = rows.map((row) => row.slug)
    for (const expected of ['ai-compute', 'rwa', 'market', 'newbie', 'security', 'community', 'lounge']) {
      expect(slugs).toContain(expected)
    }
  })

  it('enforces unique handles', async () => {
    const profile = await createProfile('uniq')
    await expect(
      dataSource.query(
        `INSERT INTO app.community_profiles (id, handle, display_name) VALUES ($1, $2, 'Duplicate')`,
        [randomUUID(), profile.handle],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('requires published posts to carry a published_at timestamp', async () => {
    const profile = await createProfile('pub')
    await expect(createPost(profile.id, { state: 'published', publishedAt: null })).rejects.toMatchObject({ code: '23514' })
    const post = await createPost(profile.id, { state: 'published', publishedAt: new Date() })
    expect(post.id).toBeDefined()
  })

  it('filters posts by topic via jsonb containment', async () => {
    const profile = await createProfile('topic')
    const marker = randomUUID().slice(0, 8)
    await dataSource.query(
      `INSERT INTO app.community_posts (id, profile_id, body, topics, state, published_at)
       VALUES ($1, $2, $3, '["rwa"]'::jsonb, 'published', now())`,
      [randomUUID(), profile.id, `rwa marker ${marker}`],
    )
    const rows = (await dataSource.query(
      `SELECT body FROM app.community_posts WHERE state = 'published' AND topics @> $1::jsonb AND body LIKE $2`,
      [JSON.stringify(['rwa']), `%${marker}%`],
    )) as Array<{ body: string }>
    expect(rows).toHaveLength(1)
  })

  it('deduplicates likes per profile and target and rejects self follows', async () => {
    const profile = await createProfile('like')
    const post = await createPost(profile.id)
    await dataSource.query(
      `INSERT INTO app.community_likes (id, profile_id, target_type, target_id) VALUES ($1, $2, 'post', $3)`,
      [randomUUID(), profile.id, post.id],
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.community_likes (id, profile_id, target_type, target_id) VALUES ($1, $2, 'post', $3)`,
        [randomUUID(), profile.id, post.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })

    await expect(
      dataSource.query(
        `INSERT INTO app.community_follows (id, follower_id, followee_id) VALUES ($1, $2, $2)`,
        [randomUUID(), profile.id],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('validates queue states and payload requirements at the database boundary', async () => {
    const profile = await createProfile('queue')
    await expect(
      dataSource.query(
        `INSERT INTO app.community_content_queue (id, profile_id, kind, payload, state)
         VALUES ($1, $2, 'post', '{}'::jsonb, 'bogus')`,
        [randomUUID(), profile.id],
      ),
    ).rejects.toMatchObject({ code: '23514' })

    const [item] = await dataSource.query(
      `INSERT INTO app.community_content_queue (id, profile_id, kind, payload, state)
       VALUES ($1, $2, 'post', '{"body":"draft"}'::jsonb, 'draft') RETURNING id, state`,
      [randomUUID(), profile.id],
    )
    expect(item.state).toBe('draft')
  })

  it('cascades comments when a post is removed', async () => {
    const profile = await createProfile('cascade')
    const post = await createPost(profile.id)
    await dataSource.query(
      `INSERT INTO app.community_comments (id, post_id, profile_id, body) VALUES ($1, $2, $3, 'first!')`,
      [randomUUID(), post.id, profile.id],
    )
    await dataSource.query(`DELETE FROM app.community_posts WHERE id = $1`, [post.id])
    const remaining = (await dataSource.query(`SELECT count(*)::int AS count FROM app.community_comments WHERE post_id = $1`, [post.id])) as Array<{ count: number }>
    expect(remaining[0].count).toBe(0)
  })
})
