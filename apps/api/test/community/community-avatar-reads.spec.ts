import { CommunityService } from '../../src/community/community.service'
import { CommunityDmService } from '../../src/community/community-dm.service'
import { inviterProfiles } from '../../src/community/inviter-profile'
import { RankingService } from '../../src/membership/ranking.service'
import { CommunityProfile } from '../../src/community/community.entities'

const avatar = '/avatars/professions/16.webp'
const media = '00000001-0000-4000-8000-000000000000'
const uploaded = `/v1/community/media/${media}`
const profile = { id: 'profile', user_id: 'viewer', handle: 'alice', display_name: 'Alice',
  kind: 'member', identity_configured: true, is_active: true, avatar_url: avatar } as CommunityProfile

describe('preset avatars across community readers', () => {
  function community() {
    const storage = { readableCommunityImageIds: jest.fn(async () => new Set<string>()) }
    const service = Object.create(CommunityService.prototype) as CommunityService
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ ready: true }]
      if (sql.includes('UNION ALL')) return [{ id: profile.id, relation: 'invited' }]
      if (sql.includes('show_to_inviter')) return [{ show_to_inviter: true }]
      throw new Error(`Unexpected SQL: ${sql}`)
    })
    Object.assign(service, { storage, profiles: { findBy: async () => [profile], findOne: async () => profile },
      posts: { manager: { query }, count: async () => 0, find: async () => [] }, follows: { count: async () => 0 } })
    return { service, storage }
  }
  it('preserves presets in public profiles and circle members without querying scan status', async () => {
    const { service, storage } = community()
    expect((await service.getProfile('alice')).profile.avatarUrl).toBe(avatar)
    expect((await service.profileViews([profile.id])).get(profile.id)?.avatarUrl).toBe(avatar)
    expect((await service.circle('viewer')).members[0].profile.avatarUrl).toBe(avatar)
    expect(storage.readableCommunityImageIds).not.toHaveBeenCalled()
  })
  it('preserves presets in the shared feed/post and comment shapers even with a pending upload in the same batch', async () => {
    const { service, storage } = community()
    const post = { id: 'post', author: profile, images: [uploaded], topics: [] }
    const gate = await service['mediaGate']([post])
    expect(service['shapePost'](post as never, gate)).toMatchObject({ images: [], author: { avatarUrl: avatar } })
    expect(service['shapeComment']({ id: 'comment', author: profile } as never, gate)).toMatchObject({ author: { avatarUrl: avatar } })
    expect(service['shapePost']({ ...post, author: { ...profile, avatar_url: uploaded } } as never, gate).author?.avatarUrl).toBeNull()
    expect(storage.readableCommunityImageIds).toHaveBeenCalledWith([media])
  })
  it('preserves presets in DM thread previews without treating them as a media id', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('JOIN app.users')) return [{ ...profile, status: 'active' }]
      if (sql.includes('FROM app.community_dm_members')) return [{ id: 'thread', other_id: 'other', handle: 'alice',
        display_name: 'Alice', avatar_url: avatar, kind: 'member', last_message_at: new Date(), unread_count: '0' }]
      throw new Error(`Unexpected SQL: ${sql}`)
    })
    const storage = { readableCommunityImageIds: jest.fn() }
    const service = new CommunityDmService({ transaction: async (work: (m: unknown) => unknown) => work({ query }) } as never, {} as never, storage as never)
    expect((await service.threads('viewer')).items[0].otherProfile.avatarUrl).toBe(avatar)
    expect(storage.readableCommunityImageIds).not.toHaveBeenCalled()
  })
  it('preserves presets in rankings', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('max(generated_at)')) return [{ generated_at: new Date() }]
      if (sql.includes('JOIN app.community_profiles')) return [{ rank: 1, value: '1', handle: 'alice', display_name: 'Alice', avatar_url: avatar, avatar_seed: profile.id, level: 1 }]
      throw new Error(`Unexpected SQL: ${sql}`)
    })
    const service = new RankingService({ transaction: async (_isolation: string, work: (m: unknown) => unknown) => work({ query }) } as never)
    expect((await service.read()).items[0].avatarUrl).toBe(avatar)
  })
  it('preserves presets in referral profile rows while still filtering opt-in visibility in SQL', async () => {
    const query = jest.fn(async () => [{ user_id: 'viewer', display_name: 'Alice', avatar_url: avatar }])
    const storage = { readableCommunityImageIds: jest.fn() }
    expect((await inviterProfiles({ query } as never, ['viewer'], storage as never)).get('viewer')).toEqual({ displayName: 'Alice', avatarUrl: avatar })
    expect(query).toHaveBeenCalledWith(expect.stringContaining('p.show_to_inviter'), [['viewer']])
    expect(storage.readableCommunityImageIds).not.toHaveBeenCalled()
  })
})
