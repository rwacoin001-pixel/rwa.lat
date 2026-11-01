import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

/** 2-20 characters after trimming, no control characters (checked by the pattern on the trimmed value). */
export const CIRCLE_NAME_PATTERN = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{2,20}$/u
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class CircleNameDto {
  @ApiProperty() @Transform(trim)
  @IsString() @MaxLength(80) @Matches(CIRCLE_NAME_PATTERN, { message: 'name must be 2-20 characters' }) name!: string
}
/** Owner edits: any of the two; at least one is required (checked in the service). */
export class CircleUpdateDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim)
  @IsString() @MaxLength(80) @Matches(CIRCLE_NAME_PATTERN, { message: 'name must be 2-20 characters' }) name?: string
  @ApiPropertyOptional() @IsOptional() @IsBoolean() searchable?: boolean
}
export class CirclePageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) cursor?: string
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number
}
export class CircleSearchQueryDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) q!: string
}
export class CircleInnerSearchQueryDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) q!: string
  @ApiProperty({ enum: ['posts', 'members'] }) @IsIn(['posts', 'members']) type!: 'posts' | 'members'
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) cursor?: string
}
export class CirclePinDto {
  @ApiProperty() @IsUUID() postId!: string
}
export class CircleMuteDto {
  @ApiProperty() @IsBoolean() muted!: boolean
}
export class CircleMemberParamDto {
  @ApiProperty() @IsUUID() id!: string
  @ApiProperty() @IsUUID() profileId!: string
}
