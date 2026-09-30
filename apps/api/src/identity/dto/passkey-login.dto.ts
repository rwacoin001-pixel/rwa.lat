import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DeviceDto } from './wallet.dto'

export class PasskeyLoginChallengeDto {
  @ApiPropertyOptional({ description: 'Optional email to scope the passkey prompt to that account' })
  @IsOptional()
  @IsEmail()
  email?: string
}

export class PasskeyLoginVerifyDto {
  @ApiProperty()
  @IsString()
  challengeId!: string

  @ApiProperty({ description: 'WebAuthn AuthenticationResponseJSON from navigator.credentials.get()' })
  @IsObject()
  response!: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  device?: DeviceDto
}
