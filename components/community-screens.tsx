'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { BarChart2, Feather, Flag, Heart, MessageCircle, PenLine, Share } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { communityTopicCopy } from '@/lib/route-copy'
import type { RwaScreen } from '@/lib/rwa-routes'
import RwaTopbar from './rwa-topbar'
import { CommunityToggle } from './community-actions'
import { CommunityAvatar, CommunityMark, mediaSrc } from './community-avatar'
import { CommunityCompose, CommunityProfileEditor, CommunityReplyBar, useCommunityMe, type ComposeTarget } from './community-compose'
import { communityComposeCopy } from '@/lib/maison-community-compose-copy'
import { PublicShareButton } from './public-sharing'
import { communityCopy } from '@/lib/maison-content-copy'
import { communityUiCopy } from '@/lib/maison-community-ui-copy'
import { useScrollChrome } from '@/hooks/useScrollChrome'
import { MaisonPage, Skeleton, StateBlock } from './maison/primitives'
import x from './maison/community.module.css'
import {
  getCommunityFeed,
  getCommunityPost,
  getCommunityProfile,
  getCommunityTopics,
  submitCommunityReport,
  type CommunityAuthor,
  type CommunityPost,
  type CommunityPostResponse,
  type CommunityProfileResponse,
  type CommunityTopic,
} from '@/lib/community-data'

// Seeded community posts from older API deployments stored topic ids while
// the public topics endpoint returned only slugs. Keep the mapping at the
// presentation boundary so neither form leaks an opaque UUID to a reader.
const COMMUNITY_TOPIC_ID_TO_SLUG: Record<string, string> = {
  'c0000000-0000-4000-8000-000000000001': 'ai-compute',
  'c0000000-0000-4000-8000-000000000002': 'rwa',
  'c0000000-0000-4000-8000-000000000003': 'market',
  'c0000000-0000-4000-8000-000000000004': 'newbie',
  'c0000000-0000-4000-8000-000000000005': 'security',
  'c0000000-0000-4000-8000-000000000006': 'community',
  'c0000000-0000-4000-8000-000000000007': 'lounge',
}

const COMMUNITY_TOPIC_FALLBACK_TITLES = communityTopicCopy

function communityTopicTitle(topic: string, topics: CommunityTopic[], locale: keyof typeof communityTopicCopy): string {
  const direct = topics.find((entry) => entry.id === topic || entry.slug === topic)
  const slug = COMMUNITY_TOPIC_ID_TO_SLUG[topic] ?? topic
  if (COMMUNITY_TOPIC_FALLBACK_TITLES[locale][slug]) return COMMUNITY_TOPIC_FALLBACK_TITLES[locale][slug]
  if (direct?.title) return direct.title
  const bySlug = topics.find((entry) => entry.slug === slug)
  return bySlug?.title ?? COMMUNITY_TOPIC_FALLBACK_TITLES.en[slug] ?? topic
}

function Avatar({ author, size = 40, className }: { author?: CommunityAuthor | null; size?: number; className?: string }) {
  return <CommunityAvatar avatarUrl={author?.avatarUrl} handle={author?.handle ?? 'anonymous'} size={size} className={className} />
}

function useTimeAgo() {
  const { locale } = useI18n()
  return (iso?: string | null) => {
    if (!iso) return ''
    const time = new Date(iso).getTime()
    if (Number.isNaN(time)) return ''
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
    const minutes = Math.floor((Date.now() - time) / 60_000)
    if (minutes < 1) return rtf.format(0, 'second')
    if (minutes < 60) return rtf.format(-minutes, 'minute')
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return rtf.format(-hours, 'hour')
    const days = Math.floor(hours / 24)
    if (days < 7) return rtf.format(-days, 'day')
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso))
  }
}

const compact = (locale: string, value: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)

function Images({ images }: { images: string[] }) {
  if (!images.length) return null
  const shown = images.slice(0, 4)
  return <div className={x.images} data-count={shown.length}>{shown.map((src) => <img key={src} src={mediaSrc(src) ?? undefined} alt="" loading="lazy" decoding="async" />)}</div>
}

