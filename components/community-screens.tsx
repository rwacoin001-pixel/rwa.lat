'use client'

/**
 * Community · X-style timeline (feed, post, member).
 * Data, auth gating, optimistic like/follow, compose, reply and report behaviour are unchanged from the previous
 * Maison timeline; this file only changes structure and presentation (community-x.module.css).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, BadgeCheck, BarChart2, CalendarDays, Flag, Mail, MapPin, MessageCircle, MoreHorizontal, Share, Share2 } from 'lucide-react'
import { claimFeatherCompose, setFeather } from '@/lib/community-feather'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { communityTopicCopy } from '@/lib/route-copy'
import { getCircle, type CircleMember } from '@/lib/community-data'
import { getMyCircles, type CircleMembership } from '@/lib/community-circles'
import { CircleList, openCircle } from './community/CircleList'
import { RewardDrawHost } from './rewards/RewardDrawHost'
import { Avatar, Images, Like, PostRow, SkeletonRows, Tags, XState, circleCopy, communityTopicTitle, compact, profileCopy, useInfinite, usePostActions, useTimeAgo, type RowActions } from './community/PostCard'
import { openPath } from '@/lib/maison-nav'
import { CircleJoinSheet } from './community/CircleJoinSheet'
import { ResultCard } from './community/cards/ResultCard'
import { cardsLive } from '@/lib/community-cards'
import type { RwaScreen } from '@/lib/rwa-routes'
import { sharePage } from '@/lib/share-page'
import { useQuery } from '@/lib/api/_query'
import { referralMe } from '@/lib/api/referral'
import { inviteLinkFor } from '@/lib/referral-invite'
import RwaLogoMark from './rwa-logo'
import { CommunityFollowButton, CommunityFollowView, CommunityLike, useCommunityFollow } from './community-actions'
import { CommunityText } from './community-text'
import { CommunityProofCard } from './community-proof'
import { CommunityAvatar, CommunityMark, mediaSrc } from './community-avatar'
import { PhotoViewer } from './community-photo-viewer'
import { CommunityCompose, CommunityProfileEditor, CommunityReplyBar, useCommunityMe, type ComposeTarget } from './community-compose'
import { communityComposeCopy } from '@/lib/maison-community-compose-copy'
import { PublicShareButton } from './public-sharing'
import { communityCopy } from '@/lib/maison-content-copy'
import { communityUiCopy } from '@/lib/maison-community-ui-copy'
import { communityExperienceCopy } from '@/lib/community-experience-copy'
import { useScrollChrome } from '@/hooks/useScrollChrome'
import { MaisonPage, maison as mp } from './maison/primitives'
import c from './community-x.module.css'
import dynamic from 'next/dynamic'
import { dmUnreadCount } from '@/lib/api/community-dm'
import type { DmProfile } from '@/lib/api/community-dm'

/** Direct messages load on demand: the screen module comes in only when a conversation opens. */
const openDm = (handle: string, peer: DmProfile) => import('./community/DmScreens').then(m => m.openConversation(handle, peer))
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

/** X tabs: equal-width labels with a 4px accent pill under the chosen one that glides between them. */
function TimelineTabs<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: { key: T; label: string }[] }) {
  const reduced = useReducedMotion()
  return <LayoutGroup id={`tabs-${label}`}>
    <div className={c.tabs} role="tablist" aria-label={label}>
      {options.map((option) => <button key={option.key} type="button" role="tab" className={c.tab} aria-selected={option.key === value} onClick={() => onChange(option.key)}>
        <span>{option.label}{option.key === value && <motion.i className={c.tabLine} layoutId="line" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}</span>
      </button>)}
    </div>
  </LayoutGroup>
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className={c.circleBtn} aria-label={label} onClick={onClick}><ArrowLeft className={c.flip} size={20} strokeWidth={2} aria-hidden="true" /></button>
}

/**
 * Scroll progress for the X profile bar, written as CSS variables on the page root (rAF-batched):
 * --pf-art 0→1 while the banner scrolls up under the bar, --pf-title 0→1 while the name passes beneath it,
 * and data-pin-follow once the profile's own follow button is hidden under the bar.
 */
