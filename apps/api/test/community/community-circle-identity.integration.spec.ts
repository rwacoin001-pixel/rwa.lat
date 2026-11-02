import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { circleRole, visibleCircles } from '../../src/community/community-circle.access'
import { noticeAncestorCircles, noticeDownlineJoined } from '../../src/community/community-circle.notify'
import { CommunityCircleService } from '../../src/community/community-circle.service'
import { CommunityMemberService } from '../../src/community/community-member.service'
import { CommunityService } from '../../src/community/community.service'
import { CommunityComment, CommunityFollow, CommunityLike, CommunityPost, CommunityProfile, CommunityQueueItem, CommunityReport, CommunityTopic, CommunityTranslation } from '../../src/community/community.entities'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip

suite('circle rosters before identity setup with isolated PostgreSQL', () => {
  let db: DataSource, runner: QueryRunner, scoped: DataSource, circles: CommunityCircleService, member: CommunityMemberService
  let owner: CommunityProfile, invitee: CommunityProfile, configured: CommunityProfile, circleId: string

  async function profile(identityConfigured = false, extra: Partial<CommunityProfile> = {}) {
    const userId = randomUUID()
    await runner.query('INSERT INTO app.users(id) VALUES($1)', [userId])
    const repo = runner.manager.getRepository(CommunityProfile)
    return repo.save(repo.create({ user_id: userId, handle: `u${userId.replace(/-/g, '')}`.slice(0, 32),
      display_name: identityConfigured ? 'Configured member' : 'Member abc123', kind: 'member',
      identity_configured: identityConfigured, is_active: true, ...extra }))
  }

  async function refer(inviter: CommunityProfile, invitee: CommunityProfile) {
    const code = randomUUID().replace(/-/g, '').slice(0, 16)
    await runner.query('INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)', [code, inviter.user_id])
    await runner.query('INSERT INTO app.referral_edges(inviter_user_id,invitee_user_id,code) VALUES($1,$2,$3)', [inviter.user_id, invitee.user_id, code])
  }

  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, APP_ENV: 'test', NODE_ENV: 'test' }))
    await db.initialize()
    if ((await db.query('SELECT current_database() AS name'))[0].name !== decodeURIComponent(target.pathname.slice(1))) throw new Error('Unexpected test database')
    await db.runMigrations()
  })

  beforeEach(async () => {
    runner = db.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    scoped = { query: (sql: string, args?: unknown[]) => runner.query(sql, args),
      transaction: <T>(work: (m: EntityManager) => Promise<T>) => work(runner.manager) } as unknown as DataSource
    const repos = [CommunityProfile, CommunityPost, CommunityComment, CommunityLike, CommunityFollow, CommunityTopic, CommunityQueueItem, CommunityReport, CommunityTranslation].map(e => runner.manager.getRepository(e))
    const community = Reflect.construct(CommunityService, [...repos, {}, scoped]) as CommunityService
    circles = new CommunityCircleService(scoped, community)
    member = new CommunityMemberService(scoped)
    owner = await profile(true)
    invitee = await profile()
    configured = await profile(true)
    await refer(owner, invitee)
    await refer(invitee, configured)
    circleId = (await circles.create(owner.user_id!, 'Identity test')).id
  })

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction()
    await runner?.release()
  })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })

  it('lists and counts unconfigured invitees and configured descendants, with paginated boolean flags', async () => {
    const first = await circles.members(owner.user_id!, circleId, { limit: 1 })
    expect(first.items).toHaveLength(1)
    expect(first.items[0]).toMatchObject({ profile: { id: invitee.id, handle: '', displayName: '', identityConfigured: false },
      identityConfigured: false, depth: 1, via: 'tree', silenced: false })
    expect(first.nextCursor).toBe('o:1')
    const second = await circles.members(owner.user_id!, circleId, { limit: 1, cursor: first.nextCursor! })
    expect(second.items).toHaveLength(1)
    expect(second.items[0]).toMatchObject({ profile: { id: configured.id }, identityConfigured: true, depth: 2 })
    expect(second.nextCursor).toBeNull()
    expect((await circles.mine(owner.user_id!)).owned?.memberCount).toBe(3)
    expect((await circles.members(invitee.user_id!, circleId, {})).items).toHaveLength(2)
  })

  it('finds an unconfigured invitee by handle within the circle', async () => {
    const found = await circles.innerSearch(owner.user_id!, circleId, invitee.handle, 'members')
    expect(found.items).toHaveLength(1)
    expect(found.items[0]).toMatchObject({ profile: { id: invitee.id }, identityConfigured: false })
  })

  it('keeps unconfigured removed members visible to the owner and restores their count', async () => {
    await circles.removeMember(owner.user_id!, circleId, invitee.id)
    const removed = await circles.removed(owner.user_id!, circleId)
    expect(removed.items).toHaveLength(1)
    expect(removed.items[0]).toMatchObject({ profile: { id: invitee.id }, identityConfigured: false, removedAt: expect.any(Date) })
    expect((await circles.members(owner.user_id!, circleId, {})).items.map(i => i.profile.id)).toEqual([configured.id])
    expect((await circles.mine(owner.user_id!)).owned?.memberCount).toBe(2)
    await circles.restore(owner.user_id!, circleId, invitee.id)
    expect((await circles.removed(owner.user_id!, circleId)).items).toEqual([])
    expect((await circles.mine(owner.user_id!)).owned?.memberCount).toBe(3)
  })

  it('lists unconfigured pending guests and includes them in members and count after approval', async () => {
    const guest = await profile()
    await runner.query("INSERT INTO app.community_circle_guests(circle_id,user_id,status) VALUES($1,$2,'pending')", [circleId, guest.user_id])
    const pending = await circles.requests(owner.user_id!, circleId)
    expect(pending.items).toHaveLength(1)
    expect(pending.items[0]).toMatchObject({ profile: { id: guest.id }, identityConfigured: false, createdAt: expect.any(Date) })
    expect((await circles.mine(owner.user_id!)).owned).toMatchObject({ memberCount: 3, pendingCount: 1 })
    await circles.approve(owner.user_id!, circleId, guest.id)
    expect((await circles.requests(owner.user_id!, circleId)).items).toEqual([])
    expect((await circles.members(owner.user_id!, circleId, {})).items).toEqual(expect.arrayContaining([
      expect.objectContaining({ profile: expect.objectContaining({ id: guest.id }), identityConfigured: false, via: 'link' }),
    ]))
    expect((await circles.mine(owner.user_id!)).owned?.memberCount).toBe(4)
    expect(await circleRole(scoped, circleId, guest.user_id)).toBe('member')
  })

  it('still excludes inactive and non-member profiles from rosters, count, removed and pending lists', async () => {
    const excluded = [await profile(false, { is_active: false }), await profile(false, { kind: 'persona' })]
    for (const p of excluded) await refer(owner, p)
    expect((await circles.members(owner.user_id!, circleId, {})).items).toHaveLength(2)
    expect((await circles.mine(owner.user_id!)).owned?.memberCount).toBe(3)
    for (const p of excluded) {
      expect((await circles.innerSearch(owner.user_id!, circleId, p.handle, 'members')).items).toEqual([])
      await runner.query("INSERT INTO app.community_circle_optouts(circle_id,user_id,reason) VALUES($1,$2,'removed')", [circleId, p.user_id])
      await runner.query("INSERT INTO app.community_circle_guests(circle_id,user_id,status) VALUES($1,$2,'pending')", [circleId, p.user_id])
    }
    expect((await circles.removed(owner.user_id!, circleId)).items).toEqual([])
    expect((await circles.requests(owner.user_id!, circleId)).items).toEqual([])
  })

  it('keeps referral access and both join-notification paths independent of identity, while posting requires it', async () => {
    expect(await circleRole(scoped, circleId, invitee.user_id)).toBe('member')
    expect((await visibleCircles(scoped, [circleId], invitee.user_id)).has(circleId)).toBe(true)
    const notices = () => runner.query("SELECT id FROM app.notifications WHERE recipient_user_id=$1 AND kind='community.circle.joined'", [invitee.user_id])
    expect(await notices()).toHaveLength(1) // circle creation notifies existing downline
    await noticeAncestorCircles(scoped, invitee.user_id!)
    expect(await notices()).toHaveLength(2)
    await noticeDownlineJoined(scoped, circleId)
    expect(await notices()).toHaveLength(3)
    await expect(member.post(invitee.user_id!, randomUUID(), { body: 'hello', circleId,
      location: { city: 'Singapore', countryCode: 'SG', source: 'device' } })).rejects.toMatchObject({ status: 409, message: 'COMMUNITY_IDENTITY_REQUIRED' })
  })
})
