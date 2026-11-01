import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CommunityService } from './community.service'
import { CommunityCommentsQueryDto, CommunityFeedQueryDto, CreateCommunityReportDto, TranslateCommunityTargetDto } from './dto/community.dto'
import { CurrentAuth } from '../security/current-auth.decorator'
import { AuthenticatedRequest } from '../security/session-auth.guard'
import { CommunityReportAuthGuard } from './community-report-auth.guard'
import { CommunityOptionalAuthGuard } from './community-optional-auth.guard'

/**
 * Public community reads. Anonymous access by design: the feed, posts,
 * comments, profiles and topics mirror the public marketing surface.
 */
@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('feed')
  @ApiOperation({ summary: 'List published community posts (latest or hot)' })
  @UseGuards(CommunityOptionalAuthGuard)
  feed(@Query() query: CommunityFeedQueryDto, @CurrentAuth() a?: AuthenticatedRequest['auth']) {
    return this.community.getFeed(query, undefined, undefined, { viewerId: a?.userId })
  }

  @Get('topics')
  @ApiOperation({ summary: 'List community topics' })
  topics() {
    return this.community.listTopics()
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get one published post with its latest comments' })
  @UseGuards(CommunityOptionalAuthGuard)
  post(@Param('id', new ParseUUIDPipe()) id: string, @CurrentAuth() a?: AuthenticatedRequest['auth']) {
    return this.community.getPost(id, a?.userId)
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Page through a post comment thread' })
  @UseGuards(CommunityOptionalAuthGuard)
  comments(@Param('id', new ParseUUIDPipe()) id: string, @Query() query: CommunityCommentsQueryDto, @CurrentAuth() a?: AuthenticatedRequest['auth']) {
    return this.community.listComments(id, query, a?.userId)
  }

  @Get('profiles/:handle')
  @ApiOperation({ summary: 'Get a community profile with stats and recent posts' })
  @UseGuards(CommunityOptionalAuthGuard)
  profile(@Param('handle') handle: string, @CurrentAuth() a?: AuthenticatedRequest['auth']) {
    return this.community.getProfile(handle, a?.userId)
  }

  @Post('reports')
  @UseGuards(CommunityReportAuthGuard)
  @ApiOperation({ summary: 'Submit a content report (private messages require membership)' })
  report(@Body() dto: CreateCommunityReportDto, @CurrentAuth() a?: AuthenticatedRequest['auth']) {
    return this.community.submitReport(dto, a?.userId)
  }

  @Post('translate')
  @ApiOperation({ summary: 'Translate a community post or comment (cached, public)' })
  @UseGuards(CommunityOptionalAuthGuard)
  translate(@Body() dto: TranslateCommunityTargetDto, @CurrentAuth() a?: AuthenticatedRequest['auth']) {
    return this.community.translateTarget(dto, a?.userId)
  }
}
