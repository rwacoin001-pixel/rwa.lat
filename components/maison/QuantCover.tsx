'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import type { QuantProduct } from '@/lib/api/quant'
import { openPath } from '@/lib/maison-nav'
import { signedUsdt, usdtNumber } from './QuantParts'
import q from './quant-cover.module.css'

/**
 * Koala Quant cover on Markets (2026-10-29, after the user's "Booked" reference). One big card whose ground is the photo
 * itself, blurred; inside it, on top, the same photo sharp in its own rounded card with the name; under it, the last
 * fourteen settled days as a ruler of bars that grow in, with a marker that glides to the latest day (tap or drag to read
 * any day); at the bottom an ink card with the rules — or, for holders, their principal and latest day — and the keys.
 * Every figure is the API's own; nothing is made up for the animation.
 */
type CoverCopy = { tag: string; recent: string; settled: (d: string) => string; flowA: string; flowB: string; rules: (min: string) => string; principal: string; latest: string; learn: string; buy: string; add: string; mine: string; risk: string; since: string; last30: string; empty: string }
const copy: Record<AppLocale, CoverCopy> = {
  en: { tag: 'Settled daily · Singapore', recent: 'Last 14 settled days', settled: (d) => `${d} settlement`, flowA: 'Cut-off 15:00', flowB: 'Settled next day', rules: (m) => `From ${m} USDT · profits paid to your available balance daily`, principal: 'My principal', latest: 'Latest day', learn: 'The strategy', buy: 'Subscribe', add: 'Add more', mine: 'My position', risk: 'Capital at risk. Past results do not promise future ones.', since: 'Since inception', last30: '30 days', empty: 'The first settled days will show here.' },
  'zh-CN': { tag: '每日结算 · 新加坡', recent: '最近 14 个结算日', settled: (d) => `${d} 结算`, flowA: '15:00 截止', flowB: '次日结算', rules: (m) => `${m} USDT 起 · 收益每天到可用余额`, principal: '我的本金', latest: '最近一天', learn: '了解策略', buy: '申购', add: '追加申购', mine: '我的持仓', risk: '本金有亏损风险，过去的表现不代表将来。', since: '成立以来', last30: '近 30 天', empty: '结算开始后，这里会显示每天的结果。' },
  hi: { tag: 'रोज़ निपटान · सिंगापुर', recent: 'पिछले 14 निपटान दिन', settled: (d) => `${d} निपटान`, flowA: 'कट-ऑफ़ 15:00', flowB: 'अगले दिन निपटान', rules: (m) => `${m} USDT से · लाभ रोज़ उपलब्ध बैलेंस में`, principal: 'मेरी मूल राशि', latest: 'नवीनतम दिन', learn: 'रणनीति', buy: 'सब्सक्राइब', add: 'और जोड़ें', mine: 'मेरी होल्डिंग', risk: 'पूंजी जोखिम में है। पिछला प्रदर्शन भविष्य का वादा नहीं।', since: 'शुरुआत से', last30: '30 दिन', empty: 'पहले निपटान दिन यहाँ दिखेंगे।' },
  es: { tag: 'Liquidación diaria · Singapur', recent: 'Últimos 14 días liquidados', settled: (d) => `Liquidación ${d}`, flowA: 'Cierre 15:00', flowB: 'Liquida al día siguiente', rules: (m) => `Desde ${m} USDT · ganancias a tu saldo cada día`, principal: 'Mi capital', latest: 'Último día', learn: 'La estrategia', buy: 'Suscribir', add: 'Añadir', mine: 'Mi posición', risk: 'El capital está en riesgo. El pasado no garantiza el futuro.', since: 'Desde el inicio', last30: '30 días', empty: 'Aquí aparecerán los primeros días liquidados.' },
  ar: { tag: 'تسوية يومية · سنغافورة', recent: 'آخر 14 يوم تسوية', settled: (d) => `تسوية ${d}`, flowA: 'الإغلاق 15:00', flowB: 'التسوية في اليوم التالي', rules: (m) => `ابتداءً من ${m} USDT · الأرباح إلى رصيدك يوميًا`, principal: 'رأس مالي', latest: 'آخر يوم', learn: 'الاستراتيجية', buy: 'اكتتاب', add: 'إضافة', mine: 'مركزي', risk: 'رأس المال معرض للخطر. الأداء السابق لا يضمن المستقبل.', since: 'منذ الإطلاق', last30: '30 يومًا', empty: 'ستظهر هنا أيام التسوية الأولى.' },
  fr: { tag: 'Règlement quotidien · Singapour', recent: '14 derniers jours réglés', settled: (d) => `Règlement du ${d}`, flowA: 'Clôture 15:00', flowB: 'Réglé le lendemain', rules: (m) => `Dès ${m} USDT · gains versés chaque jour`, principal: 'Mon capital', latest: 'Dernier jour', learn: 'La stratégie', buy: 'Souscrire', add: 'Ajouter', mine: 'Ma position', risk: 'Capital à risque. Le passé ne garantit pas l’avenir.', since: 'Depuis le lancement', last30: '30 jours', empty: 'Les premiers jours réglés apparaîtront ici.' },
  pt: { tag: 'Liquidação diária · Singapura', recent: 'Últimos 14 dias liquidados', settled: (d) => `Liquidação ${d}`, flowA: 'Corte 15:00', flowB: 'Liquida no dia seguinte', rules: (m) => `A partir de ${m} USDT · ganhos no saldo todo dia`, principal: 'Meu capital', latest: 'Último dia', learn: 'A estratégia', buy: 'Subscrever', add: 'Adicionar', mine: 'Minha posição', risk: 'Capital em risco. O passado não garante o futuro.', since: 'Desde o início', last30: '30 dias', empty: 'Os primeiros dias liquidados aparecerão aqui.' },
}

