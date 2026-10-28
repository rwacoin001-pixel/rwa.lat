import { CommunityService } from '../../src/community/community.service'

/** CommunityService with only what circle() touches. */
function service(answer: (sql: string, args: unknown[]) => unknown[], profiles: Array<Record<string, unknown>>) {
  const calls: Array<{ sql: string; args: unknown[] }> = []
  const svc = Object.create(CommunityService.prototype) as CommunityService
  Object.assign(svc, {
    posts: { manager: { query: async (sql: string, args: unknown[] = []) => { calls.push({ sql, args }); return answer(sql, args) } } },
    profiles: { findBy: async () => profiles },
    storage: undefined,
  })
  return { svc, calls }
}

const profile = (id: string, extra: Record<string, unknown> = {}) => ({ id, handle: `h_${id}`, display_name: `Name ${id}`, kind: 'member', identity_configured: true, avatar_url: null, user_id: `user-${id}`, ...extra })

describe('my circle', () => {
  it('lists the people I invited (if they allow it) and my inviter, as public profiles only', async () => {
    const { svc, calls } = service((sql) => {
      if (sql.includes('to_regclass')) return [{ ready: true }]
      if (sql.includes('UNION ALL')) return [{ id: 'a', relation: 'invited' }, { id: 'b', relation: 'inviter' }]
      if (sql.includes('SELECT show_to_inviter')) return [{ show_to_inviter: false }]
      return []
    }, [profile('a'), profile('b')])
    const result = await svc.circle('me')
    expect(result.showToInviter).toBe(false)
    expect(result.members.map((m) => [m.relation, m.profile.id])).toEqual([['invited', 'a'], ['inviter', 'b']])
    const union = calls.find((c) => c.sql.includes('UNION ALL'))!
    expect(union.args).toEqual(['me'])
    // Invitees can hide from their inviter; the inviter side has no such filter (the invitee already followed their link).
    const [invitedPart, inviterPart] = union.sql.split('UNION ALL')
    expect(invitedPart).toMatch(/p\.show_to_inviter/)
    expect(inviterPart).not.toMatch(/show_to_inviter/)
    expect(union.sql).toMatch(/identity_configured/)
    // No private fields leave the service.
    expect(JSON.stringify(result)).not.toMatch(/user_id|user-a|email/)
  })

  it('is empty before the schema exists and never queries profiles', async () => {
    const { svc, calls } = service((sql) => sql.includes('to_regclass') ? [{ ready: false }] : [], [])
    expect(await svc.circle('me')).toEqual({ members: [], showToInviter: true })
    expect(calls).toHaveLength(1)
  })

  it('gives an empty feed when the circle is empty', async () => {
    const { svc } = service((sql) => sql.includes('to_regclass') ? [{ ready: true }] : [], [])
    expect(await svc.circleFeed('me', {})).toEqual({ items: [], nextCursor: null })
  })
})
