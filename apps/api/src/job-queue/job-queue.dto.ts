import { IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class EnqueueDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9._-]{1,63}$/)
  queueName!: string

  @IsObject()
  payload!: Record<string, unknown>

  @IsOptional()
  @IsString()
  @MaxLength(256)
  dedupKey?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number
}

export class NackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  error!: string
}

export class ReceiveCallbackDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/i)
  partner!: string

  @IsString()
  @Matches(/^[a-z][a-z0-9._-]{1,127}$/i)
  eventType!: string

  @IsObject()
  payload!: Record<string, unknown>
}
