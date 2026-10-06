'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { BadgeCheck, BarChart2, CalendarDays, Feather, Flag, MapPin, MessageCircle, MoreHorizontal, PenLine, Share } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { communityTopicCopy } from '@/lib/route-copy'
import type { RwaScreen } from '@/lib/rwa-routes'
import { sharePage } from '@/lib/share-page'
import RwaTopbar from './rwa-topbar'
import { CommunityFollowButton, CommunityLike } from './community-actions'
import { CommunityText } from './community-text'
import { CommunityAvatar, CommunityMark, mediaSrc } from './community-avatar'
import { CommunityCompose, CommunityProfileEditor, CommunityReplyBar, useCommunityMe, type ComposeTarget } from './community-compose'
import { communityComposeCopy } from '@/lib/maison-community-compose-copy'
import { PublicShareButton } from './public-sharing'
import { communityCopy } from '@/lib/maison-content-copy'
import { communityUiCopy } from '@/lib/maison-community-ui-copy'
import { communityExperienceCopy } from '@/lib/community-experience-copy'
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
  return <CommunityAvatar avatarUrl={author?.avatarUrl} seed={author?.avatarSeed ?? author?.id} handle={author?.handle ?? 'anonymous'} size={size} className={className} />
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

type ProfileCopy = { dm: string; dmSoon: string; media: string; noMedia: string; joined: string; more: string; shareProfile: string; reportProfile: string; copied: string; shareFailed: string; verified: string }
const profileCopy: Record<AppLocale, ProfileCopy> = {
  'zh-CN': { dm: '私信', dmSoon: '私信即将开放，先关注 TA 吧', media: '媒体', noMedia: '还没有带图的帖子', joined: '{date} 加入', more: '更多', shareProfile: '分享主页', reportProfile: '举报此用户', copied: '链接已复制', shareFailed: '分享失败，请稍后再试', verified: '官方认证' },
  en: { dm: 'Message', dmSoon: 'Direct messages are coming soon. Follow them for now.', media: 'Media', noMedia: 'No posts with media yet', joined: 'Joined {date}', more: 'More', shareProfile: 'Share profile', reportProfile: 'Report this account', copied: 'Link copied', shareFailed: 'Could not share. Try again.', verified: 'Official' },
  es: { dm: 'Mensaje', dmSoon: 'Los mensajes directos llegarán pronto. De momento, síguele.', media: 'Multimedia', noMedia: 'Aún no hay publicaciones con imágenes', joined: 'Se unió en {date}', more: 'Más', shareProfile: 'Compartir perfil', reportProfile: 'Denunciar esta cuenta', copied: 'Enlace copiado', shareFailed: 'No se pudo compartir. Inténtalo de nuevo.', verified: 'Oficial' },
  fr: { dm: 'Message', dmSoon: 'Les messages privés arrivent bientôt. Abonnez-vous en attendant.', media: 'Médias', noMedia: 'Aucune publication avec média', joined: 'A rejoint en {date}', more: 'Plus', shareProfile: 'Partager le profil', reportProfile: 'Signaler ce compte', copied: 'Lien copié', shareFailed: 'Partage impossible. Réessayez.', verified: 'Officiel' },
  pt: { dm: 'Mensagem', dmSoon: 'Mensagens diretas em breve. Siga por enquanto.', media: 'Mídia', noMedia: 'Ainda sem publicações com mídia', joined: 'Entrou em {date}', more: 'Mais', shareProfile: 'Compartilhar perfil', reportProfile: 'Denunciar esta conta', copied: 'Link copiado', shareFailed: 'Não foi possível compartilhar. Tente de novo.', verified: 'Oficial' },
  ar: { dm: 'رسالة', dmSoon: 'الرسائل الخاصة قريبًا. تابِعه الآن.', media: 'الوسائط', noMedia: 'لا توجد منشورات بوسائط بعد', joined: 'انضم في {date}', more: 'المزيد', shareProfile: 'مشاركة الملف الشخصي', reportProfile: 'الإبلاغ عن هذا الحساب', copied: 'تم نسخ الرابط', shareFailed: 'تعذّرت المشاركة. حاول مجددًا.', verified: 'رسمي' },
  hi: { dm: 'संदेश', dmSoon: 'डायरेक्ट मैसेज जल्द आ रहे हैं। अभी फ़ॉलो करें।', media: 'मीडिया', noMedia: 'अभी मीडिया वाली कोई पोस्ट नहीं', joined: '{date} में जुड़े', more: 'और', shareProfile: 'प्रोफ़ाइल शेयर करें', reportProfile: 'इस खाते की रिपोर्ट करें', copied: 'लिंक कॉपी हुआ', shareFailed: 'शेयर नहीं हो सका। फिर कोशिश करें।', verified: 'आधिकारिक' },
}

