import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { COMMUNITY_COMMENT_BODY_MAX, COMMUNITY_POST_BODY_MAX } from '../community.util'

const HANDLE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/
const POST_SOURCES = ['original', 'rewrite', 'data', 'event', 'user', 'import'] as const

export class CommunityFeedQueryDto {
  @IsOptional()
  @IsIn(['latest', 'hot'])
  sort?: 'latest' | 'hot'

  @IsOptional()
  @IsString()
  @MaxLength(32)
  topic?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class CommunityCommentsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  before?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class UpsertCommunityProfileDto {
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName!: string

  @IsOptional()
  @IsIn(['persona', 'member', 'official'])
  kind?: 'persona' | 'member' | 'official'

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string

  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string

  @IsOptional()
  @IsObject()
  persona?: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class PublishCommunityPostDto {
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_POST_BODY_MAX)
  body!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  topics?: string[]

  @IsOptional()
  @IsIn(POST_SOURCES)
  source?: (typeof POST_SOURCES)[number]

  @IsOptional()
  @IsDateString()
  publishedAt?: string
}

export class PublishCommunityCommentDto {
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_COMMENT_BODY_MAX)
  body!: string

  @IsOptional()
  @IsUUID()
  parentId?: string

  @IsOptional()
  @IsDateString()
  publishedAt?: string
}

export class CommunityLikeDto {
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @IsIn(['post', 'comment'])
  targetType!: 'post' | 'comment'

  @IsUUID()
  targetId!: string
}

export class CommunityFollowDto {
  @IsString()
  @Matches(HANDLE_PATTERN)
  follower!: string

  @IsString()
  @Matches(HANDLE_PATTERN)
  followee!: string
}

export class EnqueueCommunityItemDto {
  @IsString()
  @Matches(HANDLE_PATTERN)
  profileHandle!: string

  @IsIn(['post', 'comment'])
  kind!: 'post' | 'comment'

  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_POST_BODY_MAX)
  body!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  topics?: string[]

  @IsOptional()
  @IsUUID()
  postId?: string

  @IsOptional()
  @IsUUID()
  parentId?: string

  @IsOptional()
  @IsDateString()
  scheduledFor?: string

  @IsOptional()
  @IsIn(POST_SOURCES)
  source?: (typeof POST_SOURCES)[number]
}

export class EnqueueCommunityDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EnqueueCommunityItemDto)
  items!: EnqueueCommunityItemDto[]
}

export class ReviewCommunityQueueItemDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject'

  @IsString()
  @MaxLength(64)
  reviewer!: string

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string

  @IsOptional()
  @IsDateString()
  scheduledFor?: string
}

export class PublishDueCommunityQueueDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}
