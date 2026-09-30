'use client'

import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3, Info } from 'lucide-react'
import { useMemo, useState, type MouseEvent } from 'react'
import Image from 'next/image'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { isListed, listProducts, type CatalogProduct } from '@/lib/api/markets'
import { fill } from '@/lib/maison-market-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { HENGXU_FEATURED, HENGXU_PRODUCTS, hengxuById, hengxuImage, type HengxuFilter, type HengxuHorizon, type HengxuProduct, type HengxuRisk } from '@/lib/hengxu-products'
import { hengxuCopy, hengxuText, type HengxuCopy } from '@/lib/hengxu-copy'
import { MaisonPage, SectionHead, StateBlock, maison as s } from './primitives'
import h from './hengxu.module.css'

const FILTERS = ['all', 'short', 'long', 'digital', 'research'] as const
type Filter = typeof FILTERS[number]
const HORIZONS: HengxuHorizon[] = ['d90', 'm12', 'y3', 'y5', 'terms']
const SECTION_IDS = ['strategy', 'allocation', 'sources', 'risks', 'exit', 'documents'] as const

const detailPath = (product: HengxuProduct) => `/strategy/${product.id}`

/** A concept only becomes subscribable when the real catalog lists a product with the matching externalRef. */
function useListings() {
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
  openPath(path)
}

/** Body copy only exists in zh/en; other locales read English, so mark it and let each block pick its own direction. */
const bodyProps = (locale: AppLocale) => locale === 'zh-CN' || locale === 'en' ? {} : { lang: 'en', dir: 'auto' as const }

function riskLabel(copy: HengxuCopy, risk: HengxuRisk) {
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

function StageBadge({ product, listing, copy }: { product: HengxuProduct; listing?: CatalogProduct; copy: HengxuCopy }) {
  if (listing) return <span className={s.badge} data-tone="live">{copy.listed}</span>
  return <span className={s.badge} data-tone={product.stage === 'first' || product.stage === 'second' ? 'accent' : 'warn'}>{copy.stage[product.stage]}</span>
}

/** Chinese strategy name leads in every locale; other locales add the romanised name to the subtitle. */
function names(product: HengxuProduct, locale: AppLocale) {
  const text = hengxuText(product, locale)
  return { mark: product.zh.name, sub: locale === 'zh-CN' ? text.subtitle : `${product.en.name} · ${text.subtitle}` }
}

function Picture({ product, locale, sizes, priority, ratio }: { product: HengxuProduct; locale: AppLocale; sizes: string; priority?: boolean; ratio?: 'card' | 'natural' }) {
  const text = hengxuText(product, locale)
  return <span className={h.picture} data-ratio={ratio ?? 'card'} style={ratio === 'natural' ? { aspectRatio: `${product.image.width} / ${product.image.height}` } : undefined}>
    <Image src={hengxuImage(product, ratio === 'natural' ? 1440 : 720)} alt={text.alt} fill sizes={sizes} priority={priority} style={{ objectFit: 'cover', objectPosition: product.image.focus }} />
  </span>
}

/** Markets → Baskets → 衡序 section: one flagship up top, the rest laid out along a ruler of holding periods. */
export function HengxuPanel() {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const listings = useListings()
  const [filter, setFilter] = useState<Filter>('all')
  const visible = HENGXU_PRODUCTS.filter((product) => filter === 'all' || product.filters.includes(filter as HengxuFilter))
  const featured = visible.find((product) => product.id === HENGXU_FEATURED)
  const rest = visible.filter((product) => product !== featured)
  const bands = HORIZONS.map((horizon) => ({ horizon, items: rest.filter((product) => product.horizon === horizon) })).filter((band) => band.items.length)
  const count = (key: Filter) => key === 'all' ? HENGXU_PRODUCTS.length : HENGXU_PRODUCTS.filter((product) => product.filters.includes(key)).length

  return <section id="hengxu" className={h.series} aria-labelledby="hx-title">
    <header className={h.intro}>
      <p className={s.kicker}>{copy.kicker}</p>
      <h2 className={h.introTitle} id="hx-title">{copy.title}</h2>
      <p className={h.introLede}>{copy.lede}</p>
      <p className={h.conceptLine}><Info size={13} strokeWidth={1.8} aria-hidden="true" />{copy.conceptLong}</p>
    </header>

    <div className={s.chips} role="group" aria-label={copy.series}>
      {FILTERS.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={filter === key} onClick={() => setFilter(key)}>{copy.filters[key]}<small className={s.num}>{count(key)}</small></button>)}
    </div>

    {featured && <FeaturedCard product={featured} listing={listings.get(featured.id)} />}

    {bands.map((band) => <section key={band.horizon} className={h.band} aria-labelledby={`hx-band-${band.horizon}`}>
      <h3 className={h.bandHead} id={`hx-band-${band.horizon}`}><Clock3 size={12} strokeWidth={1.8} aria-hidden="true" /><span>{copy.horizon[band.horizon]}</span><small className={s.num}>{fill(band.items.length === 1 ? copy.countOne : copy.count, { n: band.items.length })}</small></h3>
      <ul className={h.rows}>{band.items.map((product) => <li key={product.id}><StrategyRow product={product} listing={listings.get(product.id)} /></li>)}</ul>
    </section>)}

    {!visible.length && <StateBlock title={copy.empty} />}
  </section>
}

