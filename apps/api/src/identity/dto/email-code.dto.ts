import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ConsentAcceptanceDto } from './consent-acceptance.dto'
import { DeviceDto } from './wallet.dto'

export class RequestEmailCodeDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string
  @ApiProperty({ enum: ['login', 'register'] }) @IsIn(['login', 'register']) intent!: 'login' | 'register'
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(16) locale?: string
  @ApiPropertyOptional({ type: [ConsentAcceptanceDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(2) @ValidateNested({ each: true }) @Type(() => ConsentAcceptanceDto)
  consents?: ConsentAcceptanceDto[]
}

export class EmailLookupDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string
}

export class EmailLookupResultDto {
  @ApiProperty({ enum: ['existing', 'new', 'unavailable'], description: 'existing = verified account; new = no account or an unfinished signup' })
  account!: 'existing' | 'new' | 'unavailable'
  @ApiProperty({ description: 'The existing account has a password, so password sign-in is offered.' }) password!: boolean
  @ApiProperty({ description: 'The existing account has an active passkey, so the passkey prompt is offered first.' }) passkey!: boolean
}

export class ConfirmEmailCodeDto {
  @ApiProperty() @IsUUID() challengeId!: string
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string
  @ApiProperty({ enum: ['login', 'register'] }) @IsIn(['login', 'register']) intent!: 'login' | 'register'
  @ApiProperty({ pattern: '^\\d{6}$' }) @IsString() @Matches(/^\d{6}$/) code!: string
  @ApiPropertyOptional({ type: DeviceDto }) @IsOptional() @ValidateNested() @Type(() => DeviceDto) device?: DeviceDto
}

export class EmailCodeChallengeDto {
  @ApiProperty({ example: true }) accepted!: true
  @ApiProperty({ format: 'uuid' }) challengeId!: string
  @ApiProperty({ example: 600 }) expiresIn!: number
  @ApiProperty({ example: 60 }) retryAfter!: number
}
