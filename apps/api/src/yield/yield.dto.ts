import { IsIn, IsISO8601, Matches } from 'class-validator'

export class CreateYieldBatchDto {
  @Matches(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
  productId!: string

  @Matches(/^[1-9]\d{0,77}$/)
  totalAtomicAmount!: string

  @IsISO8601()
  periodStart!: string

  @IsISO8601()
  periodEnd!: string
}

export class SettlePredictionDto {
  @Matches(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
  productId!: string

  @IsIn(['yes', 'no', 'void'])
  outcomeKey!: 'yes' | 'no' | 'void'
}
