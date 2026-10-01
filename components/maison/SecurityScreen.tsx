'use client'

import {
  BadgeCheck, Check, ChevronRight, Copy, Fingerprint, History, Info, KeyRound, Laptop, LogOut, Plus, RotateCw, ShieldCheck, ShieldEllipsis, Smartphone, Trash2,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { clearSession, type ApiError, type ApiResult } from '@/lib/api/_http'
import { clearQueryCache, invalidate, useQuery } from '@/lib/api/_query'
import { logout } from '@/lib/api/auth'
import { changeAccountEmail, continueAuth, managePassword } from '@/lib/api/auth-flow'
import { securityEmailCopy } from '@/lib/security-email-copy'
import { authPasswordCopy } from '@/lib/auth-password-copy'
import {
  confirmTotpEnrollment, listDevices, listSessions, removePasskey, removeTotp, revokeDevice, revokeOtherSessions, revokeSession, startTotpEnrollment, trustCurrentDevice,
  type SecurityDevice, type SecuritySession, type TotpEnrollment,
} from '@/lib/api/account'
import { listSecurityEvents, listSecurityFactors, registerPasskey, type SecurityEventView } from '@/lib/api/security'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { securityCopy, type SecurityCopy } from '@/lib/maison-security-copy'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, Segmented, StatStrip } from './motion'
import { fmtDate, fmtDateTime } from './format'
import { useStepUp } from './StepUp'
import x from './security.module.css'

type Tab = 'methods' | 'devices' | 'sessions'
const TABS: Tab[] = ['methods', 'devices', 'sessions']
type Flash = { tone: 'info' | 'error'; text: string } | null
type Pending = { kind: 'passkey' | 'totp' | 'device' | 'session' | 'others'; id: string } | null

