'use client'

import { ArrowRight, Info } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import {useContentTranslation} from '@/lib/use-content-translation'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { idempotencyKeyForIntent, isFinalRejection, retireIntentKey } from '@/lib/api/idempotency'
import { acknowledgeDisclosure, disclosureFor, getBasket, getWallet, isOrderableId, listBasketDisclosures, redeemBasket, subscribeBasket, type BasketRedemption, type BasketSubscription } from '@/lib/api/markets'
import { fmtUsd, fromAtomic, toAtomic } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { tradeCopy } from '@/lib/maison-trade-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { sharedBack } from '@/lib/market-shared-transition'
import { Logo, MaisonPage, SectionHead, Skeleton, Sparkline, StateBlock, maison as s } from './primitives'
import { DetailFlow, ProductHero, heroTopbar } from './ProductHero'
import { basketCover, sharedKeys } from '@/lib/product-media'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'
import { AmountPad, FlowConfirm, FlowSuccess, share } from './flow-kit'
import { flowKitCopy } from '@/lib/flow-kit-copy'

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
  const topbar = <RwaTopbar screen="basket-detail" {...(basket ? heroTopbar : {})} title={basket?.name ?? b.kicker.split(' · ')[0]} onBack={() => validId ? sharedBack(`basket:${validId}:`, () => backOr('/markets?tab=baskets')) : backOr('/markets?tab=baskets')} />

  if (!validId) return <Missing page="basket" topbar={topbar} />
  if (!basket && !detail.error) return <MaisonPage page="basket" dock topbar={topbar}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (!basket) return <Missing page="basket" topbar={topbar} error={detail.error} retry={detail.refetch} />

  const open = OPEN.has(basket.status)
  const held = scaled(basket.userUnits, 8)
  const history = [...basket.navHistory].filter((point) => point.nav && Number.isFinite(Number(point.nav))).sort((a, c) => Date.parse(a.timestamp) - Date.parse(c.timestamp))
  const order = (side: 'subscribe' | 'redeem') => openPath(`/basket/${encodeURIComponent(basket.id)}/order${side === 'redeem' ? '?side=redeem' : ''}`)

  return <MaisonPage page="basket" dock topbar={topbar} cta={open}>
    <ProductHero image={basketCover(basket)} imageKey={sharedKeys.basket(basket.id, 'image')} titleKey={sharedKeys.basket(basket.id, 'title')}
      kicker={b.kicker} title={content(basket.name)} titleText={basket.name} sub={basket.strategyName && basket.strategyName !== basket.name ? content(basket.strategyName) : undefined}
      badges={<>
        <span className={s.badge} data-tone={open ? 'live' : 'warn'}>{statusLabel(b, basket.status)}</span>
        {basket.riskLevel && <span className={s.badge}>{b.risk} · {basket.riskLevel}</span>}
      </>} />

    <DetailFlow>
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
    </DetailFlow>

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
  const [reviewOpen, setReviewOpen] = useState(false)
  const kit = flowKitCopy(locale)
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
      // The API keeps a refused attempt as a `pending` row under its key, so a replay would return that row as a
      // "duplicate" (e.g. retrying the same amount after topping up). A definitive refusal starts a new intent.
      if (isFinalRejection(result.error)) retireIntentKey(keys.current, 'POST', path, body)
      setServerError(t.server[result.error.code] ?? result.error.message ?? copy.common.errorGeneric)
      if (result.error.code === 'BASKET_DISCLOSURE_ACK_REQUIRED') { acknowledged.current.clear(); setAck(false); void disclosures.refetch() }
      return
    }
    invalidate(['basket:', 'wallet:', 'portfolio:', 'home:', 'markets:baskets'])
    setReviewOpen(false)
    setDone('subscription' in result.data
      ? { kind: 'subscribe', duplicate: Boolean(result.data.duplicate), data: result.data.subscription }
      : { kind: 'redeem', duplicate: Boolean(result.data.duplicate), data: result.data.redemption })
  }

  if (!validId) return <Missing page="basket-order" topbar={topbar} />
  if (done) return <BasketDone done={done} basketId={validId} topbar={topbar} onAgain={() => { keys.current.clear(); setDone(null); setValue(''); setAck(false); setServerError(null) }} />
  if (!basket && !detail.error) return <MaisonPage page="basket-order" topbar={topbar}><div className={s.hero}><Skeleton rows={4} /></div></MaisonPage>
  if (!basket) return <Missing page="basket-order" topbar={topbar} error={detail.error} retry={detail.refetch} />

  const open = OPEN.has(basket.status)
  const held = scaled(basket.userUnits, 8)
  const unit = side === 'subscribe' ? (wallet.data?.asset.code ?? 'USDT') : t.units
  const subscribe = side === 'subscribe'
  // Quick amounts: a share of the balance (subscribe) or of the units held (redeem).
  const pool = subscribe ? available : held !== null && held > BigInt(0) ? held.toString() : null
  const poolDecimals = subscribe ? walletDecimals : 8
  const talk = !value ? kit.enterAmount
    : fieldError === t.errors.balance ? kit.insufficient
    : fieldError ? fieldError
    : !open ? t.server.BASKET_PORTFOLIO_NOT_ACTIVE
    : pending ? t.submitting
    : subscribe ? kit.buyN(`${value} ${unit}`) : `${t.confirmRedeem} · ${fmtUnits(value, locale)} ${unit}`
  const canReview = Boolean(value && !fieldError && !pending && open && (!subscribe || disclosures.data || disclosures.error))

  return <MaisonPage page="basket-order" topbar={topbar}>
    <AmountPad value={value} onChange={(next) => { setValue(next); setServerError(null) }} decimals={subscribe ? 2 : 6} unit={unit} disabled={pending}
      invalid={Boolean(fieldError)} error={serverError && !reviewOpen ? serverError : null}
      sub={subscribe
        ? (!wallet.data && !wallet.error ? '…' : <>{kit.available(fmtAtomic(available, walletDecimals, wallet.data?.asset.code ?? 'USDT'))}{basket.minimumSubscriptionUsd ? <> · {fill(t.errors.min, { v: fmtUsd(basket.minimumSubscriptionUsd, { locale }) })}</> : null}</>)
        : fill(t.held, { v: fmtUnits(basket.userUnits ?? '0', locale) })}
      side={[{ label: '25%', value: share(pool, 25, poolDecimals) }, { label: '50%', value: share(pool, 50, poolDecimals) }, { label: '75%', value: share(pool, 75, poolDecimals) }, { label: kit.max, value: share(pool, 100, poolDecimals) }]}
      header={<div className={s.orderHead}>
        <p className={s.kicker}>{t.kicker}</p>
        <h1 className={s.orderTitle}>{content(basket.name)}</h1>
        <p className={s.muted} style={{ margin: '4px 0 0', fontSize: 13 }}>{t.navAt} <b className={s.num}>{fmtUsd(basket.navPerUnit, { digits: 4, locale })}</b></p>
      </div>}
      cta={{ label: talk, disabled: !canReview, busy: pending, onClick: () => { setServerError(null); setReviewOpen(true) } }} />
    <FlowConfirm open={reviewOpen} onClose={() => { if (!pending) setReviewOpen(false) }} busy={pending}
      title={subscribe ? kit.reviewBuy : t.redeem} amount={value || '0'} unit={unit}
      rows={[
        { label: t.kicker, value: content(basket.name) },
        { label: t.navAt, value: fmtUsd(basket.navPerUnit, { digits: 4, locale }) },
        subscribe
          ? { label: t.estUnits, value: estUnits ? `≈ ${Number(estUnits).toLocaleString(locale, { maximumFractionDigits: 8 })}` : '—', strong: true }
          : { label: t.units, value: value && !fieldError ? fmtUnits(value, locale) : '—', strong: true },
      ]}
      note={subscribe && disclosure ? <><b>{disclosure.title}</b> · {disclosure.content.length > 140 ? `${disclosure.content.slice(0, 140)}…` : disclosure.content}<br />{t.eligibility}</> : subscribe ? t.eligibility : b.note}
      consent={needsAck && disclosure ? { label: fill(t.ack, { v: disclosure.version }), checked: ack, onChange: (checked) => { setAck(checked); setServerError(null) } } : undefined}
      error={serverError} confirmLabel={subscribe ? kit.confirmBuy : t.confirmRedeem} onConfirm={() => void submit()} />
  </MaisonPage>
}

