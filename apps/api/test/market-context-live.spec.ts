/**
 * market-context LIVE 集成测试（真实网络）
 *
 * 运行：MARKET_CONTEXT_LIVE=1 npx jest test/market-context-live.spec.ts --runInBand
 * 默认跳过：依赖外部网络，不应让常规单测因第三方接口波动失败。
 * 目的：验证统一适配层能从 4 个免费源拉到真实数据并正确标准化
 */
import { MarketCacheService } from '../src/market-context/market-cache.service'
import { YahooProvider } from '../src/market-context/providers/yahoo.provider'
import { FrankfurterProvider } from '../src/market-context/providers/frankfurter.provider'
import { OkxProvider } from '../src/market-context/providers/okx.provider'
import { CoinGeckoProvider } from '../src/market-context/providers/coingecko.provider'
import { DefiLlamaProvider } from '../src/market-context/providers/defillama.provider'
import { MarketContextService } from '../src/market-context/market-context.service'

const describeLive = process.env.MARKET_CONTEXT_LIVE === '1' ? describe : describe.skip

describeLive('market-context live providers', () => {
  jest.setTimeout(120_000)

  function buildService(): MarketContextService {
    return new MarketContextService(
      new MarketCacheService(),
      new YahooProvider(),
      new FrankfurterProvider(),
      new OkxProvider(),
      new CoinGeckoProvider(),
      new DefiLlamaProvider(),
    )
  }

  it('getContext() 返回真实数据（锚点/FX/加密/链上）', async () => {
    const svc = buildService()
    const ctx = await svc.getContext()
    // 打印全量供人工核对
    console.log('=== MARKET CONTEXT ===')
    console.log(JSON.stringify(ctx, null, 2))

    // 锚点 2×2（^TNX / DXY / GC=F / ^GSPC）
    expect(ctx.anchors.length).toBeGreaterThanOrEqual(3)
    const symbols = ctx.anchors.map((q) => q.symbol)
    expect(symbols).toContain('^TNX')
    expect(symbols).toContain('^GSPC')
    for (const q of ctx.anchors) {
      expect(q.value).not.toBeNull()
      expect(q.source).toBe('Yahoo Finance')
      expect(q.disclaimer).toContain('非执行报价')
    }

    // 加密 + USDT 脱锚
    expect(ctx.sections.crypto.length).toBeGreaterThanOrEqual(2)
    expect(ctx.usdtPeg).not.toBeNull()
    expect(['ok', 'warning', 'depegged']).toContain(ctx.usdtPeg?.status)

    // 链上（TVL + 稳定币）
    expect(ctx.sections.onchain.length).toBeGreaterThanOrEqual(1)

    // 每条行情必须带审计字段
    for (const q of [...ctx.anchors, ...ctx.secondary, ...ctx.sections.crypto]) {
      expect(q.receivedAt).toBeTruthy()
      expect(q.quoteId).toBeTruthy()
      expect(typeof q.stale).toBe('boolean')
    }
  })

  it('缓存命中应显著快于冷启动（P95 < 300ms 目标）', async () => {
    const svc = buildService()
    await svc.getContext() // 预热
    const t0 = Date.now()
    await svc.getContext()
    const elapsed = Date.now() - t0
    console.log('缓存命中耗时:', elapsed, 'ms')
    expect(elapsed).toBeLessThan(300)
  })
})
