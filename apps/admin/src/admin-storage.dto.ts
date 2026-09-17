import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export const STORAGE_BUCKET_VALUES = ['rwa-kyc', 'rwa-assets', 'rwa-attachments'] as const
export const STORAGE_PURPOSES = ['product-media', 'disclosure', 'kyc', 'misc'] as const
export const STORAGE_SCAN_STATUSES = ['pending', 'clean', 'quarantined', 'failed'] as const

export class CreateStorageUploadDto {
  @IsIn(STORAGE_BUCKET_VALUES as unknown as string[])
  bucket!: (typeof STORAGE_BUCKET_VALUES)[number]

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fileName!: string

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  contentType!: string

  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  expectedSizeBytes!: number

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string

  @IsOptional()
  @IsIn(STORAGE_PURPOSES as unknown as string[])
  purpose?: (typeof STORAGE_PURPOSES)[number]

  @IsOptional()
  @IsUUID()
  productId?: string
}

export class CompleteStorageUploadDto {
  @IsUUID()
  presignedId!: string

  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  sizeBytes!: number

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{32}$/i)
  md5?: string
}

export class StorageObjectQueryDto {
  @IsOptional()
  @IsIn(STORAGE_BUCKET_VALUES as unknown as string[])
  bucket?: (typeof STORAGE_BUCKET_VALUES)[number]

  @IsOptional()
  @IsIn(STORAGE_SCAN_STATUSES as unknown as string[])
  scanStatus?: (typeof STORAGE_SCAN_STATUSES)[number]

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,5}$/)
  page?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/)
  pageSize?: string
}
