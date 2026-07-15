import { IsObject, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator'

export class TotpCodeDto {
  @Matches(/^\d{6}$/)
  code!: string
}

export class TotpEnrollmentDto extends TotpCodeDto {
  @IsUUID()
  factorId!: string
}

export class RecoveryCodeDto {
  @Matches(/^[A-Z0-9-]{8,16}$/i)
  code!: string
}

export class StepUpDto {
  @IsString()
  @Length(24, 4096)
  reauthentication!: string
}

export class PasskeyFinishDto {
  @IsUUID()
  challengeId!: string

  @IsObject()
  response!: Record<string, unknown>

  @IsOptional()
  @IsString()
  @Length(1, 80)
  label?: string
}

export class PasskeyAssertionFinishDto extends PasskeyFinishDto {}
