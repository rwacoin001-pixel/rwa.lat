'use client'

// Source: lightweight-charts (tradingview/lightweight-charts, Apache-2.0) — 7D sparkline
// Lazy-loads real /v1/rwa/assets/{slug}/history?days=7 data via IntersectionObserver.
import { useEffect, useRef, useState } from 'react'
import { getAssetHistory } from '@/lib/api/foundation'

export function Sparkline7d({ slug, tone }: { slug: string; tone: 'up' | 'down' | 'flat' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [d, setD] = useState<string | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const r = await getAssetHistory(slug, 7)
      if (!r.ok) return
      // DefiLlama-sourced assets carry no price; their series (and change %) is TVL.
      const key = r.data.points.some((p) => p.priceUsd != null) ? 'priceUsd' : 'marketCapUsd'
      const v = r.data.points.map((p) => p[key]).filter((x) => x != null).map(Number).filter(Number.isFinite)
      if (v.length < 2) return
      const min = Math.min(...v)
      const max = Math.max(...v)
      const span = max - min || 1
      setD(v.map((y, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * 60).toFixed(1)} ${(22 - ((y - min) / span) * 20).toFixed(1)}`).join(' '))
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [slug])
  return (
    <span ref={ref} className="tv-spark" data-tone={tone}>
      {d ? <svg viewBox="0 0 60 24" aria-hidden="true"><path d={d} /></svg> : <i className="tv-spark__empty" />}
    </span>
  )
}
