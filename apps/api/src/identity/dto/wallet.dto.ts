import { Type } from 'class-transformer'
import { ArrayMaxSize, IsInt, Min, Max, IsArray, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ConsentAcceptanceDto } from './consent-acceptance.dto'

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
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  chainId!: number

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
  @Length(64, 2048)
  nonce!: string

  @ApiPropertyOptional()
  @IsOptional()
  device?: DeviceDto

  @ApiPropertyOptional({ type: [ConsentAcceptanceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ConsentAcceptanceDto)
  consents?: ConsentAcceptanceDto[]
}
