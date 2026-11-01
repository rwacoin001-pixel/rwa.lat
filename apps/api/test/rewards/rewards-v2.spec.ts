import { randomUUID } from 'node:crypto'
import { drawSerial, pickPools, voucherTier, type Prize, RewardsService } from '../../src/rewards/rewards.service'
import { assertRewardFunding, assertVoucherOutcome, assertVoucherPrice, lockBetVoucher } from '../../src/rewards/reward-coupons'
import { WalletNetworkRegistry } from '../../src/wallet/wallet-network.registry'

const points: Prize[] = [[10,4500],[20,3000],[50,1700],[100,600],[500,200]].map(([n,w]) => ({
  code: `points_${n}`, pool: 'points', kind: 'points', points: n, weight: w, active: true, coupon_kind: null, coupon_max_atomic: null, daily_cap: null,
}))
const vouchers: Prize[] = [[1,6200],[2,2200],[5,1000],[10,400],[20,150,6],[50,40,2],[100,10,1]].map(([n,w,cap]) => ({
  code: `voucher_${n}`, pool: 'voucher', kind: 'voucher', points: null, weight: w, active: true,
  coupon_kind: 'prediction_stake', coupon_max_atomic: String(n * 1000000), daily_cap: cap ?? null,
}))
const prizes = [...points, ...vouchers]
describe('daily draw v2', () => {
  it('picks one independent prize from each 10000-ticket pool using the stored weights', () => {
    const pc: Record<string,number> = {}, vc: Record<string,number> = {}
    for (let ticket=0; ticket<10000; ticket++) {
      const random = jest.fn().mockReturnValueOnce(ticket).mockReturnValueOnce(9999-ticket)
      const pick = pickPools(prizes, {}, 0n, 300000000n, random)
      expect(random.mock.calls).toEqual([[10000],[10000]])
      pc[pick.points.code] = (pc[pick.points.code] ?? 0)+1
      vc[pick.voucher.code] = (vc[pick.voucher.code] ?? 0)+1
    }
    expect(pc).toEqual(Object.fromEntries(points.map(p => [p.code,p.weight])))
    expect(vc).toEqual(Object.fromEntries(vouchers.map(p => [p.code,p.weight])))
  })
  it.each([['voucher_20',6,9800],['voucher_50',2,9960],['voucher_100',1,9999]])('falls back when %s reaches its daily cap', (code,cap,ticket) => {
    expect(pickPools(prizes, { [code]: cap }, 0n, 300000000n, () => ticket).voucher.code).toBe('voucher_1')
  })
  it('counts only tiers >=5 against budget and never changes the points pick', () => {
    const pick = (issued: bigint, budget: bigint, ticket: number) => pickPools(prizes, {}, issued,budget,jest.fn().mockReturnValueOnce(9999).mockReturnValueOnce(ticket))
    expect(pick(295000000n,300000000n,8400)).toMatchObject({ points: { points: 500 }, voucher: { code:'voucher_5' } })
    expect(pick(295000001n,300000000n,8400)).toMatchObject({ points: { points: 500 }, voucher: { code:'voucher_1' } })
    expect(pick(300000000n,300000000n,6200).voucher.code).toBe('voucher_2')
    expect(pick(300000000n,0n,0).voucher.code).toBe('voucher_1')
    expect(() => pickPools(points,{},0n,0n)).toThrow()
  })
  it.each([[1,'common'],[2,'common'],[5,'rare'],[10,'rare'],[20,'epic'],[50,'epic'],[100,'legend']])('maps %s USDT to %s', (face,tier) => {
    expect(voucherTier(BigInt(face)*1000000n)).toBe(tier)
  })
  it('uses a stable short base32 human serial derived from the draw UUID', () => {
    for (let n=0; n<20; n++) { const id=randomUUID(); expect(drawSerial(id)).toMatch(/^AR-[A-Z2-7]{8}$/); expect(drawSerial(id)).toBe(drawSerial(id)) }
    expect(drawSerial('00000000-0000-0000-0000-000000000000')).toBe('AR-AAAAAAAA')
  })
  it('hides odds when not live', async () => {
    const service = new RewardsService({ transaction: (fn: Function) => fn({ query: async () => [{ live:false }] }) } as never, new WalletNetworkRegistry())
    await expect(service.odds(randomUUID())).rejects.toMatchObject({ status:404 })
  })
  it('exchanges 100 points for a voucher even with a spent draw budget', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM app.reward_campaigns')) return [{ live:true,exchange_coupon_kind:'prediction_stake',exchange_coupon_max_atomic:'1000000',points_per_coupon:100,daily_coupon_budget_atomic:'0' }]
      if (sql.includes('sum(delta)')) return [{ points:'150' }]
      if (sql.includes('FROM app.user_coupons WHERE id=')) return [{ id:'coupon',kind:'prediction_stake',max_discount_atomic:'1000000',state:'available',source:'exchange',created_at:new Date(),expires_at:new Date() }]
      if (sql.includes('sum(max_discount_atomic)')) throw new Error('Exchange must not inspect budget')
      return []
    })
    const service = new RewardsService({ transaction: (fn: Function) => fn({ query }) } as never,new WalletNetworkRegistry())
    expect(await service.exchange(randomUUID(),'key')).toMatchObject({ points:50,coupon:{ kind:'prediction_stake',maxDiscountAtomic:'1000000' } })
    expect(query.mock.calls.find(([s])=>s.includes('INSERT INTO app.user_coupons'))).toBeDefined()
  })
})
describe('bet voucher rules', () => {
  const coupon = { state:'available',kind:'prediction_stake',max_discount_atomic:'1000000',valid:true }
  const db = (deposit = true, c: unknown = coupon) => ({ query: jest.fn(async (sql: string) =>
    sql.includes('FROM app.user_coupons') ? (c ? [c] : []) : sql.includes('FROM app.deposits') && deposit ? [{ id:'deposit',transactionId:'tx' }] : []) })
  it('rejects mutually exclusive voucher and fee coupon with 400', () => {
    expect(() => assertRewardFunding('coupon','voucher')).toThrow(expect.objectContaining({ status:400 }))
  })
  it('locks the owned voucher and requires exact face stake', async () => {
    const q=db()
    await expect(lockBetVoucher(q as never,'user','voucher',999999n)).rejects.toMatchObject({ status:400,response:{ code:'REWARD_VOUCHER_STAKE' } })
    expect(q.query.mock.calls[0][0]).toContain('FOR UPDATE')
    await expect(lockBetVoucher(q as never,'user','voucher',1000000n)).resolves.toBeUndefined()
  })
  it.each([null,{ ...coupon,state:'used' },{ ...coupon,state:'frozen' },{ ...coupon,valid:false },{ ...coupon,kind:'prediction_place_fee' }])('rejects invalid voucher %j', async c => {
    await expect(lockBetVoucher(db(true,c) as never,'user','voucher',1000000n)).rejects.toMatchObject({ status:409,response:{ code:'REWARD_COUPON_INVALID' } })
  })
  it('requires the existing qualifying external deposit evidence', async () => {
    await expect(lockBetVoucher(db(false) as never,'user','voucher',1000000n)).rejects.toMatchObject({ status:409,response:{ code:'REWARD_VOUCHER_DEPOSIT_REQUIRED' } })
  })
  it('accepts 0.90 inclusive and rejects higher price', () => {
    expect(() => assertVoucherPrice(900000000000000000n)).not.toThrow()
    expect(() => assertVoucherPrice(900000000000000001n)).toThrow(expect.objectContaining({ status:409,response:expect.objectContaining({ code:'REWARD_VOUCHER_PRICE' }) }))
  })
  it('rejects an opposite outcome voucher position', async () => {
    await expect(assertVoucherOutcome({ query:async()=>[{ id:'other' }] } as never,'user','market','token')).rejects.toMatchObject({ status:409,response:{ code:'REWARD_VOUCHER_HEDGE' } })
    await expect(assertVoucherOutcome({ query:async()=>[] } as never,'user','market','token')).resolves.toBeUndefined()
  })
})
