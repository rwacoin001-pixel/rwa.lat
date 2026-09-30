'use client'

import { AlertTriangle, ArrowRight, ArrowUpFromLine, BookUser, Check, ChevronRight, ClipboardPaste, Copy, Info, Plus, QrCode, Send, Share2, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { readSession, type ApiError } from '@/lib/api/_http'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import {
  addAddress, createTransfer, createWithdrawal, getWalletDetail, isUuid, isValidAddress, listAddressBook, listNetworks, quoteWithdrawal, revokeAddress,
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
function AmountField({ id, value, onChange, unit, available, min, max, error, touched, onBlur, label, maxLabel }: {
  id: string; value: string; onChange: (value: string) => void; unit: string; available: ReactNode; min?: ReactNode; max?: string | null; error: string | null; touched: boolean; onBlur: () => void; label: string; maxLabel: string
}) {
  return <>
    <label className={s.kicker} htmlFor={id} style={{ marginTop: 18 }}>{label}</label>
    <div className={s.amount}>
      <input id={id} inputMode="decimal" autoComplete="off" placeholder="0.00" value={value} aria-invalid={Boolean(error && touched)} aria-describedby={`${id}-meta`} onChange={(event) => onChange(sanitize(event.target.value))} onBlur={onBlur} />
      <span>{unit}</span>
    </div>
    <div className={s.fieldMeta} id={`${id}-meta`}><span>{available}</span>{min && <span className={s.num}>{min}</span>}</div>
    {touched && error && <p className={s.fieldError} role="alert">{error}</p>}
    {max && <div className={s.chips}><button type="button" className={s.chip} aria-pressed={value === max} onClick={() => onChange(max)}>{maxLabel}</button></div>}
  </>
}

function Receipt({ title, rows, created, integration, onAgain, f }: { title: string; rows: { label: string; value: ReactNode }[]; created: boolean; integration?: { realFunds: boolean } | null; onAgain: () => void; f: FundsCopy }) {
  return <div data-receipt="">
    <Lacquer aria-live="polite">
      <div className={s.receiptHead}><Check size={20} aria-hidden="true" /><b className={s.sheetTitle} style={{ margin: 0, fontSize: 24 }}>{title}</b></div>
      <dl className={s.summary}>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd className={s.num}>{row.value}</dd></div>)}</dl>
    </Lacquer>
    {!created && <div className={s.notice} data-tone="info" role="status"><Info size={16} /><span>{f.common.replay}</span></div>}
    {integration && !integration.realFunds && <div className={s.notice} data-tone="info"><Info size={16} /><span>{f.common.stubNote}</span></div>}
    <div className={s.actionsRow}>
      <button type="button" className={s.ghost} onClick={() => openPath('/assets/activity?type=funding')}>{f.common.activity}<ChevronRight size={14} /></button>
      <button type="button" className={s.ghost} onClick={() => openPath('/assets/cash')}>{f.common.cash}</button>
      <button type="button" className={s.link} onClick={onAgain}>{f.common.again}</button>
    </div>
  </div>
}

function usable(entry: AddressBookEntry) { return entry.state === 'active' && entry.riskState === 'clear' }

