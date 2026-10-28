'use client'

import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3, Info } from 'lucide-react'
import { useMemo, type MouseEvent } from 'react'
import Image from 'next/image'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { POLL } from '@/lib/api/_http'
import { isListed, listBaskets, listProducts, type BasketPortfolio, type CatalogProduct } from '@/lib/api/markets'
import { fmtUsd } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { proCopy } from '@/lib/maison-pro-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { usePageState } from '@/lib/app-navigation'
import { sharedBack, sharedOpen } from '@/lib/market-shared-transition'
import { HENGXU_FEATURED, HENGXU_PRODUCTS, hengxuById, hengxuImage, type HengxuHorizon, type HengxuProduct, type HengxuRisk, type HengxuTerms } from '@/lib/hengxu-products'
import { hengxuCopy, hengxuText, type HengxuCopy } from '@/lib/hengxu-copy'
import { Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import h from './hengxu.module.css'
import { DetailFlow, ProductHero, heroTopbar } from './ProductHero'
import { basketCover, sharedKeys } from '@/lib/product-media'

const FILTERS = ['all', 'open', 'short', 'long', 'digital', 'research'] as const
type Filter = typeof FILTERS[number]
const HORIZONS: HengxuHorizon[] = ['d90', 'm12', 'y3', 'y5', 'terms']
const SECTION_IDS = ['strategy', 'allocation', 'sources', 'risks', 'exit', 'documents'] as const

const detailPath = (product: HengxuProduct) => `/strategy/${product.id}`

/** A concept only becomes subscribable when the real catalog lists a product with the matching externalRef. */
export function useListings() {
  const products = useQuery('markets:catalog', listProducts, { staleTime: 60_000 })
  return useMemo(() => {
    const map = new Map<string, CatalogProduct>()
    for (const product of products.data ?? []) {
      if (product.externalRef?.startsWith('hengxu-') && isListed(product)) map.set(product.externalRef.slice(7), product)
    }
    return map
  }, [products.data])
}

/** Plain clicks stay in the SPA; modified clicks keep the browser's own link behaviour. */
function go(event: MouseEvent<HTMLAnchorElement>, path: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  sharedOpen(event.currentTarget, () => openPath(path))
}

const sharedKey = (product: HengxuProduct, part: 'title' | 'image') => `strategy:${product.id}:${part}`

/** Body copy only exists in zh/en; other locales read English, so mark it and let each block pick its own direction. */
const bodyProps = (locale: AppLocale) => locale === 'zh-CN' || locale === 'en' ? {} : { lang: 'en', dir: 'auto' as const }

export function riskLabel(copy: HengxuCopy, risk: HengxuRisk) {
  return risk === 'pending' ? copy.riskPending : risk === 'unrated' ? copy.riskUnrated : copy.risk[risk - 1]
}

/** Four ticks, filled up to the tier; ungraded products show hollow dashes instead of a guess. */
function RiskMeter({ risk, copy }: { risk: HengxuRisk; copy: HengxuCopy }) {
  const level = typeof risk === 'number' ? risk : 0
  return <span className={h.risk} data-graded={level > 0}>
    <span className={h.riskTicks} aria-hidden="true">{[1, 2, 3, 4].map((tick) => <i key={tick} data-on={tick <= level} />)}</span>
    <span>{riskLabel(copy, risk)}</span>
  </span>
}

/** Research and special-research strategies are never launch candidates; say so wherever they appear. */
const inResearch = (product: HengxuProduct) => product.stage === 'research' || product.stage === 'special'

/**
 * Live baskets keyed by concept id: a basket's `strategySlug` is `hengxu-<id>`. Purchasability lives
 * on the basket record, not in the catalog, so this — not `useListings` — is what proves a strategy
 * is open. Shares the `markets:baskets` cache entry with the Open shelf, so it costs no extra fetch.
 */
function useBasketIndex() {
  const baskets = useQuery('markets:baskets', listBaskets, { staleTime: 60_000, pollInterval: POLL.list })
  return useMemo(() => {
    const map = new Map<string, BasketPortfolio>()
    for (const basket of baskets.data ?? []) {
      if (basket.strategySlug?.startsWith('hengxu-')) map.set(basket.strategySlug.slice(7), basket)
    }
    return map
  }, [baskets.data])
}

export const minText = (product: HengxuProduct, copy: HengxuCopy) => product.terms?.minInvestment === undefined ? copy.minValue : `${product.terms.minInvestment} USDT`

function StageBadge({ product, listing, copy }: { product: HengxuProduct; listing?: CatalogProduct; copy: HengxuCopy }) {
  if (listing) return <span className={s.badge} data-tone="live">{copy.listed}</span>
  if (inResearch(product)) return <span className={s.badge} data-tone="warn">{copy.stage[product.stage]} · {copy.terms.closed}</span>
  return <span className={s.badge} data-tone="accent">{copy.stage[product.stage]}</span>
}

/** zh-CN shows the Chinese strategy name; every other locale shows the romanised name, tagged so it is read as Latin. */
export function names(product: HengxuProduct, locale: AppLocale) {
  const text = hengxuText(product, locale)
  return { mark: text.name, sub: text.subtitle, lang: locale === 'zh-CN' ? 'zh-CN' : 'en' }
}

function Picture({ product, locale, sizes, priority, ratio }: { product: HengxuProduct; locale: AppLocale; sizes: string; priority?: boolean; ratio?: 'card' | 'natural' }) {
  const text = hengxuText(product, locale)
  return <span className={h.picture} data-shared={sharedKey(product, 'image')} data-ratio={ratio ?? 'card'} style={ratio === 'natural' ? { aspectRatio: `${product.image.width} / ${product.image.height}` } : undefined}>
    <Image src={hengxuImage(product, ratio === 'natural' ? 1440 : 720)} alt={text.alt} fill sizes={sizes} priority={priority} style={{ objectFit: 'cover', objectPosition: product.image.focus }} />
  </span>
}

/** Markets → Baskets: live portfolios and the 衡序 series in one list. A strategy leaves its holding-period band
 *  and joins "Open" as soon as the catalog lists it, so nothing is shown twice. */
export function BasketShelf() {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const market = marketCopy[locale]
  const pro = proCopy[locale]
  const listings = useListings()
  const baskets = useQuery('markets:baskets', listBaskets, { staleTime: 60_000, pollInterval: POLL.list })
  const basketIndex = useBasketIndex()
  const [filter, setFilter] = usePageState<Filter>('markets:baskets:filter', 'all')
  const live = baskets.data ?? []
  /** Open = a live basket or a catalog listing. Live baskets show once, in the Open shelf, as real portfolios. */
  const isOpen = (product: HengxuProduct) => listings.has(product.id) || basketIndex.has(product.id)
  const listed = HENGXU_PRODUCTS.filter((product) => listings.has(product.id))
  const showOpen = filter === 'all' || filter === 'open'
  const series = filter === 'open' ? [] : HENGXU_PRODUCTS.filter((product) => (filter === 'all' || product.filters.includes(filter)) && !(showOpen && isOpen(product)))
  const featured = series.find((product) => product.id === HENGXU_FEATURED)
  const rest = series.filter((product) => product !== featured)
  const bands = HORIZONS.map((horizon) => ({ horizon, items: rest.filter((product) => product.horizon === horizon) })).filter((band) => band.items.length)
  const openCount = live.length + listed.length
  const candidates = HENGXU_PRODUCTS.filter((product) => !isOpen(product) && !inResearch(product)).length
  const researching = HENGXU_PRODUCTS.filter((product) => !isOpen(product) && inResearch(product)).length
  const count = (key: Filter) => key === 'all' ? live.length + HENGXU_PRODUCTS.length : key === 'open' ? openCount : HENGXU_PRODUCTS.filter((product) => product.filters.includes(key)).length
  const termsHead = <div className={s.tableHead} aria-hidden="true"><span>{copy.sections[0]} · {copy.fields.risk}</span><span>{copy.terms.mgmtFee} · {copy.fields.min}</span></div>

  return <div className={s.tabPanel} role="tabpanel">
    <header className={h.intro}>
      <p className={s.kicker}>{copy.shelf.kicker}</p>
      <h2 className={h.introTitle}>{copy.shelf.title}</h2>
      <p className={h.introLede}>{copy.shelf.lede}</p>
      <dl className={h.tally}>
        <div><dt>{copy.shelf.open}</dt><dd className={s.num}>{baskets.data || baskets.error ? openCount : '—'}</dd></div>
        <div><dt>{copy.shelf.candidates}</dt><dd className={s.num}>{candidates}</dd></div>
        <div><dt>{copy.filters.research}</dt><dd className={s.num}>{researching}</dd></div>
      </dl>
    </header>

    <div className={s.chips} role="group" aria-label={copy.shelf.kicker}>
      {FILTERS.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={filter === key} onClick={() => setFilter(key)}>{key === 'open' ? copy.shelf.open : copy.filters[key]}<small className={s.num}>{count(key)}</small></button>)}
    </div>

    {showOpen && <section aria-label={copy.shelf.open}>
      <SectionHead title={copy.shelf.open} note={copy.shelf.openNote} />
      {!baskets.data && !baskets.error && <Skeleton rows={2} />}
      {baskets.error && !baskets.data && <StateBlock tone="error" title={market.markets.loadError} body={baskets.error.message} retry={baskets.refetch} retryLabel={market.common.retry} />}
      {live.length > 0 && <>
        <div className={s.tableHead} aria-hidden="true"><span>{pro.name}</span><span>{pro.nav} · AUM</span></div>
        <ul className={s.list}>{live.map((basket) => <li key={basket.id}><LiveRow basket={basket} /></li>)}</ul>
      </>}
      {listed.length > 0 && <>
        {termsHead}
        <ul className={h.rows}>{listed.map((product) => <li key={product.id}><StrategyRow product={product} listing={listings.get(product.id)} /></li>)}</ul>
      </>}
      {baskets.data && !openCount && <StateBlock title={market.markets.basketsEmpty} body={market.markets.basketsEmptyBody} />}
    </section>}

    {series.length > 0 && <section id="hengxu" className={h.series} data-lead={!showOpen} aria-labelledby="hx-title">
      <header>
        <p className={s.kicker}>{copy.series} · <span className={s.num}>{HENGXU_PRODUCTS.length - listed.length}</span></p>
        <h3 className={h.seriesTitle} id="hx-title">{copy.title}</h3>
        <p className={h.introLede}>{listings.size ? copy.ledeLive : copy.lede}</p>
        {!listings.size && <p className={h.conceptLine}><Info size={13} strokeWidth={1.8} aria-hidden="true" />{copy.conceptLong}</p>}
      </header>

      {featured && <FeaturedCard product={featured} listing={listings.get(featured.id)} />}

      {bands.length > 0 && <div style={{ marginTop: 20 }}>{termsHead}</div>}
      {bands.map((band) => <section key={band.horizon} className={h.band} aria-labelledby={`hx-band-${band.horizon}`}>
        <h4 className={h.bandHead} id={`hx-band-${band.horizon}`}><Clock3 size={12} strokeWidth={1.8} aria-hidden="true" /><span>{copy.horizon[band.horizon]}</span><small className={s.num}>{fill(band.items.length === 1 ? copy.countOne : copy.count, { n: band.items.length })}</small></h4>
        <ul className={h.rows}>{band.items.map((product) => <li key={product.id}><StrategyRow product={product} listing={listings.get(product.id)} /></li>)}</ul>
      </section>)}
    </section>}

    {filter !== 'open' && !series.length && <StateBlock title={copy.empty} />}
  </div>
}

