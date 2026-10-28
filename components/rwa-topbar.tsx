'use client'

import { ChevronLeft, X, Moon, Sun, SlidersHorizontal, Search, Bell, Share2, Star, UserRound, Settings, MoreHorizontal, CircleHelp, Pencil, Calendar, ReceiptText, Download, Plus, UserPlus, CheckCheck, BookOpen, Info, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { revealTheme } from './maison/theme-reveal'
import { hasDefaultTopbarAction, topbarDestinations, rwaScreenTopbarKinds, slotsForScreen, type Slot, type TopbarKind, type SlotConfig } from '@/lib/rwa-topbar-config'
import { sharePage } from '@/lib/share-page'
import type { RwaScreen } from '@/lib/rwa-routes'
import { navigate } from '@/lib/routes'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useAccount, useSignedIn, type KycRing } from '@/hooks/useAccount'
import { expandChrome, useScrollChrome } from '@/hooks/useScrollChrome'
import { useLargeTitle } from '@/hooks/useLargeTitle'
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack'
import { Segmented } from './ui/Segmented'
import RwaLogoMark from './rwa-logo'
import {useCommunityMe} from '@/lib/use-community-me'
import {CommunityAvatar} from './community-avatar'
import { RwaLogo3D } from './brand/RwaLogo3D'
import LanguageMenu from './language-menu'
import { showToast } from '@/lib/toast-store'
export type { Slot }
export type TopbarCenter = { kind: 'title'; text: ReactNode } | { kind: 'segment'; items: string[]; value: number; onChange: (index: number) => void } | { kind: 'steps'; total: number; current: number } | null
export type RwaTopbarAction = { label: string; onClick: () => void; Icon?: LucideIcon; badge?: boolean; disabled?: boolean; busy?: boolean }
type Props = Partial<SlotConfig> & { screen?: RwaScreen; kind?: TopbarKind; title?: ReactNode; meta?: ReactNode; c?: TopbarCenter; onSlot?: (slot: Slot) => void; onBack?: () => void; onClose?: () => void; onProfile?: () => void; account?: boolean; action?: RwaTopbarAction; className?: string; /** A small extra control before the context slot (home: the get-app pill). */ extra?: ReactNode; /** Signed-in home: the solid, slowly turning mark instead of the flat one. */ logo3d?: boolean; badge?: { slot: 'R2' | 'R1'; count: number } }
const icons: Record<Exclude<Slot, null | 'logo' | 'language'>, LucideIcon> = { back: ChevronLeft, close: X, theme: Moon, filter: SlidersHorizontal, search: Search, bell: Bell, share: Share2, star: Star, avatar: UserRound, gear: Settings, more: MoreHorizontal, help: CircleHelp, edit: Pencil, calendar: Calendar, ledger: ReceiptText, export: Download, plus: Plus, follow: UserPlus, readall: CheckCheck, book: BookOpen, info: Info }
type TopbarCopy = { slots: Record<Exclude<Slot, null>, string>; account: string; signIn: string; steps: string; unread: string; themeTo: Record<'light' | 'dark', string>; ring: Record<Exclude<KycRing, null>, string> }
const topbarCopy: Record<AppLocale, TopbarCopy> = {
  en: { slots: { logo: 'Home', back: 'Back', close: 'Close', language: 'Language', theme: 'Theme', filter: 'Filter', search: 'Search', bell: 'Notifications', share: 'Share', star: 'Favorite', avatar: 'Account', gear: 'Settings', more: 'More', help: 'Help', edit: 'Post', calendar: 'Calendar', ledger: 'Transactions', export: 'Export', plus: 'Add', follow: 'Follow', readall: 'Mark all as read', book: 'Address book', info: 'Details' }, account: 'Profile', signIn: 'Sign in', themeTo: { light: 'Switch to warm', dark: 'Switch to cool' }, unread: '{n} unread', steps: 'Step {current} of {total}', ring: { approved: 'Verified', pending: 'Verification in review', attention: 'Verification needs attention' } },
  'zh-CN': { slots: { logo: '首页', back: '返回', close: '关闭', language: '语言', theme: '主题', filter: '筛选', search: '搜索', bell: '通知', share: '分享', star: '收藏', avatar: '账户', gear: '设置', more: '更多', help: '帮助', edit: '发布', calendar: '日历', ledger: '账单', export: '导出', plus: '新增', follow: '关注', readall: '全部已读', book: '地址簿', info: '说明' }, account: '个人中心', signIn: '登录', themeTo: { light: '切换到暖色', dark: '切换到冷色' }, unread: '{n} 条未读', steps: '第 {current} 步，共 {total} 步', ring: { approved: '已认证', pending: '认证审核中', attention: '认证需要处理' } },
  hi: { slots: { logo: 'होम', back: 'वापस', close: 'बंद करें', language: 'भाषा', theme: 'थीम', filter: 'फ़िल्टर', search: 'खोजें', bell: 'सूचनाएँ', share: 'साझा करें', star: 'पसंदीदा', avatar: 'खाता', gear: 'सेटिंग्स', more: 'और', help: 'सहायता', edit: 'पोस्ट करें', calendar: 'कैलेंडर', ledger: 'लेनदेन', export: 'निर्यात', plus: 'जोड़ें', follow: 'फ़ॉलो करें', readall: 'सभी पढ़ा हुआ चिह्नित करें', book: 'पता पुस्तिका', info: 'विवरण' }, account: 'प्रोफ़ाइल', signIn: 'लॉग इन', themeTo: { light: 'गर्म रंग पर जाएँ', dark: 'ठंडे रंग पर जाएँ' }, unread: '{n} अपठित', steps: 'चरण {current} / {total}', ring: { approved: 'सत्यापित', pending: 'सत्यापन समीक्षा में', attention: 'सत्यापन पर ध्यान दें' } },
  es: { slots: { logo: 'Inicio', back: 'Atrás', close: 'Cerrar', language: 'Idioma', theme: 'Tema', filter: 'Filtrar', search: 'Buscar', bell: 'Notificaciones', share: 'Compartir', star: 'Favorito', avatar: 'Cuenta', gear: 'Ajustes', more: 'Más', help: 'Ayuda', edit: 'Publicar', calendar: 'Calendario', ledger: 'Movimientos', export: 'Exportar', plus: 'Añadir', follow: 'Seguir', readall: 'Marcar todo como leído', book: 'Libreta de direcciones', info: 'Detalles' }, account: 'Perfil', signIn: 'Entrar', themeTo: { light: 'Cambiar a cálido', dark: 'Cambiar a frío' }, unread: '{n} sin leer', steps: 'Paso {current} de {total}', ring: { approved: 'Verificado', pending: 'Verificación en revisión', attention: 'La verificación requiere atención' } },
  ar: { slots: { logo: 'الرئيسية', back: 'رجوع', close: 'إغلاق', language: 'اللغة', theme: 'المظهر', filter: 'تصفية', search: 'بحث', bell: 'الإشعارات', share: 'مشاركة', star: 'المفضلة', avatar: 'الحساب', gear: 'الإعدادات', more: 'المزيد', help: 'المساعدة', edit: 'نشر', calendar: 'التقويم', ledger: 'المعاملات', export: 'تصدير', plus: 'إضافة', follow: 'متابعة', readall: 'تعليم الكل كمقروء', book: 'دفتر العناوين', info: 'التفاصيل' }, account: 'الملف الشخصي', signIn: 'دخول', themeTo: { light: 'التبديل إلى الدافئ', dark: 'التبديل إلى البارد' }, unread: '{n} غير مقروء', steps: 'الخطوة {current} من {total}', ring: { approved: 'موثّق', pending: 'التحقق قيد المراجعة', attention: 'التحقق يحتاج إلى إجراء' } },
  fr: { slots: { logo: 'Accueil', back: 'Retour', close: 'Fermer', language: 'Langue', theme: 'Thème', filter: 'Filtrer', search: 'Rechercher', bell: 'Notifications', share: 'Partager', star: 'Favori', avatar: 'Compte', gear: 'Paramètres', more: 'Plus', help: 'Aide', edit: 'Publier', calendar: 'Calendrier', ledger: 'Transactions', export: 'Exporter', plus: 'Ajouter', follow: 'Suivre', readall: 'Tout marquer comme lu', book: "Carnet d'adresses", info: 'Détails' }, account: 'Profil', signIn: 'Connexion', themeTo: { light: 'Passer au chaud', dark: 'Passer au froid' }, unread: '{n} non lus', steps: 'Étape {current} sur {total}', ring: { approved: 'Vérifié', pending: 'Vérification en cours', attention: 'Vérification à compléter' } },
  pt: { slots: { logo: 'Início', back: 'Voltar', close: 'Fechar', language: 'Idioma', theme: 'Tema', filter: 'Filtrar', search: 'Buscar', bell: 'Notificações', share: 'Compartilhar', star: 'Favorito', avatar: 'Conta', gear: 'Configurações', more: 'Mais', help: 'Ajuda', edit: 'Publicar', calendar: 'Calendário', ledger: 'Transações', export: 'Exportar', plus: 'Adicionar', follow: 'Seguir', readall: 'Marcar tudo como lido', book: 'Catálogo de endereços', info: 'Detalhes' }, account: 'Perfil', signIn: 'Entrar', themeTo: { light: 'Mudar para quente', dark: 'Mudar para frio' }, unread: '{n} não lidas', steps: 'Etapa {current} de {total}', ring: { approved: 'Verificado', pending: 'Verificação em análise', attention: 'A verificação requer atenção' } },
}
// Tab roots own the account entry; child, flow and tool pages keep a return-style bar.
const accountKinds = new Set<TopbarKind>(['home', 'tab-content', 'tab-asset'])
const noopSubscribe = () => () => {}
// Scroll-edge appearance: the bar is clear at the top of a page and turns to glass once content scrolls under it.
const subscribeScroll = (onChange: () => void) => { window.addEventListener('scroll', onChange, { passive: true }); return () => window.removeEventListener('scroll', onChange) }
const readScrolled = () => window.scrollY > 2
const shareCopy: Record<AppLocale, { copied: string; failed: string }> = {
  en: { copied: 'Link copied', failed: 'Could not share or copy the link. Try again.' },
  'zh-CN': { copied: '链接已复制', failed: '分享或复制失败，请重试。' },
  hi: { copied: 'लिंक कॉपी हुआ', failed: 'लिंक साझा या कॉपी नहीं हुआ। फिर प्रयास करें।' },
  es: { copied: 'Enlace copiado', failed: 'No se pudo compartir ni copiar el enlace. Reintenta.' },
  ar: { copied: 'تم نسخ الرابط', failed: 'تعذرت مشاركة الرابط أو نسخه. حاول مجددًا.' },
  fr: { copied: 'Lien copié', failed: 'Impossible de partager ou copier le lien. Réessayez.' },
  pt: { copied: 'Link copiado', failed: 'Não foi possível compartilhar ou copiar o link. Tente de novo.' },
}