function FeaturedCard({ product, listing }: { product: HengxuProduct; listing?: CatalogProduct }) {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const text = hengxuText(product, locale)
  const { mark, sub } = names(product, locale)
  return <a href={detailPath(product)} className={h.featured} onClick={(event) => go(event, detailPath(product))}>
    <Picture product={product} locale={locale} sizes="(max-width: 480px) 100vw, 480px" priority />
    <span className={h.featuredBody}>
      <span className={h.meta}><span>{copy.flagship}</span><span className={s.num}>{product.no} / 10</span></span>
      <span className={h.nameLine}><b className={h.mark} lang="zh-CN">{mark}</b><span className={h.sub} dir="auto">{sub}</span></span>
      <span className={h.oneLiner} {...bodyProps(locale)}>{text.oneLiner}</span>
      <span className={h.featuredFacts}>
        <span><small>{copy.fields.risk}</small><RiskMeter risk={product.risk} copy={copy} /></span>
        <span><small>{copy.fields.hold}</small><b>{copy.horizon[product.horizon]}</b></span>
        <span><small>{copy.fields.min}</small><b>{copy.minValue}</b></span>
      </span>
      <span className={h.featuredFoot}><StageBadge product={product} listing={listing} copy={copy} /><span className={h.learn}>{copy.learn}<ArrowUpRight size={15} aria-hidden="true" /></span></span>
    </span>
  </a>
}

function StrategyRow({ product, listing }: { product: HengxuProduct; listing?: CatalogProduct }) {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const text = hengxuText(product, locale)
  const { mark, sub } = names(product, locale)
  return <a href={detailPath(product)} className={h.row} onClick={(event) => go(event, detailPath(product))}>
    <span className={h.rowText}>
      <span className={h.nameLine}><b className={h.markS} lang="zh-CN">{mark}</b><span className={h.sub} dir="auto">{sub}</span></span>
      <span className={h.rowLine} {...bodyProps(locale)}>{text.oneLiner}</span>
      <span className={h.rowFoot}><RiskMeter risk={product.risk} copy={copy} /><StageBadge product={product} listing={listing} copy={copy} /></span>
    </span>
    <Picture product={product} locale={locale} sizes="180px" />
  </a>
}

