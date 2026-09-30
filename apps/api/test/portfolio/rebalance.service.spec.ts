import { RebalanceService } from '../../src/portfolio/rebalance.service'

const userId = '11111111-1111-4111-8111-111111111111'
const planId = '22222222-2222-4222-8222-222222222222'
const productA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const productB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function plan(state = 'redemptions_submitted') {
  return {
    id: planId, userId, state, targets: [{ productId: productA, targetBps: 5000 }, { productId: productB, targetBps: 5000 }],
    initialValueAtomic: '120000000', sellProceedsAtomic: '0', idempotencyKey: 'rebalance:test', buyIdempotencyKey: null,
    sellConfirmedAt: new Date(), buyConfirmedAt: null, createdAt: new Date(), updatedAt: new Date(),
  }
}

function sellLeg(redemptionState: string, actualAmountAtomic: string | null) {
  return {
    id: 'leg-sell', productId: productA, productName: 'Asset A', kind: 'sell', targetBps: 5000,
    requestedAmountAtomic: null, requestedQuantityAtomic: '20000000', actualAmountAtomic, state: 'submitted',
    redemptionId: '33333333-3333-4333-8333-333333333333', redemptionState,
    orderId: null, orderState: null, failureCode: null,
  }
}

function harness(leg: ReturnType<typeof sellLeg>, extraLegs: any[] = []) {
  const currentPlan = plan()
  const managerQuery = jest.fn().mockResolvedValue([])
  const db = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM app.rebalance_plans WHERE id=')) return [currentPlan]
      if (sql.includes('FROM app.rebalance_legs l')) return [leg, ...extraLegs]
      if (sql.includes('UPDATE app.rebalance_plans SET state=$2')) currentPlan.state = String(params?.[1])
      if (sql.includes("UPDATE app.rebalance_plans SET state='attention'")) currentPlan.state = 'attention'
      return []
    }),
    transaction: jest.fn(async (work: (manager: { query: typeof managerQuery }) => Promise<void>) => work({ query: managerQuery })),
  }
  const portfolio = {
    listPositions: jest.fn().mockResolvedValue([
      { productId: productA, outcomeKey: 'long', assetCode: 'AAA', assetDecimals: 6, quantityAtomicAmount: '60000000', unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', valuedAt: new Date(), source: 'demo-order-position' },
      { productId: productB, outcomeKey: 'long', assetCode: 'BBB', assetDecimals: 6, quantityAtomicAmount: '40000000', unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', valuedAt: new Date(), source: 'demo-order-position' },
    ]),
    requestRedemption: jest.fn(), cancelRedemption: jest.fn(),
  }
  const orders = { create: jest.fn() }
  return { service: new RebalanceService(db as any, portfolio as any, orders as any), db, managerQuery, portfolio, orders, currentPlan }
}

describe('RebalanceService settlement gate', () => {
  it('replays the same sell intent without creating a second redemption', async () => {
    let storedPlan: any = null
    const storedLegs: any[] = []
    const managerQuery = jest.fn(async (sql: string, params: any[]) => {
      if (sql.includes('INSERT INTO app.rebalance_plans')) {
        storedPlan = { ...plan('submitting_redemptions'), id: params[0], targets: JSON.parse(params[2]), initialValueAtomic: params[3], idempotencyKey: params[4] }
      }
      if (sql.includes('INSERT INTO app.rebalance_legs')) {
        storedLegs.push({ id: params[0], productId: params[2], productName: 'Asset A', kind: 'sell', targetBps: params[3],
          requestedAmountAtomic: null, requestedQuantityAtomic: params[4], actualAmountAtomic: null, state: 'planned',
          redemptionId: null, redemptionState: null, orderId: null, orderState: null, failureCode: null })
      }
      return []
    })
    const db = {
      transaction: jest.fn(async (work: (manager: { query: typeof managerQuery }) => Promise<void>) => work({ query: managerQuery })),
      query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('WHERE user_id=$1 AND idempotency_key=$2')) return storedPlan ? [storedPlan] : []
        if (sql.includes("state NOT IN ('completed','canceled')")) return storedPlan ? [{ id: storedPlan.id, state: storedPlan.state }] : []
        if (sql.includes('FROM app.rebalance_plans WHERE id=')) return storedPlan ? [storedPlan] : []
        if (sql.includes('FROM app.rebalance_legs l')) return storedLegs
        if (sql.includes('SET redemption_id=$2')) {
          Object.assign(storedLegs.find((leg) => leg.id === params?.[0]), { redemptionId: params?.[1], redemptionState: 'requested', state: 'submitted' })
        }
        if (sql.includes('UPDATE app.rebalance_plans SET state=$2')) storedPlan.state = params?.[1]
        return []
      }),
    }
    const portfolio = {
      listPositions: jest.fn().mockResolvedValue([
        { productId: productA, outcomeKey: 'long', assetCode: 'AAA', assetDecimals: 6, quantityAtomicAmount: '60000000', unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', valuedAt: new Date(), source: 'demo-order-position' },
        { productId: productB, outcomeKey: 'long', assetCode: 'BBB', assetDecimals: 6, quantityAtomicAmount: '40000000', unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', valuedAt: new Date(), source: 'demo-order-position' },
      ]),
      requestRedemption: jest.fn().mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' }),
    }
    const service = new RebalanceService(db as any, portfolio as any, { create: jest.fn() } as any)
    const input = { sellConfirmed: true as const, targets: [{ productId: productA, targetBps: 4000 }, { productId: productB, targetBps: 6000 }] }

    await service.create(userId, input, 'rebalance:test-key', 'request-1')
    await service.create(userId, input, 'rebalance:test-key', 'request-2')

    expect(portfolio.requestRedemption).toHaveBeenCalledTimes(1)
    expect(managerQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO app.rebalance_plans'))).toHaveLength(1)
  })

  it('does not calculate or submit buys while a redemption is still open', async () => {
    const test = harness(sellLeg('requested', null))

    await test.service.refresh(planId, userId)

    expect(test.portfolio.listPositions).not.toHaveBeenCalled()
    expect(test.orders.create).not.toHaveBeenCalled()
    expect(test.db.transaction).not.toHaveBeenCalled()
  })

  it('treats a completed redemption without an actual receipt as manual attention', async () => {
    const test = harness(sellLeg('completed', null))

    await test.service.refresh(planId, userId)

    expect(test.portfolio.listPositions).not.toHaveBeenCalled()
    expect(test.currentPlan.state).toBe('attention')
  })

  it('uses actual net proceeds to build buy legs and still does not submit orders before confirmation', async () => {
    const test = harness(sellLeg('completed', '20000000'))

    await test.service.refresh(planId, userId)

    expect(test.portfolio.listPositions).toHaveBeenCalledTimes(1)
    expect(test.orders.create).not.toHaveBeenCalled()
    const buyInsert = test.managerQuery.mock.calls.find(([sql]) => String(sql).includes("kind,target_bps,requested_amount_atomic"))
    expect(buyInsert?.[1]).toEqual(expect.arrayContaining([productB, 5000, '20000000']))
  })

  it('rejects buy confirmation before actual proceeds are posted', async () => {
    const test = harness(sellLeg('requested', null))

    await expect(test.service.confirmBuys(planId, userId, 'buy-confirmation-1', 'request-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REBALANCE_NOT_READY_FOR_BUYS' }),
    })
    expect(test.orders.create).not.toHaveBeenCalled()
  })

  it('freezes the displayed buy proposal until the second confirmation', async () => {
    const buyLeg = {
      id: 'leg-buy', productId: productB, productName: 'Asset B', kind: 'buy', targetBps: 5000,
      requestedAmountAtomic: '20000000', requestedQuantityAtomic: null, actualAmountAtomic: null, state: 'planned',
      redemptionId: null, redemptionState: null, orderId: null, orderState: null, failureCode: null,
    }
    const test = harness(sellLeg('completed', '20000000'), [buyLeg])
    test.currentPlan.state = 'awaiting_buy_confirmation'

    await test.service.refresh(planId, userId)

    expect(test.portfolio.listPositions).not.toHaveBeenCalled()
    expect(test.db.transaction).not.toHaveBeenCalled()
  })
})
