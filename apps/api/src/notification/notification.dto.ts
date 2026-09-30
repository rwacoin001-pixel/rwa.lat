import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

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

  @IsOptional() @IsUUID('4') idempotencyKey?: string
}
