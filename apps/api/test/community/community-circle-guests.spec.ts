import { DataSource, EntityManager } from 'typeorm'
import { circleRole } from '../../src/community/community-circle.access'
import { CommunityCircleService } from '../../src/community/community-circle.service'
import { CommunityService } from '../../src/community/community.service'
import { noticeAncestorCircles } from '../../src/community/community-circle.notify'

const OWNER = '00000000-0000-4000-8000-0000000000a1'
const GUEST = '00000000-0000-4000-8000-0000000000a2'
const TREE = '00000000-0000-4000-8000-0000000000a3'
const CIRCLE = '00000000-0000-4000-8000-0000000000c1'
const CODE = 'AbCdEfGh_-'
const GUEST_PROFILE = '00000000-0000-4000-8000-0000000000d2'
const circleRow = { id: CIRCLE, name: 'Koala', owner_user_id: OWNER, owner_profile_id: 'op', created_at: new Date('2026-11-01T00:00:00Z'), invite_code: CODE }

type Answer = (sql: string, args: unknown[]) => unknown[] | undefined
function make(answer: Answer) {
  const calls: Array<{ sql: string; args: unknown[] }> = []
  const query = jest.fn(async (sql: string, args: unknown[] = []) => {
    calls.push({ sql, args })
    if (sql.includes('pg_advisory_xact_lock')) return []
    if (sql.includes('FROM app.community_profiles p JOIN app.users u')) return [{ id: 'me-profile', user_id: 'me' }]
    if (sql.includes('FROM app.users u LEFT JOIN app.community_profiles p')) return [{ id: 'me-profile', is_active: true, status: 'active' }]
    const rows = answer(sql, args)
    if (rows === undefined) throw new Error(`Unexpected query: ${sql.slice(0, 140)}`)
    return rows
  })
  const db = { query, transaction: (work: (m: EntityManager) => unknown) => work({ query } as unknown as EntityManager) } as unknown as DataSource
  const community = { profileViews: async (ids: string[]) => new Map(ids.map(id => [id, { id }])), postViews: async () => new Map() } as unknown as CommunityService
  return { svc: new CommunityCircleService(db, community), calls, db }
}
const byCode = (sql: string) => sql.includes('WHERE invite_code=$1')
const optout = (reason: string | null): Answer => sql => sql.includes('SELECT reason FROM app.community_circle_optouts') ? (reason ? [{ reason }] : []) : undefined
const guestRow = (status: string | null): Answer => sql => sql.includes('SELECT status FROM app.community_circle_guests') ? (status ? [{ status }] : []) : undefined
const notices = (calls: Array<{ sql: string; args: unknown[] }>) => calls.filter(c => c.sql.includes('INSERT INTO app.notifications'))
const first = (...fns: Answer[]): Answer => (sql, args) => { for (const f of fns) { const r = f(sql, args); if (r !== undefined) return r } return undefined }
const base: Answer = (sql, args) =>
  byCode(sql) ? (args[0] === CODE ? [circleRow] : [])
  : sql.includes('SELECT 1 FROM app.community_circles WHERE public_no') ? []
  : sql.includes('count(*)::int AS n') ? [{ n: 1 }]
  : sql.includes('INSERT INTO app.notifications') ? []
  : sql.includes('FROM app.community_circle_member_settings') || sql.includes('max(published_at)') ? [] : undefined

describe('circle access with link guests', () => {
  it('counts an approved guest as a member unless opted out, and never walks the guest\'s own invitees', async () => {
    const { db, calls } = make(sql => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [{ owner: false, member: true }] : undefined)
    expect(await circleRole(db, CIRCLE, GUEST)).toBe('member')
    const sql = calls[0].sql
    expect(sql).toContain("app.community_circle_guests g WHERE g.circle_id=c.id AND g.user_id=$2 AND g.status='member'")
    expect(sql).toMatch(/\)\s*\n?\s*AND NOT EXISTS \(SELECT 1 FROM app\.community_circle_optouts/) // (tree OR guest) AND NOT optout
    // the guest check is on the viewer's own row only: no walk below the guest
    expect(sql.match(/WITH RECURSIVE/g)).toHaveLength(1)
  })
})