function useProfileHead(ready: boolean) {
  const root = useRef<HTMLDivElement>(null), bar = useRef<HTMLElement>(null), banner = useRef<HTMLDivElement>(null)
  const name = useRef<HTMLHeadingElement>(null), follow = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el || !ready) return
    let frame = 0
    const clamp = (value: number) => Math.min(1, Math.max(0, value))
    const update = () => {
      frame = 0
      const edge = bar.current?.getBoundingClientRect().bottom ?? 0
      const art = banner.current?.getBoundingClientRect()
      const title = name.current?.getBoundingClientRect()
      const pin = follow.current?.getBoundingClientRect()
      // The banner starts under the bar: 0 at rest, 1 once its bottom edge reaches the bar's.
      el.style.setProperty('--pf-art', art ? clamp(-art.top / Math.max(1, art.height - edge)).toFixed(3) : '1')
      el.style.setProperty('--pf-title', title ? clamp((edge - title.top) / Math.max(1, title.height)).toFixed(3) : '1')
      if (pin && pin.bottom < edge) el.dataset.pinFollow = ''
      else delete el.dataset.pinFollow
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame) }
  }, [ready])
  return { root, bar, banner, name, follow }
}

/* ── Feed ── */

/** `embedded` renders the bare feed for a host that owns the page and bar (the AI screen's 社区 tab). */
/** My circle copy (2026-10-28). */

/** The invite centre lives in the Community tab (2026-10-28); loaded only when someone opens it. */
const InviteCentre = dynamic(() => import('./maison/ReferralCenter').then((m) => ({ default: m.ReferralScreen })), { ssr: false })
const inviteLabel: Record<AppLocale, { tab: string; guest: string; guestBody: string }> = {
  en: { tab: 'Invite', guest: 'Sign in to invite friends', guestBody: 'Your invite code, link and rewards appear here.' },
  'zh-CN': { tab: '邀请', guest: '登录后邀请好友', guestBody: '你的邀请码、专属链接和奖励都在这里。' },
  hi: { tab: 'आमंत्रण', guest: 'दोस्तों को बुलाने के लिए साइन इन करें', guestBody: 'आपका कोड, लिंक और इनाम यहाँ दिखेंगे।' },
  es: { tab: 'Invitar', guest: 'Inicia sesión para invitar', guestBody: 'Aquí verás tu código, tu enlace y tus recompensas.' },
  ar: { tab: 'دعوة', guest: 'سجّل الدخول لدعوة الأصدقاء', guestBody: 'يظهر هنا رمزك ورابطك ومكافآتك.' },
  fr: { tab: 'Inviter', guest: 'Connectez-vous pour inviter', guestBody: 'Votre code, votre lien et vos récompenses s’affichent ici.' },
  pt: { tab: 'Convidar', guest: 'Entre para convidar amigos', guestBody: 'Seu código, link e recompensas aparecem aqui.' },
}
type CommunityView = 'feed' | 'invite'
const viewFromUrl = (): CommunityView => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'invite' ? 'invite' : 'feed'

const cardsTabCopy: Partial<Record<string, { tab: string; filters: Record<'all' | 'quant' | 'prediction' | 'funds', string>; empty: string; emptyBody: string; make: string }>> = {
  'zh-CN': { tab: '晒单', filters: { all: '全部', quant: '量化', prediction: '预测', funds: '资金记录' }, empty: '还没有人晒单', emptyBody: '晒单卡片的数据来自账户，亏损也可以发。', make: '发一张卡片' },
  en: { tab: 'Results', filters: { all: 'All', quant: 'Quant', prediction: 'Predictions', funds: 'Funds' }, empty: 'No results shared yet', emptyBody: 'Card figures come from the account. Losses can be shared too.', make: 'Share a card' },
}

