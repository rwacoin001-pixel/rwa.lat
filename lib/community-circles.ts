/**
 * Own circles (2026-11-01, user): anyone may found one circle and name it; everyone they invited, at any depth, is in it
 * automatically; members may leave (and rejoin), the owner may remove someone. Circle posts are seen only by members.
 * A user is in their own circle and in every ancestor's circle. Until the API ships, `getMyCircles` returns null and the
 * community keeps the older "my circle" timeline.
 * Joining (2026-11-01, user): the owner's invite tree joins on its own (with a notice); anyone else opens the circle's
 * invite link (/c/<code>) and asks to join, and the owner approves. Leaving keeps old posts; the owner can undo a removal.
 */
import { request } from '@/lib/api/_http'
import type { CommunityAuthor, CommunityPost } from '@/lib/community-data'

export type Circle = { id: string; name: string; owner: CommunityAuthor; memberCount: number; createdAt: string; isOwner: boolean
  publicNo: number; searchable?: boolean; muted: boolean; silenced: boolean; pinnedPost: CommunityPost | null; lastPostAt: string | null
  /** Owner only. */
  inviteCode?: string | null; pendingCount?: number }
export type CircleMembership = { owned: Circle | null; joined: Circle[]; left: Circle[] }
export type CircleMemberRow = { profile: CommunityAuthor; depth: number; via?: 'tree' | 'link'; silenced: boolean }
export type CircleInviteStatus = 'none' | 'pending' | 'member' | 'owner' | 'removed' | 'rejected'
export type CircleInvite = { circle: { id: string; name: string; owner: CommunityAuthor; memberCount: number }; status: CircleInviteStatus }
export type CirclePersonRow = { profile: CommunityAuthor; createdAt?: string; removedAt?: string }

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

const path = (id: string, rest = '') => `/v1/community/circles/${encodeURIComponent(id)}${rest}`
/** The public invite card. null when the link is unknown, reset or the circle is gone. */
export async function getCircleInvite(code: string): Promise<CircleInvite | null> {
  const result = await request<CircleInvite>(`/v1/community/circles/invite/${encodeURIComponent(code)}`, { loading: 'silent' })
  if (!result.ok) { if (result.error.status === 404) return null; return fail(result.error.message) }
  return result.data
}
export async function applyToCircle(code: string) {
  const result = await request<{ status: CircleInviteStatus }>(`/v1/community/circles/invite/${encodeURIComponent(code)}/apply`, { method: 'POST' })
  return result.ok ? result.data.status : fail(result.error.status === 403 ? 'CIRCLE_REMOVED' : result.error.message)
}
export async function getCircleRequests(id: string) {
  const result = await request<{ items: CirclePersonRow[] }>(path(id, '/requests'), { loading: 'silent' })
  return result.ok ? result.data.items : fail(result.error.message)
}
export async function decideCircleRequest(id: string, profileId: string, approve: boolean) {
  const result = await request(path(id, `/requests/${encodeURIComponent(profileId)}/${approve ? 'approve' : 'reject'}`), { method: 'POST' })
  if (!result.ok) fail(result.error.message)
}
export async function resetCircleInvite(id: string) {
  const result = await request<{ inviteCode: string }>(path(id, '/invite/reset'), { method: 'POST' })
  return result.ok ? result.data.inviteCode : fail(result.error.message)
}
export async function getRemovedCircleMembers(id: string) {
  const result = await request<{ items: CirclePersonRow[] }>(path(id, '/removed'), { loading: 'silent' })
  return result.ok ? result.data.items : fail(result.error.message)
}
export async function restoreCircleMember(id: string, profileId: string) {
  const result = await request(path(id, `/members/${encodeURIComponent(profileId)}/restore`), { method: 'POST' })
  if (!result.ok) fail(result.error.message)
}
export const circleInviteUrl = (code: string) => `${typeof window === 'undefined' ? 'https://a-reit.com' : window.location.origin}/c/${encodeURIComponent(code)}`

export const validCircleName = (name: string) => {
  const trimmed = name.trim()
  // eslint-disable-next-line no-control-regex
  return trimmed.length >= CIRCLE_NAME_MIN && trimmed.length <= CIRCLE_NAME_MAX && !/[\u0000-\u001f\u007f]/.test(trimmed)
}

/** Discovery and circle controls (2026-11-01). */
export type CircleSearchResult = { circle: Pick<Circle, 'id' | 'name' | 'owner' | 'memberCount' | 'publicNo'>; status: CircleInviteStatus }
export async function searchCircles(q: string) {
  const result = await request<{ items: CircleSearchResult[] }>(`/v1/community/circles/search?${new URLSearchParams({ q })}`, { loading: 'silent' })
  return result.ok ? result.data.items : fail(result.error.message)
}
export async function applyToCircleById(id: string) {
  const result = await request<{ status: CircleInviteStatus }>(path(id, '/apply'), { method: 'POST' })
  return result.ok ? result.data.status : fail(result.error.status === 403 ? 'CIRCLE_REMOVED' : result.error.message)
}
export async function updateCircle(id: string, changes: { name?: string; searchable?: boolean }) {
  const result = await request<Circle>(path(id), { method: 'PATCH', body: JSON.stringify(changes) })
  return result.ok ? result.data : fail(result.error.message)
}
export async function pinCirclePost(id: string, postId: string | null) {
  const result = await request(path(id, '/pin'), { method: postId ? 'POST' : 'DELETE', ...(postId ? { body: JSON.stringify({ postId }) } : {}) })
  if (!result.ok) fail(result.error.message)
}
export async function muteCircle(id: string, muted: boolean) {
  const result = await request(path(id, '/mute'), { method: 'POST', body: JSON.stringify({ muted }) })
  if (!result.ok) fail(result.error.message)
}
export async function silenceCircleMember(id: string, profileId: string, silenced: boolean) {
  const result = await request(path(id, `/members/${encodeURIComponent(profileId)}/${silenced ? 'silence' : 'unsilence'}`), { method: 'POST' })
  if (!result.ok) fail(result.error.message)
}
export async function searchCircle<T extends 'posts' | 'members'>(id: string, q: string, type: T, cursor?: string | null) {
  const query = new URLSearchParams({ q, type, ...(cursor ? { cursor } : {}) })
  const result = await request<{ items: (T extends 'posts' ? CommunityPost : CircleMemberRow)[]; nextCursor: string | null }>(path(id, `/search?${query}`), { loading: 'silent' })
  return result.ok ? result.data : fail(result.error.message)
}
