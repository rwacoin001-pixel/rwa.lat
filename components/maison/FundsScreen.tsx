'use client'

import { AlertTriangle, ArrowRight, BookUser, Check, ChevronRight, ClipboardPaste, Copy, Plus, QrCode, Send, Share2, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {TransferScanner} from './TransferScanner'
import {transferRecipientFromCode} from '@/lib/transfer-code'
import { useEffect, useMemo, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { readSession, SESSION_CHANGED, SESSION_EXPIRED, type ApiError } from '@/lib/api/_http'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import {
  addAddress, createTransfer, createWithdrawal, getTransferEligibility, getTransferRecipient, getWalletDetail, isUuid, isValidAddress, listAddressBook, listNetworks, quoteWithdrawal, revokeAddress,
  type AddressBookEntry, type TransferBody, type TransferReceipt, type WalletNetwork, type WithdrawalBody, type WithdrawalQuote, type WithdrawalReceipt,
} from '@/lib/api/wallet'
import { fromAtomic, toAtomic } from '@/lib/money'
import { fundsCopy, type FundsCopy } from '@/lib/maison-funds-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { walletCopy } from '@/lib/maison-wallet-copy'
import { backOr, openPath, queryParam, signInThenReturn } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { Segmented, useAutoAnimate } from './motion'
import { fmtAtomic, fmtDateTime } from './format'
import { stepUpRequired, useStepUp } from './StepUp'
import { getTransactionPinStatus, pinErrorDetails, pinGate } from '@/lib/api/transaction-pin'
import { transactionPinCopy } from '@/lib/maison-transaction-pin-copy'
import { TransactionPinManager, TransactionPinPrompt } from './TransactionPin'
import fp from './funds-polish.module.css'
import fs from './funds-fullscreen.module.css'
import tf from './transfer-feedback.module.css'
import { AmountPad, FlowConfirm, FlowSuccess, RecipientField, share, useRecentRecipients } from './flow-kit'
import { flowKitCopy } from '@/lib/flow-kit-copy'

const WITHDRAW_PATH = '/v1/wallet/withdrawals'
const TRANSFER_PATH = '/v1/wallet/transfers'
const ZERO = BigInt(0)
const mask = (value: string) => value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
const errorText = (f: FundsCopy, error: ApiError, fallback: string) => f.errors[error.code] ?? (error.message || fallback)
/** The wallet copy names ledger/funding states; withdrawal screening adds `risk_review`, shown as the shared in-review label. */
const stateLabel = (states: Record<string, string>, state: string) => states[state] ?? (state === 'risk_review' ? states.pending_review : undefined) ?? state
const stateTone = (state: string) => ['completed', 'posted', 'approved', 'active'].includes(state) ? 'live' : ['failed', 'rejected', 'cancelled', 'blocked', 'revoked'].includes(state) ? 'down' : ['risk_review', 'pending_review', 'held', 'pending', 'manual_review'].includes(state) ? 'warn' : 'accent'
const setQuery = (name: string, value: string | null) => {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}


/** Address-like ids read by their ends: `head…tail`, isolated LTR so it never reorders inside RTL copy. */
function Addr({ value, head = 6, tail = 6 }: { value: string; head?: number; tail?: number }) {
  if (value.length <= head + tail + 1) return <bdi className={s.addr} dir="ltr"><b>{value}</b></bdi>
  return <bdi className={s.addr} dir="ltr"><b>{value.slice(0, head)}</b><i>…</i><b>{value.slice(-tail)}</b></bdi>
}


function usable(entry: AddressBookEntry) { return entry.state === 'active' && entry.riskState === 'clear' }

function useFundsSessionBoundary(reset: () => void) {
  const generation = useRef(0)
  const resetRef = useRef(reset)
  resetRef.current = reset
  useEffect(() => {
    const clear = () => { generation.current++; resetRef.current() }
    window.addEventListener(SESSION_CHANGED, clear); window.addEventListener(SESSION_EXPIRED, clear)
    return () => { generation.current++; window.removeEventListener(SESSION_CHANGED, clear); window.removeEventListener(SESSION_EXPIRED, clear) }
  }, [])
  return generation
}

/** `/assets/cash/withdraw` — network, destination (saved or new), amount, server quote, consent, then an idempotent request behind step-up. */
export function WithdrawScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const f = fundsCopy[locale]
  const w = f.withdraw
  const states = walletCopy[locale].states
  const common = marketCopy[locale].common
  const p = transactionPinCopy[locale]
  const pinStatus = useQuery('security:transaction-pin', getTransactionPinStatus, { staleTime: 0, loading: 'silent' })
  const [pinManager, setPinManager] = useState(false)
  const [pinPrompt, setPinPrompt] = useState(false)
  const wallet = useQuery('wallet:detail', getWalletDetail, { staleTime: 15_000 })
  const networks = useQuery('wallet:networks', listNetworks, { staleTime: 300_000 })
  const book = useQuery('wallet:address-book', listAddressBook, { staleTime: 30_000 })
  const { run, sheet } = useStepUp()
  const [picked, setPicked] = useState<string | null>(() => queryParam(query, 'network'))
  const list = networks.data?.networks ?? []
  const network: WalletNetwork | undefined = list.find((item) => item.id === picked) ?? list[0]
  const integration = networks.data?.integration ?? wallet.data?.integration
  const bookRequired = Boolean(integration?.withdrawalControls.addressBookRequired)
  const entries = useMemo(() => (book.data?.entries ?? []).filter((entry) => entry.network === network?.id && entry.state !== 'revoked'), [book.data, network?.id])
  const [modePick, setModePick] = useState<'saved' | 'manual' | null>(null)
  const mode = bookRequired ? 'saved' : modePick ?? (entries.some(usable) ? 'saved' : 'manual')
  const [entryId, setEntryId] = useState<string | null>(null)
  const entry = entries.find((item) => item.id === entryId && usable(item)) ?? null
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<(WithdrawalReceipt & { to: string }) | null>(null)
  const keys = useRef(new Map<string, string>())
  const inflight = useRef(false)
  const kit = flowKitCopy(locale)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  // The PIN sheet (or PIN setup) takes over from the review sheet.
  useEffect(() => { if (pinPrompt || pinManager) setReviewOpen(false) }, [pinPrompt, pinManager])

  const decimals = network?.assetDecimals ?? 6
  const unit = network?.assetCode ?? 'USDT'
  const available = wallet.data?.balances.availableAtomic ?? null
  const atomic = amount ? toAtomic(amount, decimals) : null
  const fee = network ? BigInt(network.withdrawalFeeAtomic) : ZERO
  const maxAtomic = available !== null && BigInt(available) > fee ? (BigInt(available) - fee).toString() : null
  const addressOk = mode === 'saved' ? Boolean(entry) : isValidAddress(network?.id ?? '', destination.trim())

  const fieldError = useMemo(() => {
    if (!network || !amount) return null
    if (!atomic || atomic === '0') return f.errors.WALLET_AMOUNT_INVALID
    if (BigInt(atomic) < BigInt(network.minimumWithdrawalAtomic)) return fill(f.common.min, { v: fmtAtomic(network.minimumWithdrawalAtomic, decimals, unit) })
    if (available !== null && BigInt(atomic) + fee > BigInt(available)) return w.insufficient
    return null
  }, [amount, atomic, available, decimals, f, fee, network, unit, w.insufficient])

  // Debounced server quote; a newer input discards older answers.
  const [quote, setQuote] = useState<{ key: string; data?: WithdrawalQuote; error?: string } | null>(null)
  const quoteKey = network && atomic && atomic !== '0' && !fieldError ? `${network.id}:${atomic}` : null
  const [quoteNonce, setQuoteNonce] = useState(0)
  useEffect(() => {
    if (!quoteKey || !network || !atomic) { setQuote(null); return }
    let live = true
    const timer = window.setTimeout(async () => {
      const result = await quoteWithdrawal(network.id, atomic)
      if (!live) return
      setQuote(result.ok ? { key: quoteKey, data: result.data } : { key: quoteKey, error: errorText(f, result.error, w.quoteError) })
    }, 400)
    return () => { live = false; window.clearTimeout(timer) }
  }, [quoteKey, quoteNonce])
  const current = quote?.key === quoteKey ? quote : null
  const insufficient = current?.data ? !current.data.sufficientBalance : false
  const ready = Boolean(network && atomic && !fieldError && addressOk && consent && current?.data && !insufficient && !pending)

  const target = mode === 'saved' ? entry?.destination ?? '' : addressOk ? destination.trim() : ''
  const destinationLine = target ? <>{mode === 'saved' && entry ? <>{entry.label} · </> : null}<Addr value={target} /></> : '—'

  const choose = (id: string) => { setPicked(id); setEntryId(null); setDestination(''); setServerError(null); setQuery('network', id) }

  const generation = useFundsSessionBoundary(() => {
    setPinManager(false); setPinPrompt(false); setReceipt(null); setAmount(''); setDestination(''); setConsent(false); setServerError(null)
    setEntryId(null); setQuote(null); setTouched(false)
    keys.current.clear(); inflight.current = false; setPending(false)
  })
  const knownGate = pinStatus.error ? 'unavailable' : pinStatus.data ? pinGate(pinStatus.data) : null
  const submit = async () => {
    if (inflight.current || (!ready && knownGate !== 'unset')) return
    const epoch = generation.current
    inflight.current = true
    setPending(true)
    try {
      const state = await getTransactionPinStatus()
      if (epoch !== generation.current) return
      if (!state.ok) { setServerError(errorText(f, state.error, common.errorGeneric)); return }
      const gate = pinGate(state.data)
      if (gate === 'unset') { setPinManager(true); return }
      if (gate !== 'ready') { setServerError(p.gate[gate]); return }
      setServerError(null); setPinPrompt(true)
    } catch { if (epoch === generation.current) setServerError(common.errorGeneric) }
    finally { if (epoch === generation.current) { inflight.current = false; setPending(false) } }
  }
  const confirmPin = async (transactionPin: string) => {
    setTouched(true)
    if (!ready || !network || !atomic || inflight.current) return
    const epoch = generation.current
    const body: WithdrawalBody = { network: network.id, atomicAmount: atomic, ...(mode === 'saved' && entry ? { addressBookId: entry.id } : { destination: destination.trim() }) }
    // Keyed on the body without the step-up token, so a retry after re-authentication replays the same request.
    const key = idempotencyKeyForIntent(keys.current, 'POST', WITHDRAW_PATH, body)
    inflight.current = true
    setPending(true)
    setServerError(null)
    try {
    // One step at a time: the PIN sheet leaves before the identity check comes up (palette A), instead of stacking.
    setPinPrompt(false)
    const result = await run(stepUpRequired(integration), (reauthentication) => {
      if (epoch !== generation.current) return Promise.resolve({ ok: false as const, error: { status: 0, code: 'SESSION_CHANGED', message: common.errorGeneric } })
      return createWithdrawal(body, { transactionPin, reauthentication }, key)
    }, [
      { label: f.common.amount, value: <strong className={s.num}>{fmtAtomic(atomic, decimals, unit)}</strong> },
      { label: w.to, value: destinationLine },
      { label: f.common.fee, value: <span className={s.num}>{fmtAtomic(current?.data?.feeAtomicAmount ?? network.withdrawalFeeAtomic, decimals, unit)}</span> },
    ])
    if (epoch !== generation.current) return
    setPinPrompt(false)
    if (!result) { setServerError(f.common.cancelled); return }
    if (!result.ok) {
      const details = pinErrorDetails(result.error)
      setServerError([p.errors[result.error.code] ?? errorText(f, result.error, common.errorGeneric),
        details.remainingAttempts === undefined ? null : p.attempts(details.remainingAttempts)].filter(Boolean).join(' · '))
      void pinStatus.refetch()
      if (['WALLET_INSUFFICIENT_BALANCE', 'WALLET_AMOUNT_BELOW_MINIMUM'].includes(result.error.code)) setQuoteNonce((n) => n + 1)
      return
    }
    invalidate(['wallet:', 'portfolio:', 'home:'])
    setReceipt({ ...result.data, to: mode === 'saved' && entry ? `${entry.label} · ${mask(entry.destination)}` : mask(destination.trim()) })
    } catch { if (epoch === generation.current) { setPinPrompt(false); setServerError(common.errorGeneric) } }
    finally { if (epoch === generation.current) { inflight.current = false; setPending(false) } }
  }
  const again = () => { keys.current.clear(); setReceipt(null); setAmount(''); setConsent(false); setTouched(false); setServerError(null) }

  const topbar = <RwaTopbar screen="withdraw" title={w.title} onBack={() => backOr('/assets/cash')} />
  const arrival = network?.estimatedArrivalMinutes?.length ? kit.minutes(network.estimatedArrivalMinutes[0], network.estimatedArrivalMinutes[network.estimatedArrivalMinutes.length - 1]) : '—'
  const bare = (value: string | null | undefined) => fmtAtomic(value, decimals, unit).replace(` ${unit}`, '')
  if (receipt) {
    const done = ['completed', 'posted', 'approved'].includes(receipt.state)
    return <MaisonPage page="withdraw" className={fs.page} topbar={topbar}>
      <h1 className={fp.srTitle}>{w.title}</h1>
      <FlowSuccess title={done ? w.done : kit.sentWithdraw} pending={!done} amount={bare(receipt.atomicAmount)} unit={unit}
        rows={[
          { label: f.common.state, value: stateLabel(states, receipt.state) },
          { label: f.common.network, value: list.find((item) => item.id === receipt.network)?.displayName ?? receipt.network },
          { label: w.to, value: <bdi dir="ltr" className={s.mono}>{receipt.to}</bdi> },
          { label: f.common.fee, value: fmtAtomic(receipt.feeAtomicAmount, decimals, unit) },
          { label: kit.arrival, value: arrival },
          { label: f.common.reference, value: <span className={s.mono} dir="ltr">{receipt.id.slice(0, 8)}</span> },
          ...(receipt.reasonCode ? [{ label: w.reason, value: w.reasons[receipt.reasonCode] ?? receipt.reasonCode }] : []),
        ]}
        note={[!receipt.created && f.common.replay, receipt.integration && !receipt.integration.realFunds && f.common.stubNote].filter(Boolean).join(' · ') || undefined}
        onDone={() => openPath('/assets/cash')} onAgain={again} onRecords={() => openPath('/assets/activity?type=funding')} />
    </MaisonPage>
  }
  const usableEntries = entries.filter(usable)
  const typedBad = mode === 'manual' && destination.length > 0 && !addressOk
  const gateBlocked = knownGate !== null && !['ready', 'unset'].includes(knownGate)
  // The button names the next missing thing, top to bottom.
  const talk = !network ? kit.checking
    : !addressOk ? (typedBad ? fill(w.addressInvalid, { n: network.displayName }) : kit.chooseAddress)
    : !amount ? kit.enterAmount
    : fieldError === w.insufficient ? kit.insufficient
    : fieldError ? fieldError
    : !current ? kit.checking
    : current.error ? w.quoteError
    : insufficient ? kit.insufficient
    : gateBlocked ? p.gate[knownGate as keyof typeof p.gate]
    : knownGate === 'unset' ? p.title.setup
    : pending ? f.common.submitting
    : kit.withdrawN(fmtAtomic(atomic, decimals, unit))
  const canReview = Boolean(network && atomic && !fieldError && addressOk && current?.data && !insufficient && !pending && !gateBlocked)
  const pasteAddress = async () => {
    try { const text = (await navigator.clipboard.readText()).trim().replace(/\s/g, ''); if (text) { setModePick('manual'); setEntryId(null); setDestination(text); setServerError(null) } } catch { /* paste blocked: typing still works */ }
  }
  return <MaisonPage page="withdraw" className={fs.page} topbar={topbar}>
    {scanning && network && <TransferScanner onClose={() => setScanning(false)} onCode={(code) => { const value = code.trim().replace(/^[a-z]+:/i, '').split('?')[0]; if (!isValidAddress(network.id, value)) return false; setModePick('manual'); setEntryId(null); setDestination(value); setServerError(null); return true }} />}
    {pinManager && <TransactionPinManager open mode="setup" onClose={() => setPinManager(false)} onDone={() => { setPinManager(false); void pinStatus.refetch() }} />}
    {pinPrompt && <TransactionPinPrompt open busy={pending} onClose={() => setPinPrompt(false)} onConfirm={confirmPin} summary={[
      { label: f.common.amount, value: network && atomic ? fmtAtomic(atomic, decimals, unit) : '—' },
      { label: w.to, value: destinationLine },
    ]} />}
    <h1 className={fp.srTitle}>{w.title}</h1>
    {networks.error && !networks.data ? <StateBlock tone="error" title={common.errorGeneric} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} />
      : !network ? <Skeleton rows={5} />
      : <AmountPad value={amount} onChange={(next) => { setAmount(next); setServerError(null) }} decimals={Math.min(decimals, 6)} unit={unit} disabled={pending}
        invalid={Boolean(fieldError) || insufficient} error={serverError && !reviewOpen ? serverError : null}
        sub={!wallet.data && !wallet.error ? '…' : <>{kit.available(fmtAtomic(available, decimals, unit))} · {fill(f.common.min, { v: fmtAtomic(network.minimumWithdrawalAtomic, decimals, '', 0).trim() })}</>}
        side={[{ label: '25%', value: share(maxAtomic, 25, decimals) }, { label: '50%', value: share(maxAtomic, 50, decimals) }, { label: '75%', value: share(maxAtomic, 75, decimals) }, { label: kit.max, value: share(maxAtomic, 100, decimals) }]}
        header={<>
          {list.length > 1 && <div className={`${fp.touchSeg} ${fs.flowNetworks}`}><Segmented value={network.id} onChange={choose} label={f.common.network} role="group" options={list.map((item) => ({ value: item.id, label: item.displayName }))} /></div>}
          <RecipientField label={fill(w.address, { n: network.displayName })} value={mode === 'manual' ? destination : ''} disabled={pending}
            readOnly={mode === 'saved'} display={mode === 'saved' ? (entry ? <>{entry.label} · <Addr value={entry.destination} /></> : <span className={s.muted}>{kit.chooseAddress}</span>) : undefined}
            placeholder={network.id === 'tron' ? 'T…' : '0x…'} state={typedBad ? 'invalid' : addressOk ? 'valid' : undefined}
            onChange={(next) => { setModePick('manual'); setEntryId(null); setDestination(next); setServerError(null) }}
            status={typedBad ? fill(w.addressInvalid, { n: network.displayName }) : bookRequired ? w.bookRequired : book.error && !book.data ? f.book.loadError : !entries.length && book.data ? fill(w.bookEmpty, { n: network.displayName }) : null}
            actions={[
              ...(bookRequired ? [] : [{ label: kit.paste, icon: <ClipboardPaste size={19} strokeWidth={1.7} />, onClick: () => void pasteAddress() }, { label: kit.scan, icon: <QrCode size={19} strokeWidth={1.7} />, onClick: () => setScanning(true) }]),
              { label: kit.book, icon: <BookUser size={19} strokeWidth={1.7} />, onClick: () => openPath('/assets/cash/address-book') },
            ]}
            recents={{ title: w.saved, items: usableEntries.map((item) => ({ key: item.id, label: <>{item.label} <small className={s.mono} dir="ltr">…{item.destination.slice(-4)}</small></>, active: mode === 'saved' && entry?.id === item.id, onPick: () => { setModePick('saved'); setEntryId(item.id); setServerError(null) } })) }} />
        </>}
        cta={{ label: talk, disabled: !canReview && knownGate !== 'unset', busy: pending, onClick: () => { if (knownGate === 'unset') { setPinManager(true); return } setServerError(null); setConsent(false); setReviewOpen(true) } }} />}
    {network && <FlowConfirm open={reviewOpen} onClose={() => { if (!pending) setReviewOpen(false) }} busy={pending} title={kit.reviewWithdraw} amount={atomic ? bare(atomic) : '0'} unit={unit}
      rows={[
        { label: w.to, value: destinationLine },
        { label: f.common.network, value: network.displayName },
        { label: f.common.fee, value: fmtAtomic(current?.data?.feeAtomicAmount ?? network.withdrawalFeeAtomic, decimals, unit) },
        { label: kit.arrival, value: arrival },
        { label: w.total, value: current?.data ? fmtAtomic(current.data.totalDebitAtomic, decimals, unit) : '—', strong: true },
      ]}
      note={integration && !integration.realFunds ? f.common.stubNote : stepUpRequired(integration) ? f.stepUp.required : undefined}
      consent={{ label: w.consent, checked: consent, onChange: (checked) => { setConsent(checked); setServerError(null) } }}
      error={serverError} confirmLabel={kit.confirmWithdraw} onConfirm={() => void submit()} />}
    {sheet}
  </MaisonPage>
}

