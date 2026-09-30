'use client'

import { AlertTriangle, ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, BookUser, Check, ChevronRight, Copy, Info } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getDepositAddress, getWalletDetail, ledgerDeltas, ledgerGroup, ledgerHeadline, listLedger, listNetworks, type DepositAddress, type FundingActivity, type LedgerGroup, type LedgerTransaction } from '@/lib/api/wallet'
import { fromAtomic } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { walletCopy } from '@/lib/maison-wallet-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Figure, Lacquer, Segmented, StatStrip, useAutoAnimate } from './motion'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'

const DECIMALS = 6
const ZERO = BigInt(0)
const bare = (atomic: string | bigint | null | undefined, sign = false) => {
  if (atomic === null || atomic === undefined) return '—'
  const text = fmtAtomic(atomic.toString(), DECIMALS, '', 2).trim()
  return sign && BigInt(atomic) > ZERO ? `+${text}` : text
}
const toneClass = (atomic: bigint | null | undefined) => atomic === null || atomic === undefined || atomic === ZERO ? s.muted : atomic > ZERO ? s.up : s.down
const stateTone = (state: string) => ['completed', 'credited', 'posted'].includes(state) ? 'live' : ['failed', 'rejected', 'cancelled'].includes(state) ? 'down' : ['held', 'pending_review'].includes(state) ? 'warn' : 'accent'
const ledgerKey = 'wallet:ledger'
export const useLedger = () => useQuery(ledgerKey, () => listLedger(100), { staleTime: 15_000 })

