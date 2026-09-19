import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

export class CreateTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5_000)
  body!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent'

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['support', 'dispute', 'appeal', 'scam_report'])
  category?: 'support' | 'dispute' | 'appeal' | 'scam_report'

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  order_id?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentObjectIds?: string[]
}

export class CreateTicketMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5_000)
  body!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentObjectIds?: string[]
}

export class AdminTicketResponseDto extends CreateTicketMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['open', 'pending', 'investigating', 'waiting_user', 'resolved', 'closed'])
  status?: 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignee?: string
}

export class AdminTicketListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['open', 'pending', 'investigating', 'waiting_user', 'resolved', 'closed'])
  status?: 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}

export class CreateInvitationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty()
  @IsString()
  role!: string

  @ApiPropertyOptional()
  @IsOptional()
  ttl_ms?: number
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  token!: string
}

export class UpsertPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  channels?: Record<string, boolean>

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  communication_consent?: boolean
}
