import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DataSource, EntityManager } from 'typeorm'
import { CircleInnerSearchQueryDto, CircleUpdateDto } from '../../src/community/community-circle.dto'
import { CommunityCircleService } from '../../src/community/community-circle.service'
import { CommunityMemberService } from '../../src/community/community-member.service'
import { CommunityService } from '../../src/community/community.service'
import { CommunityPost } from '../../src/community/community.entities'

const OWNER = '00000000-0000-4000-8000-0000000000a1'
const MEMBER = '00000000-0000-4000-8000-0000000000a2'
const OUTSIDER = '00000000-0000-4000-8000-0000000000a3'
const CIRCLE = '00000000-0000-4000-8000-0000000000c1'
const OTHER_CIRCLE = '00000000-0000-4000-8000-0000000000c2'
const POST = '00000000-0000-4000-8000-0000000000b1'
const MEMBER_PROFILE = '00000000-0000-4000-8000-0000000000d2'
const KEY = '00000000-0000-4000-8000-0000000000e1'
const circleRow = { id: CIRCLE, name: 'Koala', owner_user_id: OWNER, owner_profile_id: 'op', created_at: new Date('2026-11-01T00:00:00Z'), invite_code: 'AbCdEfGh_-', public_no: 123456, searchable: true, pinned_post_id: null }
const location = { city: 'Singapore', countryCode: 'SG', source: 'device' as const }

type Answer = (sql: string, args: unknown[]) => unknown[] | undefined
const first = (...fns: Answer[]): Answer => (sql, args) => { for (const f of fns) { const r = f(sql, args); if (r !== undefined) return r } return undefined }
const roleSql = (sql: string) => sql.includes('FROM app.community_circles c WHERE c.id=$1 AND c.deleted_at IS NULL') && sql.includes('AS owner')
const role = (r: 'owner' | 'member' | null): Answer => sql => roleSql(sql) ? (r === null ? [] : [{ owner: r === 'owner', member: r === 'member' }]) : undefined
const silencedRow = (silenced: boolean): Answer => sql => sql.startsWith('SELECT silenced FROM app.community_circle_member_settings') ? [{ silenced }] : undefined
const base: Answer = sql =>
  sql.includes('count(*)::int AS n') ? [{ n: 1 }]
  : sql.includes('INSERT INTO app.notifications') ? []
  : sql.includes('FROM app.community_circle_member_settings') || sql.includes('max(published_at)') ? []
  : undefined

function make(answer: Answer) {
  const calls: Array<{ sql: string; args: unknown[] }> = []
  const query = jest.fn(async (sql: string, args: unknown[] = []) => {
    calls.push({ sql, args })
    if (sql.includes('pg_advisory_xact_lock')) return []
    if (sql.includes('FROM app.community_profiles p JOIN app.users u')) return [{ id: 'me-profile', user_id: 'me' }]
    const rows = answer(sql, args)
    if (rows === undefined) throw new Error(`Unexpected query: ${sql.slice(0, 140)}`)
    return rows
  })
  const db = { query, transaction: (work: (m: EntityManager) => unknown) => work({ query } as unknown as EntityManager) } as unknown as DataSource
  const getFeed = jest.fn(async () => ({ items: [], nextCursor: null }))
  const community = { profileViews: async (ids: string[]) => new Map(ids.map(id => [id, { id }])), postViews: async () => new Map(), getFeed } as unknown as CommunityService
  return { svc: new CommunityCircleService(db, community), calls, getFeed, db }
}

