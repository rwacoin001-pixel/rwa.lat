import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { LedgerModule } from '../ledger/ledger.module'
import { OperationsModule } from '../operations/operations.module'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { BASKET_EXECUTION_ADAPTER_TOKEN } from './basket.constants'
import { BasketOpsWorker } from './basket.ops.worker'
import { BasketNavService } from './basket.nav.service'
import { BasketController } from './basket.controller'
import {
  BasketHolding,
  BasketNavSnapshot,
  BasketPortfolio,
  BasketRebalanceOrder,
  BasketRebalanceRun,
  BasketRedemption,
  BasketStrategy,
  BasketStrategyAsset,
  BasketStrategyVersion,
  BasketSubscription,
  RiskDisclosure,
  UserRiskAcknowledgement,
} from './basket.entities'
import { InternalBasketController } from './basket-internal.controller'
import {
  DisabledExecutionAdapter,
  ManualExecutionAdapter,
  PaperExecutionAdapter,
  type BasketExecutionAdapter,
} from './execution/basket-execution.adapter'
import { BasketPortfolioService } from './portfolio.service'
import { BasketRebalanceService } from './rebalance.service'
import { BasketReconciliationService } from './reconciliation.service'
import { BasketRiskService } from './risk.service'
import { BasketStrategyService } from './strategy.service'
import { BasketSubscriptionService } from './subscription.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BasketStrategy,
      BasketStrategyVersion,
      BasketStrategyAsset,
      BasketPortfolio,
      BasketHolding,
      BasketNavSnapshot,
      BasketSubscription,
      BasketRedemption,
      BasketRebalanceRun,
      BasketRebalanceOrder,
      RiskDisclosure,
      UserRiskAcknowledgement,
    ]),
    JobQueueModule,
    LedgerModule,
    OperationsModule,
  ],
  controllers: [BasketController, InternalBasketController],
  providers: [
    BasketStrategyService,
    BasketPortfolioService,
    BasketNavService,
    BasketRiskService,
    BasketSubscriptionService,
    BasketRebalanceService,
    BasketReconciliationService,
    BasketOpsWorker,
    InternalServiceGuard,
    ManualExecutionAdapter,
    PaperExecutionAdapter,
    DisabledExecutionAdapter,
    {
      // 适配器选择：manual（默认，人工回填）/ paper（模拟成交，演示与测试）/ disabled（拒绝执行）
      // 真实路由（dex/cex/issuer/broker/otc）本版本未实现——环境变量不能借名启用未安装的能力。
      provide: BASKET_EXECUTION_ADAPTER_TOKEN,
      inject: [ConfigService, ManualExecutionAdapter, PaperExecutionAdapter, DisabledExecutionAdapter],
      useFactory: (
        config: ConfigService,
        manual: ManualExecutionAdapter,
        paper: PaperExecutionAdapter,
        disabled: DisabledExecutionAdapter,
      ): BasketExecutionAdapter => {
        const mode = (config.get<string>('BASKET_EXECUTION_ADAPTER') ?? 'manual').trim().toLowerCase()
        if (mode === '' || mode === 'manual') return manual
        if (mode === 'paper') return paper
        if (mode === 'disabled') return disabled
        throw new Error(`BASKET_EXECUTION_ADAPTER=${mode} is not installed in this release image`)
      },
    },
  ],
  exports: [
    BasketStrategyService,
    BasketPortfolioService,
    BasketNavService,
    BasketRiskService,
    BasketSubscriptionService,
    BasketRebalanceService,
    BasketReconciliationService,
  ],
})
export class BasketModule {}
