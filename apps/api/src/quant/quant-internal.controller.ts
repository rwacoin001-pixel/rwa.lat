import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { QuantApproveDto, QuantEnterReturnDto, QuantLimitQueryDto, QuantUpdateProductDto } from './quant.dto'
import { QuantSettlementService } from './quant-settlement.service'

type InternalRequestLike = { internalActorAdminId?: string; requestId?: string }

/** Operator channel (Bearer ADMIN_SERVICE_TOKEN + x-actor-admin-id): configure the product, enter and approve each day's return. */
@ApiTags('internal-quant')
@UseGuards(InternalServiceGuard)
@Controller('internal/quant')
export class QuantInternalController {
  constructor(private readonly settlements: QuantSettlementService) {}

  @Get('products')
  @ApiOperation({ summary: 'All Koala Quant products with totals and ledger checks' })
  products() {
    return this.settlements.listProducts()
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.settlements.adminProduct(slug)
  }

  @Patch('products/:slug')
  @ApiOperation({ summary: 'Update fees, limits, target range, cutoff, first trade date or status' })
  update(@Param('slug') slug: string, @Body() dto: QuantUpdateProductDto, @Req() request: InternalRequestLike) {
    return this.settlements.updateProduct(slug, dto, request.internalActorAdminId as string)
  }

  @Get('products/:slug/settlements')
  list(@Param('slug') slug: string, @Query() query: QuantLimitQueryDto) {
    return this.settlements.listSettlements(slug, query.limit ? Number(query.limit) : undefined)
  }

  @Post('products/:slug/settlements')
  @ApiOperation({ summary: 'Step 1: enter the strategy real gross return for the next trade date (draft)' })
  enter(@Param('slug') slug: string, @Body() dto: QuantEnterReturnDto, @Req() request: InternalRequestLike) {
    return this.settlements.enter(slug, dto, request.internalActorAdminId as string)
  }

  @Post('settlements/:id/approve')
  @ApiOperation({ summary: 'Step 2: a different operator approves; posting follows immediately' })
  approve(@Param('id') id: string, @Body() dto: QuantApproveDto, @Req() request: InternalRequestLike) {
    return this.settlements.approve(id, request.internalActorAdminId as string, dto.confirmLargeMove === true, request.requestId ?? `quant-approve-${id}`)
  }

  @Post('settlements/:id/post')
  @ApiOperation({ summary: 'Retry posting an approved day (idempotent)' })
  post(@Param('id') id: string, @Req() request: InternalRequestLike) {
    return this.settlements.post(id, request.internalActorAdminId as string, request.requestId ?? `quant-post-${id}`)
  }

  @Post('settlements/:id/void')
  @ApiOperation({ summary: 'Void a draft or approved-but-unposted entry so it can be re-entered' })
  void(@Param('id') id: string, @Req() request: InternalRequestLike) {
    return this.settlements.voidDraft(id, request.internalActorAdminId as string)
  }
}