describe('posting into a circle', () => {
  function memberService(r: 'owner' | 'member' | null, silenced = false) {
    const saved: Array<Record<string, unknown>> = []
    const { query, calls } = (() => {
      const c: Array<{ sql: string }> = []
      const q = jest.fn(async (sql: string) => {
        c.push({ sql })
        if (sql.includes('pg_advisory_xact_lock')) return []
        const rows = first(role(r), silencedRow(silenced), s => s.includes('SELECT status FROM app.users') ? [{ status: 'active' }] : s.includes('community_user_intents') ? [] : undefined)(sql, [])
        if (rows === undefined) throw new Error(`Unexpected query: ${sql.slice(0, 120)}`)
        return rows
      })
      return { query: q, calls: c }
    })()
    const profile = { id: MEMBER_PROFILE, user_id: MEMBER, identity_configured: true, is_active: true }
    const repo = (entity: unknown) => ({
      findOne: async () => entity === CommunityPost ? { id: POST, state: 'published', circle_id: CIRCLE, circle_only: true, like_count: 0 } : null,
      findOneBy: async () => entity === CommunityPost ? { id: POST, state: 'published', circle_id: CIRCLE, circle_only: true } : profile,
      find: async () => [], existsBy: async () => false, insert: async () => undefined, delete: async () => undefined,
    })
    const manager = { query, getRepository: repo, create: (_e: unknown, v: unknown) => v, save: async (v: Record<string, unknown>) => { saved.push(v); return { ...v, id: v.id ?? POST } }, increment: async () => undefined }
    const fake = { query, getRepository: repo, transaction: (work: (m: unknown) => unknown) => work(manager) } as unknown as DataSource
    return { svc: new CommunityMemberService(fake), saved, calls }
  }

  it('a circle post is circle-only by default and public too only when asked', async () => {
    const plain = memberService('member')
    await plain.svc.post(MEMBER, KEY, { location, body: 'hi', circleId: CIRCLE })
    expect(plain.saved[0]).toMatchObject({ circle_id: CIRCLE, circle_only: true })
    const synced = memberService('member')
    await synced.svc.post(MEMBER, KEY, { location, body: 'hi', circleId: CIRCLE, alsoPublic: true })
    expect(synced.saved[0]).toMatchObject({ circle_id: CIRCLE, circle_only: false })
    const ordinary = memberService('member')
    await ordinary.svc.post(MEMBER, KEY, { location, body: 'hi', alsoPublic: true })
    expect(ordinary.saved[0]).toMatchObject({ circle_id: null, circle_only: true }) // alsoPublic means nothing without a circle
  })
  it('a silenced member cannot post (403 CIRCLE_SILENCED); an outsider gets 404; unsilenced is fine', async () => {
    await expect(memberService('member', true).svc.post(MEMBER, KEY, { location, body: 'hi', circleId: CIRCLE })).rejects.toMatchObject({ status: 403, response: { code: 'CIRCLE_SILENCED' } })
    await expect(memberService(null).svc.post(OUTSIDER, KEY, { location, body: 'hi', circleId: CIRCLE })).rejects.toMatchObject({ status: 404 })
    const ok = memberService('member', false)
    await expect(ok.svc.post(MEMBER, KEY, { location, body: 'hi', circleId: CIRCLE })).resolves.toMatchObject({ duplicate: false })
  })
  it('a silenced member cannot reply on a circle-only post', async () => {
    await expect(memberService('member', true).svc.comment(MEMBER, KEY, POST, { body: 'hi' })).rejects.toMatchObject({ status: 403, response: { code: 'CIRCLE_SILENCED' } })
    await expect(memberService('member', false).svc.comment(MEMBER, KEY, POST, { body: 'hi' })).resolves.toMatchObject({ duplicate: false })
  })
})

