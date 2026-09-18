import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CommunityService } from './community.service'
import { CommunityCommentsQueryDto, CommunityFeedQueryDto } from './dto/community.dto'

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
  feed(@Query() query: CommunityFeedQueryDto) {
    return this.community.getFeed(query)
  }

  @Get('topics')
  @ApiOperation({ summary: 'List community topics' })
  topics() {
    return this.community.listTopics()
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get one published post with its latest comments' })
  post(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.community.getPost(id)
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Page through a post comment thread' })
  comments(@Param('id', new ParseUUIDPipe()) id: string, @Query() query: CommunityCommentsQueryDto) {
    return this.community.listComments(id, query)
  }

  @Get('profiles/:handle')
  @ApiOperation({ summary: 'Get a community profile with stats and recent posts' })
  profile(@Param('handle') handle: string) {
    return this.community.getProfile(handle)
  }
}
