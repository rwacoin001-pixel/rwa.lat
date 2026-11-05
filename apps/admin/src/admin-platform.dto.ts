import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDefined, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, IsUUID, Matches, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator'

export class PlatformDocumentDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string
  @IsString() @Matches(/^(rwa-assets|rwa-attachments)\/[^\r\n]+$/) @MaxLength(520) storageRef!: string
  @IsBoolean() public!: boolean
  @IsOptional() @IsIn(['general','reserve_audit','reserve_custody']) kind?: 'general' | 'reserve_audit' | 'reserve_custody'
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) reportDate?: string
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) asOfDate?: string
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) issuer?: string
}

export class PlatformOfficialChannelDto {
  @IsIn(['website', 'x', 'telegram', 'linkedin', 'discord', 'other']) kind!: 'website' | 'x' | 'telegram' | 'linkedin' | 'discord' | 'other'
  @IsString() @MinLength(1) @MaxLength(80) label!: string
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false }) @MaxLength(500) url!: string
  @IsString() @MaxLength(240) note!: string
}

export class BrandProfileDto {
  @IsIn(['kimeng']) brandId!: 'kimeng'
  @IsIn(['draft', 'ready']) status!: 'draft' | 'ready'
  @IsString() @MaxLength(200) legalName!: string
  @IsString() @MaxLength(100) registrationNumber!: string
  @ValidateIf((_, value) => value !== '') @IsString() @Matches(/^[A-Z]{2}$/) jurisdiction!: string
  @IsString() @MaxLength(500) address!: string
  @ValidateIf((_, value) => value !== '') @IsEmail() @MaxLength(200) supportEmail!: string
  @IsString() @MaxLength(5000) description!: string
}

export class PlatformContentDto {
  @IsString() @MinLength(1) @MaxLength(200) legalName!: string
  @IsString() @MinLength(1) @MaxLength(100) registrationNumber!: string
  @IsString() @Matches(/^[A-Z]{2}$/) jurisdiction!: string
  @IsString() @MinLength(1) @MaxLength(500) address!: string
  @IsEmail() @MaxLength(200) supportEmail!: string
  @IsString() @MaxLength(5000) description!: string
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(250) @ArrayUnique() @Matches(/^[A-Z]{2}$/, { each: true }) allowedRegions!: string[]
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ArrayUnique() @IsIn(['retail', 'professional', 'institutional'], { each: true }) investorTypes!: string[]
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => PlatformDocumentDto) documents!: PlatformDocumentDto[]
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => PlatformOfficialChannelDto) officialChannels?: PlatformOfficialChannelDto[]
  @IsOptional() @IsArray() @ArrayMaxSize(1) @ArrayUnique((value: BrandProfileDto) => value.brandId) @ValidateNested({ each: true }) @Type(() => BrandProfileDto) brandProfiles?: BrandProfileDto[]
}

export class SavePlatformDto {
  @IsInt() @Min(0) expectedRevision!: number
  @IsDefined() @ValidateNested() @Type(() => PlatformContentDto) content!: PlatformContentDto
}

export class PublishPlatformDto {
  @IsInt() @Min(1) expectedRevision!: number
}

export class VerifiedAccessDto {
  @IsString() @Matches(/^[A-Z]{2}$/) region!: string
  @IsIn(['retail', 'professional', 'institutional']) investorType!: string
  @IsString() @MinLength(3) @MaxLength(500) evidenceRef!: string
}

export class InvestmentBlockDto {
  @IsUUID() userId!: string
  @IsOptional() @IsString() @MaxLength(200) reason?: string
}