function Tags({ list, topics, locale }: { list: string[]; topics: CommunityTopic[]; locale: keyof typeof communityTopicCopy }) {
  if (!list.length) return null
  return <p className={x.tags}>{list.map((topic) => <span key={topic}>#{communityTopicTitle(topic, topics, locale)}</span>)}</p>
}

/** One timeline row: avatar column, name · @handle · time, body, media, then a quiet count bar. */
function PostRow({ post, timeAgo, openPost, openProfile, topics = [], locale, index = 0 }: { post: CommunityPost; timeAgo: (iso?: string | null) => string; openPost: (id: string) => void; openProfile?: (handle: string) => void; topics?: CommunityTopic[]; locale: keyof typeof communityTopicCopy; index?: number }) {
  const author = post.author
  const ui = communityUiCopy[locale]
  const reduced = useReducedMotion()
  const toProfile = openProfile && author ? () => openProfile(author.handle) : undefined
  return (
    <motion.li className={x.post} onClick={() => openPost(post.id)}
      initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, ease: [.22, 1, .36, 1], delay: Math.min(index, 8) * .04 }}>
      {toProfile
        ? <button type="button" className={x.avatarBtn} aria-label={author?.displayName} onClick={(event) => { event.stopPropagation(); toProfile() }}><Avatar author={author} /></button>
        : <Avatar author={author} />}
      <div className={x.postMain}>
        <p className={x.byline}>
          {toProfile ? <button type="button" className={x.name} onClick={(event) => { event.stopPropagation(); toProfile() }}>{author?.displayName ?? '—'}</button> : <b className={x.name}>{author?.displayName ?? '—'}</b>}
          {author && <span className={x.handle} dir="ltr">@{author.handle}</span>}
          <span className={x.dot} aria-hidden="true">·</span>
          <time className={x.time} dateTime={post.publishedAt ?? undefined}>{timeAgo(post.publishedAt)}</time>
        </p>
        <button type="button" className={x.body} dir="auto" onClick={(event) => { event.stopPropagation(); openPost(post.id) }}>{post.body}</button>
        <Images images={post.images} />
        <Tags list={post.topics} topics={topics} locale={locale} />
        <div className={x.bar}>
          <span aria-label={`${ui.replies} ${post.commentCount}`}><MessageCircle size={17} strokeWidth={1.7} aria-hidden="true" />{post.commentCount > 0 && compact(locale, post.commentCount)}</span>
          <span aria-label={`${ui.likes} ${post.likeCount}`}><Heart size={17} strokeWidth={1.7} aria-hidden="true" />{post.likeCount > 0 && compact(locale, post.likeCount)}</span>
          <span aria-label={`${ui.views} ${post.viewCount}`}><BarChart2 size={17} strokeWidth={1.7} aria-hidden="true" />{post.viewCount > 0 && compact(locale, post.viewCount)}</span>
        </div>
      </div>
    </motion.li>
  )
}

