import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { AdvanceOrderDto, CreateOrderDto } from './orders.dto'
import { OrdersService } from './orders.service'

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentAuth() actor: SecurityActor) {
    return this.orders.listForUser(actor.userId)
  }

  @Get(':id')
  get(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.orders.getForUser(id, actor.userId)
  }

  @Post()
  create(@CurrentAuth() actor: SecurityActor, @Body() dto: CreateOrderDto, @Headers('idempotency-key') key: string, @Req() request: AuthenticatedRequest) {
    return this.orders.create(actor.userId, dto, key, request.requestId ?? 'unknown')
  }
}

// This controller is deliberately local-Demo-only. OrdersService fails closed
// unless DEMO_OPERATIONS_ENABLED=true and APP_ENV is not production.
@ApiTags('demo-admin')
@Controller('demo-admin/orders')
export class DemoOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list() {
    return this.orders.listForAdmin()
  }

  @Post(':id/advance')
  advance(@Param('id') id: string, @Body() dto: AdvanceOrderDto, @Req() request: AuthenticatedRequest) {
    return this.orders.advance(id, dto, request.requestId ?? 'demo-admin')
  }

  @Post('redemptions/:id/complete')
  completeRedemption(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.orders.completeRedemption(id, request.requestId ?? 'demo-admin-redemption')
  }
}