/** `/assets/cash/receive` — the signed-in user's receive code: QR of a transfer link prefilled with their id, plus the id itself. */
export function ReceiveScreen() {
  const { locale } = useI18n()
  const r = fundsCopy[locale].receive
  const p = transactionPinCopy[locale]
  const common = marketCopy[locale].common
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { setUserId(readSession()?.userId ?? null); setOrigin(window.location.origin) }, [])
  useFundsSessionBoundary(() => { setUserId(readSession()?.userId ?? null); setCopied(false) })
  const eligibility = useQuery(typeof userId === 'string' ? 'wallet:transfer-eligibility' : null, getTransferEligibility, { staleTime: 0, loading: 'silent' })
  const link = userId ? `${origin}/assets/cash/transfer?to=${encodeURIComponent(userId)}` : ''

  const copy = async () => {
    if (!userId) return
    try { await navigator.clipboard.writeText(userId); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }
  const share = async () => {
    if (!userId) return
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: r.title, text: r.shareText, url: link }); return } catch (error) { if ((error as Error)?.name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }

  const topbar = <RwaTopbar screen="receive" template="T-Child" l1="close" title={r.title} onBack={() => backOr('/assets/cash')} />
  return <MaisonPage page="receive" className={fs.page} topbar={topbar} cta={typeof userId === 'string'}>
    <h1 className={fp.srTitle}>{r.title}</h1>
    {userId === undefined ? <Skeleton rows={4} />
      : userId === null ? <StateBlock tone="unavailable" title={r.unavailable}
        action={<button type="button" className={s.ghost} onClick={() => signInThenReturn('/assets/cash/receive')}>{r.signIn}<ChevronRight size={15} className={s.chev} /></button>} />
      : <>
        <div className={fs.qrWrap}><div className={fs.qr} role="img" aria-label={r.qr}><QRCodeSVG value={link} size={232} level="M" bgColor="transparent" fgColor="#16130f" /></div></div>
        <p className={fs.scope}><b>{r.qr}</b><br />{r.scope}</p>
        <div className={`${s.notice} ${fs.note}`} data-tone={eligibility.error ? 'error' : eligibility.data?.receivable ? 'info' : 'warn'} role="status">
          <ShieldCheck size={16} aria-hidden="true" /><span>{eligibility.error ? common.unavailable : eligibility.loading || !eligibility.data ? p.eligibility.checking : eligibility.data.receivable ? p.eligibility.eligible : p.receiveLocked}</span>
          {eligibility.error && <button type="button" className={s.link} style={{ minHeight: 44 }} onClick={() => void eligibility.refetch()}>{common.retry}</button>}
        </div>
        {!eligibility.error && eligibility.data?.reason === 'deposit_threshold' && <button type="button" className={fs.flow} onClick={() => openPath('/assets/cash/deposit')}>{p.deposit}<ChevronRight size={14} className={s.chev} aria-hidden="true" /></button>}
        <div className={fs.addrRow}>
          <div><small>{r.idLabel}</small><p className={`${s.mono} ${fs.addrText}`} dir="ltr">{userId}</p></div>
        </div>
        <p className={s.foot}><ShieldCheck size={13} aria-hidden="true" /><span>{r.safety}</span></p>
        <button type="button" className={fs.flow} onClick={() => openPath('/assets/cash/transfer')}><Send size={13} aria-hidden="true" />{r.transfer}<ChevronRight size={14} className={s.chev} aria-hidden="true" /></button>
        <details className={fs.more}>
          <summary><span>{fundsCopy[locale].common.more}</span></summary>
          <div className={fs.moreBody}>
            <p>{p.depositRule}</p>
            <p>{r.lede}</p>
            <p>{r.note}</p>
            <p className={fs.linkText}>{link}</p>
          </div>
        </details>
        <div className={`${s.stickyCta} ${fs.fixedCta}`}>
          <div className={fs.actions}>
            <button type="button" className={s.ghost} onClick={() => void copy()} aria-live="polite">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? r.copied : r.copy}</button>
            <button type="button" className={s.ghost} onClick={() => void share()}><Share2 size={15} />{r.share}</button>
          </div>
        </div>
      </>}
  </MaisonPage>
}

