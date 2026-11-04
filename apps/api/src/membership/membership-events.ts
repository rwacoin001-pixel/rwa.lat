import { Logger } from '@nestjs/common'
import type { DataSource } from 'typeorm'

export const MEMBERSHIP_QUEUE='membership'
export type MembershipSource='quant'|'rwa'|'prediction'|'basket'|'deposit'|'transfer'
const log=new Logger('MembershipChange')
export const MEMBERSHIP_SOURCES:Record<MembershipSource,string>={
  quant:"SELECT user_id FROM app.quant_orders WHERE id=$1 AND kind='subscription' AND status IN ('accepted','settled')",
  rwa:"SELECT user_id FROM app.orders WHERE id=$1 AND side='buy' AND state IN ('filled','partially_filled') AND filled_atomic_amount>0 AND settlement_asset_code='USDT' AND settlement_asset_decimals=6",
  // Voids also invalidate a previously counted purchase. Eligibility belongs to the aggregate query.
  prediction:"SELECT user_id FROM app.prediction_bets WHERE id=$1",
  basket:"SELECT user_id FROM app.basket_subscriptions WHERE id=$1 AND status='settled'",
  deposit:"SELECT user_id FROM app.deposits WHERE id=$1 AND state='credited'",
  transfer:"SELECT recipient_user_id AS user_id FROM app.internal_transfers WHERE id=$1 AND state='posted' AND asset_code='USDT'",
}
/** Post-commit only. Repeated partial fills enqueue again; recomputation itself is idempotent. */
export function enqueueMembershipChange(db:DataSource,source:MembershipSource,sourceId:string):void {
  void Promise.resolve().then(()=>db.query('INSERT INTO app.job_queue(queue_name,payload) VALUES($1,$2::jsonb)',
    [MEMBERSHIP_QUEUE,JSON.stringify({type:'change',source,sourceId})]))
    .catch(()=>log.warn('Membership change could not be queued; daily recomputation will reconcile it'))
}
