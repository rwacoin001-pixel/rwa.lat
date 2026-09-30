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
  @ApiPropertyOptional() @IsOptional() @IsIn(['support', 'dispute', 'appeal', 'scam_report'])
  category?: 'support' | 'dispute' | 'appeal' | 'scam_report'

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

export class InvitationViewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiProperty({ format: 'uuid' })
  inviterUserId!: string

  @ApiPropertyOptional({ format: 'email' })
  email?: string

  @ApiProperty()
  role!: string

  @ApiProperty({ enum: ['pending', 'accepted', 'revoked', 'expired'] })
  state!: string

  @ApiPropertyOptional({ format: 'uuid' })
  acceptedUserId?: string

  @ApiPropertyOptional({ format: 'date-time' })
  acceptedAt?: Date

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date
}

export class RewardViewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiProperty({ format: 'uuid' })
  userId!: string

  @ApiProperty({ enum: ['referral', 'loyalty', 'promo', 'cashback'] })
  kind!: string

  @ApiProperty({ type: 'string', pattern: '^[0-9]+$' })
  amountAtomic!: string

  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$' })
  currency!: string

  @ApiProperty({ type: 'integer', nullable: true, example: 2, description: 'Decimal places used to format amountAtomic; currently declared for USD only.' })
  decimals!: number | null

  @ApiProperty({ enum: ['earned', 'redeemed', 'expired', 'revoked'] })
  state!: string

  @ApiPropertyOptional()
  referenceType?: string

  @ApiPropertyOptional({ format: 'uuid' })
  referenceId?: string

  @ApiProperty({ format: 'date-time' })
  earnedAt!: Date
}

export class AcceptInvitationResultResponseDto {
  @ApiProperty({ type: () => InvitationViewResponseDto })
  invitation!: InvitationViewResponseDto

  @ApiProperty({ type: () => RewardViewResponseDto })
  inviterReward!: RewardViewResponseDto

  @ApiProperty({ type: () => RewardViewResponseDto })
  inviteeReward!: RewardViewResponseDto
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
