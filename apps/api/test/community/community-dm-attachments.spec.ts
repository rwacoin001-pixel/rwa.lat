import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DataSource, EntityManager } from 'typeorm'
import { DmAttachmentDto, DmSendDto } from '../../src/community/community-dm.dto'
import { CommunityDmService } from '../../src/community/community-dm.service'
import { NotificationService } from '../../src/notification/notification.service'
import { ObjectStorageService, detectDmAttachment, sanitizeDmFileName } from '../../src/object-storage/object-storage.service'

const ME = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const THREAD = '00000000-0000-4000-8000-000000000003'
const MESSAGE = '00000000-0000-4000-8000-000000000004'
const CLIENT = '00000000-0000-4000-8000-000000000005'
const USER = '00000000-0000-4000-8000-000000000006'
const MEDIA = '00000000-0000-4000-8000-000000000007'
const profile = { id: ME, user_id: USER, handle: 'alice.sg', identity_configured: true, is_active: true, status: 'active' }
const recipient = { id: OTHER, user_id: 'recipient-user', handle: 'bob.sg', dm_policy: 'everyone', is_active: true }
const thread = { id: THREAD, a_profile_id: ME, b_profile_id: OTHER, muted: false, archived: false }
const message = { id: MESSAGE, thread_id: THREAD, sender_profile_id: ME, body: '', client_id: CLIENT, sequence: '1', created_at: new Date('2026-10-29T00:00:00Z'), deleted_at: null,
  attachment_media_id: MEDIA, attachment_kind: 'image', attachment_name: 'a.png' }
const owned = { contentType: 'image/png', sizeBytes: 100, name: 'a.png', kind: 'image' }

/** Only the database boundary is stubbed. Unexpected SQL fails rather than silently returning success. */
function setup(overrides: Record<string, unknown[]> = {}, storage?: Partial<ObjectStorageService>) {
  const query = jest.fn(async (sql: string, args?: unknown[]) => {
    for (const [fragment, rows] of Object.entries(overrides)) if (sql.includes(fragment)) return rows
    if (sql.includes('pg_advisory_xact_lock')) return []
    if (sql.includes('JOIN app.users')) return [profile]
    if (sql.includes('SELECT t.*')) return [thread]
    if (sql.includes('SELECT p.*')) return [recipient]
    if (sql.includes('FROM app.community_dm_blocks')) return []
    if (sql.includes('client_id=$2')) return []
    if (sql.includes('count(*)')) return [{ count: '0' }]
    if (sql.includes('INSERT INTO app.community_dm_messages')) return [message]
    if (sql.includes('INSERT INTO app.audit_logs')) return []
    if (sql.includes('UPDATE app.community_dm_')) return []
    throw new Error(`Unexpected query: ${sql}; args: ${JSON.stringify(args)}`)
  })
  const db = { transaction: (work: (m: EntityManager) => unknown) => work({ query } as unknown as EntityManager) } as unknown as DataSource
  const notifications = { coalesceCommunityDm: jest.fn(), readCommunityDm: jest.fn() }
  const service = new CommunityDmService(db, notifications as unknown as NotificationService, storage as ObjectStorageService)
  return { service, query }
}

describe('DM attachment DTO', () => {
  const mediaId = MEDIA
  const check = (input: object) => validateSync(plainToInstance(DmSendDto, { clientId: CLIENT, ...input }), { whitelist: true, forbidNonWhitelisted: true })
  it('allows an attachment with or without text, and text alone', () => {
    for (const kind of ['image', 'file', 'voice']) expect(check({ attachment: { mediaId, kind } })).toEqual([])
    expect(check({ body: 'look', attachment: { mediaId, kind: 'image' } })).toEqual([])
    expect(check({ body: 'hi' })).toEqual([])
  })
  it('rejects unknown kinds, bad media ids and extra attachment fields', () => {
    for (const attachment of [{ mediaId, kind: 'video' }, { mediaId: 'bad', kind: 'image' }, { mediaId, kind: 'file', url: 'x' }, {}]) expect(check({ attachment }).length).toBeGreaterThan(0)
    expect(validateSync(plainToInstance(DmAttachmentDto, { mediaId, kind: 'voice' }))).toEqual([])
  })
})

