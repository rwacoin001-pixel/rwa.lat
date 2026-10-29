'use client'

/**
 * Community · X-style timeline (feed, post, member).
 * Data, auth gating, optimistic like/follow, compose, reply and report behaviour are unchanged from the previous
 * Maison timeline; this file only changes structure and presentation (community-x.module.css).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, BadgeCheck, BarChart2, CalendarDays, Flag, Mail, MapPin, MessageCircle, MoreHorizontal, Share, Share2, SquarePen } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { communityTopicCopy } from '@/lib/route-copy'
import { getCircle, getCircleFeed, setCircleVisibility, type CircleMember } from '@/lib/community-data'
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
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' })
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

type ProfileCopy = {
  dm: string; dmSoon: string; dmBlocked?: string; dmPolicy?: string; media: string; noMedia: string; joined: string; more: string; shareProfile: string; reportProfile: string
  copied: string; shareFailed: string; verified: string; back: string; post: string; postsCount: string; sharePost: string; reportPost: string
  copyLink: string; cancel: string; replyingTo: string; publicLink: string; signIn: string
}
const profileCopy: Record<AppLocale, ProfileCopy> = {
  'zh-CN': { dm: '私信', dmSoon: '私信即将开放，先关注 TA 吧', dmBlocked: '你们之间有拉黑，无法私信。', dmPolicy: 'TA 只接收自己关注的人的私信。', media: '媒体', noMedia: '还没有带图的帖子', joined: '{date} 加入', more: '更多', shareProfile: '分享主页', reportProfile: '举报此用户', copied: '链接已复制', shareFailed: '分享失败，请稍后再试', verified: '官方认证', back: '返回', post: '帖子', postsCount: '{n} 条帖子', sharePost: '分享帖子', reportPost: '举报帖子', copyLink: '复制链接', cancel: '取消', replyingTo: '回复', publicLink: '生成公开链接', signIn: '登录' },
  en: { dm: 'Message', dmSoon: 'Direct messages are coming soon. Follow them for now.', dmBlocked: 'One of you has blocked the other.', dmPolicy: 'They only accept messages from people they follow.', media: 'Media', noMedia: 'No posts with media yet', joined: 'Joined {date}', more: 'More', shareProfile: 'Share profile', reportProfile: 'Report this account', copied: 'Link copied', shareFailed: 'Could not share. Try again.', verified: 'Official', back: 'Back', post: 'Post', postsCount: '{n} posts', sharePost: 'Share post', reportPost: 'Report post', copyLink: 'Copy link', cancel: 'Cancel', replyingTo: 'Replying to', publicLink: 'Create public link', signIn: 'Sign in' },
  es: { dm: 'Mensaje', dmSoon: 'Los mensajes directos llegarán pronto. De momento, síguele.', media: 'Multimedia', noMedia: 'Aún no hay publicaciones con imágenes', joined: 'Se unió en {date}', more: 'Más', shareProfile: 'Compartir perfil', reportProfile: 'Denunciar esta cuenta', copied: 'Enlace copiado', shareFailed: 'No se pudo compartir. Inténtalo de nuevo.', verified: 'Oficial', back: 'Atrás', post: 'Publicación', postsCount: '{n} publicaciones', sharePost: 'Compartir publicación', reportPost: 'Denunciar publicación', copyLink: 'Copiar enlace', cancel: 'Cancelar', replyingTo: 'En respuesta a', publicLink: 'Crear enlace público', signIn: 'Iniciar sesión' },
  fr: { dm: 'Message', dmSoon: 'Les messages privés arrivent bientôt. Abonnez-vous en attendant.', media: 'Médias', noMedia: 'Aucune publication avec média', joined: 'A rejoint en {date}', more: 'Plus', shareProfile: 'Partager le profil', reportProfile: 'Signaler ce compte', copied: 'Lien copié', shareFailed: 'Partage impossible. Réessayez.', verified: 'Officiel', back: 'Retour', post: 'Publication', postsCount: '{n} publications', sharePost: 'Partager la publication', reportPost: 'Signaler la publication', copyLink: 'Copier le lien', cancel: 'Annuler', replyingTo: 'En réponse à', publicLink: 'Créer un lien public', signIn: 'Se connecter' },
  pt: { dm: 'Mensagem', dmSoon: 'Mensagens diretas em breve. Siga por enquanto.', media: 'Mídia', noMedia: 'Ainda sem publicações com mídia', joined: 'Entrou em {date}', more: 'Mais', shareProfile: 'Compartilhar perfil', reportProfile: 'Denunciar esta conta', copied: 'Link copiado', shareFailed: 'Não foi possível compartilhar. Tente de novo.', verified: 'Oficial', back: 'Voltar', post: 'Publicação', postsCount: '{n} publicações', sharePost: 'Compartilhar publicação', reportPost: 'Denunciar publicação', copyLink: 'Copiar link', cancel: 'Cancelar', replyingTo: 'Respondendo a', publicLink: 'Criar link público', signIn: 'Entrar' },
  ar: { dm: 'رسالة', dmSoon: 'الرسائل الخاصة قريبًا. تابِعه الآن.', media: 'الوسائط', noMedia: 'لا توجد منشورات بوسائط بعد', joined: 'انضم في {date}', more: 'المزيد', shareProfile: 'مشاركة الملف الشخصي', reportProfile: 'الإبلاغ عن هذا الحساب', copied: 'تم نسخ الرابط', shareFailed: 'تعذّرت المشاركة. حاول مجددًا.', verified: 'رسمي', back: 'رجوع', post: 'منشور', postsCount: '{n} منشورات', sharePost: 'مشاركة المنشور', reportPost: 'الإبلاغ عن المنشور', copyLink: 'نسخ الرابط', cancel: 'إلغاء', replyingTo: 'ردًا على', publicLink: 'إنشاء رابط عام', signIn: 'تسجيل الدخول' },
  hi: { dm: 'संदेश', dmSoon: 'डायरेक्ट मैसेज जल्द आ रहे हैं। अभी फ़ॉलो करें।', media: 'मीडिया', noMedia: 'अभी मीडिया वाली कोई पोस्ट नहीं', joined: '{date} में जुड़े', more: 'और', shareProfile: 'प्रोफ़ाइल शेयर करें', reportProfile: 'इस खाते की रिपोर्ट करें', copied: 'लिंक कॉपी हुआ', shareFailed: 'शेयर नहीं हो सका। फिर कोशिश करें।', verified: 'आधिकारिक', back: 'वापस', post: 'पोस्ट', postsCount: '{n} पोस्ट', sharePost: 'पोस्ट शेयर करें', reportPost: 'पोस्ट की रिपोर्ट करें', copyLink: 'लिंक कॉपी करें', cancel: 'रद्द करें', replyingTo: 'जवाब दे रहे हैं', publicLink: 'सार्वजनिक लिंक बनाएँ', signIn: 'साइन इन' },
}

/* ── Shared pieces ── */