describe('public visibility of synced posts', () => {
  function publicService(post: Record<string, unknown>, roleRows: unknown[]) {
    const calls: string[] = []
    const dataSource = { query: async (sql: string) => { calls.push(sql); return sql.includes('AS owner') ? roleRows : sql.includes('SELECT c.id,c.name') ? roleRows.length ? [{ id: CIRCLE, name: 'Koala' }] : [] : [{ ready: false }] } }
    const svc = Object.create(CommunityService.prototype) as CommunityService
    Object.assign(svc, {
      dataSource, storage: undefined,
      posts: { findOne: async () => post, increment: async () => undefined, manager: { connection: dataSource } },
      comments: { find: async () => [], count: async () => 0 },
    })
    return { svc, calls }
  }
  const base = { id: POST, state: 'published', circle_id: CIRCLE, body: 'text', author: null }
  it('a synced post is an ordinary public post: anonymous viewers read it, with no circle name', async () => {
    const { svc, calls } = publicService({ ...base, circle_only: false }, [])
    const found = await svc.getPost(POST, undefined)
    expect(found.post).toMatchObject({ id: POST, circle: null })
    expect(calls.some(c => c.includes('AS owner'))).toBe(false) // no membership lookup needed
  })
  it('a member sees the circle name on a synced post; an outsider does not', async () => {
    const member = publicService({ ...base, circle_only: false }, [{ owner: false, member: true }])
    expect((await member.svc.getPost(POST, MEMBER)).post.circle).toEqual({ id: CIRCLE, name: 'Koala' })
    const outsider = publicService({ ...base, circle_only: false }, [])
    expect((await outsider.svc.getPost(POST, OUTSIDER)).post.circle).toBeNull()
  })
  it('a circle-only post is 404 for outsiders', async () => {
    const { svc } = publicService({ ...base, circle_only: true }, [])
    await expect(svc.getPost(POST, OUTSIDER)).rejects.toMatchObject({ status: 404 })
  })
  it('public feeds ask for ordinary OR synced posts, and the share query accepts synced posts', async () => {
    const where: string[] = []
    const qb: Record<string, unknown> = {}
    for (const k of ['leftJoinAndSelect', 'where', 'orderBy', 'addOrderBy', 'addSelect', 'take']) qb[k] = () => qb
    qb.andWhere = (c: string) => { where.push(c); return qb }
    qb.getMany = async () => []
    const svc = Object.create(CommunityService.prototype) as CommunityService
    Object.assign(svc, { storage: undefined, posts: { createQueryBuilder: () => qb, manager: { connection: { query: async () => [{ ready: false }] } } } })
    await svc.getFeed({ sort: 'latest' })
    expect(where).toContain('(post.circle_id IS NULL OR post.circle_only = false)')
    where.length = 0
    await svc.getFeed({ sort: 'latest' }, undefined, CIRCLE, { search: '100%_x' })
    expect(where).toContain('post.circle_id = :circleId')
    expect(where.some(c => c.includes('post.body ILIKE :search ESCAPE'))).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const share = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../src/sharing/public-share.service.ts'), 'utf8') as string
    expect(share).toContain('(p.circle_id IS NULL OR p.circle_only=false)')
  })
})

