import { IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DeviceDto } from './wallet.dto'

export class OAuthCallbackDto {
  @ApiProperty()
  @IsString()
  @Length(1, 255)
  code!: string

  @ApiProperty()
  @IsString()
  @Length(16, 512)
  state!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redirectUri?: string

  @ApiPropertyOptional()
  @IsOptional()
  device?: DeviceDto
}
