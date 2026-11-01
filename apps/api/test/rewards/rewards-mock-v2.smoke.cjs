const assert = require('node:assert/strict')
const rewards = require('D:/rwa-lat-builds/circles-mock/rewards.cjs')
let checks=0
const check=(condition)=>{ assert.ok(condition); checks++ }
async function call(path,method='GET',body={},key) {
  const url=new URL(path,'http://mock.local')
  let response
  const handled=rewards({method,headers:{'idempotency-key':key}}, {},url.pathname,(_res,status,data)=>{response={status,data}},Promise.resolve(JSON.stringify(body)),url)
  assert.equal(handled,true)
  await Promise.resolve(); await Promise.resolve()
  assert.ok(response)
  return response
}
async function main() {
  const wallet=(await call('/v1/rewards/wallet')).data
  check(wallet.points===40)
  const voucher=wallet.coupons.find(c=>c.kind==='prediction_stake'),fee=wallet.coupons.find(c=>c.kind==='prediction_place_fee')
  check(voucher.maxDiscountAtomic==='5000000' && voucher.state==='available')
  check(fee.maxDiscountAtomic==='500000')
  check(wallet.exchange.couponKind==='prediction_stake' && wallet.exchange.maxDiscountAtomic==='1000000')
  const odds=(await call('/v1/rewards/odds')).data
  check(odds.version===2 && odds.points.reduce((n,r)=>n+r.weight,0)===10000 && odds.vouchers.reduce((n,r)=>n+r.weight,0)===10000)
  check(odds.vouchers.find(r=>r.faceAtomic==='100000000').dailyCap===1)
  check((await call('/v1/rewards/today?mock=reset')).data.eligible)
  const draw=(await call('/v1/rewards/draw','POST',{},'draw')).data
  check(draw.prize.points>0 && draw.prize.voucher.kind==='prediction_stake' && draw.prize.coupon===null)
  check(/^AR-[A-Z2-7]{8}$/.test(draw.serial) && ['common','rare','epic','legend'].includes(draw.tier))
  check((await call('/v1/rewards/draw','POST',{},'draw')).data.id===draw.id)
  check(!(await call('/v1/rewards/today')).data.eligible)
  check((await call('/v1/predictions/bets','POST',{tokenId:'t',voucherId:voucher.id,couponId:fee.id,stakeAtomic:'5000000'})).status===400)
  check((await call('/v1/predictions/bets','POST',{tokenId:'t',voucherId:voucher.id,stakeAtomic:'1000000'})).data.code==='REWARD_VOUCHER_STAKE')
  const input={tokenId:'t',voucherId:voucher.id,stakeAtomic:'5000000',idempotencyKey:'voucher-bet'}
  const bet=(await call('/v1/predictions/bets','POST',input)).data
  check(bet.funding==='voucher' && bet.feeAtomic==='0' && bet.riskStakeAtomic==='5000000' && bet.voucherId===voucher.id)
  check((await call('/v1/predictions/bets','POST',input)).data.id===bet.id)
  check((await call('/v1/predictions/bets','POST',{...input,idempotencyKey:'other'})).data.code==='REWARD_COUPON_INVALID')
  const cash=(await call('/v1/predictions/bets','POST',{tokenId:'t',couponId:fee.id,stakeAtomic:'10000000',idempotencyKey:'cash'})).data
  check(cash.funding==='cash' && cash.feeAtomic==='0' && cash.feeDiscountAtomic==='300000')
  for(let n=0;n<6;n++) { await call('/v1/rewards/today?mock=reset'); await call('/v1/rewards/draw','POST',{},`reset-${n}`) }
  const exchange=(await call('/v1/rewards/points/exchange','POST',{},'exchange')).data
  check(exchange.coupon.kind==='prediction_stake' && exchange.coupon.maxDiscountAtomic==='1000000')
  check((await call('/v1/rewards/points/exchange','POST',{},'exchange')).data.coupon.id===exchange.coupon.id)
  check((await call('/v1/rewards/points/exchange','POST',{},'exchange-other')).data.code==='REWARD_EXCHANGE_LIMIT')
  console.log(`${checks} mock assertions passed`)
}
main().catch(error=>{console.error(error);process.exitCode=1})