const setQuery = (name: string, value: string | null) => {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

const errorText = (error: ApiError) => `${error.status || '—'} · ${error.code}`
/** Base32 secret from an otpauth URI, grouped in fours for manual entry. */
const secretOf = (uri: string) => {
  try { return (new URL(uri).searchParams.get('secret') ?? '').replace(/(.{4})/g, '$1 ').trim() } catch { return '' }
}
const deviceIcon = (name: string) => /iphone|android|mobile|phone|ios/i.test(name) ? Smartphone : Laptop

/** Local sign-out after the server has already ended this session: same cleanup as the profile's sign-out. */
function leaveLocally(onSignedOut?: () => void) {
  clearSession()
  window.sessionStorage.removeItem('rwa-selected-product')
  window.sessionStorage.removeItem('rwa-wallet-flow-mode')
  clearQueryCache()
  onSignedOut?.()
  openPath('/login', { replace: true })
}

function ErrorBlock({ error, retry }: { error: ApiError; retry: () => void }) {
  const { locale } = useI18n()
  const common = marketCopy[locale].common
  return <StateBlock tone="error" title={common.errorGeneric} body={<span className={s.mono}>{errorText(error)}</span>} retry={retry} retryLabel={common.retry} />
}

function Confirm({ title, body, keep, go, busy, onKeep, onGo }: { title: string; body: string; keep: string; go: string; busy: boolean; onKeep: () => void; onGo: () => void }) {
  return <div className={s.confirm} role="alertdialog" aria-label={title}>
    <h2>{title}</h2>
    <p>{body}</p>
    <div className={s.ctaPair}>
      <button type="button" className={s.ghost} onClick={onKeep} disabled={busy}>{keep}</button>
      <button type="button" className={s.ghost} data-tone="down" onClick={onGo} disabled={busy} aria-busy={busy}>{busy ? <RotateCw size={14} className={s.spin} /> : <Trash2 size={14} />}{go}</button>
    </div>
  </div>
}

function FlashNote({ flash }: { flash: Flash }) {
  if (!flash) return null
  return <div className={s.notice} data-tone={flash.tone} role={flash.tone === 'error' ? 'alert' : 'status'}>
    {flash.tone === 'error' ? <Info size={16} /> : <BadgeCheck size={16} />}<span>{flash.text}</span>
  </div>
}

/** `/profile/security` — protection level on a credential card, then sign-in methods, devices and live sessions. */
export function SecurityScreen({ query = '', onSignedOut }: { query?: string; onSignedOut?: () => void }) {
  const { locale } = useI18n()
  const t = securityCopy[locale]
  const common = marketCopy[locale].common
  const initial = queryParam(query, 'tab') as Tab | null
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'methods')
  const factors = useQuery('security:factors', listSecurityFactors, { staleTime: 20_000 })
  const devices = useQuery('security:devices', listDevices, { staleTime: 20_000 })
  const sessions = useQuery('security:sessions', listSessions, { staleTime: 20_000 })
  const { run, sheet } = useStepUp()
  const [flash, setFlash] = useState<Flash>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [needsEmail, setNeedsEmail] = useState(false)
  const [bindingEmail, setBindingEmail] = useState('')
  const [emailEditor, setEmailEditor] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const emailText = securityEmailCopy[locale]

  const choose = (value: Tab) => { setTab(value); setFlash(null); setPending(null); setQuery('tab', value === 'methods' ? null : value) }
  const passkeys = (factors.data?.passkeys ?? []).filter((item) => item.state === 'active')
  const totp = factors.data?.totp.find((item) => item.state === 'active')
  const current = devices.data?.find((item) => item.isCurrent)
  const liveSessions = (sessions.data ?? []).filter((item) => item.state === 'active' || item.isCurrent)
  const checks = { passkey: passkeys.length > 0, totp: Boolean(totp), trust: current?.trustState === 'trusted' }
  const loaded = factors.data !== undefined && devices.data !== undefined
  const count = loaded ? Object.values(checks).filter(Boolean).length : 0
  const next = !loaded ? undefined
    : !checks.passkey ? { body: t.nextPasskey, tab: 'methods' as const }
    : !checks.totp ? { body: t.nextTotp, tab: 'methods' as const }
    : !checks.trust && current ? { body: t.nextTrust, tab: 'devices' as const }
    : null
  const firstError = factors.error && factors.data === undefined ? { error: factors.error, retry: factors.refetch }
    : devices.error && devices.data === undefined ? { error: devices.error, retry: devices.refetch } : null

  /** Runs one write, reports the real outcome and refreshes the lists it touched. */
  const act = async <T,>(key: string, action: () => Promise<ApiResult<T> | null>, done: (data: T) => string | void, refresh: string[]) => {
    if (busy) return
    setBusy(key)
    setFlash(null)
    const result = await action()
    setBusy(null)
    if (!result) return
    if (!result.ok) { setFlash({ tone: 'error', text: `${t.actionFailed} ${errorText(result.error)}` }); return }
    setPending(null)
    invalidate([...refresh, 'security:events'])
    const text = done(result.data)
    if (text) setFlash({ tone: 'info', text })
  }

  const addPasskey = async () => {
    if (busy) return
    setBusy('passkey:add')
    setFlash(null)
    const result = await registerPasskey()
    setBusy(null)
    if (result.ok) { invalidate(['security:factors', 'security:events']); setFlash({ tone: 'info', text: t.passkeyAdded }); return }
    setFlash({ tone: 'error', text: t.passkeyErrors[result.error.code] ?? `${t.actionFailed} ${errorText(result.error)}` })
  }

  const signOutHere = async () => {
    if (busy) return
    setBusy('session:current')
    await logout()
    leaveLocally(onSignedOut)
  }

  const panel = (id: Tab, children: ReactNode) => <div role="tabpanel" id={`security-${id}`} aria-label={t.tabs[id]} hidden={tab !== id} className={x.panel}>{children}</div>
  const levelTone = count >= 3 ? 'live' : count === 2 ? undefined : 'warn'

  return <MaisonPage page="security" topbar={<RwaTopbar screen="security" template="T-Child" l1="back" title={t.kicker} onBack={() => backOr('/profile')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.titleA} <em>{t.titleB}</em></h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    <Lacquer className={s.credential} aria-live="polite">
      <i className={s.guilloche} data-foil={count >= 3} aria-hidden="true" />
      <div className={s.credTop}>
        <span className={s.kicker}>{t.card}</span>
        <span className={s.credRing} style={{ ['--p' as string]: count / 3 } as CSSProperties} role="img" aria-label={fill(t.progress, { n: count })}>
          <b className={s.num}>{loaded ? count : '·'}<small>/3</small></b>
        </span>
      </div>
      <span className={x.shield} aria-hidden="true"><ShieldEllipsis size={22} strokeWidth={1.4} /></span>
      <div className={s.credMain}>
        <small>{loaded ? fill(t.progress, { n: count }) : t.card}</small>
        <b>{loaded ? t.levels[count] : firstError ? common.errorGeneric : '…'}</b>
        <span className={s.signal} data-tone={levelTone} aria-hidden="true">{[1, 2, 3, 4].map((bar) => <i key={bar} data-on={loaded && bar <= count + 1} />)}</span>
      </div>
      <StatStrip fit items={[
        { label: t.stats.passkeys, value: factors.data ? passkeys.length : factors.error ? '—' : '…', tone: checks.passkey ? 'up' : undefined },
        { label: t.stats.authenticator, value: factors.data ? (totp ? t.on : t.off) : factors.error ? '—' : '…', tone: checks.totp ? 'up' : undefined },
        { label: t.stats.sessions, value: sessions.data ? liveSessions.length : sessions.error ? '—' : '…' },
      ]} />
      <p className={s.credFoot}>
        <span>{t.levelNote}</span>
        {current && <span dir="auto">{t.thisDevice} · {current.name}</span>}
        {current && <span className={s.badge} data-tone={current.trustState === 'trusted' ? 'live' : undefined}>{t.trust[current.trustState] ?? current.trustState}</span>}
      </p>
    </Lacquer>

    {firstError && <div style={{ marginTop: 12 }}><ErrorBlock error={firstError.error} retry={firstError.retry} /></div>}

    {next === null ? <div className={s.notice} data-tone="info" role="status"><BadgeCheck size={16} /><span>{t.allSet}</span></div>
      : next && <button type="button" className={s.nextStep} onClick={() => choose(next.tab)}>
        <span><small>{t.next}</small><b>{next.body}</b></span>
        <span className={s.nextGo}>{t.open}<ChevronRight size={15} className={x.flip} /></span>
      </button>}

    <div className={x.tabs}>
      <Segmented value={tab} onChange={choose} label={t.kicker} sticky options={TABS.map((value) => ({ value, label: t.tabs[value] }))} />
    </div>
    <FlashNote flash={flash} />

    {panel('methods', <>
      <SectionHead index="00" title={emailText.title} action={<button type="button" className={s.ghost} data-size="s"
        disabled={Boolean(busy)} onClick={() => setEmailEditor(value => !value)}>{emailEditor ? emailText.cancel : emailText.change}</button>} />
      {emailEditor && <form onSubmit={async event => {
        event.preventDefault()
        if (busy) return
        setBusy('email'); setFlash(null)
        try {
          const result = await run(true, r => changeAccountEmail(newEmail.trim(), r ?? ''))
          if (result && !result.ok && !continueAuth(result.error)) setFlash({ tone: 'error', text: emailText.unavailable })
        } finally { setBusy(null) }
      }}>
        <label className={s.field}><span>{emailText.newEmail}</span><input type="email" required maxLength={254} autoComplete="email"
          value={newEmail} onChange={event => setNewEmail(event.target.value)} disabled={Boolean(busy)} /></label>
        <button type="submit" className={s.ghost} disabled={Boolean(busy) || !newEmail.trim()}>{emailText.confirm}</button>
      </form>}
      <SectionHead index="00" title={authPasswordCopy[locale].password}
        action={<button type="button" className={s.ghost} data-size="s" disabled={Boolean(busy) || !factors.data} onClick={async () => {
          setBusy('password'); setFlash(null)
          try { const result = await run(passkeys.length > 0 || Boolean(totp), r => managePassword(needsEmail ? bindingEmail.trim() : undefined, r)); if (result && !result.ok && !continueAuth(result.error)) {
            if (result.error.code === 'AUTH_EMAIL_BIND_REQUIRED') setNeedsEmail(true)
            setFlash({ tone: 'error', text: result.error.code === 'AUTH_EMAIL_BIND_REQUIRED' ? authPasswordCopy[locale].bind : authPasswordCopy[locale].failed })
          } }
          finally { setBusy(null) }
        }}>{authPasswordCopy[locale].manage}</button>} />
      {needsEmail && <input type="email" value={bindingEmail} onChange={event => setBindingEmail(event.target.value)} autoComplete="email" aria-label={authPasswordCopy[locale].email} placeholder="name@example.com" maxLength={254} disabled={Boolean(busy)} style={{ width: '100%', padding: 12, marginBottom: 16, background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--edge)', borderRadius: 12 }} />}
      <SectionHead index="01" title={t.passkeys} note={t.passkeysNote}
        action={<button type="button" className={s.ghost} data-size="s" onClick={() => void addPasskey()} disabled={Boolean(busy) || !factors.data} aria-busy={busy === 'passkey:add'}>
          {busy === 'passkey:add' ? <RotateCw size={13} className={s.spin} /> : <Plus size={13} />}{busy === 'passkey:add' ? t.passkeyAdding : t.passkeyAdd}
        </button>} />
      {factors.error && !factors.data ? <ErrorBlock error={factors.error} retry={factors.refetch} />
        : !factors.data ? <Skeleton rows={2} />
        : passkeys.length === 0 ? <div className={x.empty}><Fingerprint size={18} strokeWidth={1.5} aria-hidden="true" /><span>{t.passkeyNone}</span></div>
        : <ul className={s.list}>{passkeys.map((key) => <li key={key.id}>
          <div className={s.row} data-static="true">
            <span className={s.logo}><Fingerprint size={16} strokeWidth={1.7} /></span>
            <span className={s.rowMain}>
              <b className={s.clamp2} dir="auto">{key.label}</b>
              <small>{fill(t.passkeyCreated, { t: fmtDate(key.createdAt, locale) })} · {key.lastUsedAt ? fill(t.passkeyUsed, { t: fmtDate(key.lastUsedAt, locale) }) : t.passkeyNever}</small>
            </span>
            <span className={s.rowEnd}><button type="button" className={s.ghost} data-size="s" onClick={() => setPending({ kind: 'passkey', id: key.id })} disabled={Boolean(busy)}>{t.remove}</button></span>
          </div>
          {pending?.kind === 'passkey' && pending.id === key.id && <Confirm title={t.removeTitle} body={t.removeBody} keep={t.keep} go={t.confirmRemove} busy={busy === `passkey:${key.id}`}
            onKeep={() => setPending(null)} onGo={() => void act(`passkey:${key.id}`, () => run(true, (r) => removePasskey(key.id, r ?? '')), () => t.removed, ['security:factors'])} />}
        </li>)}</ul>}

      <SectionHead index="02" title={t.totp} note={t.totpNote} />
      {factors.error && !factors.data ? null
        : !factors.data ? <Skeleton rows={1} />
        : totp ? <>
          <div className={s.row} data-static="true">
            <span className={s.logo}><KeyRound size={16} strokeWidth={1.7} /></span>
            <span className={s.rowMain}>
              <b>{t.totpOn}</b>
              <small>{totp.activatedAt ? fill(t.totpActivated, { t: fmtDate(totp.activatedAt, locale) }) : null}</small>
              <small><bdi>{fill(t.recoveryLeft, { n: totp.recoveryCodesRemaining })}</bdi></small>
            </span>
            <span className={s.rowEnd}><button type="button" className={s.ghost} data-size="s" onClick={() => setPending({ kind: 'totp', id: totp.id })} disabled={Boolean(busy)}>{t.remove}</button></span>
          </div>
          {totp.recoveryCodesRemaining <= 2 && <div className={s.notice} data-tone="error"><Info size={16} /><span>{t.recoveryLow}</span></div>}
          {pending?.kind === 'totp' && <Confirm title={t.removeTitle} body={t.removeBody} keep={t.keep} go={t.confirmRemove} busy={busy === 'totp:remove'}
            onKeep={() => setPending(null)} onGo={() => void act('totp:remove', () => run(true, (r) => removeTotp(totp.id, r ?? '')), () => t.removed, ['security:factors'])} />}
        </>
        : <TotpEnroll t={t} onDone={() => { invalidate(['security:factors', 'security:events']); setFlash({ tone: 'info', text: t.enroll.done }) }} />}
    </>)}

    {panel('devices', <>
      <SectionHead index="01" title={t.devices} note={t.devicesNote}
        action={current && current.trustState !== 'trusted' ? <button type="button" className={s.ghost} data-size="s" disabled={Boolean(busy)} aria-busy={busy === 'device:trust'}
          onClick={() => void act('device:trust', () => run(true, (r) => trustCurrentDevice(r ?? '')), () => t.trusted, ['security:devices', 'security:sessions'])}>
          {busy === 'device:trust' ? <RotateCw size={13} className={s.spin} /> : <ShieldCheck size={13} />}{busy === 'device:trust' ? t.trusting : t.trustThis}
        </button> : undefined} />
      {devices.error && !devices.data ? <ErrorBlock error={devices.error} retry={devices.refetch} />
        : !devices.data ? <Skeleton rows={3} />
        : devices.data.length === 0 ? <StateBlock title={t.empty} />
        : <ul className={s.list}>{[...devices.data].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)).map((device) => <DeviceRow key={device.id} device={device} t={t} locale={locale}
          busy={busy} confirming={pending?.kind === 'device' && pending.id === device.id} onAsk={() => setPending({ kind: 'device', id: device.id })} onKeep={() => setPending(null)}
          onGo={() => void act(`device:${device.id}`, () => revokeDevice(device.id), (data) => { if (data.currentSessionRevoked) leaveLocally(onSignedOut); else return t.removed }, ['security:devices', 'security:sessions'])} />)}</ul>}
    </>)}

    {panel('sessions', <>
      <SectionHead index="01" title={t.sessions} note={t.sessionsNote}
        action={liveSessions.some((item) => !item.isCurrent) ? <button type="button" className={s.ghost} data-size="s" onClick={() => setPending({ kind: 'others', id: 'others' })} disabled={Boolean(busy)}>
          <LogOut size={13} className={x.flip} />{t.endOthers}
        </button> : undefined} />
      {pending?.kind === 'others' && <Confirm title={t.endOthersTitle} body={t.endOthersBody} keep={t.keep} go={t.endOthers} busy={busy === 'session:others'}
        onKeep={() => setPending(null)} onGo={() => void act('session:others', revokeOtherSessions, (data) => fill(t.endedOthers, { n: data.revokedCount }), ['security:sessions', 'security:devices'])} />}
      {sessions.error && !sessions.data ? <ErrorBlock error={sessions.error} retry={sessions.refetch} />
        : !sessions.data ? <Skeleton rows={3} />
        : <>
          <ul className={s.list}>{[...liveSessions].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || (b.lastSeenAt ?? b.createdAt).localeCompare(a.lastSeenAt ?? a.createdAt)).map((session) => <SessionRow key={session.id} session={session} t={t} locale={locale}
            busy={busy} confirming={pending?.kind === 'session' && pending.id === session.id} onAsk={() => setPending({ kind: 'session', id: session.id })} onKeep={() => setPending(null)}
            onGo={() => session.isCurrent ? void signOutHere() : void act(`session:${session.id}`, () => revokeSession(session.id), (data) => { if (data.isCurrent) leaveLocally(onSignedOut); else return t.ended }, ['security:sessions', 'security:devices'])} />)}</ul>
          {!liveSessions.some((item) => !item.isCurrent) && <p className={x.quiet}>{t.noOthers}</p>}
        </>}
    </>)}

    <SectionHead title={t.activity} note={t.activityNote} />
    <SecurityEvents t={t} locale={locale} />

    <SectionHead title={t.tips} note={t.tipsNote} />
    <ol className={s.notes}>{t.tipItems.map((item) => <li key={item}>{item}</li>)}</ol>
    <button type="button" className={s.link} onClick={() => openPath('/trust/official-channels')}><ShieldCheck size={13} />{t.channels}<ChevronRight size={13} className={x.flip} /></button>
    {sheet}
  </MaisonPage>
}