function AccountButton({ copy, onProfile }: { copy: TopbarCopy; onProfile?: () => void }) {
  const { signedIn, initial, ring, userId } = useAccount()
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const me = useCommunityMe(!signedIn)
  const avatar = me?.avatarUrl ?? me?.avatarSeed
  if (hydrated && !signedIn) return <button type="button" className="rwa-topbar__signin" onClick={() => navigate({ id: 'auth.login' })}><span>{copy.signIn}</span></button>
  const label = [copy.account, ring && copy.ring[ring]].filter(Boolean).join(' · ')
  // The avatar keeps its verification ring; unread notices live above the AI composer.
  return <button type="button" className="rwa-profile-trigger rwa-topbar__account" data-ring={ring ?? 'none'} aria-label={label} title={copy.account} onClick={() => onProfile ? onProfile() : navigate({ id: 'profile' })}>
    {/* Seeded by the unique userId, never the nickname; the initial holds the disc until the avatar resolves. */}
    <span className="rwa-topbar__avatar-disc" data-avatar={avatar ? 'notionists' : 'initial'} data-seed={userId ?? undefined} aria-hidden="true">{avatar
      ? <CommunityAvatar avatarUrl={me?.avatarUrl} seed={me?.avatarSeed} size={38} />
      : initial ? <span className="rwa-topbar__initial">{initial}</span> : <UserRound size={22} strokeWidth={1.7} />}</span>
  </button>
}

