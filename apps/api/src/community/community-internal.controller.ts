import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { CommunityService } from './community.service'
import {
  CommunityFollowDto,
  CommunityLikeDto,
  EnqueueCommunityDto,
  PublishCommunityCommentDto,
  PublishCommunityPostDto,
  PublishDueCommunityQueueDto,
  ReviewCommunityQueueItemDto,
  UpsertCommunityProfileDto,
} from './dto/community.dto'

type InternalRequest = Request & { internalActorAdminId?: string }

function actorOf(request: InternalRequest): string {
  if (!request.internalActorAdminId) throw new UnauthorizedException('Internal actor context is missing.')
  return request.internalActorAdminId
}

/**
 * Machine-to-machine channel used by the content engine and operator tooling
 * (Hermes) to run community personas: profile upserts, direct publishes,
 * engagement simulation and the reviewed content queue. Same shared service
 * token as the wallet internal channel; the actor id is required on every call.
 */
@ApiTags('internal-community')
@UseGuards(InternalServiceGuard)
@Controller('internal/community')
export class InternalCommunityController {
  constructor(private readonly community: CommunityService) {}

  @Post('profiles')
  @ApiOperation({ summary: 'Create or update a community profile (persona upsert)' })
  upsertProfile(@Body() dto: UpsertCommunityProfileDto) {
    return this.community.upsertProfile(dto)
  }

  @Post('posts')
  @ApiOperation({ summary: 'Publish a post as a community profile' })
  publishPost(@Body() dto: PublishCommunityPostDto) {
    return this.community.publishPost(dto)
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Publish a comment on a post as a community profile' })
  publishComment(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: PublishCommunityCommentDto) {
    return this.community.publishComment(id, dto)
  }

  @Post('likes')
  @ApiOperation({ summary: 'Like a post or comment as a community profile' })
  like(@Body() dto: CommunityLikeDto) {
    return this.community.like(dto)
  }

  @Post('likes/remove')
  @ApiOperation({ summary: 'Remove a like previously placed by a community profile' })
  unlike(@Body() dto: CommunityLikeDto) {
    return this.community.unlike(dto)
  }

  @Post('follows')
  @ApiOperation({ summary: 'Follow another community profile' })
  follow(@Body() dto: CommunityFollowDto) {
    return this.community.follow(dto)
  }

  @Get('queue')
  @ApiOperation({ summary: 'List content queue items (review inbox)' })
  queue(@Query('state') state?: string, @Query('limit') limit?: string) {
    return this.community.listQueue(state, limit ? Number(limit) : 100)
  }

  @Post('queue')
  @ApiOperation({ summary: 'Enqueue engineered content drafts for review' })
  enqueue(@Body() dto: EnqueueCommunityDto, @Req() request: InternalRequest) {
    return this.community.enqueue(dto, actorOf(request))
  }

  @Put('queue/:id/review')
  @ApiOperation({ summary: 'Approve or reject a queued content item' })
  review(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReviewCommunityQueueItemDto) {
    return this.community.reviewQueueItem(id, dto)
  }

  @Post('queue/publish-due')
  @ApiOperation({ summary: 'Publish approved queue items whose schedule is due' })
  publishDue(@Body() dto: PublishDueCommunityQueueDto) {
    return this.community.publishDueQueueItems(dto)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Community activity counters for operator dashboards' })
  stats() {
    return this.community.stats()
  }
}
