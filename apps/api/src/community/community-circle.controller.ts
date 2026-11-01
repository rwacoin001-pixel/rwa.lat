import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentAuth } from '../security/current-auth.decorator'
import { AuthenticatedRequest, SessionAuthGuard } from '../security/session-auth.guard'
import { CircleNameDto, CirclePageQueryDto } from './community-circle.dto'
import { CommunityCircleService } from './community-circle.service'
import { CommunityOptionalAuthGuard } from './community-optional-auth.guard'
import { CommunityFeedQueryDto } from './dto/community.dto'

/** Own circles: members are the owner's referral downline at any depth. Every route needs a session; non-members get 404. */
@Controller('community/circles') @UseGuards(SessionAuthGuard)
export class CommunityCircleController {
  constructor(private readonly circles: CommunityCircleService) {}
  @Get('mine') mine(@CurrentAuth() a: AuthenticatedRequest['auth']) { return this.circles.mine(a.userId) }
  @Post() create(@CurrentAuth() a: AuthenticatedRequest['auth'], @Body() dto: CircleNameDto) { return this.circles.create(a.userId, dto.name) }
  @Patch(':id') rename(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() dto: CircleNameDto) { return this.circles.rename(a.userId, id, dto.name) }
  @Delete(':id') remove(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.circles.remove(a.userId, id) }
  @Get(':id/feed') feed(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Query() q: CommunityFeedQueryDto) { return this.circles.feed(a.userId, id, q) }
  @Get(':id/members') members(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Query() q: CirclePageQueryDto) { return this.circles.members(a.userId, id, q) }
  @Post(':id/leave') @HttpCode(200) leave(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.circles.leave(a.userId, id) }
  @Post(':id/rejoin') @HttpCode(200) rejoin(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.circles.rejoin(a.userId, id) }
  @Post('invite/:code/apply') @HttpCode(200) apply(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('code') code: string) { return this.circles.apply(a.userId, code) }
  @Get(':id/requests') requests(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.circles.requests(a.userId, id) }
  @Post(':id/requests/:profileId/approve') @HttpCode(200)
  approve(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Param('profileId', ParseUUIDPipe) profileId: string) { return this.circles.approve(a.userId, id, profileId) }
  @Post(':id/requests/:profileId/reject') @HttpCode(200)
  reject(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Param('profileId', ParseUUIDPipe) profileId: string) { return this.circles.reject(a.userId, id, profileId) }
  @Post(':id/invite/reset') @HttpCode(200) resetInvite(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.circles.resetInvite(a.userId, id) }
  @Get(':id/removed') removed(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.circles.removed(a.userId, id) }
  @Post(':id/members/:profileId/restore') @HttpCode(200)
  restore(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Param('profileId', ParseUUIDPipe) profileId: string) { return this.circles.restore(a.userId, id, profileId) }
  @Post(':id/members/:profileId/remove') @HttpCode(200)
  removeMember(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Param('profileId', ParseUUIDPipe) profileId: string) { return this.circles.removeMember(a.userId, id, profileId) }
}

/** The invite page is readable before sign-in (a signed-in viewer also gets their own standing). */
@Controller('community/circles') @UseGuards(CommunityOptionalAuthGuard)
export class CommunityCircleInviteController {
  constructor(private readonly circles: CommunityCircleService) {}
  @Get('invite/:code') info(@CurrentAuth() a: AuthenticatedRequest['auth'] | undefined, @Param('code') code: string) { return this.circles.inviteInfo(a?.userId, code) }
}
