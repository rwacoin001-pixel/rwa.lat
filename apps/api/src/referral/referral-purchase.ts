import { Logger } from '@nestjs/common'
import type { DataSource } from 'typeorm'

export type ReferralPurchaseProduct = 'quant' | 'rwa' | 'prediction'
export const REFERRAL_PURCHASE_QUEUE = 'referral-invitee-purchase'
const log = new Logger('ReferralPurchase')

/** Call only after the purchase commits. The outbox owns retries; delivery never delays the response. */
export function enqueueReferralPurchase(db: DataSource, product: ReferralPurchaseProduct, sourceId: string): void {
  void Promise.resolve().then(()=>db.query(`INSERT INTO app.job_queue (queue_name,payload,dedup_key)
    VALUES ($1,$2::jsonb,$3) ON CONFLICT (dedup_key) DO NOTHING`,
  [REFERRAL_PURCHASE_QUEUE,JSON.stringify({product,sourceId}),`referral-purchase:${product}:${sourceId}`]))
    .catch(()=>log.warn('Referral purchase notice could not be queued'))
}
