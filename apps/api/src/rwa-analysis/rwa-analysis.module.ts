import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { AiAnalysisProvider } from './ai-analysis.provider'
import { AiAnalysisService } from './ai-analysis.service'
import { RwaAiAnalysis, RwaAssetScore } from './rwa-analysis.entities'
import { InternalRwaAnalysisController } from './rwa-analysis-internal.controller'
import { RwaAnalysisWorker } from './rwa-analysis.worker'
import { ScoringService } from './scoring.service'

@Module({
  imports: [TypeOrmModule.forFeature([RwaAssetScore, RwaAiAnalysis]), JobQueueModule],
  controllers: [InternalRwaAnalysisController],
  providers: [ScoringService, AiAnalysisProvider, AiAnalysisService, RwaAnalysisWorker, InternalServiceGuard],
  exports: [ScoringService, AiAnalysisService],
})
export class RwaAnalysisModule {}
