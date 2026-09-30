import { IsOptional, IsString, IsInt, Min, Max, Matches, MaxLength, IsNotEmpty, IsUUID } from 'class-validator'
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
  @IsUUID()
  productId!: string

  @ApiProperty()
  @IsString()
  @Matches(/^[0-9]{1,78}$/)
  @Matches(/[1-9]/)
  quantityAtomicAmount!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationAddress?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/\S/)
  requestId!: string
}
