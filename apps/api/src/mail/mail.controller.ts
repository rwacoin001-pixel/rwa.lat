import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { assertAdminPermission } from '../admin-rbac/admin-authorization'
import { InboundEmailGuard } from './inbound-email.guard'
import { InboundMailDto, MailListDto, MailReplyDto, MailStateDto } from './mail.dto'
import { MailService } from './mail.service'

@Controller('internal/inbound-email')
@UseGuards(InboundEmailGuard)
export class InboundEmailController {
  constructor(private readonly mail: MailService) {}
  // The HMAC grants only the inbound email capability; no user or administrator impersonation.
  @Post() receive(@Body() body: InboundMailDto) { return this.mail.receive(body) }
}

@Controller('admin/mail')
@UseGuards(AdminSessionGuard)
export class MailController {
  constructor(private readonly mail: MailService, private readonly rbac: AdminRbacService) {}
  @Get() async list(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: MailListDto) {
    await assertAdminPermission(admin, this.rbac, 'mail.read')
    return this.mail.list(query)
  }
  @Get('unread-count') async count(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await assertAdminPermission(admin, this.rbac, 'mail.read')
    return this.mail.unreadCount()
  }
  @Get('attachments/:id') async attachment(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string) {
    await assertAdminPermission(admin, this.rbac, 'mail.read')
    return this.mail.attachment(id, admin.id)
  }
  @Get(':id') async thread(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Query() query: MailListDto) {
    await assertAdminPermission(admin, this.rbac, 'mail.read')
    return this.mail.thread(id, query.offset)
  }
  @Post(':id/state') async state(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() body: MailStateDto) {
    await assertAdminPermission(admin, this.rbac, 'mail.read')
    return this.mail.state(id, body, admin.id)
  }
  @Post(':id/reply') async reply(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() body: MailReplyDto) {
    await assertAdminPermission(admin, this.rbac, 'mail.read')
    await assertAdminPermission(admin, this.rbac, 'mail.reply')
    return this.mail.reply(id, body, admin.id)
  }
}
