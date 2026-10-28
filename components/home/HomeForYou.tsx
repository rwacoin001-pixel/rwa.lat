'use client'

// For you: the two products we lead with, Koala Quant and the prediction markets, as porcelain display cases.
import { ArrowUpRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { openPath } from '@/lib/maison-nav'
import { useQuantProducts } from '@/lib/api/quant'
import { useI18n, type AppLocale } from '@/lib/i18n'
import styles from './HomeForYou.module.css'

type Copy = { quant: string; quantLine: string; last30: string; predict: string; predictLine: string }
const copy: Record<AppLocale, Copy> = {
  en: { quant: 'Koala Quant', quantLine: 'Settled daily', last30: 'Past 30 days', predict: 'Prediction markets', predictLine: 'Macro · crypto · commodities' },
  'zh-CN': { quant: '考拉量化', quantLine: '每日结算', last30: '过去 30 天', predict: '预测市场', predictLine: '宏观 · 加密 · 大宗' },
  hi: { quant: 'Koala Quant', quantLine: 'रोज़ निपटान', last30: 'पिछले 30 दिन', predict: 'पूर्वानुमान बाज़ार', predictLine: 'मैक्रो · क्रिप्टो · कमोडिटी' },
  es: { quant: 'Koala Quant', quantLine: 'Liquidación diaria', last30: 'Últimos 30 días', predict: 'Mercados de predicción', predictLine: 'Macro · cripto · materias primas' },
  ar: { quant: 'Koala Quant', quantLine: 'تسوية يومية', last30: 'آخر 30 يومًا', predict: 'أسواق التنبؤ', predictLine: 'اقتصاد كلي · عملات رقمية · سلع' },
  fr: { quant: 'Koala Quant', quantLine: 'Règlement quotidien', last30: '30 derniers jours', predict: 'Marchés de prédiction', predictLine: 'Macro · crypto · matières premières' },
  pt: { quant: 'Koala Quant', quantLine: 'Liquidação diária', last30: 'Últimos 30 dias', predict: 'Mercados de previsão', predictLine: 'Macro · cripto · commodities' },
}

export function HomeForYou() {
  const { locale } = useI18n()
  const label = copy[locale]
  const reduced = useReducedMotion()
  const quant = useQuantProducts().data?.[0] ?? null
  const pct = quant?.performance.last30d.pct ?? null
  const cards = [
    {
      key: 'quant', title: label.quant, photo: '/media/home/cards/quant-720.webp', sub: label.quantLine, open: () => openPath('/markets?tab=quant'),
      value: pct === null ? null : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}%`, tone: pct === null || pct === 0 ? '' : pct > 0 ? styles.up : styles.down,
      line: pct === null ? label.quantLine : label.last30,
    },
    {
      key: 'predict', title: label.predict, photo: '/media/home/cards/predict-720.webp', sub: label.predictLine, open: () => openPath('/markets?tab=predictions'),
      value: null, tone: '', line: label.predictLine,
    },
  ]
  // Photo cards (2026-10-28, after the user's reference): a real, warm photograph fills the card, the number sits on it
  // in a glass chip, the name and one line at the bottom over a soft scrim, a glass arrow in the corner.
  return <div className={styles.root}>
    {cards.map(card => <motion.button key={card.key} type="button" className={styles.card} onClick={card.open} whileTap={reduced ? undefined : { scale: .98 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
      <img className={styles.photo} src={card.photo} alt="" width={720} height={450} decoding="async" />
      {card.value && <span className={`${styles.chip} ${card.tone}`} dir="ltr">{card.line} · {card.value}</span>}
      <span className={styles.text}>
        <strong>{card.title}</strong>
        <small>{card.value ? card.sub : card.line}</small>
      </span>
      <span className={styles.go} aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></span>
    </motion.button>)}
  </div>
}