function XState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return <div className={c.state} role="status"><b>{title}</b>{body && <p>{body}</p>}{action}</div>
}

function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return <div aria-busy="true" aria-live="polite">{Array.from({ length: rows }, (_, index) => <div key={index} className={c.skel}><i /><div><i /><i /><i /></div></div>)}</div>
}

/** A post's photos; tapping one opens the viewer at that photo (2026-10-28), not the post. */
function Images({ images }: { images: string[]; onOpen?: () => void }) {
  const { locale } = useI18n()
  const [viewing, setViewing] = useState<number | null>(null)
  if (!images.length) return null
  const shown = images.slice(0, 4)
  const all = images.map((src) => mediaSrc(src) ?? src)
  const label = locale === 'zh-CN' ? { close: '关闭', photo: '照片' } : { close: 'Close', photo: 'Photo' }
  return <>
    <div className={c.media} data-count={shown.length}>{shown.map((src, i) => <button key={src} type="button" className={c.mediaBtn} aria-label={`${label.photo} ${i + 1}`} onClick={(event) => { event.stopPropagation(); setViewing(i) }}>
      <img src={mediaSrc(src) ?? undefined} alt="" loading="lazy" decoding="async" />
    </button>)}</div>
    {viewing !== null && <PhotoViewer images={all} start={viewing} label={label} onClose={() => setViewing(null)} />}
  </>
}

