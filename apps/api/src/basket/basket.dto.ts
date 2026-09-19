import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

const DECIMAL_6 = /^\d+(\.\d{1,6})?$/
const DECIMAL_8 = /^\d+(\.\d{1,8})?$/

export class CreateBasketStrategyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: 'low' | 'medium' | 'high'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  benchmark?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['manual', 'auto'])
  rebalanceMode?: 'manual' | 'auto'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  rebalanceFrequency?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL_6)
  minimumSubscriptionUsd?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL_6)
  minimumRedemptionUsd?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/)
  cashBufferTargetPct?: string
}

export class CreateBasketVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  methodology?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  riskRules?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  scoringWeights?: string
}

export class TargetAllocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  assetClasses?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  maxAssets?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(40)
  cashBufferPct?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(5)
  @Max(100)
  maxWeightPct?: number

  @ApiPropertyOptional()
  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  excludeRestricted?: boolean
}

export class CreateBasketPortfolioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  strategyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  strategySlug?: string

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['draft', 'pilot'])
  status?: 'draft' | 'pilot'
}

export class SetBasketPortfolioStatusDto {
  @ApiProperty()
  @IsIn(['draft', 'pilot', 'active', 'closed'])
  status!: 'draft' | 'pilot' | 'active' | 'closed'
}

export class ActivateBasketVersionDto {
  @ApiProperty()
  @IsUUID()
  versionId!: string
}

export class PlanRebalanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['scheduled', 'drift', 'risk', 'manual'])
  trigger?: 'scheduled' | 'drift' | 'risk' | 'manual'

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(50)
  driftThresholdPct?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1_000_000)
  minTradeUsd?: number
}

export class RecordFillDto {
  @ApiProperty()
  @Matches(DECIMAL_8)
  executedQuantity!: string

  @ApiProperty()
  @Matches(DECIMAL_8)
  averageFillPrice!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalOrderId?: string
}

export class ReconcilePortfolioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requestId?: string
}

export class CreateDisclosureDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(20_000)
  content!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  strategyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  productType?: string
}

export class BasketSubscribeDto {
  @ApiProperty()
  @Matches(DECIMAL_6)
  amountUsd!: string
}

export class BasketRedeemDto {
  @ApiProperty()
  @Matches(DECIMAL_8)
  units!: string
}

export class AcknowledgeDisclosureDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  ipHash?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string
}

export class BasketLimitQueryDto {
  @ApiPropertyOptional()
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
