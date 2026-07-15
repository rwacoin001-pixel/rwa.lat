import { Module } from '@nestjs/common'
import { AlertingService } from './alerting.service'
import { AlertingController } from './alerting.controller'
import { AdminRbacModule } from '../../admin-rbac/admin-rbac.module'

@Module({
  imports: [AdminRbacModule],
  controllers: [AlertingController],
  providers: [AlertingService],
  exports: [AlertingService],
})
export class AlertingModule {}
