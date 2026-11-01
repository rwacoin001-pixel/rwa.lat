'use client'

/**
 * The daily reward ticket (v2, 2026-11-02; after the user's event-ticket reference): a vivid art band of glass capsules
 * whose colours follow the tier, two perforations with side notches, the details grid, the voucher as the one big number,
 * and a barcode drawn from the ticket number. All figures come from the server's draw.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { fmtAtomic, fmtDate } from '@/components/maison/format'
import { useI18n } from '@/lib/i18n'
import { serialOf, tierOf, type Coupon, type Draw, type DrawTier } from '@/lib/rewards'
import { useRewardsCopy } from './rewards-copy'
import t from './ticket.module.css'

type Palette = { bg: [string, string]; pills: [string, string][] }
const PALETTES: Record<DrawTier | 'fee', Palette> = {
  common: { bg: ['#1846d8', '#3a7cf3'], pills: [['#a9cbff', '#3f74f0'], ['#e9f2ff', '#7aa6ff'], ['#7fe0ff', '#2b62e6'], ['#c7d9ff', '#5a86f5'], ['#9fb8ff', '#2550d6']] },
  rare: { bg: ['#2e22c9', '#7046f2'], pills: [['#c9b8ff', '#6a4cf0'], ['#ffc7ec', '#9b5cf2'], ['#9fd2ff', '#4c49e6'], ['#f1e6ff', '#8b6cf7'], ['#d6a8ff', '#5235d8']] },
  epic: { bg: ['#1b47d6', '#2f66ee'], pills: [['#ff4f6d', '#ff9ad0'], ['#ff7ad9', '#7c5cff'], ['#7ab8ff', '#2f5ff0'], ['#5be0a8', '#ff9f43'], ['#ffd25e', '#ff6fb1']] },
  legend: { bg: ['#14161a', '#2c3038'], pills: [['#fbe7b0', '#c8933a'], ['#fff3d0', '#d9a84e'], ['#e7c47a', '#9c6c22'], ['#fff8e6', '#e2b968'], ['#d8b064', '#8a5c1a']] },
  fee: { bg: ['#5b6472', '#8a93a3'], pills: [['#eef1f5', '#b9c1cd'], ['#ffffff', '#cfd5de'], ['#dfe4ea', '#a7b0bd'], ['#f6f7f9', '#c3cad4'], ['#e8ebf0', '#9aa3b1']] },
}
const SHAPES: { x: string; w: string; h: string; d: string }[] = [
  { x: '4%', w: '15%', h: '128px', d: '0s' }, { x: '21%', w: '17%', h: '96px', d: '-1.2s' }, { x: '41%', w: '20%', h: '150px', d: '-2.4s' },
  { x: '64%', w: '15%', h: '110px', d: '-3.1s' }, { x: '81%', w: '15%', h: '138px', d: '-4.5s' },
]
const ORBS = [{ x: '30%', y: '62%', w: '34px', d: '-.6s' }, { x: '58%', y: '70%', w: '26px', d: '-2s' }, { x: '76%', y: '30%', w: '20px', d: '-3.4s' }]
const vars = (v: Record<string, string>) => v as CSSProperties

export function TicketArt({ tier, compact = false }: { tier: DrawTier | 'fee'; compact?: boolean }) {
  const p = PALETTES[tier]
  return <div className={t.art} style={vars({ '--bg-a': p.bg[0], '--bg-b': p.bg[1] })} aria-hidden="true">
    {SHAPES.slice(0, compact ? 3 : 5).map((s, i) => <i key={i} className={t.pill} style={vars({ left: compact ? `${8 + i * 30}%` : s.x, '--w': compact ? '24%' : s.w, '--h': compact ? `${70 + (i % 2) * 24}px` : s.h, '--d': s.d, '--a': p.pills[i][0], '--b': p.pills[i][1] })} />)}
    {!compact && ORBS.map((o, i) => <i key={i} className={t.orb} style={vars({ left: o.x, top: o.y, '--w': o.w, '--d': o.d, '--a': p.pills[(i + 2) % 5][0], '--b': p.pills[(i + 2) % 5][1] })} />)}
    <i className={t.shine} />
  </div>
}

/** Deterministic barcode widths from the ticket number (decorative; the number under it is the real reference). */
function bars(serial: string) {
  const out: number[] = []
  for (const ch of serial.replace(/[^A-Z0-9]/gi, '')) {
    const c = ch.charCodeAt(0)
    out.push(1 + (c % 3), 1 + ((c >> 2) % 2), 1 + ((c >> 1) % 3), 1)
  }
  return [2, 1, 1, ...out, 1, 1, 2]
}

