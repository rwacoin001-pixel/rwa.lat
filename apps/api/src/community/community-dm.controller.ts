import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { CurrentAuth } from '../security/current-auth.decorator'
import { AuthenticatedRequest, SessionAuthGuard } from '../security/session-auth.guard'
import { DmHandleDto, DmMessagesQueryDto, DmReadDto, DmSendDto, DmSettingsDto, DmThreadsQueryDto } from './community-dm.dto'
import { CommunityDmService } from './community-dm.service'
import { DM_ATTACHMENT_MAX_BYTES } from '../object-storage/object-storage.service'

@Controller('community/dm') @UseGuards(SessionAuthGuard)
export class CommunityDmController {
  constructor(private readonly dm: CommunityDmService) {}
  @Get('threads') threads(@CurrentAuth() a: AuthenticatedRequest['auth'], @Query() q: DmThreadsQueryDto) { return this.dm.threads(a.userId, q.cursor) }
  @Post('threads') open(@CurrentAuth() a: AuthenticatedRequest['auth'], @Body() dto: DmHandleDto) { return this.dm.open(a.userId, dto.handle) }
  @Get('threads/:id/messages') messages(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Query() q: DmMessagesQueryDto) { return this.dm.messages(a.userId, id, q) }
  @Post('threads/:id/messages') send(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() dto: DmSendDto) { return this.dm.send(a.userId, id, dto) }
  @Delete('threads/:id/messages/:messageId') unsend(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Param('messageId', ParseUUIDPipe) messageId: string) { return this.dm.unsend(a.userId, id, messageId) }
  /** Multipart `file`: photo, document or voice note, sniffed server-side. Stored pending; readable only after the scan clears it. */
  @Post('attachments') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: DM_ATTACHMENT_MAX_BYTES.file, files: 1, fields: 4 } }))
  upload(@CurrentAuth() a: AuthenticatedRequest['auth'], @UploadedFile() file?: { buffer: Buffer; mimetype?: string; originalname?: string }) { return this.dm.uploadAttachment(a.userId, file) }
  @Get('attachments/:mediaId') async attachment(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('mediaId', ParseUUIDPipe) mediaId: string, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.redirect(302, await this.dm.attachmentUrl(a.userId, mediaId))
  }
  @Post('threads/:id/read') read(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() dto: DmReadDto) { return this.dm.read(a.userId, id, dto.messageId) }
  @Put('threads/:id/settings') settings(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() dto: DmSettingsDto) { return this.dm.settings(a.userId, id, dto) }
  @Get('unread-count') unreadCount(@CurrentAuth() a: AuthenticatedRequest['auth']) { return this.dm.unreadCount(a.userId) }
  @Post('blocks/:handle') block(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param() p: DmHandleDto) { return this.dm.block(a.userId, p.handle, true) }
  @Delete('blocks/:handle') unblock(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param() p: DmHandleDto) { return this.dm.block(a.userId, p.handle, false) }
}
