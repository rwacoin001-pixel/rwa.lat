import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsIn(['in_app', 'email', 'sms', 'push'])
  channel?: 'in_app' | 'email' | 'sms' | 'push'

  @IsOptional()
  @IsString()
  kind?: string

  @IsOptional()
  @IsIn(['unread', 'read', 'all'])
  filter?: 'unread' | 'read' | 'all'
}

export class CreateNotificationDto {
  @IsUUID()
  recipient_user_id!: string

  @IsIn(['in_app', 'email', 'sms', 'push'])
  channel!: 'in_app' | 'email' | 'sms' | 'push'

  @IsString()
  kind!: string

  @IsString()
  title!: string

  @IsOptional()
  @IsString()
  body?: string

  @IsOptional()
  payload?: Record<string, unknown>
}
