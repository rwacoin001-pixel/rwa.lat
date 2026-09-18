import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'
import { JobQueueService } from '../job-queue/job-queue.service'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { AiAnalysisService } from './ai-analysis.service'
import { RWA_ANALYSIS_QUEUE } from './rwa-analysis.worker'
import { ScoringService } from './scoring.service'

export class RunAnalysisDto {
  @IsIn(['score-batch', 'ai-batch'])
  kind!: 'score-batch' | 'ai-batch'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number

  @IsOptional()
  @IsIn(['inline', 'queue'])
  mode?: 'inline' | 'queue'
}

/** 内部运维通道（Bearer ADMIN_SERVICE_TOKEN + x-actor-admin-id） */
@ApiTags('internal-rwa-analysis')
@UseGuards(InternalServiceGuard)
@Controller('internal/rwa-analysis')
export class InternalRwaAnalysisController {
  constructor(
    private readonly scoring: ScoringService,
    private readonly ai: AiAnalysisService,
    private readonly queue: JobQueueService,
  ) {}

  @Post('run')
  @ApiOperation({ summary: 'Run a scoring or AI analysis batch (inline by default; mode=queue enqueues)' })
  async run(@Body() dto: RunAnalysisDto) {
    if (dto.mode === 'queue') {
      const job = await this.queue.enqueue({
        queueName: RWA_ANALYSIS_QUEUE,
        payload: dto.limit ? { kind: dto.kind, limit: dto.limit } : { kind: dto.kind },
      })
      return { queued: true, jobId: job.id, kind: dto.kind }
    }
    if (dto.kind === 'score-batch') {
      return this.scoring.runBatch(dto.limit ?? 1000)
    }
    return this.ai.runBatch(dto.limit ?? 10)
  }

  @Post('analyze/:slug')
  @ApiOperation({ summary: 'Analyze a single RWA asset on demand (DeepSeek)' })
  analyzeAsset(@Param('slug') slug: string) {
    return this.ai.analyzeAssetBySlug(slug)
  }

  @Get('scores/:assetId')
  @ApiOperation({ summary: 'Latest quant score for an asset' })
  async latestScore(@Param('assetId') assetId: string) {
    return { score: await this.scoring.getLatestForAsset(assetId) }
  }

  @Get('ai-recent')
  @ApiOperation({ summary: 'Recent AI analysis outputs' })
  async recent(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 20
    return { items: await this.ai.listRecent(Number.isFinite(parsed) ? parsed : 20) }
  }
}
