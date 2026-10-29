import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentAuth } from '../security/current-auth.decorator'
import { AuthenticatedRequest, SessionAuthGuard } from '../security/session-auth.guard'
import { DmHandleDto, DmMessagesQueryDto, DmReadDto, DmSendDto, DmSettingsDto, DmThreadsQueryDto } from './community-dm.dto'
import { CommunityDmService } from './community-dm.service'

@Controller('community/dm') @UseGuards(SessionAuthGuard)
export class CommunityDmController {
  constructor(private readonly dm: CommunityDmService) {}
  @Get('threads') threads(@CurrentAuth() a: AuthenticatedRequest['auth'], @Query() q: DmThreadsQueryDto) { return this.dm.threads(a.userId, q.cursor) }
  @Post('threads') open(@CurrentAuth() a: AuthenticatedRequest['auth'], @Body() dto: DmHandleDto) { return this.dm.open(a.userId, dto.handle) }
  @Get('threads/:id/messages') messages(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Query() q: DmMessagesQueryDto) { return this.dm.messages(a.userId, id, q) }
  @Post('threads/:id/messages') send(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() dto: DmSendDto) { return this.dm.send(a.userId, id, dto) }
  @Post('threads/:id/read') read(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() dto: DmReadDto) { return this.dm.read(a.userId, id, dto.messageId) }
  @Put('threads/:id/settings') settings(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() dto: DmSettingsDto) { return this.dm.settings(a.userId, id, dto) }
  @Get('unread-count') unreadCount(@CurrentAuth() a: AuthenticatedRequest['auth']) { return this.dm.unreadCount(a.userId) }
  @Post('blocks/:handle') block(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param() p: DmHandleDto) { return this.dm.block(a.userId, p.handle, true) }
  @Delete('blocks/:handle') unblock(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param() p: DmHandleDto) { return this.dm.block(a.userId, p.handle, false) }
}
