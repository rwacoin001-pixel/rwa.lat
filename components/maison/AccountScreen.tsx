'use client'

import { BadgePercent, Check, ChevronRight, Copy, Info, Languages, LogOut, Monitor, Moon, RotateCw, ScrollText, ShieldCheck, Sun, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { localeOptions } from '@/lib/app-locales'
import { useRwaTheme, type RwaThemePreference } from '@/lib/rwa-theme'
import { clearQueryCache, useQuery } from '@/lib/api/_query'
import { logout } from '@/lib/api/auth'
import { listSecurityFactors } from '@/lib/api/security'
import { listNetworks } from '@/lib/api/wallet'
import { getKycStatus, getSessionView, type KycState } from '@/lib/session-data'
import { FEE_SCHEDULE } from '@/lib/fee-schedule'
import { accountCopy } from '@/lib/maison-account-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { walletCopy } from '@/lib/maison-wallet-copy'
import { backOr, openPath, signInThenReturn } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, StatStrip } from './motion'
import { fmtAtomic, fmtDate, fmtDateTime, fmtDuration } from './format'
import { settle } from './settle'
import { KYC_REQUIRED } from '@/lib/kyc-policy'
import { NotificationPreferences } from './NotificationPreferences'
import { CommunityAvatar, mediaSrc } from '@/components/community-avatar'
import { CommunityProfileEditor, useCommunityMe } from '@/components/community-compose'
import type { CommunityProfileResponse } from '@/lib/community-data'
import { request } from '@/lib/api/_http'
import m from './me.module.css'
import { useUnread } from '@/hooks/useUnread'
import { getPortfolioSummary } from '@/lib/api/portfolio-summary'
import { referralMe, referralSummary } from '@/lib/api/referral'
import { fromAtomic } from '@/lib/money'

const kycTone = (state: KycState | undefined) => state === 'approved' ? 'live' : state === 'rejected' || state === 'expired' ? 'down' : state === 'needs_information' ? 'warn' : state ? 'accent' : undefined

