import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, Validate, ValidateIf, ValidateNested, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'
import { Type } from 'class-transformer'
import { CARD_FIELDS, type CardAttachment, type CardKind } from './community-card'

/** X-style media limit shared by posts and replies. */
export const MEMBER_MEDIA_MAX = 4
export const MEMBER_AVATAR_PRESETS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16']

export class MemberPostLocationDto {
  @IsString() @MinLength(1) @MaxLength(80) city!: string
  @IsString() @Matches(/^[A-Z]{2}$/) countryCode!: string
  @IsIn(['device']) source!: 'device'
}
export class MemberPostDto {
  /** Required by the service for ordinary posts; optional only with a valid card. */
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => MemberPostLocationDto) location?: MemberPostLocationDto
  /** May be empty when at least one image is attached. */
  @ApiProperty() @IsString() @MaxLength(4000) body!: string
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(32, { each: true }) topics?: string[]
  @ApiPropertyOptional({ description: 'Object ids from POST /community/me/media?purpose=post' }) @IsOptional() @IsArray() @ArrayMaxSize(MEMBER_MEDIA_MAX) @IsUUID('all', { each: true }) imageIds?: string[]
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(16) lang?: string
  /** Post into one of my circles (members only). Omit for an ordinary public post. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() circleId?: string
  /** With circleId: also show this post in the public feeds (one post, one comment thread). Default false. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() alsoPublic?: boolean
  /** A ledger-verified result to attach: { kind: 'quant_day', product, date } or { kind: 'prediction_win', bet }. */
  @ApiPropertyOptional() @IsOptional() @IsObject() proof?: Record<string, unknown>
  @ApiPropertyOptional() @IsOptional() @IsObject() card?: CardAttachment
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') clientRequestId?: string
}
export class CardPreviewDto {
  @IsIn(Object.keys(CARD_FIELDS)) kind!: CardKind
  @IsOptional() @IsUUID() sourceId?: string
}
export class CardSourcesQueryDto {
  @IsIn(Object.keys(CARD_FIELDS)) kind!: CardKind
  @IsOptional() @IsString() @MaxLength(512) cursor?: string
}
export class MemberCommentDto {
  @ApiProperty() @IsString() @MaxLength(2000) body!: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(MEMBER_MEDIA_MAX) @IsUUID('all', { each: true }) imageIds?: string[]
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(16) lang?: string
}
export class MemberProfileDto {
  @ApiPropertyOptional({ enum: ['everyone', 'following'] }) @IsOptional() @IsIn(['everyone', 'following']) dmPolicy?: 'everyone' | 'following'
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) displayName!: string
  @ApiProperty() @IsString() @Matches(/^[a-zA-Z0-9_]{3,20}$/) handle!: string
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => MemberPostLocationDto) location?: MemberPostLocationDto
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) bio?: string
}
/** Whether the person who invited me sees me in their circle (2026-10-28). */
export class CircleVisibilityDto {
  @ApiProperty() @IsBoolean() visible!: boolean
}
@ValidatorConstraint({ name: 'avatarChoice', async: false })
class AvatarChoiceConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const input = args.object as MemberAvatarDto
    return (input.objectId !== undefined) !== (input.preset !== undefined)
  }
  defaultMessage() { return 'Provide exactly one of objectId or preset' }
}
export class MemberAvatarDto {
  // Validate both fields when both or neither are supplied. IsOptional would also skip explicit nulls.
  @ApiPropertyOptional({ description: 'Object id from POST /community/me/media?purpose=avatar' })
  @ValidateIf((o: MemberAvatarDto) => o.objectId !== undefined || o.preset === undefined)
  @Validate(AvatarChoiceConstraint) @IsUUID('all') objectId?: string

  @ApiPropertyOptional({ description: 'Two-digit profession avatar preset, mutually exclusive with objectId', enum: MEMBER_AVATAR_PRESETS })
  @ValidateIf((o: MemberAvatarDto) => o.preset !== undefined || o.objectId === undefined)
  @IsIn(MEMBER_AVATAR_PRESETS) preset?: string
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