function Tags({ list, topics, locale }: { list: string[]; topics: CommunityTopic[]; locale: keyof typeof communityTopicCopy }) {
  if (!list.length) return null
  return <p className={c.tags}>{list.map((topic) => <span key={topic}>#{communityTopicTitle(topic, topics, locale)}</span>)}</p>
}

/** Like with X's pop: the wrapper marks a fresh tap so only the tap that turns it on animates (not a cached state). */
function Like(props: { postId: string; count: number; guest: boolean; onLogin: () => void; onChanged?: () => void; probe?: boolean; size: number; locale: string }) {
  const [pop, setPop] = useState(0)
  useEffect(() => { if (!pop) return; const timer = setTimeout(() => setPop(0), 600); return () => clearTimeout(timer) }, [pop])
  return <span className={c.likeWrap} data-pop={pop || undefined} onClickCapture={() => setPop(Date.now())}>
    <CommunityLike className={`${c.act} ${c.like}`} postId={props.postId} count={props.count} guest={props.guest} onLogin={props.onLogin} onChanged={props.onChanged} probe={props.probe} size={props.size} format={(value) => compact(props.locale, value)} />
  </span>
}

/** Bottom action sheet with dialog basics: focus moves in, Escape closes, Tab stays inside. */
function ActionSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null
    const sheet = ref.current
    sheet?.querySelector<HTMLElement>('button:not([disabled]), textarea')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !sheet) return
      const nodes = [...sheet.querySelectorAll<HTMLElement>('button:not([disabled]), textarea')]
      if (!nodes.length) return
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener.current?.focus?.() }
  }, [onClose])
  return <div className={c.scrim} onClick={onClose}>
    <div ref={ref} className={c.sheet} role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
      <i className={c.grab} aria-hidden="true" />
      {children}
    </div>
  </div>
}

type ReportTarget = { type: 'post' | 'profile'; id: string; title: string }
type MenuState = { target: ReportTarget; share?: () => void; step: 'menu' | 'report' | 'sending' | 'sent' | 'failed' }

