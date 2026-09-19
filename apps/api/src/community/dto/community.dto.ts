import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
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
import {
  COMMUNITY_COMMENT_BODY_MAX,
  COMMUNITY_POST_BODY_MAX,
  COMMUNITY_REPORT_REASON_MAX,
  COMMUNITY_TRANSLATION_LANGS,
} from '../community.util'

const HANDLE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/
const POST_SOURCES = ['original', 'rewrite', 'data', 'event', 'user', 'import'] as const

export class CommunityFeedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['latest', 'hot'])
  sort?: 'latest' | 'hot'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  topic?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cursor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class CommunityCommentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  before?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class UpsertCommunityProfileDto {
  @ApiProperty()
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['persona', 'member', 'official'])
  kind?: 'persona' | 'member' | 'official'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  persona?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class PublishCommunityPostDto {
  @ApiProperty()
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_POST_BODY_MAX)
  body!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  topics?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(POST_SOURCES)
  source?: (typeof POST_SOURCES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  lang?: string
}

export class PublishCommunityCommentDto {
  @ApiProperty()
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_COMMENT_BODY_MAX)
  body!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  lang?: string
}

export class CommunityLikeDto {
  @ApiProperty()
  @IsString()
  @Matches(HANDLE_PATTERN)
  handle!: string

  @ApiProperty()
  @IsIn(['post', 'comment'])
  targetType!: 'post' | 'comment'

  @ApiProperty()
  @IsUUID()
  targetId!: string
}

export class CommunityFollowDto {
  @ApiProperty()
  @IsString()
  @Matches(HANDLE_PATTERN)
  follower!: string

  @ApiProperty()
  @IsString()
  @Matches(HANDLE_PATTERN)
  followee!: string
}

export class EnqueueCommunityItemDto {
  @ApiProperty()
  @IsString()
  @Matches(HANDLE_PATTERN)
  profileHandle!: string

  @ApiProperty()
  @IsIn(['post', 'comment'])
  kind!: 'post' | 'comment'

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_POST_BODY_MAX)
  body!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  topics?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  postId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(POST_SOURCES)
  source?: (typeof POST_SOURCES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  lang?: string
}

export class EnqueueCommunityDto {
  @ApiProperty()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EnqueueCommunityItemDto)
  items!: EnqueueCommunityItemDto[]
}

export class ReviewCommunityQueueItemDto {
  @ApiProperty()
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject'

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  reviewer!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string
}

export class PublishDueCommunityQueueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}

export class CreateCommunityReportDto {
  @ApiProperty()
  @IsIn(['post', 'comment', 'profile'])
  targetType!: 'post' | 'comment' | 'profile'

  @ApiProperty()
  @IsUUID()
  targetId!: string

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(COMMUNITY_REPORT_REASON_MAX)
  reason!: string
}

export class ReviewCommunityReportDto {
  @ApiProperty()
  @IsIn(['reviewed', 'dismissed'])
  action!: 'reviewed' | 'dismissed'
}

export class TranslateCommunityTargetDto {
  @ApiProperty()
  @IsIn(['post', 'comment'])
  targetType!: 'post' | 'comment'

  @ApiProperty()
  @IsUUID()
  targetId!: string

  @ApiProperty()
  @IsIn([...COMMUNITY_TRANSLATION_LANGS])
  targetLang!: (typeof COMMUNITY_TRANSLATION_LANGS)[number]
}
