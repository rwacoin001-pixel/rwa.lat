import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource, EntityManager } from 'typeorm'
import { AiMandateDto, AiExecutionRuleDto } from './ai-mandate.dto'
import { AI_MANDATE_TERMS_VERSION, normalizeMandate, atomic, AiMandateContent } from './ai-mandate.policy'
import { NotificationDeliveryService } from '../notification/notification-delivery.service'

@Injectable()
export class AiMandateService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService,private readonly delivery: NotificationDeliveryService) {}
  get executionEnabled() { return this.config.get<string>('AI_AUTOMATIC_EXECUTION_ENABLED') === 'true' && this.config.get<string>('AI_AUTOMATIC_EXECUTION_ACCEPTED') === 'true' }
  assertExecutionEnabled() { if (!this.executionEnabled) throw new ServiceUnavailableException({ code: 'AI_EXECUTION_NOT_ACCEPTED', message: 'Automatic execution awaits isolated acceptance.' }) }
  async get(userId: string) {
    const [row] = await this.db.query(`SELECT id,revision,status,content,terms_version AS "termsVersion",confirmed_at AS "confirmedAt",managed_cash_atomic::text AS "managedCashAtomic",next_check_at AS "nextCheckAt" FROM app.ai_investment_mandates WHERE user_id=$1`, [userId])
    return { mandate: row ?? null, termsVersion: AI_MANDATE_TERMS_VERSION, executionEnabled: this.executionEnabled, currency: 'USDT', decimals: 6 }
  }
  async choices(userId: string) {
    const products=await this.db.query(`SELECT p.id,p.display_name AS name,r.content AS rules,r.revision FROM app.products p JOIN app.ai_product_execution_rules r ON r.product_id=p.id AND r.state='enabled' JOIN app.ai_knowledge_items k ON k.id=r.terms_knowledge_id AND k.published_revision=r.terms_revision WHERE p.state='published' AND p.asset_class_id<>'prediction' AND k.archived_at IS NULL AND k.published->>'visibility'='public' AND ((k.published->>'effectiveAt') IS NULL OR (k.published->>'effectiveAt')::timestamptz<=now()) AND ((k.published->>'expiresAt') IS NULL OR (k.published->>'expiresAt')::timestamptz>now()) ORDER BY p.display_name LIMIT 300`)
    const positions=await this.db.query(`SELECT p.id,p.product_id AS "productId",c.display_name AS name,p.asset_decimals AS decimals,p.quantity_atomic_amount::text AS "quantityAtomic" FROM app.positions p JOIN app.products c ON c.id=p.product_id WHERE p.user_id=$1 AND p.state='active' AND p.outcome_key='long' AND p.quantity_atomic_amount>0 ORDER BY c.display_name LIMIT 100`,[userId])
    return {products,positions}
  }
  async confirm(userId: string, sessionId: string, input: AiMandateDto) {
    if (input.confirmed !== true || input.termsVersion !== AI_MANDATE_TERMS_VERSION) throw new BadRequestException('Current terms must be explicitly confirmed')
    let content: AiMandateContent
    try { content = normalizeMandate(input) } catch (error) { throw new BadRequestException((error as Error).message) }
    if(content.notifications.includes('email') && !this.delivery.channels().email) throw new ServiceUnavailableException('Email notifications are not configured')
    if (Date.parse(content.expiresAt) <= Date.now()) throw new BadRequestException('Mandate already expired')
    return this.db.transaction(async tx => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`ai-mandate:${userId}`])
      const [user] = await tx.query(`SELECT id FROM app.users WHERE id=$1 AND status='active'`, [userId])
      if (!user) throw new ConflictException('An active account is required')
      const [old] = await tx.query(`SELECT * FROM app.ai_investment_mandates WHERE user_id=$1 FOR UPDATE`, [userId])
      if ((old?.revision ?? 0) !== input.expectedRevision) throw new ConflictException('Mandate changed; review the current version')
      if (old) {
        const [open] = await tx.query(`SELECT id FROM app.ai_automatic_runs WHERE mandate_id=$1 AND state NOT IN ('completed','no_change','failed','canceled') LIMIT 1`, [old.id])
        if (open) throw new ConflictException('Resolve the current execution before replacing its managed scope')
      }
      const [balance] = await tx.query(`SELECT COALESCE(SUM(b.current_atomic_balance),0)::text AS amount FROM app.ledger_accounts a JOIN app.ledger_account_balances b ON b.account_id=a.id WHERE a.user_id=$1 AND a.owner_type='user' AND a.purpose='available' AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.state<>'closed'`, [userId])
      if (atomic(content.cashBudgetAtomic) + atomic(content.cashReserveAtomic) > atomic(balance.amount)) throw new ConflictException('Available USDT is below the managed budget and cash reserve')
      for (const id of content.allowedProductIds) {
        const [product] = await tx.query(`SELECT id FROM app.products WHERE id=$1 AND state='published' AND asset_class_id<>'prediction'`, [id])
        if (!product) throw new ConflictException('Only published ordinary products can be authorized')
      }
      const positions: Array<{product_id: string;asset_code: string;asset_decimals: number;quantity: string;cost: string}> = []
      for (const position of content.positions) {
        const [owned] = await tx.query(`SELECT id,product_id,asset_code,asset_decimals,quantity_atomic_amount::text AS quantity,cost_atomic_amount::text AS cost FROM app.positions WHERE id=$1 AND user_id=$2 AND state='active' AND outcome_key='long'`, [position.positionId, userId])
        if (!owned || !content.allowedProductIds.includes(owned.product_id) || atomic(position.quantityAtomic) > atomic(owned.quantity)) throw new ConflictException('Managed position exceeds the owned authorized scope')
        if (positions.some(row => row.product_id === owned.product_id)) throw new BadRequestException('Select one position per product')
        positions.push({ ...owned, quantity: position.quantityAtomic, cost: (atomic(owned.cost) * atomic(position.quantityAtomic) / atomic(owned.quantity, true)).toString() })
      }
      const [row] = await tx.query(`INSERT INTO app.ai_investment_mandates(user_id,revision,status,content,terms_version,confirmed_at,confirmation_session_id,managed_cash_atomic,next_check_at)
        VALUES ($1,1,'active',$2::jsonb,$3,now(),$4,$5,$6)
        ON CONFLICT(user_id) DO UPDATE SET revision=app.ai_investment_mandates.revision+1,status='active',content=EXCLUDED.content,terms_version=EXCLUDED.terms_version,confirmed_at=now(),confirmation_session_id=EXCLUDED.confirmation_session_id,managed_cash_atomic=EXCLUDED.managed_cash_atomic,nonreinvestable_cash_atomic=0,next_check_at=EXCLUDED.next_check_at,updated_at=now() RETURNING id,revision`, [userId, JSON.stringify(content), AI_MANDATE_TERMS_VERSION, sessionId, content.cashBudgetAtomic, new Date(Math.max(Date.now(), Date.parse(content.effectiveAt)))])
      await tx.query(`DELETE FROM app.ai_managed_positions WHERE mandate_id=$1`, [row.id])
      for (const p of positions) await tx.query(`INSERT INTO app.ai_managed_positions(mandate_id,product_id,asset_code,asset_decimals,quantity_atomic,cost_atomic) VALUES ($1,$2,$3,$4,$5,$6)`, [row.id,p.product_id,p.asset_code,p.asset_decimals,p.quantity,p.cost])
      await this.version(tx, row.id, row.revision, content, 'active', 'confirmed', sessionId)
      return { id: row.id, revision: row.revision, status: 'active', executionEnabled: this.executionEnabled }
    })
  }
  async changeState(userId: string, expectedRevision: number, sessionId: string, status: 'active'|'paused'|'revoked') {
    return this.db.transaction(async tx => {
      const [row] = await tx.query(`SELECT * FROM app.ai_investment_mandates WHERE user_id=$1 FOR UPDATE`, [userId])
      if (!row) throw new NotFoundException('Mandate not found')
      if (row.revision !== expectedRevision) throw new ConflictException('Mandate changed')
      if (row.status === 'revoked') throw new ConflictException('Revoked mandates require a new confirmation')
      if (status === 'active' && Date.parse(row.content.expiresAt) <= Date.now()) throw new ConflictException('Mandate expired')
      const revision = row.revision + 1
      await tx.query(`UPDATE app.ai_investment_mandates SET status=$2,revision=$3,next_check_at=now(),updated_at=now() WHERE id=$1`, [row.id,status,revision])
      await this.version(tx,row.id,revision,row.content,status,status,sessionId)
      // Accepted applications remain real applications. Only unsubmitted work is canceled.
      await tx.query(`UPDATE app.ai_automatic_runs SET state='paused',failure_code='MANDATE_CHANGED',updated_at=now() WHERE mandate_id=$1 AND state IN ('ready','generating','selling','waiting_redemptions','buying','waiting_orders')`, [row.id])
      return { id: row.id, revision, status }
    })
  }
  listRules() { return this.db.query(`SELECT product_id AS "productId",revision,state,content,terms_knowledge_id AS "termsKnowledgeId",terms_revision AS "termsRevision" FROM app.ai_product_execution_rules ORDER BY updated_at DESC LIMIT 300`) }
  async saveRule(productId: string, input: AiExecutionRuleDto, adminId: string) {
    // Validate runtime types even when this service is called without HTTP DTO validation.
    for (const key of ['buyFeeFixedAtomic','redeemFeeFixedAtomic'] as const) try { atomic(input[key]) } catch { throw new BadRequestException('Invalid fee amount') }
    return this.db.transaction(async tx => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`ai-rule:${productId}`])
      const [p] = await tx.query(`SELECT id FROM app.products WHERE id=$1 AND state='published' AND asset_class_id<>'prediction'`, [productId])
      if (!p) throw new ConflictException('Product is unavailable')
      const [terms] = await tx.query(`SELECT id FROM app.ai_knowledge_items WHERE id=$1 AND published_revision=$2 AND archived_at IS NULL AND published->>'visibility'='public' AND published->'productIds' ? $3 AND ((published->>'effectiveAt') IS NULL OR (published->>'effectiveAt')::timestamptz<=now()) AND ((published->>'expiresAt') IS NULL OR (published->>'expiresAt')::timestamptz>now())`, [input.termsKnowledgeId,input.termsRevision,productId])
      if (input.state === 'enabled' && !terms) throw new ConflictException('Current published product terms are required')
      const [old] = await tx.query(`SELECT revision FROM app.ai_product_execution_rules WHERE product_id=$1 FOR UPDATE`, [productId])
      if ((old?.revision ?? 0) !== input.expectedRevision) throw new ConflictException('Product execution rule changed')
      const content = { productId,riskBand: input.riskBand,lockDays: input.lockDays,buyFeeBps: input.buyFeeBps,buyFeeFixedAtomic: input.buyFeeFixedAtomic,redeemFeeBps: input.redeemFeeBps,redeemFeeFixedAtomic: input.redeemFeeFixedAtomic }
      const [saved] = await tx.query(`INSERT INTO app.ai_product_execution_rules(product_id,revision,state,content,terms_knowledge_id,terms_revision,updated_by) VALUES ($1,1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT(product_id) DO UPDATE SET revision=app.ai_product_execution_rules.revision+1,state=EXCLUDED.state,content=EXCLUDED.content,terms_knowledge_id=EXCLUDED.terms_knowledge_id,terms_revision=EXCLUDED.terms_revision,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING revision`, [productId,input.state,JSON.stringify(content),input.termsKnowledgeId,input.termsRevision,adminId])
      await tx.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata) VALUES (gen_random_uuid(),'admin',$1,'ai.execution_rule.saved','product',$2,gen_random_uuid(),$3::jsonb)`, [adminId,productId,JSON.stringify({ revision: saved.revision, state: input.state })])
      return { productId, revision: saved.revision }
    })
  }
  async history(userId: string) { return this.db.query(`SELECT v.revision,v.content,v.status,v.terms_version AS "termsVersion",v.confirmed_at AS "confirmedAt" FROM app.ai_investment_mandate_versions v JOIN app.ai_investment_mandates m ON m.id=v.mandate_id WHERE m.user_id=$1 ORDER BY v.revision DESC LIMIT 100`,[userId]) }
  private async version(tx: EntityManager,id: string,revision: number,content: AiMandateContent,status: string,kind: string,session: string) {
    await tx.query(`INSERT INTO app.ai_investment_mandate_versions(mandate_id,revision,content,status,terms_version,change_kind,session_id) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)`,[id,revision,JSON.stringify(content),status,AI_MANDATE_TERMS_VERSION,kind,session])
  }
}
