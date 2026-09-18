import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { AcknowledgeDisclosureDto, BasketLimitQueryDto, BasketRedeemDto, BasketSubscribeDto } from './basket.dto'
import { BasketPortfolioService } from './portfolio.service'
import { BasketSubscriptionService } from './subscription.service'

/** 用户端 Basket API（SessionAuthGuard；申赎挂开关，默认关闭） */
@ApiTags('basket')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('basket')
export class BasketController {
  constructor(
    private readonly portfolios: BasketPortfolioService,
    private readonly subscriptions: BasketSubscriptionService,
  ) {}

  @Get('portfolios')
  @ApiOperation({ summary: 'List open basket portfolios (pilot/active)' })
  listPortfolios() {
    return this.portfolios.listPortfolios()
  }

  @Get('portfolios/:id')
  @ApiOperation({ summary: 'Basket portfolio detail with holdings, NAV history and your units' })
  detail(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.portfolios.getPortfolioDetail(id, actor.userId)
  }

  @Get('me/subscriptions')
  @ApiOperation({ summary: 'Your basket subscription history' })
  mySubscriptions(@CurrentAuth() actor: SecurityActor, @Query() query: BasketLimitQueryDto) {
    return this.subscriptions.listUserSubscriptions(actor.userId, query.limit)
  }

  @Get('me/redemptions')
  @ApiOperation({ summary: 'Your basket redemption history' })
  myRedemptions(@CurrentAuth() actor: SecurityActor, @Query() query: BasketLimitQueryDto) {
    return this.subscriptions.listUserRedemptions(actor.userId, query.limit)
  }

  @Post('portfolios/:id/subscriptions')
  @ApiOperation({ summary: 'Subscribe USDT into a basket portfolio (idempotent; requires basket.subscriptions switch)' })
  subscribe(
    @CurrentAuth() actor: SecurityActor,
    @Param('id') id: string,
    @Body() dto: BasketSubscribeDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptions.subscribe(actor.userId, id, dto, requireIdempotencyKey(idempotencyKey), request.requestId ?? 'basket-subscribe')
  }

  @Post('portfolios/:id/redemptions')
  @ApiOperation({ summary: 'Redeem basket units for USDT (idempotent; requires basket.redemptions switch)' })
  redeem(
    @CurrentAuth() actor: SecurityActor,
    @Param('id') id: string,
    @Body() dto: BasketRedeemDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptions.redeem(actor.userId, id, dto, requireIdempotencyKey(idempotencyKey), request.requestId ?? 'basket-redeem')
  }

  @Get('disclosures')
  @ApiOperation({ summary: 'List risk disclosures (global basket + optional strategy scope)' })
  disclosures(@Query('strategyId') strategyId?: string) {
    return this.subscriptions.listDisclosures(strategyId)
  }

  @Post('disclosures/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a risk disclosure (required before subscribing when disclosures exist)' })
  acknowledge(@CurrentAuth() actor: SecurityActor, @Param('id') id: string, @Body() dto: AcknowledgeDisclosureDto) {
    return this.subscriptions.acknowledgeDisclosure(actor.userId, id, dto)
  }
}

function requireIdempotencyKey(key: string | undefined): string {
  const value = (key ?? '').trim()
  if (value.length < 8 || value.length > 160) {
    throw new BadRequestException({ code: 'BASKET_AMOUNT_INVALID', message: 'An Idempotency-Key header (8-160 chars) is required.' })
  }
  return value
}