/** "More" menu → report flow, shared by rows, the focused post and the member page. */
function useMoreMenu(isGuest: boolean, go: (screen: RwaScreen) => void) {
  const { t, locale } = useI18n()
  const p = profileCopy[locale]
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const close = useCallback(() => { setMenu(null); setReason(null); setDetails('') }, [])
  const reasons = [
    { key: 'spam', label: t('community.reportSpam') },
    { key: 'scam', label: t('community.reportScam') },
    { key: 'harass', label: t('community.reportHarass') },
    { key: 'other', label: t('community.reportOther') },
  ]
  const send = async () => {
    if (!menu || !reason || menu.step === 'sending') return
    setMenu({ ...menu, step: 'sending' })
    try {
      // Send the stable reason key, not the localized label, so moderators see one vocabulary.
      const text = details.trim() ? `${reason}: ${details.trim()}`.slice(0, 280) : reason
      await submitCommunityReport({ targetType: menu.target.type, targetId: menu.target.id, reason: text })
      setMenu((current) => current && { ...current, step: 'sent' })
    } catch {
      setMenu((current) => current && { ...current, step: 'failed' })
    }
  }
  const open = (target: ReportTarget, share?: () => void, step: MenuState['step'] = 'menu') => { setReason(null); setDetails(''); setMenu({ target, share, step }) }
  const sheet = menu && <ActionSheet label={menu.target.title} onClose={close}>
    {menu.step === 'menu' ? <>
      {menu.share && <button type="button" className={c.item} onClick={() => { const share = menu.share; close(); share?.() }}><Share2 size={20} strokeWidth={1.8} aria-hidden="true" />{menu.target.type === 'post' ? p.copyLink : p.shareProfile}</button>}
      <button type="button" className={c.item} onClick={() => isGuest ? go('login') : setMenu({ ...menu, step: 'report' })}><Flag size={20} strokeWidth={1.8} aria-hidden="true" />{menu.target.type === 'post' ? p.reportPost : p.reportProfile}</button>
      <div className={c.sheetActions}><button type="button" className={c.pill} onClick={close}>{p.cancel}</button></div>
    </> : menu.step === 'sent' ? <>
      <p className={c.sheetTitle} role="status">{t('community.reportThanks')}</p>
      <div className={c.sheetActions}><button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={close}>{t('common.back')}</button></div>
    </> : <>
      <p className={c.sheetTitle}>{t('community.reportTitle')}</p>
      {reasons.map((option) => <button key={option.key} type="button" className={c.item} aria-pressed={reason === option.key} onClick={() => setReason(option.key)}>{option.label}</button>)}
      <textarea className={c.field} rows={2} maxLength={200} placeholder={t('community.reportDetails')} value={details} onChange={(event) => setDetails(event.target.value)} />
      {menu.step === 'failed' && <p className={c.error} role="alert">{t('community.reportFailed')}</p>}
      <div className={c.sheetActions}>
        <button type="button" className={`${c.pill} ${c.pillSolid}`} disabled={!reason || menu.step === 'sending'} onClick={() => void send()}>{menu.step === 'sending' ? communityCopy[locale].sending : t('community.reportSubmit')}</button>
        <button type="button" className={c.pill} onClick={close}>{p.cancel}</button>
      </div>
    </>}
  </ActionSheet>
  return { open, sheet }
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
  const more = useMoreMenu(isGuest, go)
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 2800); return () => clearTimeout(timer) }, [notice])
  const login = () => go('login')
  const onReply = (post: CommunityPost) => { if (isGuest) { go('login'); return } setReply({ post, open: true }) }
  // Signed-in shares carry the sharer's invite code (same query key as the invite centre, so it is usually cached).
  const inviteCode = useQuery(isGuest ? null : 'referral:v2:me', referralMe, { staleTime: 300_000 }).data?.code
  const share = (path: string) => void sharePage(inviteLinkFor(path, inviteCode), navigator).then(result => {
    if (result === 'copied') setNotice({ text: p.copied })
    else if (result === 'failed') setNotice({ text: p.shareFailed, error: true })
  })
  const onShare = (post: CommunityPost) => share('/community/post/' + encodeURIComponent(post.id))
  const onMore = (post: CommunityPost) => more.open({ type: 'post', id: post.id, title: p.more }, () => onShare(post))
  const overlays = (me: ReturnType<typeof useCommunityMe>) => <>
    {!isGuest && reply && <CommunityCompose open={reply.open} onClose={() => setReply(current => current && { ...current, open: false })} target={{ kind: 'reply', postId: reply.post.id, handle: reply.post.author?.handle } satisfies ComposeTarget} me={me} onPublished={() => { onReplied?.(reply.post.id); setReply(current => current && { ...current, open: false }); setNotice({ text: communityCopy[locale].replied }) }} />}
    {more.sheet}
    {notice && <p className={c.toast} data-error={notice.error || undefined} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
  </>
  return { login, onReply, onShare, onMore, share, notify: setNotice, openMenu: more.open, overlays }
}

type RowActions = { guest: boolean; onLogin: () => void; onReply: (post: CommunityPost) => void; onShare: (post: CommunityPost) => void; onMore: (post: CommunityPost) => void }

/**
 * One X timeline row: 40px avatar column; name · badge · @handle · time · more; text; media; action bar.
 * The whole row opens the post (stretched link on the time); avatar, name and every bar button sit above it.
 */
