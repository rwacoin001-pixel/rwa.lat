'use client'

/** Shared community cards, actions and paging (2026-11-01). */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BadgeCheck, BarChart2, Flag, MessageCircle, MoreHorizontal, Share, Share2 } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { communityTopicCopy } from '@/lib/route-copy'
import { submitCommunityReport, type CircleMember, type CommunityAuthor, type CommunityPost, type CommunityTopic } from '@/lib/community-data'
import type { RwaScreen } from '@/lib/rwa-routes'
import { openPath } from '@/lib/maison-nav'
import { sharePage } from '@/lib/share-page'
import { useQuery } from '@/lib/api/_query'
import { referralMe } from '@/lib/api/referral'
import { inviteLinkFor } from '@/lib/referral-invite'
import { CommunityLike } from '../community-actions'
import { CommunityText } from '../community-text'
import { CommunityProofCard } from '../community-proof'
import { CommunityAvatar, mediaSrc } from '../community-avatar'
import { PhotoViewer } from '../community-photo-viewer'
import { CommunityCompose, useCommunityMe, type ComposeTarget } from '../community-compose'
import { communityCopy } from '@/lib/maison-content-copy'
import { communityUiCopy } from '@/lib/maison-community-ui-copy'
import { communityExperienceCopy } from '@/lib/community-experience-copy'
import c from '../community-x.module.css'

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

export function communityTopicTitle(topic: string, topics: CommunityTopic[], locale: keyof typeof communityTopicCopy): string {
  const direct = topics.find((entry) => entry.id === topic || entry.slug === topic)
  const slug = COMMUNITY_TOPIC_ID_TO_SLUG[topic] ?? topic
  if (COMMUNITY_TOPIC_FALLBACK_TITLES[locale][slug]) return COMMUNITY_TOPIC_FALLBACK_TITLES[locale][slug]
  if (direct?.title) return direct.title
  const bySlug = topics.find((entry) => entry.slug === slug)
  return bySlug?.title ?? COMMUNITY_TOPIC_FALLBACK_TITLES.en[slug] ?? topic
}

export function Avatar({ author, size = 40, className }: { author?: CommunityAuthor | null; size?: number; className?: string }) {
  return <CommunityAvatar avatarUrl={author?.avatarUrl} seed={author?.avatarSeed ?? author?.id} handle={author?.handle ?? 'anonymous'} size={size} className={className} />
}

