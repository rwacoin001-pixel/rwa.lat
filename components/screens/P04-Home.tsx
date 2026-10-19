'use client'

import { useEffect, useState, type ReactNode, useRef } from 'react'
import { ArrowRight, ArrowUpRight, ChartNoAxesColumnIncreasing, CircleGauge, Coins, Eye, EyeOff, Landmark, Layers3, Search, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { useQuery } from '@/lib/api/_query'
import { getRankings, getRwaOverview } from '@/lib/api/rwa'
import { POLL, request } from '@/lib/api/_http'
import { fmtPct, fmtUsd } from '@/lib/money'
import { getWallet, toUnits as walletUnits, type WalletView } from '@/lib/wallet-data'
import { resolveHomeState, heroCta, homeBlocks } from '@/lib/home-lifecycle'
import { getSessionView, getKycStatus, type SessionView, type KycStatusView } from '@/lib/session-data'
import { routePath } from '@/lib/routes-v2'
import { getPositions } from '@/lib/portfolio-data'
import { isAuthenticated } from '@/lib/h5-data'
import { useUnread } from '@/hooks/useUnread'
import { useSignedIn } from '@/hooks/useAccount'
import { useScrollChrome } from '@/hooks/useScrollChrome'
import RwaTopbar from '@/components/rwa-topbar'
import { ErrorBlock } from '@/components/ui/ErrorBlock'
import {communityExperienceCopy} from '@/lib/community-experience-copy'
import { HomeSocialFeed } from '@/components/home/HomeSocialFeed'
import { HomeMarketLens } from '@/components/home/HomeMarketLens'
import { HomeTradingView } from '@/components/home/HomeTradingView'
import { HomePolymarket } from '@/components/home/HomePolymarket'
import { homeStateCopy } from '@/components/home/home-state-copy'
import AnimatedContent from '@/components/AnimatedContent'
import SpotlightCard from '@/components/SpotlightCard'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { homeDataCopy } from '@/lib/route-copy'
import styles from './P04-Home.module.css'

import { copyByLocale, ctaText, feedAll, utilityCopy } from './P04-Home-copy'
export { copyByLocale, ctaText, feedAll, utilityCopy }

type HomeAccountSnapshot = { totalAssets: number; available: number | null; holdings: number }
type FeaturedAsset = { slug: string; name: string; symbol?: string; logoUrl?: string; assetClass?: string; priceUsd?: string | null; marketCapUsd?: string | null; change24hPct?: string | null }
type PredictionItem = { id: string; question: string }

function walletTotal(wallet: WalletView) {
  const decimals = wallet.asset.decimals
  return [wallet.balances.availableAtomic, wallet.balances.lockedAtomic, wallet.balances.pendingAtomic, wallet.balances.investedAtomic, wallet.balances.rewardPayableAtomic]
    .reduce((total, atomic) => total + walletUnits(atomic, decimals), 0)
}

function assetKind(asset: { slug?: string; name?: string }, index = 0): 'treasury' | 'gold' | 'credit' | 'generic' {
  const label = `${asset.slug ?? ''} ${asset.name ?? ''}`.toLowerCase()
  if (label.includes('gold') || label.includes('metal')) return 'gold'
  if (label.includes('credit') || label.includes('bond')) return 'credit'
  if (label.includes('treasury') || label.includes('tbill') || label.includes('t-bill')) return 'treasury'
  return index % 2 ? 'gold' : 'generic'
}

function assetImage(asset: FeaturedAsset, index: number) {
  const kind = (asset.assetClass ?? '').toLowerCase()
  if (kind === 'treasury' || kind === 'bond') return index % 2 ? '/media/home/asset-treasury-paper.webp' : '/media/generated/design-v2/treasury-architecture-v1.png'
  if (kind === 'real_estate') return '/media/home/asset-real-estate.webp'
  if (kind === 'infrastructure') return '/media/home/asset-infrastructure.webp'
  return null
}

function AssetGlyph({ kind }: { kind: ReturnType<typeof assetKind> }) {
  const Icon: LucideIcon = kind === 'treasury' ? Landmark : kind === 'gold' ? Coins : kind === 'credit' ? CircleGauge : Layers3
  return <span className={styles.assetGlyph} aria-hidden="true"><Icon size={20} strokeWidth={1.6} /></span>
}

function Reveal({ children, reduced, className }: { children: ReactNode; reduced: boolean | null; className?: string }) {
  if (reduced) return <div className={className}>{children}</div>
  return <AnimatedContent className={className} distance={22} duration={1.05} ease="power3.out" threshold={0.08} animateOpacity>{children}</AnimatedContent>
}

function SectionHeading({ title, onMore, more }: { title: string; onMore?: () => void; more?: string }) {
  return <div className={styles.sectionHeading}><h2>{title}</h2>{onMore && <button type="button" onClick={onMore}>{more}<ArrowUpRight size={17} /></button>}</div>
}

export function HomeScreen({ go }: { go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const copy = copyByLocale[locale]
  const utility = utilityCopy[locale]
  const dataCopy = homeDataCopy[locale]
  const router = useRouter()
  const reduced = useReducedMotion()
  const signedIn = useSignedIn()
  const { unread } = useUnread(signedIn)
  const overview = useQuery('rwa:overview', getRwaOverview, { pollInterval: POLL.quote })
  const featured = useQuery('rwa:featured:8', () => request<{ items: FeaturedAsset[] }>('/v1/rwa/assets?featured=true&limit=8'), { staleTime: 60_000, pollInterval: POLL.list })
  const baskets = useQuery('basket:portfolios:home', () => request<unknown>('/v1/basket/portfolios'), { staleTime: 60_000, pollInterval: POLL.list })
  const predictions = useQuery('predict:active:3', () => request<PredictionItem[] | { items?: PredictionItem[] }>('/v1/polymarket/markets?state=active&limit=3'), { staleTime: 60_000, pollInterval: POLL.quote })
  const rankings = useQuery('rwa:rankings:market_cap:3', () => getRankings('market_cap', 3), { pollInterval: POLL.list })
  const [account, setAccount] = useState<HomeAccountSnapshot | null>(null)
  const [hideBalance, setHideBalance] = useState(false)
  const [sessionProbe, setSessionProbe] = useState<{ status: 'loading' | 'guest' | 'ok' | 'error'; view: SessionView | null }>({ status: 'loading', view: null })
  const [kycView, setKycView] = useState<KycStatusView | null>(null)
  const [walletSnapshot, setWalletSnapshot] = useState<{ available: number; locked: number; pending: number; invested: number } | null>(null)
  const [positionsCount, setPositionsCount] = useState<number | null>(null)
  const topbarHidden = useScrollChrome()

  useEffect(() => {
    let cancelled = false
    if (!isAuthenticated()) {
      setSessionProbe({ status: 'guest', view: null })
      return
    }
    Promise.allSettled([getWallet(), getPositions(), getSessionView(), getKycStatus()]).then(([walletResult, positionsResult, sessionResult, kycResult]) => {
      if (cancelled) return
      const wallet = walletResult.status === 'fulfilled' ? walletResult.value : null
      const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : []
      if (wallet || positionsResult.status === 'fulfilled') {
        setAccount({
          totalAssets: wallet ? walletTotal(wallet) : positions.reduce((sum, position) => sum + position.marketValue, 0),
          available: wallet ? walletUnits(wallet.balances.availableAtomic, wallet.asset.decimals) : null,
          holdings: positions.length,
        })
      }
      if (wallet) setWalletSnapshot({
        available: walletUnits(wallet.balances.availableAtomic, wallet.asset.decimals),
        locked: walletUnits(wallet.balances.lockedAtomic, wallet.asset.decimals),
        pending: walletUnits(wallet.balances.pendingAtomic, wallet.asset.decimals),
        invested: walletUnits(wallet.balances.investedAtomic, wallet.asset.decimals),
      })
      if (positionsResult.status === 'fulfilled') setPositionsCount(positions.length)
      setSessionProbe(sessionResult.status === 'fulfilled' ? { status: 'ok', view: sessionResult.value } : { status: 'error', view: null })
      setKycView(kycResult.status === 'fulfilled' ? (kycResult.value ?? null) : null)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (sessionProbe.status !== 'error') return
    let cancelled = false
    let inFlight = false
    const retry = () => {
      if (inFlight) return
      inFlight = true
      void getSessionView().then((view) => {
        if (!cancelled) setSessionProbe({ status: 'ok', view })
      }).catch(() => undefined).finally(() => { inFlight = false })
    }
    const timer = window.setInterval(retry, 5000)
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('online', retry); window.removeEventListener('focus', retry) }
  }, [sessionProbe.status])

  const state = resolveHomeState({
    sessionLoaded: sessionProbe.status !== 'loading',
    sessionFailed: sessionProbe.status === 'error',
    session: sessionProbe.status === 'ok' && sessionProbe.view ? { emailVerified: sessionProbe.view.emailVerified } : null,
    wallet: walletSnapshot,
    kyc: kycView ? { state: kycView.state } : null,
    positionsCount,
  })
  // Keep the scene anchored while the opaque content gradually covers it.
  const heroBgRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = heroBgRef.current
        if (el) el.style.transform = `translate3d(0,${(-Math.min(window.scrollY, 900) * .08).toFixed(1)}px,0)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])
  const mainCta = heroCta(state)
  const ctaLabel = mainCta ? ctaText[locale][mainCta.kind] : null
  const openMainCta = () => {
    if (!mainCta) return
    const path = routePath(mainCta.routeKey as never)
    router.push(mainCta.query ? `${path}?${mainCta.query}` : path)
  }

  const overviewData = overview.data ?? {}
  const marketCap = overviewData.totalMarketCapUsd == null ? '—' : fmtUsd(String(overviewData.totalMarketCapUsd), { compact: true, locale })
  const volume24h = overviewData.totalVolume24hUsd == null ? '—' : fmtUsd(String(overviewData.totalVolume24hUsd), { compact: true, locale })
  const asOf = typeof overviewData.latestDataTimestamp === 'string' && !Number.isNaN(Date.parse(overviewData.latestDataTimestamp))
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(overviewData.latestDataTimestamp))
    : '—'
  const basketData = baskets.data
  const basketItems = Array.isArray(basketData) ? basketData : basketData && typeof basketData === 'object' ? ((basketData as Record<string, unknown>).items ?? (basketData as Record<string, unknown>).portfolios) : null
  const firstBasket = Array.isArray(basketItems) && basketItems.length ? basketItems[0] as Record<string, unknown> : null
  const basketName = firstBasket && typeof firstBasket.name === 'string' ? firstBasket.name : firstBasket && typeof firstBasket.displayName === 'string' ? firstBasket.displayName : copy.baskets
  const featuredItems = featured.data?.items?.slice(0, 5) ?? []
  const predictionData = predictions.data
  const predictionItems = Array.isArray(predictionData) ? predictionData : predictionData?.items ?? []
  const blocks = homeBlocks(state)
  const stateLabels = homeStateCopy[locale]
  const statusLabel = state.variant ? stateLabels.variant[state.variant] : state.degraded ? stateLabels.degraded : stateLabels.lifecycle[state.lifecycle]
  const portfolioAccount = state.lifecycle === 'funded' || state.lifecycle === 'invested' ? account : null

  return <section className={`screen s2-home ${styles.root}`} data-home-s2="true" data-home-design="s3-premium" data-home-lifecycle={state.lifecycle} data-home-variant={state.variant ?? 'none'} data-topbar-hidden={topbarHidden}>
    <div className={styles.heroBg} ref={heroBgRef} aria-hidden="true" />
    <RwaTopbar screen="home" surface="transparent-over-media" badge={{ slot: 'R1', count: unread }} />
    <div className={styles.hero}>
      <div className={styles.heroMeta}><span>A-REIT / 01</span></div>
      <div className={styles.heroCopy}>
        <span className={styles.heroKicker}>{copy.kicker}</span>
        <h1 className={styles.heroTitle}>{copy.headline}<br />{copy.perspective}</h1>
        <span className={styles.heroSub}>{copy.sub}</span>
      </div>
    </div>

    <div className={styles.content}>
      {blocks.includes('portfolioSummary') && <SpotlightCard className={styles.portfolioFloat} spotlightColor="rgba(255, 255, 255, 0.17)" data-lifecycle={state.lifecycle}>
        <div className={styles.accountTop}><span>{copy.portfolio}</span>{portfolioAccount && <button type="button" onClick={() => setHideBalance(value => !value)} aria-label={hideBalance ? utility.showBalance : utility.hideBalance}>{hideBalance ? <EyeOff size={17} /> : <Eye size={17} />}</button>}</div>
        <strong className={`${styles.portfolioStatus} ${portfolioAccount ? styles.portfolioStatusWithValue : ''}`} aria-live="polite">{statusLabel}</strong>
        {portfolioAccount && <>
          <strong className={styles.portfolioValue} dir="ltr">{hideBalance ? '••••••' : fmtUsd(String(portfolioAccount.totalAssets), { locale })}</strong>
          <div className={`${styles.portfolioFoot} ${state.lifecycle === 'funded' ? styles.portfolioFootTwo : ''}`}><span><b>{portfolioAccount.holdings}</b><small>{copy.holdings}</small></span><span><b>{portfolioAccount.available == null ? '—' : hideBalance ? '••' : fmtUsd(String(portfolioAccount.available), { compact: true, locale })}</b><small>{copy.available}</small></span>{state.lifecycle === 'invested' && <button type="button" onClick={() => go('portfolio')} aria-label={copy.portfolio}><ArrowUpRight size={19} /></button>}</div>
        </>}
        {mainCta && ctaLabel && <motion.button type="button" className={styles.portfolioCta} onClick={openMainCta} whileTap={reduced ? undefined : { scale: .96 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}>{ctaLabel}<ArrowUpRight size={17} /></motion.button>}
      </SpotlightCard>}
      <section className={styles.pulseSection} aria-label={copy.pulse}>
        <SpotlightCard className={styles.pulseCard} spotlightColor="rgba(255, 255, 255, 0.14)">
          <div className={styles.pulseTop}><span className={styles.eyebrow}>{copy.pulse}</span><span className={styles.liveDot} aria-hidden="true" /></div>
          <p className={styles.metricLabel}>{copy.tracked}</p>
          <strong className={styles.pulseValue} data-testid="home-total" dir="ltr">{marketCap}</strong>
          {overview.error && <ErrorBlock message={overview.error.message} retry={overview.refetch} />}
          <div className={styles.pulseStats}>
            <span><b dir="ltr">{volume24h}</b><small>{copy.volume}</small></span>
            <span><b dir="ltr">{overviewData.assetCount ?? '—'}</b><small>{copy.assets}</small></span>
            <span><b dir="ltr">{overviewData.issuerCount ?? '—'}</b><small>{copy.issuers}</small></span>
          </div>
          <div className={styles.asOf}>{copy.updated} <time>{asOf}</time></div>
        </SpotlightCard>
        <div className={styles.rankingWrap}>
          {rankings.loading ? <div className={styles.skeleton} /> : rankings.error ? <ErrorBlock message={rankings.error.message} retry={rankings.refetch} /> : rankings.data?.items?.map((asset, index) => (
            <button type="button" key={asset.slug} className={styles.rankingRow} onClick={() => router.push(`/asset/${encodeURIComponent(asset.slug)}`)}>
              <span className={styles.rankIndex}>0{index + 1}</span><span className={styles.rankName}><b>{asset.name}</b><small>{asset.symbol || '—'}</small></span>
              <span className={styles.rankValue}><b dir="ltr">{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</b><small dir="ltr" className={asset.change24hPct?.startsWith('-') ? styles.down : styles.up}>{fmtPct(asset.change24hPct, { signed: true })}</small></span>
            </button>
          ))}
        </div>
      </section>

      <Reveal reduced={reduced} className={styles.section}><SectionHeading title={copy.forYou} />
        <motion.button type="button" className={styles.basketCard} onClick={() => go('basket-list')} whileTap={reduced ? undefined : { scale: .975, rotate: -.3 }} whileHover={reduced ? undefined : { y: -4 }} transition={{ type: 'spring', stiffness: 360, damping: 24 }}>
          <span className={styles.eyebrow}>{copy.headline}</span><strong>{basketName}</strong><small>{firstBasket && typeof firstBasket.summary === 'string' ? firstBasket.summary : copy.basketEmpty}</small><span className={styles.basketArrow}><ArrowUpRight size={19} /></span>
        </motion.button>
      </Reveal>

      <Reveal reduced={reduced} className={styles.section}><SectionHeading title={copy.featured} onMore={() => go('invest')} more={copy.all} />
        {featured.loading ? <div className={styles.skeleton} /> : featured.error ? <ErrorBlock message={featured.error.message} retry={featured.refetch} /> : featuredItems.length ? <div className={styles.featuredGrid}>
          {featuredItems.map((asset, index) => <motion.button type="button" key={asset.slug} className={styles.assetCard} onClick={() => router.push(`/asset/${encodeURIComponent(asset.slug)}`)} whileTap={reduced ? undefined : { scale: .965, rotate: index % 2 ? .5 : -.5 }} whileHover={reduced ? undefined : { y: -5 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
            <span className={styles.assetPhoto} style={assetImage(asset, index) ? { backgroundImage: `url('${assetImage(asset, index)}')`, backgroundPosition: index % 2 ? '72% center' : '32% center' } : undefined} />
            <span className={styles.assetTop}><AssetGlyph kind={assetKind(asset, index)} /><ArrowUpRight size={16} /></span>
            <span className={styles.assetInfo}><small>{asset.assetClass?.replace(/_/g, ' ') || copy.headline}</small><b>{asset.name}</b><span><em>{copy.marketCap}</em><strong>{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</strong></span><span><em>{copy.change24h}</em><strong className={asset.change24hPct?.startsWith('-') ? styles.down : styles.up}>{fmtPct(asset.change24hPct, { signed: true })}</strong></span></span>
          </motion.button>)}
        </div> : <p className={styles.empty}>{dataCopy.priceUnavailable}</p>}
      </Reveal>

      <Reveal reduced={reduced} className={styles.section}><HomeMarketLens /></Reveal>

      <Reveal reduced={reduced} className={styles.section}><HomeTradingView /></Reveal>

      <Reveal reduced={reduced} className={styles.section}><HomePolymarket />
        {predictionItems.length > 0 && <motion.button type="button" className={styles.predictionCard} onClick={() => router.push(`/prediction/${encodeURIComponent(predictionItems[0].id)}`)} whileTap={reduced ? undefined : { scale: .975 }}><span className={styles.predictionIcon}><ChartNoAxesColumnIncreasing size={21} strokeWidth={1.5} /></span><span className={styles.predictionCopy}><small>{utility.marketSignal}</small><b>{predictionItems[0].question}</b></span><ArrowUpRight size={18} /></motion.button>}
      </Reveal>

      {blocks.includes('yield') && <Reveal reduced={reduced} className={styles.section}><SectionHeading title={copy.yield} />
        <div className={styles.placeholder}><span className={styles.placeholderIcon}><Sparkles size={20} strokeWidth={1.4} /></span><p>{copy.yieldBody}</p></div>
      </Reveal>}

      <section className={`${styles.section} ${styles.communitySection}`}><SectionHeading title={copy.community} onMore={() => go('community')} more={communityExperienceCopy[locale].enter} />
        <HomeSocialFeed onOpen={post => router.push(`/community/post/${encodeURIComponent(post.id)}`)} labels={{ all: feedAll[locale], loading: utility.loading, retry: utility.retry, end: utility.end, emptyTitle: copy.communityEmpty, emptyBody: copy.communityBody }} />
      </section>

      <section className={styles.section}><SectionHeading title={copy.trust} />
        <div className={styles.placeholder}><span className={styles.placeholderIcon}><ShieldCheck size={20} strokeWidth={1.4} /></span><p>{copy.trustBody}</p></div>
      </section>
    </div>
  </section>
}