describe('invite page', () => {
  it('shows the circle and the viewer\'s standing; anonymous is none', async () => {
    const anon = make(base)
    expect(await anon.svc.inviteInfo(undefined, CODE)).toMatchObject({ circle: { id: CIRCLE, name: 'Koala', memberCount: 2 }, status: 'none' })
    const owner = make(base)
    expect((await owner.svc.inviteInfo(OWNER, CODE)).status).toBe('owner')
    const removed = make(first(optout('removed'), base))
    expect((await removed.svc.inviteInfo(GUEST, CODE)).status).toBe('removed')
    const pending = make(first(optout(null), guestRow('pending'), (sql) => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [] : undefined, base))
    expect((await pending.svc.inviteInfo(GUEST, CODE)).status).toBe('pending')
    const rejected = make(first(optout(null), guestRow('rejected'), (sql) => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [] : undefined, base))
    expect((await rejected.svc.inviteInfo(GUEST, CODE)).status).toBe('rejected')
  })
  it('answers 404 CIRCLE_INVITE_NOT_FOUND for unknown, reset or malformed codes', async () => {
    const { svc } = make(base)
    for (const code of ['ZZZZZZZZZZ', 'short', '../../etc']) {
      await expect(svc.inviteInfo(undefined, code)).rejects.toMatchObject({ status: 404, response: { code: 'CIRCLE_INVITE_NOT_FOUND' } })
      await expect(svc.apply(GUEST, code)).rejects.toMatchObject({ status: 404 })
    }
  })
  it('reset makes a new code (owner only); the old code then finds nothing', async () => {
    const roleSql = (role: 'owner' | 'member') => (sql: string) => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [{ owner: role === 'owner', member: role === 'member' }] : undefined
    const ok = make(first(roleSql('owner'), sql => sql.includes('UPDATE app.community_circles SET invite_code') ? [{ invite_code: 'NewCode_123' }] : undefined))
    expect(await ok.svc.resetInvite(OWNER, CIRCLE)).toEqual({ inviteCode: 'NewCode_123' })
    const newCode = ok.calls.find(c => c.sql.includes('SET invite_code'))!.args[1] as string
    expect(newCode).toMatch(/^[A-Za-z0-9_-]{10}$/)
    expect(newCode).not.toBe(CODE)
    await expect(make(roleSql('member')).svc.resetInvite(GUEST, CIRCLE)).rejects.toMatchObject({ status: 403 })
    // after the reset the old code is not in the table any more
    const after = make(sql => byCode(sql) ? [] : undefined)
    await expect(after.svc.inviteInfo(undefined, CODE)).rejects.toMatchObject({ status: 404 })
  })
})

