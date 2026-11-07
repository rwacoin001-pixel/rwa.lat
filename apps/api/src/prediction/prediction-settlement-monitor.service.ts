import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { inspectPredictionResolution } from './prediction-resolution'

export const SETTLEMENT_QUEUE = 'prediction_settlement'
const HEALTH_KEY = 'prediction:settlement:health'
export type SettlementJob = { id: string; payload: { marketId: string }; attempts: number; max_attempts?: number; worker_id: string }

@Injectable()
export class PredictionSettlementMonitorService {
  constructor(private readonly ds: DataSource) {}

  async confirmed(marketId: string) {
    const [row] = await this.ds.query(`SELECT s.id,s.raw_payload,t.token_id AS "winnerTokenId",m.gamma_market_id,m.condition_id FROM app.polymarket_settlement_mappings s
      JOIN app.polymarket_market_mappings m ON m.id=s.market_mapping_id AND m.state='resolved'
      JOIN app.polymarket_token_mappings t ON t.id=s.winning_token_mapping_id AND t.market_mapping_id=s.market_mapping_id
      WHERE s.market_mapping_id=$1 AND s.state='confirmed' AND s.provider='polymarket' AND s.payout_value=1
        AND s.outcome=t.outcome AND t.state='resolved'`, [marketId])
    if (!row || !row.raw_payload) return false
    const tokens = await this.ds.query('SELECT token_id,outcome,outcome_index FROM app.polymarket_token_mappings WHERE market_mapping_id=$1 ORDER BY outcome_index', [marketId])
    const result = inspectPredictionResolution(row.raw_payload, {
      gammaMarketId: row.gamma_market_id, conditionId: row.condition_id,
      tokens: tokens.map((token: { token_id: string; outcome: string; outcome_index: number }) => ({ tokenId: token.token_id, outcome: token.outcome, outcomeIndex: token.outcome_index })),
    })
    return result.status === 'resolved' && result.winnerTokenId === row.winnerTokenId
  }

  async alreadySettled(marketId: string) {
    const [row] = await this.ds.query('SELECT id FROM app.prediction_settlement_runs WHERE market_mapping_id=$1', [marketId])
    return Boolean(row)
  }

  async beginSettlement(job: SettlementJob): Promise<boolean> {
    const rows = await this.ds.query(`UPDATE app.job_queue SET payload=payload||'{"stage":"settling"}'::jsonb
      WHERE id=$1 AND worker_id=$2 AND state='running' AND lease_expires_at>now() RETURNING id`, [job.id, job.worker_id])
    return (Array.isArray(rows[0]) ? rows[0] : rows).length > 0
  }

  async seed() {
    await this.ds.query(`INSERT INTO app.job_queue (queue_name,payload,dedup_key,max_attempts,run_at)
      SELECT $1,jsonb_build_object('marketId',m.id,'stage','waiting_result'), 'prediction:settlement:'||m.id,8,
        now()
      FROM app.polymarket_market_mappings m
      WHERE EXISTS(SELECT 1 FROM app.prediction_bets b WHERE b.market_mapping_id=m.id AND b.status='placed')
        AND NOT EXISTS(SELECT 1 FROM app.prediction_settlement_runs r WHERE r.market_mapping_id=m.id)
      ON CONFLICT(dedup_key) DO NOTHING`, [SETTLEMENT_QUEUE])
  }

