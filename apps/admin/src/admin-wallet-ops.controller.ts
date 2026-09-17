import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminWalletOpsService } from './admin-wallet-ops.service'

function adminId(request: AdminRequest): string {
  if (!request.admin?.id) throw new Error('Authenticated administrator is missing')
  return request.admin.id
}

function numeric(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

@ApiTags('admin-wallet-ops')
@ApiBearerAuth()
@Controller('admin/wallet')
@UseGuards(AdminPermissionGuard)
export class AdminWalletOpsController {
  constructor(private readonly ops: AdminWalletOpsService) {}

  @Get('deposit-pool')
  @RequireAdminPermissions('wallet.addresses.manage')
  @ApiOperation({ summary: 'List manual-custody deposit pool addresses and counts' })
  depositPool(
    @Req() request: AdminRequest,
    @Query('network') network?: string,
    @Query('state') state?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ops.depositPool(adminId(request), { network, state, limit: limit ? numeric(limit, 100) : undefined })
  }

  @Post('deposit-pool/generate')
  @RequireAdminPermissions('wallet.addresses.manage')
  @ApiOperation({ summary: 'Generate new TRON deposit addresses into the pool' })
  generateDepositPool(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.ops.generateDepositPool(adminId(request), body)
  }

  @Post('deposit-pool/import')
  @RequireAdminPermissions('wallet.addresses.manage')
  @ApiOperation({ summary: 'Import an operator-held TRON address (optionally with its key)' })
  importDepositPoolAddress(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.ops.importDepositPoolAddress(adminId(request), body)
  }

  @Put('deposit-pool/:id/disable')
  @RequireAdminPermissions('wallet.addresses.manage')
  @ApiOperation({ summary: 'Disable an unassigned deposit pool address' })
  disableDepositPoolAddress(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.ops.disableDepositPoolAddress(adminId(request), id, body)
  }

  @Get('deposits')
  @RequireAdminPermissions('wallet.addresses.manage')
  @ApiOperation({ summary: 'List recent deposits with confirmation state' })
  deposits(
    @Req() request: AdminRequest,
    @Query('state') state?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ops.deposits(adminId(request), { state, limit: limit ? numeric(limit, 100) : undefined })
  }

  @Get('withdrawal-whitelist')
  @RequireAdminPermissions('wallet.withdrawals.manage')
  @ApiOperation({ summary: 'List withdrawal auto-approval whitelist entries' })
  withdrawalWhitelist(
    @Req() request: AdminRequest,
    @Query('network') network?: string,
    @Query('state') state?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ops.withdrawalWhitelist(adminId(request), { network, state, limit: limit ? numeric(limit, 100) : undefined })
  }

  @Post('withdrawal-whitelist')
  @RequireAdminPermissions('wallet.withdrawals.manage')
  @ApiOperation({ summary: 'Whitelist a user for automatic withdrawal execution' })
  addWithdrawalWhitelist(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.ops.addWithdrawalWhitelist(adminId(request), body)
  }

  @Put('withdrawal-whitelist/:id/revoke')
  @RequireAdminPermissions('wallet.withdrawals.manage')
  @ApiOperation({ summary: 'Revoke a withdrawal whitelist entry' })
  revokeWithdrawalWhitelist(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.ops.revokeWithdrawalWhitelist(adminId(request), id, body)
  }

  @Get('withdrawals')
  @RequireAdminPermissions('wallet.withdrawals.manage')
  @ApiOperation({ summary: 'List recent withdrawals with approval counts' })
  withdrawals(
    @Req() request: AdminRequest,
    @Query('state') state?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ops.withdrawals(adminId(request), { state, limit: limit ? numeric(limit, 100) : undefined })
  }

  @Get('withdrawals/reviews')
  @RequireAdminPermissions('wallet.withdrawals.manage')
  @ApiOperation({ summary: 'List withdrawals awaiting administrator decisions' })
  withdrawalReviews(@Req() request: AdminRequest, @Query('limit') limit?: string) {
    return this.ops.withdrawalReviews(adminId(request), limit ? numeric(limit, 50) : undefined)
  }

  @Put('withdrawals/:id/approve')
  @RequireAdminPermissions('wallet.withdrawals.manage')
  @ApiOperation({ summary: 'Record one administrator approval for a withdrawal' })
  approveWithdrawal(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.ops.approveWithdrawal(adminId(request), id, body)
  }

  @Put('withdrawals/:id/reject')
  @RequireAdminPermissions('wallet.withdrawals.manage')
  @ApiOperation({ summary: 'Reject a withdrawal and refund locked funds' })
  rejectWithdrawal(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.ops.rejectWithdrawal(adminId(request), id, body)
  }

  @Post('withdrawals/:id/execute')
  @RequireAdminPermissions('wallet.withdrawals.execute')
  @ApiOperation({ summary: 'Claim an execution lease and broadcast an approved withdrawal' })
  executeWithdrawal(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.ops.executeWithdrawal(adminId(request), id)
  }
}

@ApiTags('admin-funds-ops')
@ApiBearerAuth()
@Controller('admin/operations/funds')
@UseGuards(AdminPermissionGuard)
export class AdminFundsOpsController {
  constructor(private readonly ops: AdminWalletOpsService) {}

  @Get('withdrawal-execution')
  @RequireAdminPermissions('operations.funds.switch.manage')
  @ApiOperation({ summary: 'Read the funds execution switch state and pending resume requests' })
  status(@Req() request: AdminRequest) {
    return this.ops.fundsStatus(adminId(request))
  }

  @Post('withdrawal-execution/pause')
  @RequireAdminPermissions('operations.funds.pause')
  @ApiOperation({ summary: 'Pause withdrawal execution immediately' })
  pause(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.ops.pauseFunds(adminId(request), body)
  }

  @Post('withdrawal-execution/resume-requests')
  @RequireAdminPermissions('operations.funds.switch.manage')
  @ApiOperation({ summary: 'Request resumption of withdrawal execution (a second admin must approve)' })
  requestResume(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.ops.requestFundsResume(adminId(request), body)
  }

  @Put('withdrawal-execution/resume-requests/:id/approve')
  @RequireAdminPermissions('operations.funds.switch.manage')
  @ApiOperation({ summary: 'Approve a pending withdrawal execution resume request' })
  approveResume(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.ops.decideFundsResume(adminId(request), id, true)
  }

  @Put('withdrawal-execution/resume-requests/:id/reject')
  @RequireAdminPermissions('operations.funds.switch.manage')
  @ApiOperation({ summary: 'Reject a pending withdrawal execution resume request' })
  rejectResume(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.ops.decideFundsResume(adminId(request), id, false)
  }
}
