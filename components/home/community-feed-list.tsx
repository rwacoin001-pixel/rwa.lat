'use client'
import {CommunityText} from '../community-text'
import {CommunityAvatar} from '../community-avatar'

// Infinite-scroll community feed for the home screen.
// Backend contract: /v1/community/feed?limit=&cursor= → { items, nextCursor }
// (see apps/api/src/community/community.service.ts getFeed).
import { useCallback, useEffect, useRef, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { getCommunityFeed, type CommunityPost } from '@/lib/api/community'
import { EmptyState } from '@/components/ui/Empty'

const PAGE_DEFAULT = 5

export function CommunityFeedList({
  onOpen,
  labels,
  preview,
}: {
  onOpen: () => void
  labels: { loading: string; retry: string; end: string; emptyTitle: string; emptyBody: string }
  /** preview = show N posts, no infinite scroll (home). undefined = infinite scroll (community). */
  preview?: number
}) {
  const [items, setItems] = useState<CommunityPost[]>([])
  const [cursor, setCursor] = useState<string | null | undefined>(undefined)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)

  const pageSize = preview ?? PAGE_DEFAULT
  const load = useCallback(async (next: string | null | undefined, append: boolean) => {
    if (busyRef.current) return
    busyRef.current = true
    if (append) setLoadingMore(true)
    try {
      const r = await getCommunityFeed(pageSize, next ?? null)
      if (r.ok) {
        setItems((prev) => (append ? [...prev, ...r.data.items] : r.data.items))
        setCursor(r.data.nextCursor ?? null)
        setState('ready')
      } else if (!append) {
        setState('error')
      }
    } finally {
      busyRef.current = false
      setLoadingMore(false)
    }
  }, [pageSize])

  useEffect(() => {
    void load(undefined, false)
  }, [load])

  useEffect(() => {
    if (preview) return
    const el = sentinelRef.current
    if (!el || cursor === null) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && cursor) void load(cursor, true)
    }, { rootMargin: '320px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [cursor, load, preview])

  if (state === 'loading') {
    return <div className="community-feed__loading" aria-busy="true"><span /><span /></div>
  }
  if (state === 'error') {
    return (
      <button type="button" className="community-feed__retry" onClick={() => { setState('loading'); void load(undefined, false) }}>
        {labels.retry}
      </button>
    )
  }
  if (!items.length) {
    return <EmptyState variant="card" icon={UsersRound} title={labels.emptyTitle} body={labels.emptyBody} />
  }
  return (
    <div className="community-feed">
      {items.map((post) => (
        <article className="card-row s2-post-row" key={post.id}>
<CommunityAvatar avatarUrl={post.author.avatarUrl} seed={post.author.avatarSeed ?? post.author.id} handle={post.author.handle} />
          <span><b>{post.author.displayName}</b><small>@{post.author.handle}{(post.location?.city || post.author.city) ? ` · ${post.location?.city || post.author.city}` : ''}</small></span>
          <CommunityText body={post.body} targetId={post.id} compact />
          <button type="button" onClick={onOpen}>{post.likeCount} · {post.commentCount}</button>
        </article>
      ))}
      {!preview && (
        <div ref={sentinelRef} className="community-feed__sentinel" aria-hidden="true">
          {loadingMore ? <span className="community-feed__spinner" /> : cursor === null ? <small className="community-feed__end">{labels.end}</small> : null}
        </div>
      )}
    </div>
  )
}