const EVENTS_SHOWN = 6
const eventIcon = (action: string) => action.includes('passkey') ? Fingerprint
  : action.includes('totp') || action.includes('recovery_code') ? KeyRound
  : action.includes('device') ? Laptop
  : action.includes('session') ? LogOut
  : ShieldCheck

/** Redacted server audit trail (`GET /v1/security/events`): only what happened and when; unknown actions are shown exactly as sent. */
function SecurityEvents({ t, locale }: { t: SecurityCopy; locale: string }) {
  const common = marketCopy[locale as keyof typeof marketCopy].common
  const events = useQuery('security:events', listSecurityEvents, { staleTime: 20_000 })
  const [all, setAll] = useState(false)
  if (events.error && !events.data) return <StateBlock tone="error" title={common.errorGeneric} body={<span className={s.mono}>{errorText(events.error)}</span>} retry={events.refetch} retryLabel={common.retry} />
  if (!events.data) return <Skeleton rows={3} />
  if (events.data.length === 0) return <StateBlock title={t.activityTitle} body={t.activityBody} />
  const list = [...events.data].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const shown = all ? list : list.slice(0, EVENTS_SHOWN)
  return <>
    <ul className={s.list}>{shown.map((event: SecurityEventView) => {
      const key = event.action.replace(/^security\./, '')
      const label = t.events[key]
      const Icon = eventIcon(key)
      return <li key={event.id}>
        <div className={s.row} data-static="true">
          <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
          <span className={s.rowMain}>
            <b className={label ? undefined : s.mono} dir={label ? undefined : 'ltr'}>{label ?? event.action}</b>
            <small>{fmtDateTime(event.occurredAt, locale)}</small>
          </span>
        </div>
      </li>
    })}</ul>
    {list.length > EVENTS_SHOWN && <button type="button" className={s.link} onClick={() => setAll((value) => !value)} aria-expanded={all}>
      <History size={13} />{all ? t.showFewer : fill(t.showAll, { n: String(list.length) })}
    </button>}
  </>
}

