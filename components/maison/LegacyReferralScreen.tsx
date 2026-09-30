'use client'

import { Check, Copy, Gift, Info, Link2, Mail, Plus, RotateCw, Share2, Ticket, Trash2, UserPlus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import type { ApiError } from '@/lib/api/_http'
import { invalidate, useQuery } from '@/lib/api/_query'
import { createInvitation, listInvitations, listRewards, revokeInvitation, type Invitation, type Reward } from '@/lib/api/account'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, queryParam } from '@/lib/maison-nav'
import { referralCopy } from '@/lib/maison-security-copy'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, Segmented, StatStrip } from './motion'
import { fmtAtomic, fmtDate } from './format'
import x from './security.module.css'

type Tab = 'invites' | 'rewards'
const TABS: Tab[] = ['invites', 'rewards']
type Tone = 'live' | 'warn' | 'down' | 'accent' | undefined
const stateTone: Record<string, Tone> = { pending: 'accent', accepted: 'live', revoked: 'down', expired: undefined }
const rewardTone: Record<string, Tone> = { earned: 'live', redeemed: 'accent', expired: undefined, revoked: 'down' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const setQuery = (name: string, value: string | null) => {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}
/** A pending invite whose expiry has passed is shown as expired even before the server sweeps it. */
const effectiveState = (invite: Invitation) => invite.state === 'pending' && new Date(invite.expiresAt).getTime() <= Date.now() ? 'expired' : invite.state

function ErrorBlock({ error, retry }: { error: ApiError; retry: () => void }) {
  const { locale } = useI18n()
  const common = marketCopy[locale].common
  return <StateBlock tone="error" title={common.errorGeneric} body={<span className={s.mono}>{error.status || '—'} · {error.code}</span>} retry={retry} retryLabel={common.retry} />
}

/** `/profile/referral` — one-time invite links (token shown once, memory only), their states, and rewards exactly as recorded. */
export function LegacyReferralScreen({ query = '' }: { query?: string }) {
  const { locale } = useI18n()
  const t = referralCopy[locale]
  const common = marketCopy[locale].common
  const initial = queryParam(query, 'tab') as Tab | null
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'invites')
  const invites = useQuery('referral:invitations', listInvitations, { staleTime: 20_000 })
  const rewards = useQuery('referral:rewards', listRewards, { staleTime: 30_000 })
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<{ link: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => { setCanShare(typeof navigator.share === 'function') }, [])

  const choose = (value: Tab) => { setTab(value); setPending(null); setQuery('tab', value === 'invites' ? null : value) }
  const list = useMemo(() => [...(invites.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [invites.data])
  const earned = (rewards.data ?? []).filter((item) => item.state === 'earned' || item.state === 'redeemed')
  const counts = { sent: list.length, accepted: list.filter((item) => item.state === 'accepted').length, pending: list.filter((item) => effectiveState(item) === 'pending').length }
  const loadingInvites = invites.data === undefined && !invites.error
  const figure = (value: number) => invites.data ? value : invites.error ? '—' : '…'

  const create = async () => {
    const trimmed = email.trim()
    if (trimmed && !EMAIL.test(trimmed)) { setEmailError(true); return }
    if (busy) return
    setBusy('create')
    setError(null)
    const result = await createInvitation(trimmed || undefined)
    setBusy(null)
    if (!result.ok) { setError(`${t.linkFailed} ${result.error.status || '—'} · ${result.error.code}`); return }
    setFresh({ link: `${window.location.origin}/register?invite_code=${encodeURIComponent(result.data.token)}`, expiresAt: result.data.view.expiresAt })
    setEmail('')
    setCopied(false)
    invalidate('referral:invitations')
  }
  const copy = async () => {
    if (!fresh) return
    try { await navigator.clipboard.writeText(fresh.link); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }
  const share = async () => {
    if (!fresh || !navigator.share) return
    try { await navigator.share({ url: fresh.link }) } catch { /* dismissed */ }
  }
  const revoke = async (id: string) => {
    if (busy) return
    setBusy(`revoke:${id}`)
    setError(null)
    const result = await revokeInvitation(id)
    setBusy(null)
    if (!result.ok) { setError(`${common.errorGeneric} ${result.error.status || '—'} · ${result.error.code}`); return }
    setPending(null)
    invalidate('referral:invitations')
  }

  return <MaisonPage page="referral" topbar={<RwaTopbar screen="referral" template="T-Child" l1="back" title={t.kicker} onBack={() => backOr('/profile')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.titleA} <em>{t.titleB}</em></h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    <Lacquer className={`${s.credential} ${x.pass}`} aria-live="polite">
      <i className={s.guilloche} data-foil={counts.accepted > 0} aria-hidden="true" />
      <div className={s.credTop}>
        <span className={s.kicker}>{t.card}</span>
        <span className={s.credRing} style={{ ['--p' as string]: counts.sent ? counts.accepted / counts.sent : 0 } as CSSProperties} role="img" aria-label={`${t.stats.accepted} ${counts.accepted}/${counts.sent}`}>
          <b className={s.num}>{invites.data ? counts.accepted : '·'}<small>/{invites.data ? counts.sent : '·'}</small></b>
        </span>
      </div>
      <span className={x.shield} aria-hidden="true"><Ticket size={20} strokeWidth={1.4} /></span>
      <div className={s.credMain}>
        <small>{t.stats.pending}</small>
        <b className={s.num}>{figure(counts.pending)}</b>
      </div>
      <StatStrip fit items={[
        { label: t.stats.sent, value: figure(counts.sent) },
        { label: t.stats.accepted, value: figure(counts.accepted), tone: counts.accepted ? 'up' : undefined },
        { label: t.stats.earned, value: rewards.data ? earned.length : rewards.error ? '—' : '…' },
      ]} />
    </Lacquer>

    <SectionHead index="01" title={t.create} note={t.createNote} />
    {fresh ? <section className={x.linkBox} aria-label={t.linkTitle}>
      <p className={s.kicker} style={{ margin: 0 }}><Link2 size={13} aria-hidden="true" />{t.linkTitle}</p>
      <p className={x.hint} style={{ marginTop: 6 }}>{t.linkOnce}</p>
      <div className={x.linkRow}>
        <span className={s.qr}><QRCodeSVG value={fresh.link} size={112} level="M" /></span>
        <span className={x.linkText}>{fresh.link}</span>
      </div>
      <p className={x.quiet}>{fill(t.expiresOn, { t: fmtDate(fresh.expiresAt, locale) })}</p>
      <div className={s.actionsRow}>
        <button type="button" className={s.ghost} data-size="s" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? t.copied : t.copy}</button>
        {canShare && <button type="button" className={s.ghost} data-size="s" onClick={() => void share()}><Share2 size={13} />{t.share}</button>}
        <button type="button" className={s.link} onClick={() => setFresh(null)}><Plus size={13} />{t.newLink}</button>
      </div>
    </section>
      : <form noValidate onSubmit={(event) => { event.preventDefault(); void create() }}>
        <label className={s.field}>
          <span>{t.email}</span>
          <input type="email" data-kind="text" value={email} name="invite-email" autoComplete="off" inputMode="email" maxLength={254} aria-invalid={emailError} aria-describedby="invite-email-hint"
            onChange={(event) => { setEmail(event.target.value); setEmailError(false) }} />
        </label>
        <p className={emailError ? s.fieldError : x.hint} id="invite-email-hint" role={emailError ? 'alert' : undefined} style={{ marginTop: 6 }}>{emailError ? t.emailInvalid : <><Mail size={12} aria-hidden="true" />{t.emailHint}</>}</p>
        <button type="submit" className={s.cta} style={{ marginTop: 14 }} disabled={busy === 'create'} aria-busy={busy === 'create'}>
          <span>{busy === 'create' ? t.creating : t.createCta}</span>
          <span className={s.ctaIcon}>{busy === 'create' ? <RotateCw size={17} className={s.spin} /> : <UserPlus size={17} />}</span>
        </button>
      </form>}
    {error && <div className={s.notice} data-tone="error" role="alert"><Info size={16} /><span>{error}</span></div>}

    <div className={x.tabs}>
      <Segmented value={tab} onChange={choose} label={t.kicker} options={TABS.map((value) => ({ value, label: t.tabs[value] }))} />
    </div>

    <div role="tabpanel" id="referral-invites" aria-label={t.tabs.invites} hidden={tab !== 'invites'} className={x.panel}>
      {invites.error && !invites.data ? <div style={{ marginTop: 12 }}><ErrorBlock error={invites.error} retry={invites.refetch} /></div>
        : loadingInvites ? <Skeleton rows={3} />
        : list.length === 0 ? <StateBlock title={t.invitesEmpty} body={t.invitesEmptyBody} />
        : <ul className={s.list} style={{ marginTop: 12 }}>{list.map((invite) => {
          const state = effectiveState(invite)
          return <li key={invite.id}>
            <div className={s.row} data-static="true">
              <span className={s.logo}>{invite.email ? <Mail size={16} strokeWidth={1.7} /> : <Link2 size={16} strokeWidth={1.7} />}</span>
              <span className={s.rowMain}>
                <b className={s.clamp2}>{invite.email ? <bdi>{invite.email}</bdi> : t.noEmail}</b>
                <small>{state === 'accepted' && invite.acceptedAt ? fill(t.acceptedOn, { t: fmtDate(invite.acceptedAt, locale) }) : fill(t.sentOn, { t: fmtDate(invite.createdAt, locale) })}</small>
                <span className={x.tags}>
                  <span className={s.badge} data-tone={stateTone[state]}>{t.states[state] ?? state}</span>
                  {state === 'pending' && <small className={s.mono}>{fill(t.expiresShort, { t: fmtDate(invite.expiresAt, locale) })}</small>}
                </span>
              </span>
              {state === 'pending' && <span className={s.rowEnd}><button type="button" className={s.ghost} data-size="s" onClick={() => setPending(invite.id)} disabled={Boolean(busy)}>{t.revoke}</button></span>}
            </div>
            {pending === invite.id && <div className={s.confirm} role="alertdialog" aria-label={t.revokeTitle}>
              <h2>{t.revokeTitle}</h2>
              <p>{t.revokeBody}</p>
              <div className={s.ctaPair}>
                <button type="button" className={s.ghost} onClick={() => setPending(null)} disabled={Boolean(busy)}>{t.keep}</button>
                <button type="button" className={s.ghost} data-tone="down" onClick={() => void revoke(invite.id)} disabled={Boolean(busy)} aria-busy={busy === `revoke:${invite.id}`}>
                  {busy === `revoke:${invite.id}` ? <RotateCw size={14} className={s.spin} /> : <Trash2 size={14} />}{busy === `revoke:${invite.id}` ? t.revoking : t.confirmRevoke}
                </button>
              </div>
            </div>}
          </li>
        })}</ul>}
    </div>

    <div role="tabpanel" id="referral-rewards" aria-label={t.tabs.rewards} hidden={tab !== 'rewards'} className={x.panel}>
      {rewards.error && !rewards.data ? <div style={{ marginTop: 12 }}><ErrorBlock error={rewards.error} retry={rewards.refetch} /></div>
        : !rewards.data ? <Skeleton rows={2} />
        : rewards.data.length === 0 ? <StateBlock title={t.rewardsEmpty} body={t.rewardsEmptyBody} />
        : <ul className={s.list} style={{ marginTop: 12 }}>{[...rewards.data].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)).map((reward) => <RewardRow key={reward.id} reward={reward} />)}</ul>}
    </div>

    <SectionHead index="02" title={t.terms} />
    <ol className={s.notes}>{t.termsItems.map((item) => <li key={item}>{item}</li>)}</ol>
  </MaisonPage>
}

function RewardRow({ reward }: { reward: Reward }) {
  const { locale } = useI18n()
  const t = referralCopy[locale]
  // The server states each reward's scale; without it the amount is never guessed.
  const decimals = reward.decimals
  return <li>
    <div className={s.row} data-static="true">
      <span className={s.logo}><Gift size={16} strokeWidth={1.7} /></span>
      <span className={s.rowMain}>
        <b>{t.kinds[reward.kind] ?? reward.kind}</b>
        <small>{fill(t.earnedOn, { t: fmtDate(reward.earnedAt, locale) })}</small>
        <span className={x.tags}><span className={s.badge} data-tone={rewardTone[reward.state]}>{t.rewardStates[reward.state] ?? reward.state}</span></span>
      </span>
      <span className={s.rowEnd}>{decimals !== null && decimals !== undefined
        ? <bdi className={x.amount}>{fmtAtomic(reward.amountAtomic, decimals, reward.currency)}</bdi>
        : <small className={s.muted} style={{ fontSize: 11 }}>{t.amountUnknown}</small>}</span>
    </div>
  </li>
}

