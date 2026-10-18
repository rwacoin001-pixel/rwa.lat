import { maxDrawdownPct, windowReturn } from '../src/quant/quant.performance'

const pts = (values: number[], start = '2026-10-01') =>
  values.map((indexAfter, i) => ({ tradeDate: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), indexAfter }))

describe('quant performance', () => {
  it('measures windows by calendar days and reports partial coverage instead of pretending', () => {
    const p = pts([1.01, 1.02, 1.0, 1.03])
    const week = windowReturn(p, 7)
    expect(week.coveredDays).toBe(4)
    expect(week.pct).toBeCloseTo(3, 5)
    const long = pts(Array.from({ length: 40 }, (_, i) => 1 + (i + 1) * 0.001))
    const m = windowReturn(long, 30)
    expect(m.coveredDays).toBe(30)
    expect(m.pct).toBeCloseTo((1.04 / 1.01 - 1) * 100, 5)
    expect(windowReturn([], 7).pct).toBeNull()
  })

  it('takes drawdown from the whole history, starting from an index of 1', () => {
    expect(maxDrawdownPct(pts([1.05, 1.0, 1.02]))).toBeCloseTo((1.0 / 1.05 - 1) * 100, 5)
    expect(maxDrawdownPct(pts([0.98, 0.97]))).toBeCloseTo(-3, 5)
    expect(maxDrawdownPct([])).toBeNull()
  })
})
