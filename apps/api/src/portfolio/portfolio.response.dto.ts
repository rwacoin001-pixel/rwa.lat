import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PortfolioPositionResponseDto {
  @ApiProperty()
  productId!: string

  @ApiPropertyOptional()
  outcomeKey?: string

  @ApiProperty()
  assetCode!: string

  @ApiProperty()
  assetDecimals!: number

  @ApiProperty()
  quantityAtomicAmount!: string

  @ApiProperty()
  unitPriceAtomicAmount!: string

  @ApiProperty({ description: 'Decimal places used by unitPriceAtomicAmount.' })
  unitPriceDecimals!: number

  @ApiProperty()
  currency!: string

  @ApiProperty()
  valuedAt!: Date

  @ApiProperty()
  source!: string

  @ApiPropertyOptional()
  costAtomicAmount?: string

  @ApiPropertyOptional()
  cumulativeYieldAtomicAmount?: string
}

export class PortfolioHistoryPointResponseDto {
  @ApiProperty()
  capturedAt!: Date

  @ApiProperty({ description: 'Total market value, represented in currency minor units at currencyDecimals precision.' })
  totalValueAtomicAmount!: string

  @ApiProperty()
  currency!: string

  @ApiProperty({ description: 'Decimal places used by totalValueAtomicAmount.' })
  currencyDecimals!: number
}

export class PortfolioRedemptionResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  productId!: string

  @ApiProperty()
  assetCode!: string

  @ApiProperty()
  quantityAtomicAmount!: string

  @ApiProperty()
  estimatedUnitPriceAtomicAmount!: string

  @ApiProperty({ description: 'Decimal places used by estimatedUnitPriceAtomicAmount.' })
  estimatedUnitPriceDecimals!: number

  @ApiProperty()
  currency!: string

  @ApiPropertyOptional()
  destinationAddress?: string

  @ApiProperty()
  state!: string

  @ApiProperty()
  requestedAt!: Date
}

export class PortfolioSnapshotBatchResponseDto {
  @ApiProperty({ format: 'uuid' })
  snapshotBatchId!: string

  @ApiProperty({ format: 'date-time' })
  capturedAt!: Date

  @ApiProperty()
  snapshotCount!: number

  @ApiProperty({ type: [PortfolioPositionResponseDto] })
  positions!: PortfolioPositionResponseDto[]
}
