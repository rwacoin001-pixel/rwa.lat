import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const states = ['filled', 'partially_filled', 'failed'] as const

export class CreateOrderDto {
  // Historic Demo seed IDs predate RFC-4122 version bits, so accept the
  // database UUID textual shape rather than rejecting those valid rows.
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
  productId!: string

  @ApiProperty()
  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['long', 'yes', 'no'])
  outcomeKey?: 'long' | 'yes' | 'no'

  @ApiProperty()
  @IsIn([true])
  riskAccepted!: boolean
}

export class AdvanceOrderDto {
  @ApiProperty()
  @IsIn(states)
  state!: (typeof states)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[1-9]\d{0,77}$/)
  filledAtomicAmount?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}
