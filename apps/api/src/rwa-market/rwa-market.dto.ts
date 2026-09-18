import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { RWA_SYNC_KINDS } from './rwa-market.constants'

const ASSET_CLASSES = [
  'treasury',
  'money_market',
  'private_credit',
  'real_estate',
  'commodity',
  'equity',
  'bond',
  'fund',
  'currency',
  'stable_value',
  'other',
] as const

const booleanQuery = () =>
  Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))

export class ListRwaAssetsQueryDto {
  @IsOptional()
  @IsIn(ASSET_CLASSES)
  assetClass?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  issuer?: string

  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  tokenized?: boolean

  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  featured?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string

  @IsOptional()
  @IsIn(['rank', 'market_cap', 'volume', 'change_24h', 'apy', 'name'])
  sort?: 'rank' | 'market_cap' | 'volume' | 'change_24h' | 'apy' | 'name'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class AssetHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number
}

export class RankingsQueryDto {
  @IsOptional()
  @IsIn(['market_cap', 'tvl', 'volume', 'apy', 'change_24h', 'score'])
  metric?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class SyncTriggerDto {
  @IsIn(RWA_SYNC_KINDS as unknown as string[])
  kind!: (typeof RWA_SYNC_KINDS)[number]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  maxItems?: number

  @IsOptional()
  @IsIn(['queue', 'inline'])
  mode?: 'queue' | 'inline'
}