/** Counts a number up once when `run` turns true. */
function useCount(target: number, run: boolean) {
  const [value, setValue] = useState(run ? 0 : target)
  useEffect(() => {
    if (!run) { setValue(target); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, run])
  return value
}

const usdt = (coupon: Coupon) => Number(BigInt(coupon.maxDiscountAtomic)) / 10 ** coupon.assetDecimals

export function PrintedTicket({ draw, reveal = false }: { draw: Draw; reveal?: boolean }) {
  const k = useRewardsCopy()
  const { locale } = useI18n()
  const tier = tierOf(draw)
  const serial = serialOf(draw)
  const widths = useMemo(() => bars(serial), [serial])
  const voucher = draw.prize.voucher
  const face = voucher ? usdt(voucher) : 0
  const shownFace = useCount(face, reveal)
  const points = useCount(draw.prize.points ?? 0, reveal)
  const time = new Date(draw.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return <article className={t.ticket} data-tier={tier} data-reveal={reveal || undefined} aria-label={`${k.ticketTitle} ${serial}`}>
    <TicketArt tier={tier} />
    {draw.state === 'frozen' && <span className={t.stamp}>{k.states.frozen}</span>}
    <i className={t.tear} aria-hidden="true" />
    <div className={t.body}>
      <div className={t.titleRow}><h3>{k.ticketTitle}</h3><span className={t.tier}>{k.tiers[tier]}</span></div>
      <dl className={t.grid}>
        <div><dt>{k.date}</dt><dd>{fmtDate(draw.createdAt, locale)}</dd></div>
        <div><dt>{k.time}</dt><dd>{time}</dd></div>
      </dl>
      <div className={t.hero}>
        {voucher ? <span><small>{k.kinds.prediction_stake}</small><b className={t.figure}>{shownFace.toLocaleString(locale)}<i>{voucher.assetCode}</i></b></span>
          : draw.prize.coupon ? <span><small>{k.kinds[draw.prize.coupon.kind]}</small><b className={t.figure} style={{ fontSize: 22, lineHeight: '28px' }}>{draw.prize.coupon.kind === 'withdrawal_fee' ? k.freeOnce : fmtAtomic(draw.prize.coupon.maxDiscountAtomic, draw.prize.coupon.assetDecimals, draw.prize.coupon.assetCode)}</b></span>
          : <span />}
        {(draw.prize.points ?? 0) > 0 && <span className={t.points}><small>{k.points}</small><b>+{points}</b></span>}
      </div>
      {voucher && <dl className={t.grid}>
        <div><dt>{k.validTill}</dt><dd>{fmtDate(voucher.expiresAt, locale)}</dd></div>
        <div><dt>{k.serial}</dt><dd className={t.mono}>{serial}</dd></div>
      </dl>}
      <p className={t.note}>{draw.state === 'frozen' ? k.frozenNote : voucher ? k.voucherNote : ''}</p>
    </div>
    <i className={t.tear} aria-hidden="true" />
    <div className={t.code} aria-hidden="true">
      <span className={t.bars}>{widths.map((w, i) => <i key={i} style={{ width: w * 2, opacity: i % 2 ? 0 : 1 }} />)}</span>
      <span className={`${t.serial} ${t.mono}`}>{serial} · {draw.sgDate}</span>
    </div>
  </article>
}
