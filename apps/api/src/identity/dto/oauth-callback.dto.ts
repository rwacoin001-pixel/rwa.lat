import { IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { DeviceDto } from './wallet.dto'

export class OAuthCallbackDto {
  @IsString()
  @Length(1, 255)
  code!: string

  @IsString()
  @Length(16, 512)
  state!: string

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redirectUri?: string

  @IsOptional()
  device?: DeviceDto
}
