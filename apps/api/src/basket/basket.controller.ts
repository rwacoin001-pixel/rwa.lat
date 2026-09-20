import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { OptionalSessionAuthGuard } from '../security/optional-session-auth.guard'
import { AcknowledgeDisclosureDto, BasketLimitQueryDto, BasketRedeemDto, BasketSubscribeDto } from './basket.dto'
import { BasketPortfolioService } from './portfolio.service'
import { BasketSubscriptionService } from './subscription.service'

/**
 * 用户端 Basket API。
 * 组合目录/详情/披露为公开读取（详情带可选身份以附加你的份额）；
 * 个人记录与申赎/披露确认需登录 + 运营开关。
 */
@ApiTags('basket')
@ApiBearerAuth()
@Controller('basket')
export class BasketController {
  constructor(
    private readonly portfolios: BasketPortfolioService,
    private readonly subscriptions: BasketSubscriptionService,
  ) {}

  @Get('portfolios')
  @ApiOperation({ summary: 'List open basket portfolios (pilot/active) — public' })
  listPortfolios() {
    return this.portfolios.listPortfolios()
  }

  @Get('portfolios/:id')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Basket portfolio detail with holdings and NAV history — public; your units when signed in' })
  detail(@CurrentAuth() actor: SecurityActor | undefined, @Param('id') id: string) {
    return this.portfolios.getPortfolioDetail(id, actor?.userId)
  }

  @Get('me/subscriptions')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Your basket subscription history' })
  mySubscriptions(@CurrentAuth() actor: SecurityActor, @Query() query: BasketLimitQueryDto) {
    return this.subscriptions.listUserSubscriptions(actor.userId, query.limit)
  }

  @Get('me/redemptions')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Your basket redemption history' })
  myRedemptions(@CurrentAuth() actor: SecurityActor, @Query() query: BasketLimitQueryDto) {
    return this.subscriptions.listUserRedemptions(actor.userId, query.limit)
  }

  @Post('portfolios/:id/subscriptions')
  @UseGuards(SessionAuthGuard)
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
  @UseGuards(SessionAuthGuard)
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
  @ApiOperation({ summary: 'List risk disclosures (global basket + optional strategy scope) — public' })
  disclosures(@Query('strategyId') strategyId?: string) {
    return this.subscriptions.listDisclosures(strategyId)
  }

  @Post('disclosures/:id/acknowledge')
  @UseGuards(SessionAuthGuard)
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
