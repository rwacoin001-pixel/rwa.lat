import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'


export const STORAGE_BUCKET_VALUES = ['rwa-kyc', 'rwa-assets', 'rwa-attachments'] as const
export const STORAGE_PURPOSES = ['product-media', 'disclosure', 'kyc', 'misc'] as const
export const STORAGE_SCAN_STATUSES = ['pending', 'clean', 'quarantined', 'failed'] as const

export class CreateStorageUploadDto {
  @ApiProperty()
  @IsIn(STORAGE_BUCKET_VALUES as unknown as string[])
  bucket!: (typeof STORAGE_BUCKET_VALUES)[number]

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fileName!: string

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  contentType!: string

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  expectedSizeBytes!: number

  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(STORAGE_PURPOSES as unknown as string[])
  purpose?: (typeof STORAGE_PURPOSES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string
}

export class CompleteStorageUploadDto {
  @ApiProperty()
  @IsUUID()
  presignedId!: string

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  sizeBytes!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{32}$/i)
  md5?: string
}

export class StorageObjectQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(STORAGE_BUCKET_VALUES as unknown as string[])
  bucket?: (typeof STORAGE_BUCKET_VALUES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(STORAGE_SCAN_STATUSES as unknown as string[])
  scanStatus?: (typeof STORAGE_SCAN_STATUSES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,5}$/)
  page?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/)
  pageSize?: string
}
