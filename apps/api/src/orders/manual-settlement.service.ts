import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource, EntityManager } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { OperationalCapabilityService, OPERATIONAL_SWITCH_KEYS } from '../operations/operational-capability.service'
import { ManualSettlementDto, ReviewSettlementDto } from './manual-settlement.dto'
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service'

@Injectable()
export class ManualSettlementService {
  constructor(private readonly db: DataSource, private readonly operations: OperationalCapabilityService,
    private readonly documents: GeneratedDocumentsService) {}

  async requestInfo(kind: 'order' | 'redemption', id: string) {
    const table = kind === 'order' ? 'orders' : 'redemptions'
    const decimals = kind === 'order' ? 'product_asset_decimals' : 'asset_decimals'
    const [row] = await this.db.query(`SELECT r.id, r.user_id AS "userId", r.state, p.display_name AS "productName",
      r.${decimals} AS "quantityDecimals",${kind==='order'?"r.idempotency_key":"r.request_id"} LIKE 'ai-leg:%' AS "feeRequired" FROM app.${table} r JOIN app.products p ON p.id=r.product_id
      WHERE r.id=$1 AND p.asset_class_id <> 'prediction'`, [id])
    if (!row) throw new NotFoundException('普通交易申请不存在')
    return row
  }

  async list() {
    return this.db.query(`SELECT id, kind, reference_id AS "referenceId", external_reference AS "externalReference",
      evidence_ref AS "evidenceRef", (SELECT o.id FROM app.object_storage_objects o WHERE o.bucket='rwa-attachments' AND o.key=substring(evidence_ref from 17)) AS "evidenceObjectId",
      amount_atomic::text AS "amountAtomic", quantity_atomic::text AS "quantityAtomic",fee_atomic::text AS "feeAtomic",
      posted_by AS "postedBy", posted_at AS "postedAt", review_state AS "reviewState", review_note AS "reviewNote"
      FROM app.manual_trade_settlements ORDER BY posted_at DESC LIMIT 200`)
  }

  async post(kind: 'order' | 'redemption', id: string, input: ManualSettlementDto, actor: string) {
    await this.operations.assertEnabled(OPERATIONAL_SWITCH_KEYS.orders, '普通交易入账已暂停')
    const externalReference = input.externalReference.trim()
    return this.db.transaction(async em => {
      // Lock the business request before examining the receipt: concurrent retries serialize.
      const table = kind === 'order' ? 'orders' : 'redemptions'
      const [request] = await em.query(`SELECT r.*, p.asset_class_id FROM app.${table} r
        JOIN app.products p ON p.id = r.product_id WHERE r.id = $1 FOR UPDATE OF r`, [id])
      if (!request) throw new NotFoundException('订单或赎回申请不存在')
      const automatic=String(kind==='order'?request.idempotency_key:request.request_id).startsWith('ai-leg:')
      if(automatic && input.feeAtomic===undefined)throw new ConflictException('AI 自动申请必须记录实际费用；零费用也需明确填写 0')
      if(input.feeAtomic!==undefined && (!/^(0|[1-9][0-9]{0,59})$/.test(input.feeAtomic) || (kind==='order' && BigInt(input.feeAtomic)>BigInt(input.amountAtomic))))throw new ConflictException('费用不能超出投资成交总金额')
      if (request.asset_class_id === 'prediction' || (kind === 'order' && request.outcome_key !== 'long')) {
        throw new ConflictException('此入口只支持普通资产投资与赎回')
      }
      const [existing] = await em.query(`SELECT * FROM app.manual_trade_settlements WHERE kind = $1 AND reference_id = $2`, [kind, id])
      if (existing) {
        if (existing.external_reference !== externalReference || existing.evidence_ref !== input.evidenceRef
          || BigInt(existing.amount_atomic) !== BigInt(input.amountAtomic) || BigInt(existing.quantity_atomic) !== BigInt(input.quantityAtomic) || (existing.fee_atomic==null?null:BigInt(existing.fee_atomic).toString()) !== (input.feeAtomic===undefined?null:BigInt(input.feeAtomic).toString())) {
          throw new ConflictException('该申请已按不同成交信息入账，不能重复修改')
        }
        return { id: existing.id, replay: true, reviewState: existing.review_state }
      }
      const allowed = kind === 'order' ? ['submitted', 'processing'] : ['requested', 'queued']
      if (!allowed.includes(request.state)) throw new ConflictException('当前状态不能入账')
      const [evidence] = await em.query(`SELECT checksum_sha256 FROM app.object_storage_objects
        WHERE bucket = 'rwa-attachments' AND key = $1 AND scan_status = 'clean' AND size_bytes > 0 FOR SHARE`,
      [input.evidenceRef.slice('rwa-attachments/'.length)])
      if (!evidence?.checksum_sha256) throw new ConflictException('请先上传并校验实际成交凭证')
      const settlementId = randomUUID()
      const inserted = await em.query(`INSERT INTO app.manual_trade_settlements
        (id, kind, reference_id, external_reference, evidence_ref, evidence_hash, amount_atomic, quantity_atomic, posted_by,fee_atomic)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (external_reference) DO NOTHING RETURNING id`,
      [settlementId, kind, id, externalReference, input.evidenceRef, evidence.checksum_sha256, input.amountAtomic, input.quantityAtomic, actor,input.feeAtomic??null])
      if (!inserted.length) throw new ConflictException('该外部成交编号已使用')
      if (kind === 'order') await this.invest(em, request, input, actor, settlementId)
      else await this.redeem(em, request, input, actor, settlementId)
      await this.audit(em, actor, 'admin.trade.posted', settlementId, { kind, referenceId: id, externalReference, amountAtomic: input.amountAtomic, quantityAtomic: input.quantityAtomic,feeAtomic:input.feeAtomic??null })
      await this.documents.queueTrade(em, settlementId)
      return { id: settlementId, replay: false, reviewState: 'pending' }
    })
  }

