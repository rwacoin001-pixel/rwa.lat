import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class StartKycDto {
  @ApiProperty()
  @IsString()
  @Length(2, 64)
  provider!: string
}

export class CaptureKycDto {
  @ApiProperty({ enum: ['passport', 'id_card'] })
  @IsIn(['passport', 'id_card'])
  documentType!: 'passport' | 'id_card'
}

export class SubmitKycDto {
  @ApiProperty()
  @IsString()
  @Length(2, 256)
  providerCaseRef!: string
}

export class CreateHostedKycSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  language?: string
}

export class DecideKycDto {
  @ApiProperty()
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 128)
  reasonCode?: string
}

export class ScreenDto {
  @ApiProperty()
  @IsIn(['sanctions', 'pep', 'adverse_media', 'wallet_risk'])
  kind!: 'sanctions' | 'pep' | 'adverse_media' | 'wallet_risk'

  @ApiPropertyOptional()
  @IsOptional()
  identifiers?: Record<string, string>
}

export class EvaluateEligibilityDto {
  @ApiProperty()
  @IsString()
  @Length(2, 64)
  productScope!: string

  @ApiPropertyOptional({ deprecated: true, description: '仅为兼容保留，当前资格评估忽略此字段，待合规确认可信地区来源后恢复。' })
  @IsOptional()
  @IsString()
  @Length(2, 64)
  region?: string
}

export class OpenRiskFlagDto {
  @ApiProperty()
  @IsUUID()
  userId!: string

  @ApiProperty()
  @IsString()
  @Length(2, 64)
  category!: string

  @ApiProperty()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity!: 'low' | 'medium' | 'high' | 'critical'

  @ApiProperty()
  @IsString()
  @Length(2, 64)
  source!: string

  @ApiProperty()
  @IsString()
  @Length(2, 128)
  reasonCode!: string
}

export class ResolveRiskFlagDto {
  @ApiProperty()
  @IsIn(['under_review', 'resolved', 'dismissed'])
  state!: 'under_review' | 'resolved' | 'dismissed'
}
