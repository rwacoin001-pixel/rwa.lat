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
import { PredictionService } from './prediction.service'
import { PredictionSettlementWorker } from './prediction-settlement.worker'
import { PredictionExposureService } from './prediction-exposure.service'
import { PredictionHedgeWorker } from './prediction-hedge.worker'

@Module({
  imports: [
    TypeOrmModule.forFeature([PredictionBet, PredictionSettlementRun, PredictionHedgeDecision]),
    IdentityModule,
    OperationsModule,
    PolymarketModule,
    SecurityModule,
    ComplianceModule,
  ],
  controllers: [PredictionController, PredictionUserController, InternalPredictionController],
  providers: [PredictionService, PredictionSettlementWorker, PredictionExposureService, PredictionHedgeWorker],
  exports: [PredictionService, PredictionExposureService],
})
export class PredictionModule {}