describe('apply, approve, reject', () => {
  const notDownline = (sql: string) => sql.includes('SELECT 1 FROM up') ? [] : undefined
  it('a stranger goes to pending and the owner is told', async () => {
    const { svc, calls } = make(first(optout(null), guestRow(null), notDownline, sql => sql.includes('INSERT INTO app.community_circle_guests') ? [] : undefined, base))
    await expect(svc.apply(GUEST, CODE)).resolves.toEqual({ status: 'pending' })
    expect(calls.find(c => c.sql.includes('INSERT INTO app.community_circle_guests'))!.sql).toContain("status='pending'")
    const [n] = notices(calls)
    expect(n.sql).toContain("'community.circle.request'")
    expect(n.args[0]).toBe(OWNER)
    expect(n.args).toContain('me-profile') // the applicant's profile id travels in the payload
  })
  it('applying twice while pending does not notify again', async () => {
    const { svc, calls } = make(first(optout(null), guestRow('pending'), notDownline, base))
    await expect(svc.apply(GUEST, CODE)).resolves.toEqual({ status: 'pending' })
    expect(notices(calls)).toHaveLength(0)
  })
  it('a rejected applicant may ask again (row goes back to pending)', async () => {
    const { svc, calls } = make(first(optout(null), guestRow('rejected'), notDownline, sql => sql.includes('INSERT INTO app.community_circle_guests') ? [] : undefined, base))
    await expect(svc.apply(GUEST, CODE)).resolves.toEqual({ status: 'pending' })
    expect(calls.find(c => c.sql.includes('ON CONFLICT (circle_id,user_id) DO UPDATE SET status=\'pending\''))).toBeDefined()
  })
  it('the owner applying is the owner', async () => {
    const { svc } = make(base)
    ;(svc as unknown as { myProfile: unknown }).myProfile = async () => ({ id: 'op', user_id: OWNER })
    await expect(svc.apply(OWNER, CODE)).resolves.toEqual({ status: 'owner' })
  })
  it('a removed person gets 403 CIRCLE_REMOVED', async () => {
    const { svc } = make(first(optout('removed'), base))
    await expect(svc.apply(TREE, CODE)).rejects.toMatchObject({ status: 403, response: { code: 'CIRCLE_REMOVED' } })
  })
  it('a tree member who had left is simply a member again (left optout cleared, no guest row)', async () => {
    const { svc, calls } = make(first(optout('left'), sql => sql.includes('SELECT 1 FROM up') ? [{ x: 1 }] : undefined, sql => sql.includes('DELETE FROM app.community_circle_optouts') ? [] : undefined, base))
    await expect(svc.apply(TREE, CODE)).resolves.toEqual({ status: 'member' })
    expect(calls.some(c => c.sql.includes('DELETE FROM app.community_circle_optouts'))).toBe(true)
    expect(calls.some(c => c.sql.includes('INSERT INTO app.community_circle_guests'))).toBe(false)
    expect(notices(calls)).toHaveLength(0)
  })
  const ownerAnswers = (updated: boolean): Answer => first(
    sql => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [{ owner: true, member: false }] : undefined,
    sql => sql.includes('SELECT user_id FROM app.community_profiles') ? [{ user_id: GUEST }] : undefined,
    sql => sql.includes('UPDATE app.community_circle_guests') ? (updated ? [{ '?column?': 1 }] : []) : undefined,
    base)
  it('approve makes the guest a member and tells them', async () => {
    const { svc, calls } = make(ownerAnswers(true))
    await expect(svc.approve(OWNER, CIRCLE, GUEST_PROFILE)).resolves.toEqual({ approved: true })
    expect(calls.find(c => c.sql.includes('UPDATE app.community_circle_guests'))!.args).toEqual([CIRCLE, GUEST, 'member'])
    const [n] = notices(calls)
    expect(n.sql).toContain("'community.circle.joined'")
    expect(n.args[0]).toBe(GUEST)
  })
  it('reject tells the applicant; there must be a pending request', async () => {
    const { svc, calls } = make(ownerAnswers(true))
    await expect(svc.reject(OWNER, CIRCLE, GUEST_PROFILE)).resolves.toEqual({ rejected: true })
    expect(notices(calls)[0].sql).toContain("'community.circle.rejected'")
    await expect(make(ownerAnswers(false)).svc.approve(OWNER, CIRCLE, GUEST_PROFILE)).rejects.toMatchObject({ status: 404 })
  })
  it('only the owner decides', async () => {
    const { svc } = make(first(sql => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [{ owner: false, member: true }] : undefined, base))
    await expect(svc.approve(GUEST, CIRCLE, GUEST_PROFILE)).rejects.toMatchObject({ status: 403 })
    await expect(svc.requests(GUEST, CIRCLE)).rejects.toMatchObject({ status: 403 })
  })
})

