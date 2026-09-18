'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Bot, Heart, MessageCircle, RotateCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
import type { RwaScreen } from '@/lib/rwa-routes'
import AnimatedBrand from './animated-brand'
import LanguageMenu from './language-menu'
import {
  getCommunityFeed,
  getCommunityPost,
  getCommunityProfile,
  getCommunityTopics,
  type CommunityAuthor,
  type CommunityPost,
  type CommunityPostResponse,
  type CommunityProfileResponse,
  type CommunityTopic,
} from '@/lib/community-data'

const AVATAR_GRADIENTS: Array<[string, string]> = [
  ['#2fe6bf', '#0b6b57'],
  ['#7589ff', '#2c3a9e'],
  ['#ffad3d', '#9a5410'],
  ['#ff627a', '#8c1f36'],
  ['#c5e3f7', '#47759b'],
  ['#e7c7ff', '#7a3fae'],
]

function avatarColors(seed: string): [string, string] {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const first = trimmed[0]
  return /[a-z]/i.test(first) ? first.toUpperCase() : first
}

function Avatar({ author, size = 38 }: { author?: CommunityAuthor | null; size?: number }) {
  if (author?.avatarUrl) {
    return <img className="community-avatar" style={{ width: size, height: size }} src={author.avatarUrl} alt="" loading="lazy" />
  }
  const [from, to] = avatarColors(author?.handle ?? 'anonymous')
  return (
    <span
      className="community-avatar"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${to})`, fontSize: Math.max(12, Math.round(size * 0.42)) }}
      aria-hidden="true"
    >
      {initialOf(author?.displayName ?? '?')}
    </span>
  )
}

function useTimeAgo() {
  const { locale } = useI18n()
  return (iso?: string | null) => {
    if (!iso) return ''
    const diffMs = Date.now() - new Date(iso).getTime()
    const zh = locale.startsWith('zh')
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 1) return zh ? '刚刚' : 'just now'
    if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return zh ? `${days} 天前` : `${days}d ago`
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso))
  }
}

function AuthorLine({ author, meta, onOpenProfile, size = 38 }: { author: CommunityAuthor | null; meta: string; onOpenProfile?: (handle: string) => void; size?: number }) {
  return (
    <span className="community-card__author">
      <Avatar author={author} size={size} />
      <span className="community-author-meta">
        <b
          role={onOpenProfile ? 'link' : undefined}
          onClick={onOpenProfile && author ? (event) => { event.stopPropagation(); onOpenProfile(author.handle) } : undefined}
        >
          {author?.displayName ?? '—'}
        </b>
        <small>{meta}</small>
      </span>
    </span>
  )
}

function PostCard({ post, timeAgo, openPost, openProfile }: { post: CommunityPost; timeAgo: (iso?: string | null) => string; openPost: (id: string) => void; openProfile: (handle: string) => void }) {
  const author = post.author
  const meta = author ? `@${author.handle}${author.city ? ` · ${author.city}` : ''} · ${timeAgo(post.publishedAt)}` : timeAgo(post.publishedAt)
  return (
    <button type="button" className="community-card" onClick={() => openPost(post.id)}>
      <AuthorLine author={author} meta={meta} onOpenProfile={openProfile} />
      <span className="community-card__body">{post.body}</span>
      {post.images.length > 0 && (
        <span className="community-card__images">
          {post.images.slice(0, 4).map((src) => (
            <img key={src} src={src} alt="" loading="lazy" />
          ))}
        </span>
      )}
      {post.topics.length > 0 && (
        <span className="community-card__tags">
          {post.topics.map((topic) => (
            <i key={topic} className="community-tag">{topic}</i>
          ))}
        </span>
      )}
      <span className="community-card__stats">
        <span><Heart size={14} /> {post.likeCount}</span>
        <span><MessageCircle size={14} /> {post.commentCount}</span>
      </span>
    </button>
  )
}

export function CommunityFeedScreen({ go, openPost, openProfile }: { go: (screen: RwaScreen) => void; openPost: (id: string) => void; openProfile: (handle: string) => void }) {
  const { t, locale } = useI18n()
  const shellCopy = rwaH5Copy[locale].shell
  const timeAgo = useTimeAgo()
  const [sort, setSort] = useState<'latest' | 'hot'>('latest')
  const [topic, setTopic] = useState<string | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [items, setItems] = useState<CommunityPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getCommunityTopics().then((response) => setTopics(response.items)).catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const page = await getCommunityFeed({ sort, topic: topic ?? undefined, limit: 20 })
      setItems(page.items)
      setNextCursor(page.nextCursor)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [sort, topic])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await getCommunityFeed({ sort, topic: topic ?? undefined, cursor: nextCursor, limit: 20 })
      setItems((previous) => [...previous, ...page.items])
      setNextCursor(page.nextCursor)
    } catch {
      // keep the current page; the user can retry
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section className="screen community-screen">
      <header className="topbar">
        <div className="topbar__inner">
          <AnimatedBrand compact homeMotion />
          <div className="topbar-actions">
            <LanguageMenu />
            <button className="profile-orb" type="button" aria-label={shellCopy.openProfile} onClick={() => go('profile')}>
              <Bot size={25} strokeWidth={1.45} />
            </button>
          </div>
        </div>
      </header>
      <header className="community-header">
        <h1>{t('community.title')}</h1>
        <small>{t('community.subtitle')}</small>
      </header>
      <div className="community-controls">
        <div className="community-sort" role="tablist">
          <button type="button" className={sort === 'latest' ? 'is-active' : ''} onClick={() => setSort('latest')}>{t('community.sortLatest')}</button>
          <button type="button" className={sort === 'hot' ? 'is-active' : ''} onClick={() => setSort('hot')}>{t('community.sortHot')}</button>
        </div>
        <button type="button" className={`community-chip ${topic === null ? 'is-active' : ''}`} onClick={() => setTopic(null)}>{t('common.viewAll')}</button>
        {topics.map((entry) => (
          <button key={entry.slug} type="button" className={`community-chip ${topic === entry.slug ? 'is-active' : ''}`} onClick={() => setTopic(entry.slug)}>
            {entry.title}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="community-list">
          <div className="community-skel" />
          <div className="community-skel" />
          <div className="community-skel" />
        </div>
      ) : failed ? (
        <div className="community-empty">
          <b>{t('community.emptyTitle')}</b>
          <button type="button" className="community-more" onClick={() => void load()}><RotateCw size={14} /> {t('common.refresh')}</button>
        </div>
      ) : items.length === 0 ? (
        <div className="community-empty">
          <b>{t('community.emptyTitle')}</b>
          <span>{t('community.emptyBody')}</span>
        </div>
      ) : (
        <div className="community-list">
          {items.map((post) => (
            <PostCard key={post.id} post={post} timeAgo={timeAgo} openPost={openPost} openProfile={openProfile} />
          ))}
          {nextCursor && (
            <button type="button" className="community-more" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? '…' : t('community.loadMore')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export function CommunityPostScreen({ postId, go, openProfile, isGuest = true }: { postId: string | null; go: (screen: RwaScreen) => void; openProfile: (handle: string) => void; isGuest?: boolean }) {
  const { t } = useI18n()
  const timeAgo = useTimeAgo()
  const [data, setData] = useState<CommunityPostResponse | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!postId) {
      setData(null)
      return
    }
    setFailed(false)
    try {
      setData(await getCommunityPost(postId))
    } catch {
      setFailed(true)
    }
  }, [postId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="screen community-post">
      <header className="community-detail-head">
        <button type="button" onClick={() => go('community')} aria-label={t('common.back')}><ArrowLeft size={19} /></button>
        <b>{t('community.title')}</b>
      </header>
      {!postId ? (
        <div className="community-empty">
          <b>{t('community.emptyTitle')}</b>
          <button type="button" className="community-more" onClick={() => go('community')}>{t('community.backToFeed')}</button>
        </div>
      ) : failed ? (
        <div className="community-empty">
          <b>{t('community.emptyTitle')}</b>
          <button type="button" className="community-more" onClick={() => void load()}><RotateCw size={14} /> {t('common.refresh')}</button>
        </div>
      ) : !data ? (
        <div className="community-list">
          <div className="community-skel" style={{ height: 170 }} />
          <div className="community-skel" style={{ height: 70 }} />
        </div>
      ) : (
        <>
          <article className="community-post-article">
            <AuthorLine
              author={data.post.author}
              meta={data.post.author ? `@${data.post.author.handle}${data.post.author.city ? ` · ${data.post.author.city}` : ''} · ${timeAgo(data.post.publishedAt)}` : timeAgo(data.post.publishedAt)}
              onOpenProfile={openProfile}
              size={44}
            />
            <div className="community-post__body">{data.post.body}</div>
            {data.post.images.length > 0 && (
              <div className="community-card__images">
                {data.post.images.slice(0, 4).map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" />
                ))}
              </div>
            )}
            {data.post.topics.length > 0 && (
              <div className="community-card__tags">
                {data.post.topics.map((topic) => (
                  <i key={topic} className="community-tag">{topic}</i>
                ))}
              </div>
            )}
            <div className="community-card__stats">
              <span><Heart size={14} /> {data.post.likeCount}</span>
              <span><MessageCircle size={14} /> {data.commentTotal}</span>
            </div>
          </article>
          {isGuest && (
            <div className="community-join">
              <b>{t('community.joinTitle')}</b>
              <small>{t('community.joinBody')}</small>
              <button type="button" onClick={() => go('login')}>{t('guest.signin')}</button>
            </div>
          )}
          <div className="community-section-title"><span>{t('community.comments')} · {data.commentTotal}</span></div>
          <div className="community-comments">
            {data.comments.map((comment) => (
              <div key={comment.id} className="community-comment">
                <Avatar author={comment.author} size={32} />
                <div className="community-comment__body">
                  <small>@{comment.author?.handle ?? '—'} · {timeAgo(comment.createdAt)}</small>
                  <span>{comment.body}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export function CommunityProfileScreen({ handle, go, openPost }: { handle: string | null; go: (screen: RwaScreen) => void; openPost: (id: string) => void }) {
  const { t } = useI18n()
  const timeAgo = useTimeAgo()
  const [data, setData] = useState<CommunityProfileResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!handle) return
    setFailed(false)
    getCommunityProfile(handle)
      .then(setData)
      .catch(() => setFailed(true))
  }, [handle])

  return (
    <section className="screen community-screen">
      <header className="community-detail-head">
        <button type="button" onClick={() => go('community')} aria-label={t('common.back')}><ArrowLeft size={19} /></button>
        <b>{t('community.viewProfile')}</b>
      </header>
      {!handle || failed ? (
        <div className="community-empty">
          <b>{t('community.emptyTitle')}</b>
          <button type="button" className="community-more" onClick={() => go('community')}>{t('community.backToFeed')}</button>
        </div>
      ) : !data ? (
        <div className="community-list">
          <div className="community-skel" style={{ height: 190 }} />
        </div>
      ) : (
        <>
          <div className="community-profile-head">
            <Avatar author={data.profile} size={72} />
            <h1>{data.profile.displayName}</h1>
            <small>@{data.profile.handle}{data.profile.city ? ` · ${data.profile.city}` : ''}</small>
            {data.profile.bio ? <p className="community-profile-bio">{data.profile.bio}</p> : null}
          </div>
          <div className="community-profile-stats">
            <div><b>{data.stats.postCount}</b><small>{t('community.statsPosts')}</small></div>
            <div><b>{data.stats.followerCount}</b><small>{t('community.statsFollowers')}</small></div>
            <div><b>{data.stats.followingCount}</b><small>{t('community.statsFollowing')}</small></div>
          </div>
          <div className="community-section-title"><span>{t('community.recentPosts')}</span></div>
          <div className="community-list">
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post} timeAgo={timeAgo} openPost={openPost} openProfile={() => undefined} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
