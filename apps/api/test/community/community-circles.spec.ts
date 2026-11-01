import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DataSource, EntityManager } from 'typeorm'
import { circleRole } from '../../src/community/community-circle.access'
import { CircleNameDto } from '../../src/community/community-circle.dto'
import { CommunityCircleService } from '../../src/community/community-circle.service'
import { CommunityMemberService } from '../../src/community/community-member.service'
import { MemberPostDto } from '../../src/community/community-member.dto'
import { CommunityService } from '../../src/community/community.service'
import { CommunityPost } from '../../src/community/community.entities'

const OWNER = '00000000-0000-4000-8000-0000000000a1'
const MEMBER = '00000000-0000-4000-8000-0000000000a2'
const OUTSIDER = '00000000-0000-4000-8000-0000000000a3'
const CIRCLE = '00000000-0000-4000-8000-0000000000c1'
const POST = '00000000-0000-4000-8000-0000000000b1'
const OWNER_PROFILE = '00000000-0000-4000-8000-0000000000d1'
const MEMBER_PROFILE = '00000000-0000-4000-8000-0000000000d2'

type Answer = (sql: string, args: unknown[]) => unknown[] | undefined
/** A database whose answers are chosen per statement; unexpected SQL fails loudly. */
function fakeDb(answer: Answer) {
  const calls: Array<{ sql: string; args: unknown[] }> = []
  const query = jest.fn(async (sql: string, args: unknown[] = []) => {
    calls.push({ sql, args })
    if (sql.includes('pg_advisory_xact_lock')) return []
    const rows = answer(sql, args)
    if (rows === undefined) throw new Error(`Unexpected query: ${sql.slice(0, 120)}`)
    return rows
  })
  const manager = { query } as unknown as EntityManager
  const db = { query, transaction: (work: (m: EntityManager) => unknown) => work(manager) } as unknown as DataSource
  return { db, query, calls }
}
const roleSql = (sql: string) => sql.includes('FROM app.community_circles c WHERE c.id=$1 AND c.deleted_at IS NULL') && sql.includes('AS owner')
const roleFor = (role: 'owner' | 'member' | null) => role === null ? [] : [{ owner: role === 'owner', member: role === 'member' }]

describe('circle membership role', () => {
  it('maps the SQL answer to owner, member or nobody, and anonymous is nobody', async () => {
    for (const role of ['owner', 'member', null] as const) {
      const { db } = fakeDb(sql => roleSql(sql) ? roleFor(role) : undefined)
      expect(await circleRole(db, CIRCLE, MEMBER)).toBe(role)
    }
    const { db, query } = fakeDb(() => undefined)
    expect(await circleRole(db, CIRCLE, undefined)).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })
  it('walks the referral tree upward with a depth cap and cycle guard, and honours opt-outs', async () => {
    const { db, calls } = fakeDb(sql => roleSql(sql) ? roleFor('member') : undefined)
    await circleRole(db, CIRCLE, MEMBER)
    const sql = calls[0].sql
    expect(sql).toContain('WITH RECURSIVE up')
    expect(sql).toContain('up.depth<64')
    expect(sql).toContain('NOT e.inviter_user_id=ANY(up.path)')
    expect(sql).toContain('app.community_circle_optouts')
    expect(sql).not.toMatch(/depth\s*=\s*1\b/) // not limited to direct invitees
  })
})

describe('circle name validation', () => {
  const errors = (name: unknown) => validateSync(plainToInstance(CircleNameDto, { name }))
  it('trims and accepts 2-20 characters', () => {
    expect(plainToInstance(CircleNameDto, { name: '  考拉小队  ' }).name).toBe('考拉小队')
    for (const name of ['ab', 'a'.repeat(20), '考拉', '😀😀']) expect(errors(name)).toEqual([])
  })
  it('rejects short, long, blank and control-character names', () => {
    for (const name of ['', ' a ', 'a'.repeat(21), 'ab\ncd', 'ab\u0000', 'a​b', 12]) expect(errors(name).length).toBeGreaterThan(0)
  })
})