describe('leave, remove, restore with guests', () => {
  const member = (sql: string) => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [{ owner: false, member: true }] : undefined
  it('a guest who leaves loses the guest row and gets no optout', async () => {
    const { svc, calls } = make(first(optout(null), member, sql => sql.includes('DELETE FROM app.community_circle_guests') ? [{ '?column?': 1 }] : undefined, base))
    await expect(svc.leave(GUEST, CIRCLE)).resolves.toEqual({ id: CIRCLE, left: true })
    expect(calls.some(c => c.sql.includes('INSERT INTO app.community_circle_optouts'))).toBe(false)
  })
  it('a tree member who leaves gets the left optout', async () => {
    const { svc, calls } = make(first(optout(null), member, sql => sql.includes('DELETE FROM app.community_circle_guests') ? [] : sql.includes('INSERT INTO app.community_circle_optouts') ? [] : undefined, base))
    await svc.leave(TREE, CIRCLE)
    expect(calls.find(c => c.sql.includes('INSERT INTO app.community_circle_optouts'))!.sql).toContain("'left'")
  })
  const owner = (sql: string) => sql.includes('FROM app.community_circles c WHERE c.id=$1') ? [{ owner: true, member: false }] : undefined
  it('the owner removes a guest (optout removed, guest row kept) and can restore', async () => {
    const remove = make(first(owner, sql => sql.includes('SELECT user_id FROM app.community_profiles') ? [{ user_id: GUEST }] : undefined,
      sql => sql.includes("FROM app.community_circle_guests WHERE circle_id=$1 AND user_id=$2 AND status='member'") ? [{ x: 1 }] : undefined,
      sql => sql.includes('INSERT INTO app.community_circle_optouts') ? [] : undefined, base))
    await expect(remove.svc.removeMember(OWNER, CIRCLE, GUEST_PROFILE)).resolves.toMatchObject({ removed: true })
    expect(remove.calls.some(c => c.sql.includes('DELETE FROM app.community_circle_guests'))).toBe(false)
    const restore = make(first(owner, sql => sql.includes('SELECT user_id FROM app.community_profiles') ? [{ user_id: GUEST }] : undefined,
      sql => sql.includes("DELETE FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2 AND reason='removed'") ? [{ x: 1 }] : undefined, base))
    await expect(restore.svc.restore(OWNER, CIRCLE, GUEST_PROFILE)).resolves.toMatchObject({ restored: true })
    // somebody who merely left cannot be "restored"
    const left = make(first(owner, sql => sql.includes('SELECT user_id FROM app.community_profiles') ? [{ user_id: TREE }] : undefined,
      sql => sql.includes('DELETE FROM app.community_circle_optouts') ? [] : undefined, base))
    await expect(left.svc.restore(OWNER, CIRCLE, GUEST_PROFILE)).rejects.toMatchObject({ status: 404 })
  })
  it('only the owner sees the removed list and restores', async () => {
    const { svc } = make(first(member, base))
    await expect(svc.removed(GUEST, CIRCLE)).rejects.toMatchObject({ status: 403 })
    await expect(svc.restore(GUEST, CIRCLE, GUEST_PROFILE)).rejects.toMatchObject({ status: 403 })
  })
})

describe('notifications', () => {
  it('a new circle notifies the whole existing downline with one set-based statement', async () => {
    const { svc, calls } = make(first(sql => sql.includes('SELECT 1 FROM app.community_circles WHERE owner_user_id') ? [] : undefined,
      sql => sql.includes('INSERT INTO app.community_circles') ? [circleRow] : undefined, base))
    const created = await svc.create(OWNER, 'Koala')
    expect(created).toMatchObject({ inviteCode: expect.stringMatching(/^[A-Za-z0-9_-]{10}$/), pendingCount: 0 })
    const note = notices(calls)
    expect(note).toHaveLength(1)
    expect(note[0].sql).toContain('FROM (SELECT DISTINCT uid FROM down) d')
    expect(note[0].sql).toContain("'community.circle.joined'")
    expect(note[0].sql).toContain("'你已加入 ' || c.name || ' 的圈子'")
    expect(note[0].sql).toContain("'You joined ' || c.name")
    expect(note[0].sql).toContain("'route', '/community?circle=' || c.id")
    expect(note[0].sql).toContain("'zh-CN', jsonb_build_object")
  })
  it('a new account is told once per live circle owned by an ancestor, inside the caller\'s transaction', async () => {
    const calls: string[] = []
    const m = { query: async (sql: string) => { calls.push(sql); return sql.includes('to_regclass') ? [{ ready: true }] : [] } } as unknown as EntityManager
    await noticeAncestorCircles(m, TREE)
    expect(calls[1]).toContain('WITH RECURSIVE up')
    expect(calls[1]).toContain('c.deleted_at IS NULL')
    expect(calls[1]).toContain('INSERT INTO app.notifications')
  })
  it('does nothing before the circle tables exist', async () => {
    const m = { query: jest.fn(async () => [{ ready: false }]) } as unknown as EntityManager
    await noticeAncestorCircles(m, TREE)
    expect((m.query as jest.Mock).mock.calls).toHaveLength(1)
  })
})

describe('mine for the owner', () => {
  it('adds inviteCode and pendingCount to the owned circle only', async () => {
    const { svc } = make(first(sql => sql.includes('WHERE owner_user_id=$1 AND deleted_at IS NULL') ? [circleRow] : undefined,
      sql => sql.includes("status='pending'") ? [{ n: 3 }] : undefined,
      sql => sql.startsWith('WITH RECURSIVE up') ? [] : undefined, base))
    const mine = await svc.mine(OWNER)
    expect(mine.owned).toMatchObject({ inviteCode: CODE, pendingCount: 3, isOwner: true })
    expect(mine.joined).toEqual([])
    expect(mine.left).toEqual([])
  })
})