function BasketDone({ done, basketId, topbar, onAgain }: { done: Done; basketId: string; topbar: ReactNode; onAgain: () => void }) {
  const { locale, o: t } = useT()
  const kit = flowKitCopy(locale)
  const settled = done.data.status === 'settled'
  const nav = fmtUsd(done.data.navPerUnit, { digits: 4, locale })
  return <MaisonPage page="basket-order" topbar={topbar}>
    <FlowSuccess title={done.kind === 'subscribe' ? t.doneSub : t.doneRedeem} pending={!settled}
      amount={done.kind === 'subscribe' ? fmtUsd(done.data.amountUsd, { locale }).replace(/^\$/, '') : fmtUnits(done.data.units, locale)} unit={done.kind === 'subscribe' ? 'USD' : t.units}
      rows={[
        ...(done.kind === 'subscribe' ? [{ label: t.estUnits, value: fmtUnits(done.data.unitsIssued, locale) }] : [{ label: t.amount, value: fmtUsd(done.data.netAmountUsd, { locale }) }]),
        { label: t.navAt, value: nav },
        { label: marketCopy[locale].status.orderId, value: <span className={s.mono}>{done.data.id.slice(0, 8)}</span> },
        { label: marketCopy[locale].status.completed, value: fmtDateTime(done.data.settledAt, locale) },
      ]}
      note={done.duplicate ? t.duplicate : undefined}
      onDone={() => openPath('/assets')} onAgain={onAgain} onRecords={() => openPath(`/basket/${encodeURIComponent(basketId)}`, { replace: true })} />
    <span hidden>{kit.done}</span>
  </MaisonPage>
}