function PostRow({ post, timeAgo, openPost, openProfile, topics = [], locale, index = 0, actions, relation }: { relation?: CircleMember['relation']; post: CommunityPost; timeAgo: (iso?: string | null) => string; openPost: (id: string) => void; openProfile?: (handle: string) => void; topics?: CommunityTopic[]; locale: keyof typeof communityTopicCopy; index?: number; actions: RowActions }) {
  const author = post.author
  const ui = communityUiCopy[locale]
  const p = profileCopy[locale]
  const toProfile = openProfile && author ? () => openProfile(author.handle || author.id) : undefined
  const when = timeAgo(post.publishedAt)
  const openLabel = communityExperienceCopy[locale].open
  const open = () => openPost(post.id)
  return (
    <li className={`${c.post} ${c.rise}`} style={{ '--i': index } as CSSProperties}>
      <div className={c.avatarCol}>
        {toProfile
          ? <button type="button" className={c.avatarBtn} aria-label={author?.displayName} onClick={toProfile}><Avatar author={author} /></button>
          : <Avatar author={author} />}
      </div>
      <div className={c.main}>
        <div className={c.who}>
          {toProfile ? <button type="button" className={c.name} dir="auto" onClick={toProfile}>{author?.displayName ?? '—'}</button> : <b className={c.name} dir="auto">{author?.displayName ?? '—'}</b>}
          {author?.kind === 'official' && <BadgeCheck className={c.badge} size={18} strokeWidth={2.2} role="img" aria-label={p.verified} />}
          {author?.handle && <span className={c.handle} dir="ltr">@{author.handle}</span>}
          {relation && <span className={c.relation}>{(circleCopy[locale] ?? circleCopy.en)[relation]}</span>}
          <span className={c.dot} aria-hidden="true">·</span>
          <button type="button" className={c.openPost} aria-label={when ? `${openLabel}, ${when}` : openLabel} onClick={open}>
            <time className={c.time} dateTime={post.publishedAt ?? undefined}>{when}</time>
          </button>
          <button type="button" className={`${c.circleBtn} ${c.rowMore}`} aria-label={p.more} aria-haspopup="dialog" onClick={() => actions.onMore(post)}><MoreHorizontal size={18} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>
        <CommunityText body={post.body} targetId={post.id} className={c.text} compact onOpen={open} lang={post.lang} />
        {post.proof && <CommunityProofCard proof={post.proof} locale={locale} />}
        <Images images={post.images} onOpen={open} />
        <Tags list={post.topics} topics={topics} locale={locale} />
        <div className={c.bar}>
          <button type="button" className={c.act} onClick={() => actions.onReply(post)}>
            <MessageCircle size={18.75} strokeWidth={1.8} aria-hidden="true" />
            <span aria-hidden="true">{post.commentCount > 0 ? compact(locale, post.commentCount) : ''}</span>
            <span className={c.srOnly}>{ui.reply} · {ui.replies} {post.commentCount}</span>
          </button>
          <Like postId={post.id} count={post.likeCount} guest={actions.guest} onLogin={actions.onLogin} size={18.75} locale={locale} />
          <span className={c.act}>
            <BarChart2 size={18.75} strokeWidth={1.8} aria-hidden="true" />
            <span aria-hidden="true">{post.viewCount > 0 ? compact(locale, post.viewCount) : ''}</span>
            <span className={c.srOnly}>{ui.views} {post.viewCount}</span>
          </span>
          <button type="button" className={c.act} aria-label={ui.share} onClick={() => actions.onShare(post)}><Share size={18} strokeWidth={1.8} aria-hidden="true" /></button>
        </div>
      </div>
    </li>
  )
}

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

/** Loads the next page when the end of the list scrolls into view (X has no "load more" button). */
function useInfinite(onReach: () => void, enabled: boolean, page: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef(onReach)
  latest.current = onReach
  useEffect(() => {
    const node = ref.current
    if (!node || !enabled || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) latest.current() }, { rootMargin: '600px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
    // A new observer per page reports the sentinel at once if it is still on screen (short pages keep loading).
  }, [enabled, page])
  return ref
}

/* ── Feed ── */

