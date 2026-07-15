import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { PortfolioService } from './portfolio.service'
import { CaptureSnapshotDto, HistoryQueryDto, RequestRedemptionDto } from './portfolio.dto'

@Controller('portfolio')
@UseGuards(SessionAuthGuard)
export class PortfolioController {
  constructor(private readonly svc: PortfolioService) {}

  @Get('positions')
  listPositions(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listPositions(actor.userId)
  }

  @Post('snapshots')
  captureSnapshot(@CurrentAuth() actor: SecurityActor, @Body() dto: CaptureSnapshotDto) {
    return this.svc.captureSnapshot(actor.userId, dto.productId)
  }

  @Get('history')
  history(@CurrentAuth() actor: SecurityActor, @Query() q: HistoryQueryDto) {
    return this.svc.history(actor.userId, q.productId, q.limit)
  }

  @Post('redemptions')
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
  listRedemptions(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listRedemptions(actor.userId)
  }

  @Put('redemptions/:id/cancel')
  cancelRedemption(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.svc.cancelRedemption(id, actor.userId)
  }
}
