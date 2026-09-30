import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { ManualSettlementService } from './manual-settlement.service'
import { ManualSettlementDto, ReviewSettlementDto } from './manual-settlement.dto'

@Controller('admin/manual-settlements')
@UseGuards(InternalServiceGuard)
export class ManualSettlementController {
  constructor(private readonly settlements: ManualSettlementService) {}
  @Get() list() { return this.settlements.list() }
  @Get('orders/:id') orderInfo(@Param('id', ParseUUIDPipe) id: string) { return this.settlements.requestInfo('order', id) }
  @Get('redemptions/:id') redemptionInfo(@Param('id', ParseUUIDPipe) id: string) { return this.settlements.requestInfo('redemption', id) }
  @Post('orders/:id') order(@Param('id', ParseUUIDPipe) id: string, @Body() input: ManualSettlementDto, @Req() req: { internalActorAdminId: string }) {
    return this.settlements.post('order', id, input, req.internalActorAdminId)
  }
  @Post('redemptions/:id') redemption(@Param('id', ParseUUIDPipe) id: string, @Body() input: ManualSettlementDto, @Req() req: { internalActorAdminId: string }) {
    return this.settlements.post('redemption', id, input, req.internalActorAdminId)
  }
  @Post(':id/review') review(@Param('id', ParseUUIDPipe) id: string, @Body() input: ReviewSettlementDto, @Req() req: { internalActorAdminId: string }) {
    return this.settlements.review(id, input, req.internalActorAdminId)
  }
}
