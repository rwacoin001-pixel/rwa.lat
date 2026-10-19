'use client'
// Source: https://github.com/tradingview/lightweight-charts
import { useEffect, useRef, useState } from 'react'
import { createChart, AreaSeries, type Time } from 'lightweight-charts'
import { motion, useReducedMotion } from 'motion/react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { useI18n } from '@/lib/i18n'
import { DUR, EASE } from '@/lib/motion'
import { chartOptions } from './chartTheme'
import { EmptyState } from '../ui/Empty'
export type PricePoint = { date: string; value: string | number | null }
export function PriceArea({ points, days, onDaysChange }: { points: PricePoint[]; days: number; onDaysChange: (days: number) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const { theme } = useRwaTheme()
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const reduced = useReducedMotion()
  const [tooltip, setTooltip] = useState<string | null>(null)
  useEffect(() => {
    if (!host.current || points.length < 2) return
    const chart = createChart(host.current, chartOptions())
    const css = getComputedStyle(document.documentElement)
    const series = chart.addSeries(AreaSeries, { lineColor: css.getPropertyValue('--accent').trim(), topColor: css.getPropertyValue('--chart-area-from').trim(), bottomColor: 'transparent', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
    // Numeric conversion is restricted to the chart boundary. No financial derivations.
    const rows = new Map<number, { time: Time; value?: number }>()
    for (const point of points) {
      const timestamp = Date.parse(point.date) / 1000
      if (!Number.isFinite(timestamp)) continue
      const value = point.value === null || point.value === '' ? null : Number(point.value)
      rows.set(timestamp, value === null || !Number.isFinite(value) ? { time: timestamp as Time } : { time: timestamp as Time, value })
    }
    series.setData([...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row))
    chart.timeScale().fitContent()
    chart.subscribeCrosshairMove(param => {
      const data = param.seriesData.get(series)
      setTooltip(data && 'value' in data ? String(data.value) : null)
    })
    return () => chart.remove()
  }, [points, theme])
  if (points.length < 2) return <EmptyState variant="inline" title={isZh ? '历史数据积累中' : 'Building price history'} body={isZh ? '至少需要两个价格观测点后才能显示曲线。' : 'The curve needs at least two recorded price observations.'} />
  return <div data-testid="price-area" data-point-count={points.length}>
    <div className="rwa-ui-lab__controls" role="group" aria-label={isZh ? '历史区间' : 'History range'}>{[7,30,90,180].map(range => <button key={range} type="button" className="rwa-sel" data-state={days === range ? 'selected' : 'rest'} onClick={() => onDaysChange(range)}>{range}{isZh ? ' 天' : 'd'}</button>)}</div>
    <motion.div key={days} className="rwa-chart" initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0 0 0)' }} transition={{ duration: reduced ? 0 : DUR.reveal / 1000, ease: EASE.emph }}><div ref={host} className="rwa-chart" /></motion.div>
    <p className="rwa-chart-caption" aria-live="polite">{tooltip ?? (isZh ? '移动指针查看数据' : 'Move the pointer to inspect a value')}</p>
  </div>
}
