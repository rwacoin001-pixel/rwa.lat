import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { ListPolymarketMarketsQueryDto, SyncPolymarketMarketsDto } from './polymarket.dto'
import { PolymarketService } from './polymarket.service'

@ApiTags('polymarket')
@Controller('polymarket')
export class PolymarketController {
  constructor(private readonly polymarket: PolymarketService) {}

  @Get('status')
  status() {
    return this.polymarket.status()
  }

  @Get('markets')
  listMarkets(@Query() query: ListPolymarketMarketsQueryDto) {
    return this.polymarket.listMarkets(query.state, query.limit)
  }

  @Get('markets/:id')
  getMarket(@Param('id') id: string) {
    return this.polymarket.getMarket(id)
  }

  @Get('tokens/:tokenId/order-book')
  getOrderBook(@Param('tokenId') tokenId: string) {
    return this.polymarket.getOrderBook(tokenId)
  }
}

@ApiTags('admin-polymarket')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin/polymarket')
export class AdminPolymarketController {
  constructor(private readonly polymarket: PolymarketService) {}

  @Post('sync/markets')
  syncMarkets(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: SyncPolymarketMarketsDto) {
    return this.polymarket.syncMarkets(admin, dto.cursor, dto.limit)
  }
}
