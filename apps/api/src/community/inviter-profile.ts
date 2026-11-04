import type { EntityManager } from 'typeorm'
import type { ObjectStorageService } from '../object-storage/object-storage.service'
import { communityMediaId } from './community.util'

/** Same opt-in and profile eligibility as CommunityService.circle. Alias must be internal SQL. */
export const inviterProfileVisible = (alias: string) => `${alias}.kind = 'member' AND ${alias}.identity_configured AND ${alias}.is_active AND ${alias}.show_to_inviter`

export async function inviterProfiles(db: Pick<EntityManager, 'query'>, userIds: string[], storage?: ObjectStorageService) {
  const result = new Map<string, { displayName: string | null; avatarUrl: string | null }>()
  if (!userIds.length) return result
  const rows: Array<{ user_id: string; display_name: string | null; avatar_url: string | null }> = await db.query(`
    SELECT p.user_id,p.display_name,p.avatar_url FROM app.community_profiles p
    WHERE p.user_id=ANY($1::uuid[]) AND ${inviterProfileVisible('p')}`, [userIds])
  const mediaIds = rows.map(row => communityMediaId(row.avatar_url)).filter((id): id is string => !!id)
  const readable = storage && mediaIds.length
    ? await storage.readableCommunityImageIds(mediaIds).catch(() => new Set<string>()) : new Set<string>()
  for (const row of rows) {
    const media = communityMediaId(row.avatar_url)
    result.set(row.user_id, {
      displayName: row.display_name && !/^Member [0-9a-f]{6}$/.test(row.display_name) ? row.display_name : null,
      avatarUrl: media && !readable.has(media) ? null : row.avatar_url ?? null,
    })
  }
  return result
}
