import { DataSource, EntityManager } from 'typeorm'
import { CommunityDmService } from '../../src/community/community-dm.service'
import { NotificationService } from '../../src/notification/notification.service'
import { decodeCursor, encodeCursor } from '../../src/community/community.util'

const ME = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const THREAD = '00000000-0000-4000-8000-000000000003'
const MESSAGE = '00000000-0000-4000-8000-000000000004'
const CLIENT = '00000000-0000-4000-8000-000000000005'
const USER = '00000000-0000-4000-8000-000000000006'
const profile = { id: ME, user_id: USER, handle: 'alice.sg', identity_configured: true, is_active: true, status: 'active' }
const recipient = { id: OTHER, user_id: 'recipient-user', handle: 'bob.sg', dm_policy: 'everyone', is_active: true }
const thread = { id: THREAD, a_profile_id: ME, b_profile_id: OTHER, muted: false, archived: false }
const message = { id: MESSAGE, thread_id: THREAD, sender_profile_id: ME, body: 'Hello', client_id: CLIENT, sequence: '1', created_at: new Date('2026-10-29T00:00:00Z') }

/** Only the database boundary is stubbed. Unexpected SQL fails rather than silently returning success. */
function setup(overrides: Record<string, unknown[]> = {}) {
  const query = jest.fn(async (sql: string, args?: unknown[]) => {
    for (const [fragment, rows] of Object.entries(overrides)) if (sql.includes(fragment)) return rows
    if (sql.includes('pg_advisory_xact_lock')) return []
    if (sql.includes('JOIN app.users')) return [profile]
    if (sql.includes('community_handle_aliases')) return [recipient]
    if (sql.includes('SELECT t.*')) return [thread]
    if (sql.includes('SELECT p.*')) return [recipient]
    if (sql.includes('FROM app.community_dm_blocks')) return []
    if (sql.includes('FROM app.community_follows')) return []
    if (sql.includes('client_id=$2')) return []
    if (sql.includes('count(*)')) return [{ count: '0' }]
    if (sql.includes('INSERT INTO app.community_dm_messages')) return [message]
    if (sql.includes('INSERT INTO app.audit_logs')) return []
    if (sql.includes('UPDATE app.community_dm_')) return []
    throw new Error(`Unexpected query: ${sql}; args: ${JSON.stringify(args)}`)
  })
  const manager = { query } as unknown as EntityManager
  const db = { transaction: (work: (m: EntityManager) => unknown) => work(manager) } as unknown as DataSource
  const notifications = { coalesceCommunityDm: jest.fn(), readCommunityDm: jest.fn() }
  return { service: new CommunityDmService(db, notifications as unknown as NotificationService), query, notifications }
}

