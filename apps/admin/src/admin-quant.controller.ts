import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminQuantService } from './admin-quant.service'

function adminId(request: AdminRequest): string {
  if (!request.admin?.id) throw new Error('Authenticated administrator is missing')
  return request.admin.id
}

/**
 * Koala Quant operations (console /quant): product configuration and the daily settlement - enter the strategy's real
 * return, a second operator approves, the core API posts it. Entering and approving are separate people by rule.
 */
@ApiTags('admin-quant')
@ApiBearerAuth()
@Controller('admin/quant')
@UseGuards(AdminPermissionGuard)
@RequireAdminPermissions('quant.operations.manage')
export class AdminQuantController {
  constructor(private readonly quant: AdminQuantService) {}

  @Get('products')
  @ApiOperation({ summary: 'Koala Quant products with totals, queue and ledger checks' })
  products(@Req() request: AdminRequest) {
    return this.quant.products(adminId(request))
  }

  @Get('products/:slug')
  product(@Req() request: AdminRequest, @Param('slug') slug: string) {
    return this.quant.product(adminId(request), slug)
  }

  @Patch('products/:slug')
  @ApiOperation({ summary: 'Update fees, limits, target range, cutoff, first trade date or status' })
  update(@Req() request: AdminRequest, @Param('slug') slug: string, @Body() body: Record<string, unknown>) {
    return this.quant.updateProduct(adminId(request), slug, body)
  }

  @Get('products/:slug/settlements')
  settlements(@Req() request: AdminRequest, @Param('slug') slug: string, @Query('limit') limit?: string) {
    return this.quant.settlements(adminId(request), slug, limit)
  }

  @Post('products/:slug/settlements')
  @ApiOperation({ summary: 'Step 1: enter the real gross return for the next trade date' })
  enter(@Req() request: AdminRequest, @Param('slug') slug: string, @Body() body: Record<string, unknown>) {
    return this.quant.enter(adminId(request), slug, body)
  }

  @Post('settlements/:id/approve')
  @ApiOperation({ summary: 'Step 2: confirm the entry; the day is posted right after' })
  approve(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.quant.approve(adminId(request), id, body)
  }

  @Post('settlements/:id/post')
  @ApiOperation({ summary: 'Retry posting an approved day' })
  post(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.quant.post(adminId(request), id)
  }

  @Post('settlements/:id/void')
  @ApiOperation({ summary: 'Void a draft or approved-but-unposted entry' })
  void(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.quant.void(adminId(request), id)
  }

  @Get('disclosures')
  @ApiOperation({ summary: 'Risk disclosure versions with acknowledgement counts' })
  disclosures(@Req() request: AdminRequest) {
    return this.quant.disclosures(adminId(request))
  }

  @Post('disclosures')
  @ApiOperation({ summary: 'Publish a new risk disclosure version' })
  publishDisclosure(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.quant.publishDisclosure(adminId(request), body)
  }
}