describe('public reads never expose circle posts', () => {
  function publicService(post: Record<string, unknown> | null, roleRows: unknown[]) {
    const { db } = fakeDb(sql => roleSql(sql) ? roleRows : undefined)
    const svc = Object.create(CommunityService.prototype) as CommunityService
    Object.assign(svc, {
      dataSource: db,
      storage: undefined,
      posts: { findOne: async () => post, increment: async () => undefined, manager: { connection: {} } },
      comments: { find: async () => [], count: async () => 0, createQueryBuilder: () => { throw new Error('should not list comments') } },
    })
    return svc
  }
  const circlePost = { id: POST, state: 'published', circle_id: CIRCLE, body: 'members only', author: null }

  it('answers 404 to anonymous viewers, outsiders and ex-members, for the post and its comments', async () => {
    for (const viewer of [undefined, OUTSIDER]) {
      const svc = publicService(circlePost, [])
      await expect(svc.getPost(POST, viewer)).rejects.toMatchObject({ status: 404 })
      await expect(svc.listComments(POST, {}, viewer)).rejects.toMatchObject({ status: 404 })
    }
  })
  it('shows the post to the owner and to members', async () => {
    for (const role of ['owner', 'member'] as const) {
      const svc = publicService(circlePost, roleFor(role))
      ;(svc as unknown as { posts: { manager: { connection: unknown } } }).posts.manager.connection = { query: async () => [{ ready: false }] }
      const found = await svc.getPost(POST, MEMBER)
      expect(found.post).toMatchObject({ id: POST, body: 'members only' })
    }
  })
  it('keeps circle posts out of the public feed, profile pages and stats', async () => {
    const where: string[] = []
    const qb = {
      leftJoinAndSelect: () => qb, where: () => qb, orderBy: () => qb, addOrderBy: () => qb, addSelect: () => qb, take: () => qb,
      andWhere: (clause: string) => { where.push(clause); return qb }, getMany: async () => [], getCount: async () => 0,
    }
    const profileFinds: Array<Record<string, unknown>> = []
    const svc = Object.create(CommunityService.prototype) as CommunityService
    Object.assign(svc, {
      storage: undefined,
      posts: { createQueryBuilder: () => qb, manager: { connection: { query: async () => [] } },
        count: async (o: { where: Record<string, unknown> }) => { profileFinds.push(o.where); return 0 },
        find: async (o: { where: Record<string, unknown> }) => { profileFinds.push(o.where); return [] } },
      comments: { count: async () => 0 }, profiles: { count: async () => 0, findOne: async () => ({ id: 'p', is_active: true, handle: 'h', display_name: 'n', kind: 'member', identity_configured: true, avatar_url: null }) },
      follows: { count: async () => 0 }, queue: { count: async () => 0 }, dataSource: { query: async () => [] },
    })
    await svc.getFeed({ sort: 'latest' })
    await svc.getFeed({ sort: 'hot' })
    expect(where.filter(c => c === 'post.circle_id IS NULL')).toHaveLength(2)
    await svc.getProfile('someone')
    expect(profileFinds).toHaveLength(2)
    for (const w of profileFinds) expect(w).toHaveProperty('circle_id')
    await svc.stats()
    expect(where).toContain('post.circle_id IS NULL')
    // a circle's own feed filters by its id instead
    where.length = 0
    await svc.getFeed({ sort: 'latest' }, undefined, CIRCLE)
    expect(where).toContain('post.circle_id = :circleId')
    expect(where).not.toContain('post.circle_id IS NULL')
  })
})