export function CommunityFeedScreen({ go, openPost, openProfile, isGuest = true, embedded = false }: { go: (screen: RwaScreen) => void; openPost: (id: string) => void; openProfile: (handle: string) => void; isGuest?: boolean; embedded?: boolean }) {
  // Unread direct messages: a dot on the envelope, refreshed while the feed is open.
  const [dmUnread, setDmUnread] = useState(0)
  useEffect(() => {
    if (isGuest) return
    const check = () => { if (document.visibilityState === 'visible') void dmUnreadCount().then(res => { if (res.ok && typeof res.data?.count === 'number') setDmUnread(res.data.count) }) }
    check()
    const timer = window.setInterval(check, 30_000)
    return () => window.clearInterval(timer)
  }, [isGuest])
  const { t, locale } = useI18n()
  const timeAgo = useTimeAgo()
  // Match the home module's public feed so the community route does not
  // render an empty latest-only view while the hot feed already has content.
  // Signed-in readers open on their circle (2026-11-01).
  const [sort, setSort] = useState<'latest' | 'hot' | 'circle' | 'cards'>(() => !embedded && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sort') === 'cards' ? 'cards' : isGuest || embedded ? 'hot' : 'circle')
  // 晒单 tab (2026-11-01): result-card posts, newest first, filtered by family; never ranked by profit.
  const [cardFilter, setCardFilter] = useState<'all' | 'quant' | 'prediction' | 'funds'>('all')
  const cardsText = cardsTabCopy[locale] ?? cardsTabCopy.en!
  const [cardsOn, setCardsOn] = useState(false)
  useEffect(() => { void cardsLive().then(setCardsOn) }, [])
  const [topic, setTopic] = useState<string | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [items, setItems] = useState<CommunityPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const requestVersion = useRef(0)
  const pageSort = useRef<'latest' | 'hot' | 'cards'>('hot')
  const [composing, setComposing] = useState(false)
  const me = useCommunityMe(isGuest)
  const chromeHidden = useScrollChrome()
  const ui = communityUiCopy[locale]
  const p = profileCopy[locale]
  const circleText = circleCopy[locale] ?? circleCopy.en
  // My circle (2026-10-28): who I invited / who invited me, for the tag on their posts and the circle timeline.
  const [circle, setCircle] = useState<{ members: CircleMember[]; showToInviter: boolean } | null>(null)
  const [circles, setCircles] = useState<CircleMembership | null>(null)
  useEffect(() => {
    if (isGuest) { setCircles(null); return }
    let active = true
    void getMyCircles().then(data => { if (active) setCircles(data) }).catch(() => undefined)
    return () => { active = false }
  }, [isGuest])
  // Links into a circle (2026-11-01): ?join=<code> (an invite link, via /c/<code>) opens the join sheet; ?circle=<id>
  // (a circle notification) opens that circle. Both are read once and dropped from the address when done.
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const dropParam = (name: string) => {
    const params = new URLSearchParams(window.location.search); params.delete(name)
    window.history.replaceState({ ...window.history.state }, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`)
  }
  useEffect(() => {
    if (embedded) return
    const params = new URLSearchParams(window.location.search)
    const join = params.get('join'), wanted = params.get('circle')
    if (join && /^[A-Za-z0-9_-]{6,32}$/.test(join)) setJoinCode(join)
    if (wanted) { openPath(`/community/circle/${encodeURIComponent(wanted)}`, { replace: true }); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, isGuest])
  const openJoined = (id: string) => { setJoinCode(null); dropParam('join'); openCircle(id) }
  // The session can resolve a moment after the first paint (isGuest true → false): go back to the circle tab then,
  // unless the reader already picked another tab (2026-11-01: a cold start on /community stayed on 热门).
  const guestHot = useRef(isGuest && !embedded)
  useEffect(() => { if (isGuest) { setCircle(null); setSort((current) => { if (current !== 'circle') return current; guestHot.current = true; return 'hot' }); return }
    if (guestHot.current && !embedded) { guestHot.current = false; setSort((current) => current === 'hot' ? 'circle' : current) }
    getCircle().then((data) => setCircle({ members: data?.members ?? [], showToInviter: data?.showToInviter !== false })).catch(() => undefined) }, [isGuest])
  // The feather (2026-10-31): it composes from whichever feed is on screen. On the page itself it rises above the AI orb
  // while the reader scrolls down the feed, and pales when they pull back up. The embedded feed on home leaves the
  // visibility to the home page's pinned tabs.
  useEffect(() => claimFeatherCompose(() => { if (isGuest) go('login'); else setComposing(true) }), [isGuest, go])
  useEffect(() => {
    if (embedded) return
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY, dy = y - last
      last = y
      if (y < 160) setFeather({ visible: false, faded: false })
      else if (Math.abs(dy) > 2) setFeather({ visible: true, faded: dy < 0 })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); setFeather({ visible: false, faded: false }) }
  }, [embedded])
  const relations = new Map((circle?.members ?? []).map((member) => [member.profile.id, member.relation]))
  // My circle leads when there is one (2026-10-28): the people you invited come first.
  const tabs = [...(isGuest || embedded ? [] : [{ key: 'circle' as const, label: circleText.tab }]), ...(embedded || !cardsOn ? [] : [{ key: 'cards' as const, label: cardsText.tab }]), { key: 'hot' as const, label: t('community.sortHot') }, { key: 'latest' as const, label: t('community.sortLatest') }]
  const actions = usePostActions(isGuest, go, locale, (postId) => setItems((previous) => previous.map((item) => item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item)))
  const rowActions: RowActions = { guest: isGuest, onLogin: actions.login, onReply: actions.onReply, onShare: actions.onShare, onMore: actions.onMore }

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
        if (sort === 'circle') { setItems([]); setNextCursor(null); return }
        page = sort === 'cards' ? await getCommunityFeed({ cards: cardFilter, limit: 20 }) : await getCommunityFeed({ sort, topic: topic ?? undefined, limit: 20 })
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
      pageSort.current = effectiveSort === 'circle' ? 'hot' : effectiveSort
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
      const page = pageSort.current === 'cards' ? await getCommunityFeed({ cards: cardFilter, cursor: nextCursor, limit: 20 }) : await getCommunityFeed({ sort: pageSort.current, topic: topic ?? undefined, cursor: nextCursor, limit: 20 })
      if (version !== requestVersion.current) return
      setItems((previous) => [...previous, ...(page.items ?? []).filter(item => !previous.some(row => row.id === item.id))])
      setNextCursor(page.nextCursor)
    } catch {
      if (version === requestVersion.current) setMoreFailed(true)
    } finally {
      setLoadingMore(false)
    }
  }
  const sentinel = useInfinite(() => void loadMore(), Boolean(nextCursor) && !loading && !failed, nextCursor)

  // First-level tab (2026-10-28): 社区 · 邀请 at the top instead of a back arrow; ?tab=invite opens the invite centre.
  const [view, setView] = useState<CommunityView>(viewFromUrl)
  useEffect(() => {
    if (embedded) return
    const params = new URLSearchParams(window.location.search)
    if (view === 'invite') params.set('tab', 'invite'); else params.delete('tab')
    const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState({ ...window.history.state }, '', next)
  }, [view, embedded])
  const invite = inviteLabel[locale] ?? inviteLabel.en
  const pick = (next: CommunityView) => { if (next === view) { window.scrollTo({ top: 0 }); return } navigator.vibrate?.(4); setView(next); window.scrollTo({ top: 0 }) }
  // Swipe between 社区 and 邀请 (2026-10-28): left goes to 邀请, right comes back. A swipe that starts on something that
  // scrolls sideways itself (chips, image strips) belongs to that thing; mostly-vertical drags are scrolling.
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const scrollsSideways = (target: EventTarget | null) => {
    for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.getAttribute('role') === 'dialog') return true
    }
    return false
  }
  const swipeHandlers = embedded ? {} : {
    onTouchStart: (event: React.TouchEvent) => { const touch = event.touches[0]; swipe.current = event.touches.length === 1 && !scrollsSideways(event.target) ? { x: touch.clientX, y: touch.clientY, t: Date.now() } : null },
    onTouchEnd: (event: React.TouchEvent) => {
      const start = swipe.current; swipe.current = null
      if (!start) return
      const touch = event.changedTouches[0], dx = touch.clientX - start.x, dy = touch.clientY - start.y
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - start.t > 700) return
      const rtl = document.documentElement.dir === 'rtl'
      const forward = rtl ? dx > 0 : dx < 0
      if (forward && view === 'feed') pick('invite')
      else if (!forward && view === 'invite') pick('feed')
    },
  }

  const pickSort = (next: 'latest' | 'hot' | 'circle' | 'cards') => { guestHot.current = false; if (next === sort) { window.scrollTo({ top: 0, behavior: 'smooth' }); return } setSort(next) }

  const feed = (
    <div className={c.x} data-embedded={embedded || undefined} data-view={view} {...swipeHandlers}>
      {/* Reading down slides the top row away; the tabs stay pinned. A small upward scroll brings it back (X mobile). */}
      <header className={c.head} data-hidden={chromeHidden} data-glass-bar="">
        {!embedded && <div className={`${c.headRow} ${c.headRowTabs}`}>
          <div className={c.pageTabs} role="tablist" aria-label={t('nav.community')}>
            {([['feed', t('nav.community')], ['invite', invite.tab]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => pick(key)}>{label}</button>)}
          </div>
          {/* No compose button in the header (2026-10-31): posting is the feather above the AI orb. */}
          {!isGuest && <button type="button" className={c.inboxBtn} aria-label={p.dm} data-view={view} onClick={() => go('community-messages')}><Mail size={20} strokeWidth={1.9} aria-hidden="true" />{dmUnread > 0 && <i aria-hidden="true" />}</button>}
          {isGuest
            ? <button type="button" className={c.signIn} onClick={() => go('login')}>{p.signIn}</button>
            : <button type="button" className={c.meBtn} aria-label={t('community.viewProfile')} onClick={() => go('profile')}>
              <CommunityAvatar avatarUrl={me?.avatarUrl} seed={me?.avatarSeed} handle={me?.handle ?? 'me'} size={38} />
            </button>}
        </div>}
        {/* One chip row (2026-10-28): how to sort (hot, latest, my circle), then the topics; tap a topic again to clear it. */}
        {view === 'feed' && <div className={c.topics} role="group" aria-label={ui.feed}>
          {tabs.map((option) => <button key={option.key} type="button" className={c.chip} aria-pressed={sort === option.key} onClick={() => pickSort(option.key)}>{option.label}</button>)}
          {sort === 'cards' && <>
            <i className={c.chipRule} aria-hidden="true" />
            {(['all', 'quant', 'prediction', 'funds'] as const).map((key) => <button key={key} type="button" className={`${c.chip} ${c.topicChip}`} aria-pressed={cardFilter === key} onClick={() => setCardFilter(key)}>{cardsText.filters[key]}</button>)}
          </>}
          {sort !== 'circle' && sort !== 'cards' && topics.length > 0 && <>
            <i className={c.chipRule} aria-hidden="true" />
            {topics.map((entry) => <button key={entry.slug} type="button" className={`${c.chip} ${c.topicChip}`} aria-pressed={topic === entry.slug} onClick={() => setTopic(topic === entry.slug ? null : entry.slug)}>#{communityTopicTitle(entry.slug, topics, locale)}</button>)}
          </>}
        </div>}
      </header>
      {view === 'invite' ? (isGuest
        ? <XState title={invite.guest} body={invite.guestBody} action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => go('login')}>{p.signIn}</button>} />
        : <InviteCentre embedded />)
      : sort === 'circle' && !isGuest ? <CircleList onNotify={text => actions.notify({ text })} />
      : loading ? <SkeletonRows />
        : failed ? <XState title={communityCopy[locale].feedFailed} action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => void load()}>{t('common.refresh')}</button>} />
        : items.length === 0 && sort === 'cards' ? <XState title={cardsText.empty} body={cardsText.emptyBody} action={isGuest ? undefined : <button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => setComposing(true)}>{cardsText.make}</button>} />
        : items.length === 0 ? (sort === 'circle'
          ? <XState title={circleText.emptyTitle} body={circleText.emptyBody} action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => pick('invite')}>{circleText.invite}</button>} />
          : <XState title={t('community.emptyTitle')} body={t('community.emptyBody')} />)
        : <>
          <ul className={c.feed} aria-label={ui.feed}>
            {items.map((post, index) => <PostRow key={post.id} index={index} post={post} timeAgo={timeAgo} openPost={openPost} openProfile={openProfile} topics={topics} locale={locale} actions={rowActions} relation={post.author?.id ? relations.get(post.author.id) : undefined} />)}
          </ul>
          {nextCursor && !moreFailed && <div ref={sentinel} className={c.sentinel} aria-hidden="true" />}
          {loadingMore && <span className={c.spinner} role="status" aria-label={t('community.loadMore')} />}
          {moreFailed && <button type="button" className={c.more} onClick={() => { setMoreFailed(false); void loadMore() }}>{communityCopy[locale].moreFailed} · {t('common.refresh')}</button>}
        </>}
      {!embedded && <CircleJoinSheet code={joinCode} isGuest={isGuest} onClose={() => { setJoinCode(null); dropParam('join') }} onOpen={openJoined} onNotify={(text) => actions.notify({ text })} />}
      {!isGuest && <CommunityCompose open={composing} onClose={() => setComposing(false)} target={{ kind: 'post', topic, circleId: null, openCard: sort === 'cards' }} me={me} topics={topics} circles={circles ? [...(circles.owned ? [circles.owned] : []), ...circles.joined] : []} onPublished={openPost} />}
      {!isGuest && <RewardDrawHost />}
      {actions.overlays(me)}
    </div>
  )
  if (embedded) return feed
  return <MaisonPage page="community" className={c.page}>{feed}</MaisonPage>
}

/* ── Focused post ── */

export function CommunityPostScreen({ postId, go, openProfile, isGuest = true }: { postId: string | null; go: (screen: RwaScreen) => void; openProfile: (handle: string) => void; isGuest?: boolean }) {
  const { t, locale } = useI18n()
  const timeAgo = useTimeAgo()
  const [data, setData] = useState<CommunityPostResponse | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [failed, setFailed] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [replying, setReplying] = useState<{ files: File[] | null } | null>(null)
  const me = useCommunityMe(isGuest)
  const ui = communityUiCopy[locale]
  const p = profileCopy[locale]
  const actions = usePostActions(isGuest, go, locale)
  // The bar with the back key stays on screen while reading (2026-10-29).

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

  const author = data?.post.author ?? null
  const own = Boolean(me && author && me.id === author.id)
  const postCity = data ? data.post.location?.city || author?.city : undefined
  const published = data?.post.publishedAt ? new Date(data.post.publishedAt) : null
  const stamp = published && !Number.isNaN(published.getTime())
    ? `${new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(published)} · ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(published)}`
    : ''
  const openMenu = () => postId && actions.openMenu({ type: 'post', id: postId, title: p.more }, () => actions.share('/community/post/' + encodeURIComponent(postId)))
  const toAuthor = author ? () => openProfile(author.handle || author.id) : undefined
  return (
    <MaisonPage page="community-post" className={c.page}>
      <div className={c.x} data-reply-bar={data ? '' : undefined}>
        <header className={c.subHead} data-glass-bar="">
          <BackButton label={p.back} onClick={() => go('community')} />
          <h1 className={c.subTitle}><b>{p.post}</b></h1>
          {postId && <button type="button" className={c.circleBtn} aria-label={t('community.report')} aria-haspopup="dialog" onClick={openMenu}><MoreHorizontal size={20} strokeWidth={1.9} aria-hidden="true" /></button>}
        </header>
        {!postId ? (
          <XState title={t('community.emptyTitle')} action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => go('community')}>{t('community.backToFeed')}</button>} />
        ) : failed ? (
          <XState title={communityCopy[locale].postFailed} action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => void load()}>{t('common.refresh')}</button>} />
        ) : !data ? (
          <SkeletonRows rows={3} />
        ) : (
          <>
            <article className={c.focus}>
              <div className={c.focusHead}>
                {toAuthor ? <button type="button" className={c.avatarBtn} aria-label={author?.displayName} onClick={toAuthor}><Avatar author={author} /></button> : <Avatar author={author} />}
                <div className={c.focusWho}>
                  <span className={c.who}>
                    {toAuthor ? <button type="button" className={c.name} dir="auto" onClick={toAuthor}>{author?.displayName}</button> : <b className={c.name}>—</b>}
                    {author?.kind === 'official' && <BadgeCheck className={c.badge} size={18} strokeWidth={2.2} role="img" aria-label={p.verified} />}
                  </span>
                  {author?.handle && <span className={c.handle} dir="ltr">@{author.handle}</span>}
                </div>
                {author?.handle && !own && <CommunityFollowButton className={c.follow} handle={author.handle} guest={isGuest} onLogin={() => go('login')} />}
              </div>
              <CommunityText body={data.post.body} targetId={data.post.id} className={c.focusText} lang={data.post.lang} />
              {data.post.card ? <div className={c.cardSlot}><ResultCard card={data.post.card} /></div> : data.post.proof && <CommunityProofCard proof={data.post.proof} locale={locale} />}
              <Images images={data.post.images} />
              <Tags list={data.post.topics} topics={topics} locale={locale} />
              <p className={c.stamp}>
                <time dateTime={data.post.publishedAt ?? undefined}>{stamp}</time>
                {postCity && <> · <span dir="auto">{postCity}</span></>}
                {data.post.viewCount > 0 && <> · <b>{compact(locale, data.post.viewCount)}</b> {ui.views}</>}
              </p>
              <div className={`${c.bar} ${c.focusBar}`}>
                <button type="button" className={c.act} onClick={() => { if (isGuest) { go('login'); return } setReplying({ files: null }) }}>
                  <MessageCircle size={22.5} strokeWidth={1.8} aria-hidden="true" />
                  <span aria-hidden="true">{data.commentTotal > 0 ? compact(locale, data.commentTotal) : ''}</span>
                  <span className={c.srOnly}>{ui.reply} · {ui.replies} {data.commentTotal}</span>
                </button>
                {/* Optimistic heart with a state probe; the old toggle stayed disabled whenever /me/state failed. */}
                <Like postId={postId} count={data.post.likeCount} guest={isGuest} onLogin={() => go('login')} onChanged={() => void load(true)} probe size={22.5} locale={locale} />
                <span className={c.act}><BarChart2 size={22.5} strokeWidth={1.8} aria-hidden="true" /><span aria-hidden="true">{data.post.viewCount > 0 ? compact(locale, data.post.viewCount) : ''}</span><span className={c.srOnly}>{ui.views} {data.post.viewCount}</span></span>
                <button type="button" className={c.act} aria-label={ui.share} aria-expanded={sharing} onClick={() => setSharing((open) => !open)}><Share size={21} strokeWidth={1.8} aria-hidden="true" /></button>
              </div>
              {sharing && <div className={c.share}><PublicShareButton kind="community_post" resourceId={postId} /></div>}
            </article>
            {data.commentTotal === 0 && data.comments.length === 0
              ? <XState title={ui.noReplies} />
              : <ol className={c.feed} aria-label={t('community.comments')}>
                {data.comments.map((comment, index) => (
                  <li key={comment.id} className={`${c.post} ${c.rise}`} style={{ '--i': index, cursor: 'default' } as CSSProperties}>
                    <div className={c.avatarCol}><Avatar author={comment.author} /></div>
                    <div className={c.main}>
                      <div className={c.who}>
                        <b className={c.name} dir="auto">{comment.author?.displayName ?? '—'}</b>
                        {comment.author?.kind === 'official' && <BadgeCheck className={c.badge} size={18} strokeWidth={2.2} role="img" aria-label={p.verified} />}
                        {comment.author?.handle && <span className={c.handle} dir="ltr">@{comment.author.handle}</span>}
                        <span className={c.dot} aria-hidden="true">·</span>
                        <time className={c.time} dateTime={comment.createdAt ?? undefined}>{timeAgo(comment.createdAt)}</time>
                      </div>
                      {author?.handle && <p className={c.replyTo}>{p.replyingTo} <b dir="ltr">@{author.handle}</b></p>}
                      {comment.body && <CommunityText body={comment.body} targetId={comment.id} targetType="comment" className={c.text} lang={comment.lang} />}
                      <Images images={comment.images ?? []} />
                    </div>
                  </li>
                ))}
              </ol>}
            <CommunityReplyBar me={me} guest={isGuest} onLogin={() => go('login')} onOpen={(files) => setReplying({ files: files ?? null })} />
            {!isGuest && <CommunityCompose open={replying !== null} onClose={() => setReplying(null)} target={{ kind: 'reply', postId, handle: author?.handle } satisfies ComposeTarget} me={me} initialFiles={replying?.files} onPublished={() => void load(true)} />}
          </>
        )}
        {actions.overlays(me)}
      </div>
    </MaisonPage>
  )
}

/* ── Member profile ── */

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
  const actions = usePostActions(isGuest, go, locale, () => void load(true))
  const rowActions: RowActions = { guest: isGuest, onLogin: actions.login, onReply: actions.onReply, onShare: actions.onShare, onMore: actions.onMore }
  const own = Boolean(me && data && me.id === data.profile.id)
  const profile = data?.profile
  const joined = profile?.joinedAt && !Number.isNaN(Date.parse(profile.joinedAt)) ? p.joined.replace('{date}', new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(profile.joinedAt))) : ''
  const media = data ? data.posts.filter((post) => post.images.length > 0) : []
  const shareProfile = () => actions.share('/community/member/' + encodeURIComponent(profile?.handle || handle || ''))
  const openMenu = () => profile && actions.openMenu({ type: 'profile', id: profile.id, title: profile.displayName }, shareProfile)
  const follow = useCommunityFollow(handle ?? '', isGuest || !handle, () => go('login'), () => void load(true))
  const head = useProfileHead(Boolean(profile))
  // Banner (2026-10-28): their own cover; else their photo, blurred and softened (as Apple Music artist pages); else a plain
  // fill. No generated colour fields.
  const avatarArt = profile?.avatarUrl ? mediaSrc(profile.avatarUrl) : null
  const art = profile ? (profile.coverUrl ? <img src={mediaSrc(profile.coverUrl) ?? undefined} alt="" />
    : avatarArt ? <span className={c.bannerBlur} aria-hidden="true"><img src={avatarArt} alt="" /></span>
    : <span className={c.bannerPlain} aria-hidden="true" />) : null
  return (
    <MaisonPage page="community-profile" className={c.page}>
      <div className={c.x} ref={head.root}>
        {/* X profile bar: clear over the banner at rest; while scrolling, the banner pins under it (blurred, dimmed),
            then the name and a pinned follow button fade in once their originals pass beneath the bar. */}
        <header ref={head.bar} className={c.profHead} data-art={art ? '' : undefined}>
          {art && <span className={c.profHeadArt} aria-hidden="true">{art}</span>}
          <button type="button" className={c.discBtn} aria-label={p.back} onClick={() => go('community')}><ArrowLeft className={c.flip} size={20} strokeWidth={2} aria-hidden="true" /></button>
          <h1 className={c.profHeadTitle}>
            <b dir="auto">{profile?.displayName ?? t('community.viewProfile')}{profile?.kind === 'official' && <BadgeCheck className={c.badge} size={18} strokeWidth={2.2} aria-hidden="true" />}</b>
            {data && <small>{p.postsCount.replace('{n}', compact(locale, data.stats.postCount))}</small>}
          </h1>
          {/* The menu stays at the far right; the pinned follow button slides in to its left once the page scrolls
              (2026-10-29, user: the menu sat in the middle because the hidden follow kept its width). */}
          {profile && !own && <CommunityFollowView state={follow} className={c.headFollow} />}
          {profile && <button type="button" className={c.discBtn} aria-label={p.more} aria-haspopup="dialog" onClick={openMenu}><MoreHorizontal size={20} strokeWidth={1.9} aria-hidden="true" /></button>}
        </header>
        {!handle || failed ? (
          <XState title={failed ? communityCopy[locale].profileFailed : t('community.emptyTitle')}
            action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => failed ? void load() : go('community')}>{failed ? t('common.refresh') : t('community.backToFeed')}</button>} />
        ) : !data || !profile ? (
          <SkeletonRows rows={3} />
        ) : (
          <>
            <div ref={head.banner} className={c.banner} aria-hidden="true">{art}</div>
            <div className={c.profTop}>
              <span className={c.avatarRing}>
                {own && me ? <CommunityAvatar avatarUrl={me.avatarUrl} seed={me.avatarSeed} handle={me.handle} size={80} /> : <Avatar author={profile} size={80} />}
              </span>
              <div className={c.profActions}>
                {own
                  ? <button type="button" className={c.pill} onClick={() => setEditing(true)}>{communityComposeCopy[locale].editProfile}</button>
                  : <>
                    <button type="button" className={c.outlineCircle} aria-label={p.dm} onClick={() => isGuest ? go('login') : void openDm(profile.handle, { id: profile.id, handle: profile.handle, displayName: profile.displayName, avatarUrl: profile.avatarUrl ?? null, avatarSeed: profile.avatarSeed ?? profile.handle, kind: profile.kind ?? 'member' }).then(e => { if (e) actions.notify({ text: e.status === 404 && !/^DM_/.test(e.code) ? p.dmSoon : e.code === 'DM_BLOCKED' ? p.dmBlocked ?? e.message : /FOLLOW|POLICY/.test(e.code) ? p.dmPolicy ?? e.message : e.message }) })}><Mail size={18} strokeWidth={1.9} aria-hidden="true" /></button>
                    <span ref={head.follow} className={c.followSlot}><CommunityFollowView state={follow} className={c.follow} /></span>
                  </>}
              </div>
            </div>
            <h2 ref={head.name} className={c.profName}>
              <span dir="auto">{profile.displayName}</span>
              {profile.kind === 'official' && <BadgeCheck className={c.badge} size={20} strokeWidth={2.2} role="img" aria-label={p.verified} />}
            </h2>
            {profile.handle && <p className={c.profHandle} dir="ltr">@{profile.handle}</p>}
            {profile.bio ? <p className={c.bio} dir="auto">{profile.bio}</p> : null}
            {(profile.city || joined) && <p className={c.meta}>
              {profile.city && <span><MapPin size={17} strokeWidth={1.8} aria-hidden="true" /><span dir="auto">{profile.city}</span></span>}
              {joined && <span><CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" />{joined}</span>}
            </p>}
            <p className={c.tally}>
              <span><b>{compact(locale, data.stats.followingCount)}</b> {ui.following}</span>
              <span><b>{compact(locale, data.stats.followerCount)}</b> {ui.followers}</span>
            </p>
            <div className={c.profTabs}>
              <TimelineTabs label={ui.posts} value={tab} onChange={setTab} options={[{ key: 'posts', label: ui.posts }, { key: 'media', label: p.media }]} />
            </div>
            {tab === 'media'
              ? media.length === 0
                ? <XState title={p.noMedia} />
                : <div className={c.grid} aria-label={p.media}>
                  {media.map((post) => <button key={post.id} type="button" className={c.tile} aria-label={communityExperienceCopy[locale].open} onClick={() => openPost(post.id)}>
                    <img src={mediaSrc(post.images[0]) ?? undefined} alt="" loading="lazy" decoding="async" />
                  </button>)}
                </div>
              : data.posts.length === 0
                ? <XState title={t('community.emptyTitle')} />
                : <ul className={c.feed} aria-label={ui.posts}>
                  {data.posts.map((post, index) => (
                    <PostRow key={post.id} post={post} timeAgo={timeAgo} openPost={openPost} topics={topics} locale={locale} index={index} actions={rowActions} />
                  ))}
                </ul>}
            {own && me && <CommunityProfileEditor open={editing} onOpenChange={setEditing} me={me} onSaved={() => void load(true)} />}
          </>
        )}
        {actions.overlays(me)}
      </div>
    </MaisonPage>
  )
}
