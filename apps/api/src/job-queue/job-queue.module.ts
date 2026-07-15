import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JobQueueEntry, InboundCallbackEvent } from './job-queue.entities'
import { JobQueueService } from './job-queue.service'
import { JobQueueAdminController, PartnerCallbackController } from './job-queue.controller'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { PartnerCallbackVerifier } from './partner-callback.verifier'

@Module({
  imports: [TypeOrmModule.forFeature([JobQueueEntry, InboundCallbackEvent]), AdminRbacModule],
  controllers: [PartnerCallbackController, JobQueueAdminController],
  providers: [JobQueueService, PartnerCallbackVerifier],
  exports: [JobQueueService],
})
export class JobQueueModule {}