describe('only members post, reply and like inside a circle', () => {
  function memberService(role: 'owner' | 'member' | null) {
    const saved: unknown[] = []
    const post = { id: POST, state: 'published', circle_id: CIRCLE, like_count: 0 }
    const profile = { id: MEMBER_PROFILE, user_id: MEMBER, identity_configured: true, is_active: true }
    const { query, calls } = fakeDb(sql => {
      if (roleSql(sql)) return roleFor(role)
      if (sql.includes('SELECT status FROM app.users')) return [{ status: 'active' }]
      if (sql.includes('community_user_intents')) return []
      return undefined
    })
    const repo = (entity: unknown) => ({
      findOne: async () => entity === CommunityPost ? post : null,
      findOneBy: async () => entity === CommunityPost ? post : profile,
      find: async () => [], existsBy: async () => false, insert: async () => undefined, delete: async () => undefined,
    })
    const manager = {
      query, getRepository: repo, create: (_e: unknown, v: unknown) => v,
      save: async (v: object) => { saved.push(v); return 'id' in v ? v : { ...v, id: POST } },
      increment: async () => undefined, decrement: async () => undefined,
    }
    const fake = { query, getRepository: repo, transaction: (work: (m: unknown) => unknown) => work(manager) } as unknown as DataSource
    return { svc: new CommunityMemberService(fake), saved, calls }
  }
  const location = { city: 'Singapore', countryCode: 'SG', source: 'device' as const }
  const key = '00000000-0000-4000-8000-0000000000e1'

  it('lets a member post to the circle and stores circle_id', async () => {
    const { svc, saved } = memberService('member')
    await svc.post(MEMBER, key, { location, body: 'hello circle', circleId: CIRCLE })
    expect(saved[0]).toMatchObject({ circle_id: CIRCLE, state: 'published' })
  })
  it('refuses posts from people outside the circle', async () => {
    const { svc, saved } = memberService(null)
    await expect(svc.post(OUTSIDER, key, { location, body: 'hello', circleId: CIRCLE })).rejects.toMatchObject({ status: 404 })
    expect(saved).toHaveLength(0)
  })
  it('ordinary posts carry no circle', async () => {
    const { svc, saved } = memberService(null)
    await svc.post(MEMBER, key, { location, body: 'public hello' })
    expect(saved[0]).toMatchObject({ circle_id: null })
  })
  it('refuses replies and likes on a circle post from non-members', async () => {
    const { svc } = memberService(null)
    await expect(svc.comment(OUTSIDER, key, POST, { body: 'hi' })).rejects.toMatchObject({ status: 404 })
    await expect(svc.like(OUTSIDER, POST, true)).rejects.toMatchObject({ status: 404 })
  })
  it('allows members to like a circle post', async () => {
    const { svc } = memberService('member')
    await expect(svc.like(MEMBER, POST, true)).resolves.toMatchObject({ liked: true })
  })
  it('accepts a circleId only as a UUID', () => {
    const base = { location, body: 'x' }
    expect(validateSync(plainToInstance(MemberPostDto, { ...base, circleId: CIRCLE }))).toEqual([])
    expect(validateSync(plainToInstance(MemberPostDto, { ...base, circleId: 'nope' })).length).toBeGreaterThan(0)
  })
})

