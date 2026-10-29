import { SupportEmailBrand1793232000000 } from '../../src/database/migrations/1793232000000-support-email-brand'
import { supportBrand } from '../../src/database/support-brand'
import { MailInbox1793232000100 } from '../../src/database/migrations/1793232000100-mail-inbox'

describe('mail migrations', () => {
  it('changes string values recursively and supportEmail without renaming keys', () => {
    expect(supportBrand({ 'RWA.LAT': ['RWA.LAT at rwa.lat', { supportEmail: 'old@example.com' }], count: 2 })).toEqual({ 'RWA.LAT': ['A-REIT at a-reit.com', { supportEmail: 'support@a-reit.com' }], count: 2 })
  })
  it('preserves a distinct draft and publication, saves a restorable snapshot, and audits the system actor', async () => {
    const query = jest.fn(async (sql: string) => sql.startsWith('SELECT *') ? [{ revision: 5, published_revision: 4, draft: { name: 'RWA.LAT draft' }, published: { name: 'RWA.LAT live' } }] : sql.includes('AS revision') ? [{ revision: 6 }] : sql.includes('RETURNING id') ? [{ id: 'audit' }] : [])
    const migration = new SupportEmailBrand1793232000000()
    await migration.up({ query } as any)
    const calls = query.mock.calls as unknown as [string, any[]][]
    expect(calls[0][0]).toContain('LOCK TABLE')
    expect(calls.some(c => c[0].includes('CREATE TABLE app.mail_platform_backup AS SELECT *'))).toBe(true)
    const update = calls.find(c => c[0].startsWith('UPDATE app.platform_configuration'))![1]
    expect(JSON.parse(update[0]).name).toBe('A-REIT draft')
    expect(JSON.parse(update[1]).name).toBe('A-REIT live')
    expect(update.slice(2)).toEqual([7, 6])
    expect(calls.find(c => c[0].includes('INSERT INTO app.audit_logs'))![1][0]).toContain('system:migration')
    query.mockClear()
    await migration.down({ query } as any)
    expect(query.mock.calls[0][0]).toContain('draft=b.draft,published_revision=b.published_revision')
    expect(query.mock.calls[0][0]).toContain('published=b.published')
  })
  it('does not publish an unpublished configuration but still records a migration version', async () => {
    const query = jest.fn(async (sql: string) => sql.startsWith('SELECT *') ? [{ revision: 0, published_revision: null, draft: {}, published: null }] : sql.includes('AS revision') ? [{ revision: 1 }] : sql.includes('RETURNING id') ? [{ id: 'audit' }] : [])
    await new SupportEmailBrand1793232000000().up({ query } as any)
    const calls = query.mock.calls as unknown as [string, any[]][]
    expect(calls.find(c => c[0].startsWith('UPDATE app.platform_configuration'))![1][1]).toBeNull()
    expect(calls.some(c => c[0].includes('INSERT INTO app.platform_configuration_versions'))).toBe(true)
  })
  it('seeds only intended roles and enforces message uniqueness and attachment limits', async () => {
    const query = jest.fn()
    await new MailInbox1793232000100().up({ query } as any)
    const sql = query.mock.calls[0][0]
    expect(sql).toContain("name IN ('super_admin','owner','admin')")
    expect(sql).toContain("ARRAY['mail.read','mail.reply']")
    expect(sql).toContain('message_id text NOT NULL UNIQUE')
    expect(sql).toContain('content IS NOT NULL')
  })
})