/** `embedded` renders the bare feed for a host that owns the page and bar (the AI screen's 社区 tab). */
/** My circle copy (2026-10-28). */
const circleCopy: Record<AppLocale, { tab: string; invited: string; inviter: string; emptyTitle: string; emptyBody: string; invite: string; visible: string; visibleNote: string }> = {
  en: { tab: 'Circle', invited: 'You invited', inviter: 'Invited you', emptyTitle: 'Your circle is empty', emptyBody: 'Invite friends; their posts show up here.', invite: 'Invite friends', visible: 'Show me in my inviter’s circle', visibleNote: 'Only your community name and avatar are shown.' },
  'zh-CN': { tab: '圈子', invited: '你邀请的', inviter: '邀请你的人', emptyTitle: '你的圈子还是空的', emptyBody: '邀请朋友加入，他们发的帖子会出现在这里。', invite: '去邀请', visible: '让邀请我的人在圈子里看到我', visibleNote: '只显示你的社区昵称和头像。' },
  hi: { tab: 'सर्कल', invited: 'आपने बुलाया', inviter: 'आपको बुलाया', emptyTitle: 'आपका सर्कल खाली है', emptyBody: 'दोस्तों को बुलाएँ; उनकी पोस्ट यहाँ दिखेंगी।', invite: 'दोस्तों को बुलाएँ', visible: 'मुझे बुलाने वाले के सर्कल में दिखाएँ', visibleNote: 'सिर्फ़ आपका समुदाय नाम और अवतार दिखेगा।' },
  es: { tab: 'Círculo', invited: 'Invitaste tú', inviter: 'Te invitó', emptyTitle: 'Tu círculo está vacío', emptyBody: 'Invita a amigos; sus publicaciones aparecerán aquí.', invite: 'Invitar amigos', visible: 'Mostrarme en el círculo de quien me invitó', visibleNote: 'Solo se ven tu nombre y avatar de la comunidad.' },
  ar: { tab: 'الدائرة', invited: 'دعوتَه', inviter: 'دعاك', emptyTitle: 'دائرتك فارغة', emptyBody: 'ادعُ أصدقاءك وستظهر منشوراتهم هنا.', invite: 'ادعُ أصدقاء', visible: 'أظهرني في دائرة من دعاني', visibleNote: 'يظهر اسمك وصورتك في المجتمع فقط.' },
  fr: { tab: 'Cercle', invited: 'Invité par vous', inviter: 'Vous a invité', emptyTitle: 'Votre cercle est vide', emptyBody: 'Invitez des amis ; leurs publications apparaîtront ici.', invite: 'Inviter des amis', visible: 'Me montrer dans le cercle de mon parrain', visibleNote: 'Seuls votre nom et votre avatar de la communauté sont visibles.' },
  pt: { tab: 'Círculo', invited: 'Você convidou', inviter: 'Convidou você', emptyTitle: 'Seu círculo está vazio', emptyBody: 'Convide amigos; as publicações deles aparecem aqui.', invite: 'Convidar amigos', visible: 'Mostrar-me no círculo de quem me convidou', visibleNote: 'Só seu nome e avatar da comunidade aparecem.' },
}

