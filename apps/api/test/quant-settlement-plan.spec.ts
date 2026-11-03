import { parse18 } from '../src/basket/basket.decimals'
import { ONE, applyDay, dailyManagementRate, stepIndex, type QuantLot } from '../src/quant/quant.math'
import { planSettlementDay, roundDecimal, trimDecimal } from '../src/quant/quant-settlement.plan'

const usdt = (value: number) => BigInt(Math.round(value * 1e6))
const lot = (id: string, userId: string, principal: bigint, effectiveDate = '2026-10-01'): QuantLot => ({ id, userId, principal, effectiveDate })
const product = { mgmtFeeBps: 150, perfFeeBps: 2000, indexValue: '1', hwmIndex: '1', redemptionFeeTiers: [{ maxDays: 7, bps: 50 }, { maxDays: 30, bps: 10 }] }
const lots = [lot('a', 'u1', usdt(1000)), lot('b', 'u1', usdt(250.5), '2026-10-20'), lot('c', 'u2', usdt(77.123456))]

describe('quant settlement plan', () => {
  it('a gain day pays profits, keeps principal and matches the per-lot math', () => {
    const plan = planSettlementDay({ tradeDate: '2026-10-25', grossReturnPct: '0.8', product, lots, requests: [] })
    const mgmt = dailyManagementRate(150)
    const step = stepIndex({ grossReturn: parse18('0.8') / 100n, mgmtDaily: mgmt, perfFeeBps: 2000, index: ONE, hwm: ONE })
    const days = lots.map((l) => applyDay(l, parse18('0.8') / 100n, mgmt, step.perfFeeRate))
    expect(plan.step).toEqual(step)
    expect(plan.totals.usersCount).toBe(2)
    expect(plan.totals.principal).toBe(usdt(1000) + usdt(250.5) + usdt(77.123456))
    expect(plan.totals.paid).toBe(days.reduce((t, d) => t + d.paid, 0n))
    expect(plan.totals.mgmtFee).toBe(days.reduce((t, d) => t + d.mgmtFee, 0n))
    expect(plan.totals.perfFee).toBeGreaterThan(0n)
    expect(plan.totals.gross - plan.totals.mgmtFee - plan.totals.perfFee).toBe(plan.totals.paid)
    expect(plan.totals.principalLoss).toBe(0n)
    for (const l of lots) expect(plan.principalAfter.get(l.id)).toBe(l.principal)
    expect(plan.step.indexAfter).toBeGreaterThan(ONE)
  })

  it('a loss day reduces principal and pays nothing', () => {
    const plan = planSettlementDay({ tradeDate: '2026-10-25', grossReturnPct: '-1.25', product, lots, requests: [] })
    expect(plan.totals.paid).toBe(0n)
    expect(plan.totals.perfFee).toBe(0n)
    expect(plan.totals.principalLoss).toBe(-plan.users.reduce((t, u) => t + u.net, 0n))
    const after = [...plan.principalAfter.values()].reduce((t, p) => t + p, 0n)
    expect(after).toBe(plan.totals.principal - plan.totals.principalLoss)
    expect(plan.netReturnPct.startsWith('-1.25')).toBe(true)
    expect(plan.step.hwmAfter).toBe(ONE)
  })

  it('a redemption takes what is left after the day, with the holding-period fee', () => {
    const plan = planSettlementDay({ tradeDate: '2026-10-25', grossReturnPct: '-1', product, lots, requests: [{ orderId: 'o1', userId: 'u1', amount: null }, { orderId: 'o2', userId: 'u2', amount: usdt(10) }] })
    const u1After = plan.lotDays.filter((d) => d.userId === 'u1').reduce((t, d) => t + d.principalAfter, 0n)
    const [all, part] = plan.redemption.results
    expect(all.principal).toBe(u1After)
    expect(plan.principalAfter.get('a')).toBe(0n)
    expect(plan.principalAfter.get('b')).toBe(0n)
    expect(part.principal).toBe(usdt(10))
    expect(plan.principalAfter.get('c')).toBe(plan.lotDays[2].principalAfter - usdt(10))
    // lot a held 24 days (10 bps), lot b held 5 days (50 bps), lot c 24 days (10 bps)
    const ceil = (a: bigint, bps: bigint) => (a * bps + 9_999n) / 10_000n
    expect(all.fee).toBe(ceil(plan.lotDays[0].principalAfter, 10n) + ceil(plan.lotDays[1].principalAfter, 50n))
    expect(part.fee).toBe(ceil(usdt(10), 10n))
    expect(plan.totals.redemptionPrincipal).toBe(all.principal + part.principal)
    expect(plan.totals.redemptionFee).toBe(all.fee + part.fee)
  })

  it('an empty day still advances the index', () => {
    const plan = planSettlementDay({ tradeDate: '2026-10-25', grossReturnPct: '0.4', product: { ...product, indexValue: '1.02', hwmIndex: '1.03' }, lots: [], requests: [] })
    expect(plan.totals.usersCount).toBe(0)
    expect(plan.totals.principal).toBe(0n)
    expect(plan.indexBefore).toBe(parse18('1.02'))
    expect(plan.step.indexAfter).toBeGreaterThan(parse18('1.02'))
  })

  it('rounds the net return like Postgres numeric(14,8)', () => {
    expect(roundDecimal(parse18('0.123456785'), 8)).toBe('0.12345679')
    expect(roundDecimal(parse18('-0.123456785'), 8)).toBe('-0.12345679')
    expect(roundDecimal(parse18('0.123456784999'), 8)).toBe('0.12345678')
    expect(roundDecimal(parse18('-0.000000001'), 8)).toBe('0')
    expect(roundDecimal(parse18('1.5'), 8)).toBe('1.5')
    expect(trimDecimal('2.000')).toBe('2')
  })
})
