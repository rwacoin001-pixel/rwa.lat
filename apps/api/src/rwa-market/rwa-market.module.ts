import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { CoinMarketCapClient } from './providers/coinmarketcap/coinmarketcap.client'
import { CoinMarketCapRwaProvider } from './providers/coinmarketcap/coinmarketcap.provider'
import { RWA_DATA_PROVIDER } from './rwa-market.constants'
import { InternalRwaMarketController } from './rwa-market-internal.controller'
import { RwaMarketController } from './rwa-market.controller'
import {
  RwaAsset,
  RwaAssetContract,
  RwaAssetMetric,
  RwaAssetMetricHistory,
  RwaAssetSource,
  RwaIssuer,
  RwaNetwork,
  RwaSyncRun,
} from './rwa-market.entities'
import { RwaMarketQueryService } from './rwa-market.query.service'
import { RwaMarketSyncService } from './rwa-market.sync.service'
import { RwaMarketSyncWorker } from './rwa-market.sync.worker'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RwaIssuer,
      RwaNetwork,
      RwaAsset,
      RwaAssetContract,
      RwaAssetSource,
      RwaAssetMetric,
      RwaAssetMetricHistory,
      RwaSyncRun,
    ]),
    JobQueueModule,
  ],
  controllers: [RwaMarketController, InternalRwaMarketController],
  providers: [
    CoinMarketCapClient,
    CoinMarketCapRwaProvider,
    { provide: RWA_DATA_PROVIDER, useExisting: CoinMarketCapRwaProvider },
    RwaMarketSyncService,
    RwaMarketQueryService,
    RwaMarketSyncWorker,
    InternalServiceGuard,
  ],
  exports: [RWA_DATA_PROVIDER, RwaMarketSyncService, RwaMarketQueryService],
})
export class RwaMarketModule {}
