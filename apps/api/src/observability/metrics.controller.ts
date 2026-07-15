import { Controller, Get, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { MetricsAccessGuard } from './metrics-access.guard'
import { MetricsService } from './metrics.service'

@Controller('metrics')
@UseGuards(MetricsAccessGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async index(@Res({ passthrough: true }) response: Response) {
    const registry = this.metrics.getRegistry()
    response.setHeader('Content-Type', registry.contentType)
    response.setHeader('Cache-Control', 'no-store')
    return registry.metrics()
  }
}
