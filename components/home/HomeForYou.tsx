'use client'

// Maison home · For You — three curated picks from live sources, no placeholders.
//   Lead : the first basket portfolio when one exists, otherwise the largest tokenized
//          treasury set against the US 10Y benchmark (/v1/rwa/assets + /v1/market-context).
//   Bet  : the highest-volume macro question on Polymarket (/v1/polymarket/public-preview).
//   Gold : the gold quote; opens the TradingView tab of the Markets module.
// Query keys match the other home modules, so these reads are shared, not repeated.
import { ArrowUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { useQuery } from '@/lib/api/_query'
import { POLL, request } from '@/lib/api/_http'
import { getMarketContextView } from '@/lib/api/market-context'
import { fmtUsd } from '@/lib/money'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { EASE } from './maison-motion'
import { openHomeMarkets } from './HomeMarkets'
import styles from './HomeForYou.module.css'

export type ForYouAsset = { slug: string; name: string; assetClass?: string; marketCapUsd?: string | null; issuer?: { name: string } | null }
type Basket = { id: string; name: string; strategyName?: string | null; riskLevel?: string | null }
type PreviewMarket = { id: string; slug: string; eventSlug: string | null; question: string; category: string; outcomes: Array<{ label: string; impliedProbability: number }>; volume24hUsd: number | null }
type Preview = { items: PreviewMarket[] }

const copy: Record<AppLocale, { basket: string; strategy: string; basketBody: string; pick: string; benchmark: string; marketCap: string; bet: string; yes: string; volume: string; gold: string; openChart: string }> = {
  en: { basket: 'AI / RWA basket', strategy: 'Strategy', basketBody: 'Explore real asset strategies', pick: 'Pick · Treasuries', benchmark: 'US 10Y benchmark', marketCap: 'Market cap', bet: "The market's biggest bet", yes: 'Yes', volume: '24h', gold: 'Gold · spot futures', openChart: 'Open chart' },
  'zh-CN': { basket: 'AI / RWA 组合', strategy: '策略', basketBody: '探索真实资产策略', pick: '精选 · 国债', benchmark: '美国 10 年期基准', marketCap: '市值', bet: '市场押注最多的问题', yes: '是', volume: '24 小时', gold: '黄金 · 期货', openChart: '查看图表' },
  hi: { basket: 'AI / RWA बास्केट', strategy: 'रणनीति', basketBody: 'वास्तविक संपत्ति रणनीतियाँ देखें', pick: 'चयन · ट्रेज़री', benchmark: 'US 10Y बेंचमार्क', marketCap: 'बाज़ार पूंजी', bet: 'बाज़ार का सबसे बड़ा दांव', yes: 'हाँ', volume: '24 घं', gold: 'सोना · फ्यूचर्स', openChart: 'चार्ट खोलें' },
  es: { basket: 'Cesta AI / RWA', strategy: 'Estrategia', basketBody: 'Explora estrategias de activos reales', pick: 'Selección · Tesoros', benchmark: 'Referencia US 10Y', marketCap: 'Cap. de mercado', bet: 'La mayor apuesta del mercado', yes: 'Sí', volume: '24 h', gold: 'Oro · futuros', openChart: 'Ver gráfico' },
  ar: { basket: 'سلة AI / RWA', strategy: 'الاستراتيجية', basketBody: 'استكشف استراتيجيات الأصول الحقيقية', pick: 'اختيار · سندات الخزانة', benchmark: 'مرجع 10 سنوات الأمريكي', marketCap: 'القيمة السوقية', bet: 'أكبر رهان في السوق', yes: 'نعم', volume: '24 س', gold: 'الذهب · العقود الآجلة', openChart: 'فتح الرسم' },
  fr: { basket: 'Panier AI / RWA', strategy: 'Stratégie', basketBody: 'Explorer les stratégies d’actifs réels', pick: 'Sélection · Trésor', benchmark: 'Référence US 10 ans', marketCap: 'Capitalisation', bet: 'Le plus gros pari du marché', yes: 'Oui', volume: '24 h', gold: 'Or · contrats à terme', openChart: 'Voir le graphique' },
  pt: { basket: 'Cesta AI / RWA', strategy: 'Estratégia', basketBody: 'Explore estratégias de ativos reais', pick: 'Seleção · Tesouro', benchmark: 'Referência US 10Y', marketCap: 'Valor de mercado', bet: 'A maior aposta do mercado', yes: 'Sim', volume: '24 h', gold: 'Ouro · futuros', openChart: 'Abrir gráfico' },
}

export function HomeForYou({ assets, onBaskets }: { assets: ForYouAsset[]; onBaskets: () => void }) {
  const { locale } = useI18n()
  const label = copy[locale]
  const router = useRouter()
  const reduced = useReducedMotion()
  const baskets = useQuery('basket:portfolios:home', () => request<Basket[]>('/v1/basket/portfolios'), { staleTime: 60_000, pollInterval: POLL.list })
  const context = useQuery('market-context:home', getMarketContextView, { staleTime: 45_000, pollInterval: POLL.quote })
  const preview = useQuery('polymarket:public-preview:finance', () => request<Preview>('/v1/polymarket/public-preview?scope=finance'), { staleTime: 60_000, pollInterval: POLL.quote })

  const basket = Array.isArray(baskets.data) && baskets.data.length ? baskets.data[0] : null
  const treasury = assets.filter(asset => asset.assetClass === 'treasury').sort((a, b) => Number(b.marketCapUsd ?? 0) - Number(a.marketCapUsd ?? 0))[0] ?? null
  const tenYear = context.data?.anchors.find(quote => quote.symbol === '^TNX') ?? null
  const gold = context.data?.anchors.find(quote => quote.symbol === 'GC=F') ?? null
  const markets = preview.data?.items ?? []
  const bet = [...markets].sort((a, b) => (b.category === 'macro' ? 1 : 0) - (a.category === 'macro' ? 1 : 0) || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))[0] ?? null
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const number = (value: number, digits = 2) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  const tap = reduced ? undefined : { scale: .98 }
  const spring = { type: 'spring' as const, stiffness: 380, damping: 26 }

  const lead = basket
    ? { key: basket.id, badge: `${label.basket}${basket.riskLevel ? ` · ${basket.riskLevel}` : ''}`, title: basket.name, body: basket.strategyName ? `${label.strategy} · ${basket.strategyName}` : label.basketBody, image: 'basket', open: onBaskets }
    : treasury
      ? { key: treasury.slug, badge: label.pick, title: treasury.name, body: [tenYear?.value != null ? `${label.benchmark} ${number(tenYear.value, 3)}%` : null, treasury.marketCapUsd ? `${label.marketCap} ${fmtUsd(treasury.marketCapUsd, { compact: true, locale })}` : null].filter(Boolean).join(' · '), image: 'treasury', open: () => router.push(`/asset/${encodeURIComponent(treasury.slug)}`) }
      : { key: 'baskets', badge: label.basket, title: label.basket, body: label.basketBody, image: 'basket', open: onBaskets }

  const goldTone = gold?.changePct == null || gold.changePct === 0 ? styles.flat : gold.changePct < 0 ? styles.down : styles.up

  return <div className={styles.root}>
    <motion.button key={lead.key} type="button" className={styles.lead} data-image={lead.image} onClick={lead.open} whileTap={tap} transition={spring}>
      <motion.span className={styles.leadImage} aria-hidden="true" initial={reduced ? false : { scale: 1.14 }} whileInView={{ scale: 1.02 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 2.4, ease: EASE }} />
      <span className={styles.badge}>{lead.badge}</span>
      <span className={styles.leadBody}><strong>{lead.title}</strong>{lead.body && <small>{lead.body}</small>}</span>
      <span className={styles.leadArrow}><ArrowUpRight size={18} /></span>
    </motion.button>

    <div className={styles.pair}>
      {bet && <motion.button type="button" className={styles.tile} onClick={() => router.push(`/prediction/${encodeURIComponent(bet.id)}`)} whileTap={tap} transition={spring}>
        <span className={styles.eyebrow}>{label.bet}</span>
        <strong className={styles.question} lang="en">{bet.question}</strong>
        <span className={styles.betFigure}><b dir="ltr">{percent.format(bet.outcomes[0]?.impliedProbability ?? 0)}</b><em lang="en">{bet.outcomes[0]?.label ?? label.yes}</em></span>
        <span className={styles.bar} aria-hidden="true"><motion.span initial={reduced ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE, delay: .2 }} style={{ width: `${(bet.outcomes[0]?.impliedProbability ?? 0) * 100}%` }} /></span>
        <small className={styles.meta}>Polymarket{bet.volume24hUsd != null ? ` · ${label.volume} ${fmtUsd(String(bet.volume24hUsd), { compact: true, locale })}` : ''}</small>
      </motion.button>}
      {gold && gold.value != null && <motion.button type="button" className={styles.tile} onClick={() => openHomeMarkets('gold')} whileTap={tap} transition={spring}>
        <span className={styles.eyebrow}>{label.gold}</span>
        <strong className={styles.goldValue} dir="ltr">{number(gold.value, 1)}</strong>
        <span className={`${styles.change} ${goldTone}`} dir="ltr">{gold.changePct == null ? '—' : `${gold.changePct > 0 ? '+' : ''}${gold.changePct.toFixed(2)}%`}</span>
        <span className={styles.chartLink}>{label.openChart}<ArrowUpRight size={14} /></span>
        <small className={styles.meta}>TradingView · {gold.source}</small>
      </motion.button>}
    </div>
  </div>
}
