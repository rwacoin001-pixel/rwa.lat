import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OrderEventResponseDto {
  @ApiProperty({ type: String, nullable: true })
  previousState!: string | null

  @ApiProperty()
  nextState!: string

  @ApiProperty()
  actorType!: string

  @ApiProperty({ type: String, nullable: true })
  reasonCode!: string | null

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>

  @ApiProperty()
  createdAt!: Date
}

export class OrderResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  userId!: string

  @ApiProperty()
  productId!: string

  @ApiProperty()
  productName!: string

  @ApiProperty()
  assetClassId!: string

  @ApiProperty()
  outcomeKey!: string

  @ApiProperty({ description: 'Currency held and debited for this order.' })
  settlementAssetCode!: string

  @ApiProperty({ description: 'Decimal places for settlement amounts.' })
  settlementAssetDecimals!: number

  @ApiProperty()
  productAssetCode!: string

  @ApiProperty({ description: 'Decimal places for product quantity amounts.' })
  productAssetDecimals!: number

  @ApiProperty({ type: String, nullable: true, description: 'Quote currency captured with the order; null only for legacy rows whose quote source is unavailable.' })
  quoteCurrency!: string | null

  @ApiProperty({ description: 'Decimal places used by unitPriceAtomicAmount.' })
  quoteDecimals!: number

  @ApiProperty()
  requestedAtomicAmount!: string

  @ApiProperty()
  filledAtomicAmount!: string

  @ApiProperty()
  filledQuantityAtomicAmount!: string

  @ApiProperty()
  unitPriceAtomicAmount!: string

  @ApiProperty()
  state!: string

  @ApiProperty({ type: String, nullable: true })
  failureReason!: string | null

  @ApiProperty()
  submittedAt!: Date

  @ApiProperty({ type: Date, nullable: true })
  completedAt!: Date | null

  @ApiProperty({ type: () => [OrderEventResponseDto] })
  events!: OrderEventResponseDto[]

  @ApiPropertyOptional({ description: 'Present only on the response to a create request.' })
  created?: boolean
}
