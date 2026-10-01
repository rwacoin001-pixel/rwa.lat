import { Module } from '@nestjs/common'
import { MarketCacheService } from './market-cache.service'
import { MarketContextController } from './market-context.controller'
import { MarketContextService } from './market-context.service'
import { CoinGeckoProvider } from './providers/coingecko.provider'
import { DefiLlamaProvider } from './providers/defillama.provider'
import { FrankfurterProvider } from './providers/frankfurter.provider'
import { OkxProvider } from './providers/okx.provider'
import { YahooProvider } from './providers/yahoo.provider'

/**
 * Market Context 模块 — 真实世界行情统一适配层
 *
 * 圆桌第 3 场裁定架构：
 * - 前端禁止直连供应商，全部经本模块输出标准化 quote
 * - 缓存分级 + SWR + 熔断（MarketCacheService）
 * - 供应商：Yahoo / Frankfurter / OKX（主）+ CoinGecko（兜底）/ DefiLlama（全部免费无 key）
 *   CoinGecko 匿名接口按 IP 限流会返回 429（实测间歇性），故降级为兜底源
 */
@Module({
  controllers: [MarketContextController],
  providers: [
    MarketCacheService,
    MarketContextService,
    YahooProvider,
    FrankfurterProvider,
    OkxProvider,
    CoinGeckoProvider,
    DefiLlamaProvider,
  ],
  exports: [MarketContextService],
})
export class MarketContextModule {}
