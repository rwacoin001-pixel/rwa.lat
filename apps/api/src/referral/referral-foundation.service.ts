import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { assertAwardTransition, AwardState, validateReferralSettings } from './referral-policy'

@Injectable()
export class ReferralFoundationService {
  constructor(private readonly db: DataSource) {}
  private async requireInstalled() {
    const [row]=await this.db.query("SELECT to_regclass('app.referral_runtime') IS NOT NULL AS installed")
    if(!row.installed) throw new ServiceUnavailableException('Referral service is being prepared')
  }
  async settings(): Promise<Array<{version:number;config:Record<string,unknown>}>> {
    await this.requireInstalled()
    return this.db.query('SELECT * FROM app.referral_settings ORDER BY version DESC')
  }
  async rollbackSettings(version: number, actorId: string) {
    const [old] = await this.db.query('SELECT config FROM app.referral_settings WHERE version=$1',[version])
    if (!old) throw new BadRequestException('Settings version not found')
    return this.saveSettings(old.config,actorId)
  }
  async saveSettings(config: unknown, actorId: string, now = new Date()) {
    validateReferralSettings(config)
    const nextDay = new Date(Math.floor((now.getTime()+8*3600000)/86400000)*86400000 + 86400000 - 8*3600000)
    const local = new Date(now.getTime()+8*3600000)
    const nextMonth = new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,1)-8*3600000)
    return this.db.transaction(async m => {
      const [row] = await m.query(`INSERT INTO app.referral_settings(config,created_by,fee_effective_at,holding_effective_at,team_effective_at)
        VALUES($1,$2,$3,$4,$5) RETURNING *`, [JSON.stringify(config),actorId,now,nextDay,nextMonth])
      await m.query(`INSERT INTO app.referral_audit(request_key,actor_id,action,metadata) VALUES($1,$2,'settings.created',$3)`,
        [`settings:${row.version}`,actorId,JSON.stringify({ version: row.version })])
      return row
    })
  }
  /** Not connected to any real fee entry point in stage zero. The caller must own a DB transaction. */
  async captureFee(runner: QueryRunner, feeEntryId: string, component: 'prediction_place' | 'prediction_payout') {
    if (!runner.isTransactionActive) throw new Error('Fee capture requires caller transaction')
    if (!['prediction_place','prediction_payout'].includes(component)) throw new BadRequestException('Fee source not allowed')
    const [fee] = await runner.query(`SELECT e.transaction_id,e.atomic_amount::text,e.created_at::text AS created_at,t.effective_at::text AS effective_at,t.actor_id AS user_id,
      t.reference_id,t.transaction_type,a.asset_code,a.asset_decimals FROM app.ledger_entries e
      JOIN app.ledger_accounts a ON a.id=e.account_id JOIN app.ledger_transactions t ON t.id=e.transaction_id
      WHERE e.id=$1 AND e.side='credit' AND a.owner_type='platform' AND a.owner_reference='prediction_fee'
        AND a.purpose='fee_revenue' AND a.asset_code='USDT' AND a.asset_decimals=6`, [feeEntryId])
    const type = component === 'prediction_place' ? 'prediction_stake' : 'prediction_payout'
    if (!fee || !fee.user_id || fee.transaction_type !== type) throw new BadRequestException('No eligible platform fee entry')
    const [version] = await runner.query(`SELECT version FROM app.referral_settings
      WHERE fee_effective_at<=$1 ORDER BY fee_effective_at DESC,version DESC LIMIT 1`, [fee.effective_at])
    if (!version) throw new ConflictException('No effective referral settings')
    const ancestors = await runner.query(`WITH RECURSIVE up(user_id,level,path) AS (
      SELECT inviter_user_id,1,ARRAY[$1::uuid,inviter_user_id] FROM app.referral_edges WHERE invitee_user_id=$1 AND bound_at<=$2
      UNION ALL SELECT e.inviter_user_id,u.level+1,u.path||e.inviter_user_id FROM up u
      JOIN app.referral_edges e ON e.invitee_user_id=u.user_id WHERE u.level<3 AND e.bound_at<=$2 AND NOT e.inviter_user_id=ANY(u.path)
    ) SELECT user_id,level FROM up ORDER BY level`, [fee.user_id,fee.effective_at])
    const id = randomUUID()
    const rows = await runner.query(`INSERT INTO app.referral_events(id,fee_entry_id,ledger_transaction_id,fee_component,source_user_id,
      business_reference_id,amount_atomic,occurred_at,rate_at,settings_version,ancestors)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(fee_entry_id) DO NOTHING RETURNING id`,
      [id,feeEntryId,fee.transaction_id,component,fee.user_id,fee.reference_id,fee.atomic_amount,fee.created_at,fee.effective_at,version.version,JSON.stringify(ancestors)])
    const [event] = rows.length ? rows : await runner.query('SELECT id,fee_component FROM app.referral_events WHERE fee_entry_id=$1', [feeEntryId])
    if (event.fee_component && event.fee_component !== component) throw new ConflictException('Fee replay component differs')
    await runner.query(`INSERT INTO app.job_queue(queue_name,payload,dedup_key) VALUES('referral.stage0',$1,$2)
      ON CONFLICT(dedup_key) DO NOTHING`, [JSON.stringify({ eventId: event.id }),`referral-event:${event.id}`])
    return event.id as string
  }
  /** Stage-zero transitions deliberately cannot reserve funds, approve or pay. */
  async transition(awardId: string, target: AwardState, requestKey: string, actorId: string) {
    return this.db.transaction(async m => {
      const [award] = await m.query('SELECT * FROM app.referral_awards WHERE id=$1 FOR UPDATE', [awardId])
      if (!award) throw new BadRequestException('Award not found')
      const [old] = await m.query('SELECT * FROM app.referral_award_actions WHERE request_key=$1', [requestKey])
      if (old) {
        if (old.award_id!==awardId || old.action!==target || old.actor_id!==actorId) throw new ConflictException('Idempotency request differs')
        return award
      }
      assertAwardTransition(award.state,target)
      if (['approved','available','claimed_credit','claimed_cash'].includes(target)) this.assertPayoutsDisabled()
      await m.query(`INSERT INTO app.referral_award_actions(award_id,request_key,action,actor_id) VALUES($1,$2,$3,$4)`, [awardId,requestKey,target,actorId])
      await m.query('UPDATE app.referral_awards SET state=$2,updated_at=now() WHERE id=$1', [awardId,target])
      await m.query(`INSERT INTO app.referral_audit(request_key,actor_id,action,object_id,metadata) VALUES($1,$2,'award.transition',$3,$4)`,
        [`action:${requestKey}`,actorId,awardId,JSON.stringify({ from: award.state, to: target })])
      return { ...award, state: target }
    })
  }
  assertPayoutsDisabled(): never { throw new ServiceUnavailableException({ code:'REFERRAL_STAGE_ZERO',message:'Referral payments are disabled in stage zero' }) }

  /** Candidate amounts count for risk, without creating any earned balance or ledger entries. */
  async recordCandidateRisk(r: QueryRunner, userId: string, eventId: string, amountAtomic: string, sourceKey: string, at: Date) {
    if (!r.isTransactionActive) throw new Error('Risk counting requires caller transaction')
    if (!/^(0|[1-9][0-9]{0,77})$/.test(amountAtomic)) throw new BadRequestException('Invalid atomic amount')
    const [s] = await r.query('SELECT s.config FROM app.referral_events e JOIN app.referral_settings s ON s.version=e.settings_version WHERE e.id=$1', [eventId])
    if (!s) throw new BadRequestException('Event not found')
    const inserted = await r.query(`INSERT INTO app.referral_risk_evidence(user_id,event_id,request_key,signal,metadata)
      VALUES($1,$2,$3,'candidate.counted',$4) ON CONFLICT(request_key) DO NOTHING RETURNING id`,
      [userId,eventId,sourceKey,JSON.stringify({ amountAtomic, occurredAt: at.toISOString() })])
    if (!inserted.length) {
      const [old] = await r.query('SELECT user_id,event_id,metadata FROM app.referral_risk_evidence WHERE request_key=$1', [sourceKey])
      if (old.user_id!==userId || old.event_id!==eventId || old.metadata.amountAtomic!==amountAtomic || old.metadata.occurredAt!==at.toISOString()) throw new ConflictException('Risk replay differs')
      return { duplicate:true }
    }
    const local = new Date(at.getTime()+8*3600000).toISOString(), day=local.slice(0,10), month=local.slice(0,7)
    const scopes = [{ key:`platform`,bucket:month },{ key:`user:${userId}`,bucket:day }]
    const totals: bigint[]=[]
    for (const scope of scopes) {
      const [row] = await r.query(`INSERT INTO app.referral_risk_counters(scope_key,bucket,amount_atomic) VALUES($1,$2,$3)
        ON CONFLICT(scope_key,bucket) DO UPDATE SET amount_atomic=referral_risk_counters.amount_atomic+excluded.amount_atomic
        RETURNING amount_atomic::text`, [scope.key,scope.bucket,amountAtomic])
      totals.push(BigInt(row.amount_atomic))
    }
    const prev = new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-2,1)).toISOString().slice(0,7)
    const [last] = await r.query('SELECT amount_atomic::text FROM app.referral_risk_counters WHERE scope_key=\'platform\' AND bucket=$1', [prev])
    const baseline=BigInt(last?.amount_atomic ?? '0')
    const monthlyThreshold=baseline>0n ? baseline*BigInt(s.config.monthlyRiskMultiple) : BigInt(s.config.zeroBaselineRiskAtomic)
    const review=totals[0]>monthlyThreshold || totals[1]>BigInt(s.config.dailyRiskAtomic)
    if (review) await r.query(`INSERT INTO app.referral_audit(request_key,action,object_id,metadata) VALUES($1,'risk.review_required',$2,$3)`,
      [`risk:${sourceKey}`,eventId,JSON.stringify({ userId,dailyAtomic:totals[1].toString(),monthlyAtomic:totals[0].toString() })])
    return { duplicate:false, reviewRequired:review }
  }

  async reconcile() {
    await this.requireInstalled()
    const discrepancies = await this.db.query(`SELECT a.user_id,a.asset_code,b.amount_atomic::text AS projected_atomic,
      coalesce(l.current_atomic_balance,0)::text AS ledger_atomic,coalesce(e.total,0)::text AS entries_atomic
      FROM app.referral_credit_accounts a LEFT JOIN app.credit_balances b USING(user_id,asset_code)
      LEFT JOIN app.ledger_account_balances l ON l.account_id=a.ledger_account_id
      LEFT JOIN (SELECT user_id,asset_code,sum(delta_atomic) AS total FROM app.credit_entries GROUP BY user_id,asset_code) e USING(user_id,asset_code)
      WHERE b.amount_atomic IS NULL OR b.amount_atomic<>coalesce(l.current_atomic_balance,0) OR b.amount_atomic<>coalesce(e.total,0)`)
    const [summary] = await this.db.query('SELECT count(*)::int AS mapped_accounts FROM app.referral_credit_accounts')
    return { mappedAccounts:summary.mapped_accounts, discrepancyCount:discrepancies.length, discrepancies }
  }
}
