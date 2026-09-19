import { IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class EnqueueDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z][a-z0-9._-]{1,63}$/)
  queueName!: string

  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  dedupKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number
}

export class NackDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  error!: string
}

export class ReceiveCallbackDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/i)
  partner!: string

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z][a-z0-9._-]{1,127}$/i)
  eventType!: string

  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>
}
