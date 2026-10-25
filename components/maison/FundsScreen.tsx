'use client'

import { AlertTriangle, ArrowRight, ArrowUpFromLine, BookUser, Check, ChevronRight, ClipboardPaste, Copy, Info, Loader2, Plus, QrCode, Send, Share2, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {TransferScanner} from './TransferScanner'
import {transferRecipientFromCode} from '@/lib/transfer-code'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { Lacquer, Segmented, useAutoAnimate } from './motion'
import { fmtAtomic, fmtDateTime } from './format'
import { stepUpRequired, useStepUp } from './StepUp'
import { getTransactionPinStatus, pinErrorDetails, pinGate } from '@/lib/api/transaction-pin'
import { transactionPinCopy } from '@/lib/maison-transaction-pin-copy'
import { TransactionPinManager, TransactionPinPrompt } from './TransactionPin'
import fp from './funds-polish.module.css'
import fs from './funds-fullscreen.module.css'
import { usePaletteA } from '@/lib/palette-preview'
import tf from './transfer-feedback.module.css'
import { AmountPad, FlowConfirm, FlowSuccess, RecipientField, share, useRecentRecipients } from './flow-kit'
import { flowKitCopy } from '@/lib/flow-kit-copy'

const WITHDRAW_PATH = '/v1/wallet/withdrawals'
const TRANSFER_PATH = '/v1/wallet/transfers'
const ZERO = BigInt(0)
const mask = (value: string) => value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
const sanitize = (value: string) => value.replace(',', '.').replace(/[^\d.]/g, '')
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

/** Shared amount field: sanitized decimal input, available + minimum line, optional MAX. */
function AmountField({ id, value, onChange, unit, available, min, max, error, touched, onBlur, label, maxLabel, preserveRaw = false, disabled = false }: {
  id: string; value: string; onChange: (value: string) => void; unit: string; available: ReactNode; min?: ReactNode; max?: string | null; error: string | null; touched: boolean; onBlur: () => void; label: string; maxLabel: string
  /** Keep the typed text (comma → dot only) so toAtomic rejects signs and stray characters instead of silently dropping them. */
  preserveRaw?: boolean; disabled?: boolean
}) {
  const paletteA = usePaletteA()
  const maxButton = max ? <button type="button" className={`${s.chip} ${fs.maxChip}`} style={paletteA ? undefined : { minHeight: 44, minWidth: 64 }} aria-pressed={value === max} disabled={disabled} onClick={() => onChange(max)}>{maxLabel}</button> : null
  return <>
    <label className={`${s.kicker} ${fs.label}`} htmlFor={id}>{label}</label>
    <div className={`${s.amount} ${fs.amount}`} data-inline-max={paletteA && max ? 'true' : undefined}>
      <input id={id} inputMode="decimal" autoComplete="off" placeholder="0.00" value={value} disabled={disabled} aria-invalid={Boolean(error && touched)} aria-describedby={`${id}-meta`} onChange={(event) => onChange(preserveRaw ? event.target.value.replace(',', '.') : sanitize(event.target.value))} onBlur={onBlur} />
      <span>{unit}</span>
      {paletteA && maxButton}
    </div>
    <div className={`${s.fieldMeta} ${fs.meta}`} id={`${id}-meta`}><span>{available}</span>{min && <span className={s.num}>{min}</span>}</div>
    {touched && error && <p className={s.fieldError} role="alert">{error}</p>}
    {!paletteA && maxButton && <div className={fs.maxRow}>{maxButton}</div>}
  </>
}

/** Address-like ids read by their ends: `head…tail`, isolated LTR so it never reorders inside RTL copy. */
function Addr({ value, head = 6, tail = 6 }: { value: string; head?: number; tail?: number }) {
  if (value.length <= head + tail + 1) return <bdi className={s.addr} dir="ltr"><b>{value}</b></bdi>
  return <bdi className={s.addr} dir="ltr"><b>{value.slice(0, head)}</b><i>…</i><b>{value.slice(-tail)}</b></bdi>
}

/** One card, one exit: notes sit inside the card as a quiet line; secondary paths are text links. */
function Receipt({ title, rows, created, integration, onAgain, f }: { title: string; rows: { label: string; value: ReactNode }[]; created: boolean; integration?: { realFunds: boolean } | null; onAgain: () => void; f: FundsCopy }) {
  const notes = [!created && f.common.replay, integration && !integration.realFunds && f.common.stubNote].filter(Boolean)
  return <div data-receipt="">
    <Lacquer aria-live="polite">
      <div className={s.receiptHead}><Check size={20} aria-hidden="true" /><b className={s.sheetTitle} style={{ margin: 0, fontSize: 24 }}>{title}</b></div>
      <dl className={s.summary}>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd className={s.num}>{row.value}</dd></div>)}</dl>
      {notes.length > 0 && <p className={s.foot} role={created ? undefined : 'status'} style={{ marginTop: 12 }}><Info size={13} aria-hidden="true" /><span>{notes.join(' · ')}</span></p>}
    </Lacquer>
    <button type="button" className={s.ghost} style={{ width: '100%', marginTop: 16 }} onClick={() => openPath('/assets/cash')}>{f.common.done}</button>
    <p className={s.foot} style={{ justifyContent: 'center', gap: 4 }}>
      <button type="button" className={s.link} style={{ minHeight: 44 }} onClick={() => openPath('/assets/activity?type=funding')}>{f.common.activity}</button>
      <span aria-hidden="true">·</span>
      <button type="button" className={s.link} style={{ minHeight: 44 }} onClick={onAgain}>{f.common.again}</button>
    </p>
  </div>
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
  const [picks] = useAutoAnimate<HTMLUListElement>({ duration: 200 })

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
  if (receipt) return <MaisonPage page="withdraw" className={fs.page} topbar={topbar}>
    <h1 className={fp.srTitle}>{w.title}</h1>
    <Receipt f={f} title={w.done} created={receipt.created} integration={receipt.integration} onAgain={again} rows={[
      { label: f.common.reference, value: <span className={s.mono} dir="ltr" data-ref="">{receipt.id.slice(0, 8)}</span> },
      { label: f.common.state, value: <span className={s.badge} data-tone={stateTone(receipt.state)}>{stateLabel(states, receipt.state)}</span> },
      { label: f.common.amount, value: fmtAtomic(receipt.atomicAmount, decimals, unit) },
      { label: f.common.fee, value: fmtAtomic(receipt.feeAtomicAmount, decimals, unit) },
      { label: f.common.network, value: list.find((item) => item.id === receipt.network)?.displayName ?? receipt.network },
      { label: w.to, value: <bdi dir="ltr" className={s.mono}>{receipt.to}</bdi> },
      ...(receipt.reasonCode ? [{ label: w.reason, value: w.reasons[receipt.reasonCode] ?? <span className={s.mono}>{receipt.reasonCode}</span> }] : []),
    ]} />
  </MaisonPage>

  return <MaisonPage page="withdraw" className={fs.page} topbar={topbar} cta>
    {pinManager && <TransactionPinManager open mode="setup" onClose={() => setPinManager(false)} onDone={() => { setPinManager(false); void pinStatus.refetch() }} />}
    {pinPrompt && <TransactionPinPrompt open busy={pending} onClose={() => setPinPrompt(false)} onConfirm={confirmPin} summary={[
      { label: f.common.amount, value: network && atomic ? fmtAtomic(atomic, decimals, unit) : '—' },
      { label: f.common.network, value: network?.displayName ?? '—' }, { label: w.to, value: destinationLine },
      { label: f.common.fee, value: fmtAtomic(current?.data?.feeAtomicAmount ?? network?.withdrawalFeeAtomic, decimals, unit) },
    ]} />}
    <h1 className={fp.srTitle}>{w.title}</h1>
    {networks.error && !networks.data ? <StateBlock tone="error" title={common.errorGeneric} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} />
      : !network ? <Skeleton rows={5} />
      : <>
        <p className={`${s.kicker} ${fs.label} ${fs.first}`}>{f.common.network}</p>
        <div className={fp.touchSeg}><Segmented value={network.id} onChange={choose} label={f.common.network} role="group" options={list.map((item) => ({ value: item.id, label: item.displayName }))} /></div>

        <p className={`${s.kicker} ${fs.label}`}>{w.destination}</p>
        {!bookRequired && <div className={fp.touchSeg}><Segmented value={mode} onChange={(next) => { setModePick(next); setServerError(null) }} label={w.destination} role="group" options={[{ value: 'saved', label: w.saved }, { value: 'manual', label: w.manual }]} /></div>}
        {bookRequired && <div className={`${s.notice} ${fs.note}`} data-tone="info"><Info size={16} /><span>{w.bookRequired}</span></div>}
        {mode === 'saved' ? (book.error && !book.data ? <StateBlock tone="error" title={f.book.loadError} body={book.error.message} retry={book.refetch} retryLabel={common.retry} />
          : !book.data ? <Skeleton rows={2} />
          : !entries.length ? <StateBlock title={fill(w.bookEmpty, { n: network.displayName })} action={<button type="button" className={s.link} style={{ minHeight: 44 }} onClick={() => openPath('/assets/cash/address-book')}><BookUser size={13} />{w.manageBook}</button>} />
          : <ul className={`${s.pickList} ${fs.pickList}`} ref={picks} role="radiogroup" aria-label={w.destination}>{entries.map((item) => {
            const ok = usable(item)
            return <li key={item.id}><button type="button" role="radio" className={`${s.pick} ${fs.pickRow}`} aria-checked={entry?.id === item.id} disabled={!ok} onClick={() => { setEntryId(item.id); setServerError(null) }}>
              <i aria-hidden="true" />
              <span><b>{item.label}</b><small className={s.mono} dir="ltr">{mask(item.destination)}</small>
                {item.state === 'pending' && <small>{fill(w.usableFrom, { t: fmtDateTime(item.cooldownUntil, locale) })}</small>}</span>
              <span className={s.pickBadges}>
                <span className={s.badge} data-tone={stateTone(item.state)}>{f.book.states[item.state] ?? item.state}</span>
                {item.riskState !== 'clear' && <span className={s.badge} data-tone={stateTone(item.riskState)}>{f.book.risk[item.riskState] ?? item.riskState}</span>}
              </span>
            </button></li>
          })}</ul>)
          : <label className={`${s.field} ${fs.field}`}>
            <span>{fill(w.address, { n: network.displayName })}</span>
            <input value={destination} autoComplete="off" spellCheck={false} placeholder={network.id === 'tron' ? 'T…' : '0x…'} aria-invalid={destination.length > 0 && !addressOk} aria-describedby="withdraw-address-error"
              onChange={(event) => { setDestination(event.target.value.replace(/\s/g, '')); setServerError(null) }} />
          </label>}
        {mode === 'manual' && destination.length > 0 && !addressOk && <p className={s.fieldError} id="withdraw-address-error" role="alert">{fill(w.addressInvalid, { n: network.displayName })}</p>}
        {mode === 'saved' && entries.length > 0 && <button type="button" className={s.link} style={{ marginTop: 6, minHeight: 44 }} onClick={() => openPath('/assets/cash/address-book')}><BookUser size={13} />{w.manageBook}</button>}

        <AmountField id="withdraw-amount" label={f.common.amount} unit={unit} value={amount} onChange={(next) => { setAmount(next); setServerError(null) }} touched={touched || amount.length > 0} onBlur={() => setTouched(true)} error={fieldError} maxLabel={f.common.max}
          max={maxAtomic ? fromAtomic(maxAtomic, decimals) : null}
          available={!wallet.data && !wallet.error ? '…' : wallet.error && !wallet.data ? <button type="button" className={s.link} onClick={wallet.refetch}>{common.unavailable} · {common.retry}</button> : fill(f.common.available, { v: fmtAtomic(available, decimals, unit) })}
          min={fill(f.common.min, { v: fmtAtomic(network.minimumWithdrawalAtomic, decimals, '', 0).trim() })} />

        <div aria-live="polite">
          <dl className={`${s.summary} ${fs.rows}`} data-ready={Boolean(atomic && !fieldError) || undefined}>
            <div><dt>{w.to}</dt><dd>{destinationLine}</dd></div>
            <div><dt>{f.common.amount}</dt><dd className={s.num}>{atomic && !fieldError ? fmtAtomic(atomic, decimals, unit) : '—'}</dd></div>
            <div data-keep="true"><dt>{f.common.fee}</dt><dd className={s.num}>{current?.data ? fmtAtomic(current.data.feeAtomicAmount, decimals, unit) : fmtAtomic(network.withdrawalFeeAtomic, decimals, unit)}</dd></div>
            <div data-strong="true"><dt>{w.total}</dt><dd className={s.num}>{current?.data ? fmtAtomic(current.data.totalDebitAtomic, decimals, unit) : '—'}</dd></div>
            <div><dt>{f.common.after}</dt><dd className={s.num}>{current?.data && !insufficient ? fmtAtomic((BigInt(current.data.availableAtomic) - BigInt(current.data.totalDebitAtomic)).toString(), decimals, unit) : '—'}</dd></div>
          </dl>
          <p className={`${s.muted} ${fp.quoteNote} ${fs.quote}`} data-quote-state={!quoteKey ? 'idle' : !current ? 'loading' : current.error ? 'error' : 'ready'}>
            {!quoteKey ? null : !current ? w.quoting : current.error ? <>{w.quoteError} · {current.error} · <button type="button" className={s.link} onClick={() => setQuoteNonce((n) => n + 1)}>{common.retry}</button></> : insufficient ? w.insufficient : w.indicative}
          </p>
        </div>
        {integration && !integration.realFunds && <div className={`${s.notice} ${fs.note}`} data-tone="info"><Info size={16} /><span>{f.common.stubNote}</span></div>}
        <details className={fs.more}>
          <summary><span>{f.common.more}</span></summary>
          <div className={fs.moreBody}><p>{stepUpRequired(integration) ? f.stepUp.required : f.stepUp.waived}</p></div>
        </details>

        <div className={`${s.stickyCta} ${fs.fixedCta}`}>
          <label className={`${s.consent} ${fs.consent}`}>
            <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setServerError(null) }} />
            <span>{w.consent}</span>
          </label>
          {serverError && <div className={`${s.notice} ${fs.note}`} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}
          {knownGate && knownGate !== 'ready' && knownGate !== 'unset' && <p className={s.foot} role="status">{p.gate[knownGate]}{pinStatus.data && (knownGate === 'locked' ? pinStatus.data.lockedUntil : knownGate === 'cooldown' ? pinStatus.data.withdrawalBlockedUntil : null) && <> · {fmtDateTime((knownGate === 'locked' ? pinStatus.data.lockedUntil : pinStatus.data.withdrawalBlockedUntil)!, locale)}</>}</p>}
          <button type="button" className={s.cta} onClick={submit} disabled={pending || (knownGate !== null && !['ready', 'unset'].includes(knownGate)) || (!ready && knownGate !== 'unset')} aria-busy={pending}>
            <span>{pending ? f.common.submitting : knownGate === 'unset' ? p.title.setup : w.submit}</span>
            <span className={s.ctaIcon}><ArrowUpFromLine size={17} /></span>
          </button>
          <p className={s.foot} style={{ justifyContent: 'center', gap: 16 }}>
            <button type="button" className={s.link} style={{ minHeight: 44 }} disabled={pending || pinStatus.loading} onClick={() => void pinStatus.refetch()}>{p.refresh}</button>
            {pinStatus.data?.configured && <button type="button" className={s.link} style={{ minHeight: 44 }} disabled={pending} onClick={() => openPath('/profile/security')}>{p.forgot}</button>}
          </p>
        </div>
      </>}
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
  const paletteA = usePaletteA()
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
  if (paletteA) {
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
  if (receipt) return <MaisonPage page="transfer" className={fs.page} topbar={topbar}>
    <h1 className={fp.srTitle}>{t.title}</h1>
    <div className={tf.receipt} data-tone={stateTone(receipt.state)}>
      <Receipt f={f} title={['completed', 'posted'].includes(receipt.state) ? t.done : stateLabel(states, receipt.state)} created={receipt.created} integration={receipt.integration} onAgain={again} rows={[
        { label: f.common.reference, value: <span className={s.mono} dir="ltr" data-ref="">{receipt.id.slice(0, 8)}</span> },
        { label: f.common.state, value: <span className={s.badge} data-tone={stateTone(receipt.state)}>{stateLabel(states, receipt.state)}</span> },
        { label: f.common.amount, value: exact(receipt.atomicAmount) },
        { label: f.common.fee, value: t.feeValue },
        { label: t.to, value: <bdi dir="ltr" className={s.mono}>{mask(receipt.recipientUserId)}</bdi> },
      ]} />
    </div>
  </MaisonPage>

  return <MaisonPage page="transfer" className={`${fs.page} ${tf.form}`} topbar={topbar} cta>
    {scanning&&<TransferScanner onClose={()=>setScanning(false)} onCode={code=>{if(inflight.current)return false;const value=transferRecipientFromCode(code,window.location.origin);if(!value)return false;setRecipient(value);setServerError(null);setConsent(false);return true}}/>}
    <h1 className={fp.srTitle}>{t.title}</h1>
    {wallet.error && !wallet.data ? <StateBlock tone="error" title={common.errorGeneric} body={wallet.error.message} retry={wallet.refetch} retryLabel={common.retry} />
      : !wallet.data ? <Skeleton rows={4} />
      : <>
        <label className={`${s.field} ${fs.field} ${fs.first} ${tf.field}`} data-invalid={Boolean(recipientError) || undefined} data-valid={(!recipientStatus.error && recipientStatus.data?.receivable) || undefined}>
          <span>{t.recipient}</span>
          <input value={recipient} disabled={pending} autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" aria-invalid={Boolean(recipientError)} aria-describedby="transfer-recipient-meta"
            onChange={(event) => { setRecipient(event.target.value.replace(/\s/g, '')); setServerError(null); setPasteFailed(false); setConsent(false) }} />
        </label>
        <div className={fs.actions}>
          <button type="button" className={s.ghost} disabled={pending} onClick={() => void paste()}><ClipboardPaste size={15} aria-hidden="true" />{t.paste}</button>
          <button type="button" className={s.ghost} disabled={pending} onClick={() => setScanning(true)}><QrCode size={15} aria-hidden="true" />{t.scan}</button>
        </div>
        {recipientError ? <p className={s.fieldError} id="transfer-recipient-meta" role="alert">{recipientError}</p> : pasteFailed ? <p className={fs.hint} id="transfer-recipient-meta" role="status">{t.pasteFailed}</p> : null}
        {id && !recipientError && <p className={fs.hint} role="status" data-recipient-status="">
          {recipientStatus.error ? <>{common.unavailable} · <button type="button" className={s.link} style={{ minHeight: 44 }} onClick={() => void recipientStatus.refetch()}>{common.retry}</button></> : recipientStatus.loading || !recipientStatus.data ? p.eligibility.checking : recipientStatus.data.receivable ? p.eligibility.eligible : recipientStatus.data.reason === 'deposit_threshold' ? p.depositRule : p.eligibility.ineligible}
        </p>}
        <button type="button" className={fs.flow} onClick={() => openPath('/assets/cash/receive')}><QrCode size={14} aria-hidden="true" />{t.myCode}<ChevronRight size={14} className={s.chev} aria-hidden="true" /></button>

        <div className={tf.amount} data-invalid={Boolean(fieldError && (touched || amount.length > 0)) || undefined}>
          <AmountField id="transfer-amount" label={f.common.amount} unit={unit} value={amount} onChange={(next) => { setAmount(next); setServerError(null) }} touched={touched || amount.length > 0} onBlur={() => setTouched(true)} error={fieldError} maxLabel={f.common.max} preserveRaw disabled={pending}
            max={available && BigInt(available) > ZERO ? fromAtomic(available, decimals) : null} available={fill(f.common.available, { v: exact(available) })} />
        </div>

        <div aria-live="polite">
          <dl className={`${s.summary} ${fs.rows}`} data-ready={Boolean(atomic && !fieldError) || undefined}>
            <div><dt>{t.to}</dt><dd>{id && !recipientError ? <Addr value={id} head={8} tail={4} /> : '—'}</dd></div>
            <div data-keep="true"><dt>{f.common.fee}</dt><dd className={s.num}>{t.feeValue}</dd></div>
            <div data-strong="true"><dt>{f.common.amount}</dt><dd className={s.num}>{atomic && !fieldError ? exact(atomic) : '—'}</dd></div>
            <div><dt>{f.common.after}</dt><dd className={s.num}>{atomic && !fieldError && available !== null ? exact((BigInt(available) - BigInt(atomic)).toString()) : '—'}</dd></div>
          </dl>
        </div>
        {integration && !integration.realFunds && <div className={`${s.notice} ${fs.note}`} data-tone="info"><Info size={16} /><span>{f.common.stubNote}</span></div>}
        <details className={fs.more}>
          <summary><span>{f.common.more}</span></summary>
          <div className={fs.moreBody}>
            {!recipientError && !pasteFailed && <p id="transfer-recipient-meta">{t.recipientHint}</p>}
            <p>{stepUpRequired(integration) ? f.stepUp.required : f.stepUp.waived}</p>
          </div>
        </details>
        <div className={`${s.stickyCta} ${fs.fixedCta}`}>
          <label className={`${s.consent} ${fs.consent}`}>
            <input type="checkbox" checked={consent} disabled={pending} onChange={(event) => { setConsent(event.target.checked); setServerError(null) }} />
            <span>{t.consent}{id && !recipientError && <> {fill(t.idTail, { d: id.slice(-4) })}</>}</span>
          </label>
          {serverError && <div className={`${s.notice} ${fs.note} ${tf.error}`} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}
          <button type="button" className={`${s.cta} ${tf.cta}`} onClick={submit} disabled={!ready} aria-busy={pending}>
            <span>{pending ? f.common.submitting : t.submit}</span>
            <span className={s.ctaIcon}>{pending ? <Loader2 size={17} className={tf.spin} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}</span>
          </button>
        </div>
      </>}
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