/** `/assets/cash/withdraw` — network, destination (saved or new), amount, server quote, consent, then an idempotent request behind step-up. */
export function WithdrawScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const f = fundsCopy[locale]
  const w = f.withdraw
  const states = walletCopy[locale].states
  const common = marketCopy[locale].common
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

  const choose = (id: string) => { setPicked(id); setEntryId(null); setDestination(''); setServerError(null); setQuery('network', id) }

  const submit = async () => {
    setTouched(true)
    if (!ready || !network || !atomic || inflight.current) return
    const body: WithdrawalBody = { network: network.id, atomicAmount: atomic, ...(mode === 'saved' && entry ? { addressBookId: entry.id } : { destination: destination.trim() }) }
    // Keyed on the body without the step-up token, so a retry after re-authentication replays the same request.
    const key = idempotencyKeyForIntent(keys.current, 'POST', WITHDRAW_PATH, body)
    inflight.current = true
    setPending(true)
    setServerError(null)
    const result = await run(stepUpRequired(integration), (reauthentication) => createWithdrawal(reauthentication ? { ...body, reauthentication } : body, key))
    inflight.current = false
    setPending(false)
    if (!result) { setServerError(f.common.cancelled); return }
    if (!result.ok) {
      setServerError(errorText(f, result.error, common.errorGeneric))
      if (['WALLET_INSUFFICIENT_BALANCE', 'WALLET_AMOUNT_BELOW_MINIMUM'].includes(result.error.code)) setQuoteNonce((n) => n + 1)
      return
    }
    invalidate(['wallet:', 'portfolio:', 'home:'])
    setReceipt({ ...result.data, to: mode === 'saved' && entry ? `${entry.label} · ${mask(entry.destination)}` : mask(destination.trim()) })
  }
  const again = () => { keys.current.clear(); setReceipt(null); setAmount(''); setConsent(false); setTouched(false); setServerError(null) }

  const topbar = <RwaTopbar screen="withdraw" title={w.title} onBack={() => backOr('/assets/cash')} />
  if (receipt) return <MaisonPage page="withdraw" topbar={topbar}>
    <header className={s.hero}><p className={s.kicker}>{w.kicker}</p><h1 className={s.titleL}>{w.title}</h1></header>
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

  return <MaisonPage page="withdraw" topbar={topbar} cta>
    <header className={s.hero}>
      <p className={s.kicker}>{w.kicker}</p>
      <h1 className={s.titleL}>{w.title}</h1>
    </header>
    {networks.error && !networks.data ? <StateBlock tone="error" title={common.errorGeneric} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} />
      : !network ? <Skeleton rows={5} />
      : <>
        <p className={s.kicker}>{f.common.network}</p>
        <Segmented value={network.id} onChange={choose} label={f.common.network} role="group" options={list.map((item) => ({ value: item.id, label: item.displayName }))} />

        <p className={s.kicker} style={{ marginTop: 18 }}>{w.destination}</p>
        {!bookRequired && <Segmented value={mode} onChange={(next) => { setModePick(next); setServerError(null) }} label={w.destination} role="group" options={[{ value: 'saved', label: w.saved }, { value: 'manual', label: w.manual }]} />}
        {bookRequired && <div className={s.notice} data-tone="info"><Info size={16} /><span>{w.bookRequired}</span></div>}
        {mode === 'saved' ? (book.error && !book.data ? <StateBlock tone="error" title={f.book.loadError} body={book.error.message} retry={book.refetch} retryLabel={common.retry} />
          : !book.data ? <Skeleton rows={2} />
          : !entries.length ? <StateBlock title={fill(w.bookEmpty, { n: network.displayName })} action={<button type="button" className={s.link} onClick={() => openPath('/assets/cash/address-book')}><BookUser size={13} />{w.manageBook}</button>} />
          : <ul className={s.pickList} ref={picks} role="radiogroup" aria-label={w.destination}>{entries.map((item) => {
            const ok = usable(item)
            return <li key={item.id}><button type="button" role="radio" className={s.pick} aria-checked={entry?.id === item.id} disabled={!ok} onClick={() => { setEntryId(item.id); setServerError(null) }}>
              <i aria-hidden="true" />
              <span><b>{item.label}</b><small className={s.mono} dir="ltr">{mask(item.destination)}</small>
                {item.state === 'pending' && <small>{fill(w.usableFrom, { t: fmtDateTime(item.cooldownUntil, locale) })}</small>}</span>
              <span className={s.pickBadges}>
                <span className={s.badge} data-tone={stateTone(item.state)}>{f.book.states[item.state] ?? item.state}</span>
                {item.riskState !== 'clear' && <span className={s.badge} data-tone={stateTone(item.riskState)}>{f.book.risk[item.riskState] ?? item.riskState}</span>}
              </span>
            </button></li>
          })}</ul>)
          : <label className={s.field}>
            <span>{fill(w.address, { n: network.displayName })}</span>
            <input value={destination} autoComplete="off" spellCheck={false} placeholder={network.id === 'tron' ? 'T…' : '0x…'} aria-invalid={destination.length > 0 && !addressOk} aria-describedby="withdraw-address-error"
              onChange={(event) => { setDestination(event.target.value.replace(/\s/g, '')); setServerError(null) }} />
          </label>}
        {mode === 'manual' && destination.length > 0 && !addressOk && <p className={s.fieldError} id="withdraw-address-error" role="alert">{fill(w.addressInvalid, { n: network.displayName })}</p>}
        {mode === 'saved' && entries.length > 0 && <button type="button" className={s.link} style={{ marginTop: 10 }} onClick={() => openPath('/assets/cash/address-book')}><BookUser size={13} />{w.manageBook}</button>}

        <AmountField id="withdraw-amount" label={f.common.amount} unit={unit} value={amount} onChange={(next) => { setAmount(next); setServerError(null) }} touched={touched || amount.length > 0} onBlur={() => setTouched(true)} error={fieldError} maxLabel={f.common.max}
          max={maxAtomic ? fromAtomic(maxAtomic, decimals) : null}
          available={!wallet.data && !wallet.error ? '…' : wallet.error && !wallet.data ? <button type="button" className={s.link} onClick={wallet.refetch}>{common.unavailable} · {common.retry}</button> : fill(f.common.available, { v: fmtAtomic(available, decimals, unit) })}
          min={fill(f.common.min, { v: fmtAtomic(network.minimumWithdrawalAtomic, decimals, '', 0).trim() })} />

        <Lacquer style={{ marginTop: 22 }} aria-live="polite">
          <dl className={s.summary}>
            <div><dt>{f.common.amount}</dt><dd className={s.num}>{atomic && !fieldError ? fmtAtomic(atomic, decimals, unit) : '—'}</dd></div>
            <div><dt>{f.common.fee}</dt><dd className={s.num}>{current?.data ? fmtAtomic(current.data.feeAtomicAmount, decimals, unit) : fmtAtomic(network.withdrawalFeeAtomic, decimals, unit)}</dd></div>
            <div data-strong="true"><dt>{w.total}</dt><dd className={s.num}>{current?.data ? fmtAtomic(current.data.totalDebitAtomic, decimals, unit) : '—'}</dd></div>
            <div><dt>{f.common.after}</dt><dd className={s.num}>{current?.data && !insufficient ? fmtAtomic((BigInt(current.data.availableAtomic) - BigInt(current.data.totalDebitAtomic)).toString(), decimals, unit) : '—'}</dd></div>
          </dl>
          <p className={s.muted} style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--m-lacquer-muted)' }} data-quote-state={!quoteKey ? 'idle' : !current ? 'loading' : current.error ? 'error' : 'ready'}>
            {!quoteKey ? w.indicative : !current ? w.quoting : current.error ? <>{w.quoteError} · {current.error} · <button type="button" className={s.link} style={{ color: 'var(--m-lacquer-accent)' }} onClick={() => setQuoteNonce((n) => n + 1)}>{common.retry}</button></> : insufficient ? w.insufficient : w.indicative}
          </p>
        </Lacquer>
        {integration && !integration.realFunds && <div className={s.notice} data-tone="info"><Info size={16} /><span>{f.common.stubNote}</span></div>}
        <p className={s.foot}><span>{stepUpRequired(integration) ? f.stepUp.required : f.stepUp.waived}</span></p>

        <label className={s.consent}>
          <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setServerError(null) }} />
          <span>{w.consent}</span>
        </label>
        {serverError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}

        <div className={s.stickyCta}>
          <button type="button" className={s.cta} onClick={submit} disabled={!ready} aria-busy={pending}>
            <span>{pending ? f.common.submitting : w.submit}</span>
            <span className={s.ctaIcon}><ArrowUpFromLine size={17} /></span>
          </button>
        </div>
      </>}
    {sheet}
  </MaisonPage>
}