/** `/assets/cash` — balances, funding actions, network policy, funding history and the latest ledger lines. */
export function CashScreen() {
  const { locale } = useI18n()
  const w = walletCopy[locale]
  const c = w.cash
  const common = marketCopy[locale].common
  const wallet = useQuery('wallet:detail', getWalletDetail, { staleTime: 15_000 })
  const networks = useQuery('wallet:networks', listNetworks, { staleTime: 300_000 })
  const ledger = useLedger()
  const balances = wallet.data?.balances
  const integration = wallet.data?.integration ?? networks.data?.integration
  const [funding] = useAutoAnimate<HTMLUListElement>({ duration: 240 })

  return <MaisonPage page="cash" dock topbar={<RwaTopbar screen="wallet" title={c.title} onBack={() => backOr('/assets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}><span className={s.liveDot} aria-hidden="true" />{c.kicker}</p>
      <h1 className={s.display}>{c.title}</h1>
    </header>

    {wallet.error && !wallet.data ? <StateBlock tone="error" title={common.errorGeneric} body={wallet.error.message} retry={wallet.refetch} retryLabel={common.retry} />
      : <Lacquer aria-live="polite">
        <span className={s.kicker}>{c.available} · {wallet.data?.asset.code ?? 'USDT'}</span>
        {!balances ? <Skeleton rows={1} />
          : <p className={`${s.bigFigure} ${s.num}`}><Figure value={Number(fromAtomic(balances.availableAtomic, DECIMALS))} locale={locale} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /><small>{wallet.data?.asset.code ?? 'USDT'}</small></p>}
        {balances?.asOf && <p className={s.muted} style={{ margin: '8px 0 0', fontSize: 11.5 }}>{fill(c.asOf, { t: fmtDateTime(balances.asOf, locale) })}</p>}
        <StatStrip fit items={[
          { label: c.locked, value: bare(balances?.lockedAtomic) },
          { label: c.pending, value: bare(balances?.pendingAtomic) },
          { label: c.invested, value: bare(balances?.investedAtomic) },
        ]} />
      </Lacquer>}

    <div className={s.quickActions}>
      <button type="button" onClick={() => openPath('/assets/cash/deposit')}><span><ArrowDownToLine size={18} /></span>{c.deposit}</button>
      <button type="button" onClick={() => openPath('/assets/cash/withdraw')}><span><ArrowUpFromLine size={18} /></span>{c.withdraw}</button>
      <button type="button" onClick={() => openPath('/assets/cash/transfer')}><span><ArrowRightLeft size={18} /></span>{c.transfer}</button>
      <button type="button" onClick={() => openPath('/assets/cash/address-book')}><span><BookUser size={18} /></span>{c.addressBook}</button>
    </div>
    {integration && !integration.realFunds && <div className={s.notice} data-tone="info"><Info size={16} /><span><b>{c.testMode}</b> · {c.testModeBody}</span></div>}

    <SectionHead index="01" title={c.networks} note={c.networksNote} />
    {networks.error && !networks.data ? <StateBlock tone="error" title={c.loadError} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} />
      : !networks.data ? <Skeleton rows={3} />
      : <>
        <div className={s.tableHead} aria-hidden="true"><span>{c.network} · {c.confirmations}</span><span>{c.minDeposit} · USDT</span></div>
        <ul className={s.list}>{networks.data.networks.map((network) => <li key={network.id}>
          <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
            <span className={s.rowMain}><b>{network.displayName}</b><small className={s.num}>{network.requiredConfirmations} · {fill(c.etaValue, { a: String(network.estimatedArrivalMinutes[0] ?? '—'), b: String(network.estimatedArrivalMinutes[1] ?? '—') })}</small></span>
            <span className={s.rowFig}><b className={s.num}>{bare(network.minimumDepositAtomic)}</b><small className={`${s.num} ${s.muted}`}>{c.fee} {bare(network.withdrawalFeeAtomic)}</small></span>
          </div>
        </li>)}</ul>
      </>}

    <SectionHead index="02" title={c.funding} note={c.fundingNote} />
    {wallet.error && !wallet.data ? <StateBlock tone="error" title={c.loadError} retry={wallet.refetch} retryLabel={common.retry} />
      : !wallet.data ? <Skeleton rows={3} />
      : !wallet.data.recentActivity.length ? <StateBlock title={c.fundingEmpty} body={c.fundingEmptyBody} />
      : <ul className={s.list} ref={funding}>{wallet.data.recentActivity.slice(0, 6).map((item: FundingActivity) => <li key={`${item.kind}-${item.id}`}>
        <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
          <span className={s.rowMain}><b>{c.kinds[item.kind] ?? item.kind}</b><small className={s.num}>{fmtDateTime(item.at, locale)} · {item.id.slice(0, 8)}</small></span>
          <span className={s.rowFig}><b className={`${s.num} ${item.kind === 'deposit' ? s.up : ''}`}>{item.kind === 'deposit' ? '+' : '−'}{bare(item.atomicAmount)}</b><small><span className={s.badge} data-tone={stateTone(item.state)}>{w.states[item.state] ?? item.state}</span></small></span>
        </div>
      </li>)}</ul>}

    <SectionHead index="03" title={c.ledger} note={c.ledgerNote} action={<button type="button" className={s.sectionMore} onClick={() => openPath('/assets/activity')}>{c.viewAll}<ChevronRight size={14} /></button>} />
    {ledger.error && !ledger.data ? <StateBlock tone="error" title={c.loadError} body={ledger.error.message} retry={ledger.refetch} retryLabel={common.retry} />
      : !ledger.data ? <Skeleton rows={3} />
      : <LedgerRows rows={ledger.data.transactions.slice(0, 5)} />}
  </MaisonPage>
}

export function LedgerRows({ rows, byDay = false }: { rows: LedgerTransaction[]; byDay?: boolean }) {
  const { locale } = useI18n()
  const a = walletCopy[locale].activity
  const [list] = useAutoAnimate<HTMLUListElement>({ duration: 240 })
  if (!rows.length) return <StateBlock title={a.empty} body={a.emptyBody} />
  let lastDay = ''
  return <ul className={s.list} ref={list}>{rows.flatMap((tx) => {
    const headline = ledgerHeadline(tx)
    const deltas = ledgerDeltas(tx)
    const locked = headline?.purpose !== 'locked' && deltas.locked !== undefined && deltas.locked !== ZERO ? deltas.locked : null
    const order = tx.referenceType === 'order' && tx.referenceId
    const day = fmtDate(tx.effectiveAt, locale)
    const head = byDay && day !== lastDay ? [<li key={`day-${day}`} className={s.dayHead} aria-hidden="true">{day}</li>] : []
    lastDay = day
    const body = <>
      <span className={s.rowMain}>
        <b>{a.types[tx.transactionType] ?? a.otherType}</b>
        <small className={s.num}>{fmtDateTime(tx.effectiveAt, locale, byDay ? { timeStyle: 'short' } : undefined)} · {(tx.referenceId ?? tx.id).slice(0, 8)}</small>
      </span>
      <span className={s.rowFig}>
        <b className={`${s.num} ${toneClass(headline?.amount)}`} dir="ltr">{headline ? bare(headline.amount, true) : '—'}</b>
        <small className={s.muted}>{headline && headline.purpose !== 'available' ? a.purposes[headline.purpose] ?? headline.purpose
          : locked !== null ? a.lockedMove.split('{v}').flatMap((part, index) => index ? [<bdi key={index} dir="ltr">{bare(locked, true)}</bdi>, part] : [part])
          : a.purposes.available}</small>
      </span>
    </>
    return [...head, <li key={tx.id}>{order
      ? <button type="button" className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }} onClick={() => openPath(`/orders/${encodeURIComponent(order)}`)}>{body}</button>
      : <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>{body}</div>}</li>]
  })}</ul>
}

