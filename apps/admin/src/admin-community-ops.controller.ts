import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminCommunityOpsService } from './admin-community-ops.service'

function adminId(request: AdminRequest): string {
  if (!request.admin?.id) throw new Error('Authenticated administrator is missing')
  return request.admin.id
}

function numeric(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * C1.5 审核台通道（管理台 /community 页）：
 * 内容队列审核（通过/驳回）、按计划发布、举报处理、社区计数。
 */
@ApiTags('admin-community')
@ApiBearerAuth()
@Controller('admin/community')
@UseGuards(AdminPermissionGuard)
export class AdminCommunityController {
  constructor(private readonly community: AdminCommunityOpsService) {}

  @Get('stats')
  @RequireAdminPermissions('community.content.review')
  @ApiOperation({ summary: 'Community activity counters' })
  stats(@Req() request: AdminRequest) {
    return this.community.stats(adminId(request))
  }

  @Get('queue')
  @RequireAdminPermissions('community.content.review')
  @ApiOperation({ summary: 'List content queue items (review inbox)' })
  queue(@Req() request: AdminRequest, @Query('state') state?: string, @Query('limit') limit?: string) {
    return this.community.queue(adminId(request), { state, limit: limit ? numeric(limit, 100) : undefined })
  }

  @Put('queue/:id/review')
  @RequireAdminPermissions('community.content.review')
  @ApiOperation({ summary: 'Approve or reject a queued content item' })
  review(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const enriched = { ...body, reviewer: (body.reviewer as string) || (request.admin?.email ?? 'admin') }
    return this.community.review(adminId(request), id, enriched)
  }

  @Post('queue/publish-due')
  @RequireAdminPermissions('community.content.review')
  @ApiOperation({ summary: 'Publish approved queue items whose schedule is due' })
  publishDue(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.community.publishDue(adminId(request), body)
  }

  @Get('reports')
  @RequireAdminPermissions('community.content.review')
  @ApiOperation({ summary: 'List content reports (moderation inbox)' })
  reports(@Req() request: AdminRequest, @Query('state') state?: string, @Query('limit') limit?: string) {
    return this.community.reports(adminId(request), { state, limit: limit ? numeric(limit, 100) : undefined })
  }

  @Put('reports/:id')
  @RequireAdminPermissions('community.content.review')
  @ApiOperation({ summary: 'Mark a content report reviewed or dismissed' })
  resolveReport(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.community.resolveReport(adminId(request), id, body)
  }
}