describe('finding circles', () => {
  const rows = (sql: string) => sql.includes('FROM app.community_circles WHERE') && sql.includes('deleted_at IS NULL') ? [circleRow] : undefined
  it('exactly six digits finds the circle by public number, listed or not', async () => {
    const { svc, calls } = make(first(rows, role(null), sql => sql.startsWith('SELECT reason FROM app.community_circle_optouts') || sql.startsWith('SELECT status FROM app.community_circle_guests') ? [] : undefined, base))
    const found = await svc.search(MEMBER, ' 123456 ')
    expect(found.items).toEqual([{ circle: { id: CIRCLE, name: 'Koala', owner: { id: 'op' }, memberCount: 2, publicNo: 123456 }, status: 'none' }])
    const sql = calls.find(c => c.sql.includes('public_no=$1'))!
    expect(sql.args).toEqual([123456])
    expect(sql.sql).not.toContain('AND searchable') // a non-searchable circle is found by its number
  })
  it('anything else is a name search over searchable circles only, with wildcards made literal', async () => {
    const { svc, calls } = make(first(rows, role(null), sql => sql.startsWith('SELECT reason FROM app.community_circle_optouts') || sql.startsWith('SELECT status FROM app.community_circle_guests') ? [] : undefined, base))
    await svc.search(MEMBER, '50%_off')
    const q = calls.find(c => c.sql.includes('ILIKE $1'))!
    expect(q.sql).toContain('AND searchable')
    expect(q.sql).toContain('deleted_at IS NULL')
    expect(q.sql).toContain('LIMIT 20')
    expect(q.args[0]).toBe('%50\\%\\_off%')
    await svc.search(MEMBER, '12345') // five digits is a name, not a number
    expect(calls.filter(c => c.sql.includes('ILIKE $1'))).toHaveLength(2)
    expect(await svc.search(MEMBER, '   ')).toEqual({ items: [] })
  })
  it('the owner of a found circle sees status owner', async () => {
    const { svc } = make(first(rows, base))
    expect((await svc.search(OWNER, '123456')).items[0].status).toBe('owner')
  })
  it('apply by id sends the owner a request notice, like the link does', async () => {
    const { svc, calls } = make(first(rows, sql => sql.startsWith('SELECT reason FROM app.community_circle_optouts') || sql.startsWith('SELECT status FROM app.community_circle_guests') ? [] : sql.includes('SELECT 1 FROM up') ? [] : sql.includes('INSERT INTO app.community_circle_guests') ? [] : undefined, base))
    await expect(svc.applyById('me', CIRCLE)).resolves.toEqual({ status: 'pending' })
    const notice = calls.find(c => c.sql.includes('INSERT INTO app.notifications'))!
    expect(notice.sql).toContain("'community.circle.request'")
    expect(notice.args[0]).toBe(OWNER)
    const gone = make(sql => sql.includes('FROM app.community_circles WHERE id=$1') ? [] : undefined)
    await expect(gone.svc.applyById('me', CIRCLE)).rejects.toMatchObject({ status: 404 })
  })
  it('a new circle gets a free six-digit number, retrying when taken', async () => {
    let lookups = 0
    const { svc, calls } = make(first(sql => sql.includes('SELECT 1 FROM app.community_circles WHERE owner_user_id') ? [] : undefined,
      sql => sql.includes('SELECT 1 FROM app.community_circles WHERE public_no') ? (lookups++ === 0 ? [{ x: 1 }] : []) : undefined,
      sql => sql.includes('INSERT INTO app.community_circles') ? [circleRow] : undefined, base))
    const created = await svc.create(OWNER, 'Koala')
    expect(created).toMatchObject({ publicNo: 123456, searchable: true, muted: false, silenced: false, lastPostAt: null, pinnedPost: null })
    const lookupsMade = calls.filter(c => c.sql.includes('WHERE public_no'))
    expect(lookupsMade).toHaveLength(2)
    for (const l of lookupsMade) expect(l.args[0]).toBeGreaterThanOrEqual(100000)
    const insert = calls.find(c => c.sql.includes('INSERT INTO app.community_circles'))!
    expect(insert.args[4]).toBe(lookupsMade[1].args[0]) // the second, free number was used
  })
})

