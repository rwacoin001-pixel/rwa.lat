import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

const states = ['filled', 'partially_filled', 'failed'] as const

export class CreateOrderDto {
  // Historic Demo seed IDs predate RFC-4122 version bits, so accept the
  // database UUID textual shape rather than rejecting those valid rows.
  @Matches(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
  productId!: string

  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @IsOptional()
  @IsIn(['long', 'yes', 'no'])
  outcomeKey?: 'long' | 'yes' | 'no'

  @IsIn([true])
  riskAccepted!: boolean
}

export class AdvanceOrderDto {
  @IsIn(states)
  state!: (typeof states)[number]

  @IsOptional()
  @Matches(/^[1-9]\d{0,77}$/)
  filledAtomicAmount?: string

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}
