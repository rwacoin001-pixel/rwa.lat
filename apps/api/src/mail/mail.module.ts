import { Module } from '@nestjs/common'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { InboundEmailController, MailController } from './mail.controller'
import { InboundEmailGuard } from './inbound-email.guard'
import { MailService } from './mail.service'
import { MailDeliveryWorker } from './mail-delivery.worker'

@Module({
  imports: [AdminRbacModule, JobQueueModule],
  controllers: [InboundEmailController, MailController],
  providers: [InboundEmailGuard, MailService, MailDeliveryWorker],
})
export class MailModule {}