/** `/strategy/:id` — strategy → allocation → return sources → risks → fees & exit → documents. */
export function HengxuDetailScreen({ id }: { id: string | null }) {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const listings = useListings()
  const product = hengxuById(id)
  const topbar = <RwaTopbar screen="strategy-detail" title={product ? product.zh.name : copy.series} onBack={() => backOr('/markets?tab=baskets')} />

  if (!product) return <MaisonPage page="strategy" dock topbar={topbar}><div className={s.hero}>
    <StateBlock title={copy.notFound} body={copy.notFoundBody} action={<button type="button" className={s.link} onClick={() => openPath('/markets?tab=baskets')}>{copy.back}</button>} />
  </div></MaisonPage>

  const text = hengxuText(product, locale)
  const body = bodyProps(locale)
  const { mark, sub } = names(product, locale)
  const listing = listings.get(product.id)
  const index = HENGXU_PRODUCTS.indexOf(product)
  const prev = HENGXU_PRODUCTS[(index + HENGXU_PRODUCTS.length - 1) % HENGXU_PRODUCTS.length]
  const next = HENGXU_PRODUCTS[(index + 1) % HENGXU_PRODUCTS.length]
  const tba = <span className={h.tba}>{copy.tba}</span>
  const jump = (target: string) => document.getElementById(`hx-${target}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  const summary = product.allocation.map(([sleeve, weight]) => `${copy.sleeves[sleeve]} ${weight}%`).join(', ')

  return <MaisonPage page="strategy" dock topbar={topbar}>
    <figure className={h.hero}>
      <Picture product={product} locale={locale} sizes="(max-width: 480px) 100vw, 480px" priority ratio="natural" />
      <figcaption>{copy.heroCaption}</figcaption>
    </figure>

    <header className={h.head}>
      <p className={s.kicker}>{copy.series} · <span className={s.num}>{product.no} / 10</span></p>
      <h1 className={h.title}><span className={h.markL} lang="zh-CN">{mark}</span><span className={h.titleSub} dir="auto">{sub}</span></h1>
      <p className={h.badges}>
        <span className={s.badge} data-tone="warn">{copy.concept}</span>
        <StageBadge product={product} listing={listing} copy={copy} />
        <span className={h.shortTag} lang="en" dir="ltr">{product.short}</span>
      </p>
      <p className={h.lead} {...body}>{text.oneLiner}</p>
    </header>

    <section className={`${s.lacquer} ${h.facts}`} aria-label={copy.sections[4]}>
      <dl className={h.factGrid}>
        <div><dt>{copy.fields.risk}</dt><dd><RiskMeter risk={product.risk} copy={copy} /></dd></div>
        <div><dt>{copy.fields.hold}</dt><dd>{copy.horizon[product.horizon]}</dd></div>
        <div><dt>{copy.fields.lock}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.fields.redeem}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.fields.min}</dt><dd>{copy.minValue}<small>{copy.minNote}</small></dd></div>
        <div><dt>{copy.fields.fees}</dt><dd>{tba}</dd></div>
      </dl>
      {listing
        ? <button type="button" className={s.cta} onClick={() => openPath(`/asset/${encodeURIComponent(listing.externalRef ?? listing.id)}`)}><span>{copy.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>
        : <button type="button" className={`${s.cta} ${h.soon}`} disabled aria-describedby="hx-cta-note"><span>{copy.soon}</span><span className={s.ctaIcon}><Clock3 size={16} /></span></button>}
      <p className={h.ctaNote} id="hx-cta-note">{copy.ctaNote}</p>
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
    </section>

    <section id="hx-risks" className={h.section}>
      <SectionHead index="04" title={copy.sections[3]} note={copy.stressNote} />
      <ol className={h.numbered} data-tone="risk">{text.risks.map((line) => <li key={line} {...body}>{line}</li>)}</ol>
      {text.riskNote && <p className={s.notice}><Info size={15} aria-hidden="true" /><span {...body}>{text.riskNote}</span></p>}
    </section>

    <section id="hx-exit" className={h.section}>
      <SectionHead index="05" title={copy.sections[4]} />
      <dl className={h.pairs}>
        <div><dt>{copy.exit.platformFee}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.exit.fundFee}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.fields.hold}</dt><dd>{copy.horizon[product.horizon]}</dd></div>
        <div><dt>{copy.fields.lock}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.exit.window}</dt><dd>{tba}</dd></div>
        <div><dt>{copy.fields.redeem}</dt><dd>{tba}</dd></div>
      </dl>
      <p className={h.prose}><b>{copy.exit.how}</b><span {...body}>{text.exit}</span></p>
    </section>

    <section id="hx-documents" className={h.section}>
      <SectionHead index="06" title={copy.sections[5]} />
      <StateBlock tone="unavailable" title={copy.docsTitle} body={copy.docsBody} />
      <h3 className={h.subhead}>{copy.beforeLaunch}</h3>
      <ul className={h.checklist}>{text.focus.map((line) => <li key={line} {...body}>{line}</li>)}</ul>
    </section>

    <nav className={h.pager} aria-label={copy.series}>
      <a href={detailPath(prev)} onClick={(event) => go(event, detailPath(prev))}><ArrowLeft size={15} aria-hidden="true" /><span><small>{copy.prev}</small><b lang="zh-CN">{prev.zh.name}</b></span></a>
      <a href={detailPath(next)} onClick={(event) => go(event, detailPath(next))} data-end="true"><span><small>{copy.next}</small><b lang="zh-CN">{next.zh.name}</b></span><ArrowRight size={15} aria-hidden="true" /></a>
    </nav>
  </MaisonPage>
}
