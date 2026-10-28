'use client'

import { ArrowRight, ExternalLink, Info, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import {useContentTranslation} from '@/lib/use-content-translation'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { POLL, apiUrl } from '@/lib/api/_http'
import { getDisclosures, getQuote, getRwaDetail, getRwaHistory, listProducts, productForSlug, type CatalogProduct } from '@/lib/api/markets'
import { fmtUsd, fmtUsdCompact, fmtUsdt, priceDigits } from '@/lib/money'
import { assetClassLabel, fill, marketCopy, networkLabel } from '@/lib/maison-market-copy'
import { proCopy } from '@/lib/maison-pro-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { Delta, Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Figure, Lacquer, PollBar, PriceChart, Segmented, StatStrip } from './motion'
import { fmtAtomic, fmtDateTime } from './format'
import { PublicShareButton } from '../public-sharing'
import { DetailFlow, ProductHero, heroTopbar } from './ProductHero'
import { classCover, productCover, sharedKeys } from '@/lib/product-media'
import { featuredCover } from '@/lib/home-asset-media'

export function AssetDetailScreen({ slug }: { slug: string | null }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const products = useQuery('markets:catalog', listProducts, { staleTime: 60_000, pollInterval: POLL.list })
  const product = slug ? productForSlug(products.data, slug) : undefined
  const content=useContentTranslation(product?[product.displayName,product.summary??'']:[])
  const topbar = <RwaTopbar screen="rwa-detail" {...(product ? heroTopbar : {})} title={content(product?.displayName ?? '')} onBack={() => backOr('/markets')} />
  if (!slug) return <MaisonPage page="asset" topbar={topbar}><div className={s.hero}><StateBlock title={copy.detail.notFound} body={copy.detail.notFoundBody} /></div></MaisonPage>
  if (!products.data && !products.error) return <MaisonPage page="asset" topbar={topbar}><div className={s.hero}><Skeleton rows={4} /></div></MaisonPage>
  // A catalog failure must not silently downgrade an investable product to "research only".
  if (products.error && !products.data) return <MaisonPage page="asset" topbar={topbar}><div className={s.hero}><StateBlock tone="error" title={copy.common.errorGeneric} body={products.error.message} retry={products.refetch} retryLabel={copy.common.retry} /></div></MaisonPage>
  return product ? <InvestableDetail product={product} topbar={topbar} /> : <ResearchDetail slug={slug} />
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), interval); return () => window.clearInterval(timer) }, [interval])
  return now
}


