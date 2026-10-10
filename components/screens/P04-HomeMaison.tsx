'use client'

/**
 * Home · "Maison" — editorial private-bank layout on the shared day/night hero.
 *
 * Kept from S2/S3 (other code depends on them):
 *   · root carries `s2-home` + data-home-s2 → globals.css sticky topbar rules
 *   · data-topbar-hidden (scroll down hides topbar) → globals.css + --feed-sticky-top
 *   · the BottomDock compaction lives in the shell and needs nothing from here
 *   · HomeSocialFeed owns the sticky community tabs
 *
 * Backend (verified 2026-09-24): /v1/rwa/overview, /v1/rwa/assets?featured=true,
 * /v1/basket/portfolios (bare array, strategyName), /v1/market-context,
 * /v1/polymarket/public-preview, /v1/community/*. Account calls only when signed in.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Gift, ShieldCheck, Smartphone, X } from 'lucide-react'
import { Instrument_Serif } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import type { RwaScreen } from '@/lib/rwa-routes'
import { useQuery } from '@/lib/api/_query'
import { getRwaOverview } from '@/lib/api/rwa'
import { getMarketContextView } from '@/lib/api/market-context'
import { POLL, request, getSessionToken, SESSION_CHANGED } from '@/lib/api/_http'
import { fmtUsd, fromAtomic } from '@/lib/money'
import { getWallet, toUnits as walletUnits, type WalletView } from '@/lib/wallet-data'
import { resolveHomeState, heroCta } from '@/lib/home-lifecycle'
import { getSessionView, getKycStatus, type SessionView, type KycStatusView } from '@/lib/session-data'
import { routePath } from '@/lib/routes-v2'
import { getPositions, sumPositionMarketValueAtomic } from '@/lib/portfolio-data'
import { isAuthenticated } from '@/lib/h5-data'
import { listRewards, type Reward } from '@/lib/api/account'
import { openPath } from '@/lib/maison-nav'
import type { MarketQuote } from '@/lib/p0a-data'
import RwaTopbar from '@/components/rwa-topbar'
import { ErrorBlock } from '@/components/ui/ErrorBlock'
import { HomeSocialFeed } from '@/components/home/HomeSocialFeed'
import { HomeMarkets } from '@/components/home/HomeMarkets'
import { HomeForYou } from '@/components/home/HomeForYou'
import { HomeSectionHeading as SectionHead } from '@/components/home/HomeSectionHeading'
import { HomePolymarket } from '@/components/home/HomePolymarket'
import { homeStateCopy } from '@/components/home/home-state-copy'
import { CountUp, EASE, MaskLines, Rise } from '@/components/home/maison-motion'
import { HomePortfolioCard, type HomePortfolioSnapshot } from '@/components/home/HomePortfolioCard'
import { focusHomeEmailBinding } from '@/components/home/HomeEmailBinding'
import { InstallSheet, installCopy, useHomeInstall } from '@/components/home/HomeInstall'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { homeDataCopy } from '@/lib/route-copy'
import { copyByLocale, ctaText, feedAll, utilityCopy } from './P04-Home'
import styles from './P04-HomeMaison.module.css'
import { PullToRefresh } from '../maison/PullToRefresh'
import { homeAssetImage, HOME_ASSET_FALLBACK } from '@/lib/home-asset-media'

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--home-display-latin', display: 'swap' })

type MaisonCopy = { allocation: string; other: string; trust: string; rank: string; strategy: string; invite: string; inviteBody: string; inviteEarned: string; inviteDismiss: string; inviteOpen: string }
const maisonCopy: Record<AppLocale, MaisonCopy> = {
  en: { allocation: 'Allocation by asset class', other: 'Other', trust: 'Custody · Disclosures · Security', rank: 'No.', strategy: 'Strategy', invite: 'Invite friends, earn rewards together', inviteBody: 'One-time invite links · rewards as recorded', inviteEarned: '{v} earned', inviteDismiss: 'Hide invite for 30 days', inviteOpen: 'Invite & rewards' },
  'zh-CN': { allocation: '资产类别分布', other: '其他', trust: '托管 · 披露 · 安全', rank: 'No.', strategy: '策略', invite: '邀请好友，一起赚奖励', inviteBody: '一次性邀请链接 · 奖励以入账为准', inviteEarned: '已获 {v}', inviteDismiss: '30 天内不再显示', inviteOpen: '邀请与奖励' },
  hi: { allocation: 'परिसंपत्ति वर्ग अनुसार', other: 'अन्य', trust: 'कस्टडी · खुलासे · सुरक्षा', rank: 'No.', strategy: 'रणनीति', invite: 'दोस्तों को आमंत्रित करें, साथ में इनाम पाएँ', inviteBody: 'एक-बार के आमंत्रण लिंक · इनाम दर्ज होने पर', inviteEarned: '{v} अर्जित', inviteDismiss: '30 दिन तक छिपाएँ', inviteOpen: 'आमंत्रण और इनाम' },
  es: { allocation: 'Distribución por clase', other: 'Otros', trust: 'Custodia · Información · Seguridad', rank: 'N.º', strategy: 'Estrategia', invite: 'Invita a amigos y ganad recompensas', inviteBody: 'Enlaces de un solo uso · recompensas según registro', inviteEarned: '{v} ganados', inviteDismiss: 'Ocultar 30 días', inviteOpen: 'Invitaciones y recompensas' },
  ar: { allocation: 'التوزيع حسب فئة الأصل', other: 'أخرى', trust: 'الحفظ · الإفصاح · الأمان', rank: 'رقم', strategy: 'الاستراتيجية', invite: 'ادعُ أصدقاءك واربحوا المكافآت معًا', inviteBody: 'روابط دعوة لمرة واحدة · المكافآت كما تُسجَّل', inviteEarned: 'مكتسب {v}', inviteDismiss: 'إخفاء لمدة 30 يومًا', inviteOpen: 'الدعوات والمكافآت' },
  fr: { allocation: 'Répartition par classe', other: 'Autres', trust: 'Conservation · Transparence · Sécurité', rank: 'N°', strategy: 'Stratégie', invite: 'Invitez vos amis, gagnez des récompenses ensemble', inviteBody: 'Liens à usage unique · récompenses selon enregistrement', inviteEarned: '{v} gagnés', inviteDismiss: 'Masquer 30 jours', inviteOpen: 'Invitations et récompenses' },
  pt: { allocation: 'Distribuição por classe', other: 'Outros', trust: 'Custódia · Divulgação · Segurança', rank: 'N.º', strategy: 'Estratégia', invite: 'Convide amigos e ganhem recompensas juntos', inviteBody: 'Links de uso único · recompensas conforme lançamento', inviteEarned: '{v} ganhos', inviteDismiss: 'Ocultar por 30 dias', inviteOpen: 'Convites e recompensas' },
}

const classLabels: Record<AppLocale, Record<string, string>> = {
  en: { treasury: 'Treasuries', stable_value: 'Stable value', private_credit: 'Private credit', real_estate: 'Real estate', fund: 'Funds', bond: 'Bonds', equity: 'Equity', commodity: 'Commodities', infrastructure: 'Infrastructure' },
  'zh-CN': { treasury: '国债', stable_value: '稳定价值', private_credit: '私人信贷', real_estate: '房地产', fund: '基金', bond: '债券', equity: '股权', commodity: '大宗商品', infrastructure: '基础设施' },
  hi: { treasury: 'ट्रेज़री', stable_value: 'स्थिर मूल्य', private_credit: 'निजी ऋण', real_estate: 'रियल एस्टेट', fund: 'फंड', bond: 'बॉन्ड', equity: 'इक्विटी', commodity: 'कमोडिटी', infrastructure: 'अवसंरचना' },
  es: { treasury: 'Tesoro', stable_value: 'Valor estable', private_credit: 'Crédito privado', real_estate: 'Inmuebles', fund: 'Fondos', bond: 'Bonos', equity: 'Acciones', commodity: 'Materias primas', infrastructure: 'Infraestructura' },
  ar: { treasury: 'سندات الخزانة', stable_value: 'قيمة مستقرة', private_credit: 'ائتمان خاص', real_estate: 'عقارات', fund: 'صناديق', bond: 'سندات', equity: 'أسهم', commodity: 'سلع', infrastructure: 'بنية تحتية' },
  fr: { treasury: 'Trésor', stable_value: 'Valeur stable', private_credit: 'Crédit privé', real_estate: 'Immobilier', fund: 'Fonds', bond: 'Obligations', equity: 'Actions', commodity: 'Matières premières', infrastructure: 'Infrastructure' },
  pt: { treasury: 'Tesouro', stable_value: 'Valor estável', private_credit: 'Crédito privado', real_estate: 'Imóveis', fund: 'Fundos', bond: 'Títulos', equity: 'Ações', commodity: 'Commodities', infrastructure: 'Infraestrutura' },
}

const lowerCopy: Record<AppLocale, { assets: string; community: string }> = {
  en: { assets: 'All assets', community: 'Enter community' },
  'zh-CN': { assets: '全部资产', community: '进入社区' },
  hi: { assets: 'सभी परिसंपत्तियाँ', community: 'समुदाय में जाएँ' },
  es: { assets: 'Todos los activos', community: 'Ir a comunidad' },
  ar: { assets: 'جميع الأصول', community: 'دخول المجتمع' },
  fr: { assets: 'Tous les actifs', community: 'Voir la communauté' },
  pt: { assets: 'Todos os ativos', community: 'Entrar na comunidade' },
}

const tickerSymbols: Record<string, string> = { '^TNX': 'US10Y', 'DX-Y.NYB': 'DXY', 'GC=F': 'GOLD', '^GSPC': 'S&P 500', BTC: 'BTC', ETH: 'ETH' }

type FeaturedAsset = { slug: string; name: string; symbol?: string; assetClass?: string; marketCapUsd?: string | null; change24hPct?: string | null; change7dPct?: string | null; rank?: number | null; issuer?: { name: string } | null }
type Distribution = { assetClass: string; assetCount: number; totalMarketCapUsd: string }

function classLabel(assetClass: string, locale: AppLocale) {
  return classLabels[locale][assetClass] ?? assetClass.replace(/_/g, ' ')
}

function toNumber(input: unknown) {
  if (input === null || input === undefined || input === '') return null
  const value = Number(input)
  return Number.isFinite(value) ? value : null
}

function walletTotalAtomic(wallet: WalletView) {
  if ((wallet.asset.code !== 'USD' && wallet.asset.code !== 'USDT') || !Number.isInteger(wallet.asset.decimals) || wallet.asset.decimals < 0 || wallet.asset.decimals > 78) return null
  const amounts = [wallet.balances.availableAtomic, wallet.balances.lockedAtomic, wallet.balances.pendingAtomic, wallet.balances.investedAtomic, wallet.balances.rewardPayableAtomic]
  let total = BigInt(0)
  for (const amount of amounts) {
    if (!/^\d+$/.test(amount)) return null
    try { total += BigInt(amount) } catch { return null }
  }
  return total.toString()
}

function FeaturedAssetPhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  // Decorative imagery: the adjacent name already identifies the asset.
  return <img className={styles.assetPhoto} src={failed ? HOME_ASSET_FALLBACK : src} alt="" width={44} height={44} loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

function changeTone(value: string | null | undefined) {
  const number = toNumber(value)
  return number === null || Math.abs(number) < .005 ? styles.flat : number < 0 ? styles.down : styles.up
}

function Ticker({ quotes, locale }: { quotes: MarketQuote[]; locale: AppLocale }) {
  if (!quotes.length) return <div className={styles.ticker} aria-hidden="true" />
  const items = quotes.map(quote => {
    const value = quote.value === null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: quote.unit === 'yield%' ? 3 : 2 }).format(quote.value) + (quote.unit === 'yield%' ? '%' : '')
    const change = quote.changePct === null ? '' : `${quote.changePct > 0 ? '+' : ''}${quote.changePct.toFixed(2)}%`
    const tone = quote.changePct === null || quote.changePct === 0 ? styles.flat : quote.changePct < 0 ? styles.down : styles.up
    return { key: quote.symbol, name: tickerSymbols[quote.symbol] ?? quote.symbol, value, change, tone }
  })
  // Two identical runs let the CSS loop at -50% without a visible seam.
  return <div className={styles.ticker} role="marquee" aria-label="Market ticker">
    <div className={styles.tickerTrack}>
      {[0, 1].map(run => <div className={styles.tickerRun} key={run} aria-hidden={run === 1}>
        {items.map(item => <span className={styles.tickerItem} key={`${run}-${item.key}`}><b>{item.name}</b><span dir="ltr">{item.value}</span><em className={item.tone} dir="ltr">{item.change}</em></span>)}
      </div>)}
    </div>
  </div>
}

function AllocationBar({ items, total, locale, otherLabel }: { items: Distribution[]; total: number; locale: AppLocale; otherLabel: string }) {
  const reduced = useReducedMotion()
  const sorted = [...items].sort((a, b) => Number(b.totalMarketCapUsd) - Number(a.totalMarketCapUsd))
  const head = sorted.slice(0, 4)
  const tail = sorted.slice(4).reduce((sum, item) => sum + Number(item.totalMarketCapUsd), 0)
  const segments = [...head.map(item => ({ key: item.assetClass, label: classLabel(item.assetClass, locale), value: Number(item.totalMarketCapUsd) })), ...(tail > 0 ? [{ key: 'other', label: otherLabel, value: tail }] : [])]
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
  return <div className={styles.allocation}>
    <div className={styles.allocationBar} aria-hidden="true">
      {segments.map((segment, index) => <motion.span key={segment.key} data-seg={index} style={{ flexGrow: segment.value }} initial={reduced ? false : { scaleX: 0, opacity: 0 }} whileInView={{ scaleX: 1, opacity: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 1, ease: EASE, delay: 0.15 + index * 0.08 }} />)}
    </div>
    <ul className={styles.allocationLegend}>
      {segments.map((segment, index) => <li key={segment.key}><i data-seg={index} aria-hidden="true" /><span>{segment.label}</span><b dir="ltr">{pct.format(segment.value / total)}</b></li>)}
    </ul>
  </div>
}

const INVITE_DISMISS_KEY = 'rwa.home.invite-dismissed-at'
const INVITE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

function inviteSnoozed() {
  try {
    const at = Number(window.localStorage.getItem(INVITE_DISMISS_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < INVITE_SNOOZE_MS
  } catch { return false }
}

/** Sum of earned/redeemed rewards, only when every counted reward shares one currency and a server-stated scale. */
function earnedRewards(rewards: Reward[] | undefined, locale: AppLocale) {
  const counted = (rewards ?? []).filter(reward => (reward.state === 'earned' || reward.state === 'redeemed') && /^\d+$/.test(reward.amountAtomic))
  if (!counted.length) return null
  const { currency, decimals } = counted[0]
  if (decimals === null || decimals === undefined || counted.some(reward => reward.currency !== currency || reward.decimals !== decimals)) return null
  const total = counted.reduce((sum, reward) => sum + BigInt(reward.amountAtomic), BigInt(0))
  if (total === BigInt(0)) return null
  try {
    const value = fromAtomic(total.toString(), decimals)
    return currency === 'USD' ? fmtUsd(value, { locale }) : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} ${currency}`
  } catch { return null }
}

/** Slim invite strip under the portfolio card: funded accounts only, snoozed 30 days on dismiss. */
function InviteStrip({ copy, locale }: { copy: MaisonCopy; locale: AppLocale }) {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(false)
  useEffect(() => { setVisible(!inviteSnoozed()) }, [])
  const rewards = useQuery(visible ? 'referral:rewards' : null, listRewards, { staleTime: 60_000 })
  const earned = earnedRewards(rewards.data, locale)
  const dismiss = () => {
    try { window.localStorage.setItem(INVITE_DISMISS_KEY, String(Date.now())) } catch { /* the strip simply returns next visit */ }
    setVisible(false)
  }
  if (!visible) return null
  return <motion.div className={styles.invite} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, ease: EASE, delay: .7 }}>
    <button type="button" className={styles.inviteMain} onClick={() => openPath('/profile/referral')}>
      <span className={styles.inviteIcon} aria-hidden="true"><Gift size={16} strokeWidth={1.6} /></span>
      <span className={styles.inviteText}>
        <b>{copy.invite}</b>
        <small>{earned ? <em dir="ltr">{copy.inviteEarned.replace('{v}', earned)}</em> : copy.inviteBody}</small>
      </span>
      <ArrowUpRight size={16} className={styles.inviteGo} aria-hidden="true" />
    </button>
    <button type="button" className={styles.inviteClose} onClick={dismiss} aria-label={copy.inviteDismiss}><X size={14} strokeWidth={1.8} /></button>
  </motion.div>
}

/** Install entry in the invite-strip material; tap opens the per-browser guide sheet. */
function InstallStrip({ locale }: { locale: AppLocale }) {
  const reduced = useReducedMotion()
  const { env, canPrompt, dismiss } = useHomeInstall()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  if (!env) return null
  const copy = installCopy[locale]
  const sub = env.kind === 'wechat-ios' || env.kind === 'wechat-android' || env.kind === 'inapp'
    ? copy.stripInApp.replace('{app}', env.app ?? (locale === 'zh-CN' ? '应用' : 'this app'))
    : copy.stripSub
  return <>
    <motion.div className={styles.invite} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, ease: EASE, delay: .6 }}>
      <button type="button" className={styles.inviteMain} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={styles.inviteIcon} aria-hidden="true"><Smartphone size={16} strokeWidth={1.6} /></span>
        <span className={styles.inviteText}><b>{copy.strip}</b><small>{sub}</small></span>
        <ArrowUpRight size={16} className={styles.inviteGo} aria-hidden="true" />
      </button>
      <button type="button" className={styles.inviteClose} onClick={dismiss} aria-label={copy.dismiss}><X size={14} strokeWidth={1.8} /></button>
    </motion.div>
    <InstallSheet open={open} env={env} canPrompt={canPrompt} copy={copy} onClose={close} />
  </>
}

export function HomeScreen({ go }: { go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const copy = copyByLocale[locale]
  const extra = maisonCopy[locale]
  const utility = utilityCopy[locale]
  const dataCopy = homeDataCopy[locale]
  const lowerLabel = lowerCopy[locale]
  const reduced = useReducedMotion()
  const overview = useQuery('rwa:overview', getRwaOverview, { pollInterval: POLL.quote })
  const featured = useQuery('rwa:featured:8', () => request<{ items: FeaturedAsset[] }>('/v1/rwa/assets?featured=true&limit=8'), { staleTime: 60_000, pollInterval: POLL.list })
  const context = useQuery('market-context:home', getMarketContextView, { staleTime: 45_000, pollInterval: POLL.quote })
  const [account, setAccount] = useState<HomePortfolioSnapshot | null>(null)
  const [sessionProbe, setSessionProbe] = useState<{ status: 'loading' | 'guest' | 'ok' | 'error'; view: SessionView | null }>({ status: 'loading', view: null })
  const [kycView, setKycView] = useState<KycStatusView | null>(null)
  const [walletSnapshot, setWalletSnapshot] = useState<{ available: number; locked: number; pending: number; invested: number } | null>(null)
  const [positionsCount, setPositionsCount] = useState<number | null>(null)
  const [topbarHidden, setTopbarHidden] = useState(false)
  // While the community tabs are pinned they own the top edge: the topbar stays tucked away.
  const [feedPinned, setFeedPinned] = useState(false)
  const feedPinnedRef = useRef(false)
  const onFeedPinned = useCallback((pinned: boolean) => {
    feedPinnedRef.current = pinned
    setFeedPinned(pinned)
    if (pinned) setTopbarHidden(true)
  }, [])
  // Only the session probe is refreshed after an in-place email bind; wallet and positions are left alone.
  const refreshSessionView = useCallback(() => {
    void getSessionView().then(view => setSessionProbe(prev => prev.view && view.userId !== prev.view.userId ? prev : { status: 'ok', view })).catch(() => undefined)
  }, [])
  useEffect(() => {
    const initialToken = getSessionToken()
    const accountChanged = () => { if (getSessionToken() !== initialToken) location.reload() }
    window.addEventListener('storage', accountChanged)
    window.addEventListener(SESSION_CHANGED, accountChanged)
    return () => { window.removeEventListener('storage', accountChanged); window.removeEventListener(SESSION_CHANGED, accountChanged) }
  }, [])

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
          totalAssetsAtomic: wallet ? walletTotalAtomic(wallet) : sumPositionMarketValueAtomic(positions),
          totalAssetsDecimals: wallet ? wallet.asset.decimals : 6,
          availableAtomic: wallet?.balances.availableAtomic ?? null,
          availableDecimals: wallet?.asset.decimals ?? 6,
          holdings: positionsResult.status === 'fulfilled' ? positions.length : null,
          currency: wallet?.asset.code === 'USDT' ? 'USDT' : 'USD',
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

  // Same contract as S2: the scene stays pinned and drifts slowly while content covers it;
  // scroll direction drives data-topbar-hidden (and through it --feed-sticky-top).
  const heroBgRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let previousY = window.scrollY
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        const el = heroBgRef.current
        if (el) el.style.transform = reducedMotion ? '' : `translate3d(0,${(-Math.min(y, 900) * .08).toFixed(1)}px,0) scale(${(1 + Math.min(y, 600) / 6000).toFixed(4)})`
        if (feedPinnedRef.current) setTopbarHidden(true)
        else if (y < 36) setTopbarHidden(false)
        else if (Math.abs(y - previousY) > 5) setTopbarHidden(y > previousY)
        previousY = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 320], [1, 0])
  const heroLift = useTransform(scrollY, [0, 320], [0, -36])

  const mainCta = heroCta(state)
  const ctaLabel = mainCta ? ctaText[locale][mainCta.kind] : null
  const openMainCta = () => {
    if (!mainCta) return
    if (mainCta.kind === 'verifyEmail') { focusHomeEmailBinding(); return }
    const path = routePath(mainCta.routeKey as never)
    openPath(mainCta.query ? `${path}?${mainCta.query}` : path)
  }

  const overviewData = (overview.data ?? {}) as Record<string, unknown>
  const marketCap = toNumber(overviewData.totalMarketCapUsd)
  const volume24h = toNumber(overviewData.totalVolume24hUsd)
  const distribution = Array.isArray(overviewData.categoryDistribution) ? overviewData.categoryDistribution as Distribution[] : []
  const asOf = typeof overviewData.latestDataTimestamp === 'string' && !Number.isNaN(Date.parse(overviewData.latestDataTimestamp))
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(overviewData.latestDataTimestamp))
    : '—'
  const compactUsd = (value: number) => fmtUsd(String(value), { compact: true, locale })
  const integer = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
  const featuredItems = featured.data?.items?.slice(0, 3) ?? []
  const tickerQuotes = [...(context.data?.anchors ?? []), ...(context.data?.secondary ?? [])].filter((quote, index, all) => quote.value !== null && all.findIndex(other => other.symbol === quote.symbol) === index)
  const stateLabels = homeStateCopy[locale]
  const statusLabel = state.variant ? stateLabels.variant[state.variant] : state.degraded ? stateLabels.degraded : stateLabels.lifecycle[state.lifecycle]
  const sessionUserId = sessionProbe.status === 'ok' ? sessionProbe.view?.userId : undefined
  const portfolioAccount = state.lifecycle === 'funded' || state.lifecycle === 'invested' || sessionUserId ? account : null
  const emailBinding = sessionProbe.status === 'ok' && sessionProbe.view && !sessionProbe.view.emailVerified && sessionUserId ? { userId: sessionUserId, onVerified: refreshSessionView } : undefined
  useEffect(() => {
    if (!sessionUserId || new URLSearchParams(location.search).get('bindEmail') !== '1') return
    const url = new URL(location.href)
    url.searchParams.delete('bindEmail')
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
    const timer = window.setTimeout(focusHomeEmailBinding, 0)
    return () => window.clearTimeout(timer)
  }, [sessionUserId])
  const dateline = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())

  return <section className={`screen s2-home ${styles.root} ${display.variable} ${GeistSans.variable}`} data-home-s2="true" data-home-design="maison" data-locale={locale} data-home-lifecycle={state.lifecycle} data-home-variant={state.variant ?? 'none'} data-topbar-hidden={topbarHidden} data-feed-pinned={feedPinned}>
    <div className={styles.heroBg} ref={heroBgRef} aria-hidden="true" />
    <div className={styles.grain} aria-hidden="true" />
    <RwaTopbar screen="home" surface="transparent-over-media" action={{ label: extra.inviteOpen, Icon: Gift, onClick: () => openPath('/profile/referral') }} />
    <PullToRefresh />

    <div className={styles.firstScreen}>
    <header className={styles.hero} data-chrome="">
      <motion.div className={styles.heroCopy} style={reduced ? undefined : { opacity: heroOpacity, y: heroLift }}>
        <motion.div className={styles.heroMeta} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.1 }}>
          <span>A-REIT</span><span className={styles.heroRule} /><span>{dateline}</span>
        </motion.div>
        <motion.p className={styles.heroKicker} initial={reduced ? false : { opacity: 0, letterSpacing: '.5em' }} animate={{ opacity: 1, letterSpacing: '.28em' }} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}>{copy.kicker}</motion.p>
        <h1 className={styles.heroTitle}><MaskLines lines={[copy.headline, copy.perspective]} lineClassName={index => index === 1 ? styles.heroItalic : undefined} delay={0.3} /></h1>
        <motion.p className={styles.heroSub} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.75 }}>{copy.sub}</motion.p>
      </motion.div>
      <Ticker quotes={tickerQuotes} locale={locale} />
    </header>

      <HomePortfolioCard state={state} account={portfolioAccount} labels={{ portfolio: copy.portfolio, available: copy.available, holdings: copy.holdings, showBalance: utility.showBalance, hideBalance: utility.hideBalance }} status={statusLabel} ctaLabel={ctaLabel} onPrimary={openMainCta} onPortfolio={() => go('portfolio')} onCashAction={openPath} emailBinding={emailBinding} />
    </div>

    <div className={styles.content}>

      <InstallStrip locale={locale} />

      {(state.lifecycle === 'funded' || state.lifecycle === 'invested') && <InviteStrip copy={extra} locale={locale} />}

      <Rise as="section" className={styles.pulse}>
        <SectionHead index="01" title={copy.pulse} />
        <dl className={styles.pulseMetrics}>
          <div><dt>{copy.tracked}</dt><dd><CountUp className={styles.pulseValue} value={marketCap} format={compactUsd} duration={1.8} /></dd></div>
          <div><dt>{copy.volume}</dt><dd><CountUp value={volume24h} format={compactUsd} /></dd></div>
        </dl>
        {overview.error && !overview.data && <ErrorBlock message={overview.error.message} retry={overview.refetch} />}
        <dl className={styles.stats}>
          <div><dt>{copy.assets}</dt><dd><CountUp value={toNumber(overviewData.assetCount)} format={integer} duration={1.2} /></dd></div>
          <div><dt>{copy.issuers}</dt><dd><CountUp value={toNumber(overviewData.issuerCount)} format={integer} duration={1.2} /></dd></div>
        </dl>
        {marketCap !== null && marketCap > 0 && distribution.length > 0 && <>
          <p className={styles.allocationLabel}>{extra.allocation}</p>
          <AllocationBar items={distribution} total={marketCap} locale={locale} otherLabel={extra.other} />
        </>}
        {overview.error && overview.data && <button type="button" className={styles.retry} onClick={() => void overview.refetch()}>{utility.retry}</button>}
        <div className={styles.pulseFoot}>
          <span>{copy.updated} <time>{asOf}</time></span>
          <button type="button" onClick={() => go('trust-center')}><ShieldCheck size={14} strokeWidth={1.6} />{extra.trust}</button>
        </div>
      </Rise>

      <Rise as="section" className={styles.section}>
        <SectionHead index="02" title={copy.forYou} />
        <HomeForYou assets={featured.data?.items ?? []} onBaskets={() => go('basket-list')} />
      </Rise>

      <Rise as="section" className={styles.section}>
        <SectionHead index="03" title={copy.featured} onMore={() => openPath('/markets?tab=assets')} more={lowerLabel.assets} />
        {featured.loading && !featured.data ? <div className={styles.skeletonRow} aria-busy="true"><span /><span /><span /></div> : featured.error && !featured.data ? <ErrorBlock message={featured.error.message} retry={featured.refetch} /> : featuredItems.length ? <>
          <div className={styles.assetColumns} aria-hidden="true"><span /><span>{copy.marketCap}</span><span>{copy.change24h}</span></div>
          <div className={styles.rail}>
            {featuredItems.map((asset, index) => {
              const symbol = asset.symbol && asset.symbol !== '-' ? asset.symbol : null
              const change = toNumber(asset.change24hPct)
              return <motion.button type="button" key={asset.slug} className={styles.asset} onClick={() => openPath('/asset/' + encodeURIComponent(asset.slug))} whileTap={reduced ? undefined : { scale: .99 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                <span className={styles.assetIdentity}>
                  <span className={styles.assetMedia}><FeaturedAssetPhoto src={homeAssetImage(asset, index)} /></span>
                  <span className={styles.assetInfo}><b>{asset.name}</b><small>{[symbol, asset.issuer?.name || classLabel(asset.assetClass ?? 'rwa', locale)].filter(Boolean).join(' · ')}</small></span>
                </span>
                <span className={styles.assetValue} dir="ltr"><span className={styles.srOnly}>{copy.marketCap} </span>{fmtUsd(asset.marketCapUsd, { compact: true, locale, digits: 1 })}</span>
                <span className={styles.assetChange + ' ' + changeTone(asset.change24hPct)} dir="ltr"><span className={styles.srOnly}>{copy.change24h} </span>{change === null ? '—' : new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(change) + '%'}</span>
              </motion.button>
            })}
          </div>
        </> : <p className={styles.empty}>{dataCopy.priceUnavailable}</p>}
        {featured.error && featured.data && <button type="button" className={styles.retry} onClick={() => void featured.refetch()}>{utility.retry}</button>}
      </Rise>

      <Rise as="section" className={styles.section}><HomeMarkets /></Rise>

      <Rise as="section" className={`${styles.section} ${styles.prediction}`}><HomePolymarket /></Rise>

      <section className={`${styles.section} ${styles.community}`}>
        <SectionHead index="06" title={copy.community} onMore={() => go('community')} more={lowerLabel.community} />
        <HomeSocialFeed onPinnedChange={onFeedPinned} onOpen={post => openPath(`/community/post/${encodeURIComponent(post.id)}`)} onAuthor={post => { const handle = post.author?.handle || post.author?.id; if (handle) openPath('/community/member/' + encodeURIComponent(handle)) }} labels={{ all: feedAll[locale], loading: utility.loading, retry: utility.retry, end: utility.end, emptyTitle: copy.communityEmpty, emptyBody: copy.communityBody }} />
      </section>
    </div>
  </section>
}
