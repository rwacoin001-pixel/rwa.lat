import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Headers,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import {
  AddWithdrawalWhitelistDto,
  AdminWithdrawalDecisionDto,
  DisableDepositPoolAddressDto,
  GenerateDepositPoolDto,
  ImportDepositPoolAddressDto,
  PauseFundsExecutionDto,
  RequestFundsResumeDto,
  RevokeWithdrawalWhitelistDto,
} from './dto/wallet.dto'
import { FundsOperationalSwitchService } from './funds-operational-switch.service'
import { DepositPoolService } from './manual/deposit-pool.service'
import { WithdrawalWhitelistService } from './manual/withdrawal-whitelist.service'
import { WalletService } from './wallet.service'

export const INTERNAL_ACTOR_HEADER = 'x-actor-admin-id'
const INTERNAL_TOKEN_MIN_LENGTH = 32

type InternalRequest = Request & { internalActorAdminId?: string; requestId?: string }

/**
 * Machine-to-machine guard for the internal wallet operations channel used by
 * the admin control plane service. Requests must carry the shared service
 * token plus the acting administrator id (which is audited on every write).
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly tokenHash: Buffer | null

  constructor(config: ConfigService) {
    const token = config.get<string>('ADMIN_SERVICE_TOKEN')?.trim() || ''
    this.tokenHash = token.length >= INTERNAL_TOKEN_MIN_LENGTH ? createHash('sha256').update(token).digest() : null
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.tokenHash) {
      throw new ServiceUnavailableException('The internal operations channel is not configured.')
    }
    const request = context.switchToHttp().getRequest<InternalRequest>()
    const supplied = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    if (!supplied) throw new UnauthorizedException('Internal service credentials are required.')
    const suppliedHash = createHash('sha256').update(supplied).digest()
    if (!timingSafeEqual(suppliedHash, this.tokenHash)) {
      throw new UnauthorizedException('Internal service credentials are invalid.')
    }
    const actor = String(request.headers[INTERNAL_ACTOR_HEADER] ?? '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor)) {
      throw new UnauthorizedException(`A valid ${INTERNAL_ACTOR_HEADER} header is required.`)
    }
    request.internalActorAdminId = actor
    return true
  }
}

function actorOf(request: InternalRequest): string {
  if (!request.internalActorAdminId) throw new UnauthorizedException('Internal actor context is missing.')
  return request.internalActorAdminId
}

function requestIdOf(request: InternalRequest): string {
  return request.requestId ?? request.header('x-request-id') ?? 'internal-wallet-ops'
}

@ApiTags('internal-wallet-ops')
@UseGuards(InternalServiceGuard)
@Controller('internal/wallet')
export class InternalWalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly pools: DepositPoolService,
    private readonly whitelist: WithdrawalWhitelistService,
    private readonly fundsSwitch: FundsOperationalSwitchService,
  ) {}

  @Get('deposit-pool')
  @ApiOperation({ summary: 'List deposit pool addresses with state counts (service-to-service)' })
  async depositPool(@Query('network') network?: string, @Query('state') state?: string, @Query('limit') limit?: string) {
    const [list, stats] = await Promise.all([
      this.pools.list({ network, state, limit: limit ? Number(limit) : 100 }),
      this.pools.stats(),
    ])
    return { ...list, stats }
  }

  @Post('deposit-pool/generate')
  @ApiOperation({ summary: 'Generate new deposit addresses into the pool' })
  generateDepositPool(@Body() dto: GenerateDepositPoolDto, @Req() request: InternalRequest) {
    return this.pools.generate(actorOf(request), dto, requestIdOf(request))
  }

  @Post('deposit-pool/import')
  @ApiOperation({ summary: 'Import an operator-held address (with its key) into the pool' })
  importDepositPoolAddress(@Body() dto: ImportDepositPoolAddressDto, @Req() request: InternalRequest) {
    return this.pools.importAddress(actorOf(request), dto, requestIdOf(request))
  }

  @Put('deposit-pool/:id/disable')
  @ApiOperation({ summary: 'Disable an unassigned deposit pool address' })
  disableDepositPoolAddress(@Param('id') id: string, @Body() dto: DisableDepositPoolAddressDto, @Req() request: InternalRequest) {
    return this.pools.disable(actorOf(request), id, dto.reason, requestIdOf(request))
  }

  @Get('withdrawal-whitelist')
  @ApiOperation({ summary: 'List withdrawal auto-approval whitelist entries' })
  withdrawalWhitelist(@Query('network') network?: string, @Query('state') state?: string, @Query('limit') limit?: string) {
    return this.whitelist.list({ network, state, limit: limit ? Number(limit) : 100 })
  }

  @Post('withdrawal-whitelist')
  @ApiOperation({ summary: 'Whitelist a user for automatic withdrawal execution' })
  addWithdrawalWhitelist(@Body() dto: AddWithdrawalWhitelistDto, @Req() request: InternalRequest) {
    return this.whitelist.add(actorOf(request), dto, requestIdOf(request))
  }

  @Put('withdrawal-whitelist/:id/revoke')
  @ApiOperation({ summary: 'Revoke a withdrawal whitelist entry' })
  revokeWithdrawalWhitelist(@Param('id') id: string, @Body() dto: RevokeWithdrawalWhitelistDto, @Req() request: InternalRequest) {
    return this.whitelist.revoke(actorOf(request), id, dto.reason, requestIdOf(request))
  }

  @Get('deposits')
  @ApiOperation({ summary: 'List recent deposits with confirmation state' })
  deposits(@Query('state') state?: string, @Query('limit') limit?: string) {
    return this.wallet.listRecentDeposits(limit ? Number(limit) : 100, state)
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'List recent withdrawals with approval counts' })
  withdrawals(@Query('state') state?: string, @Query('limit') limit?: string) {
    return this.wallet.listRecentWithdrawals(limit ? Number(limit) : 100, state)
  }

  @Get('withdrawals/reviews')
  @ApiOperation({ summary: 'List withdrawals awaiting administrator decisions' })
  withdrawalReviews(@Query('limit') limit?: string) {
    return this.wallet.listWithdrawalReviews(limit ? Number(limit) : 50)
  }

  @Put('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Record one administrator approval for a withdrawal' })
  approveWithdrawal(@Param('id') id: string, @Body() dto: AdminWithdrawalDecisionDto, @Req() request: InternalRequest) {
    return this.wallet.decideWithdrawal(id, actorOf(request), true, dto.reasonCode, requestIdOf(request))
  }

  @Put('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal and refund locked funds' })
  rejectWithdrawal(@Param('id') id: string, @Body() dto: AdminWithdrawalDecisionDto, @Req() request: InternalRequest) {
    return this.wallet.decideWithdrawal(id, actorOf(request), false, dto.reasonCode, requestIdOf(request))
  }

  @Post('withdrawals/:id/execute')
  @ApiOperation({ summary: 'Claim an execution lease and broadcast an approved withdrawal' })
  executeWithdrawal(@Param('id') id: string, @Req() request: InternalRequest) {
    return this.wallet.executeApprovedWithdrawal(id, actorOf(request), requestIdOf(request))
  }

  @Get('funds/withdrawal-execution')
  @ApiOperation({ summary: 'Read the funds execution switch state' })
  fundsStatus() {
    return this.fundsSwitch.status()
  }

  @Post('funds/withdrawal-execution/pause')
  @ApiOperation({ summary: 'Pause withdrawal execution immediately' })
  pauseFunds(@Body() dto: PauseFundsExecutionDto, @Req() request: InternalRequest) {
    return this.fundsSwitch.pause(actorOf(request), dto.reason, requestIdOf(request))
  }

  @Post('funds/withdrawal-execution/resume-requests')
  @ApiOperation({ summary: 'Request resumption of withdrawal execution (second admin approves)' })
  requestFundsResume(@Body() dto: RequestFundsResumeDto, @Req() request: InternalRequest) {
    return this.fundsSwitch.requestResume(actorOf(request), dto.changeId, dto.reason, requestIdOf(request))
  }

  @Put('funds/withdrawal-execution/resume-requests/:id/approve')
  @ApiOperation({ summary: 'Approve a pending withdrawal execution resume request' })
  approveFundsResume(@Param('id') id: string, @Req() request: InternalRequest) {
    return this.fundsSwitch.decideResume(id, actorOf(request), true, requestIdOf(request))
  }

  @Put('funds/withdrawal-execution/resume-requests/:id/reject')
  @ApiOperation({ summary: 'Reject a pending withdrawal execution resume request' })
  rejectFundsResume(@Param('id') id: string, @Req() request: InternalRequest) {
    return this.fundsSwitch.decideResume(id, actorOf(request), false, requestIdOf(request))
  }
}