type Notice = { text: string; error?: boolean }
/**
 * Row actions shared by the feed and the profile: reply opens the composer in place (guests go to sign-in),
 * share uses the system sheet or the clipboard, and both report through one transient notice.
 */
function usePostActions(isGuest: boolean, go: (screen: RwaScreen) => void, locale: AppLocale, onReplied?: (postId: string) => void) {
  const p = profileCopy[locale]
  const [reply, setReply] = useState<{ post: CommunityPost; open: boolean } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 2800); return () => clearTimeout(timer) }, [notice])
  const login = () => go('login')
  const onReply = (post: CommunityPost) => { if (isGuest) { go('login'); return } setReply({ post, open: true }) }
  const share = (path: string) => void sharePage(location.origin + path, navigator).then(result => {
    if (result === 'copied') setNotice({ text: p.copied })
    else if (result === 'failed') setNotice({ text: p.shareFailed, error: true })
  })
  const onShare = (post: CommunityPost) => share('/community/post/' + encodeURIComponent(post.id))
  const overlays = (me: ReturnType<typeof useCommunityMe>) => <>
    {!isGuest && reply && <CommunityCompose open={reply.open} onClose={() => setReply(current => current && { ...current, open: false })} target={{ kind: 'reply', postId: reply.post.id, handle: reply.post.author?.handle } satisfies ComposeTarget} me={me} onPublished={() => { onReplied?.(reply.post.id); setReply(current => current && { ...current, open: false }); setNotice({ text: communityCopy[locale].replied }) }} />}
    {notice && <p className={x.toast} data-error={notice.error || undefined} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
  </>
  return { login, onReply, onShare, share, notify: setNotice, overlays }
}

function ActionCount({ value, label, locale }: { value: number; label: string; locale: string }) {
  if (value <= 0) return null
  return <span className={x.count}><span aria-hidden="true">{compact(locale, value)}</span><span className={x.srOnly}>{label} {value}</span></span>
}

function Images({ images }: { images: string[] }) {
  if (!images.length) return null
  const shown = images.slice(0, 4)
  return <div className={x.images} data-count={shown.length}>{shown.map((src) => <img key={src} src={mediaSrc(src) ?? undefined} alt="" loading="lazy" decoding="async" />)}</div>
}

