'use client'

import { AlertTriangle, ArrowRight, Check, Info } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import {useContentTranslation} from '@/lib/use-content-translation'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { acknowledgeDisclosure, disclosureFor, getBasket, getWallet, isOrderableId, listBasketDisclosures, redeemBasket, subscribeBasket, type BasketRedemption, type BasketSubscription } from '@/lib/api/markets'
import { fmtUsd, fromAtomic, toAtomic } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { tradeCopy } from '@/lib/maison-trade-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { sharedBack } from '@/lib/market-shared-transition'
import { Logo, MaisonPage, SectionHead, Skeleton, Sparkline, StateBlock, maison as s } from './primitives'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'

const OPEN = new Set(['pilot', 'active'])
const DEC_6 = /^\d+(\.\d{1,6})?$/
const DEC_8 = /^\d+(\.\d{1,8})?$/

/** Decimal string → scaled BigInt; null for anything that is not a plain non-negative decimal. */
function scaled(value: string | null | undefined, scale: number) {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return null
  const atomic = toAtomic(value, scale)
  return atomic === null ? null : BigInt(atomic)
}

function fmtUnits(value: string | null | undefined, locale: string) {
  const n = scaled(value, 8)
  return n === null ? '—' : Number(fromAtomic(n.toString(), 8)).toLocaleString(locale, { maximumFractionDigits: 8 })
}

function useBasket(id: string | null) {
  return useQuery(id ? `basket:detail:${id}` : null, () => getBasket(id!), { staleTime: 30_000 })
}

function statusLabel(t: ReturnType<typeof useT>['b'], status: string) {
  return status === 'pilot' ? t.status.pilot : status === 'active' ? t.status.active : t.status.other
}

function useT() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  return { locale, copy, b: tradeCopy[locale].basket, o: tradeCopy[locale].basketOrder }
}

function Missing({ page, topbar, error, retry }: { page: string; topbar: ReactNode; error?: { status: number; message: string } | null; retry?: () => void }) {
  const { copy, b } = useT()
  const toMarkets = <button type="button" className={s.link} onClick={() => openPath('/markets?tab=baskets')}>{copy.status.backMarkets}</button>
  return <MaisonPage page={page} dock={page === 'basket'} topbar={topbar}><div className={s.hero}>
    {!error || error.status === 404 || error.status === 400 ? <StateBlock title={b.notFound} body={b.notFoundBody} action={toMarkets} />
      : <StateBlock tone="error" title={b.loadError} body={error.message} retry={retry} retryLabel={copy.common.retry} />}
  </div></MaisonPage>
}