function DeviceRow({ device, t, locale, busy, confirming, onAsk, onKeep, onGo }: { device: SecurityDevice; t: SecurityCopy; locale: string; busy: string | null; confirming: boolean; onAsk: () => void; onKeep: () => void; onGo: () => void }) {
  const Icon = deviceIcon(device.name)
  return <li>
    <div className={s.row} data-static="true" data-current={device.isCurrent}>
      <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
      <span className={s.rowMain}>
        <b className={s.clamp2} dir="auto">{device.name || t.unknownDevice}</b>
        <small>{device.lastSeenAt ? fill(t.lastSeen, { t: fmtDateTime(device.lastSeenAt, locale) }) : fill(t.firstSeen, { t: fmtDate(device.firstSeenAt, locale) })}</small>
        <span className={x.tags}>
          {device.isCurrent && <span className={s.badge} data-tone="accent">{t.thisDevice}</span>}
          <span className={s.badge} data-tone={device.trustState === 'trusted' ? 'live' : undefined}>{t.trust[device.trustState] ?? device.trustState}</span>
          <small className={s.mono}><bdi>{fill(t.sessionsOn, { n: device.activeSessionCount })}</bdi></small>
        </span>
      </span>
      <span className={s.rowEnd}><button type="button" className={s.ghost} data-size="s" onClick={onAsk} disabled={Boolean(busy)}>{t.forget}</button></span>
    </div>
    {confirming && <Confirm title={t.forgetTitle} body={t.forgetBody} keep={t.keep} go={t.forget} busy={busy === `device:${device.id}`} onKeep={onKeep} onGo={onGo} />}
  </li>
}

