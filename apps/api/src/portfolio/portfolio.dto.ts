import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator'

export class CaptureSnapshotDto {
  @IsString()
  productId!: string
}

export class HistoryQueryDto {
  @IsOptional()
  @IsString()
  productId?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class RequestRedemptionDto {
  @IsString()
  productId!: string

  @IsString()
  quantityAtomicAmount!: string

  @IsOptional()
  @IsString()
  destinationAddress?: string

  @IsString()
  requestId!: string
}
