import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator'

/** 2-20 characters after trimming, no control characters (checked by the pattern on the trimmed value). */
export const CIRCLE_NAME_PATTERN = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{2,20}$/u

export class CircleNameDto {
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(80) @Matches(CIRCLE_NAME_PATTERN, { message: 'name must be 2-20 characters' }) name!: string
}
export class CirclePageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) cursor?: string
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number
}
export class CircleMemberParamDto {
  @ApiProperty() @IsUUID() id!: string
  @ApiProperty() @IsUUID() profileId!: string
}
