import { DataSource } from 'typeorm'
import { CommunityMemberService } from '../../src/community/community-member.service'

function setup(dmPolicy: 'everyone' | 'following' = 'everyone') {
  const profile = { id: 'profile', user_id: 'session-user', is_active: true, identity_configured: true,
    handle: 'alice.sg', handle_base: 'alice', display_name: 'Alice', city: 'Singapore', country_code: 'SG', dm_policy: dmPolicy }
  const query = jest.fn(async (sql: string, _args?: unknown[]) => {
    if (sql.includes('SELECT status')) return [{ status: 'active' }]
    if (sql.includes('pg_advisory_xact_lock') || sql.includes('community_handle_aliases') || sql.includes('INSERT INTO app.audit_logs')) return []
    throw new Error(`Unexpected SQL: ${sql}`)
  })
  const save = jest.fn(async p => p)
  const manager = { query, save, getRepository: () => ({ findOneBy: jest.fn(async () => profile) }) }
  const db = { transaction: (work: (m: unknown) => unknown) => work(manager) } as unknown as DataSource
  return { service: new CommunityMemberService(db), query, save }
}

describe('DM preference in existing profile settings', () => {
  it('returns the default policy with my profile', async () => {
    expect(await setup().service.profile('session-user')).toMatchObject({ dmPolicy: 'everyone' })
  })
  it.each(['everyone', 'following'] as const)('persists %s without replacing my identity', async dmPolicy => {
    const { service, query, save } = setup(dmPolicy === 'everyone' ? 'following' : 'everyone')
    expect(await service.updateProfile('session-user', { displayName: 'Alice', handle: 'alice', dmPolicy })).toMatchObject({ dmPolicy, handle: 'alice.sg' })
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile', dm_policy: dmPolicy }))
    const audit = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.audit_logs'))!
    expect(audit[1]?.[1]).toBe('session-user')
    expect(JSON.parse(audit[1]?.[4] as string)).toMatchObject({ to: dmPolicy })
  })
  it('preserves the policy when an existing client updates other fields', async () => {
    const { service, query } = setup('following')
    expect(await service.updateProfile('session-user', { displayName: 'Alice', handle: 'alice' })).toMatchObject({ dmPolicy: 'following' })
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.audit_logs'))).toBe(false)
  })
  it('rejects an invalid policy before saving', async () => {
    const { service, save } = setup()
    await expect(service.updateProfile('session-user', { displayName: 'Alice', handle: 'alice', dmPolicy: 'friends' as any })).rejects.toMatchObject({ status: 400 })
    expect(save).not.toHaveBeenCalled()
  })
})