  async claim(workerId: string): Promise<SettlementJob[]> {
    return this.ds.transaction(async tx => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('prediction-job-claim',0))")
      await tx.query(`UPDATE app.job_queue SET state='dead',last_error='execution-lease-expired',locked_at=NULL,lease_expires_at=NULL,worker_id=NULL,
        payload=payload||'{"stage":"failed"}'::jsonb
        WHERE queue_name=$1 AND state='running' AND lease_expires_at<=now() AND attempts>=max_attempts`, [SETTLEMENT_QUEUE])
      const rows = await tx.query(`UPDATE app.job_queue SET state='running',attempts=attempts+1,locked_at=now(),
        lease_expires_at=now()+interval '90 seconds',worker_id=$2
        WHERE id IN(SELECT j.id FROM app.job_queue j LEFT JOIN app.polymarket_market_mappings m ON m.id::text=j.payload->>'marketId'
          WHERE j.queue_name=$1 AND j.run_at<=now() AND j.attempts<j.max_attempts
          AND (j.state='pending' OR (j.state='running' AND j.lease_expires_at<=now()))
          ORDER BY CASE WHEN m.state='resolved' THEN 0 WHEN m.market_end_at<=now() THEN 1 ELSE 2 END,j.run_at,j.created_at
          FOR UPDATE OF j SKIP LOCKED
          LIMIT greatest(0,2-(SELECT count(*) FROM app.job_queue WHERE queue_name=$1 AND state='running' AND lease_expires_at>now())))
        RETURNING id,payload,attempts,max_attempts,worker_id`, [SETTLEMENT_QUEUE, workerId])
      return Array.isArray(rows[0]) ? rows[0] : rows
    })
  }

  async finish(job: SettlementJob, stage: 'waiting_result' | 'settled' | 'review' | 'failed', reason?: string) {
    const failed = stage === 'failed'
    const state = stage === 'settled' ? 'completed' : stage === 'review' || (failed && job.attempts >= (job.max_attempts ?? 8)) ? 'dead' : 'pending'
    const delay = failed ? Math.min(3600, 60 * 2 ** Math.min(job.attempts - 1, 6)) : 300
    await this.ds.query(`UPDATE app.job_queue SET state=$3,run_at=now()+make_interval(secs=>$4),
      attempts=CASE WHEN $5 THEN attempts ELSE 0 END,last_error=$6,
      completed_at=CASE WHEN $3='completed' THEN now() ELSE NULL END,
      locked_at=NULL,lease_expires_at=NULL,worker_id=NULL,
      payload=payload||jsonb_build_object('stage',$7::text,'lastCheckedAt',now())
      WHERE id=$1 AND state='running' AND worker_id=$2 AND lease_expires_at>now()`,
    [job.id, job.worker_id, state, delay, failed, failed || stage === 'review' ? reason ?? null : null, stage])
  }

  async beat(enabled: boolean, details: Record<string, unknown>) {
    await this.ds.query(`INSERT INTO app.job_queue(queue_name,dedup_key,state,payload,completed_at)
      VALUES('prediction_settlement_health',$1,'completed',$2::jsonb||jsonb_build_object('heartbeatAt',now(),'enabled',$3::boolean),now())
      ON CONFLICT(dedup_key) DO UPDATE SET payload=app.job_queue.payload||EXCLUDED.payload,completed_at=now()`,
    [HEALTH_KEY, JSON.stringify(details), enabled])
  }

  async reconcile(force = false) {
    const [health] = await this.ds.query(`SELECT payload FROM app.job_queue WHERE dedup_key=$1`, [HEALTH_KEY])
    if (!force && health?.payload?.auditCheckedAt && !health.payload.auditError && Date.now() - Date.parse(health.payload.auditCheckedAt) < 15 * 60_000) return
    const report = await this.ds.transaction('REPEATABLE READ', async tx => {
      await tx.query('SET TRANSACTION READ ONLY')
      const [orders] = await tx.query(`WITH movement AS (
        SELECT t.reference_id,
          sum(e.atomic_amount) FILTER(WHERE t.transaction_type='prediction_stake' AND e.side='debit') AS stake,
          sum(e.atomic_amount) FILTER(WHERE t.transaction_type='prediction_void_refund' AND e.side='debit') AS refund,
          count(DISTINCT t.id) FILTER(WHERE t.transaction_type='prediction_payout') AS payouts
        FROM app.ledger_transactions t JOIN app.ledger_entries e ON e.transaction_id=t.id
        WHERE t.transaction_type IN('prediction_stake','prediction_payout','prediction_void_refund') GROUP BY t.reference_id
      ), credits AS (
        SELECT t.reference_id,a.user_id,sum(e.atomic_amount) AS paid FROM app.ledger_transactions t
        JOIN app.ledger_entries e ON e.transaction_id=t.id JOIN app.ledger_accounts a ON a.id=e.account_id
        WHERE t.transaction_type='prediction_payout' AND e.side='credit' AND a.purpose='available' GROUP BY t.reference_id,a.user_id
      ), checked AS (SELECT b.id,(
        movement.stake IS DISTINCT FROM b.stake_atomic OR movement.payouts>1
        OR (b.status='won' AND coalesce(credits.paid,0)<>floor(b.shares*1e6)-b.payout_fee_atomic)
        OR (b.status IN('lost','placed') AND coalesce(credits.paid,0)<>0)
        OR (b.status='void' AND coalesce(movement.refund,0)<>b.stake_atomic-b.fee_atomic)
        OR (b.status<>'placed' AND (b.settled_at IS NULL OR r.id IS NULL))
        OR (b.status='placed' AND r.id IS NOT NULL)
        OR (b.status='won' AND b.token_id IS DISTINCT FROM r.winning_token_id)
        OR (b.status='lost' AND b.token_id=r.winning_token_id)) AS mismatch
        FROM app.prediction_bets b LEFT JOIN movement ON movement.reference_id=b.id
        LEFT JOIN credits ON credits.reference_id=b.id AND credits.user_id=b.user_id
        LEFT JOIN app.prediction_settlement_runs r ON r.market_mapping_id=b.market_mapping_id)
        SELECT count(*)::int AS "checkedOrders",count(*) FILTER(WHERE mismatch)::int AS "orderMismatches",
          (array_agg(id) FILTER(WHERE mismatch))[1:50] AS "affectedOrderIds" FROM checked`)
      const [ledger] = await tx.query(`SELECT count(*)::int AS "unbalancedTransactions",(array_agg(id))[1:50] AS "unbalancedTransactionIds" FROM (
        SELECT t.id FROM app.ledger_transactions t JOIN app.ledger_entries e ON e.transaction_id=t.id
        WHERE t.transaction_type LIKE 'prediction_%' GROUP BY t.id
        HAVING sum(CASE e.side WHEN 'debit' THEN e.atomic_amount ELSE -e.atomic_amount END)<>0) bad`)
      return { ...orders, ...ledger }
    })
    if (report.orderMismatches > 0 || report.unbalancedTransactions > 0) {
      await this.ds.query(`INSERT INTO app.job_queue(queue_name,dedup_key,state,payload,completed_at)
        VALUES('prediction_settlement_audit',$1,'completed',$2::jsonb,now()) ON CONFLICT(dedup_key) DO NOTHING`,
      [`prediction:audit:${Math.floor(Date.now() / 900_000)}`, JSON.stringify({ ...report, checkedAt: new Date().toISOString() })])
    }
    await this.beat(true, { audit: report, auditCheckedAt: new Date().toISOString(), auditError: false })
  }

  async status() {
    const [health] = await this.ds.query(`SELECT payload FROM app.job_queue WHERE dedup_key=$1`, [HEALTH_KEY])
    const [pending] = await this.ds.query(`SELECT count(*)::int AS count,min(s.confirmed_at) AS "oldestAt",
      count(*) FILTER(WHERE s.confirmed_at<now()-interval '5 minutes')::int AS overdue
      FROM app.prediction_bets b JOIN app.polymarket_settlement_mappings s ON s.market_mapping_id=b.market_mapping_id
      WHERE b.status='placed' AND s.state='confirmed'`)
    const jobs = await this.ds.query(`SELECT j.id,j.state,j.attempts,j.last_error AS "lastError",j.run_at AS "nextRunAt",
      j.payload,m.question,m.market_end_at AS "marketEndAt",s.confirmed_at AS "confirmedAt"
      FROM app.job_queue j LEFT JOIN app.polymarket_market_mappings m ON m.id::text=j.payload->>'marketId'
      LEFT JOIN app.polymarket_settlement_mappings s ON s.market_mapping_id=m.id
      WHERE j.queue_name=$1 ORDER BY CASE WHEN j.state='dead' THEN 0 WHEN j.state='running' THEN 1 WHEN j.state='pending' THEN 2 ELSE 3 END,j.run_at LIMIT 100`, [SETTLEMENT_QUEUE])
    const [counts] = await this.ds.query(`SELECT count(*) FILTER(WHERE state='dead' OR (state IN('pending','running') AND attempts>=3))::int AS failed,
      count(*) FILTER(WHERE state='dead' AND payload->>'stage'='review')::int AS review,
      count(*) FILTER(WHERE state='pending' AND payload->>'stage'='waiting_result')::int AS "waitingResults"
      FROM app.job_queue WHERE queue_name=$1`, [SETTLEMENT_QUEUE])
    const h = health?.payload
    const workerHealthy = h?.enabled === true && !h.lastError && Number.isFinite(Date.parse(h.heartbeatAt)) && Date.now() - Date.parse(h.heartbeatAt) < 180_000
    const reconciliationMismatches = h?.audit ? Number(h.audit.orderMismatches) + Number(h.audit.unbalancedTransactions) : 0
    const auditHealthy = Boolean(h?.auditCheckedAt) && !h.auditError && Date.now() - Date.parse(h.auditCheckedAt) < 20 * 60_000
    const auditIncidents = await this.ds.query(`SELECT id,payload,completed_at AS "checkedAt" FROM app.job_queue
      WHERE queue_name='prediction_settlement_audit' ORDER BY completed_at DESC LIMIT 20`)
    return { ...pending, ...counts, workerHealthy, auditHealthy, reconciliationMismatches, health: h ?? null, jobs, auditIncidents }
  }

  async retry(id: string, actor: string) {
    return this.ds.transaction(async tx => {
      const [job] = await tx.query('SELECT * FROM app.job_queue WHERE id=$1 AND queue_name=$2 FOR UPDATE', [id, SETTLEMENT_QUEUE])
      if (!job) throw new NotFoundException('Settlement task not found')
      if (!['pending', 'dead'].includes(job.state)) throw new ConflictException('This task is already running or completed')
      const retryHistory = [...(Array.isArray(job.payload.retryHistory) ? job.payload.retryHistory.slice(-49) : []), { actor, at: new Date().toISOString() }]
      await tx.query(`UPDATE app.job_queue SET state='pending',attempts=0,last_error=NULL,run_at=now(),locked_at=NULL,lease_expires_at=NULL,worker_id=NULL,
        payload=payload||$2::jsonb WHERE id=$1`, [id, JSON.stringify({ stage: 'waiting_result', retryHistory })])
      return { queued: true }
    })
  }
}
