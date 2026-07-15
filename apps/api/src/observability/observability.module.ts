import { Module } from '@nestjs/common'
import { MetricsService } from './metrics.service'
import { MetricsController } from './metrics.controller'
import { MetricsAccessGuard } from './metrics-access.guard'
import { LoggingModule } from './logging/logging.module'
import { TracingModule } from './tracing/tracing.module'
import { AlertingModule } from './alerting/alerting.module'

@Module({
  imports: [
    LoggingModule,
    TracingModule,
    AlertingModule,
  ],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsAccessGuard],
  exports: [MetricsService],
})
export class ObservabilityModule {}
