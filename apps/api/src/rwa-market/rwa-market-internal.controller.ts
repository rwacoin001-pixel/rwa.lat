import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { JobQueueService } from '../job-queue/job-queue.service'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { RWA_DATA_PROVIDER, RWA_MARKET_SYNC_QUEUE } from './rwa-market.constants'
import { SyncTriggerDto } from './rwa-market.dto'
import { RwaMarketSyncService } from './rwa-market.sync.service'
import type { RwaDataProvider } from './providers/rwa-data-provider'

/** 内部运维通道（Bearer ADMIN_SERVICE_TOKEN + x-actor-admin-id；同 community/wallet 内部接口模式） */
@ApiTags('internal-rwa-market')
@UseGuards(InternalServiceGuard)
@Controller('internal/rwa-market')
export class InternalRwaMarketController {
  constructor(
    private readonly sync: RwaMarketSyncService,
    private readonly queue: JobQueueService,
    @Inject(RWA_DATA_PROVIDER) private readonly provider: RwaDataProvider,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'RWA data provider health check' })
  health() {
    return this.provider.healthCheck()
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger an RWA sync run (queued by default; mode=inline runs now)' })
  async trigger(@Body() dto: SyncTriggerDto) {
    if (dto.mode === 'inline') {
      return this.sync.run(dto.kind, { maxItems: dto.maxItems })
    }
    const job = await this.queue.enqueue({
      queueName: RWA_MARKET_SYNC_QUEUE,
      payload: dto.maxItems ? { kind: dto.kind, maxItems: dto.maxItems, scheduled: false } : { kind: dto.kind, scheduled: false },
    })
    return { queued: true, jobId: job.id, kind: dto.kind }
  }

  @Get('sync-runs')
  @ApiOperation({ summary: 'Recent RWA sync runs' })
  runs(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 20
    return this.sync.listRuns(Number.isFinite(parsed) ? parsed : 20)
  }
}
