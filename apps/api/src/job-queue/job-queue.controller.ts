import { Body, Controller, Get, Headers, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { EnqueueDto, NackDto, ReceiveCallbackDto } from './job-queue.dto'
import { JobQueueService } from './job-queue.service'
import { PartnerCallbackVerifier } from './partner-callback.verifier'

@Controller('job-queue/callbacks')
export class PartnerCallbackController {
  constructor(
    private readonly svc: JobQueueService,
    private readonly verifier: PartnerCallbackVerifier,
  ) {}

  @Post()
  receiveCallback(
    @Headers('x-rwa-event-id') eventId: string,
    @Headers('x-rwa-timestamp') timestamp: string,
    @Headers('x-rwa-signature') signature: string,
    @Body() dto: ReceiveCallbackDto,
  ) {
    this.verifier.verify({
      partner: dto.partner,
      eventType: dto.eventType,
      eventId,
      timestamp,
      signature,
      payload: dto.payload,
    })
    return this.svc.receiveCallback({
      partner: dto.partner,
      eventType: dto.eventType,
      externalId: eventId,
      payload: dto.payload,
      signatureOk: true,
    })
  }
}

@Controller('admin/job-queue')
@UseGuards(AdminSessionGuard)
export class JobQueueAdminController {
  constructor(
    private readonly svc: JobQueueService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('callbacks/unprocessed')
  async listUnprocessedCallbacks(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('limit') limit?: string,
  ) {
    await this.authorize(admin)
    return this.svc.listUnprocessedCallbacks(limit ? Number(limit) : 50)
  }

  @Post('jobs')
  async enqueue(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: EnqueueDto) {
    await this.authorize(admin)
    return this.svc.enqueue({
      queueName: dto.queueName,
      payload: dto.payload,
      dedupKey: dto.dedupKey,
      maxAttempts: dto.maxAttempts,
    })
  }

  @Put('jobs/:id/ack')
  async ack(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    await this.authorize(admin)
    return this.svc.ack(id)
  }

  @Put('jobs/:id/nack')
  async nack(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string, @Body() dto: NackDto) {
    await this.authorize(admin)
    return this.svc.nack(id, dto.error)
  }

  @Put('jobs/:id/replay')
  async replay(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string, @Query('maxAttempts') maxAttempts?: string) {
    await this.authorize(admin)
    return this.svc.replay(id, maxAttempts ? Number(maxAttempts) : undefined)
  }

  @Get('jobs/dead')
  async listDead(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('queueName') queueName: string, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listDead(queueName, limit ? Number(limit) : 50)
  }

  @Get('jobs')
  async list(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('queueName') queueName: string,
    @Query('state') state?: string,
    @Query('limit') limit?: string,
  ) {
    await this.authorize(admin)
    return this.svc.listByState(queueName, state, limit ? Number(limit) : 50)
  }

  private authorize(admin: AuthenticatedAdmin) {
    return this.rbac.assertPermission(admin.id, 'operations.jobs.manage')
  }
}
