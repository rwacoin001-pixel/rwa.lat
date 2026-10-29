import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class DmHandleDto {
  @ApiProperty() @IsString() @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/) handle!: string
}
export class DmThreadsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) cursor?: string
}
export class DmMessagesQueryDto {
  /** The last message id in the previous page. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() before?: string
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number
}
export class DmSendDto {
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(2000) body!: string
  @ApiProperty() @IsUUID('4') clientId!: string
}
export class DmReadDto {
  @ApiProperty() @IsUUID() messageId!: string
}
export class DmSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() muted?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() archived?: boolean
}
