import { ONE, aggregateByUser, applyDay, dailyManagementRate, dayDeltas, planRedemptions, redemptionFeeBps, stepIndex, type QuantLot } from '../src/quant/quant.math'

const pct = (value: string) => (BigInt(Math.round(Number(value) * 1e6)) * ONE) / 1_000_000n / 100n
const usdt = (value: number) => BigInt(Math.round(value * 1e6))
const lot = (id: string, userId: string, principal: bigint, effectiveDate = '2026-10-01'): QuantLot => ({ id, userId, principal, effectiveDate })

describe('quant math', () => {
  const mgmt = dailyManagementRate(150)

  it('charges performance fee only above the high-water mark', () => {
    const step = stepIndex({ grossReturn: pct('0.50'), mgmtDaily: mgmt, perfFeeBps: 2000, index: ONE, hwm: ONE })
    expect(step.indexAfter).toBeGreaterThan(ONE)
    expect(step.perfFeeRate).toBeGreaterThan(0n)
    const afterLoss = stepIndex({ grossReturn: pct('-1.00'), mgmtDaily: mgmt, perfFeeBps: 2000, index: step.indexAfter, hwm: step.hwmAfter })
    expect(afterLoss.hwmAfter).toBe(step.hwmAfter)
    const recovery = stepIndex({ grossReturn: pct('0.30'), mgmtDaily: mgmt, perfFeeBps: 2000, index: afterLoss.indexAfter, hwm: afterLoss.hwmAfter })
    expect(recovery.indexAfter).toBeLessThan(recovery.hwmAfter)
    expect(recovery.perfFeeRate).toBe(0n)
  })

  it('pays a profit out and keeps the principal; a loss reduces the principal', () => {
    const step = stepIndex({ grossReturn: pct('1.00'), mgmtDaily: mgmt, perfFeeBps: 2000, index: ONE, hwm: ONE })
    const win = applyDay(lot('a', 'u1', usdt(1000)), pct('1.00'), mgmt, step.perfFeeRate)
    expect(win.gross).toBe(usdt(10))
    expect(win.net).toBe(win.gross - win.mgmtFee - win.perfFee)
    expect(win.principalAfter).toBe(usdt(1000))
    expect(win.paid).toBe(win.net)
    const lossStep = stepIndex({ grossReturn: pct('-2.00'), mgmtDaily: mgmt, perfFeeBps: 2000, index: ONE, hwm: ONE })
    const loss = applyDay(lot('b', 'u1', usdt(1000)), pct('-2.00'), mgmt, lossStep.perfFeeRate)
    expect(loss.gross).toBe(-usdt(20))
    expect(loss.perfFee).toBe(0n)
    expect(loss.principalAfter).toBe(usdt(1000) + loss.net)
    expect(loss.paid).toBe(0n)
  })

  it('never lets fees exceed the profit and balances the ledger deltas to zero', () => {
    for (const g of ['-5', '-0.2', '0', '0.003', '0.2', '3']) {
      const step = stepIndex({ grossReturn: pct(g), mgmtDaily: mgmt, perfFeeBps: 2000, index: ONE, hwm: ONE })
      const days = [applyDay(lot('a', 'u1', usdt(123.456789)), pct(g), mgmt, step.perfFeeRate), applyDay(lot('b', 'u1', usdt(7)), pct(g), mgmt, step.perfFeeRate)]
      const [user] = aggregateByUser(days)
      const d = dayDeltas(user)
      expect(d.user + d.pool + d.fee + d.treasury).toBe(0n)
      expect(d.user).toBeGreaterThanOrEqual(0n)
      expect(d.pool).toBeLessThanOrEqual(0n)
      expect(d.fee).toBeGreaterThanOrEqual(0n)
      expect(user.principalLoss).toBe(-d.pool)
    }
  })

  it('redeems oldest lots first, prices the fee by holding period and caps at what is held', () => {
    const tiers = [{ maxDays: 7, bps: 150 }, { maxDays: 30, bps: 50 }]
    expect(redemptionFeeBps(tiers, 3)).toBe(150)
    expect(redemptionFeeBps(tiers, 7)).toBe(50)
    expect(redemptionFeeBps(tiers, 30)).toBe(0)
    const lots = [lot('old', 'u1', usdt(100), '2026-08-01'), lot('new', 'u1', usdt(100), '2026-10-17')]
    const { results, lotsAfter } = planRedemptions(lots, [{ orderId: 'o1', userId: 'u1', amount: usdt(150) }, { orderId: 'o2', userId: 'u1', amount: null }], '2026-10-19', tiers)
    expect(results[0].principal).toBe(usdt(150))
    expect(results[0].fee).toBe((usdt(50) * 150n) / 10_000n)
    expect(results[0].payout).toBe(results[0].principal - results[0].fee)
    expect(results[1].principal).toBe(usdt(50))
    expect([...lotsAfter.values()].every((v) => v === 0n)).toBe(true)
  })
})
