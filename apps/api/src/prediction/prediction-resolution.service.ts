import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import { DataSource } from 'typeorm'
import { POLYMARKET_READ_ADAPTER, type PolymarketReadAdapter } from '../polymarket/polymarket-adapter.interface'
import { inspectPredictionResolution, type PredictionResolution, type PredictionResolutionMapping } from './prediction-resolution'

type Candidate = { id: string; gamma_market_id: string; condition_id: string | null }
type Token = { id: string; token_id: string; outcome: string; outcome_index: number; state: string }
const mapping = (market: Candidate, tokens: Token[]): PredictionResolutionMapping => ({
  gammaMarketId: market.gamma_market_id, conditionId: market.condition_id,
  tokens: tokens.map(t => ({ tokenId:t.token_id, outcome:t.outcome, outcomeIndex:t.outcome_index })),
})

/** Reconciles known pending bets, rather than the active-market discovery feed. */
@Injectable()
export class PredictionResolutionService {
  private readonly log = new Logger(PredictionResolutionService.name)
  readonly mode: 'observe' | 'apply'
  private afterId: string | null = null

  constructor(
    private readonly ds: DataSource,
    @Inject(POLYMARKET_READ_ADAPTER) private readonly adapter: PolymarketReadAdapter,
    config: ConfigService,
  ) {
    // Opt-in separately from the already enabled settlement worker. Safe for backlog review.
    this.mode = config.get<string>('PREDICTION_RESOLUTION_SYNC_MODE') === 'apply' ? 'apply' : 'observe'
  }

  async syncPendingMarkets(limit = 25) {
    const results: Array<{ marketId: string; status: string; reason?: string }> = []
    if (!this.adapter.isEnabled()) return results
    const batch = Math.max(1, Math.min(Math.trunc(limit) || 25, 100))
    const query = `SELECT m.id, m.gamma_market_id, m.condition_id
      FROM app.polymarket_market_mappings m
      WHERE ($1::uuid IS NULL OR m.id > $1::uuid) AND m.state NOT IN ('resolved','suspended')
        AND EXISTS (SELECT 1 FROM app.prediction_bets b WHERE b.market_mapping_id=m.id AND b.status='placed')
        AND NOT EXISTS (SELECT 1 FROM app.prediction_settlement_runs r WHERE r.market_mapping_id=m.id)
      ORDER BY m.id LIMIT $2`
    let candidates = await this.ds.query(query, [this.afterId, batch]) as Candidate[]
    if (!candidates.length && this.afterId) {
      this.afterId = null
      candidates = await this.ds.query(query, [null, batch]) as Candidate[]
    }
    // Rotate past unresolved/unsupported markets so they cannot starve later results.
    this.afterId = candidates.length === batch ? candidates[candidates.length - 1].id : null
    for (const market of candidates) {
      try {
        const record = await this.adapter.getMarketById(market.gamma_market_id)
        const tokens = await this.ds.query('SELECT * FROM app.polymarket_token_mappings WHERE market_mapping_id=$1 ORDER BY outcome_index', [market.id]) as Token[]
        const result = inspectPredictionResolution(record.rawPayload, mapping(market, tokens))
        if (result.status !== 'resolved' || this.mode === 'observe') {
          results.push({marketId:market.id, ...result})
          if (result.status === 'review') this.log.warn(`prediction resolution requires review market=${market.id} reason=${result.reason}`)
          continue
        }
        const applied = await this.apply(market.id, record.rawPayload)
        results.push({marketId:market.id, ...applied})
      } catch {
        // No external response bodies, request credentials or user data in logs.
        this.log.warn(`prediction resolution fetch/apply failed market=${market.id}; retry next pass`)
        results.push({marketId:market.id,status:'retry',reason:'resolution-sync-failed'})
      }
    }
    const finalCount = results.filter(r => r.status === 'resolved' || r.status === 'applied').length
    if (finalCount) this.log.log(`prediction resolution mode=${this.mode} final=${finalCount} checked=${results.length}`)
    return results
  }

  private async apply(marketId: string, payload: Record<string, unknown>): Promise<PredictionResolution | {status:'applied' | 'unchanged'}> {
    return this.ds.transaction(async manager => {
      // Same market lock as placement and settlement; never hold a DB lock across HTTP.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`prediction-settle:${marketId}`])
      const [market] = await manager.query('SELECT * FROM app.polymarket_market_mappings WHERE id=$1 FOR UPDATE', [marketId])
      if (!market || market.state === 'suspended') return {status:'review',reason:'market-suspended-or-missing'}
      const tokens = await manager.query('SELECT * FROM app.polymarket_token_mappings WHERE market_mapping_id=$1 ORDER BY outcome_index FOR UPDATE', [marketId]) as Token[]
      const result = inspectPredictionResolution(payload, mapping(market, tokens))
      if (result.status !== 'resolved') return result
      const [run] = await manager.query('SELECT id FROM app.prediction_settlement_runs WHERE market_mapping_id=$1', [marketId])
      const [previous] = await manager.query('SELECT * FROM app.polymarket_settlement_mappings WHERE market_mapping_id=$1', [marketId])
      const winner = tokens.find(t => t.token_id === result.winnerTokenId)!
      if (previous && (previous.winning_token_mapping_id !== winner.id
        || previous.state !== 'confirmed' || previous.provider !== 'polymarket'
        || previous.external_settlement_id !== `gamma-final:${market.gamma_market_id}`
        || previous.outcome !== winner.outcome || !/^1(?:\.0+)?$/.test(String(previous.payout_value)))) {
        return {status:'review',reason:'conflicting-existing-result'}
      }
      if (run || market.state === 'resolved' || tokens.some(t=>t.state==='resolved')) return {status:'unchanged'}
      const observedAt = new Date()
      const json = JSON.stringify(payload)
      const hash = createHash('sha256').update(json).digest()
      await manager.query(`INSERT INTO app.polymarket_external_events
        (provider,channel,external_event_key,event_type,market_condition_id,occurred_at,payload,payload_sha256,processing_state,processed_at)
        VALUES ('polymarket','rest_reconciliation',$1,'prediction.final_resolution',$2,$3,$4::jsonb,$5,'processed',$3)
        ON CONFLICT (provider,channel,external_event_key) DO NOTHING`,
      [`prediction-final:${market.gamma_market_id}:${result.winnerTokenId}`,market.condition_id,observedAt,json,hash])
      await manager.query(`INSERT INTO app.polymarket_settlement_mappings
        (market_mapping_id,external_settlement_id,winning_token_mapping_id,outcome,state,payout_value,resolved_at,confirmed_at,raw_payload)
        VALUES ($1,$2,$3,$4,'confirmed',1,$5,$5,$6::jsonb) ON CONFLICT (market_mapping_id) DO NOTHING`,
      [marketId,`gamma-final:${market.gamma_market_id}`,winner.id,winner.outcome,observedAt,json])
      await manager.query(`UPDATE app.polymarket_token_mappings
        SET state=CASE WHEN token_id=$2 THEN 'resolved' ELSE 'inactive' END,updated_at=now() WHERE market_mapping_id=$1`,[marketId,result.winnerTokenId])
      await manager.query(`UPDATE app.polymarket_market_mappings
        SET state='resolved',enable_order_book=false,raw_payload=$2::jsonb,last_synced_at=$3,updated_at=now() WHERE id=$1`,[marketId,json,observedAt])
      return {status:'applied'}
    })
  }
}
