import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityModule } from '../identity/identity.module'
import { OperationsModule } from '../operations/operations.module'
import { PolymarketModule } from '../polymarket/polymarket.module'
import { SecurityModule } from '../security/security.module'
import { InternalPredictionController } from './prediction-internal.controller'
import { PredictionController, PredictionUserController } from './prediction.controller'
import { PredictionBet, PredictionSettlementRun } from './prediction.entities'
import { PredictionService } from './prediction.service'
import { PredictionSettlementWorker } from './prediction-settlement.worker'

@Module({
  imports: [
    TypeOrmModule.forFeature([PredictionBet, PredictionSettlementRun]),
    IdentityModule,
    OperationsModule,
    PolymarketModule,
    SecurityModule,
  ],
  controllers: [PredictionController, PredictionUserController, InternalPredictionController],
  providers: [PredictionService, PredictionSettlementWorker],
})
export class PredictionModule {}