function SessionRow({ session, t, locale, busy, confirming, onAsk, onKeep, onGo }: { session: SecuritySession; t: SecurityCopy; locale: string; busy: string | null; confirming: boolean; onAsk: () => void; onKeep: () => void; onGo: () => void }) {
  const Icon = deviceIcon(session.device?.name ?? '')
  return <li>
    <div className={s.row} data-static="true" data-current={session.isCurrent}>
      <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
      <span className={s.rowMain}>
        <b className={s.clamp2} dir="auto">{session.device?.name || t.unknownDevice}</b>
        <small>{fill(t.signedIn, { t: fmtDateTime(session.createdAt, locale) })}</small>
        <span className={x.tags}>
          {session.isCurrent && <span className={s.badge} data-tone="accent">{t.current}</span>}
          <small className={s.mono}>{fill(t.expires, { t: fmtDate(session.expiresAt, locale) })}</small>
        </span>
      </span>
      <span className={s.rowEnd}><button type="button" className={s.ghost} data-size="s" onClick={onAsk} disabled={Boolean(busy)}>{session.isCurrent ? t.signOutHere : t.endSession}</button></span>
    </div>
    {confirming && <Confirm title={session.isCurrent ? t.signOutHere : t.endSession} body={session.isCurrent ? t.signOutHereBody : t.endSessionBody}
      keep={t.keep} go={session.isCurrent ? t.signOutHere : t.endSession} busy={busy === `session:${session.id}` || busy === 'session:current'} onKeep={onKeep} onGo={onGo} />}
  </li>
}

