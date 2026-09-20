import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { OperationalCapabilityService } from './operational-capability.service'

/**
 * 公开能力状态端点：前端首屏用它驱动按钮可用性 / 暂停态文案。
 * 不返回无法保证的完成时间（no ETA）。
 */
@ApiTags('operations')
@Controller('capabilities')
export class OperationsController {
  constructor(private readonly capabilities: OperationalCapabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Aggregated capability states (invest/redeem/predict/deposit/withdraw/orders/yield) — public' })
  snapshot() {
    return this.capabilities.snapshot()
  }
}