const FILTERS = ['all', 'funding', 'investing', 'income', 'other'] as const
type Filter = (typeof FILTERS)[number]

/** `/assets/activity` — the user's ledger, newest first, with BigInt in/out totals on the available balance. */
export function ActivityScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const a = walletCopy[locale].activity
  const common = marketCopy[locale].common
  const initial = queryParam(query, 'type')
  const [filter, setFilterState] = useState<Filter>(FILTERS.includes(initial as Filter) ? initial as Filter : 'all')
  const setFilter = (next: Filter) => {
    setFilterState(next)
    const url = new URL(window.location.href)
    if (next === 'all') url.searchParams.delete('type')
    else url.searchParams.set('type', next)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }
  const ledger = useLedger()
  const rows = useMemo(() => (ledger.data?.transactions ?? []).filter((tx) => filter === 'all' || ledgerGroup(tx.transactionType) === filter as LedgerGroup), [filter, ledger.data])
  const sums = useMemo(() => rows.reduce((acc, tx) => {
    const delta = ledgerDeltas(tx).available ?? ZERO
    if (delta > ZERO) acc.inflow += delta
    else acc.outflow += delta
    return acc
  }, { inflow: ZERO, outflow: ZERO }), [rows])

  return <MaisonPage page="activity" dock topbar={<RwaTopbar screen="activity" title={a.title} onBack={() => backOr('/assets/cash')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{a.kicker}</p>
      <h1 className={s.display}>{a.title}</h1>
    </header>
    <Segmented value={filter} onChange={setFilter} label={a.title} sticky options={FILTERS.map((key, index) => ({ value: key, label: a.filters[index] }))} />
    <div className={s.tabPanel} role="tabpanel">
      {ledger.error && !ledger.data ? <StateBlock tone="error" title={common.errorGeneric} body={ledger.error.message} retry={ledger.refetch} retryLabel={common.retry} />
        : !ledger.data ? <Skeleton rows={6} />
        : <>
          <StatStrip fit items={[
            { label: `${a.inflow} · USDT`, value: bare(sums.inflow, true), tone: sums.inflow > ZERO ? 'up' : undefined },
            { label: `${a.outflow} · USDT`, value: bare(sums.outflow), tone: sums.outflow < ZERO ? 'down' : undefined },
            { label: `${a.net} · USDT`, value: bare(sums.inflow + sums.outflow, true), tone: sums.inflow + sums.outflow > ZERO ? 'up' : sums.inflow + sums.outflow < ZERO ? 'down' : undefined },
          ]} />
          <p className={s.foot}><span>{fill(a.scope, { n: String(ledger.data.transactions.length) })}</span></p>
          <LedgerRows rows={rows} byDay />
        </>}
    </div>
  </MaisonPage>
}

/** `/assets/cash/deposit` — pick a network, then explicitly request (get-or-provision) the address. */
export function DepositScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const w = walletCopy[locale]
  const d = w.deposit
  const c = w.cash
  const common = marketCopy[locale].common
  const networks = useQuery('wallet:networks', listNetworks, { staleTime: 300_000 })
  const [picked, setPicked] = useState<string | null>(() => queryParam(query, 'network'))
  const list = networks.data?.networks ?? []
  const network = list.find((item) => item.id === picked) ?? list[0]
  const [addresses, setAddresses] = useState<Record<string, DepositAddress>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inflight = useRef(false)
  const address = network ? addresses[network.id] : undefined

  const choose = (id: string) => {
    setPicked(id)
    setError(null)
    setCopied(false)
    const url = new URL(window.location.href)
    url.searchParams.set('network', id)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }
  const reveal = async () => {
    if (!network || inflight.current) return
    inflight.current = true
    setPending(true)
    setError(null)
    const result = await getDepositAddress(network.id)
    inflight.current = false
    setPending(false)
    if (!result.ok) { setError(result.error.message || d.loadError); return }
    setAddresses((current) => ({ ...current, [network.id]: result.data }))
  }
  const copy = async () => {
    if (!address) return
    try { await navigator.clipboard.writeText(address.address); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }
  const topbar = <RwaTopbar screen="deposit" title={d.title} onBack={() => backOr('/assets/cash')} />

  return <MaisonPage page="deposit" topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>{d.kicker}</p>
      <h1 className={s.titleL}>{d.title}</h1>
    </header>
    {networks.error && !networks.data ? <StateBlock tone="error" title={common.errorGeneric} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} />
      : !network ? <Skeleton rows={4} />
      : <>
        <p className={s.kicker}>{d.network}</p>
        <Segmented value={network.id} onChange={choose} label={d.network} role="group" options={list.map((item) => ({ value: item.id, label: item.displayName }))} />
        <StatStrip fit items={[
          { label: `${c.minDeposit} · ${network.assetCode}`, value: bare(network.minimumDepositAtomic) },
          { label: c.confirmations, value: String(network.requiredConfirmations) },
          { label: c.eta, value: fill(c.etaValue, { a: String(network.estimatedArrivalMinutes[0] ?? '—'), b: String(network.estimatedArrivalMinutes[1] ?? '—') }) },
        ]} />
        <div className={s.notice}><AlertTriangle size={16} /><span><b>{d.before}</b> · {network.warning}</span></div>

        <Lacquer style={{ marginTop: 18 }} aria-live="polite">
          <span className={s.kicker}>{d.address} · {network.displayName}</span>
          {address ? <div className={s.addressCard}>
            <div className={s.qr} role="img" aria-label={d.qr}><QRCodeSVG value={address.address} size={132} bgColor="transparent" fgColor="currentColor" level="M" /></div>
            <p className={s.mono} dir="ltr" data-address="">{address.address}</p>
            {address.memo && <p className={s.muted} dir="ltr" style={{ margin: 0, fontSize: 12 }}>{d.memo}: <span className={s.mono}>{address.memo}</span></p>}
            <button type="button" className={s.ghost} onClick={copy} aria-live="polite">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? d.copied : d.copy}</button>
          </div>
            : <button type="button" className={s.cta} style={{ marginTop: 14 }} onClick={reveal} disabled={pending} aria-busy={pending}><span>{pending ? d.revealing : d.reveal}</span><span className={s.ctaIcon}><ArrowDownToLine size={17} /></span></button>}
          {error && <p className={s.muted} role="alert" style={{ margin: '12px 0 0', fontSize: 12 }}>{d.loadError} · {error} · <button type="button" className={s.link} onClick={reveal}>{common.retry}</button></p>}
        </Lacquer>
        {(address?.integration ?? networks.data?.integration)?.realFunds === false && <div className={s.notice} data-tone="info"><Info size={16} /><span>{d.testAddress}</span></div>}
        <p className={s.foot}><span>{fill(d.afterNote, { n: String(network.requiredConfirmations) })}</span></p>
        <button type="button" className={s.link} style={{ marginTop: 12 }} onClick={() => openPath('/assets/cash')}>{d.backCash}<ChevronRight size={13} /></button>
      </>}
  </MaisonPage>
}