/** `/assets/cash/receive` — the signed-in user's receive code: QR of a transfer link prefilled with their id, plus the id itself. */
export function ReceiveScreen() {
  const { locale } = useI18n()
  const r = fundsCopy[locale].receive
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { setUserId(readSession()?.userId ?? null); setOrigin(window.location.origin) }, [])
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

  const topbar = <RwaTopbar screen="receive" template="T-Child" l1="back" title={r.title} onBack={() => backOr('/assets/cash')} />
  return <MaisonPage page="receive" topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>{r.kicker}</p>
      <h1 className={s.titleL}>{r.title}</h1>
      <p className={s.lede}>{r.lede}</p>
    </header>
    {userId === undefined ? <Skeleton rows={4} />
      : userId === null ? <StateBlock tone="unavailable" title={r.unavailable} body={r.note}
        action={<button type="button" className={s.ghost} onClick={() => signInThenReturn('/assets/cash/receive')}>{r.signIn}<ChevronRight size={15} className={s.chev} /></button>} />
      : <>
        <Lacquer className={s.receiveCard}>
          <p className={s.kicker} style={{ margin: 0 }}>{r.qr}</p>
          <span className={`${s.qr} ${s.receiveQr}`}><QRCodeSVG value={link} size={176} level="M" bgColor="transparent" fgColor="#16130f" title={r.qr} /></span>
          <div className={s.receiveId}>
            <small>{r.idLabel}</small>
            <bdi dir="ltr" className={s.mono}>{userId}</bdi>
          </div>
          <div className={s.receiveActions}>
            <button type="button" className={s.ghost} data-size="s" onClick={() => void copy()} aria-live="polite">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? r.copied : r.copy}</button>
            <button type="button" className={s.ghost} data-size="s" onClick={() => void share()}><Share2 size={13} />{r.share}</button>
          </div>
        </Lacquer>
        <p className={s.lede} style={{ marginTop: 16 }}>{r.note}</p>
        <div className={s.notice} data-tone="info"><ShieldCheck size={16} /><span>{r.safety}</span></div>
        <button type="button" className={s.link} style={{ marginTop: 14 }} onClick={() => openPath('/assets/cash/transfer')}><Send size={13} aria-hidden="true" />{r.transfer}<ChevronRight size={14} className={s.chev} aria-hidden="true" /></button>
      </>}
  </MaisonPage>
}

