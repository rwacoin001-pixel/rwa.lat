/**
 * Own circles (2026-11-01, user): anyone may found one circle and name it; everyone they invited, at any depth, is in it
 * automatically; members may leave (and rejoin), the owner may remove someone. Circle posts are seen only by members.
 * A user is in their own circle and in every ancestor's circle. Until the API ships, `getMyCircles` returns null and the
 * community keeps the older "my circle" timeline.
 */
import { request } from '@/lib/api/_http'
import type { CommunityAuthor, CommunityPost } from '@/lib/community-data'

export type Circle = { id: string; name: string; owner: CommunityAuthor; memberCount: number; createdAt: string; isOwner: boolean }
export type CircleMembership = { owned: Circle | null; joined: Circle[]; left: Circle[] }
export type CircleMemberRow = { profile: CommunityAuthor; depth: number }

export const CIRCLE_NAME_MIN = 2
export const CIRCLE_NAME_MAX = 20

const fail = (message: string) => { throw new Error(message) }

/** null when the circles API is not live yet (404/405), so callers fall back to the older circle timeline. */
export async function getMyCircles(): Promise<CircleMembership | null> {
  const result = await request<CircleMembership>('/v1/community/circles/mine', { loading: 'silent' })
  if (!result.ok) { if (result.error.status === 404 || result.error.status === 405) return null; return fail(result.error.message) }
  return { owned: result.data.owned ?? null, joined: result.data.joined ?? [], left: result.data.left ?? [] }
}
export async function createCircle(name: string) {
  const result = await request<Circle>('/v1/community/circles', { method: 'POST', body: JSON.stringify({ name }) })
  return result.ok ? result.data : fail(result.error.message)
}
export async function renameCircle(id: string, name: string) {
  const result = await request<Circle>(`/v1/community/circles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
  return result.ok ? result.data : fail(result.error.message)
}
export async function deleteCircle(id: string) {
  const result = await request(`/v1/community/circles/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!result.ok) fail(result.error.message)
}
export async function getCirclePosts(id: string, params: { cursor?: string | null; limit?: number } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20), ...(params.cursor ? { cursor: params.cursor } : {}) })
  const result = await request<{ items: CommunityPost[]; nextCursor: string | null }>(`/v1/community/circles/${encodeURIComponent(id)}/feed?${query}`, { loading: 'silent' })
  return result.ok ? result.data : fail(result.error.message)
}
export async function getCircleMembers(id: string, cursor?: string | null) {
  const query = new URLSearchParams({ limit: '50', ...(cursor ? { cursor } : {}) })
  const result = await request<{ items: CircleMemberRow[]; nextCursor: string | null }>(`/v1/community/circles/${encodeURIComponent(id)}/members?${query}`, { loading: 'silent' })
  return result.ok ? result.data : fail(result.error.message)
}
export async function leaveCircle(id: string) {
  const result = await request(`/v1/community/circles/${encodeURIComponent(id)}/leave`, { method: 'POST' })
  if (!result.ok) fail(result.error.message)
}
export async function rejoinCircle(id: string) {
  const result = await request(`/v1/community/circles/${encodeURIComponent(id)}/rejoin`, { method: 'POST' })
  if (!result.ok) fail(result.error.message)
}
export async function removeCircleMember(id: string, profileId: string) {
  const result = await request(`/v1/community/circles/${encodeURIComponent(id)}/members/${encodeURIComponent(profileId)}/remove`, { method: 'POST' })
  if (!result.ok) fail(result.error.message)
}

export const validCircleName = (name: string) => {
  const trimmed = name.trim()
  // eslint-disable-next-line no-control-regex
  return trimmed.length >= CIRCLE_NAME_MIN && trimmed.length <= CIRCLE_NAME_MAX && !/[\u0000-\u001f\u007f]/.test(trimmed)
}