describe('DM attachments', () => {
  it('sends an attachment with no text and stores its metadata', async () => {
    const { service, query } = setup({}, { ownedDmAttachment: jest.fn(async () => owned) })
    const sent = await service.send(USER, THREAD, { clientId: CLIENT, attachment: { mediaId: MEDIA, kind: 'image' } })
    expect(sent.attachment).toEqual({ mediaId: MEDIA, kind: 'image', url: `/v1/community/dm/attachments/${MEDIA}`, name: 'a.png' })
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.community_dm_messages'))!
    expect(insert[1]).toEqual([THREAD, ME, '', CLIENT, MEDIA, 'image', 'a.png', 'image/png', 100])
  })
  it('rejects a message with neither text nor attachment', async () => {
    const { service } = setup({}, { ownedDmAttachment: jest.fn() })
    await expect(service.send(USER, THREAD, { clientId: CLIENT })).rejects.toMatchObject({ status: 400 })
    await expect(service.send(USER, THREAD, { body: '  ', clientId: CLIENT })).rejects.toMatchObject({ status: 400 })
  })
  it('rejects another member upload and a kind mismatch', async () => {
    for (const result of [null, { ...owned, kind: 'file' }]) {
      const { service, query } = setup({}, { ownedDmAttachment: jest.fn(async () => result) })
      await expect(service.send(USER, THREAD, { clientId: CLIENT, attachment: { mediaId: MEDIA, kind: 'image' } })).rejects.toMatchObject({ status: 400, response: { code: 'DM_ATTACHMENT_INVALID' } })
      expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.community_dm_messages'))).toBe(false)
    }
  })
  it('refuses a reused client id with a different attachment', async () => {
    const { service } = setup({ 'client_id=$2': [{ ...message, attachment_media_id: OTHER }] }, { ownedDmAttachment: jest.fn(async () => owned) })
    await expect(service.send(USER, THREAD, { clientId: CLIENT, attachment: { mediaId: MEDIA, kind: 'image' } })).rejects.toMatchObject({ status: 409 })
  })
})

describe('DM unsend', () => {
  it('lets the sender unsend, and a repeat returns the same time without writing', async () => {
    const at = new Date('2026-10-30T00:00:00Z')
    const first = setup({ 'SELECT id,sender_profile_id': [{ id: MESSAGE, sender_profile_id: ME, deleted_at: null }], 'SET deleted_at': [{ deleted_at: at }] })
    await expect(first.service.unsend(USER, THREAD, MESSAGE)).resolves.toEqual({ id: MESSAGE, deletedAt: at })
    expect(first.query.mock.calls.some(([sql, args]) => sql.includes('audit_logs') && (args as unknown[]).includes('community.dm.unsend'))).toBe(true)
    const again = setup({ 'SELECT id,sender_profile_id': [{ id: MESSAGE, sender_profile_id: ME, deleted_at: at }] })
    await expect(again.service.unsend(USER, THREAD, MESSAGE)).resolves.toEqual({ id: MESSAGE, deletedAt: at })
    expect(again.query.mock.calls.some(([sql]) => sql.includes('SET deleted_at'))).toBe(false)
  })
  it('answers 404 for the recipient, a missing message and a non-member', async () => {
    await expect(setup({ 'SELECT id,sender_profile_id': [{ id: MESSAGE, sender_profile_id: OTHER, deleted_at: null }] }).service.unsend(USER, THREAD, MESSAGE)).rejects.toMatchObject({ status: 404 })
    await expect(setup({ 'SELECT id,sender_profile_id': [] }).service.unsend(USER, THREAD, MESSAGE)).rejects.toMatchObject({ status: 404 })
    await expect(setup({ 'SELECT t.*': [] }).service.unsend(USER, THREAD, MESSAGE)).rejects.toMatchObject({ status: 404 })
  })
  it('shapes an unsent message without body or attachment', async () => {
    const { service } = setup({ 'ORDER BY sequence DESC': [{ ...message, body: 'secret', deleted_at: new Date() }] })
    const page = await service.messages(USER, THREAD, {})
    expect(page.items[0]).toMatchObject({ body: '', attachment: null })
  })
})