export default function RwaTopbar(props: Props) {
  const { theme, toggleTheme } = useRwaTheme()
  const { locale } = useI18n()
  const copy = topbarCopy[locale]
  const signedIn = useSignedIn()
  const scrolled = useSyncExternalStore(subscribeScroll, readScrolled, () => false)
  // Every bar follows the Home rule: hidden while reading down, back on a small upward scroll or at the top.
  const chromeHidden = useScrollChrome()
  const config = { ...slotsForScreen(props.screen, props.kind), ...Object.fromEntries(Object.entries(props).filter(([key, value]) => ['template', 'l1', 'l2', 'r2', 'r1', 'surface', 'steps', 'hidden'].includes(key) && value !== undefined)) } as SlotConfig
  const sharing = useRef(false)
  useEffect(() => { expandChrome() }, [])
  const transparent = config.surface === 'transparent-over-media'
  const kind = props.kind ?? (props.screen ? rwaScreenTopbarKinds[props.screen] : undefined)
  // A pushed page (back button) never carries the account entry, even when its screen is a tab kind (wallet).
  // `account` opts a pushed page in explicitly (community: the avatar is its profile and edit entry).
  const showAccount = props.account ?? (Boolean(kind && accountKinds.has(kind)) && config.l1 !== 'back')
  const largeTitle = useLargeTitle(props.screen ?? props.title)
  const center: TopbarCenter = props.c !== undefined ? props.c : config.template === 'T-Flow' ? (props.title ? { kind: 'title', text: props.title } : null) : config.template === 'T-Root' && props.title === undefined ? null : { kind: 'title', text: props.title ?? '' }
  const onSlot = (slot: Slot, position: string, event?: { clientX: number; clientY: number; currentTarget: Element }) => {
    if (props.onSlot) { props.onSlot(slot); return }
    if (slot === 'theme') { revealTheme(toggleTheme, theme === 'dark' ? 'light' : 'dark', event); return }
    if (slot === 'back') { if(props.onBack) props.onBack(); else if(history.state?.rwaNavigation) history.back(); else navigate({id:'home'}); return }
    if (slot === 'close') { if(props.onClose) props.onClose(); else if(props.onBack) props.onBack(); else navigate({id:'home'}); return }
    if (props.action && position === 'R2') { if (!props.action.disabled && !props.action.busy) props.action.onClick(); return }
    if (slot === 'share') {
      if (sharing.current) return
      sharing.current = true
      void sharePage(location.href, navigator).then(result => {
        if (result === 'copied' || result === 'failed') showToast(shareCopy[locale][result], result === 'failed' ? 'error' : 'ok')
      }).finally(() => { sharing.current = false })
      return
    }
    if (slot && slot in topbarDestinations) navigate({ id: topbarDestinations[slot as keyof typeof topbarDestinations] })
  }
  const renderSlot = (slot: Slot, position: 'L1' | 'L2' | 'R2' | 'R1') => {
    const custom = props.action && position === 'R2'
    if (!slot && custom) slot = 'more'
    // Guests have no inbox; the sign-in entry replaces it.
    if (!slot || (!custom && !props.onSlot && !hasDefaultTopbarAction(slot)) || (!custom && slot === 'bell' && !signedIn && !props.onSlot)) return null
    if (slot === 'language') return <span className="rwa-topbar__slot rwa-topbar__slot--language" data-slot={position}><LanguageMenu variant="compact" /></span>
    if (slot === 'logo') return <button type="button" className="rwa-topbar__slot rwa-topbar__slot--logo rwa-sel" data-state="rest" data-slot={position} aria-label={copy.slots.logo} onClick={() => onSlot(slot, position)}><span className="rwa-topbar__brand">{props.logo3d ? <RwaLogo3D className="rwa-topbar__logo3d" /> : <RwaLogoMark className="rwa-topbar__logo" width="34" height="20" label="A-REIT" />}<span>A-REIT</span></span>{props.badge?.slot === position && props.badge.count > 0 && <span className="rwa-topbar__count">{props.badge.count}</span>}</button>
    const Icon = custom && props.action?.Icon ? props.action.Icon : icons[slot]
    return <button type="button" className="rwa-topbar__slot rwa-sel" data-state="rest" data-slot={position} disabled={custom ? props.action!.disabled || props.action!.busy : undefined} aria-busy={custom ? props.action!.busy : undefined} aria-label={custom ? props.action!.label : slot === 'theme' ? copy.themeTo[theme === 'dark' ? 'light' : 'dark'] : copy.slots[slot]} onClick={(event) => onSlot(slot, position, event)}>
      {slot === 'theme' ? theme === 'dark' ? <Sun size={22} strokeWidth={1.8} /> : <Moon size={21} strokeWidth={1.8} /> : Icon ? <Icon size={22} strokeWidth={slot === 'back' ? 2.2 : 1.8} /> : <RwaLogoMark width="32" height="22" label="A-REIT" />}
      {props.badge?.slot === position && props.badge.count > 0 && <span className="rwa-topbar__count">{props.badge.count > 99 ? '99+' : props.badge.count}</span>}
    </button>
  }
  // The edge swipe keeps a hidden bar's back or close action reachable. A pushed page (back or close) never hides its
  // bar on scroll (2026-10-29, user: pages with no way back): the way out is always on screen; only tab roots slide away.
  useEdgeSwipeBack(!config.hidden && (config.l1 === 'back' || config.l1 === 'close'), () => onSlot(config.l1, 'L1'))
  if (config.hidden) return null
  return <><header className={`rwa-topbar rwa-topbar--s1 ${props.className ?? ''}`} data-template={config.template} data-surface={transparent ? 'transparent-over-media' : 'solid'} data-scrolled={scrolled} data-chrome-hidden={chromeHidden && config.l1 !== 'back' && config.l1 !== 'close'} data-large-title={largeTitle} onFocusCapture={expandChrome}>
    <div className="rwa-topbar__grid">
      <div className="rwa-topbar__leading">{renderSlot(config.l1,'L1')}{renderSlot(config.l2,'L2')}</div>
      <div className="rwa-topbar__center">
      {center?.kind === 'title' && (transparent ? <span data-over-media="" aria-hidden="true">{center.text}</span> : <span>{center.text}</span>)}
      {center?.kind === 'segment' && <Segmented {...center} />}
      {center?.kind === 'steps' && <span className="rwa-steps" role="img" aria-label={copy.steps.replace('{current}', String(center.current + 1)).replace('{total}', String(center.total))}>{Array.from({ length: center.total }, (_, index) => <i key={index} data-current={index === center.current} />)}</span>}
      </div>
      <div className="rwa-topbar__context">{props.extra}{renderSlot(config.r2,'R2')}</div>
      <div className="rwa-topbar__utilities">
        {renderSlot(config.r1,'R1')}
        {showAccount && <AccountButton copy={copy} onProfile={props.onProfile} />}
      </div>
    </div>
  </header></>
}