function Tags({ list, topics, locale }: { list: string[]; topics: CommunityTopic[]; locale: keyof typeof communityTopicCopy }) {
  if (!list.length) return null
  return <p className={x.tags}>{list.map((topic) => <span key={topic}>#{communityTopicTitle(topic, topics, locale)}</span>)}</p>
}

type RowActions = { guest: boolean; onLogin: () => void; onReply: (post: CommunityPost) => void; onShare: (post: CommunityPost) => void }

/**
 * One timeline row: avatar column, name · @handle · time, body, media, then the action bar.
 * The whole row opens the post (stretched link on the time); text, author and every bar button sit above it.
 * Before this, the body's positioned layers covered the stretched link and the bar was plain spans, so a
 * community-feed row could neither open nor be liked or replied to — only Home, which passes onOpen, worked.
 */
function PostRow({ post, timeAgo, openPost, openProfile, topics = [], locale, index = 0, actions }: { post: CommunityPost; timeAgo: (iso?: string | null) => string; openPost: (id: string) => void; openProfile?: (handle: string) => void; topics?: CommunityTopic[]; locale: keyof typeof communityTopicCopy; index?: number; actions: RowActions }) {
  const author = post.author
  const ui = communityUiCopy[locale]
  const reduced = useReducedMotion()
  const toProfile = openProfile && author ? () => openProfile(author.handle || author.id) : undefined
  const city = post.location?.city || author?.city
  const when = timeAgo(post.publishedAt)
  const openLabel = communityExperienceCopy[locale].open
  return (
    <motion.li className={x.post}
      initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, ease: [.22, 1, .36, 1], delay: Math.min(index, 8) * .04 }}>
      {toProfile
        ? <button type="button" className={x.avatarBtn} aria-label={author?.displayName} onClick={toProfile}><Avatar author={author} /></button>
        : <Avatar author={author} />}
      <div className={x.postMain}>
        <p className={x.byline}>
          {toProfile ? <button type="button" className={x.name} dir="auto" onClick={toProfile}>{author?.displayName ?? '—'}</button> : <b className={x.name} dir="auto">{author?.displayName ?? '—'}</b>}
          {author?.handle && <span className={x.handle} dir="ltr">@{author.handle}</span>}
          {city && <span className={x.city} dir="auto">{city}</span>}
          <span className={x.dot} aria-hidden="true">·</span>
          <button type="button" className={x.openPost} aria-label={when ? `${openLabel}, ${when}` : openLabel} onClick={() => openPost(post.id)}>
            <time className={x.time} dateTime={post.publishedAt ?? undefined}>{when}</time>
          </button>
        </p>
        <CommunityText body={post.body} targetId={post.id} className={x.body} compact onOpen={() => openPost(post.id)} />
        <Images images={post.images} />
        <Tags list={post.topics} topics={topics} locale={locale} />
        <div className={x.bar}>
          <button type="button" className={x.barBtn} data-tone="reply" onClick={() => actions.onReply(post)}>
            <MessageCircle size={17} strokeWidth={1.7} aria-hidden="true" />
            {post.commentCount > 0 && <span aria-hidden="true">{compact(locale, post.commentCount)}</span>}
            <span className={x.srOnly}>{ui.reply} · {ui.replies} {post.commentCount}</span>
          </button>
          <CommunityLike className={x.barBtn} postId={post.id} count={post.likeCount} guest={actions.guest} onLogin={actions.onLogin} size={17} format={(value) => compact(locale, value)} />
          <span className={x.barStat}>
            <BarChart2 size={17} strokeWidth={1.7} aria-hidden="true" />
            {post.viewCount > 0 && <span aria-hidden="true">{compact(locale, post.viewCount)}</span>}
            <span className={x.srOnly}>{ui.views} {post.viewCount}</span>
          </span>
          <button type="button" className={x.barBtn} aria-label={ui.share} onClick={() => actions.onShare(post)}><Share size={16} strokeWidth={1.7} aria-hidden="true" /></button>
        </div>
      </div>
    </motion.li>
  )
}