export function useTimeAgo() {
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

export const compact = (locale: string, value: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)

type ProfileCopy = {
  dm: string; dmSoon: string; dmBlocked?: string; dmPolicy?: string; media: string; noMedia: string; joined: string; more: string; shareProfile: string; reportProfile: string
  copied: string; shareFailed: string; verified: string; back: string; post: string; postsCount: string; sharePost: string; reportPost: string
  copyLink: string; cancel: string; replyingTo: string; publicLink: string; signIn: string
}
export const profileCopy: Record<AppLocale, ProfileCopy> = {
  'zh-CN': { dm: '私信', dmSoon: '私信即将开放，先关注 TA 吧', dmBlocked: '你们之间有拉黑，无法私信。', dmPolicy: 'TA 只接收自己关注的人的私信。', media: '媒体', noMedia: '还没有带图的帖子', joined: '{date} 加入', more: '更多', shareProfile: '分享主页', reportProfile: '举报此用户', copied: '链接已复制', shareFailed: '分享失败，请稍后再试', verified: '官方认证', back: '返回', post: '帖子', postsCount: '{n} 条帖子', sharePost: '分享帖子', reportPost: '举报帖子', copyLink: '复制链接', cancel: '取消', replyingTo: '回复', publicLink: '生成公开链接', signIn: '登录' },
  en: { dm: 'Message', dmSoon: 'Direct messages are coming soon. Follow them for now.', dmBlocked: 'One of you has blocked the other.', dmPolicy: 'They only accept messages from people they follow.', media: 'Media', noMedia: 'No posts with media yet', joined: 'Joined {date}', more: 'More', shareProfile: 'Share profile', reportProfile: 'Report this account', copied: 'Link copied', shareFailed: 'Could not share. Try again.', verified: 'Official', back: 'Back', post: 'Post', postsCount: '{n} posts', sharePost: 'Share post', reportPost: 'Report post', copyLink: 'Copy link', cancel: 'Cancel', replyingTo: 'Replying to', publicLink: 'Create public link', signIn: 'Sign in' },
  es: { dm: 'Mensaje', dmSoon: 'Los mensajes directos llegarán pronto. De momento, síguele.', media: 'Multimedia', noMedia: 'Aún no hay publicaciones con imágenes', joined: 'Se unió en {date}', more: 'Más', shareProfile: 'Compartir perfil', reportProfile: 'Denunciar esta cuenta', copied: 'Enlace copiado', shareFailed: 'No se pudo compartir. Inténtalo de nuevo.', verified: 'Oficial', back: 'Atrás', post: 'Publicación', postsCount: '{n} publicaciones', sharePost: 'Compartir publicación', reportPost: 'Denunciar publicación', copyLink: 'Copiar enlace', cancel: 'Cancelar', replyingTo: 'En respuesta a', publicLink: 'Crear enlace público', signIn: 'Iniciar sesión' },
  fr: { dm: 'Message', dmSoon: 'Les messages privés arrivent bientôt. Abonnez-vous en attendant.', media: 'Médias', noMedia: 'Aucune publication avec média', joined: 'A rejoint en {date}', more: 'Plus', shareProfile: 'Partager le profil', reportProfile: 'Signaler ce compte', copied: 'Lien copié', shareFailed: 'Partage impossible. Réessayez.', verified: 'Officiel', back: 'Retour', post: 'Publication', postsCount: '{n} publications', sharePost: 'Partager la publication', reportPost: 'Signaler la publication', copyLink: 'Copier le lien', cancel: 'Annuler', replyingTo: 'En réponse à', publicLink: 'Créer un lien public', signIn: 'Se connecter' },
  pt: { dm: 'Mensagem', dmSoon: 'Mensagens diretas em breve. Siga por enquanto.', media: 'Mídia', noMedia: 'Ainda sem publicações com mídia', joined: 'Entrou em {date}', more: 'Mais', shareProfile: 'Compartilhar perfil', reportProfile: 'Denunciar esta conta', copied: 'Link copiado', shareFailed: 'Não foi possível compartilhar. Tente de novo.', verified: 'Oficial', back: 'Voltar', post: 'Publicação', postsCount: '{n} publicações', sharePost: 'Compartilhar publicação', reportPost: 'Denunciar publicação', copyLink: 'Copiar link', cancel: 'Cancelar', replyingTo: 'Respondendo a', publicLink: 'Criar link público', signIn: 'Entrar' },
  ar: { dm: 'رسالة', dmSoon: 'الرسائل الخاصة قريبًا. تابِعه الآن.', media: 'الوسائط', noMedia: 'لا توجد منشورات بوسائط بعد', joined: 'انضم في {date}', more: 'المزيد', shareProfile: 'مشاركة الملف الشخصي', reportProfile: 'الإبلاغ عن هذا الحساب', copied: 'تم نسخ الرابط', shareFailed: 'تعذّرت المشاركة. حاول مجددًا.', verified: 'رسمي', back: 'رجوع', post: 'منشور', postsCount: '{n} منشورات', sharePost: 'مشاركة المنشور', reportPost: 'الإبلاغ عن المنشور', copyLink: 'نسخ الرابط', cancel: 'إلغاء', replyingTo: 'ردًا على', publicLink: 'إنشاء رابط عام', signIn: 'تسجيل الدخول' },
  hi: { dm: 'संदेश', dmSoon: 'डायरेक्ट मैसेज जल्द आ रहे हैं। अभी फ़ॉलो करें।', media: 'मीडिया', noMedia: 'अभी मीडिया वाली कोई पोस्ट नहीं', joined: '{date} में जुड़े', more: 'और', shareProfile: 'प्रोफ़ाइल शेयर करें', reportProfile: 'इस खाते की रिपोर्ट करें', copied: 'लिंक कॉपी हुआ', shareFailed: 'शेयर नहीं हो सका। फिर कोशिश करें।', verified: 'आधिकारिक', back: 'वापस', post: 'पोस्ट', postsCount: '{n} पोस्ट', sharePost: 'पोस्ट शेयर करें', reportPost: 'पोस्ट की रिपोर्ट करें', copyLink: 'लिंक कॉपी करें', cancel: 'रद्द करें', replyingTo: 'जवाब दे रहे हैं', publicLink: 'सार्वजनिक लिंक बनाएँ', signIn: 'साइन इन' },
}

/* ── Shared pieces ── */

export function XState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return <div className={c.state} role="status"><b>{title}</b>{body && <p>{body}</p>}{action}</div>
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return <div aria-busy="true" aria-live="polite">{Array.from({ length: rows }, (_, index) => <div key={index} className={c.skel}><i /><div><i /><i /><i /></div></div>)}</div>
}