/** Authenticator enrolment: secret and recovery codes live in component state only and vanish on cancel, success or leaving the page. */
function TotpEnroll({ t, onDone }: { t: SecurityCopy; onDone: () => void }) {
  const e = t.enroll
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')

  const start = async () => {
    setBusy(true)
    setError(null)
    const result = await startTotpEnrollment()
    setBusy(false)
    if (result.ok) setEnrollment(result.data)
    else setError(`${t.actionFailed} ${errorText(result.error)}`)
  }
  const confirm = async () => {
    if (!enrollment || busy || !/^\d{6}$/.test(code) || !saved) return
    setBusy(true)
    setError(null)
    const result = await confirmTotpEnrollment(enrollment.factorId, code)
    setBusy(false)
    if (result.ok) { setEnrollment(null); onDone(); return }
    setCode('')
    setError(result.error.status === 400 || result.error.status === 401 || result.error.status === 422 ? e.wrongCode : `${t.actionFailed} ${errorText(result.error)}`)
  }
  const copyCodes = async () => {
    if (!enrollment) return
    try { await navigator.clipboard.writeText(enrollment.recoveryCodes.join('\n')); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }
  const cancel = () => { setEnrollment(null); setCode(''); setSaved(false); setError(null) }

  if (!enrollment) return <>
    <div className={s.row} data-static="true">
      <span className={s.logo}><KeyRound size={16} strokeWidth={1.7} /></span>
      <span className={s.rowMain}><b>{t.totpOff}</b><small>{t.totpNote}</small></span>
      <span className={s.rowEnd}><button type="button" className={s.ghost} data-size="s" onClick={() => void start()} disabled={busy} aria-busy={busy}>{busy ? <RotateCw size={13} className={s.spin} /> : <Plus size={13} />}{t.totpSetup}</button></span>
    </div>
    {error && <div className={s.notice} data-tone="error" role="alert"><Info size={16} /><span>{error}</span></div>}
  </>

  const secret = secretOf(enrollment.otpauthUri)
  return <section className={x.enroll} aria-label={e.title}>
    <h3 className={x.enrollTitle}>{e.title}</h3>
    <ol className={x.enrollSteps}>
      <li>
        <span className={x.stepLabel}><i>1</i>{e.scan}</span>
        <div className={x.scan}>
          <span className={s.qr}><QRCodeSVG value={enrollment.otpauthUri} size={132} level="M" /></span>
          {secret && <span className={x.secret}><small>{e.manual}</small><bdi className={s.mono}>{secret}</bdi></span>}
        </div>
      </li>
      <li>
        <span className={x.stepLabel}><i>2</i>{e.codes}</span>
        <p className={x.hint}>{e.codesNote}</p>
        <ul className={x.codes} dir="ltr">{enrollment.recoveryCodes.map((item) => <li key={item} className={s.mono}>{item}</li>)}</ul>
        <button type="button" className={s.link} onClick={() => void copyCodes()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? e.copied : e.copyCodes}</button>
        <label className={s.consent}><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /><span>{e.saved}</span></label>
      </li>
      <li>
        <span className={x.stepLabel}><i>3</i>{e.code}</span>
        <form onSubmit={(event) => { event.preventDefault(); void confirm() }}>
          <label className={s.field}>
            <span>{e.code}</span>
            <input value={code} name="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-invalid={Boolean(error)}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, '')); setError(null) }} />
          </label>
          {error && <p className={s.fieldError} role="alert">{error}</p>}
          <div className={s.ctaPair} style={{ marginTop: 14 }}>
            <button type="button" className={s.ghost} onClick={cancel} disabled={busy}>{e.cancel}</button>
            <button type="submit" className={s.cta} disabled={busy || !saved || !/^\d{6}$/.test(code)} aria-busy={busy}>
              <span>{busy ? e.confirming : e.confirm}</span><span className={s.ctaIcon}><ShieldCheck size={17} /></span>
            </button>
          </div>
        </form>
      </li>
    </ol>
    {enrollment.expiresNotice && <p className={x.hint}><History size={12} aria-hidden="true" /> {enrollment.expiresNotice}</p>}
  </section>
}
