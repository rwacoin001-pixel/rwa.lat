import { IsOptional, IsString } from 'class-validator'
import { DeviceDto } from './wallet.dto'

export class VerifyEmailDto {
  @IsString()
  token!: string

  @IsOptional()
  device?: DeviceDto
}