function InvestableDetail({ product, topbar }: { product: CatalogProduct; topbar: React.ReactNode }) {
  const { locale } = useI18n()
  const content=useContentTranslation([product.displayName,product.summary??''])
  const copy = marketCopy[locale]
  const d = copy.detail
  const [tab, setTab] = useState(0)
  const quote = useQuery(`markets:quote:${product.id}`, () => getQuote(product.id), { staleTime: 30_000, pollInterval: POLL.quote })
  const disclosures = useQuery(tab === 2 ? `markets:disclosures:${product.id}` : null, () => getDisclosures(product.id), { staleTime: 300_000 })
  const now = useNow(30_000)
  const klass = copy.markets.classes[product.assetClassId as keyof typeof copy.markets.classes] ?? assetClassLabel(product.assetClassId, locale)
  const network = networkLabel(product.network)
  const expired = quote.data ? quote.data.stale || Date.parse(quote.data.validUntil) <= now : false
  const invest = () => openPath(`/orders/review?product=${encodeURIComponent(product.id)}`)
  // Same picture as the Markets card (lib/product-media), so the card's image can fly into this hero.
  const cover = productCover(product)?.src ?? null
  const slug = product.externalRef ?? product.id
  // Order limits are spend amounts in the USDT settlement asset (the server compares them with the order's
  // USDT atomic amount), not quantities of the product asset, so they share the CTA's unit.
  const keyStats = [
    { label: d.min, value: fmtUsdt(product.minOrderAtomicAmount) },
    { label: d.max, value: fmtUsdt(product.maxOrderAtomicAmount, { digits: 0 }) },
    { label: d.network, value: network },
  ]
  // Display only; order amounts stay atomic strings end to end.
  const unitPrice = quote.data ? Number(quote.data.unitPriceAtomicAmount) / 10 ** quote.data.unitPriceDecimals : null
  const unitDigits = quote.data ? priceDigits(quote.data.unitPriceAtomicAmount, quote.data.unitPriceDecimals) : 2
  const validity = useMemo(() => {
    if (!quote.data) return null
    const start = Date.parse(quote.data.capturedAt), end = Date.parse(quote.data.validUntil)
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { span: end - start, elapsed: Date.now() - start } : null
  }, [quote.data])

  return <MaisonPage page="asset" topbar={topbar} cta>
    <ProductHero image={cover} imageKey={sharedKeys.asset(slug, 'image')} titleKey={sharedKeys.asset(slug, 'title')}
      kicker={<>{klass} · {d.investable}</>} title={content(product.displayName)} titleText={product.displayName}
      lede={product.summary ? content(product.summary) : undefined}>
      {product.state==='published' && <PublicShareButton key={product.id} kind="product" resourceId={product.id} />}
    </ProductHero>

    <DetailFlow>
    <Lacquer aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <span className={s.kicker}>{d.unitPrice}</span>
        {quote.data && <span className={s.badge} data-tone={expired ? 'warn' : 'live'}>{expired ? d.stale : d.live}</span>}
      </div>
      {!quote.data && !quote.error ? <p className={`${s.bigFigure} ${s.muted}`}>—</p>
        : quote.error && !quote.data ? <><p className={`${s.bigFigure} ${s.muted}`}>—</p><p className={s.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>{d.quoteUnavailable} · <button type="button" className={s.link} onClick={quote.refetch}>{copy.common.retry}</button></p></>
        : quote.data && <>
          <p className={`${s.bigFigure} ${s.num}`}><Figure value={unitPrice} locale="en-US" format={{ minimumFractionDigits: 2, maximumFractionDigits: unitDigits }} /><small>{quote.data.currency}</small></p>
          {validity && !expired && <div style={{ marginTop: 12 }}><PollBar every={validity.span} elapsed={validity.elapsed} stamp={quote.data.capturedAt} label={fill(d.validUntil, { t: fmtDateTime(quote.data.validUntil, locale) })} /></div>}
          <p className={s.muted} style={{ margin: '12px 0 0', fontSize: 12 }}>{copy.common.source}: {quote.data.source} · {fill(copy.common.updated, { t: fmtDateTime(quote.data.capturedAt, locale) })}</p>
          <p className={s.muted} style={{ margin: '4px 0 0', fontSize: 12 }}>{fill(d.validUntil, { t: fmtDateTime(quote.data.validUntil, locale) })}</p>
        </>}
      <StatStrip items={keyStats} />
    </Lacquer>

    <div style={{ marginTop: 24 }}>
      <Segmented value={String(tab)} onChange={(value) => setTab(Number(value))} label={content(product.displayName)} options={d.tabs.map((label, index) => ({ value: String(index), label }))} />
    </div>
    {tab === 0 && <div className={s.tabPanel} role="tabpanel">
      <StatStrip items={[
        { label: d.assetClass, value: klass },
        { label: d.settlement, value: product.assetCode },
        { label: d.network, value: network },
        { label: d.version, value: `v${product.version}` },
      ]} />
      <SectionHead title={d.orderRules} />
      <p className={s.prose}>{d.orderRulesBody}</p>
      <button type="button" className={s.link} style={{ marginTop: 12 }} onClick={() => openPath('/fees-and-limits')}>{copy.review.fees}<ArrowRight size={13} /></button>
    </div>}
    {tab === 1 && <div className={s.tabPanel} role="tabpanel">
      {quote.data ? <dl className={s.summary}>
        <div><dt>{d.unitPrice}</dt><dd className={s.num}>{fmtAtomic(quote.data.unitPriceAtomicAmount, quote.data.unitPriceDecimals, quote.data.currency, unitDigits)}</dd></div>
        <div><dt>{copy.common.source}</dt><dd>{quote.data.source}</dd></div>
        <div><dt>{fill(copy.common.updated, { t: '' }).trim()}</dt><dd>{fmtDateTime(quote.data.capturedAt, locale)}</dd></div>
        <div><dt>{fill(d.validUntil, { t: '' }).trim()}</dt><dd>{fmtDateTime(quote.data.validUntil, locale)}</dd></div>
      </dl> : <StateBlock tone={quote.error ? 'error' : 'unavailable'} title={d.quoteUnavailable} retry={quote.refetch} retryLabel={copy.common.retry} />}
      <StateBlock tone="unavailable" title={d.history} body={d.noHistory} />
    </div>}
    {tab === 2 && <div className={s.tabPanel} role="tabpanel">
      {!disclosures.data && !disclosures.error ? <Skeleton rows={2} />
        : disclosures.error && !disclosures.data ? <StateBlock tone="error" title={copy.common.errorGeneric} body={disclosures.error.message} retry={disclosures.refetch} retryLabel={copy.common.retry} />
        : disclosures.data?.length ? <ul className={s.list}>{disclosures.data.map((item, index) => {
          const doc = item as { id?: string; title?: string; kind?: string; url?: string; publishedAt?: string }
          return <li key={doc.id ?? index}><a className={s.row} href={doc.url ? apiUrl(doc.url) : undefined} target="_blank" rel="noopener noreferrer"><Logo name={doc.kind ?? 'D'} /><span className={s.rowMain}><b>{doc.title ?? doc.kind ?? '—'}</b><small>{fmtDateTime(doc.publishedAt, locale)}</small></span><ExternalLink size={15} /></a></li>
        })}</ul>
        : <StateBlock title={d.tabs[2]} body={d.noDisclosures} />}
    </div>}
    </DetailFlow>

    {/* No hint line here: it sat in the bar's transparent fade over the content scrolling beneath, and the same
        eligibility sentence already closes "Order rules" (the review screen repeats it before confirming). */}
    <div className={s.stickyCta}>
      <button type="button" className={s.cta} onClick={invest}>
        <span>{d.invest} · <span className={s.num}>{fill(copy.markets.from, { v: fmtUsdt(product.minOrderAtomicAmount) })}</span></span>
        <span className={s.ctaIcon}><ArrowRight size={17} /></span>
      </button>
    </div>
  </MaisonPage>
}

function ResearchDetail({ slug }: { slug: string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const d = copy.detail
  const detail = useQuery(`markets:rwa-detail:${slug}`, () => getRwaDetail(slug), { staleTime: 120_000 })
  const history = useQuery(`markets:rwa-history:${slug}`, () => getRwaHistory(slug, 90), { staleTime: 300_000 })
  const pro = proCopy[locale]
  const asset = detail.data
  const content=useContentTranslation(asset?[asset.name,asset.description??'']:[])
  const topbar = <RwaTopbar screen="rwa-detail" {...(asset ? heroTopbar : {})} title={asset?.name ?? ''} onBack={() => backOr('/markets')} />
  if (!asset && !detail.error) return <MaisonPage page="asset" topbar={topbar}><div className={s.hero}><Skeleton rows={4} /></div></MaisonPage>
  if (!asset) return <MaisonPage page="asset" topbar={topbar}><div className={s.hero}>
    {detail.error?.status === 404 ? <StateBlock title={d.notFound} body={d.notFoundBody} action={<button type="button" className={s.link} onClick={() => openPath('/markets')}>{copy.status.backMarkets}</button>} />
      : <StateBlock tone="error" title={copy.common.errorGeneric} body={detail.error?.message} retry={detail.refetch} retryLabel={copy.common.retry} />}
  </div></MaisonPage>

  // Only published points are drawn; nulls are gaps in the source, not zeros.
  const real = (history.data?.points ?? []).filter((point) => point.marketCapUsd !== null && Number.isFinite(Number(point.marketCapUsd)) && Number.isFinite(Date.parse(point.date)))
  const points = real.map((point) => ({ time: Date.parse(point.date) / 1000, value: Number(point.marketCapUsd) }))
  const symbol = asset.symbol && asset.symbol !== '-' ? asset.symbol : null
  const score = asset.score && typeof asset.score === 'object' ? asset.score.overallScore : null
  // Same picture Home's featured rail shows for this asset when it has a curated one, so that thumbnail can fly here.
  const cover = featuredCover(slug) ?? classCover(asset.assetClass, asset.name)
  const moves = [
    { label: d.change24h, value: <Delta value={asset.change24hPct} /> },
    { label: d.change7d, value: <Delta value={asset.change7dPct} /> },
    { label: d.change30d, value: <Delta value={asset.change30dPct} /> },
    { label: d.volume, value: fmtUsd(asset.volume24hUsd, { compact: true, locale }) },
  ]

  return <MaisonPage page="asset" topbar={topbar}>
    <ProductHero image={cover} imageKey={featuredCover(slug) ? sharedKeys.asset(slug, 'image') : undefined} titleKey={sharedKeys.asset(slug, 'title')}
      logo={<Logo src={asset.logoUrl} name={content(asset.name)} />} kicker={[symbol, asset.assetClass.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
      title={content(asset.name)} titleText={asset.name}
      badges={<>
        <span className={s.badge} data-tone="accent">{d.research}</span>
        {asset.issuer && <button type="button" className={s.link} onClick={() => openPath(`/issuers/${encodeURIComponent(asset.issuer.slug)}`)}>{d.issuer}: {asset.issuer.name}</button>}
      </>} />

    <DetailFlow>
    <Lacquer>
      <span className={s.kicker}>{d.marketCap}</span>
      <p className={`${s.bigFigure} ${s.num}`}>{asset.marketCapUsd != null && Number.isFinite(Number(asset.marketCapUsd))
        ? fmtUsdCompact(asset.marketCapUsd, { locale })
        : '—'}</p>
      <StatStrip items={moves} />
    </Lacquer>

    <SectionHead index="01" title={d.history} />
    {!history.data && !history.error ? <Skeleton rows={1} />
      : history.error && !history.data ? <StateBlock tone="error" title={copy.common.errorGeneric} retry={history.refetch} retryLabel={copy.common.retry} />
      : points.length >= 2 ? <><PriceChart points={points} digits={0} locale={locale} label={d.history} unit="USD" height={200} /><p className={s.foot}><span>{fill(pro.count, { n: points.length })}</span><span>{fmtDateTime(real[0]?.date, locale, { month: 'short', day: 'numeric' })} – {fmtDateTime(real[real.length - 1]?.date, locale, { month: 'short', day: 'numeric' })}</span></p></>
      : <StateBlock tone="unavailable" title={copy.common.unavailable} body={d.noHistory} />}

    <SectionHead index="02" title={d.about} />
    <StatStrip items={[
      { label: d.score, value: score ?? '—' },
      { label: d.risk, value: asset.riskLevel ?? '—' },
      { label: d.region, value: asset.region ?? '—' },
      { label: d.issuer, value: asset.issuer?.name ?? '—' },
    ]} />
    {asset.description && <p className={s.prose} style={{ marginTop: 16 }}>{content(asset.description)}</p>}
    {asset.websiteUrl && <a className={s.link} style={{ marginTop: 8 }} href={asset.websiteUrl} target="_blank" rel="noopener noreferrer">{d.website}<ExternalLink size={13} /></a>}

    {asset.sources?.length > 0 && <>
      <SectionHead index="03" title={d.sources} />
      <ul className={s.list}>{asset.sources.map((source) => <li key={`${source.provider}:${source.externalId}`}>
        <a className={s.row} href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
          <ShieldCheck size={18} strokeWidth={1.6} className={s.muted} />
          <span className={s.rowMain}><b>{source.provider}</b><small>{fill(d.synced, { t: fmtDateTime(source.lastSyncedAt, locale) })}</small></span>
          <ExternalLink size={15} className={s.muted} />
        </a>
      </li>)}</ul>
    </>}

    <div className={s.notice}><Info size={16} /><span>{d.researchNote}</span></div>
    </DetailFlow>
    <div className={s.actions2} style={{ marginTop: 16 }}>
      <button type="button" className={s.ghost} onClick={() => openPath(`/compare?slugs=${encodeURIComponent(slug)}`)}>{copy.markets.compare}</button>
      <button type="button" className={s.ghost} onClick={() => openPath('/markets')}>{copy.status.backMarkets}</button>
    </div>
  </MaisonPage>
}
