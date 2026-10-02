import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsDefined, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

/** X-style media limit shared by posts and replies. */
export const MEMBER_MEDIA_MAX = 4

export class MemberPostLocationDto {
  @IsString() @MinLength(1) @MaxLength(80) city!: string
  @IsString() @Matches(/^[A-Z]{2}$/) countryCode!: string
  @IsIn(['device']) source!: 'device'
}
export class MemberPostDto {
  @ApiProperty() @IsDefined() @ValidateNested() @Type(() => MemberPostLocationDto) location!: MemberPostLocationDto
  /** May be empty when at least one image is attached. */
  @ApiProperty() @IsString() @MaxLength(4000) body!: string
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(32, { each: true }) topics?: string[]
  @ApiPropertyOptional({ description: 'Object ids from POST /community/me/media?purpose=post' }) @IsOptional() @IsArray() @ArrayMaxSize(MEMBER_MEDIA_MAX) @IsUUID('all', { each: true }) imageIds?: string[]
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(16) lang?: string
}
export class MemberCommentDto {
  @ApiProperty() @IsString() @MaxLength(2000) body!: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(MEMBER_MEDIA_MAX) @IsUUID('all', { each: true }) imageIds?: string[]
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(16) lang?: string
}
export class MemberProfileDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) displayName!: string
  @ApiProperty() @IsString() @Matches(/^[a-zA-Z0-9_]{3,20}$/) handle!: string
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => MemberPostLocationDto) location?: MemberPostLocationDto
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) bio?: string
}
export class MemberAvatarDto {
  @ApiProperty({ description: 'Object id from POST /community/me/media?purpose=avatar' }) @IsUUID('all') objectId!: string
}
export class MemberMediaQueryDto {
  @ApiPropertyOptional({ enum: ['post', 'avatar'] }) @IsOptional() @IsIn(['post', 'avatar']) purpose?: 'post' | 'avatar'
}
export class ModerateMemberContentDto {
  @ApiProperty() @IsIn(['post', 'comment']) targetType!: 'post' | 'comment'
  @ApiProperty() @IsUUID() targetId!: string
  @ApiProperty() @IsIn(['published', 'hidden', 'removed']) state!: 'published' | 'hidden' | 'removed'
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
