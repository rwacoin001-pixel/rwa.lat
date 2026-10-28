'use client'

import { AlertTriangle, ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, BookUser, Check, ChevronRight, Copy, Info, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getDepositAddress, getWalletDetail, watchDeposit, ledgerDeltas, ledgerGroup, ledgerHeadline, listLedger, listNetworks, type DepositAddress, type FundingActivity, type LedgerGroup, type LedgerTransaction } from '@/lib/api/wallet'
import { fromAtomic } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { walletCopy } from '@/lib/maison-wallet-copy'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Figure, Lacquer, Segmented, StatStrip, useAutoAnimate } from './motion'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'
import { Sheet } from './Sheet'
import fp from './funds-polish.module.css'
import fs from './funds-fullscreen.module.css'

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
    <h1 className={fp.srTitle}>{c.title}</h1>

    {wallet.error && !wallet.data ? <StateBlock tone="error" title={common.errorGeneric} body={wallet.error.message} retry={wallet.refetch} retryLabel={common.retry} />
      : <Lacquer aria-live="polite">
        <span className={s.kicker}>{c.available} · {wallet.data?.asset.code ?? 'USDT'}</span>
        {!balances ? <Skeleton rows={1} />
          : <p className={`${s.bigFigure} ${s.num}`}><Figure value={Number(fromAtomic(balances.availableAtomic, DECIMALS))} locale={locale} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /><small>{wallet.data?.asset.code ?? 'USDT'}</small></p>}
        {balances?.asOf && <p className={s.muted} style={{ margin: '8px 0 0', fontSize: 12 }}>{fill(c.asOf, { t: fmtDateTime(balances.asOf, locale) })}</p>}
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
      <button type="button" onClick={() => openPath('/assets/cash/receive')}><span><QrCode size={18} /></span>{fundsCopy[locale].receive.action}</button>
    </div>
    <div className={fp.cashLinks}>
      <button type="button" className={s.link} onClick={() => openPath('/assets/cash/address-book')}><BookUser size={14} aria-hidden="true" />{c.addressBook}<ChevronRight size={14} aria-hidden="true" /></button>
    </div>
    {integration && !integration.realFunds && <div className={s.notice} data-tone="info"><Info size={16} /><span><b>{c.testMode}</b> · {c.testModeBody}</span></div>}

    <SectionHead title={c.networks} note={c.networksNote} />
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

    <SectionHead title={c.funding} note={c.fundingNote} />
    {wallet.error && !wallet.data ? <StateBlock tone="error" title={c.loadError} retry={wallet.refetch} retryLabel={common.retry} />
      : !wallet.data ? <Skeleton rows={3} />
      : !wallet.data.recentActivity.length ? <StateBlock title={c.fundingEmpty} body={c.fundingEmptyBody} />
      : <ul className={s.list} ref={funding}>{wallet.data.recentActivity.slice(0, 6).map((item: FundingActivity) => <li key={`${item.kind}-${item.id}`}>
        <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
          <span className={s.rowMain}><b>{c.kinds[item.kind] ?? item.kind}</b><small className={s.num}>{fmtDateTime(item.at, locale)} · {item.id.slice(0, 8)}</small></span>
          <span className={s.rowFig}><b className={`${s.num} ${item.kind === 'deposit' ? s.up : ''}`}>{item.kind === 'deposit' ? '+' : '−'}{bare(item.atomicAmount)}</b><small><span className={s.badge} data-tone={stateTone(item.state)}>{w.states[item.state] ?? item.state}</span></small></span>
        </div>
      </li>)}</ul>}

    <SectionHead title={c.ledger} note={c.ledgerNote} action={<button type="button" className={s.sectionMore} onClick={() => openPath('/assets/activity')}>{c.viewAll}<ChevronRight size={14} /></button>} />
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
  // Live watch (manual custody): per-network end time from the server, a ticking clock for the countdown,
  // and the deposit states seen when the address was revealed so only new arrivals are announced.
  const [watchEnds, setWatchEnds] = useState<Record<string, number>>({})
  const [now, setNow] = useState(() => Date.now())
  const [baseline, setBaseline] = useState<Record<string, string> | null>(null)
  const [checkQueued, setCheckQueued] = useState(false)
  const watching = Object.values(watchEnds).some((end) => end > now)
  const wallet = useQuery('wallet:detail', getWalletDetail, { staleTime: 15_000, pollInterval: watching ? 10_000 : undefined })
  useEffect(() => {
    if (!watching) return
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [watching])
  const [picked, setPicked] = useState<string | null>(() => queryParam(query, 'network'))
  const list = networks.data?.networks ?? []
  const network = list.find((item) => item.id === picked) ?? list[0]
  const [addresses, setAddresses] = useState<Record<string, DepositAddress>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const inflight = useRef(false)
  const address = network ? addresses[network.id] : undefined

  const choose = (id: string) => {
    setPicked(id)
    setError(null)
    setCopied(false)
    setHelpOpen(false)
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
    const end = result.data.watchUntil ? Date.parse(result.data.watchUntil) : NaN
    if (Number.isFinite(end)) {
      setNow(Date.now())
      setWatchEnds((current) => ({ ...current, [network.id]: end }))
      setBaseline((current) => current ?? Object.fromEntries((wallet.data?.recentActivity ?? []).filter((item) => item.kind === 'deposit').map((item) => [item.id, item.state])))
    }
  }
  const check = async () => {
    if (!network || checkQueued) return
    setCheckQueued(true)
    window.setTimeout(() => setCheckQueued(false), 20_000)
    const result = await watchDeposit(network.id)
    if (!result.ok) { setCheckQueued(false); setError(result.error.message || d.loadError); return }
    const end = result.data.watchUntil ? Date.parse(result.data.watchUntil) : NaN
    if (Number.isFinite(end)) { setNow(Date.now()); setWatchEnds((current) => ({ ...current, [network.id]: end })) }
    void wallet.refetch()
  }
  // Newest deposit that appeared or changed state since the address was revealed.
  const arrival = useMemo(() => {
    if (!baseline) return null
    const changed = (wallet.data?.recentActivity ?? []).filter((item) => item.kind === 'deposit' && baseline[item.id] !== item.state)
    const latest = changed.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
    if (!latest) return null
    const text = latest.state === 'credited' ? fill(d.arrived, { v: bare(latest.atomicAmount) })
      : latest.state === 'manual_review' ? d.inReview
      : latest.state === 'rejected' ? null
      : fill(d.detected, { n: String(network?.requiredConfirmations ?? '') })
    return text ? { state: latest.state, text } : null
  }, [baseline, wallet.data, d, network?.requiredConfirmations])
  const copy = async () => {
    if (!address) return
    try { await navigator.clipboard.writeText(address.address); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }
  const topbar = <RwaTopbar screen="deposit" title={d.title} r2={network ? 'info' : null} action={network ? { label: d.before, Icon: Info, onClick: () => setHelpOpen(true) } : undefined} onBack={() => backOr('/assets/cash')} />

  return <MaisonPage page="deposit" className={fs.page} topbar={topbar}>
    <h1 className={fp.srTitle}>{d.title}</h1>
    {wallet.data && <p className={fp.balance}><span>{c.available}</span><b dir="ltr">{bare(wallet.data.balances.availableAtomic)} {wallet.data.asset.code}</b></p>}
    {networks.error && !networks.data ? <StateBlock tone="error" title={common.errorGeneric} body={networks.error.message} retry={networks.refetch} retryLabel={common.retry} />
      : !network ? <Skeleton rows={4} />
      : <>
        <div className={fp.touchSeg}><Segmented value={network.id} onChange={choose} label={d.network} role="group" options={list.map((item) => ({ value: item.id, label: item.displayName }))} /></div>
        <p className={fs.net}><span>{d.network}</span><b>{network.displayName}</b></p>
        <dl className={`${s.summary} ${fs.rows}`}>
          <div><dt>{c.minDeposit} · {network.assetCode}</dt><dd className={s.num}>{fmtAtomic(network.minimumDepositAtomic, network.assetDecimals, '', 2).trim()}</dd></div>
          <div><dt>{c.confirmations}</dt><dd className={s.num}>{network.requiredConfirmations}</dd></div>
          <div><dt>{c.eta}</dt><dd className={s.num}>{fill(c.etaValue, { a: String(network.estimatedArrivalMinutes[0] ?? '—'), b: String(network.estimatedArrivalMinutes[1] ?? '—') })}</dd></div>
        </dl>
        <div aria-live="polite">
          {address ? <>
            <div className={fs.qrWrap}><div className={fs.qr} role="img" aria-label={d.qr}><QRCodeSVG value={address.address} size={232} bgColor="transparent" fgColor="#16130f" level="M" /></div></div>
            <div className={fs.addrRow}>
              <div><small>{d.address} · {network.displayName}</small><p className={`${s.mono} ${fs.addrText}`} dir="ltr" data-address="">{address.address}</p></div>
              <button type="button" className={s.ghost} onClick={copy} aria-live="polite">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? d.copied : d.copy}</button>
            </div>
            {address.memo && <div className={fs.addrRow}><div><small>{d.memo}</small><p className={`${s.mono} ${fs.addrText}`} dir="ltr">{address.memo}</p></div></div>}
            {address.addressRotated && <div className={`${s.notice} ${fs.note}`} data-tone="info"><Info size={16} aria-hidden="true" /><span><b>{d.newAddress}</b> · {d.newAddressBody}</span></div>}
            {arrival && <p className={fs.arrival} data-state={arrival.state} role="status">{arrival.state === 'credited' ? <Check size={16} aria-hidden="true" /> : null}{arrival.text}</p>}
            {watchEnds[network.id] !== undefined && (() => {
              const live = watchEnds[network.id] > now
              return <div className={fs.watch} data-live={live}>
                <p><span className={fs.watchDot} aria-hidden="true" />{live ? fill(d.watching, { m: String(Math.max(1, Math.ceil((watchEnds[network.id] - now) / 60_000))) }) : d.watchEnded}</p>
                <button type="button" className={s.ghost} onClick={check} disabled={checkQueued} aria-live="polite">{checkQueued ? d.checkQueued : d.checkNow}</button>
              </div>
            })()}
          </>
            : <div className={fs.empty}>
              <span>{d.address} · {network.displayName}</span>
              <button type="button" className={s.cta} onClick={reveal} disabled={pending} aria-busy={pending}><span>{pending ? d.revealing : d.reveal}</span><span className={s.ctaIcon}><ArrowDownToLine size={17} /></span></button>
            </div>}
          {error && <div className={`${s.notice} ${fs.note}`} data-tone="error" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>{d.loadError} · {error} · <button type="button" className={s.link} style={{ minHeight: 44 }} onClick={reveal}>{common.retry}</button></span></div>}
        </div>
        {(address?.integration ?? networks.data?.integration)?.realFunds === false && <div className={`${s.notice} ${fs.note}`} data-tone="info"><Info size={16} /><span>{d.testAddress}</span></div>}
        <details className={fs.more}>
          <summary><span><AlertTriangle size={15} aria-hidden="true" />{d.before}</span></summary>
          <div className={fs.moreBody}>
            <p className={fs.warning}>{network.warning}</p>
            <p>{fill(d.afterNote, { n: String(network.requiredConfirmations) })}</p>
          </div>
        </details>
      </>}
    {network && <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} kicker={`${network.assetCode} · ${network.displayName}`} title={d.before}>
      <dl className={s.summary} style={{ marginTop: 16 }}>
        <div><dt>{c.minDeposit}</dt><dd className={s.num}>{fmtAtomic(network.minimumDepositAtomic, network.assetDecimals, network.assetCode, 2)}</dd></div>
        <div><dt>{c.confirmations}</dt><dd className={s.num}>{network.requiredConfirmations}</dd></div>
        <div><dt>{c.eta}</dt><dd className={s.num}>{fill(c.etaValue, { a: String(network.estimatedArrivalMinutes[0] ?? '—'), b: String(network.estimatedArrivalMinutes[1] ?? '—') })}</dd></div>
      </dl>
      <p className={s.foot}><Info size={13} aria-hidden="true" /><span>{fill(d.afterNote, { n: String(network.requiredConfirmations) })}</span></p>
    </Sheet>}
  </MaisonPage>
}