/** `/basket/:id` — public; the detail call carries the session when present so `userUnits` is filled in. */
export function BasketDetailScreen({ id }: { id: string | null }) {
  const { locale, copy, b } = useT()
  const validId = id && isOrderableId(id) ? id : null
  const detail = useBasket(validId)
  const basket = detail.data
  const content=useContentTranslation(basket?[basket.name,basket.strategyName,...basket.holdings.map(h=>h.name)]:[])
  const topbar = <RwaTopbar screen="basket-detail" title={basket?.name ?? b.kicker.split(' · ')[0]} onBack={() => validId ? sharedBack(`basket:${validId}:`, () => backOr('/markets?tab=baskets')) : backOr('/markets?tab=baskets')} />

  if (!validId) return <Missing page="basket" topbar={topbar} />
  if (!basket && !detail.error) return <MaisonPage page="basket" dock topbar={topbar}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (!basket) return <Missing page="basket" topbar={topbar} error={detail.error} retry={detail.refetch} />

  const open = OPEN.has(basket.status)
  const held = scaled(basket.userUnits, 8)
  const history = [...basket.navHistory].filter((point) => point.nav && Number.isFinite(Number(point.nav))).sort((a, c) => Date.parse(a.timestamp) - Date.parse(c.timestamp))
  const order = (side: 'subscribe' | 'redeem') => openPath(`/basket/${encodeURIComponent(basket.id)}/order${side === 'redeem' ? '?side=redeem' : ''}`)

  return <MaisonPage page="basket" dock topbar={topbar} cta={open}>
    <header className={s.hero}>
      <p className={s.kicker}>{b.kicker}</p>
      <h1 className={s.titleL} data-shared={`basket:${basket.id}:title`}>{content(basket.name)}</h1>
      <p className={s.lede} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span className={s.badge} data-tone={open ? 'live' : 'warn'}>{statusLabel(b, basket.status)}</span>
        {basket.riskLevel && <span className={s.badge}>{b.risk} · {basket.riskLevel}</span>}
        <span>{content(basket.strategyName)}</span>
      </p>
    </header>

    <section className={s.lacquer}>
      <span className={s.kicker}>{b.nav}</span>
      <p className={`${s.bigFigure} ${s.num}`}>{fmtUsd(basket.navPerUnit, { digits: 4, locale })}</p>
      <dl className={s.stats} style={{ marginTop: 18 }}>
        <div><dt>{b.aum}</dt><dd className={s.num}>{fmtUsd(basket.aumUsd, { compact: true, locale })}</dd></div>
        <div><dt>{b.units}</dt><dd className={s.num}>{fmtUnits(basket.totalUnits, locale)}</dd></div>
        <div><dt>{b.min}</dt><dd className={s.num}>{fmtUsd(basket.minimumSubscriptionUsd ?? null, { locale })}</dd></div>
        <div><dt>{b.cash}</dt><dd className={s.num}>{fmtUsd(basket.cashBalanceUsd, { compact: true, locale })}</dd></div>
      </dl>
      {held !== null && held > BigInt(0) && <dl className={s.summary} style={{ marginTop: 8 }}>
        <div data-strong="true"><dt>{b.yours}</dt><dd className={s.num}>{fmtUnits(basket.userUnits, locale)}</dd></div>
      </dl>}
      <p className={s.foot}><span>{fill(copy.common.updated, { t: fmtDateTime(basket.updatedAt, locale) })}</span></p>
    </section>

    <SectionHead index="01" title={b.navHistory} />
    {history.length >= 2
      ? <>
        <Sparkline points={history.map((point) => Number(point.nav))} label={b.navHistory} />
        <div className={s.chartAxis}><span>{fmtDate(history[0].timestamp, locale)}</span><span>{fmtDate(history[history.length - 1].timestamp, locale)}</span></div>
      </>
      : <StateBlock title={b.navEmpty} />}

    <SectionHead index="02" title={b.holdings} action={<small className={`${s.muted} ${s.num}`}>{basket.holdings.length}</small>} />
    {basket.holdings.length ? <ul className={s.list}>{basket.holdings.map((holding) => <li key={holding.assetId}>
      <button type="button" className={s.row} onClick={() => openPath(`/asset/${encodeURIComponent(holding.slug)}`)}>
        <Logo name={content(holding.name)} />
        <span className={s.rowMain}><b>{content(holding.name)}</b><small>{[holding.assetClass?.replace(/_/g, ' '), holding.targetWeightPct ? `${b.target} ${Number(holding.targetWeightPct).toFixed(2)}%` : null].filter(Boolean).join(' · ')}</small></span>
        <span className={s.rowFig}><b className={s.num}>{holding.actualWeightPct ? `${Number(holding.actualWeightPct).toFixed(2)}%` : '—'}</b><small className={s.muted}>{fmtUsd(holding.marketValueUsd, { compact: true, locale })}</small></span>
      </button>
    </li>)}</ul> : <StateBlock title={b.noHoldings} />}

    <div className={s.notice}><Info size={16} /><span>{open ? b.note : o(locale).server.BASKET_PORTFOLIO_NOT_ACTIVE}</span></div>

    {open && <div className={s.stickyCta}>
      {held !== null && held > BigInt(0)
        ? <div className={s.actions2} style={{ width: '100%' }}>
          <button type="button" className={s.ghost} onClick={() => order('redeem')}>{b.redeem}</button>
          <button type="button" className={s.cta} onClick={() => order('subscribe')}><span>{b.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>
        </div>
        : <button type="button" className={s.cta} onClick={() => order('subscribe')}><span>{b.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>}
    </div>}
  </MaisonPage>
}

const o = (locale: keyof typeof tradeCopy) => tradeCopy[locale].basketOrder

type Done = { kind: 'subscribe'; duplicate: boolean; data: BasketSubscription } | { kind: 'redeem'; duplicate: boolean; data: BasketRedemption }

/** `/basket/:id/order[?side=redeem]` — auth required. Subscribing needs eligibility (server-side); redeeming never does. */
export function BasketOrderScreen({ id, side }: { id: string | null; side: 'subscribe' | 'redeem' }) {
  const { locale, copy, b, o: t } = useT()
  const validId = id && isOrderableId(id) ? id : null
  const detail = useBasket(validId)
  const basket = detail.data
  const content=useContentTranslation(basket?[basket.name,basket.strategyName,...basket.holdings.map(h=>h.name)]:[])
  const disclosures = useQuery(side === 'subscribe' && validId ? 'basket:disclosures' : null, listBasketDisclosures, { staleTime: 5 * 60_000 })
  const wallet = useQuery(side === 'subscribe' ? 'wallet:summary:basket' : null, getWallet, { staleTime: 15_000 })
  const [value, setValue] = useState('')
  const [ack, setAck] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [expanded, setExpanded] = useState(false)
  const keys = useRef(new Map<string, string>())
  const acknowledged = useRef(new Set<string>())

  const back = validId ? `/basket/${encodeURIComponent(validId)}` : '/markets?tab=baskets'
  const topbar = <RwaTopbar screen={side === 'redeem' ? 'basket-redeem' : 'basket-subscribe'} title={side === 'redeem' ? t.redeem : t.subscribe} onBack={() => backOr(back)} />
  const disclosure = disclosureFor(disclosures.data, basket?.strategyId)
  const available = wallet.data?.balances.availableAtomic ?? null
  const walletDecimals = wallet.data?.asset.decimals ?? 6

  const fieldError = useMemo(() => {
    if (!basket || !value) return null
    if (side === 'subscribe') {
      if (!DEC_6.test(value) || scaled(value, 6) === BigInt(0)) return t.errors.format
      const min = scaled(basket.minimumSubscriptionUsd, 6)
      if (min !== null && scaled(value, 6)! < min) return fill(t.errors.min, { v: fmtUsd(basket.minimumSubscriptionUsd ?? null, { locale }) })
      const amount = toAtomic(value, walletDecimals)
      if (available !== null && amount !== null && BigInt(amount) > BigInt(available)) return t.errors.balance
      return null
    }
    if (!DEC_8.test(value) || scaled(value, 8) === BigInt(0)) return t.errors.unitsFormat
    const held = scaled(basket.userUnits, 8)
    if (held !== null && scaled(value, 8)! > held) return t.errors.held
    return null
  }, [available, basket, locale, side, t.errors, value, walletDecimals])

  const estUnits = useMemo(() => {
    if (side !== 'subscribe' || !value || fieldError) return null
    const amount = scaled(value, 18), nav = scaled(basket?.navPerUnit, 18)
    if (amount === null || nav === null || nav === BigInt(0)) return null
    return fromAtomic((amount * BigInt(100_000_000) / nav).toString(), 8)
  }, [basket?.navPerUnit, fieldError, side, value])

  const needsAck = side === 'subscribe' && Boolean(disclosure)
  const ready = Boolean(basket && value && !fieldError && !pending && (!needsAck || ack) && (side === 'redeem' || disclosures.data || disclosures.error))

  const submit = async () => {
    if (!basket || !value || fieldError || pending) return
    if (needsAck && !ack) { setServerError(t.errors.ack); return }
    setPending(true)
    setServerError(null)
    if (side === 'subscribe' && disclosure && !acknowledged.current.has(disclosure.id)) {
      // Acknowledge is idempotent on the server, so repeating it after a failed subscribe is safe.
      const acked = await acknowledgeDisclosure(disclosure.id)
      if (!acked.ok) { setPending(false); setServerError(t.server[acked.error.code] ?? acked.error.message ?? copy.common.errorGeneric); return }
      acknowledged.current.add(disclosure.id)
    }
    const path = `/v1/basket/portfolios/${basket.id}/${side === 'subscribe' ? 'subscriptions' : 'redemptions'}`
    const body = side === 'subscribe' ? { amountUsd: value } : { units: value }
    // Same body → same key: a retry after a timeout returns the original settlement instead of a second one.
    const key = idempotencyKeyForIntent(keys.current, 'POST', path, body)
    const result = side === 'subscribe' ? await subscribeBasket(basket.id, value, key) : await redeemBasket(basket.id, value, key)
    setPending(false)
    if (!result.ok) {
      setServerError(t.server[result.error.code] ?? result.error.message ?? copy.common.errorGeneric)
      if (result.error.code === 'BASKET_DISCLOSURE_ACK_REQUIRED') { acknowledged.current.clear(); setAck(false); void disclosures.refetch() }
      return
    }
    invalidate(['basket:', 'wallet:', 'portfolio:', 'home:', 'markets:baskets'])
    setDone('subscription' in result.data
      ? { kind: 'subscribe', duplicate: Boolean(result.data.duplicate), data: result.data.subscription }
      : { kind: 'redeem', duplicate: Boolean(result.data.duplicate), data: result.data.redemption })
  }

  if (!validId) return <Missing page="basket-order" topbar={topbar} />
  if (done) return <BasketDone done={done} basketId={validId} topbar={topbar} />
  if (!basket && !detail.error) return <MaisonPage page="basket-order" topbar={topbar}><div className={s.hero}><Skeleton rows={4} /></div></MaisonPage>
  if (!basket) return <Missing page="basket-order" topbar={topbar} error={detail.error} retry={detail.refetch} />

  const open = OPEN.has(basket.status)
  const held = scaled(basket.userUnits, 8)
  const unit = side === 'subscribe' ? (wallet.data?.asset.code ?? 'USDT') : t.units

  return <MaisonPage page="basket-order" topbar={topbar} cta>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.titleL}>{basket.name}</h1>
      <p className={s.lede}>{t.navAt} <b className={s.num}>{fmtUsd(basket.navPerUnit, { digits: 4, locale })}</b></p>
    </header>

    {!open && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{t.server.BASKET_PORTFOLIO_NOT_ACTIVE}</span></div>}

    <label className={s.kicker} htmlFor="basket-amount" style={{ marginTop: 4 }}>{side === 'subscribe' ? t.amount : t.units}</label>
    <div className={s.amount}>
      <input id="basket-amount" inputMode="decimal" autoComplete="off" placeholder={side === 'subscribe' ? '0.00' : '0'} value={value} aria-invalid={Boolean(fieldError)} aria-describedby="basket-amount-meta"
        onChange={(event) => { setValue(event.target.value.replace(',', '.').replace(/[^\d.]/g, '')); setServerError(null) }} />
      <span>{unit}</span>
    </div>
    <div className={s.fieldMeta} id="basket-amount-meta">
      {side === 'subscribe'
        ? <span>{!wallet.data && !wallet.error ? '…' : wallet.error && !wallet.data ? <button type="button" className={s.link} onClick={wallet.refetch}>{copy.common.unavailable} · {copy.common.retry}</button> : fill(t.available, { v: fmtAtomic(available, walletDecimals, wallet.data?.asset.code ?? 'USDT') })}</span>
        : <span>{fill(t.held, { v: fmtUnits(basket.userUnits ?? '0', locale) })}</span>}
      {side === 'subscribe' && basket.minimumSubscriptionUsd && <span className={s.num}>{fill(t.errors.min, { v: fmtUsd(basket.minimumSubscriptionUsd, { locale }) })}</span>}
    </div>
    {value && fieldError && <p className={s.fieldError} role="alert">{fieldError}</p>}
    {side === 'redeem' && held !== null && held > BigInt(0) && <div className={s.chips}>
      {[4, 2, 1].map((div) => { const part = fromAtomic((held / BigInt(div)).toString(), 8); return <button key={div} type="button" className={s.chip} aria-pressed={value === part} onClick={() => { setValue(part); setServerError(null) }}>{div === 1 ? 'MAX' : `1/${div}`}</button> })}
    </div>}

    <section className={s.lacquer} style={{ marginTop: 26 }} aria-live="polite">
      <dl className={s.summary}>
        <div><dt>{t.navAt}</dt><dd className={s.num}>{fmtUsd(basket.navPerUnit, { digits: 4, locale })}</dd></div>
        {side === 'subscribe'
          ? <div data-strong="true"><dt>{t.estUnits}</dt><dd className={s.num}>{estUnits ? `≈ ${Number(estUnits).toLocaleString(locale, { maximumFractionDigits: 8 })}` : '—'}</dd></div>
          : <div data-strong="true"><dt>{t.units}</dt><dd className={s.num}>{value && !fieldError ? fmtUnits(value, locale) : '—'}</dd></div>}
      </dl>
    </section>

    {side === 'subscribe' && <>
      <SectionHead title={t.disclosure} />
      {!disclosures.data && !disclosures.error ? <Skeleton rows={2} />
        : disclosures.error && !disclosures.data ? <StateBlock tone="error" title={copy.common.errorGeneric} body={disclosures.error.message} retry={disclosures.refetch} retryLabel={copy.common.retry} />
        : disclosure ? <>
          <p className={s.prose} style={{ margin: 0 }}><b>{disclosure.title}</b></p>
          <p className={s.prose} style={expanded ? undefined : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{disclosure.content}</p>
          {!expanded && <button type="button" className={s.link} onClick={() => setExpanded(true)}>{t.readMore}</button>}
          <label className={s.consent}>
            <input type="checkbox" checked={ack} onChange={(event) => { setAck(event.target.checked); setServerError(null) }} />
            <span>{fill(t.ack, { v: disclosure.version })}</span>
          </label>
        </> : <p className={s.muted} style={{ fontSize: 12.5 }}>{t.noDisclosure}</p>}
    </>}

    {serverError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}

    <div className={s.stickyCta}>
      <p>{side === 'subscribe' ? t.eligibility : b.note}</p>
      <button type="button" className={s.cta} onClick={submit} disabled={!ready || !open} aria-busy={pending}>
        <span>{pending ? t.submitting : side === 'subscribe' ? t.confirm : t.confirmRedeem}</span>
        <span className={s.ctaIcon}><ArrowRight size={17} /></span>
      </button>
    </div>
  </MaisonPage>
}

function BasketDone({ done, basketId, topbar }: { done: Done; basketId: string; topbar: ReactNode }) {
  const { locale, o: t } = useT()
  const settled = done.data.status === 'settled'
  const nav = fmtUsd(done.data.navPerUnit, { digits: 4, locale })
  return <MaisonPage page="basket-order" topbar={topbar}>
    <section className={s.lacquer} style={{ marginTop: 18 }} aria-live="polite">
      <div className={s.statusMark} data-tone={settled ? 'up' : 'pending'}><Check size={26} strokeWidth={1.6} /></div>
      <span className={s.kicker}>{t.kicker}</span>
      <h1 className={s.titleL} style={{ marginTop: 10 }}>{done.kind === 'subscribe' ? t.doneSub : t.doneRedeem}</h1>
      <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55 }}>{done.kind === 'subscribe'
        ? fill(t.doneBody, { u: fmtUnits(done.data.unitsIssued, locale), n: nav })
        : fill(t.doneRedeemBody, { u: fmtUnits(done.data.units, locale), v: fmtUsd(done.data.netAmountUsd, { locale }) })}</p>
      {done.duplicate && <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 12 }}>{t.duplicate}</p>}
      <dl className={s.summary} style={{ marginTop: 18 }}>
        {done.kind === 'subscribe' && <div data-strong="true"><dt>{t.amount}</dt><dd className={s.num}>{fmtUsd(done.data.amountUsd, { locale })}</dd></div>}
        <div><dt>{t.navAt}</dt><dd className={s.num}>{nav}</dd></div>
        <div><dt>{marketCopy[locale].status.orderId}</dt><dd className={s.num}>{done.data.id.slice(0, 8)}…</dd></div>
        <div><dt>{marketCopy[locale].status.completed}</dt><dd>{fmtDateTime(done.data.settledAt, locale)}</dd></div>
      </dl>
    </section>
    <div className={s.actions}>
      <button type="button" className={s.cta} onClick={() => openPath('/assets')}><span>{t.toAssets}</span><span className={s.ctaIcon}><Check size={17} /></span></button>
      <button type="button" className={s.ghost} onClick={() => openPath(`/basket/${encodeURIComponent(basketId)}`, { replace: true })}>{t.toBasket}</button>
    </div>
  </MaisonPage>
}
