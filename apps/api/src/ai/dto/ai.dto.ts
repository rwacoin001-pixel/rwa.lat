import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AI_ACCOUNT_SCOPES, AiAccountScope } from '../ai-customer-tools.service'

export class AiChatDto {
  @ApiProperty({ description: 'User message', minLength: 1, maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  message!: string

  @ApiPropertyOptional({ description: 'Existing session to continue' })
  @IsOptional()
  @IsString()
  sessionId?: string

  @ApiPropertyOptional({ description: 'Optional UI context, e.g. { type: "asset", id: "ondo-global-markets" }' })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>

  @ApiPropertyOptional({ description: 'Locale for the reply language, e.g. en / zh' })
  @IsOptional()
  @IsString()
  @Length(2, 8)
  locale?: string

  @ApiPropertyOptional({ enum: AI_ACCOUNT_SCOPES, isArray: true, description: 'Explicitly selected own-account information to share with the model for this request.' })
  @IsOptional() @IsArray() @ArrayNotEmpty() @ArrayMaxSize(4) @ArrayUnique() @IsIn(AI_ACCOUNT_SCOPES, { each: true })
  accountScopes?: AiAccountScope[]
}

export class AiFeedbackDto {
  @ApiProperty()
  @IsString()
  messageId!: string

  @ApiProperty()
  @IsBoolean()
  helpful!: boolean
}
