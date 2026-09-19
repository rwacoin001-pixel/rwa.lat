import { IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DeviceDto } from './wallet.dto'

export class RecoverConfirmDto {
  @ApiProperty()
  @IsString()
  token!: string

  @ApiPropertyOptional()
  @IsOptional()
  device?: DeviceDto
}
