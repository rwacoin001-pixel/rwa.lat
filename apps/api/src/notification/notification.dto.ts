import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'
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
  kind!: string

  @ApiProperty()
  @IsString()
  title!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>
}