  async review(id: string, input: ReviewSettlementDto, actor: string) {
    return this.db.transaction(async em => {
      const [row] = await em.query(`SELECT * FROM app.manual_trade_settlements WHERE id = $1 FOR UPDATE`, [id])
      if (!row) throw new NotFoundException('入账记录不存在')
      if (row.review_state !== 'pending') {
        if (row.review_state === input.state && row.review_note === input.note.trim()) return { id, reviewState: row.review_state, replay: true }
        throw new ConflictException('该记录已复核；请通过人工异常处理流程继续处理')
      }
      await em.query(`UPDATE app.manual_trade_settlements SET review_state=$2, review_note=$3, reviewed_by=$4, reviewed_at=now() WHERE id=$1`, [id, input.state, input.note.trim(), actor])
      // Review records findings only; it never changes a balance or a position.
      await this.audit(em, actor, 'admin.trade.reviewed', id, { state: input.state, note: input.note.trim() })
      return { id, reviewState: input.state, replay: false }
    })
  }

  private async invest(em: EntityManager, order: any, input: ManualSettlementDto, actor: string, receipt: string) {
    const amount = BigInt(input.amountAtomic)
    const requested = BigInt(order.requested_atomic_amount)
    if (order.settlement_asset_code !== 'USDT' || order.settlement_asset_decimals !== 6 || amount > requested) throw new ConflictException('实际成交金额不能超出订单已锁定的 USDT 金额')
    const locked = await this.account(em, order.user_id, 'locked')
    const available = await this.account(em, order.user_id, 'available')
    const settlement = await this.account(em, null, 'settlement', order.product_id)
    await this.transfer(em, 'investment', order.id, actor, locked, settlement, amount, receipt)
    const remainder = requested - amount
    if (remainder > 0n) await this.transfer(em, 'order_release', order.id, actor, locked, available, remainder, receipt)
    const changed = await em.query(`INSERT INTO app.positions (user_id, product_id, outcome_key, asset_code, asset_decimals, quantity_atomic_amount, cost_atomic_amount)
      VALUES ($1,$2,'long',$3,$4,$5,$6) ON CONFLICT (user_id, product_id, outcome_key)
      DO UPDATE SET quantity_atomic_amount=positions.quantity_atomic_amount+EXCLUDED.quantity_atomic_amount,
        cost_atomic_amount=positions.cost_atomic_amount+EXCLUDED.cost_atomic_amount, state='active', updated_at=now(), settled_at=NULL
      WHERE positions.asset_code=EXCLUDED.asset_code AND positions.asset_decimals=EXCLUDED.asset_decimals RETURNING id`,
    [order.user_id, order.product_id, order.product_asset_code, order.product_asset_decimals, input.quantityAtomic, input.amountAtomic])
    if (!changed.length) throw new ConflictException('持仓单位与下单记录不一致')
    const state = remainder === 0n ? 'filled' : 'partially_filled'
    await em.query(`UPDATE app.orders SET state=$2, filled_atomic_amount=$3::numeric, filled_quantity_atomic_amount=$4::numeric,
      processed_at=COALESCE(processed_at,now()), completed_at=now(), failure_reason=NULL,
      receipt=jsonb_build_object('settlementId',$5::text,'amountAtomic',($3::numeric)::text,'quantityAtomic',($4::numeric)::text) WHERE id=$1`,
    [order.id, state, input.amountAtomic, input.quantityAtomic, receipt])
    await em.query(`INSERT INTO app.order_events (id,order_id,previous_state,next_state,actor_type,actor_id,metadata)
      VALUES ($1,$2,$3,$4,'admin',$5,$6::jsonb)`, [randomUUID(), order.id, order.state, state, actor, JSON.stringify({ settlementId: receipt, releasedAtomicAmount: remainder.toString() })])
  }

