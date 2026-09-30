import { Body, Controller, Get, Headers, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { PortfolioService } from './portfolio.service'
import { CaptureSnapshotDto, HistoryQueryDto, RequestRedemptionDto } from './portfolio.dto'
import { PortfolioHistoryPointResponseDto, PortfolioPositionResponseDto, PortfolioRedemptionResponseDto, PortfolioSnapshotBatchResponseDto } from './portfolio.response.dto'
import { RebalanceService } from './rebalance.service'
import { ConfirmRebalanceBuysDto, CreateRebalancePlanDto } from './rebalance.dto'
import type { AuthenticatedRequest } from '../security/session-auth.guard'

@Controller('portfolio')
@UseGuards(SessionAuthGuard)
export class PortfolioController {
  constructor(private readonly svc: PortfolioService, private readonly rebalances: RebalanceService) {}

  @Get('positions')
  @ApiOkResponse({ type: [PortfolioPositionResponseDto] })
  listPositions(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listPositions(actor.userId)
  }

  @Post('snapshots')
  @ApiOkResponse({ type: PortfolioPositionResponseDto })
  captureSnapshot(@CurrentAuth() actor: SecurityActor, @Body() dto: CaptureSnapshotDto) {
    return this.svc.captureSnapshot(actor.userId, dto.productId)
  }

  @Post('snapshots/batch')
  @ApiOkResponse({ type: PortfolioSnapshotBatchResponseDto })
  capturePortfolioSnapshot(@CurrentAuth() actor: SecurityActor) {
    return this.svc.capturePortfolioSnapshot(actor.userId)
  }

  @Get('history')
  @ApiOkResponse({ type: [PortfolioHistoryPointResponseDto] })
  history(@CurrentAuth() actor: SecurityActor, @Query() q: HistoryQueryDto) {
    return this.svc.history(actor.userId, q.productId, q.limit)
  }

  @Post('redemptions')
  @ApiOkResponse({ type: PortfolioRedemptionResponseDto })
  requestRedemption(@CurrentAuth() actor: SecurityActor, @Body() dto: RequestRedemptionDto) {
    return this.svc.requestRedemption({
      user_id: actor.userId,
      product_id: dto.productId,
      quantity_atomic_amount: dto.quantityAtomicAmount,
      destination_address: dto.destinationAddress,
      request_id: dto.requestId,
    })
  }

  @Get('redemptions')
  @ApiOkResponse({ type: [PortfolioRedemptionResponseDto] })
  listRedemptions(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listRedemptions(actor.userId)
  }

  @Put('redemptions/:id/cancel')
  @ApiOkResponse({ type: PortfolioRedemptionResponseDto })
  cancelRedemption(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.svc.cancelRedemption(id, actor.userId)
  }

  @Get('rebalances')
  listRebalances(@CurrentAuth() actor: SecurityActor) {
    return this.rebalances.list(actor.userId)
  }

  @Get('rebalances/:id')
  getRebalance(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.rebalances.get(id, actor.userId)
  }

  @Post('rebalances')
  createRebalance(
    @CurrentAuth() actor: SecurityActor,
    @Body() dto: CreateRebalancePlanDto,
    @Headers('idempotency-key') key: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rebalances.create(actor.userId, dto, key, request.requestId ?? 'unknown')
  }

  @Post('rebalances/:id/confirm-buys')
  confirmRebalanceBuys(
    @CurrentAuth() actor: SecurityActor,
    @Param('id') id: string,
    @Body() _dto: ConfirmRebalanceBuysDto,
    @Headers('idempotency-key') key: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rebalances.confirmBuys(id, actor.userId, key, request.requestId ?? 'unknown')
  }

  @Put('rebalances/:id/cancel')
  cancelRebalance(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.rebalances.cancel(id, actor.userId)
  }
}
