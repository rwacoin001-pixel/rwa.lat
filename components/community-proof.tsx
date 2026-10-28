'use client'

import { BadgeCheck } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import type { CommunityProof } from '@/lib/community-data'
import styles from './community-proof.module.css'

/**
 * A ledger-verified result under a post (2026-10-28, docs/design-system.md §7.7). The figure comes from the server, which
 * computed it from the author's own ledger row; the risk line is always attached. Percentages only.
 */
type Copy = { quant: string; prediction: string; verified: string; risk: string }
const copy: Record<AppLocale, Copy> = {
  en: { quant: 'Koala Quant · day settled', prediction: 'Prediction won', verified: 'Verified by the A-REIT ledger', risk: 'Past performance does not indicate future results.' },
  'zh-CN': { quant: '考拉量化 · 当日结算', prediction: '预测命中', verified: '账本已验证', risk: '历史表现不代表未来收益。' },
  hi: { quant: 'Koala Quant · दिन का निपटान', prediction: 'पूर्वानुमान सही', verified: 'A-REIT लेजर से सत्यापित', risk: 'पिछला प्रदर्शन भविष्य के परिणाम नहीं बताता।' },
  es: { quant: 'Koala Quant · día liquidado', prediction: 'Predicción acertada', verified: 'Verificado por el registro de A-REIT', risk: 'El rendimiento pasado no garantiza resultados futuros.' },
  ar: { quant: 'Koala Quant · تسوية اليوم', prediction: 'توقع صائب', verified: 'موثّق من سجل A-REIT', risk: 'الأداء السابق لا يضمن النتائج المستقبلية.' },
  fr: { quant: 'Koala Quant · jour réglé', prediction: 'Prédiction gagnante', verified: 'Vérifié par le registre A-REIT', risk: 'Les performances passées ne préjugent pas des résultats futurs.' },
  pt: { quant: 'Koala Quant · dia liquidado', prediction: 'Previsão certa', verified: 'Verificado pelo registro da A-REIT', risk: 'Desempenho passado não garante resultados futuros.' },
}

export function CommunityProofCard({ proof, locale }: { proof: CommunityProof; locale: AppLocale }) {
  const c = copy[locale] ?? copy.en
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${proof.tradeDate}T00:00:00Z`))
  return <div className={styles.card} aria-label={`${c.verified}: ${proof.title} +${proof.pct.toFixed(2)}%`}>
    <span className={styles.kind}>{proof.kind === 'quant_day' ? c.quant : c.prediction} · {date}</span>
    <b className={styles.title} dir="auto">{proof.title}</b>
    <span className={styles.pct} dir="ltr">+{proof.pct.toFixed(2)}%</span>
    <span className={styles.verified}><BadgeCheck size={14} aria-hidden="true" />{c.verified}</span>
    <small className={styles.risk}>{c.risk}</small>
  </div>
}
