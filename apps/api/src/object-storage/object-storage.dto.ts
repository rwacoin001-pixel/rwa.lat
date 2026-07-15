import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

const BUCKETS = ['rwa-kyc', 'rwa-assets', 'rwa-attachments'] as const

export class CreateUploadPresignedDto {
  @IsIn(BUCKETS)
  bucket!: string

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.?($|\/))(?!.*[\\\u0000-\u001f\u007f]).+$/)
  key!: string

  @IsString()
  @MaxLength(128)
  @Matches(/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i)
  contentType!: string

  @IsInt()
  @Min(1)
  @Max(104_857_600)
  expectedSizeBytes!: number

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(900)
  expiresInSec?: number
}

export class ObjectReferenceDto {
  @IsIn(BUCKETS)
  bucket!: string

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.?($|\/))(?!.*[\\\u0000-\u001f\u007f]).+$/)
  key!: string
}

export class CreateDownloadPresignedDto extends ObjectReferenceDto {
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(900)
  expiresInSec?: number
}

export class CompleteUploadDto {
  @IsUUID()
  presignedId!: string

  @IsInt()
  @Min(1)
  @Max(104_857_600)
  sizeBytes!: number

  @IsOptional()
  @Matches(/^[a-f0-9]{32}$/i)
  md5?: string
}

export class ObjectScanResultDto {
  @IsUUID()
  objectId!: string

  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/i)
  provider!: string

  @IsIn(['clean', 'infected', 'error'])
  status!: 'clean' | 'infected' | 'error'

  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256?: string

  @IsOptional()
  @IsString()
  @MaxLength(256)
  providerReference?: string

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>
}

export class CreateUserAttachmentUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(pdf|png|jpe?g|txt)$/i)
  fileName!: string

  @IsString()
  @MaxLength(128)
  @Matches(/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i)
  contentType!: string

  @IsInt()
  @Min(1)
  @Max(26_214_400)
  expectedSizeBytes!: number

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(900)
  expiresInSec?: number
}

export class UserObjectReferenceDto {
  @IsUUID()
  objectId!: string
}
