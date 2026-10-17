'use client'

import {
  BadgePercent, Bell, Check, ChevronRight, Copy, FileText, Fingerprint, Gift, Headphones, Info, KeyRound, Languages, LogOut, Mail,
  Monitor, Moon, QrCode, ReceiptText, RotateCw, ScrollText, Settings, ShieldAlert, ShieldCheck, Sun, Wallet,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useUnread } from '@/hooks/useUnread'
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

const kycTone = (state: KycState | undefined) => state === 'approved' ? 'live' : state === 'rejected' || state === 'expired' ? 'down' : state === 'needs_information' ? 'warn' : state ? 'accent' : undefined

type NavItem = { key: keyof typeof accountCopy.en.profile.rows; path: string; Icon: typeof Mail; badge?: ReactNode }

/** `/profile` — the signed-in account: identity plate, live status, grouped doors, sign-out. */
export function ProfileScreen({ guest = false, onClose, onSignedOut }: { guest?: boolean; onClose: () => void; onSignedOut: () => void }) {
  const { locale } = useI18n()
  const p = accountCopy[locale].profile
  const common = marketCopy[locale].common
  const session = useQuery(guest ? null : 'account:session', () => settle(getSessionView), { staleTime: 30_000 })
  const kyc = useQuery(guest ? null : 'account:kyc', () => settle(getKycStatus), { staleTime: 30_000 })
  const factors = useQuery(guest ? null : 'security:factors', listSecurityFactors, { staleTime: 30_000 })
  const [leaving, setLeaving] = useState(false)
  const { unread } = useUnread(!guest)
  const [leaveError, setLeaveError] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const copyId = async (userId: string) => {
    try { await navigator.clipboard.writeText(userId); setIdCopied(true); window.setTimeout(() => setIdCopied(false), 1600) } catch { setIdCopied(false) }
  }

  const view = session.data
  const label = view?.accountLabel?.trim() || null
  const kycState = kyc.data === undefined ? undefined : kyc.data?.state ?? 'not_started'
  const totp = factors.data?.totp.filter((item) => item.state === 'active').length ?? 0
  const passkeys = factors.data?.passkeys.filter((item) => item.state === 'active').length ?? 0
  const protectedSignIn = totp + passkeys > 0
  const securityText = !factors.data ? (factors.error ? p.unknown : '…') : !protectedSignIn ? p.securityNone
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

  const groups: { title: string; items: NavItem[] }[] = [
    { title: p.groups.identity, items: [
      { key: 'verification', path: '/profile/verification', Icon: Fingerprint, badge: kycState && <span className={s.badge} data-tone={kycTone(kycState)}>{p.kyc[kycState]}</span> },
      { key: 'security', path: '/profile/security', Icon: KeyRound, badge: factors.data && <span className={s.badge} data-tone={protectedSignIn ? 'live' : 'warn'}>{protectedSignIn ? String(totp + passkeys) : p.securityNone}</span> },
      { key: 'channels', path: '/trust/official-channels', Icon: ShieldCheck },
    ] },
    { title: p.groups.records, items: [
      { key: 'documents', path: '/profile/documents', Icon: FileText },
      { key: 'statements', path: '/assets/statements', Icon: ReceiptText },
      { key: 'fees', path: '/fees-and-limits', Icon: BadgePercent },
    ] },
    { title: p.groups.help, items: [
      { key: 'support', path: '/profile/support', Icon: Headphones },
      { key: 'scam', path: '/trust/report-scam', Icon: ShieldAlert },
      { key: 'trust', path: '/trust', Icon: ScrollText },
    ] },
    { title: p.groups.prefs, items: [
      { key: 'settings', path: '/profile/settings', Icon: Settings },
      { key: 'communication', path: '/profile/settings?section=marketing', Icon: Bell },
      { key: 'referral', path: '/profile/referral', Icon: Gift },
    ] },
  ]

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

  return <MaisonPage page="profile" topbar={<RwaTopbar screen="profile" title={p.title} onBack={onClose} badge={{ slot: 'R2', count: unread }} />}>
    {hero}

    {session.error && !view ? <StateBlock tone="error" title={common.errorGeneric} body={session.error.message} retry={session.refetch} retryLabel={common.retry} />
      : <Lacquer aria-live="polite">
        <div className={s.plate}>
          <span className={s.monogram} aria-hidden="true"><i />{(label ?? '·').trim().charAt(0).toUpperCase()}</span>
          <div className={s.plateMain}>
            <span className={s.kicker}>{p.plate}</span>
            {!view ? <Skeleton rows={1} /> : <>
              <b dir="auto">{label ?? p.unknown}</b>
            </>}
          </div>
          {view && view.authAdapter !== 'production' && <span className={s.badge} data-tone="warn">{p.demo}</span>}
        </div>
        {view && <div className={s.idRow}>
          <button type="button" className={s.idCopy} onClick={() => void copyId(view.userId)} aria-label={`${p.copyId}: ${view.userId}`}>
            <small>{p.userId}</small>
            <bdi dir="ltr" className={s.mono}>{view.userId}</bdi>
            <span className={s.idCopyHint} aria-live="polite">{idCopied ? <><Check size={12} aria-hidden="true" />{p.idCopied}</> : <><Copy size={12} aria-hidden="true" />{p.copyId}</>}</span>
          </button>
          <button type="button" className={s.idQr} onClick={() => openPath('/assets/cash/receive')} aria-label={p.receiveCode}><QrCode size={18} strokeWidth={1.6} /></button>
        </div>}
        <StatStrip fit items={[
          { label: p.email, value: !view ? '…' : view.emailVerified ? p.emailOk : p.emailNo, tone: view?.emailVerified ? 'up' : undefined },
          { label: p.identity, value: kycState ? p.kyc[kycState] : kyc.error ? p.unknown : '…', tone: kycState === 'approved' ? 'up' : kycState === 'rejected' || kycState === 'expired' ? 'down' : undefined },
          { label: p.security, value: securityText, tone: protectedSignIn ? 'up' : undefined },
        ]} />
        {view && <p className={s.plateFoot}><span className={s.liveDot} aria-hidden="true" />{fill(p.sessionEnds, { t: fmtDateTime(view.expiresAt, locale) })}</p>}
      </Lacquer>}

    {next === null ? <div className={s.notice} data-tone="info" role="status"><Check size={16} /><span>{p.allSet}</span></div>
      : next && <button type="button" className={s.nextStep} onClick={() => openPath(next.path)}>
        <span><small>{p.next}</small><b>{next.body}</b></span>
        <span className={s.nextGo}>{p.open}<ChevronRight size={15} /></span>
      </button>}

    {groups.map((group, index) => <div key={group.title}>
      <SectionHead index={String(index + 1).padStart(2, '0')} title={group.title} />
      <ul className={s.list} style={{ borderTop: 0 }}>{group.items.map(({ key, path, Icon, badge }) => <li key={key}>
        <button type="button" className={s.row} onClick={() => openPath(path)}>
          <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
          <span className={s.rowMain}><b>{p.rows[key].title}</b><small className={s.clamp2}>{p.rows[key].body}</small></span>
          <span className={s.rowEnd}>{badge}<ChevronRight size={16} className={s.chev} /></span>
        </button>
      </li>)}</ul>
    </div>)}

    <div className={s.actions}>
      <button type="button" className={s.ghost} onClick={() => void signOut()} disabled={leaving} aria-busy={leaving}>
        {leaving ? <RotateCw size={15} className={s.spin} /> : <LogOut size={15} />}{leaving ? p.signingOut : p.signOut}
      </button>
      {leaveError && <div className={s.notice} data-tone="error" role="alert"><Info size={16} /><span>{p.signOutFailed}</span></div>}
      <button type="button" className={s.link} style={{ justifySelf: 'center', color: 'var(--m-down)' }} onClick={() => openPath('/profile/close-account')}>{p.closeAccount}</button>
    </div>
  </MaisonPage>
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
