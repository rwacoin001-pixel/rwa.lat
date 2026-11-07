import { BadGatewayException, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { AdminPermissionGuard, ADMIN_REQUIRED_PERMISSIONS } from '../src/admin-permission.guard'
import { AdminTodayController } from '../src/admin-today.controller'
import { AdminTodayService, DEAD_JOB_QUEUES, TODAY_CACHE_MS, TODAY_PERMISSIONS, oldestIso, quantDay, sumAtomic } from '../src/admin-today.service'

const ALL_PERMISSIONS = [...new Set(Object.values(TODAY_PERMISSIONS).flat())]
// 2026-11-03 10:00 Asia/Singapore (UTC+8), before the 15:00 cutoff.
const NOW = Date.parse('2026-11-03T02:00:00Z')

function upstream() {
  const core: Record<string, unknown> = {
    '/kyc': [
      { id: 'k1', state: 'submitted', submittedAt: '2026-11-02T08:00:00Z', createdAt: '2026-11-01T00:00:00Z' },
      { id: 'k2', state: 'submitted', submittedAt: '2026-11-01T09:30:00Z' },
      { id: 'k3', state: 'approved', submittedAt: '2026-10-01T00:00:00Z' },
    ],
    '/tickets': [
      { id: 't1', status: 'open', updatedAt: '2026-11-03T01:00:00Z' },
      { id: 't2', status: 'waiting_user', updatedAt: '2026-10-01T00:00:00Z' },
    ],
    '/mail/unread-count': { count: 4 },
    '/account-closures': [{ id: 'c1', state: 'requested', createdAt: '2026-10-30T00:00:00Z' }, { id: 'c2', state: 'closed', createdAt: '2026-10-01T00:00:00Z' }],
    '/ledger/adjustments?requested': { adjustments: [{ id: 'a1', state: 'requested', atomicAmount: '1000', assetCode: 'USDT', requestedAt: '2026-11-02T00:00:00Z' }] },
    '/ledger/adjustments?approved': { adjustments: [{ id: 'a2', state: 'approved', atomicAmount: '500', assetCode: 'USDT', requestedAt: '2026-10-31T00:00:00Z' }] },
    '/approvals': [{ id: 'p1', state: 'requested', createdAt: '2026-11-01T00:00:00Z' }],
    '/referral/team/batches': { items: [
      { id: 'b1', status: 'pending', totalAtomic: '7000000', createdAt: '2026-11-01T00:00:00Z' },
      { id: 'b2', status: 'approved', totalAtomic: '3000000', createdAt: '2026-10-01T00:00:00Z' },
      { id: 'b3', status: 'paid', totalAtomic: '9', createdAt: '2026-09-01T00:00:00Z' },
    ] },
    '/job-queue/jobs/dead': [{ id: 'j1', createdAt: '2026-11-02T03:00:00Z' }],
    '/job-queue/callbacks/unprocessed': [{ id: 'cb1', receivedAt: '2026-11-01T03:00:00Z' }, { id: 'cb2', receivedAt: '2026-11-03T00:00:00Z' }],
    '/funds/summary': {
      timezone: 'Asia/Shanghai', asset: { code: 'USDT', decimals: 6 },
      today: { deposits: { count: 3, atomic: '9000000' }, withdrawals: { count: 1, atomic: '2500000', feeAtomic: '1000000' } },
      pending: { review: { count: 2, atomic: '50000000' } },
      hotWallet: { address: 'T123', usdtAtomic: '40000000', trxSun: '500000000', checkedAt: '2026-11-03T01:59:00Z', error: null },
      series: Array.from({ length: 7 }, (_, index) => ({ day: `2026-10-2${index + 1}`, depositsAtomic: String((index + 1) * 100), withdrawalsAtomic: '50' })),
    },
    '/activity/summary': { today: { activeUsers: 41, registrations: 5 } },
    '/ledger/reconciliations': { runs: [
      { id: 'r-new', network: 'tron', assetCode: 'USDT', state: 'differences_found', differenceAtomicAmount: '-10', createdAt: '2026-11-03T00:00:00Z' },
      { id: 'r-old', network: 'tron', assetCode: 'USDT', state: 'matched', createdAt: '2026-11-02T00:00:00Z' },
    ] },
  }
  const coreGet = jest.fn(async (_actor: string, path: string, query: Record<string, unknown> = {}) => {
    const key = path === '/ledger/adjustments' ? `${path}?${query.state}` : path
    if (!(key in core)) throw new Error(`unexpected ${key}`)
    return core[key]
  })
  const wallet = {
    withdrawalReviews: jest.fn(async () => [
      { id: 'w1', state: 'risk_review', assetCode: 'USDT', atomicAmount: '30000000', requestedAt: '2026-11-02T12:00:00Z' },
      { id: 'w2', state: 'risk_review', assetCode: 'USDT', atomicAmount: '20000000', requestedAt: '2026-11-01T12:00:00Z' },
    ]),
    withdrawals: jest.fn(async () => [
      { id: 'w3', state: 'approved', assetCode: 'USDT', atomicAmount: '5000000', requestedAt: '2026-10-30T00:00:00Z', approvedAt: '2026-11-02T00:00:00Z' },
    ]),
    fundsStatus: jest.fn(async () => ({ current: { enabled: false, reason: 'maintenance', updatedAt: '2026-11-03T00:30:00Z' }, pending: [{ id: 'x' }] })),
  }
  const quant = {
    products: jest.fn(async () => [
      { slug: 'koala-flagship', status: 'active', timezone: 'Asia/Singapore', cutoff_time: '15:00', last_settled_date: '2026-11-01', nextTradeDate: '2026-11-02', totals: { principalAtomic: '120000000' } },
      { slug: 'second', status: 'pilot', totals: { principalAtomic: '30000000' } },
    ]),
    settlements: jest.fn(async () => [{ id: 's1', tradeDate: '2026-11-02', status: 'draft' }, { id: 's0', tradeDate: '2026-11-02', status: 'voided' }]),
  }
  const community = {
    stats: jest.fn(async () => ({ queuePending: 6 })),
    reports: jest.fn(async () => ({ items: [{ id: 'cr1', state: 'open', createdAt: '2026-11-02T05:00:00Z' }] })),
  }
  const prediction = { monitor: jest.fn().mockResolvedValue({ count: 0, oldestAt: null, workerHealthy: true, auditHealthy: true, reconciliationMismatches: 0, failed: 0, review: 0 }) }
  const service = new AdminTodayService({ get: coreGet } as never, wallet as never, quant as never, community as never, prediction as never)
  service.now = () => NOW
  return { service, core, coreGet, wallet, quant, community, prediction }
}

describe('Admin console today', () => {
  it('counts each queue, finds the oldest wait and sums money', async () => {
    const { service, coreGet } = upstream()
    const result = await service.today({ id: 'admin-1', permissions: ALL_PERMISSIONS })
    const q = result.queues
    expect(q.withdrawalReview).toEqual({ count: 2, oldestAt: '2026-11-01T12:00:00.000Z', amountAtomic: '50000000', assetCode: 'USDT', status: 'ok' })
    expect(q.withdrawalExecute).toEqual({ count: 1, oldestAt: '2026-11-02T00:00:00.000Z', amountAtomic: '5000000', assetCode: 'USDT', status: 'ok' })
    expect(q.kyc).toEqual({ count: 2, oldestAt: '2026-11-01T09:30:00.000Z', status: 'ok' })
    expect(q.communityQueue).toEqual({ count: 6, oldestAt: null, status: 'ok' })
    expect(q.communityReports).toMatchObject({ count: 1, oldestAt: '2026-11-02T05:00:00.000Z', status: 'ok' })
    expect(q.supportTickets).toMatchObject({ count: 1, status: 'ok' })
    expect(q.mail).toEqual({ count: 4, oldestAt: null, status: 'ok' })
    expect(q.accountClosures).toMatchObject({ count: 1, oldestAt: '2026-10-30T00:00:00.000Z' })
    expect(q.ledgerAdjustments).toEqual({ count: 2, oldestAt: '2026-10-31T00:00:00.000Z', amountAtomic: '1500', assetCode: 'USDT', status: 'ok' })
    expect(q.approvals).toMatchObject({ count: 1, status: 'ok' })
    expect(q.teamBatches).toEqual({ count: 2, oldestAt: '2026-10-01T00:00:00.000Z', amountAtomic: '10000000', assetCode: 'USDT', status: 'ok' })
    expect(q.deadJobs).toEqual({ count: 3, oldestAt: '2026-11-01T03:00:00.000Z', status: 'ok' })
    expect(q.predictionSettlements).toMatchObject({ status: 'ok', count: 0, workerHealthy: true, auditHealthy: true })
    expect(q.quantSettlement).toEqual({
      count: 1, oldestAt: '2026-11-02T16:00:00.000Z', status: 'ok', productSlug: 'koala-flagship', tradeDate: '2026-11-02', state: 'draft',
      timezone: 'Asia/Singapore', cutoffAt: '2026-11-03T07:00:00.000Z', overdue: false,
    })
    expect(coreGet).toHaveBeenCalledWith('admin-1', '/job-queue/jobs/dead', { queueName: DEAD_JOB_QUEUES[0], limit: 200 })
    expect(coreGet).toHaveBeenCalledWith('admin-1', '/funds/summary', { days: 7 })

    expect(result.today).toMatchObject({
      assetCode: 'USDT', deposits: { count: 3, amountAtomic: '9000000' }, withdrawals: { count: 1, amountAtomic: '2500000' },
      netAtomic: '6500000', activeUsers: 41, registrations: 5, quantPrincipalAtomic: '150000000',
      sources: { funds: 'ok', activity: 'ok', quant: 'ok' },
    })
    expect(result.today.series).toHaveLength(7)
    expect(result.today.series[0]).toEqual({ day: '2026-10-21', depositsAtomic: '100', withdrawalsAtomic: '50', netAtomic: '50' })

    expect(result.alerts.map((alert) => alert.kind).sort()).toEqual(['deadJobs', 'hotWalletLow', 'reconciliationMismatch', 'withdrawalExecutionPaused'])
    expect(result.alerts.find((alert) => alert.kind === 'hotWalletLow')?.detail).toMatchObject({ shortUsdt: true, shortTrx: false })
    expect(result.alerts.find((alert) => alert.kind === 'reconciliationMismatch')?.detail).toMatchObject({ runId: 'r-new' })
    expect(result.alertChecks).toEqual({ withdrawalExecution: 'ok', hotWallet: 'ok', reconciliation: 'ok', deadJobs: 'ok' })
  })

  it('marks items forbidden when the admin lacks their permission and never calls their upstream', async () => {
    const { service, wallet, quant, coreGet } = upstream()
    const permissions = ALL_PERMISSIONS.filter((permission) => !['wallet.withdrawals.manage', 'quant.operations.manage', 'mail.read', 'polymarket.manage'].includes(permission))
    const result = await service.today({ id: 'admin-2', permissions })
    expect(result.queues.withdrawalReview).toEqual({ count: 0, oldestAt: null, status: 'forbidden' })
    expect(result.queues.withdrawalExecute.status).toBe('forbidden')
    expect(result.queues.quantSettlement).toMatchObject({ status: 'forbidden', count: 0, state: 'none' })
    expect(result.queues.mail.status).toBe('forbidden')
    expect(result.queues.predictionSettlements.status).toBe('forbidden')
    expect(result.today.quantPrincipalAtomic).toBeNull()
    expect(result.today.sources.quant).toBe('forbidden')
    expect(result.queues.kyc.status).toBe('ok')
    expect(wallet.withdrawalReviews).not.toHaveBeenCalled()
    expect(wallet.withdrawals).not.toHaveBeenCalled()
    expect(quant.products).not.toHaveBeenCalled()
    expect(coreGet.mock.calls.map((call) => call[1])).not.toContain('/mail/unread-count')
  })

  it('treats an upstream 403 as forbidden', async () => {
    const { service, community } = upstream()
    community.stats.mockRejectedValueOnce(new BadGatewayException({ code: 'CORE_COMMUNITY_OPS_FAILED', upstreamStatus: 403 }))
    community.reports.mockRejectedValueOnce(new ForbiddenException())
    const result = await service.today({ id: 'admin-3', permissions: ALL_PERMISSIONS })
    expect(result.queues.communityQueue.status).toBe('forbidden')
    expect(result.queues.communityReports.status).toBe('forbidden')
  })

  it('confines one failing upstream to its own item', async () => {
    const { service, core, wallet } = upstream()
    wallet.withdrawalReviews.mockRejectedValueOnce(new BadGatewayException({ code: 'CORE_WALLET_OPS_UNAVAILABLE' }))
    delete core['/job-queue/callbacks/unprocessed']
    const result = await service.today({ id: 'admin-4', permissions: ALL_PERMISSIONS })
    expect(result.queues.withdrawalReview).toEqual({ count: 0, oldestAt: null, status: 'error' })
    // Dead jobs needs both reads; one failing marks the item and its alert check, without inventing a count.
    expect(result.queues.deadJobs.status).toBe('error')
    expect(result.alertChecks.deadJobs).toBe('error')
    expect(result.alerts.some((alert) => alert.kind === 'deadJobs')).toBe(false)
    expect(result.queues.withdrawalExecute.status).toBe('ok')
    expect(result.queues.kyc.count).toBe(2)
    expect(result.today.sources.funds).toBe('ok')
  })

  it('keeps the queue tiles when the funds summary fails', async () => {
    const { service, core } = upstream()
    delete core['/funds/summary']
    const result = await service.today({ id: 'admin-5', permissions: ALL_PERMISSIONS })
    expect(result.today).toMatchObject({ deposits: null, withdrawals: null, netAtomic: null, series: [], activeUsers: 41, sources: { funds: 'error' } })
    expect(result.alertChecks.hotWallet).toBe('error')
    expect(result.alerts.some((alert) => alert.kind.startsWith('hotWallet'))).toBe(false)
    expect(result.queues.withdrawalReview.status).toBe('ok')
  })

  it('caches per admin for 15 seconds', async () => {
    const { service, wallet } = upstream()
    let now = NOW
    service.now = () => now
    const first = await service.today({ id: 'admin-6', permissions: ALL_PERMISSIONS })
    now += TODAY_CACHE_MS - 1
    expect(await service.today({ id: 'admin-6', permissions: ALL_PERMISSIONS })).toBe(first)
    expect(wallet.withdrawalReviews).toHaveBeenCalledTimes(1)
    await service.today({ id: 'admin-7', permissions: ALL_PERMISSIONS })
    expect(wallet.withdrawalReviews).toHaveBeenCalledTimes(2)
    now += 1
    const refreshed = await service.today({ id: 'admin-6', permissions: ALL_PERMISSIONS })
    expect(refreshed).not.toBe(first)
    expect(wallet.withdrawalReviews).toHaveBeenCalledTimes(3)
  })

  it('does not serve a cached result across a permission change', async () => {
    const { service, wallet } = upstream()
    await service.today({ id: 'admin-8', permissions: ALL_PERMISSIONS })
    const reduced = await service.today({ id: 'admin-8', permissions: ALL_PERMISSIONS.filter((permission) => permission !== 'wallet.withdrawals.manage') })
    expect(reduced.queues.withdrawalReview.status).toBe('forbidden')
    expect(wallet.withdrawalReviews).toHaveBeenCalledTimes(1)
  })

  it('shares one in-flight build between concurrent requests', async () => {
    const { service, wallet } = upstream()
    const [a, b] = await Promise.all([
      service.today({ id: 'admin-9', permissions: ALL_PERMISSIONS }),
      service.today({ id: 'admin-9', permissions: ALL_PERMISSIONS }),
    ])
    expect(a).toBe(b)
    expect(wallet.withdrawalReviews).toHaveBeenCalledTimes(1)
  })
})

describe('Today quant settlement day', () => {
  const product = { slug: 'koala', status: 'active', timezone: 'Asia/Singapore', cutoff_time: '15:00', last_settled_date: '2026-11-01', nextTradeDate: '2026-11-02' }
  it('is due for yesterday and overdue after the 15:00 Singapore cutoff', () => {
    expect(quantDay(product, Date.parse('2026-11-03T06:59:00Z'))).toMatchObject({ due: true, tradeDate: '2026-11-02', overdue: false, daysBehind: 1 })
    expect(quantDay(product, Date.parse('2026-11-03T07:00:00Z'))).toMatchObject({ due: true, overdue: true, cutoffAt: '2026-11-03T07:00:00.000Z' })
  })
  it('is not due once yesterday is posted, or before the day has ended', () => {
    expect(quantDay({ ...product, last_settled_date: '2026-11-02', nextTradeDate: '2026-11-03' }, NOW)).toMatchObject({ due: false, overdue: false, tradeDate: null })
    // 23:30 UTC on 11-02 is already 07:30 on 11-03 in Singapore.
    expect(quantDay(product, Date.parse('2026-11-02T15:59:00Z'))).toMatchObject({ due: false })
    expect(quantDay(product, Date.parse('2026-11-02T16:00:00Z'))).toMatchObject({ due: true })
  })
  it('counts every day still behind', () => {
    expect(quantDay({ ...product, nextTradeDate: '2026-10-30' }, NOW)).toMatchObject({ daysBehind: 4, dueSince: '2026-10-30T16:00:00.000Z' })
  })
  it('reports posted when yesterday is already settled', async () => {
    const { service, quant } = upstream()
    quant.products.mockResolvedValueOnce([{ ...product, last_settled_date: '2026-11-02', nextTradeDate: '2026-11-03', totals: { principalAtomic: '1' } }])
    const result = await service.today({ id: 'q1', permissions: ALL_PERMISSIONS })
    expect(result.queues.quantSettlement).toMatchObject({ count: 0, state: 'posted', tradeDate: '2026-11-02', status: 'ok' })
    expect(quant.settlements).not.toHaveBeenCalled()
  })
  it('reports none when the due day has no entry, and error when the settlement list fails', async () => {
    const { service, quant } = upstream()
    quant.settlements.mockResolvedValueOnce([])
    expect((await service.today({ id: 'q2', permissions: ALL_PERMISSIONS })).queues.quantSettlement).toMatchObject({ count: 1, state: 'none', status: 'ok' })
    quant.settlements.mockRejectedValueOnce(new Error('down'))
    expect((await service.today({ id: 'q3', permissions: ALL_PERMISSIONS })).queues.quantSettlement).toMatchObject({ count: 1, status: 'error' })
  })
})

describe('Today helpers', () => {
  it('finds the oldest valid timestamp and ignores junk', () => {
    expect(oldestIso(['2026-11-02T00:00:00Z', null, 'not a date', new Date('2026-11-01T00:00:00Z'), undefined])).toBe('2026-11-01T00:00:00.000Z')
    expect(oldestIso([])).toBeNull()
  })
  it('sums atomic amounts exactly beyond Number precision', () => {
    expect(sumAtomic(['9007199254740993', '1', 'x', null])).toBe('9007199254740994')
  })
})

describe('Today route', () => {
  it('lives at admin/console/today behind the permission guard with no route-wide permission', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminTodayController)).toBe('admin/console')
    expect(Reflect.getMetadata(PATH_METADATA, AdminTodayController.prototype.today)).toBe('today')
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminTodayController)).toContain(AdminPermissionGuard)
    expect(new Reflector().get(ADMIN_REQUIRED_PERMISSIONS, AdminTodayController.prototype.today)).toBeUndefined()
  })
  it('passes the session administrator to the service', async () => {
    const today = jest.fn().mockResolvedValue({ ok: true })
    const controller = new AdminTodayController({ today } as never)
    await controller.today({ admin: { id: 'a', permissions: ['mail.read'] } } as never)
    expect(today).toHaveBeenCalledWith({ id: 'a', permissions: ['mail.read'] })
  })
})
