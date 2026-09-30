import { YieldService } from '../../src/yield/yield.service'

describe('YieldService expected schedule', () => {
  const service = (rows: unknown[]) => new YieldService(
    { query: jest.fn().mockResolvedValue(rows) } as any,
    {} as any,
    {} as any,
    { get: jest.fn() } as any,
  )

  it('uses the product calendar, record date and fixed annual rate', async () => {
    const yields = service([{
      positionId: 'position-1', productId: 'product-1', productName: 'Monthly asset',
      openedAt: new Date('2026-01-01T12:00:00.000Z'), costAtomicAmount: '120000000',
      yieldTerms: { rateType: 'fixed', annualRateBps: 1200, payoutFrequency: 'monthly', scheduleMode: 'product_calendar',
        firstExpectedPaymentDate: '2026-10-31', recordDateOffsetDays: 5, scheduleTimezone: 'Asia/Shanghai' },
    }])

    const schedule = await yields.listExpectedSchedule('user-1', 2, new Date('2026-09-27T05:00:00.000Z'))

    expect(schedule).toHaveLength(1)
    expect(schedule[0]).toMatchObject({
      paymentDate: '2026-10-31', recordDate: '2026-10-26', periodStart: '2026-09-30',
      expectedAtomicAmount: '1200000', estimated: true, timezone: 'Asia/Shanghai',
    })
  })

  it('skips a payment when the position was opened after its record date, then includes the next cycle', async () => {
    const yields = service([{
      positionId: 'position-2', productId: 'product-2', productName: 'Record date asset',
      openedAt: new Date('2026-10-28T00:00:00.000Z'), costAtomicAmount: '100000000',
      yieldTerms: { rateType: 'fixed', annualRateBps: 600, payoutFrequency: 'monthly', scheduleMode: 'product_calendar',
        firstExpectedPaymentDate: '2026-10-31', recordDateOffsetDays: 5, scheduleTimezone: 'UTC' },
    }])

    const schedule = await yields.listExpectedSchedule('user-1', 4, new Date('2026-09-27T00:00:00.000Z'))

    expect(schedule.map((event) => event.paymentDate)).toEqual(['2026-11-30', '2026-12-31'])
  })

  it('rejects normalized impossible calendar dates instead of silently moving them', async () => {
    const yields = service([{
      positionId: 'position-3', productId: 'product-3', productName: 'Invalid calendar',
      openedAt: new Date('2026-01-01T00:00:00.000Z'), costAtomicAmount: '100000000',
      yieldTerms: { payoutFrequency: 'monthly', scheduleMode: 'product_calendar', firstExpectedPaymentDate: '2026-02-31' },
    }])

    await expect(yields.listExpectedSchedule('user-1', 3, new Date('2026-01-01T00:00:00.000Z'))).resolves.toEqual([])
  })
})
