import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class PlacePredictionBetDto {
  @ApiProperty({ description: 'Polymarket outcome token id', example: '21742633143463906290569050155826241533067272736897614950488156847949938836455' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  tokenId!: string

  @ApiProperty({ description: 'Stake in atomic units (USDT × 1e6)', example: '10000000' })
  @IsString()
  @Matches(/^[1-9][0-9]*$/)
  stakeAtomic!: string

  @ApiPropertyOptional({ description: 'Expected price for slippage protection (0~1)', example: '0.62' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  expectedPrice?: string

  @ApiProperty({ description: 'Client idempotency key (unique per user)', example: 'bet-2026-09-19-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string
}

export class ListPredictionBetsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}
