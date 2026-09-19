import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
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
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(ASSET_CLASSES)
  assetClass?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  issuer?: string

  @ApiPropertyOptional()
  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  tokenized?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  featured?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['rank', 'market_cap', 'volume', 'change_24h', 'apy', 'name'])
  sort?: 'rank' | 'market_cap' | 'volume' | 'change_24h' | 'apy' | 'name'

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class AssetHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number
}

export class RankingsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['market_cap', 'tvl', 'volume', 'apy', 'change_24h', 'score'])
  metric?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class SyncTriggerDto {
  @ApiProperty()
  @IsIn(RWA_SYNC_KINDS as unknown as string[])
  kind!: (typeof RWA_SYNC_KINDS)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  maxItems?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['queue', 'inline'])
  mode?: 'queue' | 'inline'
}
