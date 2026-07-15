import { IsOptional, IsString } from 'class-validator'
import { DeviceDto } from './wallet.dto'

export class RecoverConfirmDto {
  @IsString()
  token!: string

  @IsOptional()
  device?: DeviceDto
}
