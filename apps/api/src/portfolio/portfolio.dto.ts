import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CaptureSnapshotDto {
  @ApiProperty()
  @IsString()
  productId!: string
}

export class HistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class RequestRedemptionDto {
  @ApiProperty()
  @IsString()
  productId!: string

  @ApiProperty()
  @IsString()
  quantityAtomicAmount!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationAddress?: string

  @ApiProperty()
  @IsString()
  requestId!: string
}
