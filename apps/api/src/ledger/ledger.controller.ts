import { Body, Controller, DefaultValuePipe, Get, Headers, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { RequestWithContext } from '../common/request-context.middleware'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { LedgerService } from './ledger.service'
import {
  CreateLedgerAdjustmentDto,
  CustodyReconciliationCallbackDto,
  DecideLedgerAdjustmentDto,
  ListLedgerAdjustmentsQueryDto,
  ListReconciliationQueryDto,
  RunCustodyReconciliationDto,
} from './ledger.dto'
import { CustodyWebhookVerifier } from '../wallet/custody-webhook.verifier'

@ApiTags('ledger-callbacks')
@Controller('ledger/callbacks')
export class LedgerCallbackController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly verifier: CustodyWebhookVerifier,
    private readonly config: ConfigService,
  ) {}

  @Post('custody/reconciliations')
  @ApiOperation({ summary: 'Consume one signed, idempotent custody balance snapshot without mutating the ledger' })
  reconcile(
    @Headers('x-custody-event-id') eventId: string,
    @Headers('x-custody-timestamp') timestamp: string,
    @Headers('x-custody-signature') signature: string,
    @Body() dto: CustodyReconciliationCallbackDto,
  ) {
    this.verifier.verify(eventId, timestamp, signature, dto)
    return this.ledger.reconcileCustody({
      provider: this.config.get<string>('WALLET_CUSTODY_ADAPTER') ?? 'custody',
      network: dto.network,
      observedAtomicBalance: dto.observedAtomicBalance,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      sourceReference: dto.sourceReference.trim(),
      requestId: eventId,
      partnerEventId: eventId,
    })
  }
}

@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Read signed-in user balances from the exact ledger projection' })
  balances(@CurrentAuth() actor: SecurityActor) {
    return this.ledger.listUserBalances(actor.userId)
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List signed-in user immutable ledger vouchers and entries' })
  transactions(
    @CurrentAuth() actor: SecurityActor,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.ledger.listUserTransactions(actor.userId, limit)
  }
}

@ApiTags('admin-ledger')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin/ledger')
export class AdminLedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('reconciliations')
  @ApiOperation({ summary: 'List custody reconciliation runs and their difference cases' })
  async reconciliations(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: ListReconciliationQueryDto) {
    await this.rbac.assertPermission(admin.id, 'ledger.reconciliation.manage')
    return this.ledger.listReconciliationRuns(query.state, query.limit ? Number(query.limit) : 50)
  }

  @Post('reconciliations/custody')
  @ApiOperation({ summary: 'Record one idempotent custody balance reconciliation period' })
  async reconcileCustody(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: RunCustodyReconciliationDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'ledger.reconciliation.manage')
    return this.ledger.reconcileCustody({
      provider: dto.provider.trim(),
      network: dto.network,
      observedAtomicBalance: dto.observedAtomicBalance,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      sourceReference: dto.sourceReference.trim(),
      requestId: request.requestId ?? 'admin-custody-reconciliation',
      adminId: admin.id,
    })
  }

  @Get('adjustments')
  @ApiOperation({ summary: 'List controlled ledger adjustment requests' })
  async list(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: ListLedgerAdjustmentsQueryDto) {
    await this.rbac.assertPermission(admin.id, 'ledger.adjustments.manage')
    return this.ledger.listLedgerAdjustments(query.state, query.limit ? Number(query.limit) : 50)
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Request a balanced immutable ledger adjustment' })
  async create(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: CreateLedgerAdjustmentDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'ledger.adjustments.manage')
    return this.ledger.createLedgerAdjustment({
      ledgerAccountId: dto.ledgerAccountId,
      side: dto.side,
      atomicAmount: dto.atomicAmount,
      reasonCode: dto.reasonCode,
      evidence: dto.evidence ?? {},
      adminId: admin.id,
      requestId: request.requestId ?? 'admin-ledger-adjustment',
    })
  }

  @Put('adjustments/:id/approve')
  @ApiOperation({ summary: 'Approve an adjustment as a different administrator from the requester' })
  async approve(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: DecideLedgerAdjustmentDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'ledger.adjustments.manage')
    return this.ledger.decideLedgerAdjustment(id, admin.id, true, dto.reason, request.requestId ?? 'admin-ledger-approval')
  }

  @Put('adjustments/:id/reject')
  @ApiOperation({ summary: 'Reject an adjustment as a different administrator from the requester' })
  async reject(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: DecideLedgerAdjustmentDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'ledger.adjustments.manage')
    return this.ledger.decideLedgerAdjustment(id, admin.id, false, dto.reason, request.requestId ?? 'admin-ledger-rejection')
  }

  @Post('adjustments/:id/post')
  @ApiOperation({ summary: 'Post an approved adjustment as a balanced immutable ledger transaction' })
  async post(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'ledger.adjustments.post')
    return this.ledger.postLedgerAdjustment(id, admin.id, request.requestId ?? 'admin-ledger-post')
  }
}
