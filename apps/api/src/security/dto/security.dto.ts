import { IsObject, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TotpCodeDto {
  @ApiProperty()
  @Matches(/^\d{6}$/)
  code!: string
}

export class TotpEnrollmentDto extends TotpCodeDto {
  @ApiProperty()
  @IsUUID()
  factorId!: string
}

export class RecoveryCodeDto {
  @ApiProperty()
  @Matches(/^[A-Z0-9-]{8,16}$/i)
  code!: string
}

export class StepUpDto {
  @ApiProperty()
  @IsString()
  @Length(24, 4096)
  reauthentication!: string
}

export class PasskeyFinishDto {
  @ApiProperty()
  @IsUUID()
  challengeId!: string

  @ApiProperty()
  @IsObject()
  response!: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  label?: string
}

export class PasskeyAssertionFinishDto extends PasskeyFinishDto {}