/** A live basket portfolio: NAV per unit leads, AUM under it, the minimum ticket in the subtitle when the API sends one. */
function LiveRow({ basket }: { basket: BasketPortfolio }) {
  const { locale } = useI18n()
  const market = marketCopy[locale]
  const name = basket.name || basket.strategyName || basket.id
  const sub = [basket.strategyName && basket.strategyName !== name ? basket.strategyName : null, basket.riskLevel, basket.minimumSubscriptionUsd ? fill(market.markets.from, { v: fmtUsd(basket.minimumSubscriptionUsd, { locale }) }) : null]
  return <button type="button" className={s.row} onClick={(event) => sharedOpen(event.currentTarget, () => openPath(`/basket/${encodeURIComponent(basket.id)}`))}>
    <Logo src={basketCover(basket, 'thumb')} name={name} shared={sharedKeys.basket(basket.id, 'image')} />
    <span className={s.rowMain}><b data-shared={`basket:${basket.id}:title`}>{name}</b><small>{sub.filter(Boolean).join(' · ')}</small></span>
    <span className={s.rowFig}><b className={s.num}>{fmtUsd(basket.navPerUnit, { digits: 4, locale })}</b><small className={s.muted}>{fmtUsd(basket.aumUsd, { compact: true, locale })}</small></span>
  </button>
}

