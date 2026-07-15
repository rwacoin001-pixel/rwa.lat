import { Body, Controller, Get, Headers, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import type { RequestWithContext } from '../common/request-context.middleware'
import type { AuthenticatedRequest } from '../security/session-auth.guard'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import {
  AddWithdrawalAddressDto,
  AdminWithdrawalDecisionDto,
  CreateTransferDto,
  CreateWithdrawalDto,
  DemoWithdrawalDecisionDto,
  DepositCallbackDto,
  PauseFundsExecutionDto,
  RevokeWithdrawalAddressDto,
  RequestFundsResumeDto,
  WithdrawalCallbackDto,
  WithdrawalQuoteDto,
} from './dto/wallet.dto'
import { WalletService } from './wallet.service'
import { FundsOperationalSwitchService } from './funds-operational-switch.service'
import type { WalletNetwork } from './wallet.entities'

@ApiTags('wallet')
@Controller('wallet')
export class WalletPublicController {
  constructor(private readonly wallet: WalletService) {}

  @Get('networks')
  @ApiOperation({ summary: 'List supported wallet networks and the current integration mode' })
  networks() {
    return this.wallet.listNetworks()
  }
}

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Read exact USDT balances and recent wallet activity' })
  overview(@CurrentAuth() actor: SecurityActor) {
    return this.wallet.overview(actor.userId)
  }

  @Post('deposit-addresses/:network')
  @ApiOperation({ summary: 'Get or provision the signed-in user deposit address for one network' })
  depositAddress(@CurrentAuth() actor: SecurityActor, @Param('network') network: string) {
    return this.wallet.depositAddress(actor.userId, network as WalletNetwork)
  }

  @Post('withdrawals/quote')
  @ApiOperation({ summary: 'Quote a withdrawal without locking or moving funds' })
  quote(@CurrentAuth() actor: SecurityActor, @Body() dto: WithdrawalQuoteDto) {
    return this.wallet.quoteWithdrawal(actor.userId, dto)
  }

  @Get('withdrawal-addresses')
  @ApiOperation({ summary: 'List screened withdrawal address-book entries and cooldown state' })
  withdrawalAddresses(@CurrentAuth() actor: SecurityActor) {
    return this.wallet.listWithdrawalAddressBook(actor.userId)
  }

  @Post('withdrawal-addresses')
  @ApiOperation({ summary: 'Add and screen a withdrawal destination after recent step-up verification' })
  addWithdrawalAddress(
    @CurrentAuth() actor: SecurityActor,
    @Body() dto: AddWithdrawalAddressDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.wallet.addWithdrawalAddress(actor, dto, this.requestId(request))
  }

  @Put('withdrawal-addresses/:id/revoke')
  @ApiOperation({ summary: 'Revoke a withdrawal destination after recent step-up verification' })
  revokeWithdrawalAddress(
    @CurrentAuth() actor: SecurityActor,
    @Param('id') id: string,
    @Body() dto: RevokeWithdrawalAddressDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.wallet.revokeWithdrawalAddress(actor, id, dto.reauthentication, this.requestId(request))
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Create an idempotent withdrawal after recent step-up verification' })
  withdrawal(
    @CurrentAuth() actor: SecurityActor,
    @Body() dto: CreateWithdrawalDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.wallet.createWithdrawal(actor, dto, idempotencyKey, this.requestId(request))
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Post an idempotent internal USDT transfer after recent step-up verification' })
  transfer(
    @CurrentAuth() actor: SecurityActor,
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.wallet.createTransfer(actor, dto, idempotencyKey, this.requestId(request))
  }

  private requestId(request: AuthenticatedRequest) {
    return request.requestId ?? request.header('x-request-id') ?? 'unknown'
  }
}

@ApiTags('wallet-callbacks')
@Controller('wallet/callbacks')
export class WalletCallbackController {
  constructor(private readonly wallet: WalletService) {}

  @Post('custody/deposits')
  @ApiOperation({ summary: 'Consume signed custody deposit observations with idempotent retry handling' })
  deposit(
    @Headers('x-custody-event-id') eventId: string,
    @Headers('x-custody-timestamp') timestamp: string,
    @Headers('x-custody-signature') signature: string,
    @Body() dto: DepositCallbackDto,
  ) {
    return this.wallet.processDepositCallback(eventId, timestamp, signature, dto)
  }

  @Post('custody/withdrawals')
  @ApiOperation({ summary: 'Consume signed custody withdrawal status and confirmation callbacks' })
  withdrawal(
    @Headers('x-custody-event-id') eventId: string,
    @Headers('x-custody-timestamp') timestamp: string,
    @Headers('x-custody-signature') signature: string,
    @Body() dto: WithdrawalCallbackDto,
  ) {
    return this.wallet.processWithdrawalCallback(eventId, timestamp, signature, dto)
  }
}

@ApiTags('admin-wallet')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('withdrawals/reviews')
  @ApiOperation({ summary: 'List withdrawals awaiting independent administrator decisions' })
  async reviews(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('limit') limit?: string) {
    await this.rbac.assertPermission(admin.id, 'wallet.withdrawals.manage')
    return this.wallet.listWithdrawalReviews(limit ? Number(limit) : 50)
  }

  @Put('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Record one immutable administrator approval for a withdrawal' })
  async approve(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: AdminWithdrawalDecisionDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'wallet.withdrawals.manage')
    return this.wallet.decideWithdrawal(id, admin.id, true, dto.reasonCode, request.requestId ?? 'admin-withdrawal-approval')
  }

  @Put('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal and return locked funds through the immutable ledger' })
  async reject(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: AdminWithdrawalDecisionDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'wallet.withdrawals.manage')
    return this.wallet.decideWithdrawal(id, admin.id, false, dto.reasonCode, request.requestId ?? 'admin-withdrawal-rejection')
  }

  @Post('withdrawals/:id/execute')
  @ApiOperation({ summary: 'Claim an execution lease and broadcast an approved withdrawal idempotently' })
  async execute(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'wallet.withdrawals.execute')
    return this.wallet.executeApprovedWithdrawal(id, admin.id, request.requestId ?? 'admin-withdrawal-execution')
  }
}

