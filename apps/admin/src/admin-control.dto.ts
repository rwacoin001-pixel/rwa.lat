import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'


const NETWORKS = ['tron', 'ethereum', 'arbitrum'] as const
const PRODUCT_STATES = ['draft', 'published', 'suspended', 'retired'] as const
const DISCLOSURE_KINDS = ['prospectus', 'risk_disclosure', 'terms', 'regulatory'] as const
const WALLET_PURPOSES = ['deposit', 'withdrawal', 'collection', 'operational'] as const

export class AssetClassInputDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  id!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string
}

class ProductFieldsDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  assetClassId!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  summary?: string

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9._-]{1,15}$/)
  assetCode!: string

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(18)
  assetDecimals!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(NETWORKS)
  network?: (typeof NETWORKS)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  minOrderAtomicAmount?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  maxOrderAtomicAmount?: string

  /**
   * Structured fields let the operator add issuer, backing, maturity,
   * liquidity, yield, risk and localization fields without another migration.
   * The API still caps the payload size and the UI only sends JSON objects.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  yieldTerms?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  riskDisclosure?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  mediaRefs?: string[]
}

export class CreateProductDto extends ProductFieldsDto {}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  assetClassId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  summary?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9._-]{1,15}$/)
  assetCode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(18)
  assetDecimals?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(NETWORKS)
  network?: (typeof NETWORKS)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  minOrderAtomicAmount?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  maxOrderAtomicAmount?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  yieldTerms?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  riskDisclosure?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  mediaRefs?: string[]
}

export class ProductStateDto {
  @ApiProperty()
  @IsIn(PRODUCT_STATES)
  state!: (typeof PRODUCT_STATES)[number]
}

export class PriceQuoteInputDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  unitPriceAtomicAmount!: string

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  source!: string

  @ApiProperty()
  @IsDateString()
  validUntil!: string
}

export class DisclosureInputDto {
  @ApiProperty()
  @IsIn(DISCLOSURE_KINDS)
  kind!: (typeof DISCLOSURE_KINDS)[number]

  @ApiProperty()
  @IsString()
  @Matches(/^[a-zA-Z]{2,5}(-[a-zA-Z]{2,5})?$/)
  locale!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^(?!.*[\u0000-\u001f\u007f]).+$/)
  storageRef!: string

  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  contentHash!: string
}

export class SwitchInputDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string
}

export class TreasuryAddressInputDto {
  @ApiProperty()
  @IsIn(NETWORKS)
  network!: (typeof NETWORKS)[number]

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9._-]{1,15}$/)
  assetCode!: string

  @ApiProperty()
  @IsIn(WALLET_PURPOSES)
  purpose!: (typeof WALLET_PURPOSES)[number]

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  @Matches(/^(?!.*(?:private.?key|seed.?phrase|mnemonic|secret))/i)
  address!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  memo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['active', 'inactive'])
  state?: 'active' | 'inactive'
}