const pct = (v: number | null | undefined, digits = 2) => v === null || v === undefined || Number.isNaN(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`
const tone = (v: number | null | undefined) => !v ? undefined : v > 0 ? 'up' : 'down'
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts from the last shown value to `to` in ~600 ms (ease-out); the number never jumps. */
export function useTween(to: number, ms = 600) {
  const [value, setValue] = useState(to)
  const from = useRef(to)
  useEffect(() => {
    if (reduced()) { from.current = to; setValue(to); return }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3)
      const v = a + (to - a) * e
      from.current = v; setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return value
}

export function QuantCover({ product, locale, holder }: { product: QuantProduct; locale: AppLocale; holder: boolean }) {
  const t = copy[locale] ?? copy.en
  // One photo per theme (2026-10-29, user): daylight for light, blue hour for dark — the same photo never fits both.
  const { theme } = useRwaTheme()
  const shot = theme === 'dark' ? 'dark' : 'light'
  const [loaded, setLoaded] = useState(false)
  const days = useMemo(() => product.history.slice(-14).map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct) })), [product.history])
  const last = days.length - 1
  // The marker starts on the first day and glides to the latest once the bars have grown in.
  const [pick, setPick] = useState(0)
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    if (reduced()) { setGrown(true); setPick(last); return }
    const a = window.setTimeout(() => setGrown(true), 60)
    const b = window.setTimeout(() => setPick(last), 700)
    return () => { window.clearTimeout(a); window.clearTimeout(b) }
  }, [last])
  const max = Math.max(0.0001, ...days.map((d) => Math.abs(d.value)))
  const shown = days[Math.min(pick, last)]
  const figure = useTween(shown?.value ?? 0)
  const ruler = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pickAt = (clientX: number) => {
    const box = ruler.current?.getBoundingClientRect()
    if (!box || days.length === 0) return
    const rtl = getComputedStyle(ruler.current!).direction === 'rtl'
    let i = Math.floor(((clientX - box.left) / box.width) * days.length)
    if (rtl) i = days.length - 1 - i
    setPick(Math.max(0, Math.min(last, i)))
  }
  const down = (event: ReactPointerEvent<HTMLDivElement>) => { dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); pickAt(event.clientX) }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => { if (dragging.current) pickAt(event.clientX) }
  const up = () => { dragging.current = false }
  const dayLabel = (date: string, style: 'short' | 'num') => style === 'num'
    ? String(Number(date.slice(8, 10)))
    : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const position = product.position
  const perf = product.performance
  const buy = () => openPath('/quant?step=subscribe')

  return <section className={q.shell} aria-label={product.name}>
    <img key={`g-${shot}`} className={q.ground} src={`/media/quant/cover-${shot}-ground.webp`} alt="" aria-hidden="true" decoding="async" />
    <figure className={q.photo} data-in={loaded || undefined}>
      <img key={shot} src={`/media/quant/cover-${shot}-768.webp`} srcSet={`/media/quant/cover-${shot}-768.webp 768w, /media/quant/cover-${shot}.webp 1024w`} sizes="(max-width: 480px) 100vw, 480px" alt="" width={1024} height={1536} decoding="async" ref={(el) => { if (el?.complete) setLoaded(true) }} onLoad={() => setLoaded(true)} />
      <div className={q.photoHead}>
        <span className={q.glass} data-glass="">{t.tag}</span>
        {holder && <button type="button" className={q.glass} data-glass="" onClick={() => openPath('/quant?tab=account')}>{t.mine}</button>}
      </div>
      <figcaption>
        <h2>{product.name}</h2>
        <span className={q.badge} data-glass="" data-tone={tone(perf.last30d.pct)}><b dir="ltr">{pct(perf.last30d.pct)}</b><small>{t.last30}</small></span>
      </figcaption>
    </figure>

    <div className={q.days}>
      {days.length === 0 ? <p className={q.empty}>{t.empty}</p> : <>
        <div className={q.daysHead}>
          <small>{shown ? t.settled(dayLabel(shown.date, 'short')) : t.recent}</small>
          <b dir="ltr" data-tone={tone(shown?.value)}>{pct(figure)}</b>
        </div>
        <div ref={ruler} className={q.ruler} data-grown={grown || undefined} role="slider" aria-label={t.recent} aria-valuemin={0} aria-valuemax={last} aria-valuenow={pick} aria-valuetext={shown ? `${dayLabel(shown.date, 'short')} ${pct(shown.value)}` : undefined} tabIndex={0}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onKeyDown={(event) => { if (event.key === 'ArrowLeft') setPick((v) => Math.max(0, v - 1)); if (event.key === 'ArrowRight') setPick((v) => Math.min(last, v + 1)) }}
          style={{ ['--n' as string]: days.length, ['--at' as string]: pick }}>
          <span className={q.marker} aria-hidden="true"><i /></span>
          {days.map((d, i) => <span key={d.date} className={q.col} data-on={i === pick || undefined} data-tone={tone(d.value)} style={{ ['--i' as string]: i, ['--h' as string]: Math.max(0.08, Math.abs(d.value) / max) }}>
            <i className={q.bar} />
            <small>{dayLabel(d.date, 'num')}</small>
          </span>)}
        </div>
      </>}
    </div>

    <div className={q.ink}>
      {holder && position
        ? <div className={q.mine}>
          <div><small>{t.principal}</small><b dir="ltr">{usdtNumber(position.principalAtomic, locale)} <em>USDT</em></b></div>
          <div><small>{t.latest}</small><b dir="ltr" data-tone={position.lastDay ? tone(Number(position.lastDay.netAtomic)) : undefined}>{position.lastDay ? signedUsdt(position.lastDay.netAtomic, locale) : '—'}</b></div>
        </div>
        : <>
          <p className={q.flow}><span>{t.flowA}</span><i aria-hidden="true"><ArrowRight size={12} strokeWidth={2.6} /></i><span>{t.flowB}</span></p>
          <p className={q.rules}>{t.rules(usdtNumber(product.minSubscriptionAtomic, locale))}</p>
        </>}
      <div className={q.keys}>
        <button type="button" className={q.ghost} onClick={() => openPath('/quant')}>{t.learn}</button>
        {product.open && <button type="button" className={q.main} onClick={buy}>{holder ? t.add : t.buy}<ArrowRight size={16} aria-hidden="true" /></button>}
      </div>
      <p className={q.risk}>{t.risk}</p>
    </div>
  </section>
}
