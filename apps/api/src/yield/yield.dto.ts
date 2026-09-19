import { IsIn, IsISO8601, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateYieldBatchDto {
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
  productId!: string

  @ApiProperty()
  @Matches(/^[1-9]\d{0,77}$/)
  totalAtomicAmount!: string

  @ApiProperty()
  @IsISO8601()
  periodStart!: string

  @ApiProperty()
  @IsISO8601()
  periodEnd!: string
}

export class SettlePredictionDto {
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
  productId!: string

  @ApiProperty()
  @IsIn(['yes', 'no', 'void'])
  outcomeKey!: 'yes' | 'no' | 'void'
}