describe('owner tools', () => {
  it('update needs a name or the searchable switch, and only the owner may', async () => {
    const owner = make(first(role('owner'), sql => sql.includes('UPDATE app.community_circles SET name=COALESCE') ? [circleRow] : undefined, base))
    const view = await owner.svc.update(OWNER, CIRCLE, { searchable: false })
    expect(view).toMatchObject({ isOwner: true, searchable: true }) // the row mock still says true; the point is the owner sees the field
    expect(owner.calls.find(c => c.sql.includes('COALESCE($2,name)'))!.args).toEqual([CIRCLE, null, false])
    await expect(owner.svc.update(OWNER, CIRCLE, {})).rejects.toMatchObject({ status: 400 })
    await expect(make(first(role('member'), base)).svc.update(MEMBER, CIRCLE, { name: 'New' })).rejects.toMatchObject({ status: 403 })
  })
  it('searchable is only shown to the owner', async () => {
    const asMember = make(first(sql => sql.includes('WHERE owner_user_id=$1 AND deleted_at IS NULL') ? [] : undefined, sql => sql.startsWith('WITH RECURSIVE up') ? [] : undefined, base))
    expect((await asMember.svc.mine(MEMBER)).joined).toEqual([])
    const owner = make(first(sql => sql.includes('WHERE owner_user_id=$1 AND deleted_at IS NULL') ? [circleRow] : undefined, sql => sql.includes("status='pending'") ? [{ n: 0 }] : undefined, sql => sql.startsWith('WITH RECURSIVE up') ? [] : undefined, base))
    const mine = await owner.svc.mine(OWNER)
    expect(mine.owned).toMatchObject({ searchable: true, publicNo: 123456, pinnedPost: null })
    const viewedByMember = make(first(sql => sql.includes('WHERE owner_user_id=$1 AND deleted_at IS NULL') ? [] : undefined,
      sql => sql.startsWith('WITH RECURSIVE up') && !sql.includes("reason='left'") ? [circleRow] : sql.startsWith('WITH RECURSIVE up') ? [] : undefined, base))
    const joined = (await viewedByMember.svc.mine(MEMBER)).joined[0]
    expect(joined).toMatchObject({ publicNo: 123456, isOwner: false })
    expect(joined).not.toHaveProperty('searchable')
  })
  it('pin: owner only, and only a published post of this circle', async () => {
    const ok = make(first(role('owner'), sql => sql.includes('FROM app.community_posts WHERE id=$1 AND circle_id=$2') ? [{ x: 1 }] : undefined, sql => sql.includes('SET pinned_post_id=$2') ? [] : undefined, base))
    await expect(ok.svc.pin(OWNER, CIRCLE, POST)).resolves.toEqual({ id: CIRCLE, pinned: true, postId: POST })
    const foreign = make(first(role('owner'), sql => sql.includes('FROM app.community_posts WHERE id=$1 AND circle_id=$2') ? [] : undefined, base))
    await expect(foreign.svc.pin(OWNER, CIRCLE, POST)).rejects.toMatchObject({ status: 404 })
    expect(foreign.calls.find(c => c.sql.includes('FROM app.community_posts WHERE id=$1'))!.args).toEqual([POST, CIRCLE])
    await expect(make(first(role('member'), base)).svc.pin(MEMBER, CIRCLE, POST)).rejects.toMatchObject({ status: 403 })
    await expect(make(first(role('member'), base)).svc.unpin(MEMBER, CIRCLE)).rejects.toMatchObject({ status: 403 })
    const unpin = make(first(role('owner'), sql => sql.includes('SET pinned_post_id=NULL') ? [] : undefined, base))
    await expect(unpin.svc.unpin(OWNER, CIRCLE)).resolves.toEqual({ id: CIRCLE, pinned: false })
  })
  it('the circle feed head carries the pinned post only on the first page', async () => {
    const pinnedRow = { ...circleRow, pinned_post_id: POST }
    const view = { id: POST, body: 'pinned' }
    const { svc, db } = make(first(role('member'), sql => sql.includes('FROM app.community_circles WHERE id=$1') ? [pinnedRow] : undefined, base))
    ;(svc as unknown as { community: { postViews: unknown } }).community.postViews = async () => new Map([[POST, view]])
    expect((await svc.feed(MEMBER, CIRCLE, {})).pinnedPost).toEqual(view)
    expect((await svc.feed(MEMBER, CIRCLE, { cursor: 'abc' })).pinnedPost).toBeNull()
    expect(db).toBeDefined()
  })
  it('mute is stored for any member; outsiders get 404', async () => {
    const ok = make(first(role('member'), sql => sql.includes('INSERT INTO app.community_circle_member_settings') ? [] : undefined, base))
    await expect(ok.svc.mute(MEMBER, CIRCLE, true)).resolves.toEqual({ id: CIRCLE, muted: true })
    expect(ok.calls.find(c => c.sql.includes('INSERT INTO app.community_circle_member_settings'))!.args).toEqual([CIRCLE, MEMBER, true])
    await expect(make(first(role(null), base)).svc.mute(OUTSIDER, CIRCLE, true)).rejects.toMatchObject({ status: 404 })
  })
  it('silence: owner only; the target must be a member; unsilence clears it', async () => {
    const target = (sql: string) => sql.includes('SELECT user_id FROM app.community_profiles') ? [{ user_id: MEMBER }] : undefined
    const ownerThenMember: Answer = (sql, args) => roleSql(sql) ? [args[1] === OWNER ? { owner: true, member: false } : { owner: false, member: true }] : undefined
    const ok = make(first(ownerThenMember, target, sql => sql.includes('INSERT INTO app.community_circle_member_settings') ? [] : undefined, base))
    await expect(ok.svc.silence(OWNER, CIRCLE, MEMBER_PROFILE, true)).resolves.toMatchObject({ silenced: true })
    expect(ok.calls.find(c => c.sql.includes('silenced=true'))).toBeDefined()
    const notMember: Answer = (sql, args) => roleSql(sql) ? (args[1] === OWNER ? [{ owner: true, member: false }] : []) : undefined
    await expect(make(first(notMember, target, base)).svc.silence(OWNER, CIRCLE, MEMBER_PROFILE, true)).rejects.toMatchObject({ status: 404 })
    await expect(make(first(role('member'), target, base)).svc.silence(MEMBER, CIRCLE, MEMBER_PROFILE, true)).rejects.toMatchObject({ status: 403 })
    const un = make(first(role('owner'), target, sql => sql.includes('SET silenced=false') ? [] : undefined, base))
    await expect(un.svc.silence(OWNER, CIRCLE, MEMBER_PROFILE, false)).resolves.toMatchObject({ silenced: false })
  })
  it('member rows carry the silenced flag', async () => {
    const { svc } = make(first(role('member'), sql => sql.includes('FROM app.community_circles WHERE id=$1') ? [circleRow] : undefined,
      sql => sql.includes('ORDER BY (m.via') ? [{ profile_id: 'p1', depth: 1, via: 'tree', silenced: true }] : undefined, base))
    expect((await svc.members(MEMBER, CIRCLE, {})).items[0]).toMatchObject({ depth: 1, via: 'tree', silenced: true })
  })
})