function FeaturedCard({ product, listing }: { product: HengxuProduct; listing?: CatalogProduct }) {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const text = hengxuText(product, locale)
  const { mark, sub, lang } = names(product, locale)
  return <a href={detailPath(product)} className={h.featured} onClick={(event) => go(event, detailPath(product))}>
    <Picture product={product} locale={locale} sizes="(max-width: 480px) 100vw, 480px" priority />
    <span className={h.featuredBody}>
      <span className={h.meta}><span>{copy.flagship}</span><span className={s.num}>{product.no} / 10</span></span>
      <span className={h.nameLine}><b className={h.mark} lang={lang} data-shared={sharedKey(product, 'title')}>{mark}</b><span className={h.sub} dir="auto">{sub}</span></span>
      <span className={h.oneLiner} {...bodyProps(locale)}>{text.oneLiner}</span>
      <span className={h.featuredFacts}>
        <span><small>{copy.fields.risk}</small><RiskMeter risk={product.risk} copy={copy} /></span>
        <span><small>{copy.fields.hold}</small><b>{copy.horizon[product.horizon]}</b></span>
        <span><small>{copy.fields.min}</small><b>{minText(product, copy)}</b></span>
      </span>
      <span className={h.featuredFoot}><StageBadge product={product} listing={listing} copy={copy} /><span className={h.learn}>{copy.learn}<ArrowUpRight size={15} aria-hidden="true" /></span></span>
    </span>
  </a>
}

