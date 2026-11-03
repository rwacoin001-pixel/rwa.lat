'use client'

import { useMemo, useState } from 'react'
import { money } from './format'

export type TrendPoint = { date: string; a: string; b: string }

/** Two daily series (deposits lime, withdrawals grey) as smooth lines; hover shows the day's values in a bubble. */
export function TrendCard({ title, points, aLabel, bLabel }: { title: string; points: TrendPoint[]; aLabel: string; bLabel: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = 180, P = 12
  const { pathA, pathB, xs, ys } = useMemo(() => {
    const a = points.map((p) => Number(BigInt(p.a) / BigInt(10000)) / 100)
    const b = points.map((p) => Number(BigInt(p.b) / BigInt(10000)) / 100)
    const max = Math.max(1, ...a, ...b) * 1.15
    const xs = points.map((_, i) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1))
    const y = (v: number) => H - P - (v / max) * (H - 2 * P)
    const line = (vals: number[]) => vals.map((v, i) => {
      if (i === 0) return `M${xs[0]},${y(v)}`
      const cx = (xs[i - 1] + xs[i]) / 2
      return `C${cx},${y(vals[i - 1])} ${cx},${y(v)} ${xs[i]},${y(v)}`
    }).join(' ')
    return { pathA: line(a), pathB: line(b), xs, ys: { a: a.map(y), b: b.map(y) } }
  }, [points])

  return (
    <section className="min-w-0 rounded-[28px] border border-ops-line bg-ops-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-ops-text">{title}</h2>
        <div className="flex items-center gap-4 text-[12px] text-ops-muted">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-ops-lime" />{aLabel}</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-ops-muted" />{bLabel}</span>
        </div>
      </div>
      <div className="relative mt-4" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[180px] w-full" preserveAspectRatio="none" role="img" aria-label={`${title}：${aLabel}和${bLabel}的每日走势`}>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />)}
          <path d={pathB} fill="none" stroke="#8B93A1" strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.8} />
          <path d={pathA} fill="none" stroke="#C5F23B" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          {hover !== null && <line x1={xs[hover]} x2={xs[hover]} y1={0} y2={H} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
          {points.map((_, i) => <rect key={i} x={xs[i] - (W / points.length) / 2} y={0} width={W / points.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-full bg-ops-lime px-3 py-1.5 text-[12px] font-medium text-ops-ink tabular-nums" style={{ left: `${(xs[hover] / W) * 100}%`, top: `${(ys.a[hover] / H) * 100}%`, marginTop: -8 }}>
            {money(points[hover].a, 6, 0)} / {money(points[hover].b, 6, 0)}
          </div>
        )}
        <div className="mt-2 flex justify-between text-[11px] text-ops-muted">
          {points.map((p, i) => <span key={p.date} className={hover === i ? 'text-ops-text' : ''}>{p.date.slice(5).replace('-', '/')}</span>)}
        </div>
      </div>
    </section>
  )
}