describe('Community DM permissions and writes', () => {
  it('requires an existing configured community identity', async () => {
    for (const rows of [[], [{ ...profile, identity_configured: false }]]) {
      const { service } = setup({ 'JOIN app.users': rows })
      await expect(service.unreadCount(USER)).rejects.toMatchObject({ status: 409, response: { code: 'COMMUNITY_IDENTITY_REQUIRED' } })
    }
  })
  it('rejects suspended users and inactive profiles', async () => {
    for (const change of [{ status: 'suspended' }, { is_active: false }]) {
      const { service } = setup({ 'JOIN app.users': [{ ...profile, ...change }] })
      await expect(service.unreadCount(USER)).rejects.toMatchObject({ status: 403 })
    }
  })
  it('returns 404 for non-members on reads, sends, read receipts and settings', async () => {
    const { service, query } = setup({ 'SELECT t.*': [] })
    await expect(service.messages(USER, THREAD, {})).rejects.toMatchObject({ status: 404 })
    await expect(service.send(USER, THREAD, { body: 'Hello', clientId: CLIENT })).rejects.toMatchObject({ status: 404 })
    await expect(service.read(USER, THREAD, MESSAGE)).rejects.toMatchObject({ status: 404 })
    await expect(service.settings(USER, THREAD, { muted: true })).rejects.toMatchObject({ status: 404 })
    const membershipQueries = query.mock.calls.filter(([sql]) => sql.includes('SELECT t.*'))
    expect(membershipQueries.every(([sql, args]) => sql.includes('member.profile_id=$2') && args?.[1] === ME)).toBe(true)
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(false)
  })
  it.each([[ME, OTHER], [OTHER, ME]])('blocks open and send for block %s -> %s', async (blocker, blocked) => {
    const { service, query } = setup({ 'FROM app.community_dm_blocks': [{ blocker_profile_id: blocker, blocked_profile_id: blocked }] })
    await expect(service.open(USER, 'bob.sg')).rejects.toMatchObject({ status: 403, response: { code: 'DM_BLOCKED' } })
    await expect(service.send(USER, THREAD, { body: 'Hello', clientId: CLIENT })).rejects.toMatchObject({ status: 403, response: { code: 'DM_BLOCKED' } })
    expect(query.mock.calls.find(([sql]) => sql.includes('FROM app.community_dm_blocks'))?.[0]).toContain('OR')
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.community_dm_messages'))).toBe(false)
  })
  it('requires the recipient to follow the sender, including on existing threads', async () => {
    const { service, query } = setup({ 'SELECT p.*,member.muted': [{ ...recipient, dm_policy: 'following' }], 'community_handle_aliases': [{ ...recipient, dm_policy: 'following' }] })
    await expect(service.open(USER, 'bob.sg')).rejects.toMatchObject({ status: 403, response: { code: 'DM_NOT_ALLOWED' } })
    await expect(service.send(USER, THREAD, { body: 'Hello', clientId: CLIENT })).rejects.toMatchObject({ status: 403, response: { code: 'DM_NOT_ALLOWED' } })
    expect(query.mock.calls.find(([sql]) => sql.includes('FROM app.community_follows'))?.[1]).toEqual([OTHER, ME])
  })
  it('allows follow-only delivery when the recipient follows me', async () => {
    const { service } = setup({ 'SELECT p.*,member.muted': [{ ...recipient, dm_policy: 'following' }], 'FROM app.community_follows': [{ allowed: 1 }] })
    await expect(service.send(USER, THREAD, { body: ' Hello ', clientId: CLIENT })).resolves.toMatchObject({ id: MESSAGE, body: 'Hello', duplicate: false })
  })
  it('replays the same sender/clientId without consuming quota or notifying twice', async () => {
    const { service, query, notifications } = setup({ 'client_id=$2': [message] })
    await expect(service.send(USER, THREAD, { body: ' Hello ', clientId: CLIENT })).resolves.toMatchObject({ id: MESSAGE, duplicate: true })
    expect(query.mock.calls.some(([sql]) => sql.includes('count(*)') || sql.includes('INSERT INTO'))).toBe(false)
    expect(notifications.coalesceCommunityDm).not.toHaveBeenCalled()
  })
  it('rejects a reused clientId for another body or thread', async () => {
    for (const prior of [{ ...message, body: 'different' }, { ...message, thread_id: OTHER }]) {
      const { service } = setup({ 'client_id=$2': [prior] })
      await expect(service.send(USER, THREAD, { body: 'Hello', clientId: CLIENT })).rejects.toMatchObject({ status: 409 })
    }
  })
  it.each([' ', 'x'.repeat(2001), 'add me on WeChat', 'guaranteed returns', '进群带单', 'call +6591234567'])('rejects invalid or moderated text: %.24s', async body => {
    const { service, notifications } = setup()
    await expect(service.send(USER, THREAD, { body, clientId: CLIENT })).rejects.toMatchObject({ status: 400 })
    expect(notifications.coalesceCommunityDm).not.toHaveBeenCalled()
  })
  it('limits each sender to 20 messages in a rolling minute', async () => {
    const { service, query } = setup({ 'count(*)': [{ count: '20' }] })
    await expect(service.send(USER, THREAD, { body: 'Hello', clientId: CLIENT })).rejects.toMatchObject({ status: 429 })
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.community_dm_messages'))).toBe(false)
  })
  it('limits new threads to 10 in a rolling day but allows reuse', async () => {
    const base = { 'WHERE a_profile_id=$1 AND b_profile_id=$2': [], 'count(*)': [{ count: '10' }] }
    await expect(setup(base).service.open(USER, 'bob.sg')).rejects.toMatchObject({ status: 429 })
    const { service } = setup({ ...base, 'WHERE a_profile_id=$1 AND b_profile_id=$2': [thread] })
    await expect(service.open(USER, 'bob.sg')).resolves.toMatchObject({ id: THREAD })
  })
  it('notifies through the existing notification service with no message text', async () => {
    const { service, notifications } = setup()
    await service.send(USER, THREAD, { body: ' Hello ', clientId: CLIENT })
    expect(notifications.coalesceCommunityDm).toHaveBeenCalledWith(expect.anything(), recipient.user_id, THREAD, profile.handle)
  })
  it('does not notify muted recipients', async () => {
    const { service, notifications } = setup({ 'SELECT p.*,member.muted': [{ ...recipient, muted: true }] })
    await service.send(USER, THREAD, { body: 'Hello', clientId: CLIENT })
    expect(notifications.coalesceCommunityDm).not.toHaveBeenCalled()
  })
  it('counts unread incoming, undeleted messages scoped to the session profile', async () => {
    const { service, query } = setup({ 'count(*)': [{ count: '7' }] })
    expect(await service.unreadCount(USER)).toEqual({ count: 7 })
    const [sql, args] = query.mock.calls.find(([s]) => s.includes('count(*)'))!
    expect(args).toEqual([ME])
    expect(sql).toContain('member.profile_id=$1')
    expect(sql).toContain('msg.sender_profile_id<>$1')
    expect(sql).toContain('msg.deleted_at IS NULL')
    expect(sql).toContain('msg.sequence>COALESCE')
  })
  it('rejects a read cursor from another thread', async () => {
    const { service } = setup({ 'SELECT id, sequence FROM app.community_dm_messages': [] })
    await expect(service.read(USER, THREAD, MESSAGE)).rejects.toMatchObject({ status: 404 })
  })
  it('advances read receipts only forward and clears notifications only when caught up', async () => {
    const { service, query, notifications } = setup({ 'SELECT id, sequence FROM app.community_dm_messages': [{ id: MESSAGE, sequence: '4' }] })
    await service.read(USER, THREAD, MESSAGE)
    expect(query.mock.calls.find(([sql]) => sql.includes('SET last_read_message_id'))?.[0]).toContain('sequence<$3')
    expect(notifications.readCommunityDm).toHaveBeenCalledWith(expect.anything(), USER, THREAD)
  })
  it('does not clear a thread notification for a partial read', async () => {
    const { service, notifications } = setup({ 'SELECT id, sequence FROM app.community_dm_messages': [{ id: MESSAGE, sequence: '4' }], 'count(*)': [{ count: '1' }] })
    await service.read(USER, THREAD, MESSAGE)
    expect(notifications.readCommunityDm).not.toHaveBeenCalled()
  })

  it('opens one ordered pair and initializes both memberships', async () => {
    const { service, query } = setup({
      'community_handle_aliases': [{ ...recipient, id: ME }],
      'JOIN app.users': [{ ...profile, id: OTHER }],
      'WHERE a_profile_id=$1 AND b_profile_id=$2': [],
      'INSERT INTO app.community_dm_threads': [{ id: THREAD, last_message_at: message.created_at }],
      'INSERT INTO app.community_dm_members': [],
    })
    expect(await service.open(USER, 'alice.sg')).toEqual({ id: THREAD })
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.community_dm_threads'))?.[1]).toEqual([ME, OTHER, OTHER])
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.community_dm_members'))?.[1]).toEqual([THREAD, ME, OTHER, message.created_at])
  })

  it('rejects unknown handles and self conversations', async () => {
    await expect(setup({ 'community_handle_aliases': [] }).service.open(USER, 'missing.sg')).rejects.toMatchObject({ status: 404 })
    await expect(setup({ 'community_handle_aliases': [profile] }).service.open(USER, profile.handle)).rejects.toMatchObject({ status: 400 })
  })

  it('blocks and unblocks only as the session profile', async () => {
    const { service, query } = setup({ 'INSERT INTO app.community_dm_blocks': [], 'DELETE FROM app.community_dm_blocks': [] })
    expect(await service.block(USER, recipient.handle, true)).toEqual({ blocked: true })
    expect(await service.block(USER, recipient.handle, false)).toEqual({ blocked: false })
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.community_dm_blocks'))?.[1]).toEqual([ME, OTHER])
    expect(query.mock.calls.find(([sql]) => sql.includes('DELETE FROM app.community_dm_blocks'))?.[1]).toEqual([ME, OTHER])
  })

  it('changes only the requesting member settings and preserves omitted values', async () => {
    const { service, query } = setup({ 'SELECT t.*': [{ ...thread, muted: true }] })
    expect(await service.settings(USER, THREAD, { archived: true })).toEqual({ muted: true, archived: true })
    expect(query.mock.calls.find(([sql]) => sql.includes('SET muted='))?.[1]).toEqual([THREAD, ME, true, true])
  })

  it('pages newest messages with an extra row, without leaking internal fields', async () => {
    const rows = [message, { ...message, id: OTHER }, { ...message, id: ME }]
    const { service, query } = setup({ 'SELECT id, sequence FROM': [{ sequence: '100' }], 'SELECT * FROM app.community_dm_messages': rows })
    const page = await service.messages(USER, THREAD, { before: CLIENT, limit: 2 })
    expect(page.items.map(item => item.id)).toEqual([MESSAGE, OTHER])
    expect(page.nextBefore).toBe(OTHER)
    expect(page.items[0]).not.toHaveProperty('client_id')
    expect(query.mock.calls.find(([sql]) => sql.includes('ORDER BY sequence DESC'))?.[1]).toEqual([THREAD, '100', 3])
    expect((await service.messages(USER, THREAD, { limit: 3 })).nextBefore).toBeNull()
  })

  it('pages member threads, caps previews and withholds unverified media', async () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`,
      other_id: OTHER, handle: recipient.handle, display_name: 'Bob', kind: 'member',
      avatar_url: `/v1/community/media/${CLIENT}`, preview: '🙂'.repeat(90),
      last_message_id: MESSAGE, last_sender_id: OTHER, unread_count: '2',
      last_message_at: message.created_at, muted: false, archived: false,
    }))
    const { service, query } = setup({ 'SELECT t.id,member.last_message_at': rows })
    const page = await service.threads(USER, encodeCursor(message.created_at, THREAD))
    expect(page.items).toHaveLength(30)
    expect(page.items[0]).toMatchObject({ otherProfile: { avatarUrl: null, avatarSeed: OTHER }, unreadCount: 2 })
    expect(Array.from(page.items[0].lastMessage!.preview)).toHaveLength(80)
    expect(decodeCursor(page.nextCursor!)).toEqual({ at: message.created_at, id: rows[29].id })
    expect(query.mock.calls.find(([sql]) => sql.includes('SELECT t.id,'))?.[1]).toEqual([ME, message.created_at, THREAD])
    await expect(service.threads(USER, 'invalid')).rejects.toMatchObject({ status: 400 })
    expect(await setup({ 'SELECT t.id,member.last_message_at': [] }).service.threads(USER)).toEqual({ items: [], nextCursor: null })
  })
})