describe('DM attachment reads', () => {
  it('serves only members of a thread holding a live message with the attachment', async () => {
    const url = jest.fn(async () => 'https://signed.example/x')
    const ok = setup({ 'msg.attachment_media_id=$1': [{ kind: 'image', name: 'a.png' }] }, { createDmAttachmentUrl: url })
    await expect(ok.service.attachmentUrl(USER, MEDIA)).resolves.toBe('https://signed.example/x')
    expect(url).toHaveBeenCalledWith(MEDIA, 'a.png', 'image')
    const sql = ok.query.mock.calls.find(([s]) => s.includes('msg.attachment_media_id=$1'))![0]
    expect(sql).toContain('msg.deleted_at IS NULL')
    expect(sql).toContain('member.profile_id=$2')
    const gone = setup({ 'msg.attachment_media_id=$1': [] }, { createDmAttachmentUrl: url })
    await expect(gone.service.attachmentUrl(USER, MEDIA)).rejects.toMatchObject({ status: 404 })
  })
})

describe('DM attachment format detection', () => {
  const pad = (...b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(32)])
  it('checks the real bytes against the declared type', () => {
    expect(detectDmAttachment(pad(0xff, 0xd8, 0xff), 'image/jpeg')).toMatchObject({ kind: 'image' })
    expect(detectDmAttachment(pad(0x1a, 0x45, 0xdf, 0xa3), 'audio/webm;codecs=opus')).toMatchObject({ kind: 'voice', contentType: 'audio/webm' })
    expect(detectDmAttachment(Buffer.concat([Buffer.from('OggS'), Buffer.alloc(32)]), 'audio/ogg')).toMatchObject({ kind: 'voice' })
    expect(detectDmAttachment(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(32)]), 'audio/mp4')).toMatchObject({ kind: 'voice' })
    expect(detectDmAttachment(Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(32)]), 'application/pdf')).toMatchObject({ kind: 'file', ext: 'pdf' })
    expect(detectDmAttachment(pad(0x50, 0x4b, 0x03, 0x04), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toMatchObject({ ext: 'docx' })
    expect(detectDmAttachment(Buffer.from('a,b\n1,2\n1,2,3,4,5'), 'text/csv')).toMatchObject({ ext: 'csv' })
  })
  it('rejects mismatches, scripts and executables', () => {
    expect(detectDmAttachment(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml')).toBeNull()
    expect(detectDmAttachment(Buffer.from('MZ' + 'x'.repeat(40)), 'application/pdf')).toBeNull()
    expect(detectDmAttachment(pad(0x1a, 0x45, 0xdf, 0xa3), 'application/pdf')).toBeNull()
    expect(detectDmAttachment(pad(0x00, 0x01, 0x02), 'text/plain')).toBeNull()
    expect(detectDmAttachment(pad(0xff, 0xd8, 0xff), 'image/png')).toBeNull()
    expect(detectDmAttachment(pad(0x50, 0x4b, 0x03, 0x04), 'application/x-msdownload')).toBeNull()
  })
  it('keeps only a safe display name', () => {
    expect(sanitizeDmFileName('..\\..\\evil\u0000/report<1>.pdf', 'pdf')).toBe('report1.pdf')
    expect(sanitizeDmFileName('', 'pdf')).toBe('file.pdf')
    expect(Array.from(sanitizeDmFileName('x'.repeat(400) + '.pdf', 'pdf')).length).toBe(255)
  })
})
