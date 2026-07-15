import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { POLYMARKET_READ_ADAPTER } from './polymarket-adapter.interface'
import { AdminPolymarketController, PolymarketController } from './polymarket.controller'
import {
  PolymarketExternalEvent,
  PolymarketMarketMapping,
  PolymarketOrderMapping,
  PolymarketReconciliationCase,
  PolymarketSettlementMapping,
  PolymarketSyncWatermark,
  PolymarketTokenMapping,
} from './polymarket.entities'
import { PolymarketPublicAdapter } from './polymarket-public.adapter'
import { PolymarketService } from './polymarket.service'

@Module({
  imports: [
    AdminRbacModule,
    TypeOrmModule.forFeature([
      PolymarketMarketMapping,
      PolymarketTokenMapping,
      PolymarketSyncWatermark,
      PolymarketOrderMapping,
      PolymarketExternalEvent,
      PolymarketSettlementMapping,
      PolymarketReconciliationCase,
    ]),
  ],
  controllers: [PolymarketController, AdminPolymarketController],
  providers: [
    PolymarketPublicAdapter,
    PolymarketService,
    { provide: POLYMARKET_READ_ADAPTER, useExisting: PolymarketPublicAdapter },
  ],
  exports: [PolymarketService, POLYMARKET_READ_ADAPTER],
})
export class PolymarketModule {}
