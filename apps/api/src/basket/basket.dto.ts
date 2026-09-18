import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

const DECIMAL_6 = /^\d+(\.\d{1,6})?$/
const DECIMAL_8 = /^\d+(\.\d{1,8})?$/

export class CreateBasketStrategyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: 'low' | 'medium' | 'high'

  @IsOptional()
  @IsString()
  @MaxLength(120)
  benchmark?: string

  @IsOptional()
  @IsIn(['manual', 'auto'])
  rebalanceMode?: 'manual' | 'auto'

  @IsOptional()
  @IsString()
  @MaxLength(24)
  rebalanceFrequency?: string

  @IsOptional()
  @Matches(DECIMAL_6)
  minimumSubscriptionUsd?: string

  @IsOptional()
  @Matches(DECIMAL_6)
  minimumRedemptionUsd?: string

  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/)
  cashBufferTargetPct?: string
}

export class CreateBasketVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  methodology?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  riskRules?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  scoringWeights?: string
}

export class TargetAllocationDto {
  @IsOptional()
  @IsString({ each: true })
  assetClasses?: string[]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  maxAssets?: number

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(40)
  cashBufferPct?: number

  @IsOptional()
  @Type(() => Number)
  @Min(5)
  @Max(100)
  maxWeightPct?: number

  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  excludeRestricted?: boolean
}

export class CreateBasketPortfolioDto {
  @IsOptional()
  @IsUUID()
  strategyId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  strategySlug?: string

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsIn(['draft', 'pilot'])
  status?: 'draft' | 'pilot'
}

export class SetBasketPortfolioStatusDto {
  @IsIn(['draft', 'pilot', 'active', 'closed'])
  status!: 'draft' | 'pilot' | 'active' | 'closed'
}

export class ActivateBasketVersionDto {
  @IsUUID()
  versionId!: string
}

export class PlanRebalanceDto {
  @IsOptional()
  @IsIn(['scheduled', 'drift', 'risk', 'manual'])
  trigger?: 'scheduled' | 'drift' | 'risk' | 'manual'

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(50)
  driftThresholdPct?: number

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1_000_000)
  minTradeUsd?: number
}

export class RecordFillDto {
  @Matches(DECIMAL_8)
  executedQuantity!: string

  @Matches(DECIMAL_8)
  averageFillPrice!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalOrderId?: string
}

export class ReconcilePortfolioDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requestId?: string
}

export class CreateDisclosureDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string

  @IsString()
  @MinLength(10)
  @MaxLength(20_000)
  content!: string

  @IsOptional()
  @IsUUID()
  strategyId?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  productType?: string
}

export class BasketSubscribeDto {
  @Matches(DECIMAL_6)
  amountUsd!: string
}

export class BasketRedeemDto {
  @Matches(DECIMAL_8)
  units!: string
}

export class AcknowledgeDisclosureDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  ipHash?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string
}

export class BasketLimitQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

function booleanQuery(): PropertyDecorator {
  return Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
}