export function CommunityFeedScreen({ go, openPost, openProfile, isGuest = true }: { go: (screen: RwaScreen) => void; openPost: (id: string) => void; openProfile: (handle: string) => void; isGuest?: boolean }) {
  const { t, locale } = useI18n()
  const timeAgo = useTimeAgo()
  // Match the home module's public feed so the community route does not
  // render an empty latest-only view while the hot feed already has content.
  const [sort, setSort] = useState<'latest' | 'hot'>('hot')
  const [topic, setTopic] = useState<string | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [items, setItems] = useState<CommunityPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const requestVersion = useRef(0)
  const pageSort = useRef<'latest' | 'hot'>(sort)
  const [composing, setComposing] = useState(false)
  const me = useCommunityMe(isGuest)
  const chromeHidden = useScrollChrome()
  const ui = communityUiCopy[locale]
  const tabs = [{ key: 'hot' as const, label: t('community.sortHot') }, { key: 'latest' as const, label: t('community.sortLatest') }]

  useEffect(() => {
    getCommunityTopics().then((response) => setTopics(response.items)).catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setFailed(false)
    setMoreFailed(false)
    try {
      // The production hot ranking endpoint has historically been unavailable
      // during an index refresh. Keep the public feed useful by falling back
      // to the same data source ordered by publication time; never invent rows.
      let page
      let effectiveSort = sort
      try {
        page = await getCommunityFeed({ sort, topic: topic ?? undefined, limit: 20 })
        if (sort === 'hot' && page.items.length === 0) {
          const latest = await getCommunityFeed({ sort: 'latest', topic: topic ?? undefined, limit: 20 })
          if (latest.items.length > 0) { page = latest; effectiveSort = 'latest' }
        }
      } catch (error) {
        if (sort !== 'hot') throw error
        page = await getCommunityFeed({ sort: 'latest', topic: topic ?? undefined, limit: 20 })
        effectiveSort = 'latest'
      }
      if (version !== requestVersion.current) return
      pageSort.current = effectiveSort
      setItems(page.items)
      setNextCursor(page.nextCursor)
    } catch {
      if (version === requestVersion.current) setFailed(true)
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [sort, topic])

  useEffect(() => {
    void load()
    return () => { requestVersion.current += 1 }
  }, [load])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setMoreFailed(false)
    const version = requestVersion.current
    try {
      const page = await getCommunityFeed({ sort: pageSort.current, topic: topic ?? undefined, cursor: nextCursor, limit: 20 })
      if (version !== requestVersion.current) return
      setItems((previous) => [...previous, ...page.items.filter(item => !previous.some(row => row.id === item.id))])
      setNextCursor(page.nextCursor)
    } catch {
      if (version === requestVersion.current) setMoreFailed(true)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <MaisonPage page="community" topbar={<RwaTopbar screen="community" title={t('community.title')} onBack={() => go('home')} />}>
      <div className={x.root}>
        <div className={x.dock}>
          <TimelineTabs label={ui.feed} value={sort} onChange={setSort} options={tabs} />
          <div className={x.topics} role="group" aria-label={ui.topics}>
            <button type="button" aria-pressed={topic === null} onClick={() => setTopic(null)}>{t('common.viewAll')}</button>
            {topics.map((entry) => <button key={entry.slug} type="button" aria-pressed={topic === entry.slug} onClick={() => setTopic(entry.slug)}>{entry.title}</button>)}
          </div>
        </div>
        {loading ? <div className={x.pad}><Skeleton rows={4} /></div>
          : failed ? <div className={x.pad}><StateBlock tone="error" title={communityCopy[locale].feedFailed} retry={() => void load()} retryLabel={t('common.refresh')} /></div>
          : items.length === 0 ? <div className={x.pad}><StateBlock title={t('community.emptyTitle')} body={t('community.emptyBody')} /></div>
          : <>
            <ul className={x.feed} aria-label={ui.feed}>
              {items.map((post, index) => <PostRow key={post.id} index={index} post={post} timeAgo={timeAgo} openPost={openPost} openProfile={openProfile} topics={topics} locale={locale} />)}
            </ul>
            {nextCursor && <button type="button" className={x.more} onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? '…' : t('community.loadMore')}</button>}
            {moreFailed && <p className={x.error} role="alert">{communityCopy[locale].moreFailed}</p>}
          </>}
        <button type="button" className={x.fab} data-compact={chromeHidden} aria-label={isGuest ? communityCopy[locale].login : ui.compose} onClick={() => isGuest ? go('login') : setComposing(true)}>
          <Feather size={22} strokeWidth={1.9} aria-hidden="true" /><span>{ui.compose}</span>
        </button>
        {!isGuest && <CommunityCompose open={composing} onClose={() => setComposing(false)} target={{ kind: 'post', topic }} me={me} topics={topics} onPublished={openPost} />}
      </div>
    </MaisonPage>
  )
}

/** Timeline tabs: equal-width labels with an accent underline that glides to the chosen one. */
function TimelineTabs<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: { key: T; label: string }[] }) {
  const reduced = useReducedMotion()
  return <LayoutGroup id={`tabs-${label}`}>
    <div className={x.tabs} role="tablist" aria-label={label} style={{ '--n': options.length } as CSSProperties}>
      {options.map((option) => <button key={option.key} type="button" role="tab" aria-selected={option.key === value} onClick={() => onChange(option.key)}>
        <span>{option.label}{option.key === value && <motion.i className={x.tabLine} layoutId="line" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }} />}</span>
      </button>)}
    </div>
  </LayoutGroup>
}

