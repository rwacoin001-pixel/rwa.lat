import type { EntityManager } from 'typeorm'
import type { CouponKind } from './rewards.dto'
import { REWARD_ERROR_CODES, rewardConflict } from './rewards.errors'

type Db = Pick<EntityManager, 'query'>
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
