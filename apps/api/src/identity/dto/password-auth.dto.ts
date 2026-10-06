import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator'
import { ConsentAcceptanceDto } from './consent-acceptance.dto'
import { DeviceDto } from './wallet.dto'

export class PasswordLoginDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string
  @ApiProperty({ maxLength: 128 }) @IsString() @Length(1, 128) password!: string
  @ApiPropertyOptional({ type: DeviceDto }) @IsOptional() @ValidateNested() @Type(() => DeviceDto) device?: DeviceDto
}
export class AuthFlowTokenDto {
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{64}$/) continuationToken!: string
}
export class AuthFlowEmailDto extends AuthFlowTokenDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string
}
export class AuthFlowCompleteDto extends AuthFlowTokenDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\d{6}$/) code?: string
  @ApiPropertyOptional({ minLength: 12, maxLength: 128 }) @IsOptional() @IsString() @Length(12, 128) password?: string
  @ApiPropertyOptional({ type: [ConsentAcceptanceDto] }) @IsOptional() @IsArray() @ArrayMaxSize(2) @ValidateNested({ each: true }) @Type(() => ConsentAcceptanceDto) consents?: ConsentAcceptanceDto[]
}
export class PasswordManageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(24, 4096) reauthentication?: string
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string
  @ApiPropertyOptional({ type: DeviceDto }) @IsOptional() @ValidateNested() @Type(() => DeviceDto) device?: DeviceDto
}

export class ChangeEmailDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string
  @ApiProperty() @IsString() @Length(24, 4096) reauthentication!: string
}
