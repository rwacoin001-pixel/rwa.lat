import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PortfolioService } from './portfolio.service'
import { PortfolioController } from './portfolio.controller'
import { PositionSnapshot, Redemption } from './portfolio.entities'
import { LedgerModule } from '../ledger/ledger.module'
import { CatalogModule } from '../catalog/catalog.module'
import { SecurityModule } from '../security/security.module'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { PortfolioSnapshotWorker } from './portfolio-snapshot.worker'
import { OrdersModule } from '../orders/orders.module'
import { RebalanceService } from './rebalance.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([PositionSnapshot, Redemption]),
    LedgerModule,
    CatalogModule,
    SecurityModule,
    JobQueueModule,
    OrdersModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioSnapshotWorker, RebalanceService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
