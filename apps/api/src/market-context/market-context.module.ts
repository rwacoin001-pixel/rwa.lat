import { Module } from '@nestjs/common'
import { MarketCacheService } from './market-cache.service'
import { MarketContextController } from './market-context.controller'
import { MarketContextService } from './market-context.service'
import { CoinGeckoProvider } from './providers/coingecko.provider'
import { DefiLlamaProvider } from './providers/defillama.provider'
import { FrankfurterProvider } from './providers/frankfurter.provider'
import { YahooProvider } from './providers/yahoo.provider'

/**
 * Market Context 模块 — 真实世界行情统一适配层
 *
 * 圆桌第 3 场裁定架构：
 * - 前端禁止直连供应商，全部经本模块输出标准化 quote
 * - 缓存分级 + SWR + 熔断（MarketCacheService）
 * - 供应商：Yahoo / Frankfurter / CoinGecko / DefiLlama（全部免费无 key）
 */
@Module({
  controllers: [MarketContextController],
  providers: [
    MarketCacheService,
    MarketContextService,
    YahooProvider,
    FrankfurterProvider,
    CoinGeckoProvider,
    DefiLlamaProvider,
  ],
  exports: [MarketContextService],
})
export class MarketContextModule {}
