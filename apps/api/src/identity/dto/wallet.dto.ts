import { IsOptional, IsString, Length, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class DeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 128)
  fingerprint?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string
}

export class WalletChallengeDto {
  @ApiProperty()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  address!: string
}

export class WalletVerifyDto {
  @ApiProperty()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  address!: string

  @ApiProperty()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  signature!: string

  @ApiProperty()
  @IsString()
  nonce!: string

  @ApiPropertyOptional()
  @IsOptional()
  device?: DeviceDto
}
