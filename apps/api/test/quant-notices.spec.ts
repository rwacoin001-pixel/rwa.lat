import { dailyNotice, redemptionNotice, redemptionRejectedNotice, usdt } from '../src/quant/quant-notices'

describe('quant notices', () => {
  const product = { slug: 'koala', name: '考拉量化' }
  it('formats atomic USDT with grouping, rounding and sign', () => {
    expect(usdt(19_200_000n)).toBe('19.20')
    expect(usdt(1_234_567_891n)).toBe('1,234.57')
    expect(usdt(-5_000_000n)).toBe('−5.00')
  })
  it('writes the day result in Chinese for zh users, with the paid amount', () => {
    const n = dailyNotice({ userId: 'u', locale: 'zh-CN', product, tradeDate: '2026-10-24', net: 19_200_000n, paid: 19_200_000n })
    expect(n.kind).toBe('quant.settled')
    expect(n.title).toBe('考拉量化 10月24日结算：+19.20 USDT')
    expect(n.body).toContain('19.20 USDT')
    expect(n.payload).toMatchObject({ tradeDate: '2026-10-24', netAtomic: '19200000' })
  })
  it('says a loss plainly and falls back to English', () => {
    const n = dailyNotice({ userId: 'u', locale: 'fr', product, tradeDate: '2026-10-24', net: -3_000_000n, paid: 0n })
    expect(n.title).toContain('−3.00 USDT')
    expect(n.body).toMatch(/loss/)
  })
  it('names the redemption payout and fee', () => {
    const n = redemptionNotice({ userId: 'u', locale: 'zh', product, tradeDate: '2026-10-24', orderId: 'o', payout: 99_500_000n, fee: 500_000n })
    expect(n.title).toContain('99.50 USDT')
    expect(n.body).toContain('0.50 USDT')
    expect(redemptionRejectedNotice({ userId: 'u', locale: 'en', product, orderId: 'o' }).kind).toBe('quant.redemption.rejected')
  })
})
