import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { OptionalSessionAuthGuard } from '../security/optional-session-auth.guard'
import { VerifiedEmailGuard } from '../security/verified-email.guard'
import { QuantLimitQueryDto, QuantRedeemDto, QuantSubscribeDto } from './quant.dto'
import { QuantService } from './quant.service'

function requireIdempotencyKey(key: string | undefined): string {
  const value = (key ?? '').trim()
  if (value.length < 8 || value.length > 160) throw new BadRequestException({ code: 'QUANT_AMOUNT_INVALID', message: 'An Idempotency-Key header (8-160 chars) is required.' })
  return value
}

/** User-facing Koala Quant API. Product pages are public; positions, subscribe and redeem need a signed-in, email-verified user. */
@ApiTags('quant')
@ApiBearerAuth()
@Controller('quant')
export class QuantController {
  constructor(private readonly quant: QuantService) {}

  @Get('products')
  @ApiOperation({ summary: 'Open Koala Quant products with real performance and fees — public' })
  products() {
    return this.quant.listProducts()
  }

  @Get('products/:slug')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Product detail: target range, real performance, fees; your position when signed in' })
  product(@CurrentAuth() actor: SecurityActor | undefined, @Param('slug') slug: string) {
    return this.quant.getProduct(slug, actor?.userId)
  }

  @Get('disclosure')
  @ApiOperation({ summary: 'Latest Koala Quant risk disclosure — acknowledge it through POST /basket/disclosures/:id/acknowledge' })
  disclosure() {
    return this.quant.latestDisclosure()
  }

  @Get('me/positions')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Your Koala Quant positions' })
  positions(@CurrentAuth() actor: SecurityActor) {
    return this.quant.listMyPositions(actor.userId)
  }

  @Get('me/orders')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Your subscriptions and redemptions' })
  orders(@CurrentAuth() actor: SecurityActor, @Query() query: QuantLimitQueryDto) {
    return this.quant.listMyOrders(actor.userId, query.limit ? Number(query.limit) : undefined)
  }

  @Get('me/products/:slug/payouts')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Your day-by-day settlement history for a product' })
  payouts(@CurrentAuth() actor: SecurityActor, @Param('slug') slug: string, @Query() query: QuantLimitQueryDto) {
    return this.quant.listMyPayouts(actor.userId, slug, query.limit ? Number(query.limit) : undefined)
  }

  @Post('products/:slug/subscriptions')
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  @ApiOperation({ summary: 'Subscribe USDT (idempotent; needs the quant.subscriptions switch). Starts earning the day after its trade date.' })
  subscribe(@CurrentAuth() actor: SecurityActor, @Param('slug') slug: string, @Body() dto: QuantSubscribeDto, @Headers('idempotency-key') key: string, @Req() request: AuthenticatedRequest) {
    return this.quant.subscribe(actor.userId, slug, dto.amountUsd, requireIdempotencyKey(key), request.requestId ?? 'quant-subscribe')
  }

  @Post('products/:slug/redemptions')
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  @ApiOperation({ summary: 'Queue a redemption of principal (idempotent; needs the quant.redemptions switch). Paid at the end of its trade date.' })
  redeem(@CurrentAuth() actor: SecurityActor, @Param('slug') slug: string, @Body() dto: QuantRedeemDto, @Headers('idempotency-key') key: string, @Req() request: AuthenticatedRequest) {
    return this.quant.redeem(actor.userId, slug, dto, requireIdempotencyKey(key), request.requestId ?? 'quant-redeem')
  }
}
