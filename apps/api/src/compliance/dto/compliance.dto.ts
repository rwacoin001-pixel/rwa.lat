import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator'

export class StartKycDto {
  @IsString()
  @Length(2, 64)
  provider!: string
}

export class SubmitKycDto {
  @IsString()
  @Length(2, 256)
  providerCaseRef!: string
}

export class DecideKycDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected'

  @IsOptional()
  @IsString()
  @Length(2, 128)
  reasonCode?: string
}

export class ScreenDto {
  @IsIn(['sanctions', 'pep', 'adverse_media', 'wallet_risk'])
  kind!: 'sanctions' | 'pep' | 'adverse_media' | 'wallet_risk'

  @IsOptional()
  identifiers?: Record<string, string>
}

export class EvaluateEligibilityDto {
  @IsString()
  @Length(2, 64)
  productScope!: string

  @IsOptional()
  @IsString()
  @Length(2, 64)
  region?: string
}

export class OpenRiskFlagDto {
  @IsUUID()
  userId!: string

  @IsString()
  @Length(2, 64)
  category!: string

  @IsIn(['low', 'medium', 'high', 'critical'])
  severity!: 'low' | 'medium' | 'high' | 'critical'

  @IsString()
  @Length(2, 64)
  source!: string

  @IsString()
  @Length(2, 128)
  reasonCode!: string
}

export class ResolveRiskFlagDto {
  @IsIn(['under_review', 'resolved', 'dismissed'])
  state!: 'under_review' | 'resolved' | 'dismissed'
}
