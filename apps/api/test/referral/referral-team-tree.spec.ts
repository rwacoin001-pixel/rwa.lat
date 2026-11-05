import { BadRequestException, NotFoundException } from '@nestjs/common'
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { ReferralReadService } from '../../src/referral/referral-read.service'
import { ReferralUserFoundationController } from '../../src/referral/referral-http.module'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'

describe('referral team tree contract', () => {
  const setup = (rows: unknown[] = [{ responseDepth: 1, total: 0, userId: null, profileUserId: null }]) => {
    const query = jest.fn(async (_sql: string, _args: unknown[]) => rows)
    return { read: new ReferralReadService({ query } as never), query }
  }
  it('returns an empty root in one SQL query with the default page size', async () => {
    const { read, query } = setup()
    expect(await read.teamTree('viewer')).toEqual({ parent: null, depth: 1, items: [], total: 0, page: 1, pageSize: 50 })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]).toEqual([expect.any(String), ['viewer', null, 50, 0]])
  })
  it.each(['bad', '', 'FFFFFFFF', '../x', '00000001\n', ['00000001'], null])('rejects malformed parent %j before SQL', async parent => {
    const { read, query } = setup()
    await expect(read.teamTree('viewer', parent as never)).rejects.toBeInstanceOf(BadRequestException)
    expect(query).not.toHaveBeenCalled()
  })
  it.each([['0', '50'], ['1', '101'], ['1', '0']])('rejects bad pagination %s/%s', async (page, size) => {
    const { read, query } = setup()
    await expect(read.teamTree('viewer', undefined, page, size)).rejects.toBeInstanceOf(BadRequestException)
    expect(query).not.toHaveBeenCalled()
  })
  it('does not disclose absent, colliding, or non-expandable parents', async () => {
    const { read } = setup([{ responseDepth: null, total: 0, userId: null }])
    await expect(read.teamTree('viewer', '00000003')).rejects.toBeInstanceOf(NotFoundException)
  })
  it('strips internal ids and profile columns, preserves static avatars and atomic strings', async () => {
    const { read } = setup([{ responseDepth: 3, total: 1, userId: 'full-id', memberLabel: '00000003', depth: 3,
      boundAt: new Date('2026-11-05T00:00:00Z'), memberLevel: 2, active30d: true, childCount: 0, teamSize: 0,
      rewardsToMeAtomic: '9007199254740993000001', profileUserId: 'full-id', display_name: 'Alice', avatar_url: '/avatars/professions/01.webp' }])
    const result = await read.teamTree('viewer', '00000002')
    expect(result).toEqual({ parent: '00000002', depth: 3, total: 1, page: 1, pageSize: 50, items: [{
      memberLabel: '00000003', depth: 3, boundAt: '2026-11-05T00:00:00.000Z', memberLevel: 2, active30d: true,
      childCount: 0, teamSize: 0, rewardsToMeAtomic: '9007199254740993000001', displayName: 'Alice', avatarUrl: '/avatars/professions/01.webp',
    }] })
    expect(JSON.stringify(result)).not.toMatch(/full-id|userId|email|phone|deposit|purchase/)
  })
  it('retains null identity when the visibility join does not match', async () => {
    const { read } = setup([{ responseDepth: 1, total: 1, userId: 'full-id', memberLabel: '00000001', depth: 1,
      boundAt: new Date(), memberLevel: 1, active30d: false, childCount: 0, teamSize: 0, rewardsToMeAtomic: '0',
      profileUserId: null, display_name: null, avatar_url: null }])
    expect((await read.teamTree('viewer')).items[0]).toMatchObject({ displayName: null, avatarUrl: null })
  })
  it('wires the session-guarded route and forwards only the session viewer', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ReferralUserFoundationController)).toContain(SessionAuthGuard)
    expect(Reflect.getMetadata(PATH_METADATA, ReferralUserFoundationController.prototype.teamTree)).toBe('team-tree')
    const read = { teamTree: jest.fn() }
    const controller = new ReferralUserFoundationController({} as never, read as never, {} as never, {} as never)
    await controller.teamTree({ auth: { userId: 'viewer' }, query: { userId: 'attacker' } } as never, '00000001', '2', '10')
    expect(read.teamTree).toHaveBeenCalledWith('viewer', '00000001', '2', '10')
  })
})
