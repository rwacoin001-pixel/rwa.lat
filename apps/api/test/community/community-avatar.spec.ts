import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { MemberAvatarDto } from '../../src/community/community-member.dto'
import { CommunityMemberService } from '../../src/community/community-member.service'
import { CommunityMemberController } from '../../src/community/community-member.controller'
import { communityMediaId } from '../../src/community/community.util'

const objectId = '00000001-0000-4000-8000-000000000000'
const presetUrl = '/avatars/professions/07.webp'

describe('preset avatar input', () => {
  it.each(Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0')))('accepts preset %s', async preset => {
    expect(await validate(plainToInstance(MemberAvatarDto, { preset }))).toEqual([])
  })
  it('retains uploaded object ids', async () => {
    expect(await validate(plainToInstance(MemberAvatarDto, { objectId }))).toEqual([])
  })
  it.each([{ preset: '17' }, { preset: '7' }, { preset: '../x' }, { preset: '01\n' }, { preset: 7 },
    { objectId, preset: '07' }, {}, { objectId: null }, { preset: null },
    { objectId, preset: null }, { objectId: null, preset: '07' }, { objectId: 'invalid' }])('rejects %j', async input => {
    expect(await validate(plainToInstance(MemberAvatarDto, input))).not.toHaveLength(0)
  })
  it('forwards the complete choice from the authenticated controller', async () => {
    const member = { setAvatar: jest.fn() }
    const controller = new CommunityMemberController(member as never, {} as never)
    await controller.setAvatar({ userId: 'viewer' } as never, { preset: '07' } as never)
    expect(member.setAvatar).toHaveBeenCalledWith('viewer', { preset: '07' })
  })
})

describe('preset avatar persistence and own-profile reads', () => {
  function setup() {
    const profile = { id: 'profile', user_id: 'viewer', display_name: 'Alice', kind: 'member', is_active: true,
      identity_configured: true, handle: 'alice', avatar_url: null as string | null }
    const query = jest.fn(async (sql: string) => sql.includes('SELECT status') ? [{ status: 'active' }] : [])
    const save = jest.fn(async p => p)
    const m = { query, save, getRepository: () => ({ findOneBy: async () => profile }) }
    const transaction = jest.fn(async work => work(m))
    const storage = { attachableCommunityImages: jest.fn(async () => [objectId]), readableCommunityImageIds: jest.fn(async () => new Set<string>()) }
    return { service: new CommunityMemberService({ transaction } as never, storage as never), profile, save, storage, transaction }
  }
  it('stores the static path without uploading or a scan and returns it immediately', async () => {
    const { service, profile, storage } = setup()
    const result = await service.setAvatar('viewer', { preset: '07' } as never)
    expect(profile.avatar_url).toBe(presetUrl)
    expect(result).toMatchObject({ avatarUrl: presetUrl, avatarPending: false })
    expect(await service.profile('viewer')).toMatchObject({ avatarUrl: presetUrl, avatarPending: false })
    expect(communityMediaId(presetUrl)).toBeNull()
    expect(storage.attachableCommunityImages).not.toHaveBeenCalled()
    expect(storage.readableCommunityImageIds).not.toHaveBeenCalled()
    expect(await service.setAvatar('viewer', null)).toMatchObject({ avatarUrl: null, avatarPending: false })
  })
  it('keeps ownership checks and pending scans for uploaded avatars', async () => {
    const { service, storage } = setup()
    expect(await service.setAvatar('viewer', { objectId } as never)).toMatchObject({ avatarUrl: null, avatarPending: true })
    expect(storage.attachableCommunityImages).toHaveBeenCalledWith('viewer', [objectId], 'avatar')
    storage.readableCommunityImageIds.mockResolvedValueOnce(new Set([objectId]))
    expect(await service.profile('viewer')).toMatchObject({ avatarUrl: `/v1/community/media/${objectId}`, avatarPending: false })
  })
  it.each([{}, { preset: '17' }, { preset: '../x' }, { objectId, preset: '07' }])('rejects invalid service input %j before writing', async input => {
    const { service, save, transaction } = setup()
    await expect(service.setAvatar('viewer', input as never)).rejects.toMatchObject({ status: 400 })
    expect(save).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
})