/** `/profile` — the signed-in account: identity plate, live status, grouped doors, sign-out. */
export function ProfileScreen({ guest = false, onClose, onSignedOut }: { guest?: boolean; onClose: () => void; onSignedOut: () => void }) {
  const { locale } = useI18n()
  const p = accountCopy[locale].profile
  const common = marketCopy[locale].common
  const session = useQuery(guest ? null : 'account:session', () => settle(getSessionView), { staleTime: 30_000 })
  const kyc = useQuery(guest ? null : 'account:kyc', () => settle(getKycStatus), { staleTime: 30_000 })
  const factors = useQuery(guest ? null : 'security:factors', listSecurityFactors, { staleTime: 30_000 })
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const copyId = async (userId: string) => {
    try { await navigator.clipboard.writeText(userId); setIdCopied(true); window.setTimeout(() => setIdCopied(false), 1600) } catch { setIdCopied(false) }
  }

  const view = session.data
  const me = meCopy[locale] ?? meCopy.en
  const community = useCommunityMe(guest)
  const [editing, setEditing] = useState(false)
  const { preference } = useRwaTheme()
  const { unread } = useUnread(!guest)
  const portfolio = useQuery(guest ? null : 'portfolio:summary', getPortfolioSummary, { staleTime: 30_000 })
  const referral = useQuery(guest ? null : 'referral:summary', referralSummary, { staleTime: 60_000 })
  const inviteCode = useQuery(guest ? null : 'referral:v2:me', referralMe, { staleTime: 300_000 }).data?.code?.toUpperCase()
  const invited = referral.data ? referral.data.levels.find((level) => level.level === 1)?.count ?? 0 : undefined
  const statsQuery = useQuery(community?.identityConfigured && community.handle ? `community:profile:${community.handle}` : null, () => request<CommunityProfileResponse>(`/v1/community/profiles/${encodeURIComponent(community!.handle)}`, { token: null, loading: 'silent' }), { staleTime: 60_000 })
  const stats = statsQuery.data?.stats ?? null
  const avatarSrc = community?.avatarUrl ? mediaSrc(community.avatarUrl) : null
  const label = view?.accountLabel?.trim() || null
  const kycState = kyc.data === undefined ? undefined : kyc.data?.state ?? 'not_started'
  const totp = factors.data?.totp.filter((item) => item.state === 'active').length ?? 0
  const passkeys = factors.data?.passkeys.filter((item) => item.state === 'active').length ?? 0
  const protectedSignIn = totp + passkeys > 0
  const securityText = !factors.data ? (factors.error ? p.unknown : '…') : !protectedSignIn ? p.recommended
    : [totp ? p.totp : null, passkeys ? fill(p.passkeys, { n: passkeys }) : null].filter(Boolean).join(' · ')
  const nextKyc = KYC_REQUIRED && kycState ? p.nextKyc[kycState] : undefined
  const next = nextKyc ? { body: nextKyc, path: '/profile/verification' }
    : factors.data && !protectedSignIn ? { body: p.nextSecurity, path: '/profile/security' }
    : (!KYC_REQUIRED || kycState === 'approved') && protectedSignIn ? null : undefined

  const signOut = async () => {
    if (leaving) return
    setLeaving(true)
    setLeaveError(false)
    const result = await logout()
    window.sessionStorage.removeItem('rwa-selected-product')
    window.sessionStorage.removeItem('rwa-wallet-flow-mode')
    clearQueryCache()
    // The local session is cleared either way; only tell the user when the server did not confirm.
    if (!result.ok) { setLeaveError(true); await new Promise((resolve) => window.setTimeout(resolve, 1400)) }
    onSignedOut()
    openPath('/login', { replace: true })
  }

  const hero = <header className={s.hero}>
    <p className={s.kicker}>{p.kicker}</p>
    <h1 className={s.display}>{p.title}</h1>
    <p className={s.lede}>{p.lede}</p>
  </header>

  if (guest) return <MaisonPage page="profile" topbar={<RwaTopbar screen="profile" title={p.title} onBack={onClose} />}>
    {hero}
    <StateBlock tone="unavailable" title={p.signIn} body={p.guestBody}
      action={<button type="button" className={s.ghost} onClick={() => signInThenReturn('/profile')}>{p.signIn}<ChevronRight size={15} className={s.chev} /></button>} />
    <SectionHead index="01" title={p.groups.help} />
    <ul className={s.list} style={{ borderTop: 0 }}>{([['fees', '/fees-and-limits', BadgePercent], ['channels', '/trust/official-channels', ShieldCheck], ['trust', '/trust', ScrollText]] as const).map(([key, path, Icon]) => <li key={key}>
      <button type="button" className={s.row} onClick={() => openPath(path)}>
        <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
        <span className={s.rowMain}><b>{p.rows[key].title}</b><small className={s.clamp2}>{p.rows[key].body}</small></span>
        <span className={s.rowEnd}><ChevronRight size={16} className={s.chev} /></span>
      </button>
    </li>)}</ul>
  </MaisonPage>

  // "Me" (2026-10-28, second pass, docs/design-system.md §7.8): denser — every block carries live facts, not labels.
  // 1 the name card in one row (photo, name, @handle) with the four counts and the account's three checks as chips;
  // 2 the money at a glance (total, today, rewards waiting) with four keys; 3 single-line rows that show their value on
  // the right (status, unread, language and theme, invite code); 4 help as a 2×2 grid.
  const fmtAtomicN = (atomic: string | null | undefined, decimals: number, signed = false) => {
    if (atomic == null) return '—'
    try { const value = Number(fromAtomic(atomic, decimals)); return `${signed && value > 0 ? '+' : ''}${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}` } catch { return '—' }
  }
  const kycText = kycState ? (kycState === 'not_started' && !KYC_REQUIRED ? p.optional : p.kyc[kycState]) : kyc.error ? p.unknown : '…'
  const counts = [
    { n: stats?.postCount, label: me.posts, path: community?.handle ? `/community/member/${encodeURIComponent(community.handle)}` : null },
    { n: stats?.followerCount, label: me.followers, path: null },
    { n: stats?.followingCount, label: me.following, path: null },
    { n: invited, label: me.invited, path: '/community?tab=invite' },
  ]
  const rows: { key: string; title: string; path: string; value?: ReactNode }[][] = [
    [
      { key: 'verification', title: p.rows.verification.title, path: '/profile/verification', value: kycState && <span className={s.badge} data-tone={kycState === 'not_started' && !KYC_REQUIRED ? undefined : kycTone(kycState)}>{kycText}</span> },
      { key: 'security', title: p.rows.security.title, path: '/profile/security', value: factors.data && <span className={m.value}>{securityText}</span> },
      { key: 'notifications', title: accountCopy[locale].settings.notifications, path: '/notifications', value: unread > 0 ? <span className={m.count}>{unread}</span> : <span className={m.value}>{me.noneUnread}</span> },
      { key: 'settings', title: p.rows.settings.title, path: '/profile/settings', value: <span className={m.value}>{localeOptions.find((o) => o.code === locale)?.label} · {accountCopy[locale].settings.themes[preference].title}</span> },
      { key: 'communication', title: p.rows.communication.title, path: '/profile/settings?section=marketing' },
    ],
    [
      { key: 'referral', title: p.rows.referral.title, path: '/community?tab=invite', value: inviteCode ? <bdi className={m.code} dir="ltr">{inviteCode}</bdi> : undefined },
      { key: 'documents', title: p.rows.documents.title, path: '/profile/documents' },
      { key: 'statements', title: p.rows.statements.title, path: '/assets/statements' },
      { key: 'fees', title: p.rows.fees.title, path: '/fees-and-limits' },
    ],
  ]
  const help = (['support', 'channels', 'scam', 'trust'] as const).map((key) => ({ key, path: { support: '/profile/support', channels: '/trust/official-channels', scam: '/trust/report-scam', trust: '/trust' }[key] }))

  return <MaisonPage page="profile" topbar={<RwaTopbar screen="profile" title={me.title} onBack={onClose} />}>
    <section className={m.id} aria-label={me.card}>
      <div className={m.idTop}>
        <button type="button" className={m.who} disabled={!community?.identityConfigured} onClick={() => community?.handle && openPath(`/community/member/${encodeURIComponent(community.handle)}`)} aria-label={me.publicPage}>
          <span className={m.avatar}>{community ? <CommunityAvatar avatarUrl={community.avatarUrl} seed={community.avatarSeed} handle={community.handle || 'me'} size={56} /> : <span className={m.avatarEmpty} />}</span>
          <span className={m.names}>
            {!community ? <Skeleton rows={1} /> : <>
              <b className={m.name} dir="auto">{community.identityConfigured ? community.displayName : label ?? p.unknown}</b>
              <small className={m.handle} dir="ltr">{community.identityConfigured ? `@${community.handle}` : me.setupBody}</small>
            </>}
          </span>
        </button>
        <button type="button" className={community?.identityConfigured ? m.edit : m.editInk} onClick={() => setEditing(true)}>{community?.identityConfigured ? me.editShort : me.setup}</button>
      </div>
      {community?.identityConfigured && community.bio && <p className={m.bio} dir="auto">{community.bio}</p>}
      <dl className={m.counts}>{counts.map(({ n, label: countLabel, path }) => <div key={countLabel}>
        {path ? <button type="button" onClick={() => openPath(path)}><dd>{n ?? '—'}</dd><dt>{countLabel}</dt></button> : <><dd>{n ?? '—'}</dd><dt>{countLabel}</dt></>}
      </div>)}</dl>
      {session.error && !view ? <StateBlock tone="error" title={common.errorGeneric} body={session.error.message} retry={session.refetch} retryLabel={common.retry} />
        : <div className={m.chips} aria-label={me.account}>
          <span data-ok={view?.emailVerified || undefined}>{view?.emailVerified && <Check size={12} strokeWidth={2.4} aria-hidden="true" />}{p.email} {!view ? '…' : view.emailVerified ? p.emailOk : p.emailNo}</span>
          <span data-ok={kycState === 'approved' || undefined}>{kycState === 'approved' && <Check size={12} strokeWidth={2.4} aria-hidden="true" />}{p.identity} {kycText}</span>
          <span data-ok={protectedSignIn || undefined}>{protectedSignIn && <Check size={12} strokeWidth={2.4} aria-hidden="true" />}{p.security} {securityText}</span>
          {view && <button type="button" onClick={() => void copyId(view.userId)} aria-label={`${p.copyId}: ${view.userId}`}>
            ID <bdi dir="ltr">{view.userId.length > 12 ? `${view.userId.slice(0, 4)}…${view.userId.slice(-4)}` : view.userId}</bdi>{idCopied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          </button>}
        </div>}
      {view && view.authAdapter !== 'production' && <p className={m.demo}>{p.demo}</p>}
    </section>
    {community && <CommunityProfileEditor open={editing} onOpenChange={setEditing} me={community} onSaved={() => setEditing(false)} />}

    <section className={m.money} aria-label={me.assets}>
      <button type="button" className={m.moneyTop} onClick={() => openPath('/assets')}>
        <span><small>{me.assets} · USDT</small><b>{portfolio.data ? fmtAtomicN(portfolio.data.totalAtomic, portfolio.data.decimals) : portfolio.error ? '—' : '…'}</b></span>
        <ChevronRight size={16} className={s.chev} aria-hidden="true" />
      </button>
      <dl className={m.moneyFacts}>
        <div><dt>{me.today}</dt><dd data-tone={portfolio.data?.today ? (Number(portfolio.data.today.changeAtomic) > 0 ? 'up' : Number(portfolio.data.today.changeAtomic) < 0 ? 'down' : undefined) : undefined}>{portfolio.data?.today ? fmtAtomicN(portfolio.data.today.changeAtomic, portfolio.data.decimals, true) : '—'}</dd></div>
        <div><dt>{me.rewards}</dt><dd>{referral.data ? fmtAtomicN(referral.data.balances.available, referral.data.decimals) : '—'}</dd></div>
      </dl>
      <div className={m.keys}>
        {([['deposit', '/assets/cash/deposit'], ['withdraw', '/assets/cash/withdraw'], ['activity', '/assets/activity'], ['inviteKey', '/community?tab=invite']] as const).map(([key, path]) =>
          <button key={key} type="button" onClick={() => openPath(path)}>{me[key]}</button>)}
      </div>
    </section>

    {next && <button type="button" className={s.nextStep} onClick={() => openPath(next.path)}>
      <span><small>{p.next}</small><b>{next.body}</b></span>
      <span className={s.nextGo}>{p.open}<ChevronRight size={15} /></span>
    </button>}

    {rows.map((group, index) => <ul key={index} className={m.group}>{group.map(({ key, title, path, value }) => <li key={key}>
      <button type="button" className={m.line} onClick={() => openPath(path)}>
        <b>{title}</b><span className={m.lineEnd}>{value}<ChevronRight size={16} className={s.chev} aria-hidden="true" /></span>
      </button>
    </li>)}</ul>)}

    <h2 className={m.groupTitle}>{p.groups.help}</h2>
    <div className={m.help}>{help.map(({ key, path }) => <button key={key} type="button" onClick={() => openPath(path)}>
      <b>{p.rows[key].title}</b><small>{p.rows[key].body}</small>
    </button>)}</div>

    <div className={s.actions}>
      <button type="button" className={s.ghost} onClick={() => void signOut()} disabled={leaving} aria-busy={leaving}>
        {leaving ? <RotateCw size={15} className={s.spin} /> : <LogOut size={15} />}{leaving ? p.signingOut : p.signOut}
      </button>
      {leaveError && <div className={s.notice} data-tone="error" role="alert"><Info size={16} /><span>{p.signOutFailed}</span></div>}
    </div>
  </MaisonPage>
}

/** "Me" page copy (2026-10-28). */
const meCopy: Record<string, { invited: string; editShort: string; noneUnread: string; assets: string; today: string; rewards: string; deposit: string; withdraw: string; activity: string; inviteKey: string; title: string; card: string; followers: string; following: string; posts: string; publicPage: string; edit: string; setup: string; setupBody: string; account: string }> = {
  en: { invited: 'invited', editShort: 'Edit', noneUnread: 'All read', assets: 'Total assets', today: 'Today', rewards: 'Rewards to claim', deposit: 'Deposit', withdraw: 'Withdraw', activity: 'Activity', inviteKey: 'Invite', title: 'Me', card: 'Community card', followers: 'followers', following: 'following', posts: 'posts', publicPage: 'My public page', edit: 'Edit profile', setup: 'Set up my card', setupBody: 'Pick a name and photo for Community.', account: 'Account' },
  'zh-CN': { invited: '邀请', editShort: '编辑', noneUnread: '已读完', assets: '总资产', today: '今日', rewards: '待领奖励', deposit: '充值', withdraw: '提现', activity: '记录', inviteKey: '邀请', title: '我', card: '社区名片', followers: '关注者', following: '正在关注', posts: '帖子', publicPage: '我的主页', edit: '编辑资料', setup: '设置我的名片', setupBody: '给社区设置一个昵称和头像。', account: '账户' },
  hi: { invited: 'आमंत्रित', editShort: 'बदलें', noneUnread: 'सब पढ़ा', assets: 'कुल संपत्ति', today: 'आज', rewards: 'दावा योग्य इनाम', deposit: 'जमा', withdraw: 'निकासी', activity: 'गतिविधि', inviteKey: 'आमंत्रण', title: 'मैं', card: 'समुदाय कार्ड', followers: 'फ़ॉलोअर', following: 'फ़ॉलो कर रहे', posts: 'पोस्ट', publicPage: 'मेरा पेज', edit: 'प्रोफ़ाइल बदलें', setup: 'मेरा कार्ड बनाएँ', setupBody: 'समुदाय के लिए नाम और फ़ोटो चुनें।', account: 'खाता' },
  es: { invited: 'invitados', editShort: 'Editar', noneUnread: 'Todo leído', assets: 'Activos totales', today: 'Hoy', rewards: 'Recompensas por cobrar', deposit: 'Depositar', withdraw: 'Retirar', activity: 'Actividad', inviteKey: 'Invitar', title: 'Yo', card: 'Tarjeta de la comunidad', followers: 'seguidores', following: 'siguiendo', posts: 'publicaciones', publicPage: 'Mi página', edit: 'Editar perfil', setup: 'Crear mi tarjeta', setupBody: 'Elige un nombre y una foto para la comunidad.', account: 'Cuenta' },
  ar: { invited: 'مدعوون', editShort: 'تعديل', noneUnread: 'كلها مقروءة', assets: 'إجمالي الأصول', today: 'اليوم', rewards: 'مكافآت للمطالبة', deposit: 'إيداع', withdraw: 'سحب', activity: 'السجل', inviteKey: 'دعوة', title: 'أنا', card: 'بطاقة المجتمع', followers: 'متابِع', following: 'يتابع', posts: 'منشورات', publicPage: 'صفحتي', edit: 'تعديل الملف', setup: 'أنشئ بطاقتي', setupBody: 'اختر اسمًا وصورة للمجتمع.', account: 'الحساب' },
  fr: { invited: 'invités', editShort: 'Modifier', noneUnread: 'Tout lu', assets: 'Actifs totaux', today: 'Aujourd’hui', rewards: 'Récompenses à réclamer', deposit: 'Déposer', withdraw: 'Retirer', activity: 'Activité', inviteKey: 'Inviter', title: 'Moi', card: 'Carte communauté', followers: 'abonnés', following: 'abonnements', posts: 'publications', publicPage: 'Ma page', edit: 'Modifier le profil', setup: 'Créer ma carte', setupBody: 'Choisissez un nom et une photo pour la communauté.', account: 'Compte' },
  pt: { invited: 'convidados', editShort: 'Editar', noneUnread: 'Tudo lido', assets: 'Ativos totais', today: 'Hoje', rewards: 'Recompensas a resgatar', deposit: 'Depositar', withdraw: 'Sacar', activity: 'Atividade', inviteKey: 'Convidar', title: 'Eu', card: 'Cartão da comunidade', followers: 'seguidores', following: 'seguindo', posts: 'publicações', publicPage: 'Minha página', edit: 'Editar perfil', setup: 'Criar meu cartão', setupBody: 'Escolha um nome e uma foto para a comunidade.', account: 'Conta' },
}

const THEMES: { value: RwaThemePreference; Icon: typeof Sun }[] = [{ value: 'light', Icon: Sun }, { value: 'dark', Icon: Moon }, { value: 'system', Icon: Monitor }]

/** `/profile/settings` — local appearance and server-backed communication preferences. */
export function SettingsScreen() {
  const { locale, setLocale } = useI18n()
  const t = accountCopy[locale].settings
  const { theme, preference, setTheme } = useRwaTheme()
  const [saved, setSaved] = useState<'language' | 'theme' | null>(null)
  const pickLocale = (code: typeof localeOptions[number]['code']) => { setLocale(code); setSaved('language') }
  const pickTheme = (value: RwaThemePreference) => { setTheme(value); setSaved('theme') }

  return <MaisonPage page="settings" topbar={<RwaTopbar screen="settings" title={t.title} onBack={() => backOr('/profile')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    <SectionHead index="01" title={t.language} note={t.languageNote} action={saved === 'language' ? <span className={s.savedTag} role="status"><Check size={12} />{t.saved}</span> : <Languages size={16} className={s.muted} aria-hidden="true" />} />
    <div className={s.langGrid} role="radiogroup" aria-label={t.language}>
      {localeOptions.map((option) => <button key={option.code} type="button" role="radio" aria-checked={option.code === locale} lang={option.code} dir={option.direction} onClick={() => pickLocale(option.code)}>
        <b>{option.label}</b><small className={s.mono}>{option.code}{option.direction === 'rtl' ? ' · RTL' : ''}</small>
      </button>)}
    </div>

    <SectionHead index="02" title={t.appearance} note={t.appearanceNote} action={saved === 'theme' ? <span className={s.savedTag} role="status"><Check size={12} />{t.saved}</span> : undefined} />
    <div className={s.themeGrid} role="radiogroup" aria-label={t.appearance}>
      {THEMES.map(({ value, Icon }) => <button key={value} type="button" role="radio" aria-checked={preference === value} data-swatch={value} onClick={() => pickTheme(value)}>
        <span className={s.swatch} aria-hidden="true"><i /><i /><i /></span>
        <b><Icon size={13} />{t.themes[value].title}</b>
        <small>{t.themes[value].body}</small>
      </button>)}
    </div>
    <p className={s.foot}><span>{fill(t.showing, { name: t.themes[theme].title })}</span></p>

    <SectionHead index="03" title={t.notifications} note={t.notificationsNote} />
    <NotificationPreferences />

    <SectionHead index="04" title={t.currency} note={t.currencyNote} />
    <div className={s.row} data-static="true" style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}>
      <span className={s.logo}><Wallet size={16} strokeWidth={1.7} /></span>
      <span className={s.rowMain}><b>{t.currencyValue}</b><small className={s.clamp2}>{t.currencyBody}</small></span>
      <span className={s.rowEnd}><Check size={16} className={s.up} /></span>
    </div>

    <p className={s.foot}><Info size={12} /><span>{t.storage}</span></p>

    <div className={s.dangerZone}>
      <button type="button" className={s.link} onClick={() => openPath('/profile/close-account')}>{accountCopy[locale].profile.closeAccount}</button>
    </div>
  </MaisonPage>
}

const pct = (value: number, locale: string) => new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const usdt = (value: number, locale: string) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} USDT`
const liveAtomic = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? value : null

function Source({ live, label }: { live?: boolean; label: string }) {
  return <span className={s.srcTag} data-live={live || undefined}>{live && <i aria-hidden="true" />}{label}</span>
}

/** `/fees-and-limits` — the published schedule (version-tagged) beside live network policy from the server. */
export function FeesScreen() {
  const { locale } = useI18n()
  const t = accountCopy[locale].fees
  const c = walletCopy[locale].cash
  const common = marketCopy[locale].common
  const networks = useQuery('wallet:networks', listNetworks, { staleTime: 300_000 })
  const integration = networks.data?.integration
  const controls = integration?.withdrawalControls
  const schedule = FEE_SCHEDULE
  // 预测市场是 A+C 混合收费：下注费 + 派彩费，两者都必须披露，否则页面会低报实际成本。
  const orderRows: Array<{ key: 'default' | 'stocks' | 'prediction' | 'tbill'; rate: number; payout?: number }> = [
    { key: 'default', rate: schedule.order.default },
    { key: 'stocks', rate: schedule.order.stocks },
    { key: 'prediction', rate: schedule.order.prediction, payout: schedule.order.predictionPayout },
    { key: 'tbill', rate: schedule.order.tbill },
  ]
  const rowTotal = (row: { rate: number; payout?: number }) => row.rate + (row.payout ?? 0)
  const maxRate = Math.max(...orderRows.map(rowTotal))
  const mgmtRows = (['rwa', 'compute', 'stocks', 'prediction'] as const).map((key) => ({ key, rate: schedule.management[key] }))
  const dailyLive = liveAtomic(controls?.dailyLimitAtomic)
  const perTxLive = liveAtomic(controls?.perTransactionLimitAtomic)
  const scheduleTag = `${schedule.version} · ${fmtDate(`${schedule.updatedAt}T00:00:00Z`, locale)}`

  return <MaisonPage page="fees" topbar={<RwaTopbar screen="fees" title={t.title} onBack={() => backOr('/profile')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    <Lacquer>
      <span className={s.kicker}>{fill(t.version, { v: schedule.version, d: fmtDate(`${schedule.updatedAt}T00:00:00Z`, locale) })}</span>
      <p className={s.plateLine}>{t.binding}</p>
      <StatStrip fit items={[
        { label: t.trading, value: `${pct(Math.min(...orderRows.map(rowTotal)), locale)}–${pct(maxRate, locale)}` },
        { label: t.management, value: `0–${pct(Math.max(...mgmtRows.map((row) => row.rate)), locale)}` },
        { label: t.redemptionStd, value: pct(schedule.redemption.feeRate, locale) },
      ]} />
    </Lacquer>

    <SectionHead index="01" title={t.trading} note={t.tradingNote} action={<Source label={t.schedule} />} />
    <ul className={s.meters}>{orderRows.map((row) => <li key={row.key}>
      <span>{t.classes[row.key]}{row.payout ? ` · ${t.predictionSplit}` : ''}</span>
      <b className={s.num}>{pct(row.rate, locale)}{row.payout ? ` + ${pct(row.payout, locale)}` : ''}</b>
      <i aria-hidden="true" style={{ ['--v' as string]: rowTotal(row) / maxRate }} />
    </li>)}</ul>
    <p className={s.foot}><span>{fill(t.minFee, { v: usdt(schedule.order.minFeeUsdt, locale) })}</span></p>

    <SectionHead index="02" title={t.management} note={t.managementNote} action={<Source label={t.schedule} />} />
    <dl className={s.summary}>{mgmtRows.map((row) => <div key={row.key}>
      <dt>{t.mClasses[row.key]}</dt>
      <dd className={row.rate ? s.num : s.muted}>{row.rate ? `${pct(row.rate, locale)} ${t.perYear}` : t.none}</dd>
    </div>)}</dl>

    <SectionHead index="03" title={t.network} note={t.networkNote} action={<Source live label={t.live} />} />
    {integration && !integration.realFunds && <div className={s.notice} data-tone="info"><Info size={16} /><span><b>{c.testMode}</b> · {c.testModeBody}</span></div>}
    {networks.error && !networks.data ? <StateBlock tone="error" title={c.loadError} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} />
      : !networks.data ? <Skeleton rows={3} />
      : !networks.data.networks.length ? <StateBlock title={common.empty} />
      : <>
        <div className={s.tableHead} aria-hidden="true"><span>{c.network} · {c.eta}</span><span>{c.fee} · {c.minWithdraw}</span></div>
        <ul className={s.list}>{networks.data.networks.map((network) => <li key={network.id}>
          <div className={s.row} data-static="true" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
            <span className={s.rowMain}><b>{network.displayName} <span className={s.muted} style={{ fontWeight: 500 }}>{network.assetCode}</span></b>
              <small className={s.num}>{network.requiredConfirmations} {c.confirmations} · {fill(c.etaValue, { a: String(network.estimatedArrivalMinutes[0] ?? '—'), b: String(network.estimatedArrivalMinutes[1] ?? '—') })}</small></span>
            <span className={s.rowFig}><b className={s.num}>{fmtAtomic(network.withdrawalFeeAtomic, network.assetDecimals, network.assetCode)}</b>
              <small className={`${s.num} ${s.muted}`}>≥ {fmtAtomic(network.minimumWithdrawalAtomic, network.assetDecimals, network.assetCode)}</small></span>
          </div>
        </li>)}</ul>
      </>}

    <SectionHead index="04" title={t.limits} note={t.limitsNote} />
    <dl className={s.summary}>
      <div><dt>{t.minInvest}<small className={s.dtNote}>{t.minInvestNote}</small></dt><dd><span className={s.num}>{usdt(schedule.limits.minInvestmentUsdt, locale)}</span> <Source label={t.schedule} /></dd></div>
      <div><dt>{t.minWithdraw}</dt><dd>{networks.data ? <><span className={s.muted}>{t.perNetwork}</span> <Source live label={t.live} /></> : <><span className={s.num}>{usdt(schedule.limits.minWithdrawUsdt, locale)}</span> <Source label={t.schedule} /></>}</dd></div>
      <div><dt>{t.dailyMax}</dt><dd>{dailyLive ? <><span className={s.num}>{fmtAtomic(dailyLive, 6, 'USDT')}</span> <Source live label={t.live} /></> : <><span className={s.num}>{usdt(schedule.limits.maxDailyWithdrawUsdt, locale)}</span> <Source label={t.schedule} /></>}</dd></div>
      {perTxLive && <div><dt>{t.limits}</dt><dd><span className={s.num}>{fmtAtomic(perTxLive, 6, 'USDT')}</span> <Source live label={t.live} /></dd></div>}
    </dl>

    {controls && <>
      <SectionHead index="05" title={t.controls} note={t.controlsNote} action={<Source live label={t.live} />} />
      <dl className={s.summary}>
        <div><dt>{t.addressBook}</dt><dd>{controls.addressBookRequired ? t.yes : t.no}</dd></div>
        <div><dt>{t.addressCooldown}</dt><dd className={s.num}>{controls.addressCooldownSeconds ? fmtDuration(controls.addressCooldownSeconds) : t.none}</dd></div>
        <div><dt>{t.deviceCooldown}</dt><dd className={s.num}>{controls.newDeviceCooldownSeconds ? fmtDuration(controls.newDeviceCooldownSeconds) : t.none}</dd></div>
        <div><dt>{t.approvals}</dt><dd className={s.num}>{controls.approvalsRequired}</dd></div>
      </dl>
    </>}

    <SectionHead index={controls ? '06' : '05'} title={t.redemption} action={<Source label={t.schedule} />} />
    <dl className={s.summary}><div data-strong="true"><dt>{t.redemptionStd}</dt><dd className={s.num}>{pct(schedule.redemption.feeRate, locale)}</dd></div></dl>
    <p className={s.prose} style={{ marginTop: 6, fontSize: 12 }}>{t.redemptionBody}</p>

    <SectionHead index={controls ? '07' : '06'} title={t.notesTitle} />
    <ol className={s.notes}>{t.notes.map((note) => <li key={note}>{note}</li>)}</ol>
    <p className={s.foot}><span className={s.mono}>{scheduleTag}</span><span>{t.binding}</span></p>
  </MaisonPage>
}
