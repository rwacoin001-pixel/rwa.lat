import { IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DeviceDto } from './wallet.dto'

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token!: string

  @ApiPropertyOptional()
  @IsOptional()
  device?: DeviceDto
}
