import type { EntityManager } from 'typeorm'
import type { CouponKind } from './rewards.dto'
import { REWARD_ERROR_CODES, rewardConflict } from './rewards.errors'
import { BadRequestException } from '@nestjs/common'
import { hasQualifyingDeposit } from '../wallet/transfer-eligibility'

type Db = Pick<EntityManager, 'query'>
export function assertRewardFunding(couponId?: string, voucherId?: string) {
  if (couponId && voucherId) throw new BadRequestException({ code: REWARD_ERROR_CODES.VOUCHER_CONFLICT, message: 'Choose couponId or voucherId.' })
}
/** The caller holds the per-user bet lock; the row lock protects the reusable voucher itself. */
export async function lockBetVoucher(db: Db, userId: string, id: string, stake: bigint): Promise<void> {
  const [c] = await db.query(`SELECT *,expires_at>=now() AS valid FROM app.user_coupons WHERE id=$1 AND user_id=$2 FOR UPDATE`, [id, userId])
  if (!c || c.state !== 'available' || c.kind !== 'prediction_stake' || !c.valid) throw rewardConflict(REWARD_ERROR_CODES.COUPON_INVALID)
  if (stake !== BigInt(c.max_discount_atomic)) throw new BadRequestException({ code: REWARD_ERROR_CODES.VOUCHER_STAKE, message: 'Stake must equal voucher face.' })
  if (!await hasQualifyingDeposit(db, userId, true)) throw rewardConflict(REWARD_ERROR_CODES.VOUCHER_DEPOSIT_REQUIRED)
}
export function assertVoucherPrice(price18: bigint) {
  if (price18 > 900000000000000000n) throw rewardConflict(REWARD_ERROR_CODES.VOUCHER_PRICE)
}
export async function assertVoucherOutcome(db: Db, userId: string, marketId: string, tokenId: string) {
  const [hedge] = await db.query(`SELECT id FROM app.prediction_bets WHERE user_id=$1 AND market_mapping_id=$2
    AND voucher_id IS NOT NULL AND status='placed' AND token_id<>$3 LIMIT 1`, [userId, marketId, tokenId])
  if (hedge) throw rewardConflict(REWARD_ERROR_CODES.VOUCHER_HEDGE)
}
export async function restoreBetVoucher(db: Db, userId: string, id: string) {
  await db.query(`SELECT id FROM app.user_coupons WHERE id=$1 AND user_id=$2 FOR UPDATE`, [id, userId])
  await db.query(`UPDATE app.user_coupons SET state='available',used_at=NULL,locked_ref=NULL,
    expires_at=GREATEST(expires_at,now()+interval '3 days') WHERE id=$1 AND user_id=$2 AND kind='prediction_stake' AND state='used'`, [id, userId])
}
/** Call inside the order transaction with lock=true. Quotes are advisory and never reserve a coupon. */
export async function couponDiscount(db: Db, userId: string, id: string, kind: CouponKind, fee: bigint, lock = true): Promise<bigint> {
  const [c] = await db.query(`SELECT *, expires_at>=now() AS valid FROM app.user_coupons WHERE id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`, [id, userId])
  if (!c || c.state !== 'available' || c.kind !== kind || !c.valid) throw rewardConflict(REWARD_ERROR_CODES.COUPON_INVALID)
  return fee < BigInt(c.max_discount_atomic) ? fee : BigInt(c.max_discount_atomic)
}
export async function redeemCoupon(db: Db, userId: string, couponId: string, orderKind: 'prediction_bet' | 'withdrawal', orderId: string, fee: bigint, discount: bigint) {
  await db.query(`UPDATE app.user_coupons SET state='used',used_at=now(),locked_ref=NULL WHERE id=$1`, [couponId])
  await db.query(`INSERT INTO app.coupon_redemptions(coupon_id,user_id,order_kind,order_id,fee_before_atomic,discount_atomic)
    VALUES($1,$2,$3,$4,$5,$6)`, [couponId, userId, orderKind, orderId, fee.toString(), discount.toString()])
}
/** The withdrawal row is already locked by the existing settlement/refund transaction. */
export async function finishWithdrawalCoupon(db: Db, w: Record<string, any>, used: boolean) {
  if (!w.coupon_id) return
  const [c] = await db.query(`SELECT id FROM app.user_coupons WHERE id=$1 AND user_id=$2 AND state='locked' AND locked_ref=$3 FOR UPDATE`,
    [w.coupon_id, w.user_id, w.id])
  // Never block a withdrawal's completion or refund over coupon bookkeeping: money paths win, the coupon is left as is.
  if (!c) return
  if (used) {
    const discount = BigInt(w.fee_discount_atomic ?? '0')
    await redeemCoupon(db, w.user_id, w.coupon_id, 'withdrawal', w.id, BigInt(w.fee_atomic_amount) + discount, discount)
  } else {
    await db.query(`UPDATE app.user_coupons SET state='available',locked_ref=NULL WHERE id=$1`, [w.coupon_id])
  }
}
