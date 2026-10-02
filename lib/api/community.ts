import { request } from './_http'
export type CommunityPost = { id: string; body: string; images?: string[]; location?: { city: string; countryCode: string } | null; likeCount: number; commentCount: number; viewCount?: number; publishedAt: string; author: { id?: string; avatarSeed?: string; handle: string; displayName: string; avatarUrl: string | null; city?: string | null } }
export type CommunityFeed = { items: CommunityPost[]; nextCursor?: string | null }
export type CommunityTopic = { id: string; slug: string; title: string; description: string | null }
/**
 * Cursor-paginated community feed (infinite scroll).
 * Backend: /v1/community/feed?limit=1..50&cursor=<opaque> → { items, nextCursor }
 * Source of truth: apps/api/src/community/community.service.ts getFeed().
 */
export const getCommunityFeed = (limit = 5, cursor?: string | null, topic?: string) =>
  request<CommunityFeed>(`/v1/community/feed?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`)

export const getCommunityTopics = () => request<{ items: CommunityTopic[] }>('/v1/community/topics')