  private async redeem(em: EntityManager, request: any, input: ManualSettlementDto, actor: string, receipt: string) {
    const quantity = BigInt(input.quantityAtomic)
    if (quantity !== BigInt(request.quantity_atomic_amount)) throw new ConflictException('赎回凭证份额必须与本次申请一致')
    const [position] = await em.query(`SELECT * FROM app.positions WHERE user_id=$1 AND product_id=$2 AND outcome_key='long' AND state='active' FOR UPDATE`, [request.user_id, request.product_id])
    if (!position || position.asset_code !== request.asset_code || position.asset_decimals !== request.asset_decimals || BigInt(position.quantity_atomic_amount) < quantity) throw new ConflictException('可用持仓不足或资产单位不一致')
    const settlement = await this.account(em, null, 'settlement', request.product_id)
    const available = await this.account(em, request.user_id, 'available')
    await this.transfer(em, 'settlement', request.id, actor, settlement, available, BigInt(input.amountAtomic), receipt)
    const total = BigInt(position.quantity_atomic_amount)
    const cost = BigInt(position.cost_atomic_amount) * quantity / total
    const remaining = total - quantity
    await em.query(`UPDATE app.positions SET quantity_atomic_amount=$2, cost_atomic_amount=cost_atomic_amount-$3::numeric, state=$4, updated_at=now() WHERE id=$1`, [position.id, remaining.toString(), cost.toString(), remaining === 0n ? 'closed' : 'active'])
    await em.query(`UPDATE app.redemptions SET state='completed', executed_at=now(), reason_code=NULL WHERE id=$1`, [request.id])
  }

  private async account(em: EntityManager, user: string | null, purpose: string, product?: string): Promise<string> {
    await em.query(`INSERT INTO app.ledger_accounts (owner_type,user_id,owner_reference,purpose,asset_code,asset_decimals,normal_side)
      VALUES ($1,$2,$3,$4,'USDT',6,'credit') ON CONFLICT DO NOTHING`, [user ? 'user' : 'platform', user, user ? null : `order:${product}`, purpose])
    const [account] = await em.query(`SELECT id, normal_side, asset_decimals FROM app.ledger_accounts WHERE owner_type=$1
      AND user_id IS NOT DISTINCT FROM $2::uuid AND owner_reference IS NOT DISTINCT FROM $3::text
      AND purpose=$4 AND asset_code='USDT' AND network IS NULL AND state='active'`, [user ? 'user' : 'platform', user, user ? null : `order:${product}`, purpose])
    if (!account || account.normal_side !== 'credit' || account.asset_decimals !== 6) throw new ConflictException('结算账户不可用或记账单位不一致')
    return account.id
  }

  private async transfer(em: EntityManager, type: string, reference: string, actor: string, from: string, to: string, amount: bigint, receipt: string) {
    const [balance] = await em.query(`SELECT current_atomic_balance FROM app.ledger_account_balances WHERE account_id=$1 FOR UPDATE`, [from])
    if (!balance || BigInt(balance.current_atomic_balance) < amount) throw new ConflictException('结算账户余额不足，请先完成资金对账与补足后再入账')
    const [tx] = await em.query(`INSERT INTO app.ledger_transactions (transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,actor_id,effective_at,metadata)
      VALUES ($1,$2,$3,$4,$5,'admin',$6,now(),$7::jsonb) RETURNING id`, [type, `manual:${type}:${reference}`, receipt, type === 'settlement' ? 'redemption' : 'order', reference, actor, JSON.stringify({ settlementId: receipt })])
    await em.query(`INSERT INTO app.ledger_entries (transaction_id,account_id,side,atomic_amount) VALUES ($1,$2,'debit',$4),($1,$3,'credit',$4)`, [tx.id, from, to, amount.toString()])
  }

  private async audit(em: EntityManager, actor: string, action: string, id: string, metadata: object) {
    await em.query(`INSERT INTO app.audit_logs (id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
      VALUES ($1,'admin',$2,$3,'manual_trade_settlement',$4,$5,$6::jsonb)`, [randomUUID(), actor, action, id, randomUUID(), JSON.stringify(metadata)])
  }
}
