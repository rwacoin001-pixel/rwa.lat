import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard } from '../security/session-auth.guard'
import type { SecurityActor } from '../security/security.service'
import { CandlesQueryDto, MyOrdersQueryDto, OrderBookQueryDto, PlaceTradingOrderDto, TradesQueryDto } from './dto/trading.dto'
import { TradingService } from './trading.service'

@ApiTags('trading')
@Controller('market')
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Get('pairs')
  @ApiOperation({ summary: 'List active trading pairs' })
  listPairs() {
    return this.trading.listPairs()
  }

  @Get('pairs/:symbol')
  @ApiOperation({ summary: 'One trading pair' })
  getPair(@Param('symbol') symbol: string) {
    return this.trading.getPair(symbol)
  }

  @Get('pairs/:symbol/orderbook')
  @ApiOperation({ summary: 'Aggregated order book (bids/asks)' })
  getOrderBook(@Param('symbol') symbol: string, @Query() query: OrderBookQueryDto) {
    return this.trading.getOrderBook(symbol, query.depth ?? 20)
  }

  @Get('pairs/:symbol/trades')
  @ApiOperation({ summary: 'Recent public trades' })
  getTrades(@Param('symbol') symbol: string, @Query() query: TradesQueryDto) {
    return this.trading.getRecentTrades(symbol, query.limit ?? 50)
  }

  @Get('pairs/:symbol/candles')
  @ApiOperation({ summary: 'OHLCV candles aggregated from trades' })
  getCandles(@Param('symbol') symbol: string, @Query() query: CandlesQueryDto) {
    return this.trading.getCandles(symbol, query.interval ?? '1h', query.limit ?? 200)
  }

  @Post('orders')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Place a limit or market order (matching engine executes immediately)' })
  place(@CurrentAuth() actor: SecurityActor, @Body() dto: PlaceTradingOrderDto) {
    return this.trading.placeOrder(actor.userId, dto)
  }

  @Get('orders')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'My trading orders' })
  myOrders(@CurrentAuth() actor: SecurityActor, @Query() query: MyOrdersQueryDto) {
    return this.trading.listMyOrders(actor.userId, query.state)
  }

  @Get('orders/:id')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'One of my orders with its fills' })
  getOrder(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.trading.getOrder(actor.userId, id)
  }

  @Delete('orders/:id')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Cancel my open order' })
  cancel(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.trading.cancelOrder(actor.userId, id)
  }
}
