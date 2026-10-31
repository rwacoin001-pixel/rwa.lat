import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator'

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
export class DmAttachmentDto {
  @ApiProperty() @IsUUID() mediaId!: string
  @ApiProperty({ enum: ['image', 'file', 'voice'] }) @IsIn(['image', 'file', 'voice']) kind!: 'image' | 'file' | 'voice'
}
export class DmSendDto {
  /** May be empty only when an attachment is sent (checked in the service). */
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(2000) body?: string
  @ApiPropertyOptional({ type: DmAttachmentDto }) @IsOptional() @ValidateNested() @Type(() => DmAttachmentDto) attachment?: DmAttachmentDto
  @ApiProperty() @IsUUID('4') clientId!: string
}
export class DmReadDto {
  @ApiProperty() @IsUUID() messageId!: string
}
export class DmSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() muted?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() archived?: boolean
}
