/**
 * Community data layer — public reads from the Core API community module.
 * API-first with graceful failure (no mock fallback: an empty or offline
 * community must stay honest).
 */

import { request } from './api/_http'

export type CommunityAuthor = {
  id: string
  handle: string
  displayName: string
  kind: 'persona' | 'member' | 'official'
  avatarUrl: string | null
  bio: string | null
  city: string | null
  countryCode: string | null
  timezone?: string | null
}

export type CommunityPost = {
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

async function apiGet<T>(path: string): Promise<T> {
  const result = await request<T>(path, { token: null })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function getCommunityFeed(params: { sort?: 'latest' | 'hot'; topic?: string; cursor?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.sort) query.set('sort', params.sort)
  if (params.topic) query.set('topic', params.topic)
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', String(params.limit))
  const suffix = query.toString()
  return apiGet<{ items: CommunityPost[]; nextCursor: string | null }>(`/v1/community/feed${suffix ? `?${suffix}` : ''}`)
}

export async function getCommunityTopics() {
  return apiGet<{ items: CommunityTopic[] }>('/v1/community/topics')
}

export async function getCommunityPost(id: string) {
  return apiGet<CommunityPostResponse>(`/v1/community/posts/${encodeURIComponent(id)}`)
}

export async function getCommunityComments(postId: string, params: { before?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.before) query.set('before', params.before)
  if (params.limit) query.set('limit', String(params.limit))
  const suffix = query.toString()
  return apiGet<{ items: CommunityComment[]; nextBefore: string | null }>(
    `/v1/community/posts/${encodeURIComponent(postId)}/comments${suffix ? `?${suffix}` : ''}`,
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