/** A post's photos; tapping one opens the viewer at that photo (2026-10-28), not the post. */
export function Images({ images }: { images: string[]; onOpen?: () => void }) {
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

export function Tags({ list, topics, locale }: { list: string[]; topics: CommunityTopic[]; locale: keyof typeof communityTopicCopy }) {
  if (!list.length) return null
  return <p className={c.tags}>{list.map((topic) => <span key={topic}>#{communityTopicTitle(topic, topics, locale)}</span>)}</p>
}

/** Like with X's pop: the wrapper marks a fresh tap so only the tap that turns it on animates (not a cached state). */
export function Like(props: { postId: string; count: number; guest: boolean; onLogin: () => void; onChanged?: () => void; probe?: boolean; size: number; locale: string }) {
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
type PostMenuAction = { label: string; run: () => void }
type MenuState = { action?: PostMenuAction; target: ReportTarget; share?: () => void; step: 'menu' | 'report' | 'sending' | 'sent' | 'failed' }

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
  const open = (target: ReportTarget, share?: () => void, step: MenuState['step'] = 'menu', action?: PostMenuAction) => { setReason(null); setDetails(''); setMenu({ target, share, step, action }) }
  const sheet = menu && <ActionSheet label={menu.target.title} onClose={close}>
    {menu.step === 'menu' ? <>
      {menu.action && <button type="button" className={c.item} onClick={() => { const action = menu.action; close(); action?.run() }}>{menu.action.label}</button>}
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
export function usePostActions(isGuest: boolean, go: (screen: RwaScreen) => void, locale: AppLocale, onReplied?: (postId: string) => void, postMenuAction?: (post: CommunityPost) => PostMenuAction | undefined) {
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
  const onMore = (post: CommunityPost) => more.open({ type: 'post', id: post.id, title: p.more }, () => onShare(post), 'menu', postMenuAction?.(post))
  const overlays = (me: ReturnType<typeof useCommunityMe>) => <>
    {!isGuest && reply && <CommunityCompose open={reply.open} onClose={() => setReply(current => current && { ...current, open: false })} target={{ kind: 'reply', postId: reply.post.id, handle: reply.post.author?.handle } satisfies ComposeTarget} me={me} onPublished={() => { onReplied?.(reply.post.id); setReply(current => current && { ...current, open: false }); setNotice({ text: communityCopy[locale].replied }) }} />}
    {more.sheet}
    {notice && <p className={c.toast} data-error={notice.error || undefined} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
  </>
  return { login, onReply, onShare, onMore, share, notify: setNotice, openMenu: more.open, overlays }
}

export type RowActions = { guest: boolean; onLogin: () => void; onReply: (post: CommunityPost) => void; onShare: (post: CommunityPost) => void; onMore: (post: CommunityPost) => void }

/**
 * One X timeline row: 40px avatar column; name · badge · @handle · time · more; text; media; action bar.
 * The whole row opens the post (stretched link on the time); avatar, name and every bar button sit above it.
 */
export function PostRow({ post, timeAgo, openPost, openProfile, topics = [], locale, index = 0, actions, relation }: { relation?: CircleMember['relation']; post: CommunityPost; timeAgo: (iso?: string | null) => string; openPost: (id: string) => void; openProfile?: (handle: string) => void; topics?: CommunityTopic[]; locale: keyof typeof communityTopicCopy; index?: number; actions: RowActions }) {
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
        {post.circle && <button type="button" className={c.circleSource} onClick={() => openPath(`/community/circle/${encodeURIComponent(post.circle!.id)}`)}>{locale === 'zh-CN' ? '来自圈子' : 'From circle'} · <span dir="auto">{post.circle.name}</span></button>}
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


/** Loads the next page when the end of the list scrolls into view (X has no "load more" button). */
export function useInfinite(onReach: () => void, enabled: boolean, page: unknown) {
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


export const circleCopy: Record<AppLocale, { tab: string; invited: string; inviter: string; emptyTitle: string; emptyBody: string; invite: string; visible: string; visibleNote: string }> = {
  en: { tab: 'Circle', invited: 'You invited', inviter: 'Invited you', emptyTitle: 'Your circle is empty', emptyBody: 'Invite friends; their posts show up here.', invite: 'Invite friends', visible: 'Show me in my inviter’s circle', visibleNote: 'Only your community name and avatar are shown.' },
  'zh-CN': { tab: '圈子', invited: '你邀请的', inviter: '邀请你的人', emptyTitle: '你的圈子还是空的', emptyBody: '邀请朋友加入，他们发的帖子会出现在这里。', invite: '去邀请', visible: '让邀请我的人在圈子里看到我', visibleNote: '只显示你的社区昵称和头像。' },
  hi: { tab: 'सर्कल', invited: 'आपने बुलाया', inviter: 'आपको बुलाया', emptyTitle: 'आपका सर्कल खाली है', emptyBody: 'दोस्तों को बुलाएँ; उनकी पोस्ट यहाँ दिखेंगी।', invite: 'दोस्तों को बुलाएँ', visible: 'मुझे बुलाने वाले के सर्कल में दिखाएँ', visibleNote: 'सिर्फ़ आपका समुदाय नाम और अवतार दिखेगा।' },
  es: { tab: 'Círculo', invited: 'Invitaste tú', inviter: 'Te invitó', emptyTitle: 'Tu círculo está vacío', emptyBody: 'Invita a amigos; sus publicaciones aparecerán aquí.', invite: 'Invitar amigos', visible: 'Mostrarme en el círculo de quien me invitó', visibleNote: 'Solo se ven tu nombre y avatar de la comunidad.' },
  ar: { tab: 'الدائرة', invited: 'دعوتَه', inviter: 'دعاك', emptyTitle: 'دائرتك فارغة', emptyBody: 'ادعُ أصدقاءك وستظهر منشوراتهم هنا.', invite: 'ادعُ أصدقاء', visible: 'أظهرني في دائرة من دعاني', visibleNote: 'يظهر اسمك وصورتك في المجتمع فقط.' },
  fr: { tab: 'Cercle', invited: 'Invité par vous', inviter: 'Vous a invité', emptyTitle: 'Votre cercle est vide', emptyBody: 'Invitez des amis ; leurs publications apparaîtront ici.', invite: 'Inviter des amis', visible: 'Me montrer dans le cercle de mon parrain', visibleNote: 'Seuls votre nom et votre avatar de la communauté sont visibles.' },
  pt: { tab: 'Círculo', invited: 'Você convidou', inviter: 'Convidou você', emptyTitle: 'Seu círculo está vazio', emptyBody: 'Convide amigos; as publicações deles aparecem aqui.', invite: 'Convidar amigos', visible: 'Mostrar-me no círculo de quem me convidou', visibleNote: 'Só seu nome e avatar da comunidade aparecem.' },
}
