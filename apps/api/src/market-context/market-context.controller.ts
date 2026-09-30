import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { MarketContextService } from './market-context.service'

/**
 * Market Context 公开接口
 *
 * GET /v1/market-context
 * - 公开行情数据（指数/利率/黄金/外汇/加密/链上），无需登录
 * - 全部数据带来源、时间戳与"非执行报价"标注（圆桌第 3 场信任红线）
 * - 绝不作为成交价使用；订单成交以后端产品报价 + validUntil 为准
 */
@ApiTags('market-context')
@Controller('market-context')
export class MarketContextController {
  constructor(private readonly marketContext: MarketContextService) {}

  @Get()
  @ApiOperation({
    summary: 'Real-world market context: anchors (UST10Y/DXY/Gold/SP500), FX, crypto, on-chain',
  })
  getContext() {
    return this.marketContext.getContext()
  }
}