describe('circle service', () => {
  const profileRow = { id: OWNER_PROFILE, user_id: OWNER }
  const circleRow = { id: CIRCLE, name: 'Koala', owner_user_id: OWNER, owner_profile_id: OWNER_PROFILE, created_at: new Date('2026-11-01T00:00:00Z') }
  const views = new Map([[OWNER_PROFILE, { id: OWNER_PROFILE, handle: 'owner', displayName: 'Owner' }]])
  function circles(overrides: Answer = () => undefined) {
    const fake = fakeDb((sql, args) => {
      const own = overrides(sql, args)
      if (own !== undefined) return own
      if (sql.includes('FROM app.community_profiles p JOIN app.users u')) return [profileRow]
      if (sql.includes('count(*)::int AS n')) return [{ n: 2 }]
      return undefined
    })
    const community = { profileViews: async () => views, getFeed: jest.fn(async () => ({ items: [], nextCursor: null })) } as unknown as CommunityService
    return { svc: new CommunityCircleService(fake.db, community), ...fake, community }
  }

  it('creates one circle with a member count that includes the owner', async () => {
    const { svc } = circles(sql => sql.includes('SELECT 1 FROM app.community_circles WHERE owner_user_id') ? [] : sql.includes('INSERT INTO app.community_circles') ? [circleRow] : undefined)
    expect(await svc.create(OWNER, 'Koala')).toMatchObject({ id: CIRCLE, name: 'Koala', isOwner: true, memberCount: 3, owner: { id: OWNER_PROFILE } })
  })
  it('answers 409 when the user already owns a circle', async () => {
    const { svc } = circles(sql => sql.includes('SELECT 1 FROM app.community_circles WHERE owner_user_id') ? [{ '?column?': 1 }] : undefined)
    await expect(svc.create(OWNER, 'Second')).rejects.toMatchObject({ status: 409 })
  })
  it('lets only the owner rename or delete; members get 403 and outsiders 404', async () => {
    for (const [role, status] of [['member', 403], [null, 404]] as const) {
      const { svc } = circles(sql => roleSql(sql) ? roleFor(role) : undefined)
      await expect(svc.rename(MEMBER, CIRCLE, 'New name')).rejects.toMatchObject({ status })
      await expect(svc.remove(MEMBER, CIRCLE)).rejects.toMatchObject({ status })
    }
    const { svc, calls } = circles(sql => roleSql(sql) ? roleFor('owner') : sql.includes('UPDATE app.community_circles SET deleted_at') ? [] : undefined)
    await expect(svc.remove(OWNER, CIRCLE)).resolves.toEqual({ id: CIRCLE, deleted: true })
    expect(calls.some(c => c.sql.includes('SET deleted_at=now()'))).toBe(true)
    expect(calls.some(c => /DELETE FROM app\.community_posts/i.test(c.sql))).toBe(false) // posts are hidden, never hard-deleted
  })
  it('serves the circle feed and member list only to members', async () => {
    const outsider = circles(sql => roleSql(sql) ? roleFor(null) : undefined)
    await expect(outsider.svc.feed(OUTSIDER, CIRCLE, {})).rejects.toMatchObject({ status: 404 })
    await expect(outsider.svc.members(OUTSIDER, CIRCLE, {})).rejects.toMatchObject({ status: 404 })
    const member = circles(sql => roleSql(sql) ? roleFor('member') : undefined)
    await member.svc.feed(MEMBER, CIRCLE, { limit: 5 })
    expect(member.community.getFeed).toHaveBeenCalledWith({ limit: 5, sort: 'latest', topic: undefined }, undefined, CIRCLE)
  })
  it('lists downline members at any depth with their depth, paged', async () => {
    const rows = [1, 2, 3].map(depth => ({ profile_id: `p${depth}`, depth }))
    const { svc, calls } = circles(sql => roleSql(sql) ? roleFor('member') : sql.includes('SELECT id,name,owner_user_id') ? [circleRow] : sql.includes('ORDER BY d.depth') ? rows : undefined)
    ;(svc as unknown as { community: { profileViews: () => Promise<Map<string, unknown>> } }).community.profileViews = async () => new Map(rows.map(r => [r.profile_id, { id: r.profile_id }]))
    const page = await svc.members(MEMBER, CIRCLE, { limit: 2 })
    expect(page.items.map(i => i.depth)).toEqual([1, 2])
    expect(page.nextCursor).toBe('o:2')
    const sql = calls.find(c => c.sql.includes('ORDER BY d.depth'))!.sql
    expect(sql).toContain('WITH RECURSIVE down')
    expect(sql).toContain('d.depth<64')
    expect(sql).toContain('community_circle_optouts')
    await expect(svc.members(MEMBER, CIRCLE, { cursor: 'bad' })).rejects.toMatchObject({ status: 400 })
  })
  it('leave: members opt out, the owner cannot, and leaving twice is fine', async () => {
    const member = circles(sql => roleSql(sql) ? roleFor('member') : sql.includes('SELECT reason FROM app.community_circle_optouts') ? [] : sql.includes('INSERT INTO app.community_circle_optouts') ? [] : undefined)
    await expect(member.svc.leave(MEMBER, CIRCLE)).resolves.toEqual({ id: CIRCLE, left: true })
    expect(member.calls.find(c => c.sql.includes('INSERT INTO app.community_circle_optouts'))!.sql).toContain("'left'")
    const owner = circles(sql => roleSql(sql) ? roleFor('owner') : sql.includes('SELECT reason') ? [] : undefined)
    await expect(owner.svc.leave(OWNER, CIRCLE)).rejects.toMatchObject({ status: 400 })
    const again = circles(sql => roleSql(sql) ? roleFor(null) : sql.includes('SELECT reason') ? [{ reason: 'left' }] : undefined)
    await expect(again.svc.leave(MEMBER, CIRCLE)).resolves.toEqual({ id: CIRCLE, left: true })
    const stranger = circles(sql => roleSql(sql) ? roleFor(null) : sql.includes('SELECT reason') ? [] : undefined)
    await expect(stranger.svc.leave(OUTSIDER, CIRCLE)).rejects.toMatchObject({ status: 404 })
  })
  it('rejoin: a leaver comes back, a removed member does not, an outsider cannot', async () => {
    const base = (reason: string | null, inDownline: boolean): Answer => sql =>
      sql.includes('SELECT id,name,owner_user_id') ? [circleRow]
      : sql.includes('SELECT reason FROM app.community_circle_optouts') ? (reason ? [{ reason }] : [])
      : sql.includes('SELECT 1 FROM up') ? (inDownline ? [{ '?column?': 1 }] : [])
      : sql.includes('DELETE FROM app.community_circle_optouts') ? [] : undefined
    const left = circles(base('left', true))
    await expect(left.svc.rejoin(MEMBER, CIRCLE)).resolves.toEqual({ id: CIRCLE, joined: true })
    expect(left.calls.some(c => c.sql.includes('DELETE FROM app.community_circle_optouts'))).toBe(true)
    await expect(circles(base('removed', true)).svc.rejoin(MEMBER, CIRCLE)).rejects.toMatchObject({ status: 403 })
    await expect(circles(base(null, false)).svc.rejoin(OUTSIDER, CIRCLE)).rejects.toMatchObject({ status: 404 })
  })
  it('remove member: owner only, target must be in the downline, never the owner', async () => {
    const answer = (role: 'owner' | 'member' | null, inDownline: boolean, target = MEMBER): Answer => sql =>
      roleSql(sql) ? roleFor(role)
      : sql.includes('SELECT user_id FROM app.community_profiles') ? [{ user_id: target }]
      : sql.includes('SELECT 1 FROM up') ? (inDownline ? [{ '?column?': 1 }] : [])
      : sql.includes('INSERT INTO app.community_circle_optouts') ? [] : undefined
    const ok = circles(answer('owner', true))
    await expect(ok.svc.removeMember(OWNER, CIRCLE, MEMBER_PROFILE)).resolves.toMatchObject({ removed: true })
    expect(ok.calls.find(c => c.sql.includes('INSERT INTO app.community_circle_optouts'))!.sql).toContain("'removed'")
    await expect(circles(answer('member', true)).svc.removeMember(MEMBER, CIRCLE, MEMBER_PROFILE)).rejects.toMatchObject({ status: 403 })
    await expect(circles(answer('owner', false)).svc.removeMember(OWNER, CIRCLE, MEMBER_PROFILE)).rejects.toMatchObject({ status: 404 })
    await expect(circles(answer('owner', true, OWNER)).svc.removeMember(OWNER, CIRCLE, OWNER_PROFILE)).rejects.toMatchObject({ status: 404 })
  })
})