export function CommunityPostScreen({ postId, go, openProfile, isGuest = true }: { postId: string | null; go: (screen: RwaScreen) => void; openProfile: (handle: string) => void; isGuest?: boolean }) {
  const { t, locale } = useI18n()
  const timeAgo = useTimeAgo()
  const [data, setData] = useState<CommunityPostResponse | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [failed, setFailed] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<string | null>(null)
  const [reportDetails, setReportDetails] = useState('')
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [sharing, setSharing] = useState(false)
  const [replying, setReplying] = useState<{ files: File[] | null } | null>(null)
  const me = useCommunityMe(isGuest)
  const ui = communityUiCopy[locale]

  // `silent` keeps the current post on screen while counts refresh after a like or reply.
  const load = useCallback(async (silent = false) => {
    if (!postId) {
      setData(null)
      return
    }
    if (!silent) { setFailed(false); setData(null) }
    try {
      setData(await getCommunityPost(postId))
      setFailed(false)
    } catch {
      if (!silent) setFailed(true)
    }
  }, [postId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    getCommunityTopics().then((response) => setTopics(response.items)).catch(() => undefined)
  }, [])

  const sheetRef = useRef<HTMLDivElement>(null)
  const reportOpener = useRef<HTMLElement | null>(null)
  const closeReport = useCallback(() => {
    setReportOpen(false)
    setReportState('idle')
    setReportReason(null)
    setReportDetails('')
    reportOpener.current?.focus()
  }, [])
  const openReport = () => {
    reportOpener.current = document.activeElement as HTMLElement | null
    setReportOpen(true)
  }

  const reportDone = reportState === 'done'
  // Dialog basics: focus moves into the sheet, Escape closes, Tab stays inside.
  useEffect(() => {
    if (!reportOpen) return
    const sheet = sheetRef.current
    sheet?.querySelector<HTMLElement>('button, textarea')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeReport(); return }
      if (event.key !== 'Tab' || !sheet) return
      const nodes = [...sheet.querySelectorAll<HTMLElement>('button:not([disabled]), textarea')]
      if (!nodes.length) return
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [reportOpen, reportDone, closeReport])

  const sendReport = async () => {
    if (!postId || !reportReason || reportState === 'sending') return
    setReportState('sending')
    try {
      // Send the stable reason key, not the localized label, so moderators see one vocabulary.
      const reason = reportDetails.trim() ? `${reportReason}: ${reportDetails.trim()}`.slice(0, 280) : reportReason
      await submitCommunityReport({ targetType: 'post', targetId: postId, reason })
      setReportState('done')
    } catch {
      setReportState('failed')
    }
  }

  const reportReasons = [
    { key: 'spam', label: t('community.reportSpam') },
    { key: 'scam', label: t('community.reportScam') },
    { key: 'harass', label: t('community.reportHarass') },
    { key: 'other', label: t('community.reportOther') },
  ]

  const author = data?.post.author ?? null
  const fullTime = data?.post.publishedAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.post.publishedAt)) : ''
  return (
    <MaisonPage page="community-post" topbar={<RwaTopbar screen="community-post" title={t('community.title')} onBack={() => go('community')} action={postId ? { label: t('community.report'), onClick: openReport, Icon: Flag } : undefined} />}>
    <div className={x.root}>
      {!postId ? (
        <div className={x.pad}><StateBlock title={t('community.emptyTitle')} action={<button type="button" className={x.more} onClick={() => go('community')}>{t('community.backToFeed')}</button>} /></div>
      ) : failed ? (
        <div className={x.pad}><StateBlock tone="error" title={communityCopy[locale].postFailed} retry={() => void load()} retryLabel={t('common.refresh')} /></div>
      ) : !data ? (
        <div className={x.pad}><Skeleton rows={4} /></div>
      ) : (
        <>
          <article className={x.focus}>
            <header className={x.focusHead}>
              {author ? <button type="button" className={x.avatarBtn} aria-label={author.displayName} onClick={() => openProfile(author.handle)}><Avatar author={author} size={46} /></button> : <Avatar author={author} size={46} />}
              <div className={x.focusWho}>
                {author ? <button type="button" className={x.name} onClick={() => openProfile(author.handle)}>{author.displayName}</button> : <b className={x.name}>—</b>}
                {author && <span className={x.handle} dir="ltr">@{author.handle}{author.city ? ` · ${author.city}` : ''}</span>}
              </div>
            </header>
            <p className={x.focusBody} dir="auto">{data.post.body}</p>
            <Images images={data.post.images} />
            <Tags list={data.post.topics} topics={topics} locale={locale} />
            <p className={x.stamp}><time dateTime={data.post.publishedAt ?? undefined}>{fullTime}</time>{data.post.viewCount > 0 && <> · <b>{compact(locale, data.post.viewCount)}</b> {ui.views}</>}</p>
            <p className={x.tally}><span><b>{compact(locale, data.commentTotal)}</b> {ui.replies}</span><span><b>{compact(locale, data.post.likeCount)}</b> {ui.likes}</span></p>
            <div className={x.actions}>
              <button type="button" className={x.iconBtn} aria-label={ui.reply} onClick={() => { if (isGuest) { go('login'); return } setReplying({ files: null }) }}><MessageCircle size={21} strokeWidth={1.7} /></button>
              <div className={x.like}><CommunityToggle guest={isGuest} postId={postId} onChanged={() => void load(true)} /></div>
              <button type="button" className={x.iconBtn} aria-label={ui.share} aria-expanded={sharing} onClick={() => setSharing((open) => !open)}><Share size={20} strokeWidth={1.7} /></button>
            </div>
            {sharing && <div className={x.share}><PublicShareButton kind="community_post" resourceId={postId} /></div>}
          </article>
          {isGuest && (
            <div className="community-join">
              <b>{t('community.joinTitle')}</b>
              <small>{t('community.joinBody')}</small>
              <button type="button" onClick={() => go('login')}>{t('guest.signin')}</button>
            </div>
          )}
          <h2 className={x.threadHead}>{t('community.comments')} <span>{compact(locale, data.commentTotal)}</span></h2>
          <ol className={x.thread}>
            {data.comments.map((comment, index) => (
              <li key={comment.id} className={x.reply} style={{ '--i': Math.min(index, 8) } as CSSProperties}>
                <span className={x.replyRail}><Avatar author={comment.author} size={34} /></span>
                <div className={x.postMain}>
                  <p className={x.byline}>
                    <b className={x.name}>{comment.author?.displayName ?? '—'}</b>
                    {comment.author && <span className={x.handle} dir="ltr">@{comment.author.handle}</span>}
                    <span className={x.dot} aria-hidden="true">·</span>
                    <time className={x.time} dateTime={comment.createdAt ?? undefined}>{timeAgo(comment.createdAt)}</time>
                  </p>
                  {comment.body && <p className={x.replyBody} dir="auto">{comment.body}</p>}
                  <Images images={comment.images ?? []} />
                </div>
              </li>
            ))}
          </ol>
          <CommunityReplyBar me={me} guest={isGuest} onLogin={() => go('login')} onOpen={(files) => setReplying({ files: files ?? null })} />
          {!isGuest && <CommunityCompose open={replying !== null} onClose={() => setReplying(null)} target={{ kind: 'reply', postId, handle: author?.handle } satisfies ComposeTarget} me={me} initialFiles={replying?.files} onPublished={() => void load(true)} />}
        </>
      )}
      {reportOpen && (
        <div className="community-report-overlay" onClick={closeReport}>
          <div ref={sheetRef} className="community-report-sheet" role="dialog" aria-modal="true" aria-labelledby="community-report-title" onClick={(event) => event.stopPropagation()}>
            {reportState === 'done' ? (
              <>
                <b id="community-report-title" className="community-report-title" role="status">{t('community.reportThanks')}</b>
                <button type="button" className="community-report-submit" onClick={closeReport}>{t('common.back')}</button>
              </>
            ) : (
              <>
                <b id="community-report-title" className="community-report-title">{t('community.reportTitle')}</b>
                <div className="community-report-options">
                  {reportReasons.map((option) => (
                    <button key={option.key} type="button" aria-pressed={reportReason === option.key} className={reportReason === option.key ? 'is-active' : ''} onClick={() => setReportReason(option.key)}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <textarea className="community-report-details" rows={2} maxLength={200} placeholder={t('community.reportDetails')} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} />
                {reportState === 'failed' ? <small className="community-report-error">{t('community.reportFailed')}</small> : null}
                <button type="button" className="community-report-submit" disabled={!reportReason || reportState === 'sending'} onClick={() => void sendReport()}>
                  {reportState === 'sending' ? communityCopy[locale].sending : t('community.reportSubmit')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </MaisonPage>
  )
}

export function CommunityProfileScreen({ handle, go, openPost, isGuest = true }: { handle: string | null; go: (screen: RwaScreen) => void; openPost: (id: string) => void; isGuest?: boolean }) {
  const { t, locale } = useI18n()
  const timeAgo = useTimeAgo()
  const [data, setData] = useState<CommunityProfileResponse | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getCommunityTopics().then((response) => setTopics(response.items)).catch(() => undefined)
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setData(null)
    if (!handle) return
    if (!silent) setFailed(false)
    try { setData(await getCommunityProfile(handle)); setFailed(false) } catch { if (!silent) setFailed(true) }
  }, [handle])

  useEffect(() => { void load() }, [load])

  const ui = communityUiCopy[locale]
  const me = useCommunityMe(isGuest)
  const [editing, setEditing] = useState(false)
  const own = Boolean(me && handle && me.handle.toLowerCase() === handle.toLowerCase())
  return (
    <MaisonPage page="community-profile" topbar={<RwaTopbar screen="community-profile" title={data?.profile.displayName ?? t('community.viewProfile')} onBack={() => go('community')} />}>
    <div className={x.root}>
      {!handle || failed ? (
        <div className={x.pad}>
          <StateBlock tone={failed ? 'error' : 'empty'} title={failed ? communityCopy[locale].profileFailed : t('community.emptyTitle')} retry={failed ? () => void load() : undefined} retryLabel={t('common.refresh')}
            action={<button type="button" className={x.more} onClick={() => go('community')}>{t('community.backToFeed')}</button>} />
        </div>
      ) : !data ? (
        <div className={x.pad}><Skeleton rows={4} /></div>
      ) : (
        <>
          <header className={x.profile}>
            <div className={x.banner} aria-hidden="true"><CommunityMark seed={handle} size={220} className={x.bannerMark} /></div>
            <div className={x.profileRow}>
              {own && me ? <CommunityAvatar avatarUrl={me.avatarUrl} handle={me.handle} size={76} className={x.profileAvatar} /> : <Avatar author={data.profile} size={76} className={x.profileAvatar} />}
              {own
                ? <button type="button" className={x.editBtn} onClick={() => setEditing(true)}><PenLine size={15} strokeWidth={2} aria-hidden="true" />{communityComposeCopy[locale].editProfile}</button>
                : <div className={x.follow}><CommunityToggle guest={isGuest} handle={handle} onChanged={() => void load(true)} /></div>}
            </div>
            <h1 className={x.profileName}>{data.profile.displayName}</h1>
            <p className={x.handle} dir="ltr">@{data.profile.handle}{data.profile.city ? ` · ${data.profile.city}` : ''}</p>
            {data.profile.bio ? <p className={x.bio} dir="auto">{data.profile.bio}</p> : null}
            <p className={x.tally}>
              <span><b>{compact(locale, data.stats.followingCount)}</b> {ui.following}</span>
              <span><b>{compact(locale, data.stats.followerCount)}</b> {ui.followers}</span>
            </p>
          </header>
          <div className={x.dock}>
            <TimelineTabs label={ui.posts} value="posts" onChange={() => undefined} options={[{ key: 'posts', label: `${ui.posts} · ${compact(locale, data.stats.postCount)}` }]} />
          </div>
          {data.posts.length === 0
            ? <div className={x.pad}><StateBlock title={t('community.emptyTitle')} /></div>
            : <ul className={x.feed} aria-label={ui.posts}>
              {data.posts.map((post, index) => (
                <PostRow key={post.id} post={post} timeAgo={timeAgo} openPost={openPost} topics={topics} locale={locale} index={index} />
              ))}
            </ul>}
          {own && me && <CommunityProfileEditor open={editing} onOpenChange={setEditing} me={me} onSaved={() => void load(true)} />}
        </>
      )}
    </div>
    </MaisonPage>
  )
}
