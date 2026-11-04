'use client'

// For you: Koala Quant, the prediction markets and a few open 衡序 baskets, each as a display case (2026-11-04, after the
// user's reference): a photo card with the name and a glass key, then one line of facts, three figures and a small
// picture of the product — the quant curve, the hottest market's odds, the basket's mix.
import { useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { openPath } from '@/lib/maison-nav'
import { useQuantProducts, type QuantPoint } from '@/lib/api/quant'
import { useQuery } from '@/lib/api/_query'
import { POLL, request } from '@/lib/api/_http'
import { listBaskets } from '@/lib/api/markets'
import { HENGXU_FEATURED, HENGXU_PRODUCTS, type HengxuProduct } from '@/lib/hengxu-products'
import { hengxuCopy, hengxuText } from '@/lib/hengxu-copy'
import { basketCover } from '@/lib/product-media'
import { fmtUsdCompact } from '@/lib/money'
import { useI18n, type AppLocale } from '@/lib/i18n'
import styles from './HomeForYou.module.css'

type Copy = {
  quant: string; quantLine: string; quantHead: string; quantNote: (time: string) => string; last30: string; drawdown: string; min: string
  predict: string; predictLine: string; predictHead: string; predictNote: string; markets: string; volume: string; source: string
  basketHead: string; hold: string; fee: string; view: string; perYear: string
}
const copy: Record<AppLocale, Copy> = {
  en: { quant: 'Koala Quant', quantLine: 'Settled daily', quantHead: 'Rule-based strategy', quantNote: (t) => `Orders close ${t} · Singapore time`, last30: '30 days', drawdown: 'Max drawdown', min: 'From',
    predict: 'Prediction markets', predictLine: 'Macro · crypto · commodities', predictHead: 'Live public markets', predictNote: 'See what the market thinks, then decide', markets: 'Top closes', volume: '24h volume', source: 'Source',
    basketHead: 'Managed basket', hold: 'Holding', fee: 'Fee', view: 'View', perYear: '/yr' },
  'zh-CN': { quant: '考拉量化', quantLine: '每日结算', quantHead: '规则驱动的量化策略', quantNote: (t) => `每日 ${t} 截单 · 新加坡时间`, last30: '近 30 天', drawdown: '最大回撤', min: '起投',
    predict: '预测市场', predictLine: '宏观 · 加密 · 大宗', predictHead: '实时公开市场', predictNote: '先看市场怎么想，再做决定', markets: '最热截止', volume: '24h 成交', source: '数据源',
    basketHead: '托管组合', hold: '持有期', fee: '管理费', view: '查看', perYear: '/年' },
  hi: { quant: 'Koala Quant', quantLine: 'रोज़ निपटान', quantHead: 'नियम-आधारित रणनीति', quantNote: (t) => `ऑर्डर ${t} तक · सिंगापुर समय`, last30: '30 दिन', drawdown: 'अधिकतम गिरावट', min: 'न्यूनतम',
    predict: 'पूर्वानुमान बाज़ार', predictLine: 'मैक्रो · क्रिप्टो · कमोडिटी', predictHead: 'लाइव सार्वजनिक बाज़ार', predictNote: 'बाज़ार क्या सोचता है, देखें', markets: 'समाप्ति', volume: '24घं वॉल्यूम', source: 'स्रोत',
    basketHead: 'प्रबंधित बास्केट', hold: 'अवधि', fee: 'शुल्क', view: 'देखें', perYear: '/वर्ष' },
  es: { quant: 'Koala Quant', quantLine: 'Liquidación diaria', quantHead: 'Estrategia basada en reglas', quantNote: (t) => `Órdenes hasta las ${t} · hora de Singapur`, last30: '30 días', drawdown: 'Caída máx.', min: 'Desde',
    predict: 'Mercados de predicción', predictLine: 'Macro · cripto · materias primas', predictHead: 'Mercados públicos en vivo', predictNote: 'Mira qué piensa el mercado y decide', markets: 'Cierre', volume: 'Volumen 24h', source: 'Fuente',
    basketHead: 'Cesta gestionada', hold: 'Plazo', fee: 'Comisión', view: 'Ver', perYear: '/año' },
  ar: { quant: 'Koala Quant', quantLine: 'تسوية يومية', quantHead: 'استراتيجية قائمة على القواعد', quantNote: (t) => `آخر طلب ${t} · توقيت سنغافورة`, last30: '30 يومًا', drawdown: 'أقصى تراجع', min: 'من',
    predict: 'أسواق التنبؤ', predictLine: 'اقتصاد كلي · عملات رقمية · سلع', predictHead: 'أسواق عامة مباشرة', predictNote: 'اعرف رأي السوق ثم قرّر', markets: 'الإغلاق', volume: 'حجم 24 ساعة', source: 'المصدر',
    basketHead: 'سلة مُدارة', hold: 'المدة', fee: 'الرسوم', view: 'عرض', perYear: '/سنة' },
  fr: { quant: 'Koala Quant', quantLine: 'Règlement quotidien', quantHead: 'Stratégie à règles', quantNote: (t) => `Ordres jusqu’à ${t} · heure de Singapour`, last30: '30 jours', drawdown: 'Baisse max.', min: 'Dès',
    predict: 'Marchés de prédiction', predictLine: 'Macro · crypto · matières premières', predictHead: 'Marchés publics en direct', predictNote: 'Voyez ce que pense le marché, puis décidez', markets: 'Clôture', volume: 'Volume 24 h', source: 'Source',
    basketHead: 'Panier géré', hold: 'Durée', fee: 'Frais', view: 'Voir', perYear: '/an' },
  pt: { quant: 'Koala Quant', quantLine: 'Liquidação diária', quantHead: 'Estratégia baseada em regras', quantNote: (t) => `Ordens até ${t} · horário de Singapura`, last30: '30 dias', drawdown: 'Queda máx.', min: 'A partir de',
    predict: 'Mercados de previsão', predictLine: 'Macro · cripto · commodities', predictHead: 'Mercados públicos ao vivo', predictNote: 'Veja o que o mercado pensa e decida', markets: 'Fecho', volume: 'Volume 24h', source: 'Fonte',
    basketHead: 'Cesta gerida', hold: 'Prazo', fee: 'Taxa', view: 'Ver', perYear: '/ano' },
}

type Preview = { items: Array<{ outcomes: Array<{ label: string; impliedProbability: number }>; volume24hUsd: number | null; endAt?: string | null }> }
type Tile = { kind: 'curve'; points: number[] } | { kind: 'odds'; p: number } | { kind: 'mix'; parts: number[] } | null
type Card = { key: string; title: string; sub: string; photo: string; night?: string; head: string; note: string; facts: Array<[string, string, string?]>; tile: Tile; open: () => void }

const signed = (pct: number) => `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}%`
const tone = (pct: number | null) => pct === null || pct === 0 ? undefined : pct > 0 ? 'up' : 'down'

/** The basket shelf on home: open 衡序 baskets, the flagship first, at most three. */
const BASKET_ORDER: HengxuProduct[] = [...HENGXU_PRODUCTS].sort((a, b) => Number(b.id === HENGXU_FEATURED) - Number(a.id === HENGXU_FEATURED))

export function HomeForYou() {
  const { locale } = useI18n()
  const label = copy[locale]
  const hx = hengxuCopy[locale]
  const reduced = useReducedMotion()
  const row = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const quant = useQuantProducts().data?.[0] ?? null
  // Same cache entries as the prediction block and the basket shelf, so the cards cost no extra fetch.
  const preview = useQuery('polymarket:public-preview:finance', () => request<Preview>('/v1/polymarket/public-preview?scope=finance'), { staleTime: 60_000, pollInterval: POLL.quote, loading: 'silent' }).data
  const baskets = useQuery('markets:baskets', listBaskets, { staleTime: 60_000, pollInterval: POLL.list, loading: 'silent' }).data

  const cards = useMemo<Card[]>(() => {
    const pct = quant?.performance.last30d.pct ?? null
    const dd = quant?.performance.maxDrawdownPct ?? null
    const curve = (quant?.history ?? []).slice(-45).map((point: QuantPoint) => Number(point.indexAfter)).filter(Number.isFinite)
    const items = preview?.items ?? []
    const top = items.find((item) => item.outcomes.length)
    const volume = items.reduce((sum, item) => sum + (item.volume24hUsd ?? 0), 0)
    const list: Card[] = [
      {
        key: 'quant', title: quant?.name && locale === 'zh-CN' ? quant.name : label.quant, sub: label.quantLine, photo: '/media/home/cards/quant-720.webp', night: '/media/login/quant-night.webp',
        head: label.quantHead, note: label.quantNote(quant?.cutoffTime ?? '15:00'),
        facts: [[pct === null ? '—' : signed(pct), label.last30, tone(pct)], [dd === null ? '—' : `${Math.abs(dd).toFixed(2)}%`, label.drawdown], [quant ? `${Number(quant.minSubscriptionAtomic) / 1e6} U` : '—', label.min]],
        tile: curve.length > 2 ? { kind: 'curve', points: curve } : null, open: () => openPath('/markets?tab=quant'),
      },
      {
        key: 'predict', title: label.predict, sub: label.predictLine, photo: '/media/home/cards/predict-720.webp', night: '/media/login/predict-night.webp',
        head: label.predictHead, note: `${label.source} Polymarket · ${label.predictNote}`,
        facts: [[volume ? fmtUsdCompact(volume, { locale }) : '—', label.volume], [top?.endAt ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(top.endAt)) : '—', label.markets]],
        tile: top ? { kind: 'odds', p: Math.max(...top.outcomes.map((o) => o.impliedProbability)) } : null, open: () => openPath('/markets?tab=predictions'),
      },
    ]
    const live = new Map((baskets ?? []).filter((basket) => basket.status === 'active').map((basket) => [basket.strategySlug, basket]))
    for (const product of BASKET_ORDER) {
      const basket = live.get(`hengxu-${product.id}`)
      if (!basket || list.length >= 5) continue
      const text = hengxuText(product, locale)
      const fee = product.terms?.mgmtFeePct
      const min = basket.minimumSubscriptionUsd ?? (product.terms?.minInvestment !== undefined ? String(product.terms.minInvestment) : null)
      list.push({
        key: `basket-${product.id}`, title: text.name, sub: text.subtitle, photo: basketCover(basket) ?? '/media/home/cards/quant-720.webp',
        head: `${label.basketHead} · ${typeof product.risk === 'number' ? hx.risk[product.risk - 1].replace('研究', '') : hx.riskUnrated}`, note: text.oneLiner,
        facts: [[hx.horizon[product.horizon], label.hold], [min ? `${Number(min)} U` : '—', label.min], [fee === undefined ? '—' : `${fee}%`, label.fee]],
        tile: { kind: 'mix', parts: product.allocation.map(([, weight]) => weight) }, open: () => openPath(`/basket/${encodeURIComponent(basket.id)}`),
      })
    }
    return list
  }, [quant, preview, baskets, locale, label, hx])

  // Dots follow the real scroll: the wide pill flows from card to card as you swipe.
  const onScroll = () => {
    const el = row.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const p = max > 0 ? Math.min(1, Math.max(0, Math.abs(el.scrollLeft) / max)) : 0
    setAt(p * (cards.length - 1))
  }
  const jump = (i: number) => { const el = row.current; const card = el?.children[i] as HTMLElement | undefined; if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: reduced ? 'auto' : 'smooth' }) }

  return <><div ref={row} className={styles.root} onScroll={onScroll}>
    {cards.map((card) => <article key={card.key} className={styles.case}>
      <motion.button type="button" className={styles.card} onClick={card.open} whileTap={reduced ? undefined : { scale: .985 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
        <img className={`${styles.photo} ${card.night ? styles.day : ''}`} src={card.photo} alt="" width={720} height={450} decoding="async" loading={card.key.startsWith('basket') ? 'lazy' : undefined} />
        {card.night && <img className={`${styles.photo} ${styles.night}`} src={card.night} alt="" width={720} height={450} decoding="async" loading="lazy" />}
        <span className={styles.text}><strong>{card.title}</strong><small>{card.sub}</small></span>
        <span className={styles.go}>{label.view}</span>
      </motion.button>
      <button type="button" className={styles.body} onClick={card.open} tabIndex={-1} aria-hidden="true">
        <span className={styles.info}>
          <b className={styles.head}>{card.head}</b>
          <small className={styles.note}>{card.note}</small>
          <span className={styles.facts}>{card.facts.map(([value, name, mood]) => <span key={name}><b data-tone={mood} dir="ltr">{value}</b><small>{name}</small></span>)}</span>
        </span>
        {card.tile && <span className={styles.tile}><TileArt tile={card.tile} /></span>}
      </button>
    </article>)}
  </div>
  <div className={styles.dots}>
    {cards.map((card, i) => { const near = Math.max(0, 1 - Math.abs(at - i)); return <button key={card.key} type="button" aria-label={card.title} onClick={() => jump(i)} style={{ ['--w' as string]: `${4 + 12 * near}px`, ['--o' as string]: String(.25 + .55 * near) }} /> })}
  </div></>
}

/** The small well on the right: a line, a ring or a mix — drawn in ink only, like the route in the reference. */
function TileArt({ tile }: { tile: NonNullable<Tile> }) {
  if (tile.kind === 'curve') {
    const min = Math.min(...tile.points), max = Math.max(...tile.points), span = max - min || 1
    const xy = tile.points.map((v, i) => [6 + (i / (tile.points.length - 1)) * 52, 50 - ((v - min) / span) * 36] as const)
    const last = xy[xy.length - 1]
    return <svg viewBox="0 0 64 64" aria-hidden="true"><path d={xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" /></svg>
  }
  const r = 22, c = 2 * Math.PI * r
  if (tile.kind === 'odds') {
    return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth="5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * tile.p} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="36.5" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">{Math.round(tile.p * 100)}%</text></svg>
  }
  const total = tile.parts.reduce((a, b) => a + b, 0) || 1
  let start = 0
  return <svg viewBox="0 0 64 64" aria-hidden="true">{tile.parts.map((part, i) => {
    const len = (part / total) * c, dash = `${Math.max(0, len - 2.5)} ${c}`
    const el = <circle key={i} cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity={1 - i * .2} strokeWidth="9" strokeDasharray={dash} strokeDashoffset={-start} transform="rotate(-90 32 32)" />
    start += len
    return el
  })}</svg>
}
