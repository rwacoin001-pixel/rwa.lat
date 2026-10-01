import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { FreeContractPriceClient } from './free-contract-price.client'
import { ContractTokenQuote, contractCoin, QuoteBinding, QUOTE_REFRESH_MS, verifiedAutomaticQuote } from './automatic-quote'

@Injectable()
export class AutomaticQuoteWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(AutomaticQuoteWorker.name)
  private timer?: ReturnType<typeof setInterval>
  private running = false
  constructor(private readonly db: DataSource, private readonly client: FreeContractPriceClient, private readonly config: ConfigService) {}
  onApplicationBootstrap() {
    if (this.config.get<string>('CATALOG_AUTO_QUOTES_ENABLED') !== 'true') return
    this.timer = setInterval(() => void this.tick(), QUOTE_REFRESH_MS)
    this.timer.unref()
    void this.tick()
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer) }
  async tick(): Promise<number> {
    if (this.running || this.config.get<string>('CATALOG_AUTO_QUOTES_ENABLED') !== 'true') return 0
    this.running = true
    const runner = this.db.createQueryRunner()
    try {
      await runner.connect()
      await runner.startTransaction()
      const [lock] = await runner.query('SELECT pg_try_advisory_xact_lock(1790840000) AS acquired')
      if (!lock.acquired) { await runner.rollbackTransaction(); return 0 }
      const rows: Array<{ id: string; asset_code: string; quote_binding_json: QuoteBinding }> = await runner.query(`
        SELECT id,asset_code,quote_binding_json FROM app.products
        WHERE state IN ('draft','published') AND quote_binding_json->>'enabled'='true'
          AND (quote_sync_checked_at IS NULL OR quote_sync_checked_at<=now()-interval '5 minutes')
        ORDER BY quote_sync_checked_at NULLS FIRST,id LIMIT 250`)
      let inserted = 0
      for (let offset = 0; offset < rows.length; offset += 50) {
        const batch = rows.slice(offset, offset + 50)
        let tokens: ContractTokenQuote[] = []
        let upstreamFailed = false
        try {
          const result = await this.client.get(batch.map(row => contractCoin(row.quote_binding_json)))
          if (!Array.isArray(result)) throw new Error('Invalid token quote response')
          tokens = result
        } catch { upstreamFailed = true }
        for (const row of batch) {
          const binding = row.quote_binding_json
          const quote = verifiedAutomaticQuote(binding, tokens.find(token => token.coin === contractCoin(binding)), new Date())
          const error = upstreamFailed ? 'QUOTE_PROVIDER_UNAVAILABLE' : quote ? null : 'QUOTE_IDENTITY_OR_FRESHNESS_INVALID'
          // Lock and recheck after the network request. An administrator may have changed the binding meanwhile.
          const [current] = await runner.query('SELECT quote_binding_json,asset_code,state FROM app.products WHERE id=$1 FOR UPDATE', [row.id])
          if (!['draft','published'].includes(current?.state) || current.asset_code !== row.asset_code
            || current.quote_binding_json?.bindingId !== binding.bindingId || current.quote_binding_json?.enabled !== true) continue
          if (quote) {
            const result = await runner.query(`INSERT INTO app.price_quotes
              (id,product_id,asset_code,unit_price_atomic_amount,unit_price_decimals,currency,source,captured_at,valid_until)
              VALUES($1,$2,$3,$4,18,'USD',$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
              [randomUUID(),row.id,row.asset_code,quote.atomic,quote.source,quote.capturedAt,quote.validUntil])
            inserted += result.length
          }
          await runner.query('UPDATE app.products SET quote_sync_checked_at=now(),quote_sync_error=$2 WHERE id=$1', [row.id,error])
        }
      }
      await runner.commitTransaction()
      return inserted
    } catch {
      if (runner.isTransactionActive) await runner.rollbackTransaction()
      this.log.warn('Automatic quote refresh failed; previous source timestamps are unchanged.')
      return 0
    } finally { await runner.release(); this.running = false }
  }
}
