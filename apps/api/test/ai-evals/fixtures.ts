import { AiReadToolsService } from '../../src/ai/ai-read-tools.service'

export const OWNER = '11111111-1111-4111-8111-111111111111'
export const OTHER = '22222222-2222-4222-8222-222222222222'
export const RECORD = '33333333-3333-4333-8333-333333333333'
export const SLUG = 'koala'
const mock = (value: any) => jest.fn(async (..._args: any[]) => value)
export function readFixture() {
  const money = { id: RECORD, state: 'completed', atomicAmount: '123450000', feeAtomicAmount: '1000000', assetCode: 'USDT', assetDecimals: 6 }
  const product = { id: RECORD, slug: SLUG, name: 'Koala Quant / 考拉量化', summary: 'Official A-REIT product / A-REIT 官方产品', status: 'active', fees: { managementBps: 100, performanceBps: 2000 }, cutoffTime: '15:00', timezone: 'Asia/Singapore', minSubscriptionAtomic: '100000000', performance: { indexNetOf: 'management_fee', sinceInceptionPct: -2 } }
  const payout = { tradeDate: '2026-10-28', netAtomic: '-2500000', paidAtomic: '0' }
  const bet = { id: RECORD, status: 'lost', stakeAtomic: '10000000', feeAtomic: '100000', payoutFeeAtomic: '0', shares: '19.8', price: '0.5' }
  const notice = { id: RECORD, kind: 'quant.settled', title: 'Koala Quant settled: -2.50 USDT', body: 'A loss for the day, taken from your principal.', payload: { product: SLUG, tradeDate: payout.tradeDate, netAtomic: payout.netAtomic, paidAtomic: payout.paidAtomic }, createdAt: '2026-10-29T00:00:00Z' }
  const dependencies = {
    identity: { accountStatus: mock({ status: 'active' }) }, compliance: { getKycStatus: mock({ state: 'approved' }) }, risk: { getProfile: mock({ band: 'moderate', stale: false }) },
    ledger: { listUserBalances: mock({ accounts: [{ purpose: 'available', state: 'active', atomicBalance: '123450000', assetCode: 'USDT', assetDecimals: 6 }] }), listUserTransactions: mock({ transactions: [{ id: RECORD, transactionType: 'deposit', entries: [{ atomicAmount: '123450000', assetCode: 'USDT', assetDecimals: 6 }] }], nextCursor: null }) },
    wallet: { listUserDeposits: mock([money]), listUserWithdrawals: mock([money]), getWithdrawalStatus: mock(money) },
    orders: { listForUser: mock([{ id: RECORD, productName: 'Sample product', state: 'submitted', requestedAtomicAmount: '10000000', filledAtomicAmount: '0', settlementAssetCode: 'USDT', settlementAssetDecimals: 6 }]) },
    portfolio: { listPositions: mock([{ productId: RECORD, quantityAtomicAmount: '1500000', assetCode: 'UNIT', assetDecimals: 6, costAtomicAmount: '10000000', unitPriceAtomicAmount: '2000000', unitPriceDecimals: 6, currency: 'USDT' }]) },
    quant: { listProducts: mock([product]), getProduct: mock(product), getPosition: mock({ principalAtomic: '97500000' }), listMyPayouts: mock([payout]), listMyOrders: mock([{ id: RECORD, slug: SLUG, kind: 'redemption', status: 'settled', payoutAtomic: '10000000' }]), getMyPayout: mock(payout), getMyOrder: mock(null), getMyNoticeLedgerRecord: mock(null) },
    prediction: { listBets: mock({ items: [bet] }), getBet: mock(bet) },
    referral: { summary: mock({ payoutsEnabled: true, balances: { available: '2000000' }, rules: { firstQuantPurchaseOnly: true } }), rewards: mock({ items: [{ id: RECORD, amountAtomic: '2000000', currency: 'USDT', decimals: 6 }] }) },
    notifications: { listForUser: mock([notice]), getForUser: mock(notice) },
    support: { listTickets: mock([{ id: RECORD, status: 'open', subject: 'Deposit check' }]), getTicketTimeline: mock({ ticket: { id: RECORD, status: 'open' }, messages: [{ actorType: 'user', body: 'Please check my deposit.' }] }) },
    catalog: { listProducts: mock([{ id: RECORD, displayName: 'Sample product', minOrderAtomicAmount: '10000000' }]) },
    markets: { listMarkets: mock([{ id: RECORD, question: 'Sample event?', state: 'active' }]) },
    platform: { publicProfile: mock({ supportEmail: null, publishedAt: null }) },
  }
  const d = dependencies
  const tools = new AiReadToolsService(d.identity as any,d.compliance as any,d.risk as any,d.ledger as any,d.wallet as any,d.orders as any,d.portfolio as any,d.quant as any,d.prediction as any,d.referral as any,d.notifications as any,d.support as any,d.catalog as any,d.markets as any,d.platform as any)
  return { tools, d, notice, payout }
}