function StrategyRow({ product, listing }: { product: HengxuProduct; listing?: CatalogProduct }) {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const text = hengxuText(product, locale)
  const { mark, sub, lang } = names(product, locale)
  const fee = product.terms?.mgmtFeePct
  return <a href={detailPath(product)} className={h.row} onClick={(event) => go(event, detailPath(product))}>
    <Picture product={product} locale={locale} sizes="96px" />
    <span className={h.rowText}>
      <span className={h.nameLine}><b className={h.markS} lang={lang} data-shared={sharedKey(product, 'title')}>{mark}</b><span className={h.sub} dir="auto">{sub}</span></span>
      <span className={h.rowLine} {...bodyProps(locale)}>{text.oneLiner}</span>
      <span className={h.rowFoot}><RiskMeter risk={product.risk} copy={copy} /><StageBadge product={product} listing={listing} copy={copy} /></span>
    </span>
    <span className={h.rowFig}>
      {fee === undefined ? <b className={h.tba}>{copy.tba}</b> : <b className={s.num}>{fee.toFixed(2)}%<small>{copy.terms.perYear}</small></b>}
      <small className={s.num}>{minText(product, copy)}</small>
    </span>
  </a>
}

/** `/strategy/:id` — strategy → allocation → return sources → risks → fees & exit → documents. */
export function HengxuDetailScreen({ id }: { id: string | null }) {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const listings = useListings()
  const basketIndex = useBasketIndex()
  const product = hengxuById(id)
  const topbar = <RwaTopbar screen="strategy-detail" {...(product ? heroTopbar : {})} title={product ? names(product, locale).mark : copy.series} onBack={() => product ? sharedBack(`strategy:${product.id}:`, () => backOr('/markets?tab=baskets')) : backOr('/markets?tab=baskets')} />

  if (!product) return <MaisonPage page="strategy" dock topbar={topbar}><div className={s.hero}>
    <StateBlock title={copy.notFound} body={copy.notFoundBody} action={<button type="button" className={s.link} onClick={() => openPath('/markets?tab=baskets')}>{copy.back}</button>} />
  </div></MaisonPage>

  const text = hengxuText(product, locale)
  const body = bodyProps(locale)
  const { mark, sub, lang } = names(product, locale)
  const listing = listings.get(product.id)
  const openBasket = basketIndex.get(product.id)
  /** The strategy is open when either the catalog lists it or a live basket carries it. */
  const open = Boolean(listing || openBasket)
  const index = HENGXU_PRODUCTS.indexOf(product)
  const prev = HENGXU_PRODUCTS[(index + HENGXU_PRODUCTS.length - 1) % HENGXU_PRODUCTS.length]
  const next = HENGXU_PRODUCTS[(index + 1) % HENGXU_PRODUCTS.length]
  const tba = <span className={h.tba}>{copy.tba}</span>
  const terms: HengxuTerms = product.terms ?? {}
  const pct = (value: number | undefined, suffix = '') => value === undefined ? tba : `${value.toFixed(2)}%${suffix}`
  const mgmtFee = pct(terms.mgmtFeePct, copy.terms.perYear)
  const lockup = terms.lockupDays === undefined ? tba : fill(copy.terms.days, { n: terms.lockupDays })
  const settle = terms.settleDays === undefined ? tba : `T+${terms.settleDays}`
  const researching = inResearch(product)
  const jump = (target: string) => document.getElementById(`hx-${target}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  const summary = product.allocation.map(([sleeve, weight]) => `${copy.sleeves[sleeve]} ${weight}%`).join(', ')

  return <MaisonPage page="strategy" dock topbar={topbar}>
    <ProductHero image={hengxuImage(product, 1440)} imageKey={sharedKey(product, 'image')} focus={product.image.focus} alt={text.alt} caption={copy.heroCaption}
      kicker={<>{copy.series} · <span className={s.num}>{product.no} / 10</span></>}
      title={mark} titleText={mark} titleKey={sharedKey(product, 'title')} titleLang={lang} sub={sub}
      badges={<>
        {!open && <span className={s.badge} data-tone="warn">{copy.concept}</span>}
        <StageBadge product={product} listing={listing} copy={copy} />
        <span className={h.shortTag} lang="en" dir="ltr">{product.short}</span>
      </>}
      lede={<span {...body}>{text.oneLiner}</span>}>
      {researching && text.blocker && <p className={s.notice}><Info size={15} aria-hidden="true" /><span><b>{copy.terms.blocked}</b> <span {...body}>{text.blocker}</span></span></p>}
    </ProductHero>

    <DetailFlow>

    <section className={`${s.lacquer} ${h.facts}`} aria-label={copy.sections[4]}>
      <dl className={h.factGrid}>
        <div><dt>{copy.fields.risk}</dt><dd><RiskMeter risk={product.risk} copy={copy} /></dd></div>
        <div><dt>{copy.fields.hold}</dt><dd>{copy.horizon[product.horizon]}</dd></div>
        <div><dt>{copy.fields.lock}</dt><dd>{lockup}</dd></div>
        <div><dt>{copy.fields.redeem}</dt><dd>{settle}</dd></div>
        <div><dt>{copy.fields.min}</dt><dd>{minText(product, copy)}<small>{terms.provisional ? copy.terms.provisional : copy.minNote}</small></dd></div>
        <div><dt>{copy.fields.fees}</dt><dd>{mgmtFee}{terms.mgmtFeePct !== undefined && <small>{terms.provisional ? copy.terms.provisional : copy.terms.mgmtFee}</small>}</dd></div>
      </dl>
      {openBasket
        ? <button type="button" className={s.cta} onClick={() => openPath(`/basket/${encodeURIComponent(openBasket.id)}`)}><span>{copy.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>
        : listing
          ? <button type="button" className={s.cta} onClick={() => openPath(`/asset/${encodeURIComponent(listing.externalRef ?? listing.id)}`)}><span>{copy.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>
          : <button type="button" className={`${s.cta} ${h.soon}`} disabled aria-describedby="hx-cta-note"><span>{researching ? `${copy.stage[product.stage]} · ${copy.terms.closed}` : copy.soon}</span><span className={s.ctaIcon}><Clock3 size={16} /></span></button>}
      <p className={h.ctaNote} id="hx-cta-note">{open ? copy.listedNote : copy.ctaNote}</p>
    </section>

    <nav className={s.chips} aria-label={copy.jump}>
      {SECTION_IDS.map((key, position) => <button key={key} type="button" className={s.chip} onClick={() => jump(key)}><small className={s.num}>0{position + 1}</small>{copy.sections[position]}</button>)}
    </nav>

    <section id="hx-strategy" className={h.section}>
      <SectionHead index="01" title={copy.sections[0]} />
      <dl className={h.pairs} data-align="start">
        <div><dt>{copy.fit}</dt><dd {...body}>{text.fit}</dd></div>
      </dl>
    </section>

    <section id="hx-allocation" className={h.section}>
      <SectionHead index="02" title={copy.sections[1]} note={copy.allocationNote} />
      <div className={h.bar} role="img" aria-label={summary}>
        {product.allocation.map(([sleeve, weight], position) => <i key={sleeve} data-tone={position} style={{ flexGrow: weight }} />)}
      </div>
      <ul className={h.legend}>
        {product.allocation.map(([sleeve, weight], position) => <li key={sleeve}>
          <i data-tone={position} aria-hidden="true" /><span dir="auto">{copy.sleeves[sleeve]}</span><b className={s.num}>{weight}%</b>
        </li>)}
      </ul>
      {text.allocationNote && <p className={s.notice}><Info size={15} aria-hidden="true" /><span {...body}>{text.allocationNote}</span></p>}
    </section>

    <section id="hx-sources" className={h.section}>
      <SectionHead index="03" title={copy.sections[2]} note={copy.sourcesNote} />
      <ol className={h.numbered}>{text.sources.map((line) => <li key={line} {...body}>{line}</li>)}</ol>
      <dl className={h.pairs}><div><dt>{copy.netReturn}</dt><dd>{tba}</dd></div></dl>
      <dl className={h.pairs} data-align="start">
        <div><dt>{copy.terms.benchmark}</dt><dd {...body}>{text.benchmark ?? tba}</dd></div>
        <div><dt>{copy.terms.target}</dt><dd {...body}>{text.target ?? tba}</dd></div>
        {text.scenario && <div><dt>{copy.terms.scenario}</dt><dd {...body}>{text.scenario}</dd></div>}
        <div><dt>{copy.terms.nav}</dt><dd {...body}>{text.nav ?? tba}</dd></div>
      </dl>
      <p className={s.notice}><Info size={15} aria-hidden="true" /><span>{copy.terms.notPromise}</span></p>
    </section>

    <section id="hx-risks" className={h.section}>
      <SectionHead index="04" title={copy.sections[3]} note={copy.stressNote} />
      <ol className={h.numbered} data-tone="risk">{text.risks.map((line) => <li key={line} {...body}>{line}</li>)}</ol>
      {text.riskNote && <p className={s.notice}><Info size={15} aria-hidden="true" /><span {...body}>{text.riskNote}</span></p>}
    </section>

    <section id="hx-exit" className={h.section}>
      <SectionHead index="05" title={copy.sections[4]} />
      <dl className={h.pairs}>
        <div><dt>{copy.terms.mgmtFee}</dt><dd>{mgmtFee}</dd></div>
        <div><dt>{copy.terms.subFee}</dt><dd>{pct(terms.subFeePct)}</dd></div>
        <div><dt>{copy.terms.redFee}</dt><dd>{pct(terms.redFeePct)}</dd></div>
        <div><dt>{copy.exit.fundFee}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.fields.hold}</dt><dd>{copy.horizon[product.horizon]}</dd></div>
        <div><dt>{copy.fields.lock}</dt><dd>{lockup}</dd></div>
        <div><dt>{copy.exit.window}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.fields.redeem}</dt><dd>{settle}</dd></div>
        <div><dt>{copy.fields.min}</dt><dd>{terms.minInvestment === undefined ? tba : `${terms.minInvestment} USDT`}</dd></div>
      </dl>
      {terms.provisional && <p className={s.notice}><Info size={15} aria-hidden="true" /><span>{copy.terms.provisional}</span></p>}
      {text.feeNote && <p className={s.notice}><Info size={15} aria-hidden="true" /><span {...body}>{text.feeNote}</span></p>}
      <p className={h.prose}><b>{copy.exit.how}</b><span {...body}>{text.exit}</span></p>
    </section>

    <section id="hx-documents" className={h.section}>
      <SectionHead index="06" title={copy.sections[5]} />
      <StateBlock tone="unavailable" title={copy.docsTitle} body={copy.docsBody} />
      <h3 className={h.subhead}>{copy.beforeLaunch}</h3>
      <ul className={h.checklist}>{text.focus.map((line) => <li key={line} {...body}>{line}</li>)}</ul>
      {text.conditions && <>
        <h3 className={h.subhead}>{copy.terms.conditions}</h3>
        <ul className={h.checklist}>{text.conditions.map((line) => <li key={line} {...body}>{line}</li>)}</ul>
      </>}
    </section>

    </DetailFlow>

    <nav className={h.pager} aria-label={copy.series}>
      <a href={detailPath(prev)} onClick={(event) => go(event, detailPath(prev))}><ArrowLeft size={15} aria-hidden="true" /><span><small>{copy.prev}</small><b lang={lang}>{names(prev, locale).mark}</b></span></a>
      <a href={detailPath(next)} onClick={(event) => go(event, detailPath(next))} data-end="true"><span><small>{copy.next}</small><b lang={lang}>{names(next, locale).mark}</b></span><ArrowRight size={15} aria-hidden="true" /></a>
    </nav>
  </MaisonPage>
}
