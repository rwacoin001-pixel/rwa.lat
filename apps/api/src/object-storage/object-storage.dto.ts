import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const BUCKETS = ['rwa-kyc', 'rwa-assets', 'rwa-attachments'] as const

export class CreateUploadPresignedDto {
  @ApiProperty()
  @IsIn(BUCKETS)
  bucket!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.?($|\/))(?!.*[\\\u0000-\u001f\u007f]).+$/)
  key!: string

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i)
  contentType!: string

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(104_857_600)
  expectedSizeBytes!: number

  @ApiProperty()
  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(900)
  expiresInSec?: number
}

export class ObjectReferenceDto {
  @ApiProperty()
  @IsIn(BUCKETS)
  bucket!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.?($|\/))(?!.*[\\\u0000-\u001f\u007f]).+$/)
  key!: string
}

export class CreateDownloadPresignedDto extends ObjectReferenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(900)
  expiresInSec?: number
}

export class CompleteUploadDto {
  @ApiProperty()
  @IsUUID()
  presignedId!: string

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(104_857_600)
  sizeBytes!: number

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-f0-9]{32}$/i)
  md5?: string
}

export class ObjectScanResultDto {
  @ApiProperty()
  @IsUUID()
  objectId!: string

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/i)
  provider!: string

  @ApiProperty()
  @IsIn(['clean', 'infected', 'error'])
  status!: 'clean' | 'infected' | 'error'

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  providerReference?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>
}

export class CreateUserAttachmentUploadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(pdf|png|jpe?g|txt)$/i)
  fileName!: string

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i)
  contentType!: string

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(26_214_400)
  expectedSizeBytes!: number

  @ApiProperty()
  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(900)
  expiresInSec?: number
}

export class UserObjectReferenceDto {
  @ApiProperty()
  @IsUUID()
  objectId!: string
}
