import { IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PlaceTradingOrderDto {
  @ApiPropertyOptional({ description: 'Trading pair symbol, e.g. ONDO-USDT' })
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiPropertyOptional({ description: 'Trading pair id (alternative to symbol)' })
  @IsOptional()
  @IsString()
  pairId?: string

  @ApiProperty({ enum: ['buy', 'sell'] })
  @IsIn(['buy', 'sell'])
  side!: 'buy' | 'sell'

  @ApiPropertyOptional({ enum: ['limit', 'market'], default: 'limit' })
  @IsOptional()
  @IsIn(['limit', 'market'])
  type?: 'limit' | 'market'

  @ApiPropertyOptional({ description: 'Required for limit orders' })
  @IsOptional()
  @IsNumber()
  @Min(0.0000000001)
  price?: number

  @ApiProperty()
  @IsNumber()
  @Min(0.0000000001)
  quantity!: number

  @ApiPropertyOptional({ description: 'Client idempotency key (8–160 chars)' })
  @IsOptional()
  @IsString()
  @Length(8, 160)
  idempotencyKey?: string
}

export class OrderBookQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  depth?: number
}

export class TradesQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}

export class CandlesQueryDto {
  @ApiPropertyOptional({ enum: ['1m', '5m', '15m', '1h', '4h', '1d'], default: '1h' })
  @IsOptional()
  @IsIn(['1m', '5m', '15m', '1h', '4h', '1d'])
  interval?: string

  @ApiPropertyOptional({ default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number
}

export class MyOrdersQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'partial', 'filled', 'cancelled', 'rejected'] })
  @IsOptional()
  @IsIn(['open', 'partial', 'filled', 'cancelled', 'rejected'])
  state?: string
}