/** `/assets/cash/transfer` — internal USDT transfer to another user id; posts instantly, so consent + idempotency + step-up. */
export function TransferScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const f = fundsCopy[locale]
  const t = f.transfer
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

  const decimals = wallet.data?.asset.decimals ?? 6
  const unit = wallet.data?.asset.code ?? 'USDT'
  const integration = wallet.data?.integration
  const available = wallet.data?.balances.availableAtomic ?? null
  const atomic = amount ? toAtomic(amount, decimals) : null
  const id = recipient.trim().toLowerCase()
  const recipientError = !id ? null : !isUuid(id) ? t.recipientInvalid : self && id === self.toLowerCase() ? t.self : null
  const fieldError = useMemo(() => {
    if (!amount) return null
    if (!atomic || atomic === '0') return f.errors.WALLET_AMOUNT_INVALID
    if (available !== null && BigInt(atomic) > BigInt(available)) return f.errors.WALLET_INSUFFICIENT_BALANCE
    return null
  }, [amount, atomic, available, f.errors])
  const ready = Boolean(id && !recipientError && atomic && !fieldError && consent && wallet.data && !pending)

  const submit = async () => {
    setTouched(true)
    if (!ready || !atomic || inflight.current) return
    const body: TransferBody = { recipientUserId: id, atomicAmount: atomic }
    const key = idempotencyKeyForIntent(keys.current, 'POST', TRANSFER_PATH, body)
    inflight.current = true
    setPending(true)
    setServerError(null)
    const result = await run(stepUpRequired(integration), (reauthentication) => createTransfer(reauthentication ? { ...body, reauthentication } : body, key))
    inflight.current = false
    setPending(false)
    if (!result) { setServerError(f.common.cancelled); return }
    if (!result.ok) { setServerError(errorText(f, result.error, common.errorGeneric)); return }
    invalidate(['wallet:', 'portfolio:', 'home:'])
    setReceipt(result.data)
  }
  const again = () => { keys.current.clear(); setReceipt(null); setAmount(''); setConsent(false); setTouched(false); setServerError(null) }
  const [pasteFailed, setPasteFailed] = useState(false)
  /** Accepts a bare user id or a scanned receive link (`…/assets/cash/transfer?to=<id>`). */
  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      let value = text
      try { value = new URL(text).searchParams.get('to') ?? text } catch { /* not a URL */ }
      setRecipient(value.replace(/\s/g, ''))
      setServerError(null)
      setPasteFailed(false)
    } catch { setPasteFailed(true) }
  }

  const topbar = <RwaTopbar screen="transfer" title={t.title} onBack={() => backOr('/assets/cash')} />
  if (receipt) return <MaisonPage page="transfer" topbar={topbar}>
    <header className={s.hero}><p className={s.kicker}>{t.kicker}</p><h1 className={s.titleL}>{t.title}</h1></header>
    <Receipt f={f} title={t.done} created={receipt.created} integration={receipt.integration} onAgain={again} rows={[
      { label: f.common.reference, value: <span className={s.mono} dir="ltr" data-ref="">{receipt.id.slice(0, 8)}</span> },
      { label: f.common.state, value: <span className={s.badge} data-tone={stateTone(receipt.state)}>{stateLabel(states, receipt.state)}</span> },
      { label: f.common.amount, value: fmtAtomic(receipt.atomicAmount, decimals, unit) },
      { label: f.common.fee, value: t.feeValue },
      { label: t.to, value: <bdi dir="ltr" className={s.mono}>{mask(receipt.recipientUserId)}</bdi> },
    ]} />
  </MaisonPage>

  return <MaisonPage page="transfer" topbar={topbar} cta>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.titleL}>{t.title}</h1>
      <button type="button" className={s.link} style={{ marginTop: 10 }} onClick={() => openPath('/assets/cash/receive')}><QrCode size={14} aria-hidden="true" />{t.myCode}<ChevronRight size={14} className={s.chev} aria-hidden="true" /></button>
    </header>
    {wallet.error && !wallet.data ? <StateBlock tone="error" title={common.errorGeneric} body={wallet.error.message} retry={wallet.refetch} retryLabel={common.retry} />
      : !wallet.data ? <Skeleton rows={4} />
      : <>
        <label className={s.field}>
          <span>{t.recipient}</span>
          <span className={s.pasteField}>
            <input value={recipient} autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" aria-invalid={Boolean(recipientError)} aria-describedby="transfer-recipient-meta"
              onChange={(event) => { setRecipient(event.target.value.replace(/\s/g, '')); setServerError(null); setPasteFailed(false) }} />
            <button type="button" className={s.pasteButton} onClick={() => void paste()}><ClipboardPaste size={14} aria-hidden="true" />{t.paste}</button>
          </span>
        </label>
        {recipientError ? <p className={s.fieldError} id="transfer-recipient-meta" role="alert">{recipientError}</p> : <p className={s.fieldMeta} id="transfer-recipient-meta" style={{ display: 'block' }} role={pasteFailed ? 'status' : undefined}>{pasteFailed ? t.pasteFailed : t.recipientHint}</p>}

        <AmountField id="transfer-amount" label={f.common.amount} unit={unit} value={amount} onChange={(next) => { setAmount(next); setServerError(null) }} touched={touched || amount.length > 0} onBlur={() => setTouched(true)} error={fieldError} maxLabel={f.common.max}
          max={available && BigInt(available) > ZERO ? fromAtomic(available, decimals) : null} available={fill(f.common.available, { v: fmtAtomic(available, decimals, unit) })} />

        <Lacquer style={{ marginTop: 22 }} aria-live="polite">
          <dl className={s.summary}>
            <div><dt>{t.to}</dt><dd className={s.num}><bdi dir="ltr">{id && !recipientError ? mask(id) : '—'}</bdi></dd></div>
            <div><dt>{f.common.fee}</dt><dd>{t.feeValue}</dd></div>
            <div data-strong="true"><dt>{f.common.amount}</dt><dd className={s.num}>{atomic && !fieldError ? fmtAtomic(atomic, decimals, unit) : '—'}</dd></div>
            <div><dt>{f.common.after}</dt><dd className={s.num}>{atomic && !fieldError && available !== null ? fmtAtomic((BigInt(available) - BigInt(atomic)).toString(), decimals, unit) : '—'}</dd></div>
          </dl>
        </Lacquer>
        {integration && !integration.realFunds && <div className={s.notice} data-tone="info"><Info size={16} /><span>{f.common.stubNote}</span></div>}
        <p className={s.foot}><span>{stepUpRequired(integration) ? f.stepUp.required : f.stepUp.waived}</span></p>
        <label className={s.consent}>
          <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setServerError(null) }} />
          <span>{t.consent}</span>
        </label>
        {serverError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}
        <div className={s.stickyCta}>
          <button type="button" className={s.cta} onClick={submit} disabled={!ready} aria-busy={pending}>
            <span>{pending ? f.common.submitting : t.submit}</span>
            <span className={s.ctaIcon}><Send size={17} /></span>
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
    const result = await run(true, (reauthentication) => addAddress({ network: net.id, destination, label: label.trim(), reauthentication: reauthentication ?? '' }))
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
    const result = await run(true, (reauthentication) => revokeAddress(entry.id, reauthentication ?? ''))
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
      : <Lacquer style={{ marginTop: 12 }} as="div">
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
      </Lacquer>}

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
