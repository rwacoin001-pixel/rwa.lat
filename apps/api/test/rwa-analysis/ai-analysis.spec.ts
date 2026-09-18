import { BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AiAnalysisProvider, parseAnalysisJson } from '../../src/rwa-analysis/ai-analysis.provider'
import { AiAnalysisService } from '../../src/rwa-analysis/ai-analysis.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describe('ai analysis JSON parsing', () => {
  it('parses strict JSON', () => {
    const parsed = parseAnalysisJson('{"summary":"ok","signals":{"sentiment":"neutral"}}')
    expect(parsed.summary).toBe('ok')
    expect(parsed.structured_signals).toEqual({ sentiment: 'neutral' })
  })

  it('parses fenced and prefixed JSON', () => {
    const fenced = parseAnalysisJson('```json\n{"summary":"fenced","bull_case":"b"}\n```')
    expect(fenced.summary).toBe('fenced')
    expect(fenced.bull_case).toBe('b')

    const prefixed = parseAnalysisJson('Here is the analysis:\n{"summary":"prefixed"}\nDone.')
    expect(prefixed.summary).toBe('prefixed')
  })

  it('rejects unparseable content', () => {
    expect(() => parseAnalysisJson('not json at all')).toThrow()
  })
})

describeDatabase('ai analysis integration (stubbed LLM)', () => {
  let ds: DataSource
  let assetId: string

  const cleanup = async () => {
    await ds.query(`DELETE FROM app.rwa_assets WHERE slug = 't4-alpha'`)
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (ds?.isInitialized) {
      await cleanup()
      await ds.destroy()
    }
  })

  beforeEach(async () => {
    await cleanup()
    assetId = (
      (await ds.query(
        `INSERT INTO app.rwa_assets (slug, name, asset_class, is_tokenized, rwa_rank)
         VALUES ('t4-alpha', 'T4 Alpha', 'treasury', true, 0) RETURNING id`,
      )) as Array<{ id: string }>
    )[0].id
    await ds.query(
      `INSERT INTO app.rwa_asset_metrics (asset_id, price_usd, tokenized_market_cap_usd, volume_24h_usd, data_timestamp, source)
       VALUES ($1, 101.25, 8000000, 300000, now(), 'test')`,
      [assetId],
    )
  })

  it('stores a stubbed analysis and skips fresh assets on re-run', async () => {
    const calls: string[] = []
    const stub = {
      model: 'stub-model',
      isConfigured: () => true,
      analyze: async (input: { name: string }) => {
        calls.push(input.name)
        return {
          summary: 'Solid tokenized treasury exposure.',
          bull_case: 'Backed by short-duration T-bills.',
          bear_case: 'Yield compresses if rates fall.',
          risk_summary: 'Low duration risk.',
          liquidity_analysis: 'Deep secondary liquidity.',
          issuer_analysis: null,
          redemption_analysis: null,
          contract_analysis: null,
          structured_signals: { sentiment: 'neutral', key_risks: ['rate cuts'], catalysts: ['new issuance'], confidence: 0.62 },
        }
      },
    }
    const service = new AiAnalysisService(ds, stub as unknown as AiAnalysisProvider)

    const first = await service.runBatch(1)
    expect(first.analyzed).toBe(1)
    expect(calls).toEqual(['T4 Alpha']) // rank=0 → 批次第一位

    const latest = await service.getLatestForAsset(assetId)
    expect(latest).not.toBeNull()
    expect(latest!.summary).toBe('Solid tokenized treasury exposure.')
    expect(latest!.model).toBe('stub-model')
    expect((latest!.structuredSignals as Record<string, unknown>).sentiment).toBe('neutral')

    await service.runBatch(1)
    expect(calls.filter((name) => name === 'T4 Alpha')).toHaveLength(1) // 7 天新鲜度内跳过

    const recent = await service.listRecent(10)
    expect((recent as Array<Record<string, any>>).some((row) => row.slug === 't4-alpha')).toBe(true)
  })

  it('rejects batches when the provider is not configured', async () => {
    const stub = {
      model: 'stub',
      isConfigured: () => false,
      analyze: async () => {
        throw new Error('should not be called')
      },
    }
    const service = new AiAnalysisService(ds, stub as unknown as AiAnalysisProvider)
    await expect(service.runBatch(1)).rejects.toBeInstanceOf(BadRequestException)
  })
})
