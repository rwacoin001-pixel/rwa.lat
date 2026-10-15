import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { EMAIL_LOCALES } from '../common/email-template'

export class ListNotificationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['in_app', 'email', 'sms', 'push'])
  channel?: 'in_app' | 'email' | 'sms' | 'push'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kind?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['unread', 'read', 'all'])
  filter?: 'unread' | 'read' | 'all'
}

export class CreateNotificationDto {
  @ApiProperty()
  @IsUUID()
  recipient_user_id!: string

  @ApiProperty()
  @IsIn(['in_app', 'email', 'sms', 'push'])
  channel!: 'in_app' | 'email' | 'sms' | 'push'

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  kind!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>

  @ApiPropertyOptional({ enum: [...EMAIL_LOCALES, 'zh_CN'] })
  @IsOptional()
  @IsIn([...EMAIL_LOCALES, 'zh_CN'])
  locale?: string

  @IsOptional() @IsUUID('4') idempotencyKey?: string
}
