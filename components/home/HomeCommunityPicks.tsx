'use client'

/**
 * Community on the signed-in home (v5): three posts and a way in, so the page ends cleanly instead of scrolling
 * forever. Posts written in the reader's own script come first (Chinese for zh, Latin for the rest), then the most
 * liked. The full feed, with topics and translation, lives on the community page.
 */
import { ArrowRight, Heart, MessageCircle } from 'lucide-react'
import { getCommunityFeed, type CommunityPost } from '@/lib/api/community'
import { useQuery } from '@/lib/api/_query'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { CommunityAvatar } from '../community-avatar'
import styles from './HomeCommunityPicks.module.css'

const COPY: Partial<Record<AppLocale, { more: string; empty: string }>> & { en: { more: string; empty: string } } = {
  en: { more: 'Open the community', empty: 'No posts yet' },
  'zh-CN': { more: '进入社区', empty: '还没有帖子' },
}

const HAN = /[一-鿿]/
const KANA = /[぀-ヿ]/
const LATIN = /^[\s\p{Script=Latin}\p{N}\p{P}\p{S}]+$/u
// Chinese readers: Han characters and no kana (Japanese posts use kanji too).
const readable = (post: CommunityPost, locale: AppLocale) => locale === 'zh-CN' ? HAN.test(post.body) && !KANA.test(post.body) : LATIN.test(post.body.slice(0, 120))

export function HomeCommunityPicks({ onOpen, onAuthor, onMore }: { onOpen: (post: CommunityPost) => void; onAuthor: (post: CommunityPost) => void; onMore: () => void }) {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en
  const feed = useQuery('community:feed:home-picks', () => getCommunityFeed(20), { staleTime: 120_000 })
  const items = feed.data?.items ?? []
  const picks = [...items].sort((a, b) => Number(readable(b, locale)) - Number(readable(a, locale)) || b.likeCount - a.likeCount).slice(0, 3)
  const when = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  return <div className={styles.root}>
    {feed.loading && !feed.data ? <div className={styles.loading} aria-busy="true"><span /><span /><span /></div>
      : !picks.length ? <p className={styles.empty}>{c.empty}</p>
      : <ul className={styles.list}>{picks.map(post => <li key={post.id} className={styles.post}>
        <button type="button" className={styles.who} onClick={() => onAuthor(post)}>
          <CommunityAvatar avatarUrl={post.author?.avatarUrl} seed={post.author?.avatarSeed ?? post.author?.id} handle={post.author?.handle} size={28} />
          <b>{post.author?.displayName || '—'}</b>
          <time dateTime={post.publishedAt}>{Number.isNaN(Date.parse(post.publishedAt)) ? '' : when.format(new Date(post.publishedAt))}</time>
        </button>
        <button type="button" className={styles.body} onClick={() => onOpen(post)}>
          <span>{post.body}</span>
          <small><span><MessageCircle size={14} aria-hidden="true" />{post.commentCount}</span><span><Heart size={14} aria-hidden="true" />{post.likeCount}</span></small>
        </button>
      </li>)}</ul>}
    <button type="button" className={styles.more} onClick={onMore}>{c.more}<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></button>
  </div>
}
