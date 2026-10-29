import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import { AdminSessionGuard, type AdminRequest } from './admin-session.guard'
import { AdminCoreOpsService } from './admin-core-ops.service'
import { AdminMailListDto, AdminMailReplyDto, AdminMailStateDto } from './admin-mail.dto'

function actor(request: AdminRequest) {
  if (!request.admin?.id) throw new UnauthorizedException('Admin session is required')
  return request.admin.id
}

@Controller('admin/mail')
@UseGuards(AdminSessionGuard, AdminPermissionGuard)
@RequireAdminPermissions('mail.read')
export class AdminMailController {
  constructor(private readonly core: AdminCoreOpsService) {}
  @Get() list(@Req() request: AdminRequest, @Query() query: AdminMailListDto) { return this.core.get(actor(request), '/mail', { ...query }) }
  @Get('unread-count') count(@Req() request: AdminRequest) { return this.core.get(actor(request), '/mail/unread-count') }
  @Get('attachments/:id') async attachment(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    const data = await this.core.get<{ filename: string; content: string }>(actor(request), `/mail/attachments/${id}`)
    response.setHeader('content-type', 'application/octet-stream')
    response.setHeader('content-disposition', `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(data.filename).replace(/'/g, '%27')}`)
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('cache-control', 'private, no-store')
    response.send(Buffer.from(data.content, 'base64'))
  }
  @Get(':id') thread(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Query() query: AdminMailListDto) { return this.core.get(actor(request), `/mail/${id}`, { offset: query.offset }) }
  @Post(':id/state') state(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: AdminMailStateDto) {
    return this.core.post(actor(request), `/mail/${id}/state`, { ...body })
  }
  @Post(':id/reply') @RequireAdminPermissions('mail.read', 'mail.reply')
  reply(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: AdminMailReplyDto) {
    return this.core.post(actor(request), `/mail/${id}/reply`, { ...body })
  }
}