describe('searching inside one circle', () => {
  it('non-members get 404 for posts and members', async () => {
    const { svc } = make(first(role(null), base))
    await expect(svc.innerSearch(OUTSIDER, CIRCLE, 'x', 'posts')).rejects.toMatchObject({ status: 404 })
    await expect(svc.innerSearch(OUTSIDER, CIRCLE, 'x', 'members')).rejects.toMatchObject({ status: 404 })
  })
  it('posts search is scoped to this circle only', async () => {
    const { svc, getFeed } = make(first(role('member'), base))
    await svc.innerSearch(MEMBER, CIRCLE, 'koala', 'posts', 'cur')
    expect(getFeed).toHaveBeenCalledWith({ cursor: 'cur', limit: 20, sort: 'latest' }, undefined, CIRCLE, { viewerId: MEMBER, search: 'koala' })
    expect(getFeed.mock.calls[0]).not.toContain(OTHER_CIRCLE)
  })
  it('members search filters by name or handle inside this circle with a literal pattern', async () => {
    const { svc, calls } = make(first(role('member'), sql => sql.includes('FROM app.community_circles WHERE id=$1') ? [circleRow] : undefined, sql => sql.includes('ORDER BY (m.via') ? [] : undefined, base))
    await svc.innerSearch(MEMBER, CIRCLE, 'a_b', 'members')
    const q = calls.find(c => c.sql.includes('ORDER BY (m.via'))!
    expect(q.sql).toContain("p.display_name ILIKE $5 ESCAPE '\\' OR p.handle ILIKE $5 ESCAPE '\\'")
    expect(q.args).toEqual([OWNER, CIRCLE, 0, 21, '%a\\_b%'])
  })
  it('validates the query string', () => {
    const check = (o: object) => validateSync(plainToInstance(CircleInnerSearchQueryDto, o))
    expect(check({ q: 'koala', type: 'posts' })).toEqual([])
    expect(check({ q: 'koala', type: 'members', cursor: 'o:20' })).toEqual([])
    for (const o of [{ q: '', type: 'posts' }, { q: 'x', type: 'circles' }, { type: 'posts' }]) expect(check(o).length).toBeGreaterThan(0)
    expect(validateSync(plainToInstance(CircleUpdateDto, { searchable: 'yes' })).length).toBeGreaterThan(0)
    expect(validateSync(plainToInstance(CircleUpdateDto, { name: 'x' })).length).toBeGreaterThan(0)
    expect(validateSync(plainToInstance(CircleUpdateDto, { searchable: false }))).toEqual([])
  })
})