/** `/assets/cash/transfer` — internal USDT transfer to another user id; posts instantly, so consent + idempotency + step-up. */
export function TransferScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const [scanning,setScanning]=useState(false)
  const f = fundsCopy[locale]
  const t = f.transfer
  const p = transactionPinCopy[locale]
  const states = walletCopy[locale].states
  const common = marketCopy[locale].common
  const wallet = useQuery('wallet:detail', getWalletDetail, { staleTime: 15_000 })
  const { run, sheet } = useStepUp()
  const [recipient, setRecipient] = useState(() => queryParam(query, 'to') ?? '')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)
  const [self, setSelf] = useState<string | null>(null)
  useEffect(() => { setSelf(readSession()?.userId ?? null) }, [])
  const keys = useRef(new Map<string, string>())
  const inflight = useRef(false)
  const kit = flowKitCopy(locale)
  const [reviewOpen, setReviewOpen] = useState(false)
  const recents = useRecentRecipients(self)

  const decimals = wallet.data?.asset.decimals ?? 6
  const unit = wallet.data?.asset.code ?? 'USDT'
  const integration = wallet.data?.integration
  const available = wallet.data?.balances.availableAtomic ?? null
  const atomic = amount ? toAtomic(amount, decimals) : null
  const id = recipient.trim().toLowerCase()
  const recipientError = !id ? null : !isUuid(id) ? t.recipientInvalid : self && id === self.toLowerCase() ? t.self : null
  const recipientStatus = useQuery(id && !recipientError && self ? `wallet:recipient:${id}` : null, () => getTransferRecipient(id), { staleTime: 0, loading: 'silent' })
  const fieldError = useMemo(() => {
    if (!amount) return null
    if (!atomic || atomic === '0') return f.errors.WALLET_AMOUNT_INVALID
    if (available !== null && BigInt(atomic) > BigInt(available)) return f.errors.WALLET_INSUFFICIENT_BALANCE
    return null
  }, [amount, atomic, available, f.errors])
  const ready = Boolean(id && !recipientError && recipientStatus.data?.receivable && !recipientStatus.error && !recipientStatus.loading && atomic && !fieldError && consent && wallet.data && !pending)
  const generation = useFundsSessionBoundary(() => {
    setRecipient(''); setAmount(''); setConsent(false); setTouched(false); setPending(false); setServerError(null); setReceipt(null); setScanning(false)
    setSelf(readSession()?.userId ?? null); keys.current.clear(); inflight.current = false
  })
  /** Display-only: never rounds a non-zero micro amount to 0.00; widens to the significant fraction digits. Math stays BigInt. */
  const exact = (value: string | null | undefined) => {
    let digits = 2
    try { if (value) digits = Math.max(2, fromAtomic(value, decimals).split('.')[1]?.length ?? 0) } catch { /* fmtAtomic renders '—' */ }
    return fmtAtomic(value, decimals, unit, digits)
  }

  const submit = async () => {
    setTouched(true)
    if (!ready || !atomic || inflight.current) return
    const epoch = generation.current
    const body: TransferBody = { recipientUserId: id, atomicAmount: atomic }
    // Same intent → same key, so a retry after failure or re-authentication replays rather than duplicates.
    const key = idempotencyKeyForIntent(keys.current, 'POST', TRANSFER_PATH, body)
    inflight.current = true
    setPending(true)
    setServerError(null)
    try {
      const result = await run(stepUpRequired(integration), (reauthentication) => {
        if (epoch !== generation.current) return Promise.resolve({ ok: false as const, error: { status: 0, code: 'SESSION_CHANGED', message: common.errorGeneric } })
        return createTransfer(reauthentication ? { ...body, reauthentication } : body, key)
      }, [
        { label: f.common.amount, value: <strong className={s.num}>{exact(atomic)}</strong> },
        { label: t.to, value: <Addr value={id} head={8} tail={4} /> },
        { label: f.common.fee, value: t.feeValue },
      ])
      if (epoch !== generation.current) return
      if (!result) { setServerError(f.common.cancelled); return }
      if (!result.ok) { setServerError(p.errors[result.error.code] ?? errorText(f, result.error, common.errorGeneric)); void recipientStatus.refetch(); return }
      invalidate(['wallet:', 'portfolio:', 'home:'])
      recents.remember(body.recipientUserId)
      setReviewOpen(false)
      setReceipt(result.data)
    } catch {
      // Fields and key are kept; retrying sends the same idempotent intent.
      if (epoch === generation.current) setServerError(common.errorGeneric)
    } finally {
      if (epoch === generation.current) { inflight.current = false; setPending(false) }
    }
  }
  const again = () => { keys.current.clear(); setReceipt(null); setAmount(''); setConsent(false); setTouched(false); setServerError(null) }
  const [pasteFailed, setPasteFailed] = useState(false)
  /** Accepts a bare user id or a scanned receive link (`…/assets/cash/transfer?to=<id>`). */
  const paste = async () => {
    if (inflight.current) return
    const epoch = generation.current
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (epoch !== generation.current) return
      let value = text
      try { value = new URL(text).searchParams.get('to') ?? text } catch { /* not a URL */ }
      setRecipient(value.replace(/\s/g, ''))
      setServerError(null)
      setConsent(false)
      setPasteFailed(false)
    } catch { if (epoch === generation.current) setPasteFailed(true) }
  }

  const topbar = <RwaTopbar screen="transfer" title={t.title} onBack={() => backOr('/assets/cash')} />
  const short = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`
  if (receipt) return <MaisonPage page="transfer" className={fs.page} topbar={topbar}>
    <h1 className={fp.srTitle}>{t.title}</h1>
    <FlowSuccess title={['completed', 'posted'].includes(receipt.state) ? kit.sentTransfer : stateLabel(states, receipt.state)} pending={!['completed', 'posted'].includes(receipt.state)}
      amount={exact(receipt.atomicAmount).replace(` ${unit}`, '')} unit={unit}
      rows={[
        { label: t.to, value: <bdi dir="ltr" className={s.mono}>{short(receipt.recipientUserId)}</bdi> },
        { label: f.common.fee, value: t.feeValue },
        { label: kit.arrival, value: kit.instant },
        { label: f.common.reference, value: <span className={s.mono} dir="ltr">{receipt.id.slice(0, 8)}</span> },
      ]}
      note={[!receipt.created && f.common.replay, receipt.integration && !receipt.integration.realFunds && f.common.stubNote].filter(Boolean).join(' · ') || undefined}
      onDone={() => openPath('/assets/cash')} onAgain={again} onRecords={() => openPath('/assets/activity?type=funding')} />
  </MaisonPage>
  // The button says what is missing, in the order the user fills the page.
  const eligibility = recipientStatus.error ? kit.unavailable : recipientStatus.loading || !recipientStatus.data ? kit.checking : recipientStatus.data.receivable ? null : recipientStatus.data.reason === 'deposit_threshold' ? p.depositRule : p.eligibility.ineligible
  const talk = !wallet.data ? kit.checking
    : !id ? kit.addRecipient
    : recipientError ?? (eligibility && eligibility !== kit.checking ? eligibility : null)
      ?? (!amount ? kit.enterAmount
        : fieldError === f.errors.WALLET_INSUFFICIENT_BALANCE ? kit.insufficient
        : fieldError ? fieldError
        : eligibility ?? (pending ? f.common.submitting : kit.transferN(exact(atomic))))
  const canReview = Boolean(id && !recipientError && recipientStatus.data?.receivable && !recipientStatus.error && atomic && !fieldError && wallet.data && !pending)
  const amountShown = atomic && !fieldError ? exact(atomic).replace(` ${unit}`, '') : '0'
  return <MaisonPage page="transfer" className={`${fs.page} ${tf.form}`} topbar={topbar}>
    {scanning && <TransferScanner onClose={() => setScanning(false)} onCode={code => { if (inflight.current) return false; const value = transferRecipientFromCode(code, window.location.origin); if (!value) return false; setRecipient(value); setServerError(null); setConsent(false); return true }} />}
    <h1 className={fp.srTitle}>{t.title}</h1>
    {wallet.error && !wallet.data ? <StateBlock tone="error" title={common.errorGeneric} body={wallet.error.message} retry={wallet.refetch} retryLabel={common.retry} />
      : <AmountPad value={amount} onChange={(next) => { setAmount(next); setServerError(null) }} decimals={Math.min(decimals, 6)} unit={unit} disabled={pending}
        invalid={Boolean(fieldError)} error={serverError && !reviewOpen ? serverError : null}
        sub={<>{kit.available(exact(available))}{atomic && !fieldError && unit === 'USDT' ? <> · {kit.approx(fromAtomic(atomic, decimals))}</> : null}</>}
        side={[{ label: '25%', value: share(available, 25, decimals) }, { label: '50%', value: share(available, 50, decimals) }, { label: '75%', value: share(available, 75, decimals) }, { label: kit.max, value: share(available, 100, decimals) }]}
        header={<RecipientField label={t.recipient} value={recipient} disabled={pending} placeholder={t.recipient}
          state={recipientError ? 'invalid' : recipientStatus.data?.receivable && !recipientStatus.error ? 'valid' : undefined}
          onChange={(next) => { setRecipient(next); setServerError(null); setPasteFailed(false); setConsent(false) }}
          status={recipientError ?? (pasteFailed ? t.pasteFailed : id ? (eligibility ?? [recipientStatus.data?.displayName, p.eligibility.eligible].filter(Boolean).join(' · ')) : null)}
          actions={[{ label: kit.paste, icon: <ClipboardPaste size={19} strokeWidth={1.7} />, onClick: () => void paste() }, { label: kit.scan, icon: <QrCode size={19} strokeWidth={1.7} />, onClick: () => setScanning(true) }]}
          recents={{ title: kit.recent, items: recents.items.filter((item) => item !== self).map((item) => ({ key: item, label: <bdi dir="ltr">{short(item)}</bdi>, active: item === id, onPick: () => { setRecipient(item); setServerError(null); setConsent(false) } })) }} />}
        cta={{ label: talk, disabled: !canReview, busy: pending, onClick: () => { setServerError(null); setConsent(false); setReviewOpen(true) } }} />}
    <FlowConfirm open={reviewOpen} onClose={() => { if (!pending) setReviewOpen(false) }} busy={pending} title={kit.reviewTransfer} amount={amountShown} unit={unit}
      rows={[
        { label: t.to, value: id ? <Addr value={id} head={8} tail={4} /> : '—' },
        { label: f.common.fee, value: t.feeValue },
        { label: kit.arrival, value: kit.instant },
        { label: f.common.after, value: atomic && !fieldError && available !== null ? exact((BigInt(available) - BigInt(atomic)).toString()) : '—', strong: true },
      ]}
      note={integration && !integration.realFunds ? f.common.stubNote : undefined}
      consent={{ label: <>{t.consent}{id && !recipientError && <> {fill(t.idTail, { d: id.slice(-4) })}</>}</>, checked: consent, onChange: (checked) => { setConsent(checked); setServerError(null) } }}
      error={serverError} confirmLabel={kit.confirmTransfer} onConfirm={() => void submit()} />
    {sheet}
  </MaisonPage>
}

/** `/assets/cash/address-book` — screened withdrawal destinations with cooldown; add and revoke always need a fresh factor (DTO-enforced). */
export function AddressBookScreen() {
  const { locale } = useI18n()
  const f = fundsCopy[locale]
  const b = f.book
  const common = marketCopy[locale].common
  const book = useQuery('wallet:address-book', listAddressBook, { staleTime: 30_000 })
  const networks = useQuery('wallet:networks', listNetworks, { staleTime: 300_000 })
  const { run, sheet } = useStepUp()
  const list = networks.data?.networks ?? []
  const [adding, setAdding] = useState(false)
  const [network, setNetwork] = useState<string | null>(null)
  const net = list.find((item) => item.id === network) ?? list[0]
  const [label, setLabel] = useState('')
  const [destination, setDestination] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [showRevoked, setShowRevoked] = useState(false)
  const [rows] = useAutoAnimate<HTMLUListElement>({ duration: 220 })

  const entries = book.data?.entries ?? []
  const live = entries.filter((entry) => entry.state !== 'revoked')
  const revoked = entries.filter((entry) => entry.state === 'revoked')
  const addressOk = net ? isValidAddress(net.id, destination) : false
  const labelOk = label.trim().length > 0 && label.trim().length <= 80
  const hours = Math.round((book.data?.policy.cooldownSeconds ?? networks.data?.integration.withdrawalControls.addressCooldownSeconds ?? 0) / 3600)
  const nameOf = (id: string) => list.find((item) => item.id === id)?.displayName ?? id

  const save = async () => {
    setTouched(true)
    if (!net || !addressOk || !labelOk || busy) return
    setBusy('add')
    setNotice(null)
    const result = await run(true, (reauthentication) => addAddress({ network: net.id, destination, label: label.trim(), reauthentication: reauthentication ?? '' }), [
      { label: b.label, value: label.trim() }, { label: f.common.network, value: net.displayName }, { label: f.withdraw.to, value: <Addr value={destination} /> },
    ])
    setBusy(null)
    if (!result) { setNotice({ tone: 'error', text: f.common.cancelled }); return }
    if (!result.ok) { setNotice({ tone: 'error', text: errorText(f, result.error, common.errorGeneric) }); return }
    setNotice({ tone: 'info', text: fill(b.saved, { t: fmtDateTime(result.data.cooldownUntil, locale) }) })
    setAdding(false); setLabel(''); setDestination(''); setTouched(false)
    invalidate(['wallet:address-book'])
  }
  const revoke = async (entry: AddressBookEntry) => {
    if (busy) return
    setBusy(entry.id)
    setNotice(null)
    const result = await run(true, (reauthentication) => revokeAddress(entry.id, reauthentication ?? ''), [
      { label: b.revoke, value: entry.label }, { label: f.common.network, value: nameOf(entry.network) }, { label: f.withdraw.to, value: <Addr value={entry.destination} /> },
    ])
    setBusy(null)
    setConfirming(null)
    if (!result) { setNotice({ tone: 'error', text: f.common.cancelled }); return }
    if (!result.ok) { setNotice({ tone: 'error', text: errorText(f, result.error, common.errorGeneric) }); return }
    setNotice({ tone: 'info', text: b.revoked })
    invalidate(['wallet:address-book'])
  }

  const item = (entry: AddressBookEntry) => <li key={entry.id} className={s.bookItem} data-state={entry.state}>
    <header><b>{entry.label}</b><span className={s.badge}>{nameOf(entry.network)}</span></header>
    <p className={s.mono} dir="ltr" style={{ textAlign: 'start' }}>{entry.destination}</p>
    <div className={s.pickBadges} style={{ justifyContent: 'flex-start', marginTop: 8 }}>
      <span className={s.badge} data-tone={stateTone(entry.state)}>{b.states[entry.state] ?? entry.state}</span>
      {entry.state !== 'revoked' && <span className={s.badge} data-tone={stateTone(entry.riskState === 'clear' ? 'active' : entry.riskState)}>{b.risk[entry.riskState] ?? entry.riskState}</span>}
    </div>
    {entry.state === 'pending' && <p>{fill(b.usableFrom, { t: fmtDateTime(entry.cooldownUntil, locale) })}</p>}
    {entry.state !== 'revoked' && <div className={s.actionsRow} style={{ marginTop: 8 }}>
      {confirming === entry.id ? <>
        <button type="button" className={s.ghost} data-size="s" onClick={() => void revoke(entry)} disabled={Boolean(busy)} aria-busy={busy === entry.id}>{busy === entry.id ? b.revoking : b.revokeConfirm}</button>
        <button type="button" className={s.link} onClick={() => setConfirming(null)} disabled={busy === entry.id}>{f.stepUp.cancel}</button>
      </> : <button type="button" className={s.link} onClick={() => setConfirming(entry.id)}>{b.revoke}</button>}
    </div>}
  </li>

  return <MaisonPage page="address-book" topbar={<RwaTopbar screen="address-book" title={b.title} onSlot={(slot) => { if (slot === 'plus') { setAdding(true); setNotice(null) } else backOr('/assets/cash') }} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{b.kicker}</p>
      <h1 className={s.titleL}>{b.title}</h1>
      {hours > 0 && <p className={s.lede}>{fill(b.note, { h: String(hours) })}</p>}
    </header>
    {notice && <div className={s.notice} data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.tone === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}<span>{notice.text}</span></div>}

    {!adding ? <button type="button" className={s.ghost} style={{ width: '100%', marginTop: 12 }} onClick={() => { setAdding(true); setNotice(null) }}><Plus size={15} />{b.add}</button>
      : !net ? (networks.error ? <StateBlock tone="error" title={common.errorGeneric} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} /> : <Skeleton rows={3} />)
      : <div className={s.card} style={{ marginTop: 12 }}>
        <p className={s.kicker}>{b.add}</p>
        <div style={{ marginTop: 8 }}><Segmented value={net.id} onChange={(id) => { setNetwork(id); setDestination('') }} label={f.common.network} role="group" options={list.map((n) => ({ value: n.id, label: n.displayName }))} /></div>
        <form onSubmit={(event) => { event.preventDefault(); void save() }} data-book-form="">
          <label className={s.field}><span>{b.label}</span>
            <input value={label} maxLength={80} placeholder={b.labelHint} aria-invalid={touched && !labelOk} onChange={(event) => setLabel(event.target.value)} style={{ fontFamily: 'var(--m-sans)', direction: 'inherit' }} />
          </label>
          {touched && !labelOk && <p className={s.fieldError} role="alert">{b.labelRequired}</p>}
          <label className={s.field}><span>{fill(f.withdraw.address, { n: net.displayName })}</span>
            <input value={destination} autoComplete="off" spellCheck={false} placeholder={net.id === 'tron' ? 'T…' : '0x…'} aria-invalid={destination.length > 0 && !addressOk} onChange={(event) => setDestination(event.target.value.replace(/\s/g, ''))} />
          </label>
          {destination.length > 0 && !addressOk && <p className={s.fieldError} role="alert">{fill(f.withdraw.addressInvalid, { n: net.displayName })}</p>}
          <p className={s.foot}><span>{f.stepUp.required}</span></p>
          <button type="submit" className={s.cta} style={{ marginTop: 12 }} disabled={Boolean(busy) || !addressOk || !labelOk} aria-busy={busy === 'add'}>
            <span>{busy === 'add' ? b.saving : b.save}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span>
          </button>
          <button type="button" className={s.link} style={{ marginTop: 10 }} onClick={() => { setAdding(false); setTouched(false) }}>{b.close}</button>
        </form>
      </div>}

    <div style={{ marginTop: 18 }}>
      {book.error && !book.data ? <StateBlock tone="error" title={b.loadError} body={book.error.message} retry={book.refetch} retryLabel={common.retry} />
        : !book.data ? <Skeleton rows={3} />
        : !live.length && !revoked.length ? <StateBlock title={b.empty} body={b.emptyBody} />
        : <>
          <ul className={s.list} ref={rows}>{live.map(item)}{showRevoked && revoked.map(item)}</ul>
          {revoked.length > 0 && <button type="button" className={s.link} style={{ marginTop: 12 }} onClick={() => setShowRevoked((v) => !v)} aria-expanded={showRevoked}>{showRevoked ? b.hideRevoked : fill(b.showRevoked, { n: String(revoked.length) })}</button>}
        </>}
    </div>
    <button type="button" className={s.link} style={{ marginTop: 18 }} onClick={() => openPath('/assets/cash/withdraw')}>{f.withdraw.title}<ChevronRight size={13} /></button>
    {sheet}
  </MaisonPage>
}
