import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

export class CreateTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string

  @IsString()
  @MinLength(1)
  @MaxLength(5_000)
  body!: string

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent'

  @IsOptional()
  @IsIn(['support', 'dispute', 'appeal', 'scam_report'])
  category?: 'support' | 'dispute' | 'appeal' | 'scam_report'

  @IsOptional()
  @IsUUID()
  order_id?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentObjectIds?: string[]
}

export class CreateTicketMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5_000)
  body!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentObjectIds?: string[]
}

export class AdminTicketResponseDto extends CreateTicketMessageDto {
  @IsOptional()
  @IsIn(['open', 'pending', 'investigating', 'waiting_user', 'resolved', 'closed'])
  status?: 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'

  @IsOptional()
  @IsString()
  assignee?: string
}

export class AdminTicketListQueryDto {
  @IsOptional()
  @IsIn(['open', 'pending', 'investigating', 'waiting_user', 'resolved', 'closed'])
  status?: 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}

export class CreateInvitationDto {
  @IsOptional()
  @IsEmail()
  email?: string

  @IsString()
  role!: string

  @IsOptional()
  ttl_ms?: number
}

export class AcceptInvitationDto {
  @IsString()
  token!: string
}

export class UpsertPreferencesDto {
  @IsOptional()
  @IsString()
  locale?: string

  @IsOptional()
  @IsObject()
  channels?: Record<string, boolean>

  @IsOptional()
  @IsBoolean()
  communication_consent?: boolean
}
