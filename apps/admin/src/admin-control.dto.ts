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

const NETWORKS = ['tron', 'ethereum', 'arbitrum'] as const
const PRODUCT_STATES = ['draft', 'published', 'suspended', 'retired'] as const
const DISCLOSURE_KINDS = ['prospectus', 'risk_disclosure', 'terms', 'regulatory'] as const
const WALLET_PURPOSES = ['deposit', 'withdrawal', 'collection', 'operational'] as const

export class AssetClassInputDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  id!: string

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string
}

class ProductFieldsDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  assetClassId!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  summary?: string

  @IsString()
  @Matches(/^[A-Z][A-Z0-9._-]{1,15}$/)
  assetCode!: string

  @IsInt()
  @Min(0)
  @Max(18)
  assetDecimals!: number

  @IsOptional()
  @IsIn(NETWORKS)
  network?: (typeof NETWORKS)[number]

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  minOrderAtomicAmount?: string

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
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  yieldTerms?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  riskDisclosure?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  mediaRefs?: string[]
}

export class CreateProductDto extends ProductFieldsDto {}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  assetClassId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName?: string

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  summary?: string

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9._-]{1,15}$/)
  assetCode?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(18)
  assetDecimals?: number

  @IsOptional()
  @IsIn(NETWORKS)
  network?: (typeof NETWORKS)[number]

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  minOrderAtomicAmount?: string

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  maxOrderAtomicAmount?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  yieldTerms?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  riskDisclosure?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  mediaRefs?: string[]
}

export class ProductStateDto {
  @IsIn(PRODUCT_STATES)
  state!: (typeof PRODUCT_STATES)[number]
}

export class PriceQuoteInputDto {
  @IsString()
  @Matches(/^[0-9]+$/)
  @MaxLength(78)
  unitPriceAtomicAmount!: string

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  source!: string

  @IsDateString()
  validUntil!: string
}

export class DisclosureInputDto {
  @IsIn(DISCLOSURE_KINDS)
  kind!: (typeof DISCLOSURE_KINDS)[number]

  @IsString()
  @Matches(/^[a-zA-Z]{2,5}(-[a-zA-Z]{2,5})?$/)
  locale!: string

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^(?!.*[\u0000-\u001f\u007f]).+$/)
  storageRef!: string

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  contentHash!: string
}

export class SwitchInputDto {
  @IsBoolean()
  enabled!: boolean

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string
}

export class TreasuryAddressInputDto {
  @IsIn(NETWORKS)
  network!: (typeof NETWORKS)[number]

  @IsString()
  @Matches(/^[A-Z][A-Z0-9._-]{1,15}$/)
  assetCode!: string

  @IsIn(WALLET_PURPOSES)
  purpose!: (typeof WALLET_PURPOSES)[number]

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  @Matches(/^(?!.*(?:private.?key|seed.?phrase|mnemonic|secret))/i)
  address!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  memo?: string

  @IsOptional()
  @IsIn(['active', 'inactive'])
  state?: 'active' | 'inactive'
}