/** `embedded` renders the bare feed for a host that owns the page and bar (the AI screen's 社区 tab). */
export function CommunityFeedScreen({ go, openPost, openProfile, isGuest = true, embedded = false }: { go: (screen: RwaScreen) => void; openPost: (id: string) => void; openProfile: (handle: string) => void; isGuest?: boolean; embedded?: boolean }) {
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
  const actions = usePostActions(isGuest, go, locale, (postId) => setItems((previous) => previous.map((item) => item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item)))
  const rowActions: RowActions = { guest: isGuest, onLogin: actions.login, onReply: actions.onReply, onShare: actions.onShare }

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

  const feed = (
      <div className={x.root} data-embedded={embedded || undefined}>
        {/* Reading down tucks the dock away together with the bar; a small upward scroll brings both back. */}
        <div className={x.dock} data-hidden={chromeHidden}>
          <TimelineTabs label={ui.feed} value={sort} onChange={setSort} options={tabs} />
          <div className={x.topics} role="group" aria-label={ui.topics}>
            <button type="button" aria-pressed={topic === null} onClick={() => setTopic(null)}>{t('common.viewAll')}</button>
            {topics.map((entry) => <button key={entry.slug} type="button" aria-pressed={topic === entry.slug} onClick={() => setTopic(entry.slug)}>{communityTopicTitle(entry.slug, topics, locale)}</button>)}
          </div>
        </div>
        {loading ? <div className={x.pad}><Skeleton rows={4} /></div>
          : failed ? <div className={x.pad}><StateBlock tone="error" title={communityCopy[locale].feedFailed} retry={() => void load()} retryLabel={t('common.refresh')} /></div>
          : items.length === 0 ? <div className={x.pad}><StateBlock title={t('community.emptyTitle')} body={t('community.emptyBody')} /></div>
          : <>
            <ul className={x.feed} aria-label={ui.feed}>
              {items.map((post, index) => <PostRow key={post.id} index={index} post={post} timeAgo={timeAgo} openPost={openPost} openProfile={openProfile} topics={topics} locale={locale} actions={rowActions} />)}
            </ul>
            {nextCursor && <button type="button" className={x.more} onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? '…' : t('community.loadMore')}</button>}
            {moreFailed && <p className={x.error} role="alert">{communityCopy[locale].moreFailed}</p>}
          </>}
        <button type="button" className={x.fab} data-compact={chromeHidden} aria-label={ui.compose} onClick={() => isGuest ? go('login') : setComposing(true)}>
          <Feather size={22} strokeWidth={1.9} aria-hidden="true" /><span>{ui.compose}</span>
        </button>
        {!isGuest && <CommunityCompose open={composing} onClose={() => setComposing(false)} target={{ kind: 'post', topic }} me={me} topics={topics} onPublished={openPost} />}
        {actions.overlays(me)}
      </div>
  )
  if (embedded) return feed
  // The avatar is the single entry to one's own profile and its edit sheet; guests see the sign-in pill instead.
  return (
    <MaisonPage page="community" topbar={<RwaTopbar screen="community" title={t('community.title')} onBack={() => go('home')} account onProfile={() => me ? openProfile(me.handle || me.id) : go('login')} />}>
      {feed}
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
  const postCity = data ? data.post.location?.city || author?.city : undefined
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
              {author ? <button type="button" className={x.avatarBtn} aria-label={author.displayName} onClick={() => openProfile(author.handle || author.id)}><Avatar author={author} size={46} /></button> : <Avatar author={author} size={46} />}
              <div className={x.focusWho}>
                {author ? <button type="button" className={x.name} onClick={() => openProfile(author.handle || author.id)}>{author.displayName}</button> : <b className={x.name}>—</b>}
                {(author?.handle || postCity) && <div className={x.whoMeta}>
                  {author?.handle && <span className={x.handle} dir="ltr">@{author.handle}</span>}
                  {postCity && <span className={x.city} dir="auto">{postCity}</span>}
                </div>}
              </div>
            </header>
            <CommunityText body={data.post.body} targetId={data.post.id} className={x.focusBody} />
            <Images images={data.post.images} />
            <Tags list={data.post.topics} topics={topics} locale={locale} />
            <p className={x.stamp}><time dateTime={data.post.publishedAt ?? undefined}>{fullTime}</time>{data.post.viewCount > 0 && <> · <b>{compact(locale, data.post.viewCount)}</b> {ui.views}</>}</p>
            <div className={x.actions}>
              <div className={x.act}>
                <button type="button" className={x.iconBtn} aria-label={ui.reply} onClick={() => { if (isGuest) { go('login'); return } setReplying({ files: null }) }}><MessageCircle size={21} strokeWidth={1.7} aria-hidden="true" /></button>
                <ActionCount value={data.commentTotal} label={ui.replies} locale={locale} />
              </div>
              <div className={x.act}>
                {/* Optimistic heart with a state probe; the old toggle stayed disabled whenever /me/state failed. */}
                <CommunityLike className={x.likeBtn} postId={postId} count={data.post.likeCount} guest={isGuest} onLogin={() => go('login')} onChanged={() => void load(true)} probe size={21} format={(value) => compact(locale, value)} />
              </div>
              <div className={x.act}>
                <button type="button" className={x.iconBtn} aria-label={ui.share} aria-expanded={sharing} onClick={() => setSharing((open) => !open)}><Share size={20} strokeWidth={1.7} aria-hidden="true" /></button>
              </div>
            </div>
            {sharing && <div className={x.share}><PublicShareButton kind="community_post" resourceId={postId} /></div>}
          </article>
          <h2 className={x.threadHead}>{t('community.comments')} <span>{compact(locale, data.commentTotal)}</span></h2>
          {data.commentTotal === 0 && data.comments.length === 0 &&<p className={x.threadEmpty}>{ui.noReplies}</p>}
          <ol className={x.thread}>
            {data.comments.map((comment, index) => (
              <li key={comment.id} className={x.reply} style={{ '--i': Math.min(index, 8) } as CSSProperties}>
                <span className={x.replyRail}><Avatar author={comment.author} size={34} /></span>
                <div className={x.postMain}>
                  <p className={x.byline}>
                    <b className={x.name}>{comment.author?.displayName ?? '—'}</b>
                    {comment.author?.handle && <span className={x.handle} dir="ltr">@{comment.author.handle}</span>}
                    <span className={x.dot} aria-hidden="true">·</span>
                    <time className={x.time} dateTime={comment.createdAt ?? undefined}>{timeAgo(comment.createdAt)}</time>
                  </p>
                  {comment.body && <CommunityText body={comment.body} targetId={comment.id} targetType="comment" className={x.replyBody} />}
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

  const ui = communityUiCopy[locale], p = profileCopy[locale]
  const me = useCommunityMe(isGuest)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'posts' | 'media'>('posts')
  const [menu, setMenu] = useState<null | 'more' | 'report' | 'sending' | 'sent' | 'failed'>(null)
  const actions = usePostActions(isGuest, go, locale, () => void load(true))
  const rowActions: RowActions = { guest: isGuest, onLogin: actions.login, onReply: actions.onReply, onShare: actions.onShare }
  const own = Boolean(me && data && me.id === data.profile.id)
  const profile = data?.profile
  const joined = profile?.joinedAt && !Number.isNaN(Date.parse(profile.joinedAt)) ? p.joined.replace('{date}', new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(profile.joinedAt))) : ''
  const shown = data ? tab === 'media' ? data.posts.filter((post) => post.images.length > 0) : data.posts : []
  const shareProfile = () => { setMenu(null); actions.share('/community/member/' + encodeURIComponent(profile?.handle || handle || '')) }
  const reportProfile = async (reason: string) => {
    if (!profile) return
    setMenu('sending')
    try { await submitCommunityReport({ targetType: 'profile', targetId: profile.id, reason }); setMenu('sent') } catch { setMenu('failed') }
  }
  const reportReasons = [
    { key: 'spam', label: t('community.reportSpam') },
    { key: 'scam', label: t('community.reportScam') },
    { key: 'harass', label: t('community.reportHarass') },
    { key: 'other', label: t('community.reportOther') },
  ]
  return (
    <MaisonPage page="community-profile" topbar={<RwaTopbar screen="community-profile" title={profile?.displayName ?? t('community.viewProfile')} onBack={() => go('community')} />}>
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
          {/* X-style header in Maison tokens: crisp cover, avatar biting its lower edge, actions on the right. */}
          <header className={x.profile}>
            <div className={x.cover} aria-hidden="true">
              {profile?.coverUrl ? <img src={mediaSrc(profile.coverUrl) ?? undefined} alt="" /> : <CommunityMark seed={handle} size={260} className={x.coverMark} />}
            </div>
            <div className={x.profileRow}>
              {own && me ? <CommunityAvatar avatarUrl={me.avatarUrl} seed={me.avatarSeed} handle={me.handle} size={84} className={x.profileAvatar} /> : <Avatar author={data.profile} size={84} className={x.profileAvatar} />}
              <div className={x.profileActions}>
                <button type="button" className={x.roundBtn} aria-label={p.more} aria-haspopup="dialog" onClick={() => setMenu('more')}><MoreHorizontal size={19} strokeWidth={1.9} aria-hidden="true" /></button>
                {own
                  ? <button type="button" className={x.editBtn} onClick={() => setEditing(true)}><PenLine size={15} strokeWidth={2} aria-hidden="true" />{communityComposeCopy[locale].editProfile}</button>
                  : <>
                    <button type="button" className={x.ghostBtn} onClick={() => isGuest ? go('login') : actions.notify({ text: p.dmSoon })}>{p.dm}</button>
                    <CommunityFollowButton className={x.followBtn} handle={handle} guest={isGuest} onLogin={() => go('login')} onChanged={() => void load(true)} />
                  </>}
              </div>
            </div>
            <h1 className={x.profileName}>
              <span dir="auto">{data.profile.displayName}</span>
              {data.profile.kind === 'official' && <BadgeCheck className={x.verified} size={20} strokeWidth={2} role="img" aria-label={p.verified} />}
            </h1>
            {data.profile.handle && <p className={x.handle} dir="ltr">@{data.profile.handle}</p>}
            {data.profile.bio ? <p className={x.bio} dir="auto">{data.profile.bio}</p> : null}
            {(data.profile.city || joined) && <p className={x.meta}>
              {data.profile.city && <span><MapPin size={15} strokeWidth={1.8} aria-hidden="true" /><span dir="auto">{data.profile.city}</span></span>}
              {joined && <span><CalendarDays size={15} strokeWidth={1.8} aria-hidden="true" />{joined}</span>}
            </p>}
            <p className={x.tally}>
              <span><b>{compact(locale, data.stats.followingCount)}</b> {ui.following}</span>
              <span><b>{compact(locale, data.stats.followerCount)}</b> {ui.followers}</span>
              <span><b>{compact(locale, data.stats.postCount)}</b> {ui.posts}</span>
            </p>
          </header>
          <div className={x.dock}>
            <TimelineTabs label={ui.posts} value={tab} onChange={setTab} options={[{ key: 'posts', label: ui.posts }, { key: 'media', label: p.media }]} />
          </div>
          {shown.length === 0
            ? <div className={x.pad}><StateBlock title={tab === 'media' ? p.noMedia : t('community.emptyTitle')} /></div>
            : <ul className={x.feed} aria-label={tab === 'media' ? p.media : ui.posts}>
              {shown.map((post, index) => (
                <PostRow key={post.id} post={post} timeAgo={timeAgo} openPost={openPost} topics={topics} locale={locale} index={index} actions={rowActions} />
              ))}
            </ul>}
          {own && me && <CommunityProfileEditor open={editing} onOpenChange={setEditing} me={me} onSaved={() => void load(true)} />}
          {actions.overlays(me)}
          {menu && (
            <div className="community-report-overlay" onClick={() => setMenu(null)} onKeyDown={(event) => { if (event.key === 'Escape') setMenu(null) }}>
              <div className="community-report-sheet" role="dialog" aria-modal="true" aria-labelledby="community-profile-menu" onClick={(event) => event.stopPropagation()}>
                {menu === 'more' ? <>
                  <b id="community-profile-menu" className="community-report-title">{data.profile.displayName}</b>
                  <div className="community-report-options">
                    <button type="button" autoFocus onClick={shareProfile}>{p.shareProfile}</button>
                    {!own && <button type="button" onClick={() => isGuest ? go('login') : setMenu('report')}>{p.reportProfile}</button>}
                  </div>
                </> : menu === 'sent' ? <>
                  <b id="community-profile-menu" className="community-report-title" role="status">{t('community.reportThanks')}</b>
                  <button type="button" className="community-report-submit" autoFocus onClick={() => setMenu(null)}>{t('common.back')}</button>
                </> : <>
                  <b id="community-profile-menu" className="community-report-title">{p.reportProfile}</b>
                  <div className="community-report-options">
                    {reportReasons.map((option) => <button key={option.key} type="button" disabled={menu === 'sending'} onClick={() => void reportProfile(option.key)}>{option.label}</button>)}
                  </div>
                  {menu === 'failed' && <small className="community-report-error" role="alert">{t('community.reportFailed')}</small>}
                </>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </MaisonPage>
  )
}
