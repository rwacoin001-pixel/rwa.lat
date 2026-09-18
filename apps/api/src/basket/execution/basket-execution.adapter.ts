import { Injectable } from '@nestjs/common'
import type { BasketExecutionRoute } from '../basket.entities'

export type ExecutionOrderInput = {
  id: string
  assetId: string
  side: 'buy' | 'sell'
  targetQuantity: string
  estimatedPrice: string | null
  maxSlippagePct: string | null
}

export type ExecutionFillResult = {
  executedQuantity: string
  averageFillPrice: string
  externalOrderId: string | null
  route: BasketExecutionRoute
}

/**
 * 执行适配器接口（规格 §85-90；Phase 14 —— 接口先行，不接真实资金）。
 * - manual：人工在场外完成，随后通过 recordFill 回填（生产默认）
 * - paper：模拟成交（演示/测试），按估计价成交
 * - 真实路由（dex/cex/issuer/broker/otc）为后续版本预留——本版本不实现任何
 *   链上/交易所下单能力；真实执行另挂 operational switch 并遵循资金控制体系。
 */
export interface BasketExecutionAdapter {
  readonly name: string
  readonly route: BasketExecutionRoute
  /** 返回成交回执；返回 null 表示等待人工回填（manual） */
  executeOrder(order: ExecutionOrderInput): Promise<ExecutionFillResult | null>
}

@Injectable()
export class ManualExecutionAdapter implements BasketExecutionAdapter {
  readonly name = 'manual'
  readonly route = 'manual' as const

  async executeOrder(): Promise<ExecutionFillResult | null> {
    return null
  }
}

@Injectable()
export class PaperExecutionAdapter implements BasketExecutionAdapter {
  readonly name = 'paper'
  readonly route = 'manual' as const

  async executeOrder(order: ExecutionOrderInput): Promise<ExecutionFillResult | null> {
    if (!order.estimatedPrice) return null
    return {
      executedQuantity: order.targetQuantity,
      averageFillPrice: order.estimatedPrice,
      externalOrderId: `paper:${order.id}`,
      route: 'manual',
    }
  }
}

@Injectable()
export class DisabledExecutionAdapter implements BasketExecutionAdapter {
  readonly name = 'disabled'
  readonly route = 'manual' as const

  async executeOrder(): Promise<ExecutionFillResult | null> {
    throw new Error('Basket execution adapter is disabled in this deployment')
  }
}
