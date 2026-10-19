import { IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

const USDT_AMOUNT = /^\d{1,30}(\.\d{1,6})?$/

export class QuantSubscribeDto {
  @Matches(USDT_AMOUNT, { message: 'amountUsd must be a positive decimal with up to 6 places' })
  amountUsd!: string
}

export class QuantRedeemDto {
  /** Principal to redeem; omit together with `all` to be rejected, send `all: true` to redeem everything. */
  @IsOptional()
  @Matches(USDT_AMOUNT, { message: 'amountUsd must be a positive decimal with up to 6 places' })
  amountUsd?: string

  @IsOptional()
  @IsBoolean()
  all?: boolean
}

export class QuantLimitQueryDto {
  @IsOptional()
  @IsNumberString()
  @MaxLength(4)
  limit?: string
}

export class QuantEnterReturnDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  tradeDate!: string

  /** The strategy's real gross return for the day, in percent (0.35 = +0.35%, -1.2 = -1.2%). */
  @Matches(/^-?\d{1,3}(\.\d{1,6})?$/)
  grossReturnPct!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}

export class QuantApproveDto {
  @IsOptional()
  @IsBoolean()
  confirmLargeMove?: boolean
}

export class QuantFeeTierDto {
  @IsInt()
  @Min(1)
  @Max(3650)
  maxDays!: number

  @IsInt()
  @Min(0)
  @Max(2000)
  bps!: number
}

export class QuantUpdateProductDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string
  @IsOptional() @IsString() @MaxLength(400) summary?: string
  @IsOptional() @IsIn(['draft', 'pilot', 'active', 'paused', 'closed']) status?: 'draft' | 'pilot' | 'active' | 'paused' | 'closed'
  @IsOptional() @IsInt() @Min(0) @Max(2000) mgmtFeeBps?: number
  @IsOptional() @IsInt() @Min(0) @Max(5000) perfFeeBps?: number
  @IsOptional() @Matches(USDT_AMOUNT) minSubscriptionUsd?: string
  @IsOptional() @Matches(USDT_AMOUNT) minRedemptionUsd?: string
  @IsOptional() @Matches(/^\d{1,2}(\.\d{1,4})?$/) maxDailyMovePct?: string
  @IsOptional() @Matches(/^-?\d{1,3}(\.\d{1,4})?$/) targetAnnualMinPct?: string
  @IsOptional() @Matches(/^-?\d{1,3}(\.\d{1,4})?$/) targetAnnualMaxPct?: string
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) cutoffTime?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) firstTradeDate?: string
}

export class QuantDisclosureDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string

  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  content!: string
}