function CircleVisibility({ value, label, note, onChange }: { value: boolean; label: string; note: string; onChange: (value: boolean) => void }) {
  return <label className={`${c.circleVisible} ${mp.switchRow}`}>
    <input type="checkbox" role="switch" checked={value} onChange={(event) => onChange(event.target.checked)} />
    <span><b>{label}</b><small>{note}</small></span>
  </label>
}

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
  const [sort, setSort] = useState<'latest' | 'hot' | 'circle'>('hot')
  const [topic, setTopic] = useState<string | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [items, setItems] = useState<CommunityPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const requestVersion = useRef(0)
  const pageSort = useRef<'latest' | 'hot' | 'circle'>(sort)
  const [composing, setComposing] = useState(false)
  const me = useCommunityMe(isGuest)
  const chromeHidden = useScrollChrome()
  const ui = communityUiCopy[locale]
  const p = profileCopy[locale]
  const circleText = circleCopy[locale] ?? circleCopy.en
  // My circle (2026-10-28): who I invited / who invited me, for the tag on their posts and the circle timeline.
  const [circle, setCircle] = useState<{ members: CircleMember[]; showToInviter: boolean } | null>(null)
  useEffect(() => { if (isGuest) { setCircle(null); return } getCircle().then((data) => setCircle({ members: data?.members ?? [], showToInviter: data?.showToInviter !== false })).catch(() => undefined) }, [isGuest])
  const relations = new Map((circle?.members ?? []).map((member) => [member.profile.id, member.relation]))
  // My circle leads when there is one (2026-10-28): the people you invited come first.
  const tabs = [...(isGuest || embedded || !circle ? [] : [{ key: 'circle' as const, label: circleText.tab }]), { key: 'hot' as const, label: t('community.sortHot') }, { key: 'latest' as const, label: t('community.sortLatest') }]
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
        if (sort === 'circle') {
          const circlePage = await getCircleFeed({ limit: 20 })
          if (version !== requestVersion.current) return
          pageSort.current = 'circle'; setItems(circlePage.items ?? []); setNextCursor(circlePage.nextCursor ?? null)
          return
        }
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
    if (!nextCursor || loadingMore || moreFailed) return
    setLoadingMore(true)
    setMoreFailed(false)
    const version = requestVersion.current
    try {
      const page = pageSort.current === 'circle' ? await getCircleFeed({ cursor: nextCursor, limit: 20 }) : await getCommunityFeed({ sort: pageSort.current, topic: topic ?? undefined, cursor: nextCursor, limit: 20 })
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

  const pickSort = (next: 'latest' | 'hot' | 'circle') => { if (next === sort) { window.scrollTo({ top: 0, behavior: 'smooth' }); return } setSort(next) }

  const feed = (
    <div className={c.x} data-embedded={embedded || undefined} data-view={view} {...swipeHandlers}>
      {/* Reading down slides the top row away; the tabs stay pinned. A small upward scroll brings it back (X mobile). */}
      <header className={c.head} data-hidden={chromeHidden} data-glass-bar="">
        {!embedded && <div className={`${c.headRow} ${c.headRowTabs}`}>
          <div className={c.pageTabs} role="tablist" aria-label={t('nav.community')}>
            {([['feed', t('nav.community')], ['invite', invite.tab]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => pick(key)}>{label}</button>)}
          </div>
          {/* Compose lives in the header (2026-10-28): one floating thing per screen — the AI ball keeps its place and its
              unread count; the pen fades in on the feed and leaves on Invite. */}
          {!isGuest && <button type="button" className={c.inboxBtn} aria-label={p.dm} data-view={view} onClick={() => go('community-messages')}><Mail size={20} strokeWidth={1.9} aria-hidden="true" />{dmUnread > 0 && <i aria-hidden="true" />}</button>}
          {view === 'feed' && <button type="button" className={c.composeBtn} onClick={() => isGuest ? go('login') : setComposing(true)}><SquarePen size={18} strokeWidth={1.9} aria-hidden="true" /><span>{ui.compose}</span></button>}
          {isGuest
            ? <button type="button" className={c.signIn} onClick={() => go('login')}>{p.signIn}</button>
            : <button type="button" className={c.meBtn} aria-label={t('community.viewProfile')} onClick={() => go('profile')}>
              <CommunityAvatar avatarUrl={me?.avatarUrl} seed={me?.avatarSeed} handle={me?.handle ?? 'me'} size={38} />
            </button>}
        </div>}
        {/* One chip row (2026-10-28): how to sort (hot, latest, my circle), then the topics; tap a topic again to clear it. */}
        {view === 'feed' && <div className={c.topics} role="group" aria-label={ui.feed}>
          {tabs.map((option) => <button key={option.key} type="button" className={c.chip} aria-pressed={sort === option.key} onClick={() => pickSort(option.key)}>{option.label}</button>)}
          {sort !== 'circle' && topics.length > 0 && <>
            <i className={c.chipRule} aria-hidden="true" />
            {topics.map((entry) => <button key={entry.slug} type="button" className={`${c.chip} ${c.topicChip}`} aria-pressed={topic === entry.slug} onClick={() => setTopic(topic === entry.slug ? null : entry.slug)}>#{communityTopicTitle(entry.slug, topics, locale)}</button>)}
          </>}
        </div>}
      </header>
      {view === 'invite' ? (isGuest
        ? <XState title={invite.guest} body={invite.guestBody} action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => go('login')}>{p.signIn}</button>} />
        : <InviteCentre embedded />)
      : loading ? <SkeletonRows />
        : failed ? <XState title={communityCopy[locale].feedFailed} action={<button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => void load()}>{t('common.refresh')}</button>} />
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
      {view === 'feed' && sort === 'circle' && circle && !loading && <CircleVisibility value={circle.showToInviter} label={circleText.visible} note={circleText.visibleNote}
        onChange={(visible) => { setCircle({ ...circle, showToInviter: visible }); setCircleVisibility(visible).catch(() => setCircle({ ...circle, showToInviter: !visible })) }} />}
      {!isGuest && <CommunityCompose open={composing} onClose={() => setComposing(false)} target={{ kind: 'post', topic }} me={me} topics={topics} onPublished={openPost} />}
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
              {data.post.proof && <CommunityProofCard proof={data.post.proof} locale={locale} />}
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
