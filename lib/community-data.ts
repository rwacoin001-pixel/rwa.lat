/**
 * Community data layer — public reads from the Core API community module.
 * API-first with graceful failure (no mock fallback: an empty or offline
 * community must stay honest).
 */

import { request } from './api/_http'

export type CommunityAuthor = {
  id: string
  avatarSeed?: string
  handle: string
  displayName: string
  kind: 'persona' | 'member' | 'official'
  avatarUrl: string | null
  bio: string | null
  city: string | null
  countryCode: string | null
  timezone?: string | null
  /** Optional until the API ships it (see 后端需求.md); the profile hides the join date when absent. */
  joinedAt?: string | null
  coverUrl?: string | null
}

/** A ledger-verified result attached to a post; the server computed the figure (2026-10-28). */
export type CommunityProof = { kind: 'quant_day' | 'prediction_win'; title: string; pct: number; tradeDate: string }
/** What a client asks to attach; the server resolves it from the author's own ledger rows. */
export type CommunityProofRequest = { kind: 'quant_day'; product: string; date: string } | { kind: 'prediction_win'; bet: string }

export type CommunityPost = {
  circle?: { id: string; name: string } | null
  proof?: CommunityProof | null
  /** A share-a-result card (2026-11-01): server snapshot, hidden fields absent. */
  card?: import('./community-cards').PostCard | null
  lang?: string
  location?: { city: string; countryCode: string } | null
  id: string
  body: string
  images: string[]
  topics: string[]
  likeCount: number
  commentCount: number
  viewCount: number
  publishedAt: string | null
  author: CommunityAuthor | null
}

export type CommunityComment = {
  lang?: string
  id: string
  postId: string
  parentId: string | null
  body: string
  images?: string[]
  likeCount: number
  createdAt: string
  author: CommunityAuthor | null
}

export type CommunityTopic = {
  /** Stable API id when available; older deployments may only return slug. */
  id?: string
  slug: string
  title: string
  description: string | null
}

export type CommunityPostResponse = {
  post: CommunityPost
  comments: CommunityComment[]
  commentTotal: number
}

export type CommunityProfileResponse = {
  profile: CommunityAuthor
  stats: { postCount: number; followerCount: number; followingCount: number }
  posts: CommunityPost[]
}

/** Public reads go out without a session; circle posts (2026-11-01) need it, so post detail and comments send it when there is one. */
async function apiGet<T>(path: string, signedIn = false): Promise<T> {
  const result = await request<T>(path, signedIn ? {} : { token: null })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function getCommunityFeed(params: { sort?: 'latest' | 'hot'; topic?: string; cursor?: string; limit?: number; cards?: 'all' | 'quant' | 'prediction' | 'funds' } = {}) {
  const query = new URLSearchParams()
  if (params.sort) query.set('sort', params.sort)
  // 晒单 (2026-11-01): only posts with a result card, optionally one family of kinds.
  if (params.cards) { query.set('hasCard', 'true'); if (params.cards !== 'all') query.set('cardKind', params.cards) }
  if (params.topic) query.set('topic', params.topic)
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', String(params.limit))
  const suffix = query.toString()
  return apiGet<{ items: CommunityPost[]; nextCursor: string | null }>(`/v1/community/feed${suffix ? `?${suffix}` : ''}`, true)
}

export async function getCommunityTopics() {
  return apiGet<{ items: CommunityTopic[] }>('/v1/community/topics')
}

export async function getCommunityPost(id: string) {
  return apiGet<CommunityPostResponse>(`/v1/community/posts/${encodeURIComponent(id)}`, true)
}

export async function getCommunityComments(postId: string, params: { before?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.before) query.set('before', params.before)
  if (params.limit) query.set('limit', String(params.limit))
  const suffix = query.toString()
  return apiGet<{ items: CommunityComment[]; nextBefore: string | null }>(
    `/v1/community/posts/${encodeURIComponent(postId)}/comments${suffix ? `?${suffix}` : ''}`,
    true,
  )
}

export async function getCommunityProfile(handle: string) {
  return apiGet<CommunityProfileResponse>(`/v1/community/profiles/${encodeURIComponent(handle)}`)
}

export async function submitCommunityReport(params: { targetType: 'post' | 'comment' | 'profile'; targetId: string; reason: string }) {
  const result = await request<{ id: string; state: string; createdAt: string }>('/v1/community/reports', { method: 'POST', token: null, body: JSON.stringify(params) })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

/** My circle (2026-10-28): people I invited and who invited me, with my own visibility to my inviter. Signed-in only. */
export type CircleMember = { relation: 'invited' | 'inviter'; profile: CommunityAuthor }
export async function getCircle() {
  const result = await request<{ members: CircleMember[]; showToInviter: boolean }>('/v1/community/me/circle', { loading: 'silent' })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}
export async function getCircleFeed(params: { cursor?: string; limit?: number } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20), ...(params.cursor ? { cursor: params.cursor } : {}) })
  const result = await request<{ items: CommunityPost[]; nextCursor: string | null }>(`/v1/community/me/circle/feed?${query}`, { loading: 'silent' })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}
export async function setCircleVisibility(visible: boolean) {
  const result = await request<{ showToInviter: boolean }>('/v1/community/me/circle/visibility', { method: 'PUT', body: JSON.stringify({ visible }), loading: 'silent' })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}
