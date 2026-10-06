'use client'

// One live recommendation. Macro and prediction data live in their own sections.
import { ArrowUpRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { openPath } from '@/lib/maison-nav'
import { useQuery } from '@/lib/api/_query'
import { POLL, request } from '@/lib/api/_http'
import { fmtUsd } from '@/lib/money'
import { useI18n, type AppLocale } from '@/lib/i18n'
import styles from './HomeForYou.module.css'

export type ForYouAsset = { slug: string; name: string; assetClass?: string; marketCapUsd?: string | null; issuer?: { name: string } | null }
type Basket = { id: string; name: string; strategyName?: string | null; riskLevel?: string | null }
type Copy = { basket: string; strategy: string; basketBody: string; pick: string; marketCap: string; low: string; medium: string; high: string }
const copy: Record<AppLocale, Copy> = {
  en: { basket: 'AI / RWA basket', strategy: 'Strategy', basketBody: 'Explore real asset strategies', pick: 'Treasury pick', marketCap: 'Market cap', low: 'Low risk', medium: 'Medium risk', high: 'High risk' },
  'zh-CN': { basket: 'AI / RWA 组合', strategy: '策略', basketBody: '探索真实资产策略', pick: '精选国债', marketCap: '市值', low: '低风险', medium: '中风险', high: '高风险' },
  hi: { basket: 'AI / RWA बास्केट', strategy: 'रणनीति', basketBody: 'वास्तविक संपत्ति रणनीतियाँ देखें', pick: 'ट्रेज़री चयन', marketCap: 'बाज़ार पूंजी', low: 'कम जोखिम', medium: 'मध्यम जोखिम', high: 'उच्च जोखिम' },
  es: { basket: 'Cesta AI / RWA', strategy: 'Estrategia', basketBody: 'Explora estrategias de activos reales', pick: 'Selección del Tesoro', marketCap: 'Capitalización', low: 'Riesgo bajo', medium: 'Riesgo medio', high: 'Riesgo alto' },
  ar: { basket: 'سلة AI / RWA', strategy: 'الاستراتيجية', basketBody: 'استكشف استراتيجيات الأصول الحقيقية', pick: 'اختيار سندات الخزانة', marketCap: 'القيمة السوقية', low: 'مخاطر منخفضة', medium: 'مخاطر متوسطة', high: 'مخاطر مرتفعة' },
  fr: { basket: 'Panier AI / RWA', strategy: 'Stratégie', basketBody: 'Explorer les stratégies d’actifs réels', pick: 'Sélection du Trésor', marketCap: 'Capitalisation', low: 'Risque faible', medium: 'Risque modéré', high: 'Risque élevé' },
  pt: { basket: 'Cesta AI / RWA', strategy: 'Estratégia', basketBody: 'Explore estratégias de ativos reais', pick: 'Seleção do Tesouro', marketCap: 'Valor de mercado', low: 'Risco baixo', medium: 'Risco médio', high: 'Risco alto' },
}

export function HomeForYou({ assets, onBaskets }: { assets: ForYouAsset[]; onBaskets: () => void }) {
  const { locale } = useI18n()
  const label = copy[locale]
  const reduced = useReducedMotion()
  const baskets = useQuery('basket:portfolios:home', () => request<Basket[]>('/v1/basket/portfolios'), { staleTime: 60_000, pollInterval: POLL.list })
  const basket = Array.isArray(baskets.data) && baskets.data.length ? baskets.data[0] : null
  const treasury = assets.filter(asset => asset.assetClass === 'treasury').sort((a, b) => Number(b.marketCapUsd ?? 0) - Number(a.marketCapUsd ?? 0))[0] ?? null
  const risk = basket?.riskLevel?.toLowerCase()
  const riskLabel = risk === 'low' ? label.low : risk === 'medium' || risk === 'moderate' ? label.medium : risk === 'high' ? label.high : null
  const lead = basket
    ? { key: basket.id, badge: label.basket, title: basket.name, body: basket.strategyName ? label.strategy + ' · ' + basket.strategyName : label.basketBody, image: 'basket', open: onBaskets }
    : treasury
      ? { key: treasury.slug, badge: label.pick, title: treasury.name, body: treasury.marketCapUsd ? label.marketCap + ' ' + fmtUsd(treasury.marketCapUsd, { compact: true, locale }) : treasury.issuer?.name, image: 'treasury', open: () => openPath('/asset/' + encodeURIComponent(treasury.slug)) }
      : { key: 'baskets', badge: label.basket, title: label.basket, body: label.basketBody, image: 'basket', open: onBaskets }

  return <div className={styles.root}>
    <motion.button key={lead.key} type="button" className={styles.lead} data-image={lead.image} onClick={lead.open} whileTap={reduced ? undefined : { scale: .98 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
      <span className={styles.leadImage} aria-hidden="true" />
      <span className={styles.badge}>{lead.badge}{riskLabel && <span className={styles.risk}>{riskLabel}</span>}</span>
      <span className={styles.leadBody}><strong>{lead.title}</strong>{lead.body && <small>{lead.body}</small>}</span>
      <span className={styles.leadArrow} aria-hidden="true"><ArrowUpRight size={18} /></span>
    </motion.button>
  </div>
}