@ApiTags('admin-funds-operations')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin/operations/funds')
export class AdminFundsOperationsController {
  constructor(
    private readonly fundsSwitch: FundsOperationalSwitchService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('withdrawal-execution')
  async status(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await this.rbac.assertPermission(admin.id, 'operations.funds.switch.manage')
    return this.fundsSwitch.status()
  }

  @Post('withdrawal-execution/pause')
  async pause(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: PauseFundsExecutionDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'operations.funds.pause')
    return this.fundsSwitch.pause(admin.id, dto.reason, request.requestId ?? 'admin-funds-pause')
  }

  @Post('withdrawal-execution/resume-requests')
  async requestResume(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: RequestFundsResumeDto,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'operations.funds.switch.manage')
    return this.fundsSwitch.requestResume(
      admin.id, dto.changeId, dto.reason, request.requestId ?? 'admin-funds-resume-request',
    )
  }

  @Put('withdrawal-execution/resume-requests/:id/approve')
  async approveResume(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'operations.funds.switch.manage')
    return this.fundsSwitch.decideResume(id, admin.id, true, request.requestId ?? 'admin-funds-resume-approval')
  }

  @Put('withdrawal-execution/resume-requests/:id/reject')
  async rejectResume(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Req() request: RequestWithContext,
  ) {
    await this.rbac.assertPermission(admin.id, 'operations.funds.switch.manage')
    return this.fundsSwitch.decideResume(id, admin.id, false, request.requestId ?? 'admin-funds-resume-rejection')
  }
}

@ApiTags('demo-admin')
@Controller('demo-admin/withdrawals')
export class DemoWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Post(':id/complete')
  complete(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.wallet.completeDemoWithdrawal(id, request.requestId ?? 'demo-admin-withdrawal')
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: DemoWithdrawalDecisionDto, @Req() request: AuthenticatedRequest) {
    return this.wallet.rejectDemoWithdrawal(id, dto.reasonCode ?? 'demo_withdrawal_rejected', request.requestId ?? 'demo-admin-withdrawal')
  }
}
