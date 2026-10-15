import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityModule } from '../identity/identity.module'
import { OperationsModule } from '../operations/operations.module'
import { PolymarketModule } from '../polymarket/polymarket.module'
import { SecurityModule } from '../security/security.module'
import { ComplianceModule } from '../compliance/compliance.module'
import { InternalPredictionController } from './prediction-internal.controller'
import { PredictionController, PredictionUserController } from './prediction.controller'
import { PredictionBet, PredictionHedgeDecision, PredictionSettlementRun } from './prediction.entities'
import { PredictionFavorite } from './prediction-favorite.entity'
import { PredictionFavoriteService } from './prediction-favorite.service'
import { PredictionService } from './prediction.service'
import { PredictionSettlementWorker } from './prediction-settlement.worker'
import { PredictionResolutionService } from './prediction-resolution.service'
import { PredictionExposureService } from './prediction-exposure.service'
import { PredictionHedgeWorker } from './prediction-hedge.worker'

@Module({
  imports: [
    TypeOrmModule.forFeature([PredictionBet, PredictionSettlementRun, PredictionHedgeDecision, PredictionFavorite]),
    IdentityModule,
    OperationsModule,
    PolymarketModule,
    SecurityModule,
    ComplianceModule,
  ],
  controllers: [PredictionController, PredictionUserController, InternalPredictionController],
  providers: [PredictionService, PredictionSettlementWorker, PredictionResolutionService, PredictionExposureService, PredictionHedgeWorker, PredictionFavoriteService],
  exports: [PredictionService, PredictionExposureService],
})
export class PredictionModule {}
